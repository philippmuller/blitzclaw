/**
 * BlitzClaw Browser Relay - Content Script
 * 
 * Runs on BlitzClaw dashboard pages to:
 * 1. Auto-detect connection tokens
 * 2. Provide "Connect Browser" button integration
 */

// Listen for token requests from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getToken') {
    // Try to find token on the page
    // Look for data attribute or specific element
    const tokenElement = document.querySelector('[data-browser-relay-token]');
    if (tokenElement) {
      sendResponse({ token: tokenElement.dataset.browserRelayToken });
      return;
    }
    
    // Also check for token in URL params (for direct links)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('relay-token');
    if (urlToken) {
      sendResponse({ token: urlToken });
      return;
    }
    
    sendResponse({ token: null });
  }
  return true;
});

// Listen for custom events from the page (for auto-connect)
window.addEventListener('blitzclaw-connect', (event) => {
  const { token } = event.detail;
  if (token) {
    chrome.runtime.sendMessage({ action: 'connect', token }, (response) => {
      // Dispatch result back to page
      window.dispatchEvent(new CustomEvent('blitzclaw-connect-result', {
        detail: response
      }));
    });
  }
});

// Inject connection status indicator when on dashboard
function injectStatusIndicator() {
  // Check if we're on the dashboard
  if (!window.location.pathname.includes('/dashboard')) return;
  
  // Check connection status periodically
  setInterval(() => {
    chrome.runtime.sendMessage({ action: 'status' }, (response) => {
      // Dispatch status to page so React can pick it up
      window.dispatchEvent(new CustomEvent('blitzclaw-relay-status', {
        detail: response
      }));
    });
  }, 2000);
}

// Run on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectStatusIndicator);
} else {
  injectStatusIndicator();
}

console.log('[BlitzClaw] Content script loaded');
