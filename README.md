# BlitzClaw ⚡

**Managed OpenClaw instances. One click. Zero setup.**

BlitzClaw is a SaaS platform that provisions dedicated AI assistant instances powered by [OpenClaw](https://github.com/openclaw/openclaw). Sign up, subscribe, and get your own AI assistant with Telegram integration—no API keys or server management required.

## Features

- **🚀 Instant Deployment** — Pool-based provisioning means your instance is ready in seconds
- **💬 Telegram Integration** — Connect your bot and start chatting immediately
- **🌐 Browser Automation** — Chromium enabled for web scraping, screenshots, and automation
- **💳 Usage-Based Billing** — Pay for what you use, billed monthly via Polar.sh
- **🔒 Full Isolation** — Each user gets a dedicated VPS in Germany (GDPR compliant)
- **🎭 Customizable** — Bring your own SOUL.md personality and skills
- **☁️ Multi-Cloud** — Hetzner, DigitalOcean, and Vultr for reliability

## Pricing

| Plan | Monthly | Included Credits | Overage |
|------|---------|------------------|---------|
| **Basic** | $19/mo | $5 | Billed at end of cycle |
| **Pro** | $39/mo | $15 | Billed at end of cycle |

### AI Model Costs (with 50% margin)

| Model | Input | Output |
|-------|-------|--------|
| Claude Opus | $22.50 / 1M tokens | $112.50 / 1M tokens |
| Claude Sonnet | $4.50 / 1M tokens | $22.50 / 1M tokens |
| Claude Haiku | $1.50 / 1M tokens | $7.50 / 1M tokens |

No balance blocking — usage continues and overage is billed monthly. Safety cap: $100/day.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) + TypeScript |
| **Database** | PostgreSQL (Neon) + Prisma ORM |
| **Auth** | Clerk |
| **Payments** | Polar.sh (subscriptions + usage metering) |
| **Infrastructure** | Multi-cloud: Hetzner, DigitalOcean, Vultr (all Frankfurt/Germany) |
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
│    ┌─────────┐   ┌──────────┐       ┌──────────────┐   │
│    │  Clerk  │   │ Polar.sh │       │ Multi-Cloud  │   │
│    │  (Auth) │   │(Billing) │       │   Provider   │   │
│    └─────────┘   └──────────┘       └──────────────┘   │
│                                            │            │
└────────────────────────────────────────────┼────────────┘
                                             │
          ┌──────────────────────────────────┼──────────┐
          │                                  │          │
          ▼                                  ▼          ▼
    ┌───────────┐                     ┌───────────┐  ┌───────────┐
    │  Hetzner  │ (primary)           │DigitalOcean│  │   Vultr   │
    │  cx23/33  │                     │  (fallback)│  │ (fallback)│
    └─────┬─────┘                     └───────────┘  └───────────┘
          │
          ▼
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
    │  Proxy    │◀── Usage metering → Polar.sh
    └─────┬─────┘
          ▼
    ┌───────────┐
    │ Anthropic │
    └───────────┘
```

## Multi-Cloud Provisioning

BlitzClaw uses multiple cloud providers for reliability and capacity:

| Priority | Provider | Region | Server Type | Cost |
|----------|----------|--------|-------------|------|
| 1 | Hetzner | Nuremberg (nbg1) | cx23 (Basic) / cx33 (Pro) | €4-8/mo |
| 2 | DigitalOcean | Frankfurt (fra1) | s-1vcpu-2gb / s-2vcpu-4gb | $12-24/mo |
| 3 | Vultr | Frankfurt (fra) | vc2-1c-2gb | $10/mo |

When provisioning:
1. Try Hetzner first (cheapest)
2. If Hetzner at capacity → fall back to DigitalOcean
3. If DO at capacity → fall back to Vultr
4. If all providers at capacity → show waitlist form

All servers are in German datacenters for GDPR compliance.

## Project Structure

```
blitzclaw/
├── apps/
│   └── web/              # Next.js web application
├── packages/
│   └── db/               # Prisma schema + client
├── skills/
│   └── linkedin/         # LinkedIn automation skill
├── scripts/              # Utility scripts
└── docs/                 # Documentation
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 14+ (or Neon account)

### Local Development

```bash
# Clone and install
git clone https://github.com/philippmuller/blitzclaw.git
cd blitzclaw
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your keys

# Database setup
npm run db:generate
npm run db:push

# Start development
npm run dev
```

### Environment Variables

#### Required
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=
NEXT_PUBLIC_APP_URL=
```

#### Billing (Polar.sh)
```bash
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_PRODUCT_BASIC_ID=
POLAR_PRODUCT_PRO_ID=
POLAR_SANDBOX=false  # Set to false for production
```

#### Infrastructure
```bash
# Hetzner (primary)
HETZNER_API_TOKEN=
HETZNER_SSH_KEY_ID=

# DigitalOcean (fallback)
DIGITALOCEAN_API_TOKEN=
DIGITALOCEAN_SSH_KEY_ID=

# Vultr (fallback)
VULTR_API_TOKEN=
VULTR_SSH_KEY_ID=
```

#### AI Provider
```bash
ANTHROPIC_API_KEY=
PROXY_SIGNING_SECRET=
```

## Billing Flow

1. **User subscribes** → Polar.sh creates subscription
2. **Webhook received** → BlitzClaw credits $5 (Basic) or $15 (Pro) to user balance
3. **User makes AI requests** → Token proxy forwards to Anthropic
4. **Usage tracked** → Deducted from balance AND sent to Polar.sh meter
5. **End of billing cycle** → Polar.sh bills overage beyond included credits

No hard blocking — users can always use the service. $100/day safety cap prevents runaway costs.

## API Endpoints

### Public
- `POST /api/polar/checkout` — Create checkout session
- `POST /api/webhooks/polar` — Polar.sh webhook receiver
- `POST /api/webhooks/clerk` — Clerk webhook receiver

### Protected (requires auth)
- `GET /api/instances` — List user's instances
- `POST /api/instances` — Create new instance
- `GET /api/billing/balance` — Get current balance

### Internal (requires debug key)
- `GET /api/internal/diagnostics` — Pool and user diagnostics
- `POST /api/internal/maintain-pool` — Trigger pool maintenance
- `POST /api/internal/cleanup-orphans` — Clean up orphaned servers

### Token Proxy
- `POST /api/proxy/v1/messages` — Anthropic Messages API proxy

## Deployment

BlitzClaw deploys to **Vercel**:

1. Connect repository to Vercel
2. Configure environment variables
3. Deploy

### Production Checklist

- [ ] All env vars configured in Vercel
- [ ] Clerk production instance
- [ ] Polar.sh products and webhooks configured
- [ ] Hetzner/DO/Vultr API tokens with server permissions
- [ ] SSH key uploaded to all three providers
- [ ] Pre-provision server pool via maintain-pool endpoint

## License

MIT

---

Built with ⚡ by [2M Ventures](https://2m.vc)
