/**
 * BlitzClaw Browser Relay - Background Service Worker
 * 
 * Connects to BlitzClaw WebSocket relay and forwards CDP commands
 * between the user's Chrome and their BlitzClaw instance.
 */

let ws = null;
let connected = false;
let attachedTabId = null;
let connectionToken = null;
let connectionInstanceId = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

// WebSocket relay endpoint
const RELAY_URL = 'wss://blitzclaw-relay.partykit.dev/party';
const DEV_RELAY_URL = 'ws://localhost:1999/party';
const API_BASE_URL = 'https://www.blitzclaw.com';
const DEV_API_BASE_URL = 'http://localhost:3000';

function getApiBase() {
  return API_BASE_URL;
}

function getRelayUrl(instanceId) {
  // Use dev URL if we're in development
  const baseUrl = RELAY_URL;
  return `${baseUrl}/${instanceId}`;
}

async function fetchInstanceId(token) {
  const apiBase = getApiBase();
  const url = `${apiBase}/api/browser-relay?action=validate&token=${encodeURIComponent(token)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to validate token');
  }
  const data = await response.json();
  if (!data.valid || !data.instanceId) {
    throw new Error(data.error || 'Invalid token');
  }
  return data.instanceId;
}

// Update extension badge
function updateBadge(status) {
  const badges = {
    connected: { text: 'ON', color: '#22c55e' },
    connecting: { text: '...', color: '#eab308' },
    disconnected: { text: 'OFF', color: '#6b7280' },
    error: { text: '!', color: '#ef4444' }
  };
  
  const badge = badges[status] || badges.disconnected;
  chrome.action.setBadgeText({ text: badge.text });
  chrome.action.setBadgeBackgroundColor({ color: badge.color });
}

// Connect to BlitzClaw relay
async function connect(token) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('[BlitzClaw] Already connected');
    return { success: true };
  }

  connectionToken = token;
  updateBadge('connecting');

  return new Promise((resolve) => {
    (async () => {
      try {
        const instanceId = await fetchInstanceId(connectionToken);
        connectionInstanceId = instanceId;
        ws = new WebSocket(getRelayUrl(instanceId));

        ws.onopen = () => {
          console.log('[BlitzClaw] WebSocket connected, authenticating...');
          // Send auth message
          ws.send(JSON.stringify({
            type: 'auth',
            token: connectionToken,
            role: 'extension'
          }));
        };

        ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            await handleMessage(message, resolve);
          } catch (e) {
            console.error('[BlitzClaw] Failed to parse message:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('[BlitzClaw] WebSocket error:', error);
          updateBadge('error');
          resolve({ success: false, error: 'Connection error' });
        };

        ws.onclose = () => {
          console.log('[BlitzClaw] WebSocket closed');
          connected = false;
          updateBadge('disconnected');
          
          // Try to reconnect if we were previously connected
          if (connectionToken && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`[BlitzClaw] Reconnecting (attempt ${reconnectAttempts})...`);
            setTimeout(() => connect(connectionToken), RECONNECT_DELAY);
          }
        };

      } catch (error) {
        console.error('[BlitzClaw] Failed to connect:', error);
        updateBadge('error');
        resolve({ success: false, error: error.message });
      }
    })();
  });
}

// Handle incoming messages from relay
async function handleMessage(message, resolveConnect) {
  switch (message.type) {
    case 'auth_success':
      console.log('[BlitzClaw] Authenticated successfully');
      connected = true;
      reconnectAttempts = 0;
      updateBadge('connected');
      
      // Store token for auto-reconnect
      chrome.storage.local.set({ connectionToken });
      
      if (resolveConnect) {
        resolveConnect({ success: true });
      }
      break;

    case 'auth_error':
      console.error('[BlitzClaw] Auth failed:', message.error);
      updateBadge('error');
      if (resolveConnect) {
        resolveConnect({ success: false, error: message.error });
      }
      break;

    case 'cdp':
      // CDP command from the agent
      await executeCdpCommand(message);
      break;

    case 'ping':
      // Keep-alive
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      console.log('[BlitzClaw] Unknown message type:', message.type);
  }
}

// Execute CDP command and return result
async function executeCdpCommand(message) {
  const { id, method, params } = message;

  try {
    // Ensure we have a tab attached
    if (!attachedTabId) {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await attachToTab(tab.id);
      } else {
        throw new Error('No active tab to attach to');
      }
    }

    // Execute CDP command
    const result = await chrome.debugger.sendCommand(
      { tabId: attachedTabId },
      method,
      params || {}
    );

    // Send result back
    ws.send(JSON.stringify({
      type: 'cdp_result',
      id,
      result
    }));

  } catch (error) {
    console.error('[BlitzClaw] CDP error:', error);
    ws.send(JSON.stringify({
      type: 'cdp_error',
      id,
      error: error.message
    }));
  }
}

// Attach debugger to tab
async function attachToTab(tabId) {
  if (attachedTabId === tabId) return;

  // Detach from previous tab if any
  if (attachedTabId) {
    try {
      await chrome.debugger.detach({ tabId: attachedTabId });
    } catch (e) {
      // Ignore detach errors
    }
  }

  // Attach to new tab
  await chrome.debugger.attach({ tabId }, '1.3');
  attachedTabId = tabId;
  console.log('[BlitzClaw] Attached to tab:', tabId);

  // Listen for debugger events
  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (source.tabId === attachedTabId && ws && connected) {
      ws.send(JSON.stringify({
        type: 'cdp_event',
        method,
        params
      }));
    }
  });
}

// Disconnect from relay
function disconnect() {
  connectionToken = null;
  connectionInstanceId = null;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
  
  if (attachedTabId) {
    try {
      chrome.debugger.detach({ tabId: attachedTabId });
    } catch (e) {
      // Ignore
    }
    attachedTabId = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  connected = false;
  updateBadge('disconnected');
  chrome.storage.local.remove('connectionToken');
  
  return { success: true };
}

// Get current status
function getStatus() {
  return {
    connected,
    attachedTabId,
    hasToken: !!connectionToken
  };
}

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.action) {
      case 'connect':
        const result = await connect(message.token);
        sendResponse(result);
        break;

      case 'disconnect':
        sendResponse(disconnect());
        break;

      case 'status':
        sendResponse(getStatus());
        break;

      case 'attachTab':
        try {
          await attachToTab(message.tabId);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true; // Keep channel open for async response
});

// Handle tab close - detach if it was our attached tab
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === attachedTabId) {
    attachedTabId = null;
    console.log('[BlitzClaw] Attached tab closed');
  }
});

// Try to restore connection on startup
chrome.storage.local.get('connectionToken', (data) => {
  if (data.connectionToken) {
    console.log('[BlitzClaw] Restoring previous connection...');
    connect(data.connectionToken);
  } else {
    updateBadge('disconnected');
  }
});

console.log('[BlitzClaw] Browser Relay loaded');
