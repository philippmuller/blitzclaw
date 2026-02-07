# BlitzClaw — Technical Specification

> One-click OpenClaw deployment. Telegram & WhatsApp. Usage-based billing.

## Overview

BlitzClaw provisions dedicated OpenClaw instances on Hetzner, handles API keys internally, and bills users based on token consumption. No API key required from users — just sign up, top up, connect channel, go.

**Business Model:**
- $20/month base fee (includes ~$10 worth of token usage)
- Usage beyond included amount billed at marked-up token rates
- **$10 minimum balance required** at all times
- Optional: Users can bring their own API keys (bypasses our proxy, no token billing)
- Optional: Users can bring their own OAuth credentials (Gmail, Calendar, etc.)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        BlitzClaw Platform                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐    ┌──────────┐    ┌──────────────────────┐     │
│   │  Web UI  │───▶│   API    │───▶│  Provisioning Engine │     │
│   └──────────┘    └──────────┘    └──────────────────────┘     │
│                         │                    │                   │
│                         ▼                    ▼                   │
│                   ┌──────────┐      ┌───────────────┐           │
│                   │  Creem   │      │  Hetzner API  │           │
│                   └──────────┘      └───────────────┘           │
│                                            │                     │
└────────────────────────────────────────────│─────────────────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
              ┌─────▼─────┐           ┌─────▼─────┐           ┌─────▼─────┐
              │ Instance  │           │ Instance  │           │ Instance  │
              │  (User A) │           │  (User B) │           │  (User C) │
              └─────┬─────┘           └───────────┘           └───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │    Token Proxy        │
        │  (counts + forwards)  │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Anthropic / OpenAI   │
        └───────────────────────┘
```

---

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| email | string | From Google OAuth |
| google_id | string | Google account ID |
| creem_customer_id | string | Creem customer reference |
| created_at | timestamp | |

### balances
| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | FK to users |
| credits_cents | integer | Current balance in cents |
| auto_topup_enabled | boolean | Auto-charge when low |
| topup_threshold_cents | integer | Trigger point for auto-topup |
| topup_amount_cents | integer | Amount to charge on auto-topup |

### instances
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| hetzner_server_id | string | Hetzner API server ID |
| ip_address | string | Server IP |
| status | enum | pending, provisioning, active, paused, stopped, error |
| channel_type | enum | telegram, whatsapp |
| channel_config | jsonb | Bot token, session data, etc. |
| persona_template | string | Which template (or 'custom') |
| soul_md | text | Custom SOUL.md content |
| use_own_api_key | boolean | If true, bypass proxy billing |
| own_api_key_encrypted | string | User's own Anthropic/OpenAI key (encrypted) |
| created_at | timestamp | |
| last_health_check | timestamp | |

### user_integrations (Phase 2)
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| provider | enum | google, github, etc. |
| access_token_encrypted | string | OAuth access token (encrypted) |
| refresh_token_encrypted | string | OAuth refresh token (encrypted) |
| scopes | string[] | Granted scopes |
| expires_at | timestamp | Token expiry |
| created_at | timestamp | |

### usage_logs
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| instance_id | uuid | FK to instances |
| model | string | e.g., claude-sonnet-4 |
| tokens_in | integer | Input tokens |
| tokens_out | integer | Output tokens |
| cost_cents | integer | Calculated cost |
| timestamp | timestamp | |

### server_pool
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| hetzner_server_id | string | |
| ip_address | string | |
| status | enum | available, assigned, provisioning |
| assigned_to | uuid | FK to instances (nullable) |
| created_at | timestamp | |

---

## API Endpoints

### Auth (Clerk)

Clerk handles all auth flows. We just verify the session.

```
# Clerk handles these automatically:
/sign-in              → Clerk hosted/embedded UI
/sign-up              → Clerk hosted/embedded UI
/sign-out             → Clerk sign out

# Our API validates Clerk session:
GET /api/auth/me
  - Validates Clerk session token
  - Returns user profile + balance
  - Creates user in our DB on first call (sync from Clerk)
```

**Clerk Webhook:**
```
POST /api/webhooks/clerk
  - user.created → Create user in our DB
  - user.deleted → Clean up user data
```

### Billing
```
POST /api/billing/topup
  - Body: { amount_cents: 2000 }
  - Minimum: $10 (1000 cents)
  - Creates Creem checkout session
  - Returns checkout URL

POST /api/billing/webhook
  - Creem webhook handler
  - Credits balance on successful payment

GET /api/billing/usage
  - Query params: from, to
  - Returns usage breakdown

GET /api/billing/balance
  - Returns current balance
  - Includes warning if below $10 minimum

PATCH /api/billing/auto-topup
  - Body: { enabled, threshold_cents, amount_cents }
```

### Instances
```
POST /api/instances
  - Body: { channel_type, persona_template, soul_md? }
  - Assigns server from pool
  - Returns instance ID + status

GET /api/instances
  - Returns user's instances

GET /api/instances/:id
  - Returns instance details + recent usage

POST /api/instances/:id/restart
  - SSHs into server, runs `openclaw gateway restart`

POST /api/instances/:id/configure
  - Body: { soul_md?, channel_config? }
  - Updates config, restarts

DELETE /api/instances/:id
  - Stops instance, returns server to pool
```

### Channel Setup
```
POST /api/instances/:id/telegram/connect
  - Body: { bot_token }
  - Validates token with Telegram API
  - Updates instance config

POST /api/instances/:id/whatsapp/qr
  - Initiates WhatsApp Web session
  - Returns QR code data for display

POST /api/instances/:id/whatsapp/status
  - Returns connection status
```

### User API Keys (Phase 2)
```
POST /api/instances/:id/api-key
  - Body: { provider: 'anthropic'|'openai', api_key }
  - Validates key with provider
  - Encrypts and stores
  - Configures instance to use user's key (bypasses proxy billing)

DELETE /api/instances/:id/api-key
  - Removes user's key
  - Reverts to proxy billing
```

### Integrations (Phase 2)
```
GET /api/integrations
  - Returns user's connected integrations

POST /api/integrations/google/connect
  - Initiates Google OAuth flow
  - Scopes: gmail.readonly, calendar.readonly (expandable)

POST /api/integrations/google/callback
  - OAuth callback
  - Stores encrypted tokens

DELETE /api/integrations/:provider
  - Revokes and removes integration

POST /api/instances/:id/integrations/attach
  - Body: { integration_id }
  - Deploys OAuth credentials to instance config
```

### Health (internal)
```
GET /api/health/instances
  - Checks all active instances
  - Triggers restart if unresponsive
```

---

## Token Proxy

Separate service that sits between OpenClaw instances and LLM providers.

```
Endpoint: https://proxy.blitzclaw.com/v1

Headers:
  X-BlitzClaw-Instance: <instance_id>
  X-BlitzClaw-Secret: <shared_secret>

Flow:
1. Receive request from OpenClaw instance
2. Validate instance ID + secret
3. Check user balance >= $10 minimum (reject if insufficient)
4. Forward to Anthropic/OpenAI with our API key
5. Response includes actual token count (usage.input_tokens, usage.output_tokens)
6. Calculate cost with markup, deduct from balance atomically
7. If balance drops below $10 → instance paused, user notified to top up
8. Return response to instance
```

### Margin Protection

**We never front costs.** The 50% markup + $10 minimum balance guarantees this:

- Minimum balance: $10
- Largest single request (200K context Opus): ~$15 actual → ~$22.50 billed
- Even worst case, user has buffer from prior payments

**Balance enforcement:**
- Check balance BEFORE forwarding request
- Deduct AFTER response (actual tokens)
- If deduction would go below $0 → still process (margin covers), but pause instance immediately
- With 50% margin, we'd need 3+ max-size requests in a row to actually lose money (statistically negligible)

**Paused state:**
- Instance stops accepting new messages
- User gets notification (Telegram/email): "Balance depleted, top up to continue"
- Dashboard shows prominent "Top Up" CTA

### Pricing (markup on actual costs)

| Model | Input (per 1M) | Output (per 1M) | Our Price In | Our Price Out |
|-------|----------------|-----------------|--------------|---------------|
| Claude Sonnet 4 | $3 | $15 | $4.50 | $22.50 |
| Claude Haiku | $0.25 | $1.25 | $0.40 | $2.00 |
| GPT-4o | $2.50 | $10 | $3.75 | $15 |

~50% markup covers infrastructure + margin.

---

## Payment Processing (Creem)

**Why Creem over Stripe:**
- Merchant of Record: handles global VAT/sales tax automatically
- No international card fees (Stripe adds 1.5%)
- Revenue splits built-in (useful for affiliates later)
- Simpler setup, designed for indie SaaS

**Creem Pricing:** 3.9% + $0.40 per transaction (all-inclusive)

**Integration Flow:**

```
1. User clicks "Top Up $20"
2. POST /api/billing/topup → creates Creem checkout session
3. Redirect to Creem hosted checkout
4. User pays (card, Apple Pay, etc.)
5. Creem webhook → POST /api/billing/webhook
6. Verify signature, credit user balance
7. Redirect back to dashboard
```

**Creem API Endpoints We Use:**

```
POST /v1/checkouts
  - Create checkout session for top-up
  - Set success_url, cancel_url
  - Product: "BlitzClaw Credits" (one-time)

GET /v1/customers/:id
  - Fetch customer payment methods
  - For auto-topup feature

POST /v1/subscriptions (Phase 2)
  - For $20/month base fee
  - Metered add-on for usage beyond included

Webhooks:
  - checkout.completed → credit balance
  - subscription.renewed → credit monthly included usage
  - payment.failed → pause instance, notify user
```

**Tax Handling:**
Creem is the Merchant of Record. They:
- Collect VAT/GST/sales tax at checkout
- Remit to 100+ countries
- Handle invoices with proper tax IDs
- We never touch tax compliance

---

## Provisioning Flow

### Server Pool Management

Background job runs every 5 minutes:
1. Count available servers in pool
2. If < 5 available, provision more via Hetzner API
3. New servers get base OpenClaw install via cloud-init

### User Instance Creation

```
1. User clicks "Create Instance"
2. Check balance >= $10 minimum (reject if insufficient)
3. Assign server from pool (or provision if empty)
4. SSH into server:
   a. Write config.yaml with proxy endpoint (or user's own key if provided)
   b. Write SOUL.md from template + customizations
   c. Deploy integration credentials if attached
   d. Run `openclaw gateway restart`
5. Update instance status to 'active'
6. Return success + channel setup instructions
```

### cloud-init Script (base image)

```yaml
#cloud-config
packages:
  - nodejs
  - npm

runcmd:
  - npm install -g openclaw
  - mkdir -p /root/.openclaw
  - echo "PLACEHOLDER_CONFIG" > /root/.openclaw/config.yaml
  - openclaw gateway start
```

---

## Persona Templates

### Personal Assistant
```markdown
# SOUL.md

You are a personal assistant. Helpful, proactive, concise.

You help with:
- Daily planning and reminders
- Quick research and answers
- Writing and editing
- General productivity

Be warm but efficient. Respect the user's time.
```

### Dev Assistant
```markdown
# SOUL.md

You are a technical assistant for developers.

You help with:
- Code review and suggestions
- Debugging and problem-solving
- Documentation
- Git workflows

Be precise and technical. Show code examples when relevant.
```

### Creative Partner
```markdown
# SOUL.md

You are a creative collaborator.

You help with:
- Brainstorming and ideation
- Writing and storytelling
- Content planning
- Feedback and editing

Be imaginative but grounded. Push ideas forward.
```

### Custom
Empty SOUL.md — user provides their own.

---

## Security

### API Key Storage
- Master Anthropic/OpenAI keys stored in environment variables on proxy server
- Never exposed to user instances
- Rotated quarterly

### Instance Isolation
- Each instance is a separate Hetzner server
- No shared resources between users
- Firewall allows only: SSH (from our API), outbound HTTPS

### Channel Credentials
- Telegram bot tokens encrypted at rest (AES-256)
- WhatsApp sessions stored encrypted
- Decrypted only during config deployment

### User-Provided Credentials (Phase 2)
- User API keys (Anthropic/OpenAI) encrypted at rest
- OAuth tokens (Google, etc.) encrypted at rest
- Refresh tokens handled server-side, never exposed to frontend
- Users can revoke integrations anytime (we delete tokens)
- Clear UI warning: "Your credentials are stored encrypted. Revoke anytime."

### Cloudflare
- All endpoints behind Cloudflare
- Bot protection on signup/topup flows
- Rate limiting: 100 req/min per IP

---

## Abuse Prevention

### Rate Limits
- Max 100 messages/hour per instance (soft limit, can request increase)
- Max 1M tokens/day per instance

### Content Filtering
- Proxy can inspect prompts (optional, privacy tradeoff)
- Alternative: trust OpenAI/Anthropic's built-in filters

### Account Limits
- Max 3 instances per user (initially)
- Require email verification
- Phone verification for WhatsApp

---

## Monitoring

### Health Checks
- Ping each instance every 5 minutes
- Check: OpenClaw gateway responding, Telegram/WhatsApp connected
- Auto-restart on failure (max 3 attempts, then alert)

### Dashboards (internal)
- Active instances count
- Total token usage (hourly/daily)
- Revenue vs cost tracking
- Error rates

### Alerts
- Instance down > 15 min
- User balance exhausted mid-conversation
- Unusual usage spike (potential abuse)

---

## User Dashboard Features

### Overview
- Current balance
- Active instances (with status indicators)
- This month's usage + cost

### Instance Management
- Start/stop/restart
- View logs (last 24h)
- Edit SOUL.md
- Reconnect Telegram/WhatsApp

### Billing
- Top up balance
- Configure auto-topup
- View usage history
- Download invoices

---

## Tech Stack

### Frontend
- Next.js 14 (App Router)
- Tailwind CSS
- shadcn/ui components

### Backend
- Next.js API routes (or separate Node/Fastify if needed)
- PostgreSQL (Supabase or self-hosted)
- Redis (rate limiting, session cache)

### Infrastructure
- Vercel (frontend + API)
- Hetzner Cloud (user instances)
- Cloudflare (DNS, protection, proxy caching)

### External Services
- Creem (billing + MoR)
- Clerk (auth)
- Telegram Bot API
- Baileys (WhatsApp)

---

## Legal (Minimum)

### Terms of Service
- Service provided as-is
- We can terminate accounts for abuse
- User responsible for content generated
- WhatsApp integration is unofficial (account ban risk acknowledged)
- **Instance security:** Single-user only, do not share credentials or expose to third parties
- **Data responsibility:** We cannot recover compromised instances
- **API key liability:** If user provides own keys, they are responsible for usage/costs on those keys

### Privacy Policy
- We store: email, payment info, usage logs
- We don't store: conversation content (stays on user instance)
- Data retained until account deletion

### Support
- Email: support@blitzclaw.com
- GitHub Issues for bugs
- Knowledge base for common questions

---

## MVP Scope (Phase 1)

### Include
- [x] Google OAuth signup
- [x] Creem prepaid billing ($10 minimum, MoR included)
- [x] Telegram channel only
- [x] 3 persona templates + custom
- [x] Basic dashboard (balance, instance status, restart)
- [x] Token proxy with usage tracking + margin protection

### Exclude (Phase 2)
- [ ] WhatsApp (needs QR flow, more complex)
- [ ] User's own API keys
- [ ] Google OAuth integrations (Gmail, Calendar)
- [ ] Auto-topup
- [ ] Multiple instances per user

### Exclude (Phase 3+)
- [ ] Discord
- [ ] GitHub integration
- [ ] Advanced monitoring
- [ ] White-label / enterprise

---

## Decisions Made

1. **Domain:** blitzclaw.com primary (also grab .ai + .io)
2. **Minimum balance:** $10 required at all times
3. **Base fee:** $20/month includes ~$10 usage
4. **No free tier:** Users must pay to start
5. **User API keys:** Supported in Phase 2 (bypasses proxy billing)
6. **User integrations:** Supported in Phase 2 (Google OAuth for Gmail/Calendar)

---

---

## Hetzner Provisioning

**Server Type:** CX22 (2 vCPU, 4GB RAM, 40GB SSD) — €4.51/month

**Region:** Primary `fsn1` (Falkenstein), fallback `nbg1` (Nuremberg)

**Hetzner API Integration:**

```
# Create server
POST https://api.hetzner.cloud/v1/servers
Headers:
  Authorization: Bearer {HETZNER_API_TOKEN}
Body:
{
  "name": "blitz-{instance_id}",
  "server_type": "cx22",
  "image": "ubuntu-24.04",
  "location": "fsn1",
  "ssh_keys": ["blitzclaw-provisioner"],
  "user_data": "{cloud-init script}",
  "labels": {
    "service": "blitzclaw",
    "instance_id": "{instance_id}"
  }
}

# Delete server
DELETE https://api.hetzner.cloud/v1/servers/{server_id}

# List servers
GET https://api.hetzner.cloud/v1/servers?label_selector=service=blitzclaw
```

**Cloud-Init Script (Full):**

```yaml
#cloud-config
package_update: true
package_upgrade: true

packages:
  - nodejs
  - npm
  - nginx
  - certbot
  - fail2ban

write_files:
  - path: /etc/blitzclaw/instance_id
    content: "{INSTANCE_ID}"
  - path: /etc/blitzclaw/proxy_secret
    content: "{PROXY_SECRET}"

runcmd:
  # Install OpenClaw
  - npm install -g openclaw
  
  # Create workspace
  - mkdir -p /root/.openclaw/workspace
  
  # Firewall: only allow SSH from our IP + outbound HTTPS
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow from {BLITZCLAW_API_IP} to any port 22
  - ufw enable
  
  # Fail2ban for SSH
  - systemctl enable fail2ban
  - systemctl start fail2ban
  
  # Signal ready
  - curl -X POST https://api.blitzclaw.com/internal/instance-ready \
      -H "X-Instance-Secret: {PROXY_SECRET}" \
      -d '{"instance_id": "{INSTANCE_ID}"}'
```

**Server Pool Logic:**

```python
# Pseudo-code for pool manager (runs every 5 min)

MIN_POOL_SIZE = 5
MAX_POOL_SIZE = 20

def manage_pool():
    available = db.query("SELECT COUNT(*) FROM server_pool WHERE status = 'available'")
    
    if available < MIN_POOL_SIZE:
        # Provision more
        to_create = MIN_POOL_SIZE - available
        for _ in range(to_create):
            server = hetzner.create_server(cloud_init=BASE_CLOUD_INIT)
            db.insert("server_pool", {
                "hetzner_server_id": server.id,
                "ip_address": server.public_net.ipv4.ip,
                "status": "provisioning"
            })
    
    # Clean up stuck provisioning (>10 min)
    stuck = db.query("SELECT * FROM server_pool WHERE status = 'provisioning' AND created_at < NOW() - INTERVAL '10 min'")
    for server in stuck:
        hetzner.delete_server(server.hetzner_server_id)
        db.delete("server_pool", server.id)
```

**Instance Assignment:**

```python
def assign_instance(user_id, channel_type, persona):
    # Get available server
    server = db.query_one("SELECT * FROM server_pool WHERE status = 'available' LIMIT 1 FOR UPDATE")
    
    if not server:
        # Provision on-demand (slower)
        server = provision_new_server()
    
    # Create instance record
    instance = db.insert("instances", {
        "user_id": user_id,
        "hetzner_server_id": server.hetzner_server_id,
        "ip_address": server.ip_address,
        "status": "provisioning",
        "channel_type": channel_type,
        "persona_template": persona
    })
    
    # Mark server as assigned
    db.update("server_pool", server.id, {"status": "assigned", "assigned_to": instance.id})
    
    # Configure instance (async)
    queue.enqueue("configure_instance", instance.id)
    
    return instance
```

---

## Telegram Setup Flow

**User Experience:**

```
1. User creates instance in dashboard
2. Dashboard shows: "Set up Telegram"
3. Instructions:
   a. Open Telegram, search @BotFather
   b. Send /newbot
   c. Choose name (e.g., "My AI Assistant")
   d. Choose username (e.g., "myai_assistant_bot")
   e. Copy the token BotFather gives you
4. User pastes token into dashboard
5. We validate token with Telegram API
6. Deploy config to instance
7. User clicks link to start chatting with bot
```

**Token Validation:**

```javascript
async function validateTelegramToken(token) {
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error("Invalid bot token");
  }
  
  return {
    bot_id: data.result.id,
    bot_username: data.result.username,
    bot_name: data.result.first_name
  };
}
```

**Config Deployment:**

```yaml
# Generated config.yaml for Telegram instance
openclaw:
  model: anthropic/claude-sonnet-4
  apiEndpoint: https://proxy.blitzclaw.com/v1
  
  telegram:
    botToken: ${BOT_TOKEN}
    allowList:
      - ${USER_TELEGRAM_ID}  # If we have it, otherwise allow all initially
```

---

## WhatsApp Setup Flow (Phase 2)

**Using Baileys (@whiskeysockets/baileys):**

```
1. User creates instance, selects WhatsApp
2. Dashboard shows QR code (generated by Baileys on instance)
3. User scans with WhatsApp app
4. Session established, credentials stored
5. Instance connected
```

**Technical Flow:**

```javascript
// On instance, WhatsApp connector service

const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./wa_session');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });
  
  sock.ev.on('creds.update', saveCreds);
  
  sock.ev.on('connection.update', ({ qr, connection }) => {
    if (qr) {
      // Send QR to BlitzClaw API for dashboard display
      fetch('https://api.blitzclaw.com/internal/whatsapp-qr', {
        method: 'POST',
        body: JSON.stringify({ instance_id: INSTANCE_ID, qr })
      });
    }
    if (connection === 'open') {
      // Notify connected
      fetch('https://api.blitzclaw.com/internal/whatsapp-connected', {
        method: 'POST',
        body: JSON.stringify({ instance_id: INSTANCE_ID })
      });
    }
  });
}
```

**Disclaimer (shown to user):**
> WhatsApp integration uses unofficial methods. Your WhatsApp account may be banned by Meta. BlitzClaw is not responsible for account restrictions. Use at your own risk.

---

## CLI (blitzclaw)

**Philosophy:** CLI-first development. Every feature works via CLI before it gets a UI. This enables:
- Agent-driven testing without browser automation
- Scriptable deployments and management
- Debugging without UI complexity
- API-first architecture (CLI calls same endpoints as frontend)

**Installation:**
```bash
npm install -g blitzclaw
# or
npx blitzclaw
```

**Authentication:**
```bash
# Login (opens browser for Clerk OAuth, stores token locally)
blitzclaw auth login

# Check current user
blitzclaw auth whoami

# Logout
blitzclaw auth logout

# Use API key instead (for CI/scripts)
export BLITZCLAW_API_KEY=sk_...
blitzclaw auth whoami
```

**Billing:**
```bash
# Check balance
blitzclaw billing balance

# Top up (opens Creem checkout in browser, or returns URL)
blitzclaw billing topup --amount 20
blitzclaw billing topup --amount 20 --url-only  # Just print URL

# Usage history
blitzclaw billing usage
blitzclaw billing usage --from 2026-02-01 --to 2026-02-07
blitzclaw billing usage --format json
```

**Instances:**
```bash
# List instances
blitzclaw instances list
blitzclaw instances list --format json

# Create instance
blitzclaw instances create --channel telegram --persona assistant
blitzclaw instances create --channel telegram --persona custom --soul ./SOUL.md

# Get instance details
blitzclaw instances get <instance_id>
blitzclaw instances get <instance_id> --format json

# Restart instance
blitzclaw instances restart <instance_id>

# Update SOUL.md
blitzclaw instances soul <instance_id> --file ./SOUL.md
blitzclaw instances soul <instance_id> --edit  # Opens $EDITOR

# Delete instance
blitzclaw instances delete <instance_id>
blitzclaw instances delete <instance_id> --force  # Skip confirmation

# View logs
blitzclaw instances logs <instance_id>
blitzclaw instances logs <instance_id> --follow
blitzclaw instances logs <instance_id> --lines 100
```

**Telegram Setup:**
```bash
# Connect Telegram bot
blitzclaw telegram connect <instance_id> --token <bot_token>

# Validate token (without connecting)
blitzclaw telegram validate --token <bot_token>

# Get bot info
blitzclaw telegram info <instance_id>
```

**WhatsApp Setup (Phase 2):**
```bash
# Get QR code (prints ASCII QR to terminal)
blitzclaw whatsapp qr <instance_id>

# Check connection status
blitzclaw whatsapp status <instance_id>

# Disconnect
blitzclaw whatsapp disconnect <instance_id>
```

**API Keys (Phase 2):**
```bash
# Use own Anthropic key
blitzclaw apikey set <instance_id> --provider anthropic --key sk-...

# Remove (revert to BlitzClaw proxy)
blitzclaw apikey remove <instance_id>
```

**Admin Commands (internal):**
```bash
# Server pool status
blitzclaw admin pool status

# Force provision servers
blitzclaw admin pool provision --count 5

# Health check all instances
blitzclaw admin health check

# Instance debug
blitzclaw admin instance ssh <instance_id>  # Opens SSH session
```

**Global Flags:**
```bash
--format json|table|yaml   # Output format (default: table)
--quiet                    # Suppress non-essential output
--verbose                  # Extra debug info
--api-url                  # Override API endpoint (for dev)
```

**CLI Config File (~/.blitzclaw/config.json):**
```json
{
  "apiUrl": "https://api.blitzclaw.com",
  "auth": {
    "token": "eyJ...",
    "expiresAt": "2026-02-14T..."
  },
  "defaults": {
    "format": "table",
    "persona": "assistant"
  }
}
```

**Example E2E Test (agent-runnable):**
```bash
#!/bin/bash
set -e

# Login
blitzclaw auth login --api-key $TEST_API_KEY

# Check balance
BALANCE=$(blitzclaw billing balance --format json | jq -r '.credits_cents')
if [ "$BALANCE" -lt 1000 ]; then
  echo "Insufficient balance"
  exit 1
fi

# Create instance
INSTANCE=$(blitzclaw instances create --channel telegram --persona assistant --format json | jq -r '.id')
echo "Created instance: $INSTANCE"

# Wait for provisioning
sleep 30

# Check status
STATUS=$(blitzclaw instances get $INSTANCE --format json | jq -r '.status')
if [ "$STATUS" != "active" ]; then
  echo "Instance not active: $STATUS"
  exit 1
fi

# Connect Telegram
blitzclaw telegram connect $INSTANCE --token $TEST_BOT_TOKEN

# Verify
BOT_INFO=$(blitzclaw telegram info $INSTANCE --format json)
echo "Bot connected: $(echo $BOT_INFO | jq -r '.bot_username')"

# Cleanup
blitzclaw instances delete $INSTANCE --force

echo "✅ E2E test passed"
```

---

## Frontend Routes

```
/                     → Landing page (marketing)
/login                → Google OAuth login
/signup               → Redirect to /login (same flow)

/dashboard            → Main dashboard (balance, instances)
/dashboard/topup      → Top-up page (Creem checkout)
/dashboard/usage      → Usage history & breakdown

/instances/new        → Create new instance wizard
/instances/:id        → Instance detail (status, config, logs)
/instances/:id/setup  → Channel setup (Telegram/WhatsApp)
/instances/:id/soul   → Edit SOUL.md

/settings             → Account settings
/settings/billing     → Payment methods, auto-topup
/settings/integrations→ Google OAuth connections (Phase 2)

/docs                 → Knowledge base / help
/docs/:slug           → Individual help article
```

**Key UI Components:**

```
<BalanceCard>         → Shows balance, low balance warning, top-up CTA
<InstanceCard>        → Instance status, quick actions (restart, configure)
<UsageChart>          → Token usage over time (chart.js or recharts)
<TelegramSetup>       → Step-by-step BotFather instructions + token input
<WhatsAppQR>          → QR code display + connection status
<SoulEditor>          → Monaco editor for SOUL.md with preview
<PersonaPicker>       → Template selection cards
```

---

## Email Notifications

**Transactional Emails (via Creem or Resend):**

| Trigger | Email |
|---------|-------|
| Signup | Welcome + getting started guide |
| Top-up successful | Receipt + new balance |
| Balance low ($5) | Warning + top-up CTA |
| Balance depleted | Instance paused + urgent top-up CTA |
| Instance created | Setup instructions |
| Instance error | Issue notification + support link |
| Weekly digest | Usage summary + tips |

**Email Provider:** Resend (simple API, good deliverability, $0 for first 3k/month)

---

## Environment Variables

```bash
# App
NODE_ENV=production
APP_URL=https://blitzclaw.com
API_URL=https://api.blitzclaw.com

# Database
DATABASE_URL=postgres://...

# Redis
REDIS_URL=redis://...

# Auth (Clerk)
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...

# Creem
CREEM_API_KEY=...
CREEM_WEBHOOK_SECRET=...

# Hetzner
HETZNER_API_TOKEN=...
HETZNER_SSH_KEY_ID=...

# Token Proxy
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
PROXY_SIGNING_SECRET=...

# Email
RESEND_API_KEY=...

# Monitoring
SENTRY_DSN=...
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Cloudflare                              │
│  (DNS, CDN, DDoS protection, bot management)                │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────────┐
    │  Vercel  │   │  Vercel  │   │   Hetzner    │
    │ (Web UI) │   │  (API)   │   │ (Token Proxy)│
    └──────────┘   └────┬─────┘   └──────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Supabase │  │  Redis   │  │  Resend  │
    │(Postgres)│  │(Upstash) │  │ (Email)  │
    └──────────┘  └──────────┘  └──────────┘
```

**Why this setup:**
- Vercel: Zero-config deploys, edge functions, good free tier
- Supabase: Managed Postgres, auth helpers, realtime (if needed)
- Upstash Redis: Serverless Redis, pay-per-request
- Hetzner for proxy: Need persistent connection, more control
- Cloudflare: Free tier covers everything we need

---

## Error Handling

**User-Facing Errors:**

| Error | User Message | Action |
|-------|--------------|--------|
| Insufficient balance | "Top up to continue using your assistant" | Show top-up modal |
| Invalid Telegram token | "This token doesn't work. Check BotFather and try again." | Keep on setup page |
| Instance unreachable | "Your assistant is temporarily unavailable. We're on it." | Auto-restart, email if persists |
| Provisioning failed | "Couldn't create your instance. Please try again." | Refund, retry option |
| WhatsApp disconnected | "WhatsApp disconnected. Scan QR to reconnect." | Show QR flow |

**Internal Errors → Sentry:**
- All uncaught exceptions
- Failed provisioning
- Webhook processing errors
- Proxy errors

---

## Testing Strategy

**Unit Tests:**
- Billing calculations (token → cost)
- Balance checks
- Config generation

**Integration Tests:**
- Creem webhook processing (mock webhooks)
- Hetzner API calls (mock responses)
- Telegram token validation

**E2E Tests (Playwright):**
- Signup → top-up → create instance → send message
- Balance depletion → instance pause → top-up → resume

**Load Testing:**
- Token proxy: 1000 concurrent requests
- Instance creation: 50 simultaneous provisions

---

## Development Workflow

**Repo Structure:**

```
blitzclaw/
├── apps/
│   ├── web/              # Next.js frontend
│   ├── api/              # API routes (or in web/app/api)
│   └── proxy/            # Token proxy service
├── packages/
│   ├── db/               # Prisma schema + client
│   ├── config/           # Shared config types
│   └── ui/               # Shared UI components
├── scripts/
│   ├── provision.sh      # Manual provisioning helper
│   └── seed.ts           # DB seeding
└── docs/
    └── api.md            # API documentation
```

**Monorepo:** Turborepo (or pnpm workspaces)

**CI/CD:**
- GitHub Actions
- On PR: lint, typecheck, test
- On merge to main: deploy to Vercel (preview)
- On tag: deploy to production

---

## Launch Checklist

**Pre-Launch:**
- [ ] Creem account approved + webhook configured
- [ ] Hetzner account funded + API token created
- [ ] Domain configured (blitzclaw.com → Cloudflare → Vercel)
- [ ] SSL certificates (automatic via Cloudflare)
- [ ] Supabase project + schema migrated
- [ ] Resend domain verified
- [ ] Sentry project created
- [ ] ToS + Privacy Policy pages live
- [ ] Support email configured (support@blitzclaw.com)

**Testing:**
- [ ] Full E2E: signup → pay → create → chat → balance runs out → top up
- [ ] Telegram bot works
- [ ] Webhooks fire correctly
- [ ] Low balance emails send
- [ ] Instance restart works from dashboard

**Monitoring:**
- [ ] Uptime check on api.blitzclaw.com
- [ ] Uptime check on proxy.blitzclaw.com
- [ ] Error alerting in Sentry → Slack/Discord
- [ ] Daily cost check (Hetzner + Anthropic spend)

---

## Next Steps

1. **Step 1:** ✅ This spec (COMPLETE)
2. **Step 2:** Creem integration (checkout + webhooks)
3. **Step 3:** Hetzner provisioning API
4. **Step 4:** Token proxy service
5. **Step 5:** Frontend (auth + dashboard)
6. **Step 6:** Telegram connection flow
7. **Step 7:** Deploy + test E2E

---

## Implementation Breakdown (for coding agents)

**Order: Sequential, CLI-first**

### Agent 1: Backend Core + CLI Foundation
- Database schema (Prisma)
- Clerk auth integration
- Creem billing integration
- CLI framework (Commander.js)
- CLI commands: auth, billing
- API endpoints for auth + billing

### Agent 2: Provisioning + CLI
- Hetzner API wrapper
- Cloud-init templates
- Server pool management
- Instance lifecycle (create/restart/delete)
- CLI commands: instances, admin pool

### Agent 3: Token Proxy
- Express/Fastify service
- Request forwarding to Anthropic/OpenAI
- Usage logging + billing deduction
- Balance enforcement
- Health endpoint for instance checks

### Agent 4: Channel Integrations + CLI
- Telegram bot token validation
- Telegram config deployment
- WhatsApp/Baileys setup (Phase 2)
- CLI commands: telegram, whatsapp

### Agent 5: Frontend
- Next.js app structure
- Clerk UI components
- Dashboard pages (calls same API as CLI)
- Setup wizards
- SOUL.md editor

### Agent 6: DevOps + Testing
- Vercel configuration
- Hetzner proxy deployment
- Cloudflare setup
- CI/CD pipeline
- E2E test suite (CLI-based)

**Each agent gets:**
1. This spec (full context)
2. Their specific section highlighted
3. Access to repo
4. Test criteria (what "done" looks like)

**Handoff:** Agent N completes → runs tests → Agent N+1 picks up
