# BlitzClaw Handoff Document

*Last updated: 2026-02-08*

## What Is BlitzClaw?

One-click OpenClaw deployment SaaS. Users sign up, subscribe (€20/mo), enter their Telegram bot token, and get a running OpenClaw instance on a dedicated Hetzner VPS.

**Live URL:** https://www.blitzclaw.com
**GitHub:** https://github.com/philippmuller/blitzclaw

## Tech Stack

- **Frontend:** Next.js 14 (App Router), Tailwind CSS, dark theme
- **Auth:** Clerk
- **Billing:** Creem (Merchant of Record - handles tax/compliance)
- **Database:** Neon PostgreSQL + Prisma ORM
- **Server Provisioning:** Hetzner Cloud API
- **Deployment:** Vercel

## Current Status (What Works)

### ✅ Completed
1. **User auth** - Clerk sign-up/sign-in working
2. **Subscription checkout** - Creem integration, €20/mo subscription
3. **Creem webhooks** - `checkout.completed`, `subscription.paid`, etc. properly credit balance
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
1. **Auto top-up** - Creem doesn't support direct charging saved cards. Current code creates checkout URL but user must click to pay.
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
│   │   │   ├── subscribe/route.ts    # Create Creem checkout
│   │   │   ├── topup/route.ts        # Manual top-up
│   │   │   └── portal/route.ts       # Creem customer portal link
│   │   ├── webhooks/creem/route.ts   # Handle Creem events
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

# Creem
CREEM_API_KEY                    # test_sk_... for test mode
CREEM_SUBSCRIPTION_PRODUCT_ID    # prod_6LjFrzPanR3NhzrRBz3NwW
CREEM_TOPUP_PRODUCT_ID           # prod_xSnQc6ltDvsh0dFVigawu (€25)
CREEM_TOPUP_PRODUCT_ID_50        # prod_3YiIMmKun2sLMa17PM16O5 (€50)
CREEM_WEBHOOK_SECRET             # For signature verification

# Hetzner
HETZNER_API_TOKEN
HETZNER_SSH_KEY_ID               # 106934050

# Anthropic
ANTHROPIC_API_KEY                # BlitzClaw's key (used by proxy)

# Database
DATABASE_URL                     # Neon PostgreSQL connection string
```

## Open Problems & Decisions Needed

### 1. Auto Top-Up (CRITICAL)

**Problem:** Creem has no API to charge saved payment methods directly. You can only create checkout sessions.

**Current behavior:** When balance < €5, we create a checkout URL. User must click to pay. Not truly automatic.

**Options:**
1. **Switch to Stripe** - Has `paymentIntents.create()` for direct charging. Requires migration.
2. **Accept manual top-up** - Send user notification with payment link when low. Pause at €0.
3. **Ask Creem** - They might have undocumented API or upcoming feature.
4. **Metered billing** - Track usage, charge at end of billing period (architectural change).

**Philipp's preference:** Wants truly automatic. Suggested lowering daily limit instead of semi-manual flow.

### 2. Existing Instance Doesn't Use Proxy

The test instance (178.156.163.99) was provisioned before proxy code was added. It calls Anthropic directly, so usage isn't tracked.

**Fix:** Delete instance via dashboard, re-provision. New instance will use proxy.

### 3. Webhook Signature Verification

Currently bypassed (logs warning but processes anyway). Need to fix HMAC verification to match Creem's format.

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

1. **Creem webhook field names** - Changed `event_type` → `eventType`, `data` → `object`
2. **Cloud-init YAML parsing** - Moved auth-profiles.json from heredoc to write_files
3. **Callback URL** - Use production URL, not preview URL
4. **JSON trailing newlines** - Use `|-` YAML block style
5. **TypeScript error** - Fixed `instanceId` → `instance.id` in proxy route

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
3. **Test manage subscription** (Creem portal)
4. **Decide on auto top-up approach** (Stripe vs notification)
5. **Test full flow with new instance** to verify billing proxy works
6. **Rotate all API keys** before production launch (they were exposed in Discord)
