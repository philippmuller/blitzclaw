# BlitzClaw Handoff Document

*Last updated: 2026-02-13*

## What Is BlitzClaw?

One-click OpenClaw deployment SaaS. Users sign up, subscribe, connect Telegram, and get a dedicated AI assistant instance. Premium models (Claude Opus), zero configuration required.

**Live URL:** https://www.blitzclaw.com  
**GitHub:** https://github.com/philippmuller/blitzclaw

## Tech Stack

- **Frontend:** Next.js 14 (App Router), Tailwind CSS, dark theme
- **Auth:** Clerk
- **Billing:** Polar.sh (Merchant of Record - handles subscriptions + usage metering)
- **Database:** Neon PostgreSQL + Prisma ORM
- **Infrastructure:** Multi-cloud (Hetzner, DigitalOcean, Vultr) - all Frankfurt/Germany
- **Deployment:** Vercel

## Current Status

### ✅ Working
1. **User auth** — Clerk sign-up/sign-in
2. **Subscription checkout** — Polar.sh integration, $19 Basic / $39 Pro
3. **Polar webhooks** — Credits user balance on subscription
4. **Multi-cloud provisioning** — Hetzner → DigitalOcean → Vultr fallback
5. **Server pool** — Pre-provisioned servers for instant deployment
6. **OpenClaw installation** — Node.js 22 + OpenClaw via cloud-init
7. **Telegram integration** — Bot connects and responds
8. **Billing proxy** — Token proxy tracks usage, sends to Polar meter
9. **Usage-based billing** — No balance blocking, Polar bills overage monthly
10. **Dashboard** — Instances, billing (Intelligence Cost), settings
11. **Waitlist** — Shows email form when all providers at capacity
12. **Welcome email** — Sends via Resend on subscription

### ⚠️ Not Yet Implemented
1. **WhatsApp/Slack channels** — Telegram only for now
2. **BYOK (Bring Your Own Key)** — Hidden, all users use managed billing
3. **Google Calendar integration** — Planned
4. **Google Drive integration** — Planned
5. **Codex + GitHub + Vercel skill** — Planned

## Architecture

### Billing Flow

```
User subscribes (Polar.sh)
        ↓
Webhook → Credit $5 (Basic) or $15 (Pro) to balance
        ↓
User chats via Telegram
        ↓
OpenClaw Instance → Token Proxy → Anthropic API
        ↓
Proxy logs usage:
  1. Deduct from DB balance (for dashboard display)
  2. Send meter event to Polar (for billing)
        ↓
End of month: Polar bills subscription + overage
```

**Key points:**
- No balance blocking — usage always continues
- $100/day safety cap (rate limit, not hard block)
- 50% margin on Anthropic costs (MARKUP_MULTIPLIER = 1.5)

### Multi-Cloud Provisioning

```
provisionServer()
    ↓
Try Hetzner (nbg1) ──fail──→ Try DigitalOcean (fra1) ──fail──→ Try Vultr (fra)
    ↓ success                      ↓ success                        ↓ success
Create ServerPool entry with provider type
    ↓
Cloud-init installs OpenClaw
    ↓
Callback to /api/internal/instance-ready
    ↓
Server status: PROVISIONING → AVAILABLE
```

### Server Specs

| Plan | Hetzner | DigitalOcean | Vultr |
|------|---------|--------------|-------|
| Basic | cx23 (2 ARM, 4GB) €4/mo | s-1vcpu-2gb $12/mo | vc2-1c-2gb $10/mo |
| Pro | cx33 (4 ARM, 8GB) €8/mo | s-2vcpu-4gb $24/mo | vc2-2c-4gb $20/mo |

### Key Files

```
apps/web/src/
├── app/
│   ├── api/
│   │   ├── polar/checkout/route.ts     # Create Polar checkout
│   │   ├── webhooks/polar/route.ts     # Handle Polar events
│   │   ├── proxy/v1/messages/route.ts  # Token proxy (billing)
│   │   ├── waitlist/route.ts           # Capacity check + waitlist
│   │   └── internal/
│   │       ├── maintain-pool/route.ts  # Pool maintenance cron
│   │       ├── cleanup-orphans/route.ts # Clean orphaned servers
│   │       └── diagnostics/route.ts    # Debug endpoint
│   ├── (dashboard)/dashboard/          # Dashboard pages
│   └── onboarding/page.tsx             # Onboarding wizard
├── lib/
│   ├── cloud-init.ts         # Generate cloud-init YAML
│   ├── provisioning.ts       # Multi-cloud provisioning
│   ├── hetzner.ts            # Hetzner API
│   ├── digitalocean.ts       # DigitalOcean API
│   ├── vultr.ts              # Vultr API
│   ├── polar.ts              # Polar.sh API + usage tracking
│   └── pricing.ts            # Cost calculation (50% markup)
packages/db/prisma/schema.prisma
```

## Environment Variables

### Required (Vercel)

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Polar.sh
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_PRODUCT_BASIC_ID=
POLAR_PRODUCT_PRO_ID=
POLAR_SANDBOX=false

# Infrastructure
HETZNER_API_TOKEN=
HETZNER_SSH_KEY_ID=
DIGITALOCEAN_API_TOKEN=
DIGITALOCEAN_SSH_KEY_ID=
VULTR_API_TOKEN=
VULTR_SSH_KEY_ID=

# Anthropic
ANTHROPIC_API_KEY=
PROXY_SIGNING_SECRET=

# Database
DATABASE_URL=

# Email
RESEND_API_KEY=

# Internal
DIAGNOSTICS_KEY=blitz-debug-2026
```

## Pricing

| Plan | Monthly | Included Credits | Overage |
|------|---------|------------------|---------|
| Basic | $19/mo | $5 | Billed via Polar |
| Pro | $39/mo | $15 | Billed via Polar |

### AI Model Costs (user pays, includes 50% margin)

| Model | Input/1M | Output/1M |
|-------|----------|-----------|
| Claude Opus | $22.50 | $112.50 |
| Claude Sonnet | $4.50 | $22.50 |
| Claude Haiku | $1.50 | $7.50 |

**Safety cap:** $100/day (429 error, resets at midnight)

## Internal Endpoints

All require `?key=blitz-debug-2026`:

- `GET /api/internal/diagnostics` — Pool status, user list
- `GET /api/internal/diagnostics?email=xxx` — Search specific user
- `POST /api/internal/maintain-pool` — Trigger pool maintenance
- `POST /api/internal/cleanup-orphans` — Clean orphaned cloud servers

## Useful Commands

```bash
# Check pool status
curl "https://www.blitzclaw.com/api/internal/diagnostics?key=blitz-debug-2026" | jq '.pool'

# Check specific user
curl "https://www.blitzclaw.com/api/internal/diagnostics?key=blitz-debug-2026&email=test" | jq '.'

# Trigger pool maintenance
curl -X POST "https://www.blitzclaw.com/api/internal/maintain-pool?key=blitz-debug-2026"

# Clean orphaned servers
curl -X POST "https://www.blitzclaw.com/api/internal/cleanup-orphans?key=blitz-debug-2026"
```

## Current Cloud Limits

| Provider | Limit | Status |
|----------|-------|--------|
| Hetzner | 4 IPs | Need 1 month payment history to increase |
| DigitalOcean | 3 droplets | Increase requested |
| Vultr | ~10 instances | New account, limits TBD |

## Next Steps

1. **Scale capacity** — Wait for DO limit increase, monitor Vultr
2. **Google integrations** — Calendar, Drive read access
3. **Codex skill** — Pre-configured GitHub + Vercel for code shipping
4. **WhatsApp channel** — After Telegram proven
5. **Landing page video** — Demo of Codex building + deploying a page

## Key Decisions Made

- **No balance blocking** — Polar handles overage billing
- **No BYOK for launch** — Simplifies support, hidden toggle exists
- **Multi-cloud** — Reliability over cost optimization
- **50% margin** — Covers infra + profit
- **Germany-only servers** — GDPR compliance
- **Premium models default** — Opus, not Sonnet/Haiku
