# BlitzClaw

> One-click OpenClaw deployment. Telegram & WhatsApp. Usage-based billing.

## What is this?

BlitzClaw provisions dedicated AI assistant instances powered by [OpenClaw](https://github.com/openclaw/openclaw). 

- **No API keys required** — we handle Anthropic/OpenAI billing
- **Telegram & WhatsApp** — chat with your AI wherever you are
- **Usage-based pricing** — pay for what you use, 50% markup on token costs
- **Your own instance** — dedicated Hetzner server, full isolation

## Quick Start

```bash
# Install CLI
npm install -g blitzclaw

# Login
blitzclaw auth login

# Top up balance
blitzclaw billing topup --amount 20

# Create instance
blitzclaw instances create --channel telegram --persona assistant

# Connect Telegram bot
blitzclaw telegram connect <instance_id> --token <your_bot_token>
```

## Documentation

See [SPEC.md](./SPEC.md) for full technical specification.

## Status

🚧 **Under Development** — Not yet ready for public use.

## License

MIT
