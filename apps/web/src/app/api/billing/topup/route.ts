/**
 * Top-up endpoint - creates a Creem checkout for one-time credit purchases
 * 
 * BYOK users don't need top-ups - they pay Anthropic directly for usage.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { createCreemCheckout } from "@/lib/creem";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

// Creem Product IDs for top-ups
const TOPUP_PRODUCTS: Record<number, { productIdEnv: string; amountCents: number }> = {
  25: { productIdEnv: "CREEM_TOPUP_25_PRODUCT_ID", amountCents: 2500 },
  50: { productIdEnv: "CREEM_TOPUP_50_PRODUCT_ID", amountCents: 5000 },
};

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  let amount: number = 25;
  try {
    const body = await request.json();
    if (body.amount === 50 || body.amount === 25) {
      amount = body.amount;
    }
  } catch {
    // Default to 25
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // BYOK users don't use balance/top-ups - they pay Anthropic directly
  if (user.billingMode === "byok") {
    return NextResponse.json(
      { 
        error: "Top-ups are not available for BYOK plans. You pay Anthropic directly for API usage.",
        billingMode: "byok"
      },
      { status: 400 }
    );
  }

  // Get product config
  const topupConfig = TOPUP_PRODUCTS[amount];
  if (!topupConfig) {
    return NextResponse.json({ error: "Invalid top-up amount" }, { status: 400 });
  }

  const productId = process.env[topupConfig.productIdEnv];
  if (!productId) {
    console.error(`Creem top-up product not configured: ${topupConfig.productIdEnv}`);
    return NextResponse.json(
      { error: "Top-up not configured. Please try again later." },
      { status: 500 }
    );
  }

  const successUrl = `${APP_URL}/dashboard/billing?topup=success`;

  try {
    console.log("Creating Creem top-up checkout:", {
      productId,
      amount,
      userId: user.id,
    });

    const { checkoutUrl } = await createCreemCheckout({
      productId,
      customerEmail: user.email,
      successUrl,
      customData: {
        user_id: user.id,
        clerk_id: clerkId,
        type: "topup",
        amount_cents: String(topupConfig.amountCents),
      },
    });

    console.log("Creem top-up checkout created:", checkoutUrl);
    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("Creem top-up checkout failed:", error);
    return NextResponse.json(
      { error: "Failed to create checkout. Please try again.", details: (error as Error).message },
      { status: 500 }
    );
  }
}
