/**
 * BlitzClaw Browser Relay - Content Script
 * 
 * Runs on BlitzClaw dashboard pages to:
 * 1. Auto-detect connection tokens
 * 2. Provide "Connect Browser" button integration
 */

const CONNECT_PATH = "/relay/connect";

function getTokenFromPage() {
  const tokenElement = document.querySelector("[data-browser-relay-token]");
  if (tokenElement && tokenElement.dataset.browserRelayToken) {
    return tokenElement.dataset.browserRelayToken;
  }

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("token") || urlParams.get("relay-token");
}

function getInstanceIdFromPage() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("instance");
}

function connectWithToken(token, instanceId) {
  const dispatchResult = (detail) => {
    window.dispatchEvent(
      new CustomEvent("blitzclaw-relay-connect-result", {
        detail,
      })
    );
    // Backward compatibility with older dashboard listeners.
    window.dispatchEvent(
      new CustomEvent("blitzclaw-connect-result", {
        detail,
      })
    );
  };

  if (token) {
    chrome.runtime.sendMessage({ action: "connect", token, instanceId }, (response) => {
      dispatchResult(response || { success: false, error: "No response from extension" });
    });
  } else {
    dispatchResult({ success: false, error: "Missing relay token" });
  }
}

// Listen for token requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getToken") {
    sendResponse({
      token: getTokenFromPage(),
      instanceId: getInstanceIdFromPage(),
    });
  }
  return true;
});

// Backward compatibility for existing dashboard integration.
window.addEventListener("blitzclaw-connect", (event) => {
  const { token, instanceId } = event.detail || {};
  connectWithToken(token, instanceId);
});

function injectStatusIndicator() {
  if (!window.location.pathname.includes("/dashboard")) return;

  setInterval(() => {
    chrome.runtime.sendMessage({ action: "status" }, (response) => {
      window.dispatchEvent(
        new CustomEvent("blitzclaw-relay-status", {
          detail: response,
        })
      );
    });
  }, 2000);
}

function initRelayConnectBridge() {
  if (window.location.pathname !== CONNECT_PATH) return;

  const token = getTokenFromPage();
  const instanceId = getInstanceIdFromPage();

  if (token) {
    document.documentElement.dataset.browserRelayToken = token;
  }

  window.dispatchEvent(
    new CustomEvent("blitzclaw-relay-extension-ready", {
      detail: {
        tokenDetected: !!token,
        instanceId,
      },
    })
  );

  window.addEventListener("blitzclaw-relay-extension-ping", () => {
    window.dispatchEvent(new CustomEvent("blitzclaw-relay-extension-pong"));
  });

  window.addEventListener("blitzclaw-relay-connect-request", (event) => {
    const requestedToken = event.detail?.token || token;
    const requestedInstanceId = event.detail?.instanceId || instanceId;
    connectWithToken(requestedToken, requestedInstanceId);
  });
}

// Run on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    injectStatusIndicator();
    initRelayConnectBridge();
  });
} else {
  injectStatusIndicator();
  initRelayConnectBridge();
}

console.log("[BlitzClaw] Content script loaded");
