# BlitzClaw Deployment Checklist

## Pre-Deployment Verification ✅

Tested locally:
- [x] `npm run build` — Full monorepo builds
- [x] CLI compiles and all commands available
- [x] Hetzner API — Credentials valid, can list servers
- [x] Anthropic API — Credentials valid, can send messages
- [x] Neon Database — Tables created (User, Balance, Instance, UsageLog, ServerPool)
- [x] Test user created with $50 balance

## Vercel Deployment

### 1. Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Import `philippmuller/blitzclaw`
3. Framework Preset: **Next.js**
4. Root Directory: `apps/web`

### 2. Environment Variables

Add these in Vercel Dashboard → Settings → Environment Variables:

```
# Auth (Clerk) - get from Clerk Dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Billing (Creem) - get from Creem Dashboard
CREEM_API_KEY=creem_test_...

# Infrastructure (Hetzner) - get from Hetzner Cloud Console
HETZNER_API_TOKEN=...

# Token Proxy - get from Anthropic Console
ANTHROPIC_API_KEY=sk-ant-...
PROXY_SIGNING_SECRET=<generate-random-64-char-hex>

# Database (Neon) - get from Neon Dashboard
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require

# App URLs (update after first deploy)
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
API_URL=https://your-domain.vercel.app/api
```

> **Note:** Get actual values from `.env.local` in the repo (not committed) or from each service's dashboard.

### 3. Build Settings

- Build Command: `cd ../.. && npm run build --filter=@blitzclaw/web`
- Output Directory: `.next`
- Install Command: `cd ../.. && npm install`

### 4. Configure Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Settings → Paths:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in URL: `/dashboard`
   - After sign-up URL: `/dashboard`
3. Webhooks → Add Endpoint:
   - URL: `https://your-domain.vercel.app/api/webhooks/clerk`
   - Events: `user.created`, `user.deleted`
   - Copy signing secret → add as `CLERK_WEBHOOK_SECRET` env var

### 5. Configure Creem

1. Go to [Creem Dashboard](https://creem.io)
2. Webhooks → Add:
   - URL: `https://your-domain.vercel.app/api/webhooks/creem`
   - Events: `checkout.completed`, `payment.failed`
   - Copy signing secret → add as `CREEM_WEBHOOK_SECRET` env var

### 6. Custom Domain (Optional)

1. Vercel → Settings → Domains
2. Add `blitzclaw.com`
3. Configure DNS:
   - `A` record → Vercel IP
   - Or `CNAME` → `cname.vercel-dns.com`

## Post-Deployment Testing

```bash
# Install CLI
npm install -g blitzclaw

# Configure to use production
blitzclaw --api-url https://blitzclaw.com auth login

# Check balance
blitzclaw billing balance

# Create instance
blitzclaw instances create --channel telegram --persona assistant

# Connect Telegram (use your real bot token from @BotFather)
blitzclaw telegram connect <instance_id> --token <bot_token>
```

## Before Going Live

- [ ] **Rotate all API keys** (exposed in Discord during development)
  - Clerk: Dashboard → API Keys → Rotate
  - Creem: Dashboard → API Keys → Regenerate
  - Hetzner: Cloud Console → Security → API Tokens → Delete & Create New
  - Anthropic: Console → API Keys → Create New Key
  - Neon: Project Settings → Connection String → Reset Password

- [ ] Switch to production Clerk keys (pk_live_*, sk_live_*)
- [ ] Switch to production Creem keys
- [ ] Enable Cloudflare protection (optional)
- [ ] Set up monitoring (Sentry DSN in env vars)

## Troubleshooting

**Build fails with Prisma error:**
```bash
# Run in Vercel build command
npx prisma generate --schema=packages/db/prisma/schema.prisma
```

**Clerk redirects not working:**
Check `NEXT_PUBLIC_CLERK_*` vars are set and Clerk paths configured.

**Webhooks not firing:**
Check webhook signing secrets match between provider dashboard and env vars.
