# BlitzClaw ⚡

> One-click OpenClaw deployment. Telegram & WhatsApp. Usage-based billing.

## What is BlitzClaw?

BlitzClaw provisions dedicated AI assistant instances powered by [OpenClaw](https://github.com/openclaw/openclaw).

- **No API keys required** — we handle Anthropic/OpenAI billing
- **Telegram & WhatsApp** — chat with your AI wherever you are
- **Usage-based pricing** — pay for what you use, 50% markup on token costs
- **Your own instance** — dedicated Hetzner server, full isolation
- **Customizable** — bring your own SOUL.md personality

## Quick Start

### Using the CLI

```bash
# Install CLI
npm install -g blitzclaw

# Login to your account
blitzclaw auth login

# Top up your balance ($20 recommended)
blitzclaw billing topup --amount 20

# Create your first instance
blitzclaw instances create --channel telegram --persona assistant

# Get your Telegram bot token from @BotFather, then:
blitzclaw telegram connect <instance_id> --token <your_bot_token>

# Start chatting! 🎉
```

### Using the Dashboard

1. Sign up at [blitzclaw.com](https://blitzclaw.com)
2. Top up your balance
3. Create an instance
4. Follow the Telegram setup wizard
5. Start chatting with your AI assistant

## Features

| Feature | Status |
|---------|--------|
| Google OAuth signup | ✅ |
| Creem billing (MoR) | ✅ |
| Telegram integration | ✅ |
| Custom SOUL.md | ✅ |
| Persona templates | ✅ |
| Token usage tracking | ✅ |
| WhatsApp integration | 🚧 Phase 2 |
| Bring your own API key | 🚧 Phase 2 |
| Google integrations | 🚧 Phase 2 |

## CLI Commands

```bash
blitzclaw auth login          # Authenticate
blitzclaw auth whoami         # Check current user

blitzclaw billing balance     # Check balance
blitzclaw billing topup       # Add funds
blitzclaw billing usage       # View usage history

blitzclaw instances list      # List your instances
blitzclaw instances create    # Create new instance
blitzclaw instances get <id>  # Get instance details
blitzclaw instances restart   # Restart instance
blitzclaw instances delete    # Delete instance

blitzclaw telegram connect    # Connect Telegram bot
blitzclaw telegram info       # Get bot info
```

See [CLI README](apps/cli/README.md) for full documentation.

## Development

### Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 14+

### Setup

```bash
# Clone repository
git clone https://github.com/blitzclaw/blitzclaw.git
cd blitzclaw

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your values (see docs/DEVELOPMENT.md)

# Setup database
npm run db:generate
npm run db:push

# Start dev server
npm run dev
```

### Project Structure

```
blitzclaw/
├── apps/
│   ├── web/          # Next.js web application
│   └── cli/          # CLI tool
├── packages/
│   └── db/           # Prisma schema & client
├── scripts/          # Utility scripts
└── docs/             # Documentation
```

### Commands

```bash
npm run dev           # Start development server
npm run build         # Build all packages
npm run lint          # Run ESLint
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:studio     # Open Prisma Studio
```

## Documentation

- [Development Guide](docs/DEVELOPMENT.md) — Local setup & contribution
- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment
- [Proxy Architecture](docs/PROXY.md) — Token proxy details
- [Full Spec](SPEC.md) — Technical specification

## Architecture

```
┌─────────────────────────────────────────┐
│            BlitzClaw Platform           │
├─────────────────────────────────────────┤
│  ┌────────┐  ┌─────┐  ┌─────────────┐  │
│  │ Web UI │──│ API │──│ Provisioner │  │
│  └────────┘  └─────┘  └─────────────┘  │
│                 │            │          │
│           ┌─────┴─────┐      │          │
│           ▼           ▼      ▼          │
│       ┌───────┐  ┌───────┐ ┌───────┐   │
│       │ Clerk │  │ Creem │ │Hetzner│   │
│       └───────┘  └───────┘ └───────┘   │
└─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌────────┐    ┌────────┐    ┌────────┐
│Instance│    │Instance│    │Instance│
│ User A │    │ User B │    │ User C │
└───┬────┘    └────────┘    └────────┘
    │
    ▼
┌────────────────┐
│  Token Proxy   │
│ (counts usage) │
└───────┬────────┘
        ▼
┌────────────────┐
│ Anthropic/     │
│ OpenAI         │
└────────────────┘
```

## Pricing

| Item | Cost |
|------|------|
| Base fee | $20/month (includes ~$10 usage) |
| Claude Sonnet 4 | $4.50/$22.50 per 1M tokens (in/out) |
| Claude Haiku | $0.40/$2.00 per 1M tokens (in/out) |
| GPT-4o | $3.75/$15.00 per 1M tokens (in/out) |

~50% markup on provider costs covers infrastructure + operations.

## Status

🚧 **Under Development** — Phase 1 MVP in progress.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and fix issues
5. Submit a pull request

See [Development Guide](docs/DEVELOPMENT.md) for details.

## License

MIT

---

Built with ❤️ by the BlitzClaw team.
