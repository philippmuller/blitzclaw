# BlitzClaw Token Proxy

The Token Proxy sits between OpenClaw instances and LLM providers (Anthropic). It:
- Authenticates requests from instances
- Forwards to the real API
- Logs token usage
- Deducts from user balance

## API Endpoints

### `POST /api/proxy/v1/messages`

Proxies requests to Anthropic's Messages API.

**Required Headers:**
```
X-BlitzClaw-Instance: <instance_id>
X-BlitzClaw-Secret: <proxy_secret>
```

**Request Body:** Same as [Anthropic Messages API](https://docs.anthropic.com/en/api/messages)

**Response:** Forwarded Anthropic response

**Error Codes:**
- `401` - Missing or invalid headers
- `402` - Insufficient balance (< $10 minimum)
- `404` - Instance not found
- `502` - Failed to reach Anthropic API

### `GET /api/proxy/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-07T22:00:00.000Z",
  "services": {
    "database": "ok",
    "anthropic": "ok"
  }
}
```

### `GET /api/proxy/test` (Development Only)

Returns test credentials and a curl example for testing the proxy.

### `POST /api/proxy/test` (Development Only)

Calculate cost for a hypothetical request without making an API call.

**Request Body:**
```json
{
  "model": "claude-sonnet-4-20250514",
  "input_tokens": 1000,
  "output_tokens": 500
}
```

## Pricing

We apply a ~50% markup on Anthropic costs:

| Model | Input (per 1M) | Output (per 1M) | Our Price In | Our Price Out |
|-------|----------------|-----------------|--------------|---------------|
| Claude Sonnet 4 | $3.00 | $15.00 | $4.50 | $22.50 |
| Claude 3.5 Haiku | $0.80 | $4.00 | $1.20 | $6.00 |
| Claude 3 Haiku | $0.25 | $1.25 | $0.40 | $2.00 |

## Balance Enforcement

1. **Before Request:** Balance must be >= $10 minimum
2. **After Response:** Cost is deducted from balance
3. **If Balance Depleted:** Instance is paused, user notified

## Request Flow

```
1. Validate X-BlitzClaw-Instance + X-BlitzClaw-Secret headers
2. Look up instance → get user_id
3. Check user balance >= $10 minimum (reject if insufficient)
4. Forward request to Anthropic (use ANTHROPIC_API_KEY from env)
5. Parse response for usage.input_tokens + usage.output_tokens
6. Calculate cost (with 50% markup)
7. Deduct from user balance (atomic transaction)
8. Log to usage_logs table
9. If balance goes negative → pause instance
10. Return response to instance
```

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...
PROXY_SIGNING_SECRET=<random-64-char-hex>

# Optional
NODE_ENV=development  # Enables mock responses when no API key
```

## Testing

### 1. Start the dev server

```bash
cd apps/web
npm run dev
```

### 2. Get test credentials

```bash
curl http://localhost:3000/api/proxy/test | jq .
```

This creates a test user with $50 balance and a test instance.

### 3. Make a test request

```bash
curl -X POST http://localhost:3000/api/proxy/v1/messages \
  -H "Content-Type: application/json" \
  -H "X-BlitzClaw-Instance: <instance_id from step 2>" \
  -H "X-BlitzClaw-Secret: <secret from step 2>" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

In development without a real Anthropic key, you'll get a mock response.

### 4. Check usage logs

```bash
# Via Prisma Studio
npx prisma studio
```

## OpenClaw Instance Configuration

When deploying to instances, configure OpenClaw to use the proxy:

```yaml
# config.yaml
openclaw:
  model: anthropic/claude-sonnet-4
  apiEndpoint: https://api.blitzclaw.com/api/proxy/v1
  
  headers:
    X-BlitzClaw-Instance: ${INSTANCE_ID}
    X-BlitzClaw-Secret: ${PROXY_SECRET}
```

The cloud-init script (in `lib/cloud-init.ts`) generates this configuration automatically.
