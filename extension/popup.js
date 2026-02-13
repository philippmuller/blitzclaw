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

// Update UI based on connection status
function updateUI(status) {
  statusDot.className = 'status-dot';
  
  if (status.connected) {
    statusDot.classList.add('connected');
    statusText.textContent = 'Connected';
    disconnectedView.classList.add('hidden');
    connectedView.classList.add('active');
  } else {
    statusText.textContent = 'Disconnected';
    disconnectedView.classList.remove('hidden');
    connectedView.classList.remove('active');
  }
}

// Get current status on popup open
chrome.runtime.sendMessage({ action: 'status' }, (response) => {
  updateUI(response);
});

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
  
  chrome.runtime.sendMessage({ action: 'connect', token }, (response) => {
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
    
    if (response.success) {
      updateUI({ connected: true });
      tokenInput.value = '';
    } else {
      errorMsg.textContent = response.error || 'Connection failed';
      statusDot.className = 'status-dot';
      statusText.textContent = 'Disconnected';
    }
  });
});

// Disconnect button
disconnectBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'disconnect' }, (response) => {
    updateUI({ connected: false });
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
  if (tab && (tab.url.includes('blitzclaw.com') || tab.url.includes('localhost:3000'))) {
    // Try to get token from the page
    chrome.tabs.sendMessage(tab.id, { action: 'getToken' }, (response) => {
      if (response && response.token) {
        tokenInput.value = response.token;
      }
    });
  }
});
