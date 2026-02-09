/**
 * Creem API client for BlitzClaw billing
 */

import crypto from "crypto";

const CREEM_API_KEY = process.env.CREEM_API_KEY;
const CREEM_API_URL = process.env.CREEM_API_URL || "https://api.creem.io/v1";

function getCreemHeaders() {
  if (!CREEM_API_KEY) {
    throw new Error("CREEM_API_KEY not configured");
  }

  return {
    "Content-Type": "application/json",
    "x-api-key": CREEM_API_KEY,
  };
}

async function creemFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${CREEM_API_URL}${path}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getCreemHeaders(),
      ...(options.headers || {}),
    },
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`Creem API error ${response.status}:`, responseText);
    throw new Error(`Creem API error ${response.status}: ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : ({} as T);
}

export interface CreemCheckoutOptions {
  productId: string;
  successUrl: string;
  customData?: Record<string, string>;
  customerEmail?: string;
}

export interface CreemCheckoutResponse {
  checkout_url: string;
  id: string;
}

export async function createCreemCheckout(options: CreemCheckoutOptions): Promise<{ checkoutUrl: string }> {
  const payload: Record<string, unknown> = {
    product_id: options.productId,
    success_url: options.successUrl,
  };

  if (options.customData) {
    payload.metadata = options.customData;
  }

  if (options.customerEmail) {
    payload.customer_email = options.customerEmail;
  }

  const response = await creemFetch<CreemCheckoutResponse>("/checkouts", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const checkoutUrl = response.checkout_url;
  if (!checkoutUrl) {
    throw new Error("No checkout URL returned by Creem");
  }

  return { checkoutUrl };
}

export async function getCreemProduct(productId: string) {
  return creemFetch<{ id: string; name: string; price: number; currency: string }>(
    `/products/${productId}`
  );
}

/**
 * Cancel a Creem subscription
 */
export async function cancelCreemSubscription(subscriptionId: string): Promise<void> {
  await creemFetch(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function verifyCreemWebhook(payload: string, signatureHeader: string | null): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  
  if (!secret) {
    console.warn("CREEM_WEBHOOK_SECRET not set, skipping verification");
    return true;
  }

  if (!signatureHeader) {
    return false;
  }

  // Creem uses HMAC-SHA256
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// Tier configuration
export const TIERS = {
  byok: {
    name: "BYOK",
    priceEur: 14,
    creditsCents: 0, // BYOK users don't use credits - they pay Anthropic directly
    productIdEnv: "CREEM_PRODUCT_BYOK",
  },
  basic: {
    name: "Basic",
    priceEur: 20,
    creditsCents: 1000, // €10
    productIdEnv: "CREEM_SUBSCRIPTION_PRODUCT_ID",
  },
  pro: {
    name: "Pro", 
    priceEur: 120,
    creditsCents: 11000, // €110
    productIdEnv: "CREEM_SUBSCRIPTION_PRO_PRODUCT_ID",
  },
} as const;

export type TierKey = keyof typeof TIERS;

export function getTierProductId(tier: TierKey): string | undefined {
  const tierConfig = TIERS[tier];
  return process.env[tierConfig.productIdEnv];
}

export function getTierCredits(tier: TierKey): number {
  return TIERS[tier].creditsCents;
}
