import { createHmac, timingSafeEqual } from "crypto";

export const BROWSER_RELAY_TOKEN_VALIDITY_MS = 30 * 60 * 1000;
const TOKEN_PREFIX = "brc_";
const SIGNATURE_LENGTH = 16;

export type BrowserRelayTokenValidationResult =
  | { valid: true; instanceId: string; expiresAt: number }
  | { valid: false; error: string };

function getTokenSecret(): string {
  return process.env.BROWSER_RELAY_SECRET || "blitzclaw-relay-secret-change-in-prod";
}

function signPayload(payload: string): string {
  return createHmac("sha256", getTokenSecret()).update(payload).digest("base64url").slice(0, SIGNATURE_LENGTH);
}

function toSafeBuffer(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

export function generateBrowserRelayToken(instanceId: string, now = Date.now()): string {
  const expiresAt = now + BROWSER_RELAY_TOKEN_VALIDITY_MS;
  const payload = `${instanceId}:${expiresAt}`;
  const signature = signPayload(payload);
  const tokenData = Buffer.from(`${payload}:${signature}`).toString("base64url");
  return `${TOKEN_PREFIX}${tokenData}`;
}

export function validateBrowserRelayToken(token: string, now = Date.now()): BrowserRelayTokenValidationResult {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return { valid: false, error: "Invalid token format" };
  }

  try {
    const tokenData = Buffer.from(token.slice(TOKEN_PREFIX.length), "base64url").toString();
    const parts = tokenData.split(":");
    if (parts.length < 3) {
      return { valid: false, error: "Invalid token structure" };
    }

    const providedSig = parts.pop();
    const expiresAtStr = parts.pop();
    const instanceId = parts.join(":");
    if (!providedSig || !expiresAtStr || !instanceId) {
      return { valid: false, error: "Invalid token structure" };
    }

    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      return { valid: false, error: "Invalid token expiry" };
    }

    if (now > expiresAt) {
      return { valid: false, error: "Token expired" };
    }

    const payload = `${instanceId}:${expiresAtStr}`;
    const expectedSig = signPayload(payload);

    const providedBuffer = toSafeBuffer(providedSig);
    const expectedBuffer = toSafeBuffer(expectedSig);
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true, instanceId, expiresAt };
  } catch {
    return { valid: false, error: "Token decode failed" };
  }
}
