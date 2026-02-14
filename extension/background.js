/**
 * BlitzClaw Browser Relay - Background Service Worker
 *
 * Connects to BlitzClaw WebSocket relay and forwards CDP commands
 * between the user's Chrome and their BlitzClaw instance.
 */

const RELAY_URL = "wss://blitzclaw-relay.philippmuller.partykit.dev/parties/main";
const DEV_RELAY_URL = "ws://localhost:1999/parties/main";
const API_BASE_URL = "https://www.blitzclaw.com";

const CONNECT_TIMEOUT_MS = 15000;
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 8;
const MAX_RECENT_LOGS = 120;

let ws = null;
let connected = false;
let connectionState = "disconnected";
let attachedTabId = null;
let connectionToken = null;
let connectionInstanceId = null;
let connectionApiBase = null;
let reconnectAttempts = 0;
let connectInFlight = false;
let connectStartedAt = 0;
let currentConnectAttemptId = 0;
let connectTimeoutId = null;
let reconnectTimeoutId = null;
let lastError = null;
let peerConnected = false;
let shouldAutoReconnect = false;
let debuggerEventListenerBound = false;
let debuggerDetachListenerBound = false;
const recentLogs = [];

function appendLog(level, event, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    meta,
  };
  recentLogs.push(entry);
  if (recentLogs.length > MAX_RECENT_LOGS) {
    recentLogs.shift();
  }

  const line = `[BlitzClaw][relay] ${event} ${JSON.stringify(meta)}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

function normalizeHttpBase(url) {
  return typeof url === "string" ? url.replace(/\/$/, "") : "";
}

function normalizeWsBase(url) {
  return typeof url === "string" ? url.replace(/\/$/, "") : "";
}

function getApiBase(preferredApiBase) {
  const normalizedPreferred = normalizeHttpBase(preferredApiBase);
  if (normalizedPreferred.startsWith("http://") || normalizedPreferred.startsWith("https://")) {
    return normalizedPreferred;
  }

  if (connectionApiBase) {
    return connectionApiBase;
  }

  return API_BASE_URL;
}

function getFallbackRelayBase(apiBase) {
  return apiBase.includes("localhost") ? DEV_RELAY_URL : RELAY_URL;
}

function buildRelayUrl(instanceId, wsUrlFromApi, apiBase) {
  if (wsUrlFromApi && (wsUrlFromApi.startsWith("ws://") || wsUrlFromApi.startsWith("wss://"))) {
    return wsUrlFromApi;
  }
  return `${normalizeWsBase(getFallbackRelayBase(apiBase))}/${encodeURIComponent(instanceId)}`;
}

function clearConnectTimeout() {
  if (connectTimeoutId) {
    clearTimeout(connectTimeoutId);
    connectTimeoutId = null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
}

function setConnectionState(nextState, errorMessage = null) {
  connectionState = nextState;
  lastError = errorMessage;
  updateBadge(nextState);
}

function updateBadge(status) {
  const badges = {
    connected: { text: "ON", color: "#22c55e" },
    connecting: { text: "...", color: "#eab308" },
    disconnected: { text: "OFF", color: "#6b7280" },
    error: { text: "!", color: "#ef4444" },
  };

  const badge = badges[status] || badges.disconnected;
  chrome.action.setBadgeText({ text: badge.text });
  chrome.action.setBadgeBackgroundColor({ color: badge.color });
}

function clearStoredConnectionAuth() {
  chrome.storage.local.remove(["connectionToken", "connectionInstanceId", "connectionApiBase"]);
}

function persistConnectionAuth() {
  if (!connectionToken || !connectionInstanceId) {
    return;
  }
  chrome.storage.local.set({
    connectionToken,
    connectionInstanceId,
    connectionApiBase: connectionApiBase || API_BASE_URL,
  });
}

function clearInMemoryConnectionAuth() {
  connectionToken = null;
  connectionInstanceId = null;
  connectionApiBase = null;
}

function safeSend(message) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }
  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    appendLog("warn", "socket_send_failed", {
      error: error instanceof Error ? error.message : "Unknown send error",
      type: message?.type || "unknown",
    });
    return false;
  }
}

function closeSocket(reason) {
  if (!ws) {
    return;
  }

  const socket = ws;
  ws = null;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onclose = null;
  socket.onerror = null;

  try {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  } catch {
    // Ignore close errors.
  }

  appendLog("info", "socket_closed", { reason });
}

async function fetchTokenValidation(token, apiBase, expectedInstanceId) {
  const url = new URL(`${normalizeHttpBase(apiBase)}/api/browser-relay`);
  url.searchParams.set("action", "validate");
  url.searchParams.set("token", token);
  if (expectedInstanceId) {
    url.searchParams.set("instanceId", expectedInstanceId);
  }

  let response;
  try {
    response = await fetch(url.toString());
  } catch (error) {
    throw new Error(
      `Failed to reach relay validation API (${error instanceof Error ? error.message : "network error"})`
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Fall through to status-based error.
  }

  if (!response.ok || !data || data.valid !== true || !data.instanceId) {
    const apiError =
      (data && typeof data.error === "string" && data.error) ||
      (response.status === 410 ? "Token expired" : `Validation failed (${response.status})`);
    throw new Error(apiError);
  }

  return {
    instanceId: data.instanceId,
    wsUrl: typeof data.wsUrl === "string" ? data.wsUrl : null,
  };
}

function ensureDebuggerListenersBound() {
  if (!debuggerEventListenerBound) {
    chrome.debugger.onEvent.addListener((source, method, params) => {
      if (!source || source.tabId !== attachedTabId || !connected) {
        return;
      }
      safeSend({
        type: "cdp_event",
        method,
        params,
      });
    });
    debuggerEventListenerBound = true;
  }

  if (!debuggerDetachListenerBound) {
    chrome.debugger.onDetach.addListener((source, reason) => {
      if (source?.tabId === attachedTabId) {
        appendLog("warn", "debugger_detached", { tabId: attachedTabId, reason });
        attachedTabId = null;
      }
    });
    debuggerDetachListenerBound = true;
  }
}

async function detachFromTab() {
  if (!attachedTabId) {
    return;
  }

  const tabId = attachedTabId;
  attachedTabId = null;
  try {
    await chrome.debugger.detach({ tabId });
    appendLog("info", "tab_detached", { tabId });
  } catch {
    // Ignore detach failures.
  }
}

async function attachToTab(tabId) {
  if (typeof tabId !== "number") {
    throw new Error("Invalid tab id");
  }

  if (attachedTabId === tabId) {
    return;
  }

  await detachFromTab();

  await chrome.debugger.attach({ tabId }, "1.3");
  attachedTabId = tabId;
  ensureDebuggerListenersBound();
  appendLog("info", "tab_attached", { tabId });
}

async function executeCdpCommand(message) {
  const { id, method, params } = message;

  if (typeof id !== "number" || typeof method !== "string" || !method) {
    safeSend({
      type: "cdp_error",
      id,
      error: "Invalid CDP command payload",
    });
    return;
  }

  try {
    if (!attachedTabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || typeof tab.id !== "number") {
        throw new Error("No active tab to attach to");
      }
      await attachToTab(tab.id);
    }

    const result = await chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      method,
      params && typeof params === "object" ? params : {}
    );

    safeSend({
      type: "cdp_result",
      id,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "CDP command failed";
    appendLog("warn", "cdp_command_failed", { id, method, error: errorMessage });
    safeSend({
      type: "cdp_error",
      id,
      error: errorMessage,
    });
  }
}

function shouldClearTokenOnError(errorMessage) {
  const normalized = (errorMessage || "").toLowerCase();
  return (
    normalized.includes("token") ||
    normalized.includes("auth") ||
    normalized.includes("invalid signature") ||
    normalized.includes("expired")
  );
}

function scheduleReconnect(reason) {
  if (!shouldAutoReconnect || !connectionToken) {
    return;
  }
  if (connectInFlight || reconnectTimeoutId) {
    return;
  }
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    appendLog("error", "reconnect_exhausted", { attempts: reconnectAttempts });
    shouldAutoReconnect = false;
    setConnectionState("error", "Reconnect limit reached");
    clearStoredConnectionAuth();
    clearInMemoryConnectionAuth();
    return;
  }

  reconnectAttempts += 1;
  appendLog("warn", "reconnect_scheduled", {
    reason,
    attempt: reconnectAttempts,
    delayMs: RECONNECT_DELAY_MS,
  });

  reconnectTimeoutId = setTimeout(() => {
    reconnectTimeoutId = null;
    if (!connectionToken || connectInFlight) {
      return;
    }
    void connect(connectionToken, {
      apiBase: connectionApiBase,
      instanceId: connectionInstanceId,
      isReconnect: true,
    });
  }, RECONNECT_DELAY_MS);
}

async function handleRelayMessage(message, context) {
  switch (message.type) {
    case "auth_success":
      connected = true;
      peerConnected = false;
      reconnectAttempts = 0;
      setConnectionState("connected");
      persistConnectionAuth();
      appendLog("info", "auth_success", {
        instanceId: connectionInstanceId,
        apiBase: connectionApiBase,
      });
      context.finish({
        success: true,
        connected: true,
        instanceId: connectionInstanceId,
      });
      break;

    case "auth_error": {
      const authError = message.error || "Authentication failed";
      connected = false;
      peerConnected = false;
      shouldAutoReconnect = false;
      setConnectionState("error", authError);
      clearStoredConnectionAuth();
      clearInMemoryConnectionAuth();
      closeSocket("auth_error");
      appendLog("error", "auth_error", { error: authError });
      context.finish(
        {
          success: false,
          error: authError,
        },
        { disableReconnect: true }
      );
      break;
    }

    case "peer_status":
      if (typeof message.agentConnected === "boolean") {
        peerConnected = message.agentConnected;
      }
      break;

    case "peer_connected":
      if (message.peer === "agent") {
        peerConnected = true;
      }
      break;

    case "peer_disconnected":
      if (message.peer === "agent") {
        peerConnected = false;
      }
      break;

    case "cdp":
      await executeCdpCommand(message);
      break;

    case "ping":
      safeSend({ type: "pong" });
      break;

    case "error": {
      const relayError = message.error || "Relay error";
      appendLog("warn", "relay_error", { error: relayError });

      if (shouldClearTokenOnError(relayError)) {
        shouldAutoReconnect = false;
        clearStoredConnectionAuth();
        clearInMemoryConnectionAuth();
        setConnectionState("error", relayError);
        closeSocket("relay_error");
      }

      if (connectInFlight) {
        context.finish({ success: false, error: relayError });
      }
      break;
    }

    default:
      appendLog("debug", "relay_message_unknown", { type: message.type || "unknown" });
  }
}

async function connect(token, options = {}) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return { success: false, error: "Missing token" };
  }

  if (connectInFlight) {
    const stale = Date.now() - connectStartedAt > CONNECT_TIMEOUT_MS + 1000;
    if (!stale) {
      return { success: false, error: "Connection already in progress" };
    }
    appendLog("warn", "connect_inflight_stale", { elapsedMs: Date.now() - connectStartedAt });
    connectInFlight = false;
    connectStartedAt = 0;
    clearConnectTimeout();
    closeSocket("stale_inflight_reset");
  }

  if (
    ws &&
    ws.readyState === WebSocket.OPEN &&
    connected &&
    connectionToken === normalizedToken &&
    connectionState === "connected"
  ) {
    return { success: true, connected: true, instanceId: connectionInstanceId };
  }

  if (ws && ws.readyState !== WebSocket.CLOSED) {
    closeSocket("switch_connection");
  }

  const attemptId = ++currentConnectAttemptId;
  let settled = false;
  const finish = (payload, finishOptions = {}) => {
    if (settled) {
      return;
    }
    settled = true;

    if (attemptId === currentConnectAttemptId) {
      connectInFlight = false;
      connectStartedAt = 0;
      clearConnectTimeout();
    }

    if (finishOptions.disableReconnect) {
      shouldAutoReconnect = false;
    }

    return payload;
  };

  const apiBase = getApiBase(options.apiBase);
  connectionToken = normalizedToken;
  connectionApiBase = apiBase;
  if (options.instanceId && typeof options.instanceId === "string") {
    connectionInstanceId = options.instanceId;
  }

  connected = false;
  peerConnected = false;
  connectInFlight = true;
  connectStartedAt = Date.now();
  shouldAutoReconnect = true;
  clearReconnectTimer();

  if (!options.isReconnect) {
    reconnectAttempts = 0;
  }

  setConnectionState("connecting");
  appendLog("info", "connect_begin", {
    attemptId,
    apiBase,
    requestedInstanceId: connectionInstanceId,
    reconnect: !!options.isReconnect,
  });

  return new Promise((resolve) => {
    const resolveOnce = (payload, finishOptions) => {
      const finalPayload = finish(payload, finishOptions);
      if (finalPayload) {
        resolve(finalPayload);
      }
    };

    connectTimeoutId = setTimeout(() => {
      if (attemptId !== currentConnectAttemptId || settled) {
        return;
      }
      const timeoutError = "Timed out connecting to browser relay";
      appendLog("warn", "connect_timeout", { attemptId });
      setConnectionState("error", timeoutError);
      closeSocket("connect_timeout");
      resolveOnce({ success: false, error: timeoutError });
      scheduleReconnect("connect_timeout");
    }, CONNECT_TIMEOUT_MS);

    (async () => {
      try {
        const validation = await fetchTokenValidation(
          normalizedToken,
          apiBase,
          options.instanceId || undefined
        );

        if (attemptId !== currentConnectAttemptId || settled) {
          resolveOnce({ success: false, error: "Connection attempt superseded" });
          return;
        }

        connectionInstanceId = validation.instanceId;
        const relayUrl = buildRelayUrl(validation.instanceId, validation.wsUrl, apiBase);
        appendLog("info", "connect_validated", {
          attemptId,
          instanceId: validation.instanceId,
          relayUrl,
        });

        const socket = new WebSocket(relayUrl);
        ws = socket;

        socket.onopen = () => {
          if (socket !== ws || attemptId !== currentConnectAttemptId) {
            return;
          }
          appendLog("info", "socket_open", { attemptId });
          safeSend({
            type: "auth",
            token: connectionToken,
            role: "extension",
          });
        };

        socket.onmessage = async (event) => {
          if (socket !== ws || attemptId !== currentConnectAttemptId) {
            return;
          }

          let message;
          try {
            message = JSON.parse(event.data);
          } catch {
            appendLog("warn", "socket_message_parse_failed", { attemptId });
            return;
          }

          await handleRelayMessage(message, {
            attemptId,
            finish: resolveOnce,
          });
        };

        socket.onerror = () => {
          if (socket !== ws || attemptId !== currentConnectAttemptId) {
            return;
          }
          appendLog("warn", "socket_error", { attemptId });
        };

        socket.onclose = () => {
          if (socket !== ws && attemptId !== currentConnectAttemptId) {
            return;
          }

          ws = null;
          const wasConnected = connected;
          connected = false;
          peerConnected = false;
          appendLog("warn", "socket_close", {
            attemptId,
            wasConnected,
            state: connectionState,
            shouldAutoReconnect,
          });

          if (!settled && connectionState === "connecting") {
            const closeError = lastError || "Connection closed during handshake";
            if (connectionState !== "error") {
              setConnectionState("disconnected");
            }
            resolveOnce({ success: false, error: closeError });
          } else if (connectionState !== "error") {
            setConnectionState("disconnected");
          }

          if ((wasConnected || shouldAutoReconnect) && shouldAutoReconnect && connectionToken) {
            scheduleReconnect("socket_close");
          }
        };
      } catch (error) {
        if (attemptId !== currentConnectAttemptId || settled) {
          resolveOnce({ success: false, error: "Connection attempt superseded" });
          return;
        }

        const errorMessage = error instanceof Error ? error.message : "Failed to connect";
        appendLog("error", "connect_failed", { attemptId, error: errorMessage });
        connected = false;
        peerConnected = false;
        setConnectionState("error", errorMessage);

        if (shouldClearTokenOnError(errorMessage)) {
          shouldAutoReconnect = false;
          clearStoredConnectionAuth();
          clearInMemoryConnectionAuth();
        }

        resolveOnce(
          {
            success: false,
            error: errorMessage,
          },
          { disableReconnect: !shouldAutoReconnect }
        );

        if (shouldAutoReconnect && connectionToken) {
          scheduleReconnect("connect_failed");
        }
      }
    })();
  });
}

async function disconnect() {
  appendLog("info", "disconnect_manual");
  shouldAutoReconnect = false;
  connectInFlight = false;
  connectStartedAt = 0;
  currentConnectAttemptId += 1;
  clearConnectTimeout();
  clearReconnectTimer();
  closeSocket("manual_disconnect");
  await detachFromTab();

  connected = false;
  peerConnected = false;
  reconnectAttempts = 0;
  clearStoredConnectionAuth();
  clearInMemoryConnectionAuth();
  setConnectionState("disconnected");

  return { success: true };
}

async function resetState() {
  appendLog("warn", "reset_state");
  shouldAutoReconnect = false;
  connectInFlight = false;
  connectStartedAt = 0;
  currentConnectAttemptId += 1;
  clearConnectTimeout();
  clearReconnectTimer();
  closeSocket("state_reset");

  connected = false;
  peerConnected = false;
  reconnectAttempts = 0;
  await detachFromTab();
  clearStoredConnectionAuth();
  clearInMemoryConnectionAuth();
  setConnectionState("disconnected");
  return { success: true };
}

function getStatus() {
  return {
    connected,
    state: connectionState,
    connectInFlight,
    attachedTabId,
    hasToken: !!connectionToken,
    instanceId: connectionInstanceId,
    apiBase: connectionApiBase || API_BASE_URL,
    reconnectAttempts,
    lastError,
    peerConnected,
    recentLogs: recentLogs.slice(-20),
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case "connect": {
          const result = await connect(message.token, {
            apiBase: message.apiBase,
            instanceId: message.instanceId,
          });
          sendResponse(result);
          break;
        }

        case "disconnect":
          sendResponse(await disconnect());
          break;

        case "resetState":
          sendResponse(await resetState());
          break;

        case "status":
          sendResponse(getStatus());
          break;

        case "attachTab":
          try {
            await attachToTab(message.tabId);
            sendResponse({ success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to attach tab";
            sendResponse({ success: false, error: errorMessage });
          }
          break;

        default:
          sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unexpected extension error";
      appendLog("error", "runtime_message_failed", {
        action: message?.action || "unknown",
        error: errorMessage,
      });
      sendResponse({ success: false, error: errorMessage });
    }
  })();

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === attachedTabId) {
    attachedTabId = null;
    appendLog("info", "attached_tab_closed", { tabId });
  }
});

chrome.storage.local.get(
  ["connectionToken", "connectionApiBase", "connectionInstanceId"],
  (data) => {
    if (!data.connectionToken) {
      setConnectionState("disconnected");
      return;
    }

    appendLog("info", "restore_connection_begin", {
      instanceId: data.connectionInstanceId || null,
      apiBase: data.connectionApiBase || API_BASE_URL,
    });

    void connect(data.connectionToken, {
      apiBase: data.connectionApiBase || API_BASE_URL,
      instanceId: data.connectionInstanceId || undefined,
      isReconnect: true,
    }).then((result) => {
      if (!result.success) {
        appendLog("warn", "restore_connection_failed", { error: result.error || "Unknown error" });
      }
    });
  }
);

appendLog("info", "background_loaded");
