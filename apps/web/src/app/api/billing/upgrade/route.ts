/**
 * Upgrade/downgrade subscription endpoint
 * Changes the user's subscription to a different tier
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { updateCreemSubscription, getTierCredits, TIERS, TierKey } from "@/lib/creem";

// Product IDs for each tier
const TIER_PRODUCT_IDS: Record<TierKey, string | undefined> = {
  byok: process.env.CREEM_PRODUCT_BYOK,
  basic: process.env.CREEM_SUBSCRIPTION_PRODUCT_ID,
  pro: process.env.CREEM_SUBSCRIPTION_PRO_PRODUCT_ID,
};

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ 
    where: { clerkId },
    include: { balance: true }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.creemSubscriptionId) {
    return NextResponse.json(
      { error: "No subscription to upgrade. Please subscribe first." },
      { status: 400 }
    );
  }

  // Parse request body
  let newTier: TierKey;
  try {
    const body = await req.json();
    newTier = body.tier;
    
    if (!newTier || !TIERS[newTier]) {
      return NextResponse.json(
        { error: "Invalid tier. Must be: byok, basic, or pro" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Get the product ID for the new tier
  const newProductId = TIER_PRODUCT_IDS[newTier];
  if (!newProductId) {
    return NextResponse.json(
      { error: `Product not configured for tier: ${newTier}` },
      { status: 500 }
    );
  }

  try {
    // Update subscription via Creem API
    await updateCreemSubscription(user.creemSubscriptionId, newProductId);

    // Update user's billing mode
    const newBillingMode = newTier === "byok" ? "byok" : "managed";
    await prisma.user.update({
      where: { id: user.id },
      data: { billingMode: newBillingMode }
    });

    // Credit the difference if upgrading to a higher tier
    const currentCredits = user.balance?.creditsCents ?? 0;
    const newTierCredits = getTierCredits(newTier);
    
    // Note: In production, Creem webhook will handle the credit adjustment
    // This is just for immediate UI feedback
    
    return NextResponse.json({
      success: true,
      message: `Subscription updated to ${TIERS[newTier].name}`,
      newTier,
      tierCredits: newTierCredits,
    });
  } catch (error) {
    console.error("Subscription upgrade failed:", error);
    return NextResponse.json(
      { error: "Failed to upgrade subscription", details: (error as Error).message },
      { status: 500 }
    );
  }
}
