/**
 * Subscribe endpoint - creates a Creem subscription checkout
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { createCreemCheckout, getTierProductId, TIERS, TierKey } from "@/lib/creem";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let tier: TierKey = "basic";
  let autoTopup = true;
  
  try {
    const body = await request.json();
    if (body.tier === "pro" || body.tier === "basic") {
      tier = body.tier;
    }
    autoTopup = body.autoTopup !== false;
  } catch {
    // Default values
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

  // Get product ID for selected tier
  const productId = getTierProductId(tier);
  
  if (!productId) {
    console.error(`Creem product not configured for tier: ${tier}`);
    return NextResponse.json(
      { error: `Billing not configured for ${TIERS[tier].name} plan` },
      { status: 500 }
    );
  }

  const successUrl = `${APP_URL}/onboarding?subscription=success&tier=${tier}`;

  try {
    const { checkoutUrl } = await createCreemCheckout({
      productId,
      successUrl,
      customerEmail: user.email,
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
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
