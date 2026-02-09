# BlitzClaw Test Scripts

This directory contains E2E test scripts for BlitzClaw.

## Prerequisites

1. **Environment Variables**: Ensure `.env.local` exists at the project root with:
   - `CLERK_SECRET_KEY` - Clerk backend API key
   - `NEXT_PUBLIC_APP_URL` or `BLITZCLAW_URL` - Target URL (defaults to localhost:3000)

2. **Dependencies**: Run `npm install` from the project root

## Test Scripts

### Authenticated Flow Tests (Recommended)

These tests use real Clerk authentication to test protected API routes.

```bash
# Run the full authenticated test suite
npm run test:auth:flows

# Test just the auth helper (verifies Clerk setup)
npm run test:auth:helper

# Test subscribe endpoint specifically
npx tsx scripts/test-subscribe.ts
```

### What `test:auth:flows` Tests

1. **Authentication**
   - Unauthenticated requests are rejected
   - Authenticated requests return user data

2. **Subscribe Endpoint**
   - BYOK subscription flow (auth → billing logic)
   - BYOK validation (requires `sk-ant-` prefixed key)
   - Basic tier subscription
   - Pro tier subscription

3. **Instance Endpoint**
   - List instances (GET /api/instances)
   - Create instance validation (requires Telegram token)
   - Create instance with token
   - Verify instance appears in list

4. **Billing Endpoints**
   - GET /api/billing/balance
   - GET /api/billing/usage

5. **Account Deletion** (DELETE /api/account/delete)
   - Creates a separate test user with full data setup
   - Verifies Creem subscription cancellation is attempted
   - Verifies Hetzner server deletion is attempted (if server exists)
   - Verifies database cleanup:
     - User record deleted
     - Instance records deleted
     - Balance record deleted
     - Usage logs deleted

### Flags

```bash
# Skip the account deletion test (faster, doesn't create extra Clerk user)
npm run test:auth:flows -- --skip-delete

# Clean up the main test user after testing
npm run test:auth:flows -- --cleanup
```

### Other Test Scripts

```bash
# Database-level E2E simulation (no HTTP, direct Prisma)
npm run test:e2e:sim

# Unit tests (pricing, proxy logic)
npm run test:unit

# Full E2E with Hetzner deployment (costs money!)
npm run test:e2e:full
```

## Test User

The tests create/use a test user in Clerk:
- Email: `blitzclaw-e2e-test@example.com`
- External ID: `blitzclaw_e2e_test_user`

To clean up the test user:
```bash
npm run test:auth:flows -- --cleanup
```

## Architecture

### `test-helpers.ts`
Core authentication utilities:
- `getOrCreateTestUser()` - Creates/finds test user in Clerk
- `getTestUserToken()` - Gets a valid JWT session token (refreshes automatically)
- `authenticatedFetch()` - Wrapper for fetch with Bearer token
- `cleanupTestSession()` - Revokes session after tests

### `test-authenticated-flows.ts`
Main test suite that tests the full user journey:
1. Auth → 2. Subscribe → 3. Create Instance → 4. Verify

### How Clerk Auth Works

1. Create test user in Clerk (or find existing)
2. Create a session for that user via Backend API
3. Get a JWT token from the session (valid 60 seconds)
4. Include token as `Authorization: Bearer <token>` in requests
5. Clerk middleware validates the token and sets `auth().userId`

## Troubleshooting

### "Missing Clerk Secret Key"
Ensure `CLERK_SECRET_KEY` is set in `.env.local` at project root.

### Timeout on localhost
The dev server isn't running. Either:
- Start it: `npm run dev`
- Or test against production: set `BLITZCLAW_URL=https://www.blitzclaw.com`

### "Email address must be valid"
Clerk doesn't accept `.test` TLD. We use `@example.com` instead.
