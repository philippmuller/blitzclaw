#!/bin/bash
# BlitzClaw - Run All Tests
#
# Usage:
#   ./scripts/test-all.sh           # Run unit tests only (fast)
#   ./scripts/test-all.sh --full    # Include Hetzner deployment test (slow, ~$0.01)
#
# Exit codes:
#   0 = All tests passed
#   1 = Some tests failed

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FULL_TEST=false
if [ "$1" == "--full" ]; then
    FULL_TEST=true
fi

cd "$PROJECT_DIR"

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    BlitzClaw Test Suite              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

PASSED=0
FAILED=0

run_test() {
    local name=$1
    local cmd=$2
    
    echo -e "${YELLOW}▶ $name${NC}"
    if eval "$cmd" > /tmp/test_output.txt 2>&1; then
        echo -e "${GREEN}  ✅ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}  ❌ FAILED${NC}"
        cat /tmp/test_output.txt | tail -10 | sed 's/^/    /'
        ((FAILED++))
    fi
    echo ""
}

# Build test
run_test "Build (npm run build)" "npm run build"

# Type check
run_test "Type check (tsc)" "npm run typecheck 2>/dev/null || npx tsc --noEmit -p apps/web"

# Pricing tests
run_test "Pricing calculations" "npx tsx scripts/test-pricing.ts"

# Telegram tests
run_test "Telegram API validation" "./scripts/test-telegram.sh"

# Database tests
run_test "Database operations" "cd $PROJECT_DIR/packages/db && npx tsx ../../scripts/test-database.ts"

# Proxy logic tests
run_test "Token proxy logic" "cd $PROJECT_DIR/packages/db && npx tsx ../../scripts/test-proxy-logic.ts"

# Hetzner deployment tests (optional)
if $FULL_TEST; then
    echo -e "${YELLOW}▶ Hetzner deployment tests (full)${NC}"
    echo "  These create real servers (~\$0.02 total)"
    if [ -n "$HETZNER_API_TOKEN" ]; then
        run_test "Hetzner server provisioning" "./scripts/test-hetzner-deploy.sh"
        run_test "Config deployment via SSH" "./scripts/test-config-deploy.sh"
    else
        echo -e "${YELLOW}  ⚠ Skipped (HETZNER_API_TOKEN not set)${NC}"
        echo ""
    fi
else
    echo -e "${YELLOW}▶ Hetzner deployment tests${NC}"
    echo -e "  ${YELLOW}⚠ Skipped (use --full to include)${NC}"
    echo ""
fi

# Summary
echo ""
echo -e "${BLUE}══════════════════════════════════════${NC}"
TOTAL=$((PASSED + FAILED))
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED ($PASSED/$TOTAL)${NC}"
    echo -e "${BLUE}══════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED ($PASSED/$TOTAL passed)${NC}"
    echo -e "${BLUE}══════════════════════════════════════${NC}"
    exit 1
fi
