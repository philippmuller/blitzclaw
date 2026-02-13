# BlitzClaw ⚡

**Managed OpenClaw instances. One click. Zero setup.**

BlitzClaw is a SaaS platform that provisions dedicated AI assistant instances powered by [OpenClaw](https://github.com/openclaw/openclaw). Sign up, subscribe, and get your own AI assistant with Telegram integration—no API keys or server management required.

## Features

- **🚀 Instant Deployment** — Pool-based provisioning means your instance is ready in seconds
- **💬 Telegram Integration** — Connect your bot and start chatting immediately
- **🌐 Browser Automation** — Chromium enabled for web scraping, screenshots, and automation
- **💳 Usage-Based Billing** — Pay for what you use via Polar.sh, billed monthly
- **🔒 Full Isolation** — Each user gets a dedicated VPS in Germany (GDPR compliant)
- **🎭 Customizable** — Bring your own SOUL.md personality and skills
- **☁️ Multi-Cloud** — Hetzner, DigitalOcean, and Vultr for reliability

## Pricing

| Plan | Monthly | Included Credits | Overage |
|------|---------|------------------|---------|
| **Basic** | $19/mo | $5 | Billed at end of cycle |
| **Pro** | $39/mo | $15 | Billed at end of cycle |

### AI Model Costs (includes 50% margin)

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|-------------------|-------------------|
| Claude Opus 4 | $22.50 | $112.50 |
| Claude Sonnet 4 | $4.50 | $22.50 |
| Claude Haiku 4 | $1.50 | $7.50 |

No balance blocking — usage continues and overage is billed monthly via Polar.sh.  
Safety cap: $100/day maximum spend.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) + TypeScript |
| **Database** | PostgreSQL (Neon) + Prisma ORM |
| **Auth** | Clerk |
| **Payments** | Polar.sh (subscriptions + usage metering) |
| **Email** | Resend |
| **Infrastructure** | Multi-cloud: Hetzner, DigitalOcean, Vultr (all Frankfurt/Germany) |
| **Monorepo** | Turborepo |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     BlitzClaw Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐    ┌─────────┐    ┌──────────────────────┐   │
│   │  Web UI  │───▶│   API   │───▶│    Provisioner       │   │
│   │ (Next.js)│    │ Routes  │    │   (Server Pool)      │   │
│   └──────────┘    └────┬────┘    └──────────┬───────────┘   │
│                        │                     │               │
│         ┌──────────────┼─────────────────────┤               │
│         ▼              ▼                     ▼               │
│    ┌─────────┐   ┌──────────┐    ┌─────────────────────┐    │
│    │  Clerk  │   │ Polar.sh │    │   Cloud Providers   │    │
│    │  (Auth) │   │(Billing) │    │                     │    │
│    └─────────┘   └──────────┘    │  ┌───────────────┐  │    │
│                                   │  │   Hetzner     │  │    │
│                                   │  │  (primary)    │  │    │
│                                   │  └───────┬───────┘  │    │
│                                   │          │ fallback │    │
│                                   │  ┌───────▼───────┐  │    │
│                                   │  │ DigitalOcean  │  │    │
│                                   │  └───────┬───────┘  │    │
│                                   │          │ fallback │    │
│                                   │  ┌───────▼───────┐  │    │
│                                   │  │    Vultr      │  │    │
│                                   │  └───────────────┘  │    │
│                                   └─────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
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
      │  Proxy    │◀── Usage metering ──▶ Polar.sh
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
| 3 | Vultr | Frankfurt (fra) | vc2-1c-2gb / vc2-2c-4gb | $10-20/mo |

**Fallback logic:**
1. Try Hetzner first (cheapest)
2. If Hetzner at capacity → fall back to DigitalOcean
3. If DO at capacity → fall back to Vultr
4. If all providers at capacity → show waitlist form

All servers are in German datacenters for GDPR compliance.

## Billing Flow

```
1. User subscribes via Polar.sh
         ↓
2. Webhook credits $5 (Basic) or $15 (Pro) to user balance
         ↓
3. User chats via Telegram
         ↓
4. OpenClaw Instance → Token Proxy → Anthropic API
         ↓
5. Proxy logs usage:
   - Deducts from DB balance (dashboard display)
   - Sends meter event to Polar (actual billing)
         ↓
6. End of month: Polar bills subscription + any overage
```

**Key behaviors:**
- No balance blocking — usage always continues
- $100/day safety cap (rate limit)
- 50% margin on Anthropic costs

## Project Structure

```
blitzclaw/
├── apps/
│   └── web/                    # Next.js web application
│       └── src/
│           ├── app/
│           │   ├── api/
│           │   │   ├── polar/checkout/      # Create checkout session
│           │   │   ├── webhooks/polar/      # Handle Polar events
│           │   │   ├── proxy/v1/messages/   # Token proxy (billing)
│           │   │   ├── waitlist/            # Capacity check
│           │   │   └── internal/            # Debug/maintenance endpoints
│           │   ├── (dashboard)/             # Dashboard pages
│           │   └── onboarding/              # Onboarding wizard
│           ├── components/                  # React components
│           └── lib/
│               ├── cloud-init.ts            # Generate cloud-init YAML
│               ├── provisioning.ts          # Multi-cloud provisioning
│               ├── hetzner.ts               # Hetzner Cloud API
│               ├── digitalocean.ts          # DigitalOcean API
│               ├── vultr.ts                 # Vultr API
│               ├── polar.ts                 # Polar.sh API + metering
│               ├── pricing.ts               # Cost calculation
│               └── email.ts                 # Resend email
├── packages/
│   └── db/                     # Prisma schema + generated client
│       └── prisma/
│           └── schema.prisma
├── skills/
│   └── linkedin/               # LinkedIn automation skill (WIP)
├── scripts/                    # Utility scripts
│   ├── seed-pool.ts            # Pre-provision servers
│   └── test-e2e-polar.ts       # E2E billing tests
├── docs/
│   └── LINKEDIN_SKILL.md       # Skill documentation
├── HANDOFF.md                  # Detailed handoff documentation
├── SPEC.md                     # Technical specification
└── turbo.json                  # Turborepo configuration
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 14+ (or Neon account)

### Local Development

```bash
# Clone the repository
git clone https://github.com/philippmuller/blitzclaw.git
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

# Infrastructure
npm run seed-pool         # Pre-provision server pool
```

## Environment Variables

### Required

```bash
# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Database
DATABASE_URL=

# Application
NEXT_PUBLIC_APP_URL=https://www.blitzclaw.com
```

### Billing (Polar.sh)

```bash
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_PRODUCT_BASIC_ID=
POLAR_PRODUCT_PRO_ID=
POLAR_SANDBOX=false          # true for testing, false for production
```

### Infrastructure

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

### AI Provider

```bash
ANTHROPIC_API_KEY=           # BlitzClaw's key (used by proxy)
PROXY_SIGNING_SECRET=        # Signs instance tokens
```

### Email

```bash
RESEND_API_KEY=              # For welcome emails
```

### Internal

```bash
DIAGNOSTICS_KEY=blitz-debug-2026   # Debug endpoint auth
```

## API Endpoints

### Public
- `POST /api/polar/checkout` — Create Polar checkout session
- `POST /api/webhooks/polar` — Polar webhook receiver
- `POST /api/webhooks/clerk` — Clerk webhook receiver
- `GET /api/waitlist` — Check capacity
- `POST /api/waitlist` — Join waitlist

### Protected (requires Clerk auth)
- `GET /api/instances` — List user's instances
- `POST /api/instances` — Create new instance
- `GET /api/billing/balance` — Get current balance
- `POST /api/billing/subscribe` — Start subscription flow

### Internal (requires debug key)
- `GET /api/internal/diagnostics?key=xxx` — Pool and user diagnostics
- `GET /api/internal/diagnostics?key=xxx&email=test` — Search user
- `POST /api/internal/maintain-pool?key=xxx` — Trigger pool maintenance
- `POST /api/internal/cleanup-orphans?key=xxx` — Clean orphaned servers

### Token Proxy
- `POST /api/proxy/v1/messages` — Anthropic Messages API proxy (instance auth via x-api-key)

## Internal Maintenance

```bash
# Check pool status
curl "https://www.blitzclaw.com/api/internal/diagnostics?key=blitz-debug-2026" | jq '.pool'

# Search specific user
curl "https://www.blitzclaw.com/api/internal/diagnostics?key=blitz-debug-2026&email=test" | jq '.'

# Trigger pool maintenance (provisions new servers if below min)
curl -X POST "https://www.blitzclaw.com/api/internal/maintain-pool?key=blitz-debug-2026"

# Clean orphaned cloud servers
curl -X POST "https://www.blitzclaw.com/api/internal/cleanup-orphans?key=blitz-debug-2026"
```

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
- [ ] Create API tokens for Hetzner, DigitalOcean, Vultr
- [ ] Upload SSH key to all three cloud providers
- [ ] Pre-provision server pool via maintain-pool endpoint
- [ ] Set up Vercel cron for pool maintenance (optional)

## How It Works

### User Flow

1. **User signs up** via Clerk authentication
2. **Subscribes** to Basic or Pro plan through Polar.sh
3. **Creates instance** — BlitzClaw assigns a pre-provisioned server from the pool
4. **Connects Telegram** — User provides bot token, BlitzClaw configures the instance
5. **Starts chatting** — AI assistant is ready with browser automation capabilities
6. **Usage tracked** — Token proxy meters API calls, sends to Polar for billing

### Server Pool

BlitzClaw maintains a pool of pre-configured servers across multiple cloud providers. When a user creates an instance:

1. An available server is assigned from the pool
2. OpenClaw is configured with user settings (bot token, model preferences)
3. Telegram bot is connected
4. Server status changes from `AVAILABLE` → `ASSIGNED`

This pool-based approach enables **instant provisioning** (seconds vs. minutes for cold starts).

### Cloud-Init Process

When a new server is provisioned:

1. Cloud provider creates VPS with cloud-init YAML
2. Cloud-init installs: Node.js 22, OpenClaw, Chromium, fail2ban
3. Writes configuration to `/root/.openclaw/openclaw.json`
4. Starts OpenClaw as systemd service
5. Calls back to `/api/internal/instance-ready`
6. Server status: `PROVISIONING` → `AVAILABLE`

## Database Schema

Key models:

```prisma
model User {
  id              String    @id
  email           String    @unique
  clerkId         String    @unique
  plan            String?   // "basic" | "pro"
  billingMode     String    // "managed"
  polarCustomerId String?
  balance         Balance?
  instances       Instance[]
}

model Instance {
  id          String   @id
  userId      String
  status      Status   // PROVISIONING | ACTIVE | PAUSED | DELETED
  ipAddress   String?
  proxySecret String   @unique
  model       String?  // AI model override
  channelType String   // TELEGRAM | WHATSAPP | etc.
  usageLogs   UsageLog[]
}

model ServerPool {
  id              String   @id
  hetznerServerId String   // Generic server ID (any provider)
  ipAddress       String
  status          Status   // PROVISIONING | AVAILABLE | ASSIGNED
  provider        Provider // HETZNER | DIGITALOCEAN | VULTR
  assignedTo      String?  // Instance ID
}

model UsageLog {
  id         String   @id
  instanceId String
  model      String
  tokensIn   Int
  tokensOut  Int
  costCents  Int
  timestamp  DateTime
}
```

## Coming Soon

- 📅 **Google Calendar** — Read your schedule, suggest times
- 📁 **Google Drive** — Search and summarize documents
- 🏃 **Health Data** — Apple Health integration
- 💬 **WhatsApp** — Alternative to Telegram
- 🚀 **Codex + GitHub + Vercel** — Build and ship websites via chat

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and tests (`npm run lint && npm run typecheck`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT

---

Built with ⚡ by [2M Ventures](https://2m.vc) · Berlin, Germany
