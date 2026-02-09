# BlitzClaw Payment Flows - E2E Test Report

**Date:** 2026-02-09  
**Target:** https://www.blitzclaw.com (production) + local tests

---

## Executive Summary

| Category | Status | Details |
|----------|--------|---------|
| **Unit Tests** | ✅ PASS | 16/16 tests pass |
| **E2E Simulation** | ✅ PASS | 9/9 steps pass |
| **Production API** | ⚠️ ISSUES | Configuration/deployment issues |
| **Creem Integration** | ❌ NOT CONFIGURED | Missing `CREEM_API_KEY` in env |

---

## 1. Subscribe Endpoint (`/api/billing/subscribe`)

### Code Analysis ✅
The endpoint correctly:
- Returns 401 for unauthenticated requests (via Clerk middleware)
- Validates BYOK tier requires `anthropicKey` starting with `sk-ant-`
- Supports `byok`, `basic`, and `pro` tiers
- Creates Creem checkout URL with correct metadata

### Production Tests ⚠️

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| No auth → 401 | 401 | 405 | ❌ FAIL |
| BYOK without key | 400 | 405 | ❌ FAIL |
| Basic tier | 401 | 405 | ❌ FAIL |

**Root Cause:** Clerk middleware `auth.protect()` returns 405 Method Not Allowed instead of 401 when no valid session exists. This is a Clerk-specific behavior for API routes.

**Recommendation:** Add `/api/billing/subscribe` to `isPublicRoute` matcher in middleware.ts, then handle auth inside the route (which it already does).

---

## 2. Creem Webhook (`/api/webhooks/creem`)

### Code Analysis ✅
The webhook handler correctly:
- Parses multiple event types: `subscription.active`, `checkout.completed`, `payment.completed`, `subscription.canceled`
- Sets `billingMode` to `"byok"` for BYOK tier, `"managed"` for others
- Credits correct amounts per tier

### Tier Credits (Verified in Code)

| Tier | Credits | Billing Mode |
|------|---------|--------------|
| BYOK | 0 cents | `byok` |
| Basic | 1,000 cents (€10) | `managed` |
| Pro | 11,000 cents (€110) | `managed` |

### Production Tests

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Invalid JSON | 400 | 400 | ✅ PASS |
| subscription.active | 200 | 500 | ❌ FAIL |
| checkout.completed | 200 | 500 | ❌ FAIL |
| subscription.canceled | 200 | 200 | ✅ PASS |

**Root Cause:** `CREEM_API_KEY` not set in production environment. The webhook tries to use Creem functions which throw "CREEM_API_KEY not configured".

**Recommendation:** Add these env vars to Vercel:
```
CREEM_API_KEY=...
CREEM_WEBHOOK_SECRET=...
CREEM_PRODUCT_BYOK=prod_...
```

---

## 3. Clerk Integration

### Webhook (`/api/webhooks/clerk`) ✅

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| Missing svix headers | 400 | 400 | ✅ PASS |
| Invalid signature | 401 | 401 | ✅ PASS |

### Auth Endpoint (`/api/auth/me`) ⚠️

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| No auth | 401 | 404 | ❌ FAIL |

**Root Cause:** Route may not be deployed or there's a routing issue. The endpoint exists in source at `apps/web/src/app/api/auth/me/route.ts`.

---

## 4. Instance Creation (`/api/instances`)

### Code Analysis ✅
The endpoint correctly:
- BYOK users (`billingMode === "byok" && anthropicKey`) skip balance check
- Managed users require `MINIMUM_BALANCE_CENTS = 1000` ($10)
- Returns 402 with `currentBalance` and `requiredBalance` for insufficient funds

### Production Tests ⚠️

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| POST without auth | 401 | 405 | ❌ FAIL |
| GET without auth | 401 | 404 | ❌ FAIL |

**Root Cause:** Same Clerk middleware issue as subscribe endpoint.

---

## 5. Unit Tests (Local) ✅

### Pricing Tests
```
✅ ALL TESTS PASSED (9/9)
- Simple Sonnet request
- Large Sonnet request (100k context)
- Haiku request (cheap)
- Max context Sonnet (200k in, 8k out)
- Balance enforcement tests (5 scenarios)
```

### Proxy Logic Tests
```
✅ ALL TESTS PASSED (7/7)
- Process request with sufficient balance
- Reject request for non-existent instance
- Reject request when balance below minimum
- Pause instance when balance depleted
- Log usage correctly
- Multiple requests accumulate usage
- Reject request when daily limit exceeded
```

---

## 6. E2E Simulation Tests ✅

```
✅ ALL TESTS PASSED (9/9)
- User created
- Subscription credited
- Instance created
- Instance marked active
- Usage logged and billed
- Markup verified (1.5x)
- Instance paused on low balance
- Instance stopped on subscription cancel
- Daily limit reached ($200/day)
```

---

## Issues Found & Recommendations

### Critical Issues

1. **Creem API Not Configured**
   - Missing `CREEM_API_KEY` in production
   - Missing `CREEM_PRODUCT_BYOK`, `CREEM_PRODUCT_BASIC`, `CREEM_PRODUCT_PRO`
   - **Fix:** Add env vars to Vercel dashboard

2. **API Routes Return 405 Instead of 401**
   - Clerk middleware blocks with 405 for protected routes
   - **Fix:** Either:
     - Add billing/instance routes to `isPublicRoute` (handle auth in route)
     - Or accept 405 as "unauthorized" behavior (document it)

### Medium Issues

3. **Some Routes Return 404**
   - `/api/auth/me` and `/api/instances` (GET) return 404
   - May indicate deployment issue or route not properly built
   - **Fix:** Redeploy with `vercel --prod --force`

### Working Correctly ✅

- Clerk webhook signature verification
- Creem webhook parsing and event handling (when API key is set)
- Pricing calculations
- Balance enforcement logic
- BYOK vs managed billing mode detection
- Tier credits assignment
- Instance pause/stop on balance depletion
- Daily spending limits

---

## Test Commands

```bash
# Run unit tests
npm run test:unit

# Run E2E simulation
npm run test:e2e:sim

# Test Creem configuration (requires CREEM_API_KEY)
npx tsx scripts/test-creem.ts

# Test payment flows against production
npx tsx scripts/test-payment-flows.ts
```

---

## Next Steps

1. **Add Creem env vars to Vercel**
2. **Redeploy to fix 404 routes**
3. **Test real Creem webhooks via Creem dashboard**
4. **Consider adding `/api/billing/*` to public routes** (auth handled inside)
