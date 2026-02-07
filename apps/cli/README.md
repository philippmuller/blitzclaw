# BlitzClaw CLI

Command-line interface for [BlitzClaw](https://blitzclaw.com) - one-click OpenClaw deployment.

## Installation

```bash
npm install -g blitzclaw
```

Or use without installing:

```bash
npx blitzclaw
```

## Quick Start

```bash
# Login to your account
blitzclaw auth login

# Check your balance
blitzclaw billing balance

# Create a new instance
blitzclaw instances create --channel telegram --persona assistant

# Connect your Telegram bot
blitzclaw telegram connect <instance_id> --token <bot_token>

# Delete an instance
blitzclaw instances delete <instance_id>
```

## Commands

### Authentication

```bash
# Login (opens browser)
blitzclaw auth login

# Check current user
blitzclaw auth whoami

# Logout
blitzclaw auth logout
```

For CI/scripts, use API key:

```bash
export BLITZCLAW_API_KEY=sk_...
blitzclaw auth whoami
```

### Billing

```bash
# Check balance
blitzclaw billing balance

# Top up (opens checkout page)
blitzclaw billing topup --amount 20

# Get just the URL
blitzclaw billing topup --amount 20 --url-only

# View usage history
blitzclaw billing usage
blitzclaw billing usage --from 2026-01-01 --to 2026-01-31
blitzclaw billing usage --format json
```

### Instances

```bash
# List all instances
blitzclaw instances list

# Create instance
blitzclaw instances create --channel telegram --persona assistant
blitzclaw instances create --channel telegram --persona custom --soul ./SOUL.md

# Get instance details
blitzclaw instances get <id>

# Restart instance
blitzclaw instances restart <id>

# Update SOUL.md
blitzclaw instances soul <id> --file ./SOUL.md
blitzclaw instances soul <id> --edit  # Opens $EDITOR

# View logs
blitzclaw instances logs <id>
blitzclaw instances logs <id> --follow
blitzclaw instances logs <id> --lines 100

# Delete instance
blitzclaw instances delete <id>
blitzclaw instances delete <id> --force  # Skip confirmation
```

### Telegram

```bash
# Connect bot
blitzclaw telegram connect <instance_id> --token <bot_token>

# Validate token (without connecting)
blitzclaw telegram validate --token <bot_token>

# Get bot info
blitzclaw telegram info <instance_id>
```

### Admin (internal use)

```bash
# Server pool status
blitzclaw admin pool status

# Provision servers
blitzclaw admin pool provision --count 5

# Health check
blitzclaw admin health check
```

## Global Options

```bash
--api-url <url>    Override API endpoint
--format <format>  Output format: table, json, yaml
-q, --quiet        Suppress non-essential output
-v, --verbose      Show debug output
```

## Configuration

Config is stored in `~/.blitzclaw/config.json`:

```json
{
  "apiUrl": "https://api.blitzclaw.com",
  "auth": {
    "token": "...",
    "expiresAt": "2026-02-14T..."
  },
  "defaults": {
    "format": "table"
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BLITZCLAW_API_KEY` | API key for authentication (bypasses login) |
| `BLITZCLAW_API_URL` | Override API endpoint |

## Examples

### Create and configure an instance

```bash
#!/bin/bash

# Create instance
INSTANCE=$(blitzclaw instances create \
  --channel telegram \
  --persona assistant \
  --format json | jq -r '.id')

echo "Created instance: $INSTANCE"

# Wait for provisioning
sleep 30

# Check status
blitzclaw instances get $INSTANCE

# Connect Telegram
blitzclaw telegram connect $INSTANCE --token "$BOT_TOKEN"

echo "Done! Chat with your bot on Telegram."
```

### CI/CD deployment

```bash
#!/bin/bash
export BLITZCLAW_API_KEY=$BLITZCLAW_API_KEY

# Check balance
BALANCE=$(blitzclaw billing balance --format json | jq '.credits_cents')
if [ "$BALANCE" -lt 1000 ]; then
  echo "Low balance, topping up..."
  blitzclaw billing topup --amount 20 --url-only
  exit 1
fi

# List instances
blitzclaw instances list --format json
```

## License

MIT
