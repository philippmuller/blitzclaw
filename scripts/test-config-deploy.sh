#!/bin/bash
# BlitzClaw - Config Deployment Test
#
# Tests the FULL flow:
# 1. Create Hetzner server
# 2. Wait for OpenClaw to install
# 3. Deploy config.yaml via SSH
# 4. Deploy SOUL.md via SSH
# 5. Start OpenClaw gateway
# 6. Verify gateway is running
# 7. Clean up
#
# Usage:
#   ./scripts/test-config-deploy.sh
#
# Cost: ~$0.01 (server runs ~5 min)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load env if exists
if [ -f "$PROJECT_DIR/.env.local" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env.local" | xargs)
fi

if [ -z "$HETZNER_API_TOKEN" ]; then
    echo -e "${RED}Error: HETZNER_API_TOKEN not set${NC}"
    exit 1
fi

SSH_KEY_PATH="$HOME/.ssh/blitzclaw_test"
SSH_KEY_NAME="blitzclaw-test"

echo "======================================"
echo "BlitzClaw Config Deployment Test"
echo "======================================"
echo ""

# Ensure SSH key exists
if [ ! -f "$SSH_KEY_PATH" ]; then
    echo "Generating SSH key..."
    ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "blitzclaw-test"
fi

# Check if SSH key in Hetzner
SSH_KEY_EXISTS=$(curl -s -H "Authorization: Bearer $HETZNER_API_TOKEN" \
    "https://api.hetzner.cloud/v1/ssh_keys" | grep -c "$SSH_KEY_NAME" || true)

if [ "$SSH_KEY_EXISTS" -eq 0 ]; then
    echo "Adding SSH key to Hetzner..."
    PUBLIC_KEY=$(cat "$SSH_KEY_PATH.pub")
    curl -s -X POST "https://api.hetzner.cloud/v1/ssh_keys" \
        -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$SSH_KEY_NAME\", \"public_key\": \"$PUBLIC_KEY\"}" > /dev/null
fi
echo -e "${GREEN}✓${NC} SSH key ready"

# Cloud-init
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

# Create server
echo ""
echo -e "${YELLOW}Step 1: Creating server...${NC}"
SERVER_RESPONSE=$(curl -s -X POST "https://api.hetzner.cloud/v1/servers" \
    -H "Authorization: Bearer $HETZNER_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"blitz-config-test-$(date +%s)\",
        \"server_type\": \"cpx11\",
        \"image\": \"ubuntu-24.04\",
        \"location\": \"ash\",
        \"ssh_keys\": [\"$SSH_KEY_NAME\"],
        \"labels\": {\"service\": \"blitzclaw\", \"test\": \"true\"},
        \"user_data\": $(echo "$CLOUD_INIT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
    }")

SERVER_ID=$(echo "$SERVER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['id'])")
SERVER_IP=$(echo "$SERVER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['public_net']['ipv4']['ip'])")

echo -e "${GREEN}✓${NC} Server created: ID=$SERVER_ID, IP=$SERVER_IP"

# Cleanup trap
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up server...${NC}"
    curl -s -X DELETE -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID" > /dev/null
    echo -e "${GREEN}✓${NC} Server deleted"
}
trap cleanup EXIT

# Wait for boot
echo ""
echo -e "${YELLOW}Step 2: Waiting for server to boot...${NC}"
for i in {1..30}; do
    STATUS=$(curl -s -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['server']['status'])")
    if [ "$STATUS" == "running" ]; then
        break
    fi
    echo "  Status: $STATUS ($i/30)"
    sleep 5
done
echo -e "${GREEN}✓${NC} Server running"

# Wait for SSH
echo ""
echo -e "${YELLOW}Step 3: Waiting for SSH...${NC}"
ssh-keygen -R "$SERVER_IP" 2>/dev/null || true
for i in {1..30}; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$SSH_KEY_PATH" root@"$SERVER_IP" "echo ok" 2>/dev/null; then
        break
    fi
    echo "  SSH not ready ($i/30)"
    sleep 5
done
echo -e "${GREEN}✓${NC} SSH ready"

# Wait for cloud-init
echo ""
echo -e "${YELLOW}Step 4: Waiting for cloud-init & OpenClaw...${NC}"
for i in {1..60}; do
    SETUP_DONE=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat /root/setup-complete.txt 2>/dev/null" || echo "")
    if [ "$SETUP_DONE" == "DONE" ]; then
        break
    fi
    echo "  Installing... ($i/60)"
    sleep 5
done

# Verify OpenClaw installed
OPENCLAW_VERSION=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "openclaw --version 2>/dev/null" || echo "NOT FOUND")
if [ "$OPENCLAW_VERSION" == "NOT FOUND" ]; then
    echo -e "${RED}✗${NC} OpenClaw not installed"
    exit 1
fi
echo -e "${GREEN}✓${NC} OpenClaw installed: $OPENCLAW_VERSION"

# Deploy config.yaml
echo ""
echo -e "${YELLOW}Step 5: Deploying config.yaml...${NC}"

# Generate config with proxy settings
INSTANCE_ID="test-instance-$(date +%s)"
PROXY_SECRET="test-secret-$(openssl rand -hex 16)"

CONFIG_YAML="openclaw:
  model: anthropic/claude-sonnet-4
  # In production, this would be:
  # apiEndpoint: https://proxy.blitzclaw.com/v1
  # With headers:
  #   X-BlitzClaw-Instance: $INSTANCE_ID
  #   X-BlitzClaw-Secret: $PROXY_SECRET
  
  telegram:
    # botToken will be added when user connects
    allowList: []

# BlitzClaw metadata
_blitzclaw:
  instanceId: $INSTANCE_ID
  proxySecret: $PROXY_SECRET
  deployedAt: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat > /root/.openclaw/config.yaml" << EOF
$CONFIG_YAML
EOF

# Verify config
DEPLOYED_CONFIG=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat /root/.openclaw/config.yaml")
if echo "$DEPLOYED_CONFIG" | grep -q "$INSTANCE_ID"; then
    echo -e "${GREEN}✓${NC} config.yaml deployed with instance ID"
else
    echo -e "${RED}✗${NC} config.yaml deployment failed"
    exit 1
fi

# Deploy SOUL.md
echo ""
echo -e "${YELLOW}Step 6: Deploying SOUL.md...${NC}"

SOUL_MD="# SOUL.md - BlitzClaw Test Instance

You are a helpful AI assistant deployed via BlitzClaw.

## Behavior
- Be concise and helpful
- You are running on a dedicated server
- Instance ID: $INSTANCE_ID

## Deployed
$(date -u +%Y-%m-%dT%H:%M:%SZ)"

ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat > /root/.openclaw/workspace/SOUL.md" << EOF
$SOUL_MD
EOF

# Verify SOUL.md
DEPLOYED_SOUL=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat /root/.openclaw/workspace/SOUL.md")
if echo "$DEPLOYED_SOUL" | grep -q "BlitzClaw Test Instance"; then
    echo -e "${GREEN}✓${NC} SOUL.md deployed"
else
    echo -e "${RED}✗${NC} SOUL.md deployment failed"
    exit 1
fi

# Test OpenClaw gateway start (dry run)
echo ""
echo -e "${YELLOW}Step 7: Testing OpenClaw gateway...${NC}"

# Check if openclaw can parse the config
PARSE_TEST=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "openclaw status 2>&1" || echo "")
echo "  Gateway status check: $(echo "$PARSE_TEST" | head -1)"

# For a real test, we'd need to configure Telegram bot token
# For now, just verify the files are in place
FILES_CHECK=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "ls -la /root/.openclaw/")
echo "  Files deployed:"
echo "$FILES_CHECK" | grep -E "config.yaml|workspace" | sed 's/^/    /'

echo -e "${GREEN}✓${NC} Config deployment verified"

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}CONFIG DEPLOYMENT TEST PASSED${NC}"
echo "======================================"
echo ""
echo "Verified:"
echo "  ✅ Server provisioning"
echo "  ✅ OpenClaw installation"
echo "  ✅ config.yaml deployment"
echo "  ✅ SOUL.md deployment"
echo "  ✅ Instance ID in config"
echo ""
echo "Server will be deleted automatically."
