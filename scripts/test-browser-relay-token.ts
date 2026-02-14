#!/usr/bin/env npx tsx

import {
  BROWSER_RELAY_TOKEN_VALIDITY_MS,
  generateBrowserRelayToken,
  validateBrowserRelayToken,
} from "../apps/web/src/lib/browser-relay-token.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const now = Date.now();
  const instanceId = "inst_test_123";
  const token = generateBrowserRelayToken(instanceId, now);

  const valid = validateBrowserRelayToken(token, now + 1000);
  assert(valid.valid === true, "Expected token to validate");
  assert(valid.instanceId === instanceId, "Expected instance id to match");

  const expired = validateBrowserRelayToken(token, now + BROWSER_RELAY_TOKEN_VALIDITY_MS + 10_000);
  assert(expired.valid === false && expired.error === "Token expired", "Expected expired token to fail");

  const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
  const tamperedResult = validateBrowserRelayToken(tampered, now + 1000);
  assert(tamperedResult.valid === false, "Expected tampered token to fail");

  const malformed = validateBrowserRelayToken("brc_not_base64", now);
  assert(malformed.valid === false, "Expected malformed token to fail");

  console.log("Browser relay token tests passed");
}

run();
