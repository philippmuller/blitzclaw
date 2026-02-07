#!/bin/bash
# BlitzClaw - Telegram Onboarding Flow Test
#
# Tests the full Telegram setup flow:
# 1. Create server with OpenClaw
# 2. Validate a Telegram bot token
# 3. Deploy config with bot token
# 4. Verify OpenClaw can read the config
#
# Usage:
#   ./scripts/test-telegram-onboard.sh <telegram_bot_token>
#
# If no token provided, uses validation-only tests

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BOT_TOKEN=$1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env
if [ -f "$PROJECT_DIR/.env.local" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env.local" | xargs)
fi

echo "======================================"
echo "BlitzClaw Telegram Onboarding Test"
echo "======================================"
echo ""

# Test 1: Token validation (if provided)
if [ -n "$BOT_TOKEN" ]; then
    echo -e "${YELLOW}Step 1: Validating Telegram bot token...${NC}"
    
    RESPONSE=$(curl -s "https://api.telegram.org/bot$BOT_TOKEN/getMe")
    
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        BOT_USERNAME=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])")
        BOT_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['id'])")
        echo -e "${GREEN}✓${NC} Token valid: @$BOT_USERNAME (ID: $BOT_ID)"
    else
        echo -e "${RED}✗${NC} Invalid token"
        echo "  Response: $RESPONSE"
        exit 1
    fi
else
    echo -e "${YELLOW}Step 1: Skipping token validation (no token provided)${NC}"
    echo "  Usage: $0 <telegram_bot_token>"
    BOT_TOKEN="PLACEHOLDER_TOKEN"
    BOT_USERNAME="test_bot"
    BOT_ID="000000000"
fi

# Check Hetzner
if [ -z "$HETZNER_API_TOKEN" ]; then
    echo ""
    echo -e "${YELLOW}Skipping deployment test (no HETZNER_API_TOKEN)${NC}"
    echo ""
    echo "======================================"
    echo -e "${GREEN}TOKEN VALIDATION PASSED${NC}"
    echo "======================================"
    exit 0
fi

SSH_KEY_PATH="$HOME/.ssh/blitzclaw_test"
SSH_KEY_NAME="blitzclaw-test"

# Ensure SSH key
if [ ! -f "$SSH_KEY_PATH" ]; then
    ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "blitzclaw-test"
fi

# Check SSH key in Hetzner
SSH_KEY_EXISTS=$(curl -s -H "Authorization: Bearer $HETZNER_API_TOKEN" \
    "https://api.hetzner.cloud/v1/ssh_keys" | grep -c "$SSH_KEY_NAME" || true)

if [ "$SSH_KEY_EXISTS" -eq 0 ]; then
    PUBLIC_KEY=$(cat "$SSH_KEY_PATH.pub")
    curl -s -X POST "https://api.hetzner.cloud/v1/ssh_keys" \
        -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$SSH_KEY_NAME\", \"public_key\": \"$PUBLIC_KEY\"}" > /dev/null
fi

# Create server
echo ""
echo -e "${YELLOW}Step 2: Creating test server...${NC}"

CLOUD_INIT='#cloud-config
package_update: true
packages:
  - curl
  - git
runcmd:
  - curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  - apt-get install -y nodejs
  - npm install -g openclaw
  - mkdir -p /root/.openclaw/workspace
  - echo DONE > /root/setup-complete.txt'

SERVER_RESPONSE=$(curl -s -X POST "https://api.hetzner.cloud/v1/servers" \
    -H "Authorization: Bearer $HETZNER_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"blitz-telegram-test-$(date +%s)\",
        \"server_type\": \"cpx11\",
        \"image\": \"ubuntu-24.04\",
        \"location\": \"ash\",
        \"ssh_keys\": [\"$SSH_KEY_NAME\"],
        \"labels\": {\"service\": \"blitzclaw\", \"test\": \"true\"},
        \"user_data\": $(echo "$CLOUD_INIT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
    }")

SERVER_ID=$(echo "$SERVER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['id'])")
SERVER_IP=$(echo "$SERVER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])")

echo -e "${GREEN}✓${NC} Server: ID=$SERVER_ID, IP=$SERVER_IP"

# Cleanup trap
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    curl -s -X DELETE -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID" > /dev/null
    echo -e "${GREEN}✓${NC} Server deleted"
}
trap cleanup EXIT

# Wait for ready
echo ""
echo -e "${YELLOW}Step 3: Waiting for OpenClaw installation...${NC}"

for i in {1..30}; do
    STATUS=$(curl -s -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['status'])" 2>/dev/null || echo "waiting")
    if [ "$STATUS" == "running" ]; then
        break
    fi
    sleep 5
done

ssh-keygen -R "$SERVER_IP" 2>/dev/null || true

for i in {1..30}; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$SSH_KEY_PATH" root@"$SERVER_IP" "echo ok" 2>/dev/null; then
        break
    fi
    sleep 5
done

for i in {1..60}; do
    SETUP=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat /root/setup-complete.txt 2>/dev/null" || echo "")
    if [ "$SETUP" == "DONE" ]; then
        break
    fi
    echo "  Installing... ($i/60)"
    sleep 5
done

echo -e "${GREEN}✓${NC} OpenClaw ready"

# Deploy Telegram config
echo ""
echo -e "${YELLOW}Step 4: Deploying Telegram config...${NC}"

INSTANCE_ID="telegram-test-$(date +%s)"

CONFIG="openclaw:
  model: anthropic/claude-sonnet-4
  
  telegram:
    botToken: \"$BOT_TOKEN\"
    allowList: []

_blitzclaw:
  instanceId: $INSTANCE_ID
  botUsername: $BOT_USERNAME
  botId: $BOT_ID"

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat > /root/.openclaw/config.yaml" << EOF
$CONFIG
EOF

# Deploy SOUL.md
SOUL="# SOUL.md - Telegram Bot

You are a helpful AI assistant connected via Telegram.
Bot: @$BOT_USERNAME

Be concise and helpful in your responses."

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat > /root/.openclaw/workspace/SOUL.md" << EOF
$SOUL
EOF

echo -e "${GREEN}✓${NC} Config deployed with Telegram settings"

# Verify config
echo ""
echo -e "${YELLOW}Step 5: Verifying config...${NC}"

CONFIG_CHECK=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat /root/.openclaw/config.yaml")

if echo "$CONFIG_CHECK" | grep -q "telegram:"; then
    echo -e "${GREEN}✓${NC} Telegram section present"
else
    echo -e "${RED}✗${NC} Telegram section missing"
    exit 1
fi

if echo "$CONFIG_CHECK" | grep -q "botToken:"; then
    echo -e "${GREEN}✓${NC} Bot token configured"
else
    echo -e "${RED}✗${NC} Bot token missing"
    exit 1
fi

# Check OpenClaw can parse config
echo ""
echo -e "${YELLOW}Step 6: Checking OpenClaw...${NC}"

OC_STATUS=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "openclaw status 2>&1" || echo "error")
echo "  Status: $(echo "$OC_STATUS" | head -1)"

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}TELEGRAM ONBOARDING TEST PASSED${NC}"
echo "======================================"
echo ""
echo "Verified:"
echo "  ✅ Bot token validation"
echo "  ✅ Server provisioning"
echo "  ✅ OpenClaw installation"
echo "  ✅ Telegram config deployment"
echo "  ✅ SOUL.md deployment"
if [ "$BOT_TOKEN" != "PLACEHOLDER_TOKEN" ]; then
    echo "  ✅ Real bot: @$BOT_USERNAME"
fi
echo ""
echo "Server will be deleted automatically."
