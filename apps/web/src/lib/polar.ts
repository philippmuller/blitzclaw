/**
 * Polar.sh API client for BlitzClaw billing
 * 
 * Handles:
 * - Checkout session creation
 * - Usage tracking (metering)
 * - Customer management
 */

import { Polar } from "@polar-sh/sdk";
import crypto from "crypto";

// Determine environment - use sandbox unless explicitly production
const IS_SANDBOX = process.env.POLAR_SANDBOX !== "false";
const POLAR_SERVER = IS_SANDBOX ? "sandbox" : "production";

// Initialize Polar client
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: POLAR_SERVER,
});

// Product IDs from Polar dashboard (sandbox vs production)
export const POLAR_PRODUCTS = {
  basic: process.env.POLAR_PRODUCT_BASIC_ID,
  pro: process.env.POLAR_PRODUCT_PRO_ID,
};

export type PlanType = "basic" | "pro";

/**
 * Create a Polar checkout session
 */
export async function createCheckout(options: {
  productId: string;
  successUrl: string;
  customerEmail?: string;
  externalCustomerId: string;
  metadata?: Record<string, string>;
}) {
  // Only include email if it's a real email (Polar validates strictly)
  // Skip placeholder/pending emails
  const shouldIncludeEmail = options.customerEmail && 
    !options.customerEmail.includes("@pending.") &&
    !options.customerEmail.includes("@example.");

  const checkout = await polar.checkouts.create({
    products: [options.productId], // SDK uses products array
    successUrl: options.successUrl,
    ...(shouldIncludeEmail && { customerEmail: options.customerEmail }),
    metadata: options.metadata,
    // Link to our user ID for webhook correlation
    externalCustomerId: options.externalCustomerId,
  });
  
  return checkout;
}

/**
 * Track AI usage for a customer
 * Only call this for managed billing users (not BYOK)
 * 
 * IMPORTANT: The event name and property must match the meter configuration:
 * - Meter filter: event name = "ai_usage"  
 * - Aggregation: sum of property "credits_used"
 * 
 * @param externalCustomerId - Our internal user ID (used as external_customer_id in Polar)
 * @param credits - Usage in credits (1 credit = $0.01)
 * @param metadata - Additional info (model, tokens, etc.)
 */
export async function trackUsage(
  externalCustomerId: string,
  credits: number,
  metadata?: Record<string, string | number>
) {
  const eventData = {
    name: "ai_usage", // Must match meter filter
    externalCustomerId,
    metadata: {
      event: "ai_usage", // Meter filter looks for metadata.event
      credits_used: credits, // This is what the meter sums
      timestamp: Date.now(),
      ...metadata,
    },
  };
  
  console.log(`📊 Sending to Polar [${polarConfig.server}]:`, JSON.stringify(eventData));
  
  try {
    const response = await polar.events.ingest({
      events: [eventData],
    });
    console.log(`📊 Polar response:`, JSON.stringify(response));
    console.log(`📊 Tracked ${credits} credits for user ${externalCustomerId}`);
  } catch (error) {
    console.error("❌ Failed to track usage with Polar:", error);
    console.error("❌ Event data was:", JSON.stringify(eventData));
    // Don't throw - usage tracking failure shouldn't break the API call
  }
}

/**
 * Calculate cost in credits (cents) for an API call
 * Includes 100% markup on Anthropic pricing
 * 
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens  
 * @param model - Model name
 * @returns Cost in credits (cents)
 */
export function calculateCredits(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  // Anthropic pricing per 1M tokens (in dollars)
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4": { input: 3, output: 15 },
    "claude-sonnet-4-5": { input: 3, output: 15 },
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
    "claude-haiku-4-5": { input: 1, output: 5 },
    "claude-3-5-haiku-20241022": { input: 1, output: 5 },
    "claude-opus-4": { input: 15, output: 75 },
    "claude-opus-4-5": { input: 15, output: 75 },
    "claude-3-opus-20240229": { input: 15, output: 75 },
  };

  // Default to Sonnet pricing if model not found
  const p = pricing[model] || pricing["claude-sonnet-4"];

  // Calculate raw cost in dollars
  const rawCost =
    (inputTokens / 1_000_000) * p.input +
    (outputTokens / 1_000_000) * p.output;

  // Convert to cents and add 100% markup
  const creditsWithMarkup = Math.ceil(rawCost * 100 * 2);

  // Minimum 1 credit per request
  return Math.max(1, creditsWithMarkup);
}

/**
 * Get customer by external ID (our user ID)
 */
export async function getCustomerByExternalId(externalId: string) {
  try {
    const customer = await polar.customers.getExternal({ externalId });
    return customer;
  } catch (error) {
    // 404 means customer doesn't exist yet
    if ((error as { statusCode?: number }).statusCode === 404) {
      return null;
    }
    console.error("Failed to get customer:", error);
    return null;
  }
}

/**
 * Get customer's subscriptions
 */
export async function getCustomerSubscriptions(customerId: string) {
  try {
    const subscriptions = await polar.subscriptions.list({
      customerId,
      active: true,
    });
    // The list returns a page iterator, get the items
    const items: Awaited<ReturnType<typeof polar.subscriptions.list>> extends { 
      result: { items: infer T } 
    } ? T : never[] = [];
    for await (const page of subscriptions) {
      return page.result.items;
    }
    return items;
  } catch (error) {
    console.error("Failed to get subscriptions:", error);
    return [];
  }
}

/**
 * Revoke (immediately cancel) a subscription
 */
export async function revokeSubscription(subscriptionId: string) {
  return polar.subscriptions.revoke({ id: subscriptionId });
}

/**
 * Get Polar customer portal URL for self-service billing management
 */
export async function getCustomerPortalUrl(customerId: string) {
  const session = await polar.customerSessions.create({
    customerId,
  });
  return session.customerPortalUrl;
}

/**
 * Verify Polar webhook signature (Standard Webhooks format)
 * 
 * Polar uses Standard Webhooks format:
 * - Header: 'webhook-signature' 
 * - Format: 'v1,<base64-signature>'
 * - Also requires 'webhook-id' and 'webhook-timestamp' headers
 */
export function verifyWebhookSignature(
  payload: string,
  webhookId: string | null,
  webhookTimestamp: string | null,
  webhookSignature: string | null
): boolean {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  
  if (!secret) {
    console.warn("POLAR_WEBHOOK_SECRET not set, skipping verification");
    return true; // Allow in dev
  }

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.warn("Missing webhook headers for verification");
    return false;
  }

  try {
    // Standard Webhooks format: sign "webhook_id.timestamp.payload"
    const signedPayload = `${webhookId}.${webhookTimestamp}.${payload}`;
    
    // Secret might be base64 encoded with "whsec_" or "polar_whs_" prefix
    let secretBytes: Buffer;
    if (secret.startsWith("whsec_")) {
      secretBytes = Buffer.from(secret.substring(6), "base64");
    } else if (secret.startsWith("polar_whs_")) {
      secretBytes = Buffer.from(secret.substring(10), "base64");
    } else {
      secretBytes = Buffer.from(secret, "base64");
    }
    
    const expected = crypto
      .createHmac("sha256", secretBytes)
      .update(signedPayload)
      .digest("base64");

    // Signature header can have multiple signatures: "v1,sig1 v1,sig2"
    const signatures = webhookSignature.split(" ");
    
    for (const sig of signatures) {
      const [version, signature] = sig.split(",");
      if (version === "v1") {
        try {
          const sigMatch = crypto.timingSafeEqual(
            Buffer.from(signature, "base64"),
            Buffer.from(expected, "base64")
          );
          if (sigMatch) return true;
        } catch {
          // Continue checking other signatures
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error("Webhook signature verification error:", error);
    return false;
  }
}

// Export server info for debugging
export const polarConfig = {
  server: POLAR_SERVER,
  isSandbox: IS_SANDBOX,
};
