# Deployment Guide

This guide covers deploying BlitzClaw to production.

## Prerequisites

- Node.js 22+
- npm 10+
- A Vercel account (for web app)
- A Hetzner Cloud account (for user instances)
- A Supabase account (or any PostgreSQL database)
- Clerk account (authentication)
- Paddle account (billing/MoR)

## Environment Variables

All required environment variables are documented in `.env.example`. You'll need:

### Authentication (Clerk)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
```

Get these from your [Clerk Dashboard](https://dashboard.clerk.dev).

### Billing (Paddle)
```bash
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PADDLE_CLIENT_TOKEN=...
PADDLE_SUBSCRIPTION_PRICE_ID=...
PADDLE_TOPUP_10_PRICE_ID=...
PADDLE_TOPUP_25_PRICE_ID=...
PADDLE_TOPUP_50_PRICE_ID=...
PADDLE_ENVIRONMENT=production
```

Get these from your [Paddle Dashboard](https://vendors.paddle.com).

### Infrastructure (Hetzner)
```bash
HETZNER_API_TOKEN=...
```

Create an API token in [Hetzner Cloud Console](https://console.hetzner.cloud) → Security → API Tokens.

### AI Providers
```bash
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PROXY_SIGNING_SECRET=<random-32-char-string>
```

### Database
```bash
DATABASE_URL=postgresql://user:password@host:5432/blitzclaw
```

## Database Setup

### Option 1: Supabase (Recommended)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings → Database → Connection string
3. Copy the connection string (use "Transaction" mode for serverless)
4. Add to your environment as `DATABASE_URL`

### Option 2: Any PostgreSQL

Any PostgreSQL 14+ instance works. Just provide the connection string.

### Run Migrations

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio to inspect
npm run db:studio
```

### Seed Data (Optional)

Create a test user with balance:

```bash
npx ts-node scripts/seed.ts
```

## Vercel Deployment

### Option 1: Vercel GitHub Integration (Recommended)

1. Connect your GitHub repo to Vercel
2. Vercel auto-detects the monorepo
3. Configure:
   - **Root Directory:** `.` (repo root)
   - **Build Command:** `npm run build -- --filter=@blitzclaw/web`
   - **Output Directory:** `apps/web/.next`
   - **Install Command:** `npm install`
4. Add all environment variables in Vercel dashboard
5. Deploy!

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link project
vercel link

# Deploy preview
vercel

# Deploy to production
vercel --prod
```

### Environment Variables on Vercel

Add these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Environment |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production, Preview |
| `CLERK_SECRET_KEY` | Production, Preview |
| `CLERK_WEBHOOK_SECRET` | Production |
| `CREEM_API_KEY` | Production |
| `CREEM_WEBHOOK_SECRET` | Production |
| `HETZNER_API_TOKEN` | Production |
| `ANTHROPIC_API_KEY` | Production |
| `OPENAI_API_KEY` | Production |
| `PROXY_SIGNING_SECRET` | Production |
| `DATABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | Production (https://blitzclaw.com) |

## Webhook Configuration

### Clerk Webhooks

1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to events:
   - `user.created`
   - `user.deleted`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET`

### Paddle Webhooks

1. Go to Paddle Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/paddle`
3. Subscribe to events:
   - `transaction.completed`
   - `subscription.created`
   - `subscription.canceled`
4. Copy the signing secret to `PADDLE_WEBHOOK_SECRET`

## DNS & Domain Setup

### Cloudflare (Recommended)

1. Add your domain to Cloudflare
2. Point DNS to Vercel:
   ```
   Type: CNAME
   Name: @
   Target: cname.vercel-dns.com
   Proxy: ON (orange cloud)
   ```
3. Enable:
   - SSL/TLS: Full (strict)
   - Bot Fight Mode: ON
   - Rate Limiting (optional)

## Post-Deployment Checklist

- [ ] Verify Clerk authentication works (sign up, sign in)
- [ ] Test Paddle checkout flow (top-up balance)
- [ ] Webhooks receiving events (check logs)
- [ ] Database connected (check /api/auth/me)
- [ ] Hetzner API working (test instance creation)
- [ ] Token proxy responding (check /api/proxy/health)

## Monitoring

### Recommended Setup

1. **Vercel Analytics** - Enable in Vercel dashboard (free tier available)
2. **Sentry** - Add `SENTRY_DSN` for error tracking
3. **Uptime Monitoring** - UptimeRobot or similar for:
   - `https://your-domain.com/api/proxy/health`
   - `https://your-domain.com/api/auth/me`

## Troubleshooting

### Build Fails on Vercel

1. Check that `DATABASE_URL` is set (Prisma needs it at build time)
2. Ensure Clerk keys are set (middleware requires them)
3. Check Vercel build logs for specific errors

### Webhooks Not Working

1. Verify webhook URL is correct
2. Check signing secret matches
3. Look at Vercel function logs
4. Test with Clerk/Paddle webhook testing tools

### Database Connection Issues

1. Ensure IP allowlist includes Vercel IPs (or allow all: 0.0.0.0/0)
2. Check connection string format
3. For Supabase: use Transaction pooler URL for serverless
