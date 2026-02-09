# BlitzClaw Handoff Document

*Last updated: 2026-02-08*

## What Is BlitzClaw?

One-click OpenClaw deployment SaaS. Users sign up, subscribe (€20/mo), enter their Telegram bot token, and get a running OpenClaw instance on a dedicated Hetzner VPS.

**Live URL:** https://www.blitzclaw.com
**GitHub:** https://github.com/philippmuller/blitzclaw

## Tech Stack

- **Frontend:** Next.js 14 (App Router), Tailwind CSS, dark theme
- **Auth:** Clerk
- **Billing:** Paddle (Merchant of Record - handles tax/compliance)
- **Database:** Neon PostgreSQL + Prisma ORM
- **Server Provisioning:** Hetzner Cloud API
- **Deployment:** Vercel

## Current Status (What Works)

### ✅ Completed
1. **User auth** - Clerk sign-up/sign-in working
2. **Subscription checkout** - Paddle integration, €20/mo subscription
3. **Paddle webhooks** - `transaction.completed`, `subscription.created`, etc. properly credit balance
4. **Server provisioning** - Hetzner VPS created with cloud-init
5. **OpenClaw installation** - Node.js 22 + OpenClaw installed via cloud-init
6. **Telegram bot** - Bot connects and responds to messages
7. **Dashboard** - Shows instances, billing, settings
8. **Logo/favicon** - BlitzClaw lightning claw logo

### ⚠️ Partially Working
1. **Billing proxy** - Code deployed but new instances needed to test (existing instance predates proxy)
2. **Delete account** - Code written, but Vercel builds were failing (just fixed)
3. **Manage subscription** - Portal link API added, needs testing

### ❌ Not Working / Incomplete
1. **Auto top-up** - Paddle off-session charges enabled (needs production verification).
2. **Usage metering display** - Shows 0 tokens because existing instance calls Anthropic directly (proxy not configured)

## Architecture

### How Billing Proxy Works (for new instances)

```
User's Telegram → OpenClaw Instance → BlitzClaw Proxy → Anthropic API
                                            ↓
                                    Log usage + deduct balance
```

- Instance configured with custom provider `blitzclaw-anthropic`
- Uses `proxySecret` as API key
- Proxy at `/api/proxy/v1/messages` validates, forwards, logs usage
- `proxySecret` stored in Instance table (added via Prisma migration)

### Cloud-Init Flow

1. Hetzner creates VPS with user-data (cloud-init YAML)
2. Cloud-init writes config files:
   - `/root/.openclaw/openclaw.json` - gateway + channel config
   - `/root/.openclaw/agents/main/agent/auth-profiles.json` - proxy auth
3. Runs `/root/setup-openclaw.sh`:
   - Installs Node.js 22
   - Installs OpenClaw globally
   - Configures firewall (UFW)
   - Starts OpenClaw service
4. Calls back to `/api/internal/instance-ready` (marks ACTIVE)

### Key Files

```
apps/web/src/
├── app/
│   ├── api/
│   │   ├── billing/
│   │   │   ├── subscribe/route.ts    # Create Paddle checkout
│   │   │   ├── topup/route.ts        # Manual top-up
│   │   │   └── portal/route.ts       # Paddle customer portal link
│   │   ├── webhooks/paddle/route.ts  # Handle Paddle events
│   │   ├── instances/route.ts        # Create instance
│   │   ├── proxy/v1/messages/route.ts # Billing proxy
│   │   └── account/delete/route.ts   # Delete account
│   ├── (dashboard)/dashboard/        # Dashboard pages
│   └── onboarding/page.tsx           # Onboarding wizard
├── lib/
│   ├── cloud-init.ts                 # Generate cloud-init YAML
│   ├── provisioning.ts               # Server pool + instance creation
│   ├── hetzner.ts                    # Hetzner API wrapper
│   ├── pricing.ts                    # Cost calculation (100% markup)
│   └── auto-topup.ts                 # Auto top-up logic
packages/db/prisma/schema.prisma      # Database schema
```

## Environment Variables (Vercel)

Required in Vercel project settings:

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY

# Paddle
PADDLE_API_KEY
PADDLE_WEBHOOK_SECRET
PADDLE_CLIENT_TOKEN
PADDLE_SUBSCRIPTION_PRICE_ID
PADDLE_TOPUP_10_PRICE_ID
PADDLE_TOPUP_25_PRICE_ID
PADDLE_TOPUP_50_PRICE_ID
PADDLE_ENVIRONMENT

# Hetzner
HETZNER_API_TOKEN
HETZNER_SSH_KEY_ID               # 106934050

# Anthropic
ANTHROPIC_API_KEY                # BlitzClaw's key (used by proxy)

# Database
DATABASE_URL                     # Neon PostgreSQL connection string
```

## Open Problems & Decisions Needed

### 1. Auto Top-Up

**Status:** Paddle now supports off-session charges via subscription transactions.

**Current behavior:** When balance < €5, we create a Paddle transaction against the subscription (true auto top-up).

### 2. Existing Instance Doesn't Use Proxy

The test instance (178.156.163.99) was provisioned before proxy code was added. It calls Anthropic directly, so usage isn't tracked.

**Fix:** Delete instance via dashboard, re-provision. New instance will use proxy.

### 3. Webhook Signature Verification

Paddle webhook verification uses HMAC SHA256 with the Paddle-Signature header.

### 4. Instance-Ready Callback

Callback URL was using Vercel preview URL (requires auth). Fixed to use production URL. Needs verification with new instance.

## Pricing Model

- **Subscription:** €20/month (includes €10 credits)
- **Markup:** 100% (MARKUP_MULTIPLIER = 2.0)
- **Minimum balance:** €5 (MINIMUM_BALANCE_CENTS = 500)
- **Daily limit:** $200/day (DAILY_LIMIT_CENTS = 20000)
- **Auto top-up:** €25 when balance < €5 (not automatic, see above)

## Testing Flow

1. Sign up at blitzclaw.com
2. Subscribe (€20, test mode works)
3. Enter Telegram bot token (create via @BotFather)
4. Wait for provisioning (~2-3 min)
5. Message your bot on Telegram
6. Check dashboard for usage (only works with new instances + proxy)

## Recent Fixes (2026-02-08)

1. **Cloud-init YAML parsing** - Moved auth-profiles.json from heredoc to write_files
2. **Callback URL** - Use production URL, not preview URL
3. **JSON trailing newlines** - Use `|-` YAML block style
4. **TypeScript error** - Fixed `instanceId` → `instance.id` in proxy route

## Vercel Project

- **Project ID:** `prj_xpDp8Rne9I7Wu0uL2abcPgPlqhuC`
- **Token:** `DvRuedocAPUgsBKRwnTj1jm3`

Check deployment status:
```bash
curl -s "https://api.vercel.com/v6/deployments?projectId=prj_xpDp8Rne9I7Wu0uL2abcPgPlqhuC&limit=5" \
  -H "Authorization: Bearer DvRuedocAPUgsBKRwnTj1jm3" | jq '.deployments[] | {state, error: .errorMessage}'
```

## Next Steps

1. **Verify Vercel build passes** after TypeScript fix
2. **Test delete account** functionality
3. **Test manage subscription** (Paddle portal)
4. **Decide on auto top-up approach** (Stripe vs notification)
5. **Test full flow with new instance** to verify billing proxy works
6. **Rotate all API keys** before production launch (they were exposed in Discord)
