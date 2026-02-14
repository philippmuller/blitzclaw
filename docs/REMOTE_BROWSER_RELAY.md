# Remote Browser Relay — Feature Spec

## Overview

Allow BlitzClaw users to connect their local Chrome browser to their cloud instance, enabling the agent to control their actual browser with all existing logins, cookies, and sessions.

## Problem

Currently, BlitzClaw instances run headless Chromium on the VM. Users must:
- Share passwords via Secrets
- Re-authenticate on every site
- Deal with 2FA challenges
- Lose all existing sessions

## Solution

A browser relay that connects the user's local Chrome to their remote BlitzClaw instance.

```
[User's Chrome] ←→ [Chrome Extension] ←→ [WebSocket/Tunnel] ←→ [BlitzClaw VM] ←→ [OpenClaw Agent]
```

## User Experience

1. User installs "BlitzClaw Browser Relay" Chrome extension
2. User goes to BlitzClaw dashboard → "Connect Browser"
3. Dashboard shows a connection code/token
4. User clicks extension icon → enters code
5. Extension connects to their BlitzClaw instance
6. Agent can now see/control user's browser tabs

**Example interaction:**
> User: "Check my LinkedIn messages"
> Agent: [uses existing LinkedIn session in user's browser]
> Agent: "You have 3 new messages from..."

No password needed — user is already logged in.

## Technical Architecture

### Option A: WebSocket Relay (Simpler)

```
Chrome Extension → WebSocket → BlitzClaw API → VM Gateway
```

**Pros:**
- No special networking
- Works through firewalls/NAT
- All traffic goes through BlitzClaw servers

**Cons:**
- Added latency
- BlitzClaw sees all browser traffic (privacy concern)
- Server bandwidth costs

### Option B: Direct P2P with TURN Fallback (More Complex)

```
Chrome Extension → WebRTC/TURN → VM Gateway
```

**Pros:**
- Lower latency
- Direct connection when possible
- Less server load

**Cons:**
- More complex to implement
- Need TURN server infrastructure
- NAT traversal issues

### Recommendation: Option A for MVP

Start with WebSocket relay through BlitzClaw API. Simpler, works everywhere, can optimize later.

## Components to Build

### 1. Chrome Extension (New)

Fork/modify OpenClaw's existing browser relay extension:
- Add "Connect to Remote" option
- Input field for connection token
- Connect to wss://blitzclaw.com/api/browser-relay
- Send CDP commands over WebSocket
- Show connection status (badge: connected/disconnected)

### 2. BlitzClaw API Endpoint

`/api/browser-relay` — WebSocket endpoint

```typescript
// Authentication
// 1. User connects with instance token
// 2. Server verifies token belongs to active instance
// 3. Server relays CDP messages between extension ↔ instance

interface RelayMessage {
  type: 'cdp' | 'ping' | 'auth';
  instanceId?: string;
  token?: string;
  payload?: any;
}
```

### 3. Instance-Side Relay Client

OpenClaw gateway needs to:
- Connect to wss://blitzclaw.com/api/browser-relay
- Receive CDP commands from user's browser
- Execute them as if it were a local browser
- Return results

**Config addition:**
```yaml
browser:
  remoteRelay:
    enabled: true
    endpoint: wss://blitzclaw.com/api/browser-relay
    token: ${INSTANCE_SECRET}
```

### 4. Dashboard UI

- "Browser" tab in dashboard
- "Connect Your Browser" button
- Shows connection token (valid 5 min)
- QR code option for mobile
- Connection status indicator
- "Disconnect" button

## Security Considerations

### Authentication
- Connection tokens expire after 5 minutes
- One active relay connection per instance
- New connection disconnects old one

### Privacy
- All CDP traffic passes through BlitzClaw servers (Option A)
- We should NOT log/store CDP payloads
- Consider end-to-end encryption (instance ↔ extension)

### Permissions
- User explicitly initiates connection
- User can disconnect anytime
- Badge shows when browser is being controlled
- Optional: Require confirmation for sensitive actions

### Attack Vectors
- Token theft → short expiry + one-time use
- MITM → TLS + consider E2E encryption
- Malicious agent → user has full visibility via their browser

## Implementation Phases

### Phase 1: MVP (1-2 weeks)
- [ ] Fork OpenClaw browser extension
- [ ] Add remote connection capability
- [ ] Build `/api/browser-relay` WebSocket endpoint
- [ ] Dashboard "Connect Browser" UI
- [ ] Test with single user

### Phase 2: Polish (1 week)
- [ ] Connection status indicators
- [ ] Auto-reconnect on disconnect
- [ ] Better error messages
- [ ] "Disconnect all browsers" in dashboard

### Phase 3: Security Hardening
- [ ] E2E encryption for CDP payloads
- [ ] Audit logging (connection events only, not content)
- [ ] Rate limiting
- [ ] Anomaly detection

## Open Questions

1. **Should we support multiple browsers?**
   - MVP: One browser per instance
   - Later: Multiple browsers (desktop + mobile?)

2. **What about mobile?**
   - iOS/Android don't support extensions the same way
   - Could build standalone app that shares Safari/Chrome sessions
   - Punt for now

3. **Offline handling?**
   - If user closes laptop, relay disconnects
   - Agent falls back to headless browser on VM
   - Show warning: "Browser disconnected, using cloud browser"

4. **Should agents request permission?**
   - Option: Agent asks "Can I access your browser?" before first use
   - User approves in dashboard
   - More secure but more friction

## Success Metrics

- % of users who connect browser
- Reduction in "login failed" errors
- User satisfaction scores
- Tasks completed that require auth

## Competitive Advantage

No other "AI assistant as a service" offers this. It's the bridge between:
- **Cloud AI** (powerful but isolated)
- **Local AI** (has your context but needs setup)

BlitzClaw + Browser Relay = Cloud power with local context.

---

## Human-in-the-Loop Authentication Pattern

### The Problem

Many services require OAuth/browser-based authentication that agents cannot complete autonomously:
- PartyKit deploy requires GitHub login
- Google OAuth requires browser consent
- 2FA challenges need human interaction
- CAPTCHAs block automated flows

### The Pattern

When an agent encounters interactive auth:

1. **Agent detects** auth requirement (redirect to login, 401, "please authenticate" message)
2. **Agent provides** the URL/link to the human
3. **Agent instructs** what the human needs to do
4. **Human completes** the auth flow in their browser
5. **Agent detects** successful auth (token appears, session valid, etc.)
6. **Agent continues** with the original task

### Implementation for BlitzClaw

BlitzClaw agents should:

```
When auth is needed:
1. Send message: "I need you to authenticate with [Service]"
2. Provide link: "Please open: https://..."
3. Give clear steps: "1. Click 'Authorize' 2. Select your account 3. Come back here"
4. Wait/poll for completion
5. Confirm: "Thanks! Authentication successful, continuing..."
```

### Example: PartyKit Deploy

```
Agent: "I need to deploy to PartyKit but it requires browser login."
Agent: "Please run this in your terminal:"
Agent: `cd /path/to/project && npx partykit login`
Agent: "This will open a browser. Complete the GitHub login, then let me know."
Human: "Done!"
Agent: "Great, now deploying..." *runs npx partykit deploy*
```

### Dashboard Integration

For BlitzClaw dashboard, we could add:
- "Pending Auth" notifications
- One-click auth completion buttons
- Status indicators for services needing re-auth

This pattern applies to: OAuth services, API key setup, 2FA, payment verification, etc.

---

*Created: 2026-02-13*
*Updated: 2026-02-14 — Added human-in-the-loop auth pattern*
*Status: Draft*
*Owner: TBD*
