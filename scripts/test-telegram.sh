#!/bin/bash
# BlitzClaw - Telegram Integration Tests
#
# Tests:
# - Token validation (invalid token)
# - Token format checking
# - Bot info retrieval (if valid token provided)
#
# Usage:
#   ./scripts/test-telegram.sh
#   ./scripts/test-telegram.sh <real_bot_token>  # Optional: test with real token

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "BlitzClaw Telegram Integration Tests"
echo "======================================"
echo ""

PASSED=0
FAILED=0

# Test 1: Invalid token format
echo -e "${YELLOW}Test 1: Invalid token format${NC}"
RESPONSE=$(curl -s "https://api.telegram.org/botinvalid_token_123/getMe")
if echo "$RESPONSE" | grep -q '"ok":false'; then
    echo -e "${GREEN}✅${NC} Invalid token correctly rejected"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Expected rejection for invalid token"
    ((FAILED++))
fi
echo "   Response: $(echo $RESPONSE | head -c 100)..."
echo ""

# Test 2: Malformed token (no colon)
echo -e "${YELLOW}Test 2: Malformed token (missing colon)${NC}"
RESPONSE=$(curl -s "https://api.telegram.org/bot123456789/getMe")
if echo "$RESPONSE" | grep -q '"ok":false'; then
    echo -e "${GREEN}✅${NC} Malformed token correctly rejected"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Expected rejection for malformed token"
    ((FAILED++))
fi
echo "   Response: $(echo $RESPONSE | head -c 100)..."
echo ""

# Test 3: Well-formed but fake token
echo -e "${YELLOW}Test 3: Well-formed but invalid token${NC}"
RESPONSE=$(curl -s "https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/getMe")
if echo "$RESPONSE" | grep -q '"ok":false'; then
    echo -e "${GREEN}✅${NC} Fake token correctly rejected"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Expected rejection for fake token"
    ((FAILED++))
fi
echo "   Error code: $(echo $RESPONSE | grep -oP '"error_code":\K\d+')"
echo ""

# Test 4: Token format validation (local)
echo -e "${YELLOW}Test 4: Token format regex validation${NC}"
validate_format() {
    if [[ $1 =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
        return 0
    else
        return 1
    fi
}

VALID_FORMAT="123456789:ABCdef_123-xyz"
INVALID_FORMAT1="notavalidtoken"
INVALID_FORMAT2="123456789"
INVALID_FORMAT3=":ABCdef_123"

ALL_FORMAT_PASS=true

if validate_format "$VALID_FORMAT"; then
    echo "   ✓ Valid format accepted: $VALID_FORMAT"
else
    echo "   ✗ Valid format rejected (should accept)"
    ALL_FORMAT_PASS=false
fi

if ! validate_format "$INVALID_FORMAT1"; then
    echo "   ✓ Invalid format rejected: $INVALID_FORMAT1"
else
    echo "   ✗ Invalid format accepted (should reject)"
    ALL_FORMAT_PASS=false
fi

if ! validate_format "$INVALID_FORMAT2"; then
    echo "   ✓ Invalid format rejected: $INVALID_FORMAT2"
else
    echo "   ✗ Invalid format accepted (should reject)"
    ALL_FORMAT_PASS=false
fi

if ! validate_format "$INVALID_FORMAT3"; then
    echo "   ✓ Invalid format rejected: $INVALID_FORMAT3"
else
    echo "   ✗ Invalid format accepted (should reject)"
    ALL_FORMAT_PASS=false
fi

if $ALL_FORMAT_PASS; then
    echo -e "${GREEN}✅${NC} All format validations passed"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Some format validations failed"
    ((FAILED++))
fi
echo ""

# Test 5: Real token (if provided)
if [ -n "$1" ]; then
    echo -e "${YELLOW}Test 5: Real bot token validation${NC}"
    RESPONSE=$(curl -s "https://api.telegram.org/bot$1/getMe")
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        BOT_USERNAME=$(echo "$RESPONSE" | grep -oP '"username":"\K[^"]+')
        BOT_NAME=$(echo "$RESPONSE" | grep -oP '"first_name":"\K[^"]+')
        echo -e "${GREEN}✅${NC} Real token validated successfully"
        echo "   Bot: @$BOT_USERNAME ($BOT_NAME)"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} Real token validation failed"
        echo "   Response: $RESPONSE"
        ((FAILED++))
    fi
    echo ""
else
    echo -e "${YELLOW}Skipping real token test (no token provided)${NC}"
    echo "   Run with: ./test-telegram.sh <your_bot_token>"
    echo ""
fi

# Summary
echo "======================================"
TOTAL=$((PASSED + FAILED))
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}ALL TESTS PASSED ($PASSED/$TOTAL)${NC}"
else
    echo -e "${RED}SOME TESTS FAILED ($PASSED/$TOTAL passed)${NC}"
    exit 1
fi
echo "======================================"
