/**
 * Subscribe endpoint - creates a Creem subscription checkout
 * BYOK users pay €14/mo flat, managed billing users pay more (coming soon)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { createCreemCheckout } from "@/lib/creem";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

// Creem Product IDs (configure these in env)
const CREEM_PRODUCT_IDS: Record<string, string | undefined> = {
  byok: process.env.CREEM_PRODUCT_BYOK,     // €14/mo - server only, BYOK
  basic: process.env.CREEM_PRODUCT_BASIC,   // Future: managed billing basic
  pro: process.env.CREEM_PRODUCT_PRO,       // Future: managed billing pro
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

  // Store anthropic key and billing mode (for BYOK users)
  if (tier === "byok" && anthropicKey) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        // Store key for later use in instance creation
        // In production, encrypt this!
        anthropicKey: anthropicKey,
        billingMode: "byok",
      },
    });
  }

  // Get product ID for selected tier
  const productId = CREEM_PRODUCT_IDS[tier];
  
  if (!productId) {
    console.error(`Creem product not configured for tier: ${tier}`);
    return NextResponse.json(
      { error: `Billing not configured for ${tier} plan. Please try again later.` },
      { status: 500 }
    );
  }

  const successUrl = `${APP_URL}/onboarding?subscription=success&tier=${tier}`;

  try {
    const { checkoutUrl } = await createCreemCheckout({
      productId,
      customerEmail: user.email,
      successUrl,
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
    console.error("Creem checkout creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create checkout. Please try again." },
      { status: 500 }
    );
  }
}
