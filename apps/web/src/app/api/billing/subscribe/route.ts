/**
 * Subscribe endpoint - creates a Paddle subscription checkout
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { createCheckout } from "@/lib/paddle";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

// Paddle Price IDs (configure these in env)
const PADDLE_PRICE_IDS: Record<string, string | undefined> = {
  byok: process.env.PADDLE_PRICE_BYOK,      // €19/mo - server only, BYOK
  basic: process.env.PADDLE_PRICE_BASIC,    // €20/mo - includes €10 credits
  pro: process.env.PADDLE_PRICE_PRO,        // €120/mo - includes €110 credits
};

type TierKey = "byok" | "basic" | "pro";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let tier: TierKey = "byok";
  let autoTopup = true;
  let anthropicKey: string | undefined;
  
  try {
    const body = await request.json();
    if (body.tier === "pro" || body.tier === "basic" || body.tier === "byok") {
      tier = body.tier;
    }
    autoTopup = body.autoTopup !== false;
    anthropicKey = body.anthropicKey;
  } catch {
    // Default values
  }

  // Validate BYOK has anthropic key
  if (tier === "byok" && (!anthropicKey || !anthropicKey.startsWith("sk-ant-"))) {
    return NextResponse.json(
      { error: "Valid Anthropic API key required for BYOK plan" },
      { status: 400 }
    );
  }

  // Get or create user in database
  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId,
        email: `${clerkId}@pending.blitzclaw.com`,
      },
    });
  }

  // Store anthropic key encrypted (for BYOK users)
  if (tier === "byok" && anthropicKey) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Store key for later use in instance creation
        // In production, encrypt this!
        anthropicKey: anthropicKey,
      },
    });
  }

  // Get price ID for selected tier
  const priceId = PADDLE_PRICE_IDS[tier];
  
  if (!priceId) {
    console.error(`Paddle price not configured for tier: ${tier}`);
    return NextResponse.json(
      { error: `Billing not configured for ${tier} plan. Please try again later.` },
      { status: 500 }
    );
  }

  const successUrl = `${APP_URL}/onboarding?subscription=success&tier=${tier}`;
  const cancelUrl = `${APP_URL}/onboarding?subscription=cancelled`;

  try {
    const { checkoutUrl } = await createCheckout({
      priceId,
      customerEmail: user.email,
      successUrl,
      cancelUrl,
      customData: {
        user_id: user.id,
        clerk_id: clerkId,
        tier: tier,
        type: "subscription",
        auto_topup: autoTopup ? "true" : "false",
      },
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("Paddle checkout creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create checkout. Please try again." },
      { status: 500 }
    );
  }
}
