/**
 * Polar Checkout Route
 * 
 * Creates a Polar checkout session for subscription purchases.
 * Supports both Basic ($19) and Pro ($39) plans.
 * 
 * Query params:
 * - product: product ID from Polar
 * - plan: "basic" or "pro" (used to look up product ID from env)
 * - user_id: our internal user ID (passed to Polar as external_customer_id)
 */

import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  successUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com"}/onboarding?polar_success=true&checkout_id={CHECKOUT_ID}`,
  server: "production",
});
