/**
 * Polar.sh API client for BlitzClaw billing
 * 
 * Handles:
 * - Checkout session creation
 * - Usage tracking (metering)
 * - Customer management
 */

import { Polar } from "@polar-sh/sdk";

// Initialize Polar client
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: "production",
});

// Product IDs from Polar dashboard
export const POLAR_PRODUCTS = {
  basic: process.env.POLAR_PRODUCT_BASIC_ID,
  pro: process.env.POLAR_PRODUCT_PRO_ID,
};

export type PlanType = "basic" | "pro";

/**
 * Track AI usage for a customer
 * Only call this for managed billing users (not BYOK)
 * 
 * @param externalCustomerId - Our internal user ID (used as external_customer_id in Polar)
 * @param credits - Usage in cents (1 credit = $0.01)
 * @param metadata - Additional info (model, tokens, etc.)
 */
export async function trackUsage(
  externalCustomerId: string,
  credits: number,
  metadata?: Record<string, string | number>
) {
  try {
    await polar.events.ingest({
      events: [
        {
          name: "ai_usage",
          externalCustomerId,
          metadata: {
            credits,
            timestamp: Date.now(),
            ...metadata,
          },
        },
      ],
    });
    console.log(`📊 Tracked ${credits} credits for user ${externalCustomerId}`);
  } catch (error) {
    console.error("Failed to track usage with Polar:", error);
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
    "claude-3-5-sonnet-20241022": { input: 3, output: 15 },
    "claude-haiku": { input: 0.25, output: 1.25 },
    "claude-3-5-haiku-20241022": { input: 0.25, output: 1.25 },
    "claude-opus-4": { input: 15, output: 75 },
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
 * Get customer's current subscription and usage from Polar
 */
export async function getCustomerState(externalCustomerId: string) {
  try {
    // This would use Polar's customer state API
    // For now, we'll rely on webhooks to keep our DB in sync
    return null;
  } catch (error) {
    console.error("Failed to get customer state:", error);
    return null;
  }
}
