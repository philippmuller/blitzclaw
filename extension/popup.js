/**
 * BlitzClaw Browser Relay - Popup UI
 */

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const disconnectedView = document.getElementById('disconnectedView');
const connectedView = document.getElementById('connectedView');
const tokenInput = document.getElementById('tokenInput');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const errorMsg = document.getElementById('errorMsg');
const relayStateValue = document.getElementById('relayStateValue');
const instanceValue = document.getElementById('instanceValue');
const peerValue = document.getElementById('peerValue');
const tabValue = document.getElementById('tabValue');
let detectedApiBase = null;
let detectedInstanceId = null;

// Update UI based on connection status
function updateUI(status) {
  statusDot.className = 'status-dot';

  const state = status.state || (status.connected ? 'connected' : 'disconnected');
  relayStateValue.textContent = state.charAt(0).toUpperCase() + state.slice(1);
  instanceValue.textContent = status.instanceId || 'n/a';
  peerValue.textContent = status.peerConnected ? 'Connected' : 'Waiting';
  tabValue.textContent = status.attachedTabId ? `Tab ${status.attachedTabId}` : 'Not attached';

  if (state === 'connected') {
    statusDot.classList.add('connected');
    statusText.textContent = 'Connected';
    disconnectedView.classList.add('hidden');
    connectedView.classList.add('active');
    errorMsg.textContent = '';
  } else if (state === 'connecting') {
    statusDot.classList.add('connecting');
    statusText.textContent = 'Connecting...';
    disconnectedView.classList.remove('hidden');
    connectedView.classList.remove('active');
    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
  } else {
    statusText.textContent = state === 'error' ? 'Connection Error' : 'Disconnected';
    disconnectedView.classList.remove('hidden');
    connectedView.classList.remove('active');
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
    if (state === 'error' && status.lastError) {
      errorMsg.textContent = status.lastError;
    }
  }
}

function refreshStatus() {
  chrome.runtime.sendMessage({ action: 'status' }, (response) => {
    if (!response) return;
    if (response.apiBase) {
      detectedApiBase = response.apiBase;
    }
    if (response.instanceId) {
      detectedInstanceId = response.instanceId;
    }
    updateUI(response);
  });
}

// Get current status on popup open + poll while popup is open
refreshStatus();
setInterval(refreshStatus, 1000);

// Connect button
connectBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  
  if (!token) {
    errorMsg.textContent = 'Please enter a connection token';
    return;
  }
  
  errorMsg.textContent = '';
  connectBtn.disabled = true;
  connectBtn.textContent = 'Connecting...';
  statusDot.className = 'status-dot connecting';
  statusText.textContent = 'Connecting...';
  
  chrome.runtime.sendMessage({
    action: 'connect',
    token,
    apiBase: detectedApiBase || undefined,
    instanceId: detectedInstanceId || undefined,
  }, (response) => {
    if (chrome.runtime.lastError) {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect';
      errorMsg.textContent = chrome.runtime.lastError.message || 'Connection failed';
      return;
    }

    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
    
    if (response && response.success) {
      refreshStatus();
      tokenInput.value = '';
    } else {
      const failure = (response && response.error) || 'Connection failed';
      errorMsg.textContent = failure;
      if (failure.toLowerCase().includes('already in progress')) {
        chrome.runtime.sendMessage({ action: 'resetState' });
      }
      statusDot.className = 'status-dot';
      statusText.textContent = 'Disconnected';
    }
  });
});

// Disconnect button
disconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'disconnect' }, () => {
    updateUI({ connected: false, state: 'disconnected', peerConnected: false });
  });
});

// Handle Enter key in input
tokenInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    connectBtn.click();
  }
});

// Check if we're on BlitzClaw dashboard and auto-fill token
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab && tab.url && (tab.url.includes('blitzclaw.com') || tab.url.includes('localhost:3000'))) {
    // Try to get token from the page
    chrome.tabs.sendMessage(tab.id, { action: 'getToken' }, (response) => {
      if (response && response.token) {
        tokenInput.value = response.token;
      }
      if (response && response.apiBase) {
        detectedApiBase = response.apiBase;
      }
      if (response && response.instanceId) {
        detectedInstanceId = response.instanceId;
      }
    });
  }
});
