# BlitzClaw ⚡

**Managed OpenClaw instances. One click. Zero setup.**

BlitzClaw is a SaaS platform that provisions dedicated AI assistant instances powered by [OpenClaw](https://github.com/openclaw/openclaw). Sign up, subscribe, and get your own AI assistant with Telegram integration—no API keys or server management required.

## Features

- **🚀 Instant Deployment** — Pool-based provisioning means your instance is ready in seconds, not minutes
- **💬 Telegram Integration** — Connect your bot and start chatting immediately
- **🌐 Browser Automation** — Chromium enabled for web scraping, screenshots, and automation
- **💳 Simple Billing** — Subscription + usage-based credits, all handled for you
- **🔒 Full Isolation** — Each user gets a dedicated Hetzner VPS in Germany
- **🎭 Customizable** — Bring your own SOUL.md personality and skills

## Pricing

| Plan | Monthly | Included Credits | Extra Credits |
|------|---------|------------------|---------------|
| **Basic** | $19/mo | $5 | Pay-as-you-go |
| **Pro** | $39/mo | $15 | Pay-as-you-go |

Credits cover AI model usage (Claude, GPT-4, etc.) with transparent per-token pricing.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) + TypeScript |
| **Database** | PostgreSQL (Neon) + Prisma ORM |
| **Auth** | Clerk |
| **Payments** | Polar.sh (subscriptions + usage metering) |
| **Infrastructure** | Hetzner Cloud (cx23 ARM servers, Germany) |
| **Monorepo** | Turborepo |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   BlitzClaw Platform                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌──────────┐    ┌─────────┐    ┌─────────────────┐   │
│   │  Web UI  │───▶│   API   │───▶│   Provisioner   │   │
│   │ (Next.js)│    │ Routes  │    │  (Server Pool)  │   │
│   └──────────┘    └────┬────┘    └────────┬────────┘   │
│                        │                   │            │
│         ┌──────────────┼───────────────────┤            │
│         ▼              ▼                   ▼            │
│    ┌─────────┐   ┌──────────┐       ┌──────────┐       │
│    │  Clerk  │   │ Polar.sh │       │ Hetzner  │       │
│    │  (Auth) │   │(Billing) │       │  Cloud   │       │
│    └─────────┘   └──────────┘       └──────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
    ┌───────────┐    ┌───────────┐    ┌───────────┐
    │  Instance │    │  Instance │    │  Instance │
    │  (User A) │    │  (User B) │    │  (User C) │
    │           │    │           │    │           │
    │ OpenClaw  │    │ OpenClaw  │    │ OpenClaw  │
    │ Telegram  │    │ Telegram  │    │ Telegram  │
    │ Chromium  │    │ Chromium  │    │ Chromium  │
    └─────┬─────┘    └───────────┘    └───────────┘
          │
          ▼
    ┌───────────┐
    │  Token    │
    │  Proxy    │◀── Usage metering
    └─────┬─────┘
          ▼
    ┌───────────┐
    │ Anthropic │
    │  OpenAI   │
    └───────────┘
```

## Project Structure

```
blitzclaw/
├── apps/
│   ├── web/              # Next.js web application (dashboard, API routes)
│   └── cli/              # CLI tool for power users
├── packages/
│   └── db/               # Prisma schema + generated client
├── skills/
│   └── linkedin/         # LinkedIn automation skill
├── scripts/              # Utility scripts (testing, seeding, deployment)
├── docs/                 # Documentation
│   ├── DEPLOYMENT.md     # Production deployment guide
│   ├── DEVELOPMENT.md    # Local development setup
│   └── PROXY.md          # Token proxy architecture
└── turbo.json            # Turborepo configuration
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 14+ (or Neon account)

### Local Development

```bash
# Clone the repository
git clone https://github.com/blitzclaw/blitzclaw.git
cd blitzclaw

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Available Scripts

```bash
# Development
npm run dev               # Start all apps in development mode
npm run build             # Build all packages
npm run lint              # Run ESLint
npm run typecheck         # TypeScript type checking

# Database
npm run db:generate       # Generate Prisma client
npm run db:push           # Push schema to database
npm run db:studio         # Open Prisma Studio
npm run db:seed           # Seed database with test data

# Testing
npm run test              # Run all tests
npm run test:unit         # Unit tests only
npm run test:e2e:sim      # Simulated E2E tests
npm run test:e2e:real     # Real E2E tests (requires credentials)

# Infrastructure
npm run seed-pool         # Pre-provision server pool
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

### Required

```bash
# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=

# Application
NEXT_PUBLIC_APP_URL=
```

### Billing (Polar.sh)

```bash
POLAR_ACCESS_TOKEN=
POLAR_ORGANIZATION_ID=
POLAR_WEBHOOK_SECRET=
POLAR_PRODUCT_BASIC=
POLAR_PRODUCT_PRO=
```

### Infrastructure (Hetzner)

```bash
HETZNER_API_TOKEN=
HETZNER_SSH_KEY_ID=
```

### AI Providers

```bash
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
PROXY_SIGNING_SECRET=
```

### Optional

```bash
# Webhooks
CLERK_WEBHOOK_SECRET=

# Email (Resend)
RESEND_API_KEY=

# Error Tracking (Sentry)
SENTRY_DSN=

# Caching (Upstash Redis)
REDIS_URL=
```

See `.env.example` for the complete list with descriptions.

## Deployment

BlitzClaw is designed for deployment on **Vercel**:

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy

The `vercel.json` configuration handles routing and build settings automatically.

### Production Checklist

- [ ] Configure all required environment variables
- [ ] Set up Clerk production instance
- [ ] Configure Polar.sh products and webhooks
- [ ] Create Hetzner API token with server permissions
- [ ] Pre-provision server pool with `npm run seed-pool`
- [ ] Set up webhook endpoints for Clerk and Polar.sh

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) — Local setup and contribution guidelines
- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment checklist
- [Proxy Architecture](docs/PROXY.md) — Token proxy and usage metering details
- [Technical Spec](SPEC.md) — Full technical specification

## How It Works

1. **User signs up** via Clerk authentication
2. **Subscribes** to Basic or Pro plan through Polar.sh
3. **Creates instance** — BlitzClaw assigns a pre-provisioned server from the pool
4. **Connects Telegram** — User provides bot token, BlitzClaw configures the instance
5. **Starts chatting** — AI assistant is ready with browser automation capabilities
6. **Usage tracked** — Token proxy meters API calls, deducts from credit balance

### Server Pool

BlitzClaw maintains a pool of pre-configured Hetzner servers. When a user creates an instance:

1. An available server is assigned from the pool
2. OpenClaw is configured with user settings (SOUL.md, model, etc.)
3. Telegram bot is connected
4. Server status changes from `AVAILABLE` → `ASSIGNED`

This pool-based approach enables **instant provisioning** (seconds vs. minutes for cold starts).

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and tests (`npm run lint && npm run test`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT

---

Built with ⚡ by the BlitzClaw team.
