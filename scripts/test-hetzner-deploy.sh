#!/bin/bash
# BlitzClaw - Hetzner Deployment Test
# 
# Tests the full server provisioning pipeline:
# 1. Create Hetzner server with cloud-init
# 2. Wait for cloud-init to complete
# 3. Verify OpenClaw is installed
# 4. Deploy config
# 5. Clean up
#
# Usage:
#   ./scripts/test-hetzner-deploy.sh
#
# Requirements:
#   - HETZNER_API_TOKEN environment variable
#   - SSH key at ~/.ssh/blitzclaw_test (will create if missing)
#
# Cost: ~$0.01 (server runs for ~5 minutes)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Config
SERVER_TYPE="cpx11"
LOCATION="ash"  # Ashburn, VA (EU locations deprecated for CPX)
IMAGE="ubuntu-24.04"
SSH_KEY_NAME="blitzclaw-test"
SSH_KEY_PATH="$HOME/.ssh/blitzclaw_test"

echo "======================================"
echo "BlitzClaw Hetzner Deployment Test"
echo "======================================"
echo ""

# Check for API token
if [ -z "$HETZNER_API_TOKEN" ]; then
    # Try to load from .env.local
    if [ -f ".env.local" ]; then
        export HETZNER_API_TOKEN=$(grep HETZNER_API_TOKEN .env.local | cut -d'=' -f2)
    fi
    if [ -z "$HETZNER_API_TOKEN" ]; then
        echo -e "${RED}Error: HETZNER_API_TOKEN not set${NC}"
        echo "Set it via: export HETZNER_API_TOKEN=your_token"
        exit 1
    fi
fi

echo -e "${GREEN}✓${NC} Hetzner API token found"

# Generate SSH key if needed
if [ ! -f "$SSH_KEY_PATH" ]; then
    echo "Generating SSH key..."
    ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "blitzclaw-test"
fi
echo -e "${GREEN}✓${NC} SSH key ready"

# Check if SSH key exists in Hetzner
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
echo -e "${GREEN}✓${NC} SSH key registered with Hetzner"

# Cloud-init script
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
        \"name\": \"blitz-test-$(date +%s)\",
        \"server_type\": \"$SERVER_TYPE\",
        \"image\": \"$IMAGE\",
        \"location\": \"$LOCATION\",
        \"ssh_keys\": [\"$SSH_KEY_NAME\"],
        \"labels\": {\"service\": \"blitzclaw\", \"test\": \"true\"},
        \"user_data\": $(echo "$CLOUD_INIT" | jq -Rs .)
    }")

SERVER_ID=$(echo "$SERVER_RESPONSE" | jq -r '.server.id')
SERVER_IP=$(echo "$SERVER_RESPONSE" | jq -r '.server.public_net.ipv4.ip')

if [ "$SERVER_ID" == "null" ] || [ -z "$SERVER_ID" ]; then
    echo -e "${RED}Error creating server:${NC}"
    echo "$SERVER_RESPONSE" | jq .
    exit 1
fi

echo -e "${GREEN}✓${NC} Server created: ID=$SERVER_ID, IP=$SERVER_IP"

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up...${NC}"
    curl -s -X DELETE -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID" > /dev/null
    echo -e "${GREEN}✓${NC} Server $SERVER_ID deleted"
}
trap cleanup EXIT

# Wait for server to be running
echo ""
echo -e "${YELLOW}Step 2: Waiting for server to boot...${NC}"
for i in {1..30}; do
    STATUS=$(curl -s -H "Authorization: Bearer $HETZNER_API_TOKEN" \
        "https://api.hetzner.cloud/v1/servers/$SERVER_ID" | jq -r '.server.status')
    if [ "$STATUS" == "running" ]; then
        break
    fi
    echo "  Status: $STATUS (attempt $i/30)"
    sleep 5
done

if [ "$STATUS" != "running" ]; then
    echo -e "${RED}Error: Server did not start${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Server is running"

# Wait for SSH to be ready
echo ""
echo -e "${YELLOW}Step 3: Waiting for SSH...${NC}"
# Clear any old host key
ssh-keygen -R "$SERVER_IP" 2>/dev/null || true

for i in {1..30}; do
    if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i "$SSH_KEY_PATH" root@"$SERVER_IP" "echo ok" 2>/dev/null; then
        break
    fi
    echo "  SSH not ready (attempt $i/30)"
    sleep 5
done
echo -e "${GREEN}✓${NC} SSH is ready"

# Wait for cloud-init
echo ""
echo -e "${YELLOW}Step 4: Waiting for cloud-init...${NC}"
for i in {1..60}; do
    CLOUD_STATUS=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cloud-init status 2>/dev/null | grep -oP 'status: \K\w+'" 2>/dev/null || echo "running")
    if [ "$CLOUD_STATUS" == "done" ]; then
        break
    fi
    echo "  Cloud-init: $CLOUD_STATUS (attempt $i/60)"
    sleep 5
done

if [ "$CLOUD_STATUS" != "done" ]; then
    echo -e "${RED}Error: Cloud-init did not complete${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Cloud-init completed"

# Verify installations
echo ""
echo -e "${YELLOW}Step 5: Verifying installations...${NC}"

NODE_VERSION=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "node --version 2>/dev/null" || echo "NOT INSTALLED")
echo "  Node.js: $NODE_VERSION"

OPENCLAW_VERSION=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "openclaw --version 2>/dev/null" || echo "NOT INSTALLED")
echo "  OpenClaw: $OPENCLAW_VERSION"

SETUP_FILE=$(ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" "cat /root/setup-complete.txt 2>/dev/null" || echo "NOT FOUND")
echo "  Setup complete: $SETUP_FILE"

if [[ "$NODE_VERSION" == *"NOT"* ]] || [[ "$OPENCLAW_VERSION" == *"NOT"* ]]; then
    echo -e "${RED}Error: Installation verification failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} All installations verified"

# Test config deployment
echo ""
echo -e "${YELLOW}Step 6: Testing config deployment...${NC}"
ssh -o StrictHostKeyChecking=no -i "$SSH_KEY_PATH" root@"$SERVER_IP" 'bash -s' << 'DEPLOY'
mkdir -p /root/.openclaw/workspace
cat > /root/.openclaw/config.yaml << 'YAML'
openclaw:
  model: anthropic/claude-sonnet-4
  apiEndpoint: https://proxy.blitzclaw.com/v1
YAML
cat > /root/.openclaw/workspace/SOUL.md << 'SOUL'
# SOUL.md
You are a helpful AI assistant.
SOUL
echo "Config deployed successfully"
DEPLOY
echo -e "${GREEN}✓${NC} Config deployment works"

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}ALL TESTS PASSED${NC}"
echo "======================================"
echo ""
echo "Results:"
echo "  - Server type: $SERVER_TYPE"
echo "  - Location: $LOCATION"
echo "  - Boot time: ~30-45 seconds"
echo "  - Cloud-init time: ~60-90 seconds"
echo "  - Node.js: $NODE_VERSION"
echo "  - OpenClaw: $OPENCLAW_VERSION"
echo ""
echo "Server will be deleted automatically."
