# BlitzClaw Browser Relay Extension

Chrome extension that connects your browser to your BlitzClaw AI assistant.

## Installation (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select this `extension` folder
5. The BlitzClaw icon should appear in your toolbar

## Usage

1. Go to your BlitzClaw dashboard
2. Click "Connect Browser" to get a connection token
3. Click the BlitzClaw extension icon
4. Paste the token and click "Connect"
5. Badge shows "ON" when connected

## How it Works

```
Your Chrome ←→ Extension ←→ WebSocket ←→ BlitzClaw API ←→ Your VM ←→ AI Agent
```

The extension:
1. Connects to BlitzClaw's WebSocket relay
2. Attaches Chrome's debugger to your active tab
3. Forwards CDP (Chrome DevTools Protocol) commands from your AI agent
4. Sends results back

## Files

- `manifest.json` - Extension configuration
- `background.js` - Service worker handling WebSocket + CDP
- `popup.html/js` - UI for connecting
- `content.js` - Auto-detects tokens on BlitzClaw pages
- `icons/` - Extension icons

## Security

- Connection requires a token from your dashboard
- Tokens expire after 5 minutes
- Only your BlitzClaw instance can send commands
- You see everything (it's your browser)
- Disconnect anytime via the extension

## Development

To test changes:
1. Edit files
2. Go to `chrome://extensions/`
3. Click refresh icon on the extension
4. Reopen popup to see changes

## TODO

- [ ] Auto-connect when on BlitzClaw dashboard
- [ ] Multiple tab support
- [ ] Tab picker UI
- [ ] Visual indicator when agent is using browser
