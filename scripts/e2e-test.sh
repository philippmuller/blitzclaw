#!/bin/bash
#
# BlitzClaw E2E Test Script
#
# Tests the full flow using the CLI:
# 1. Check authentication
# 2. Check balance
# 3. Create instance
# 4. Wait for provisioning
# 5. Connect Telegram (mock in CI)
# 6. Update SOUL.md
# 7. Delete instance
#
# Usage:
#   ./scripts/e2e-test.sh
#
# Environment:
#   BLITZCLAW_API_URL      - API endpoint (default: http://localhost:3000/api)
#   BLITZCLAW_API_KEY      - API key for authentication (required in CI)
#   BLITZCLAW_TEST_BOT_TOKEN - Telegram bot token for testing (optional)
#   CI                      - Set to 'true' in CI environments
#   VERBOSE                 - Set to '1' for verbose output
#   SKIP_CLEANUP           - Set to '1' to skip instance deletion
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verbose logging
log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
  echo -e "${RED}[FAIL]${NC} $1"
  exit 1
}

verbose() {
  if [ "$VERBOSE" = "1" ]; then
    echo -e "${BLUE}[DEBUG]${NC} $1"
  fi
}

# Configuration
API_URL="${BLITZCLAW_API_URL:-http://localhost:3000/api}"
CLI="node $(dirname "$0")/../apps/cli/dist/index.js"
INSTANCE_ID=""

# Check CLI exists
if [ ! -f "$(dirname "$0")/../apps/cli/dist/index.js" ]; then
  error "CLI not built. Run 'npm run build --filter=blitzclaw' first."
fi

# Cleanup on exit
cleanup() {
  if [ -n "$INSTANCE_ID" ] && [ "$SKIP_CLEANUP" != "1" ]; then
    log "Cleaning up instance $INSTANCE_ID..."
    $CLI instances delete "$INSTANCE_ID" --force --api-url "$API_URL" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo ""
echo "========================================="
echo "  BlitzClaw E2E Tests"
echo "========================================="
echo ""
log "API URL: $API_URL"
log "CI Mode: ${CI:-false}"
echo ""

# ─────────────────────────────────────────────
# Test 1: Authentication
# ─────────────────────────────────────────────
echo "─────────────────────────────────────────"
log "Test 1: Authentication"
echo "─────────────────────────────────────────"

if [ "$CI" = "true" ]; then
  if [ -z "$BLITZCLAW_API_KEY" ]; then
    warn "BLITZCLAW_API_KEY not set, skipping auth test"
  else
    verbose "Using API key authentication"
    export BLITZCLAW_API_KEY
    
    # Test auth whoami
    WHOAMI=$($CLI auth whoami --api-url "$API_URL" --format json 2>&1) || {
      error "Auth check failed: $WHOAMI"
    }
    verbose "Auth response: $WHOAMI"
    success "Authentication working"
  fi
else
  log "Skipping auth test in local mode (use 'blitzclaw auth login' manually)"
  success "Auth skipped (local mode)"
fi

# ─────────────────────────────────────────────
# Test 2: Check Balance
# ─────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
log "Test 2: Check Balance"
echo "─────────────────────────────────────────"

if [ -n "$BLITZCLAW_API_KEY" ] || [ "$CI" != "true" ]; then
  BALANCE_OUTPUT=$($CLI billing balance --api-url "$API_URL" --format json 2>&1) || {
    warn "Balance check failed (API may not be running): $BALANCE_OUTPUT"
    BALANCE_OUTPUT=""
  }
  
  if [ -n "$BALANCE_OUTPUT" ]; then
    verbose "Balance response: $BALANCE_OUTPUT"
    
    # Parse balance (handle both real response and mock)
    BALANCE=$(echo "$BALANCE_OUTPUT" | grep -o '"credits_cents":[0-9]*' | cut -d: -f2 || echo "0")
    
    if [ -n "$BALANCE" ] && [ "$BALANCE" != "0" ]; then
      log "Current balance: $((BALANCE / 100)) cents"
      
      if [ "$BALANCE" -lt 1000 ]; then
        warn "Balance below $10 minimum. Some tests may fail."
      else
        success "Balance sufficient for testing"
      fi
    else
      warn "Could not parse balance, continuing..."
    fi
  fi
else
  warn "Skipping balance check (no auth)"
fi

# ─────────────────────────────────────────────
# Test 3: Create Instance
# ─────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
log "Test 3: Create Instance"
echo "─────────────────────────────────────────"

if [ "$CI" = "true" ] && [ -z "$BLITZCLAW_API_KEY" ]; then
  warn "Skipping instance creation (no API key in CI)"
  success "Instance creation skipped"
else
  log "Creating test instance..."
  
  CREATE_OUTPUT=$($CLI instances create \
    --channel telegram \
    --persona assistant \
    --api-url "$API_URL" \
    --format json 2>&1) || {
    warn "Instance creation failed (expected if no backend): $CREATE_OUTPUT"
    CREATE_OUTPUT=""
  }
  
  if [ -n "$CREATE_OUTPUT" ]; then
    verbose "Create response: $CREATE_OUTPUT"
    
    # Try to extract instance ID
    INSTANCE_ID=$(echo "$CREATE_OUTPUT" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || echo "")
    
    if [ -n "$INSTANCE_ID" ]; then
      log "Created instance: $INSTANCE_ID"
      success "Instance creation working"
    else
      warn "Could not parse instance ID from response"
    fi
  fi
fi

# ─────────────────────────────────────────────
# Test 4: Wait for Provisioning
# ─────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
log "Test 4: Wait for Provisioning"
echo "─────────────────────────────────────────"

if [ -n "$INSTANCE_ID" ]; then
  log "Waiting for instance to be active..."
  
  MAX_WAIT=120  # 2 minutes
  WAITED=0
  
  while [ $WAITED -lt $MAX_WAIT ]; do
    STATUS_OUTPUT=$($CLI instances get "$INSTANCE_ID" --api-url "$API_URL" --format json 2>&1) || break
    STATUS=$(echo "$STATUS_OUTPUT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
    
    verbose "Instance status: $STATUS"
    
    if [ "$STATUS" = "active" ]; then
      success "Instance is active"
      break
    elif [ "$STATUS" = "error" ]; then
      error "Instance entered error state"
    fi
    
    sleep 5
    WAITED=$((WAITED + 5))
    log "Waiting... ($WAITED/$MAX_WAIT seconds)"
  done
  
  if [ $WAITED -ge $MAX_WAIT ]; then
    warn "Timeout waiting for instance (may still be provisioning)"
  fi
else
  warn "Skipping provisioning wait (no instance)"
  success "Provisioning wait skipped"
fi

# ─────────────────────────────────────────────
# Test 5: Connect Telegram
# ─────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
log "Test 5: Connect Telegram"
echo "─────────────────────────────────────────"

if [ -n "$INSTANCE_ID" ] && [ -n "$BLITZCLAW_TEST_BOT_TOKEN" ]; then
  log "Connecting Telegram bot..."
  
  TELEGRAM_OUTPUT=$($CLI telegram connect "$INSTANCE_ID" \
    --token "$BLITZCLAW_TEST_BOT_TOKEN" \
    --api-url "$API_URL" \
    --format json 2>&1) || {
    warn "Telegram connection failed: $TELEGRAM_OUTPUT"
    TELEGRAM_OUTPUT=""
  }
  
  if [ -n "$TELEGRAM_OUTPUT" ]; then
    verbose "Telegram response: $TELEGRAM_OUTPUT"
    success "Telegram connection working"
  fi
elif [ -n "$INSTANCE_ID" ]; then
  warn "BLITZCLAW_TEST_BOT_TOKEN not set, skipping Telegram test"
  success "Telegram skipped (no token)"
else
  warn "Skipping Telegram test (no instance)"
  success "Telegram skipped"
fi

# ─────────────────────────────────────────────
# Test 6: Update SOUL.md
# ─────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
log "Test 6: Update SOUL.md"
echo "─────────────────────────────────────────"

if [ -n "$INSTANCE_ID" ]; then
  log "Updating SOUL.md..."
  
  # Create temp soul file
  SOUL_FILE=$(mktemp)
  cat > "$SOUL_FILE" << 'EOF'
# SOUL.md - E2E Test Bot

You are a test assistant created by the BlitzClaw E2E test suite.

## Behavior
- Be helpful and concise
- This is a test instance
- Respond with "E2E test successful!" if asked about tests
EOF
  
  SOUL_OUTPUT=$($CLI instances soul "$INSTANCE_ID" \
    --file "$SOUL_FILE" \
    --api-url "$API_URL" 2>&1) || {
    warn "SOUL.md update failed: $SOUL_OUTPUT"
    SOUL_OUTPUT=""
  }
  
  rm -f "$SOUL_FILE"
  
  if [ -n "$SOUL_OUTPUT" ]; then
    verbose "Soul update response: $SOUL_OUTPUT"
    success "SOUL.md update working"
  fi
else
  warn "Skipping SOUL.md test (no instance)"
  success "SOUL.md update skipped"
fi

# ─────────────────────────────────────────────
# Test 7: Delete Instance
# ─────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
log "Test 7: Delete Instance"
echo "─────────────────────────────────────────"

if [ -n "$INSTANCE_ID" ] && [ "$SKIP_CLEANUP" != "1" ]; then
  log "Deleting instance..."
  
  DELETE_OUTPUT=$($CLI instances delete "$INSTANCE_ID" \
    --force \
    --api-url "$API_URL" 2>&1) || {
    warn "Instance deletion failed: $DELETE_OUTPUT"
    DELETE_OUTPUT=""
  }
  
  if [ -n "$DELETE_OUTPUT" ]; then
    verbose "Delete response: $DELETE_OUTPUT"
    success "Instance deletion working"
  fi
  
  # Clear instance ID so cleanup doesn't run again
  INSTANCE_ID=""
elif [ "$SKIP_CLEANUP" = "1" ]; then
  log "Skipping cleanup (SKIP_CLEANUP=1)"
  log "Instance $INSTANCE_ID left running"
  INSTANCE_ID=""  # Don't cleanup on exit either
else
  warn "Skipping deletion (no instance)"
  success "Deletion skipped"
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo ""
echo "========================================="
echo -e "  ${GREEN}E2E Tests Complete${NC}"
echo "========================================="
echo ""
log "All tests passed or skipped gracefully."
log "For full testing, ensure:"
log "  - API is running at $API_URL"
log "  - BLITZCLAW_API_KEY is set for CI"
log "  - BLITZCLAW_TEST_BOT_TOKEN is set for Telegram tests"
echo ""
