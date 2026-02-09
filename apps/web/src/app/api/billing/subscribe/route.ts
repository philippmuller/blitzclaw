/**
 * Subscribe endpoint - creates a Paddle subscription checkout
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { createCheckout } from "@/lib/paddle";

const PADDLE_SUBSCRIPTION_PRICE_ID = process.env.PADDLE_SUBSCRIPTION_PRICE_ID;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body for auto-topup preference
  let autoTopup = true;
  try {
    const body = await request.json();
    autoTopup = body.autoTopup !== false;
  } catch {
    // Default to true if no body
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

  if (!PADDLE_SUBSCRIPTION_PRICE_ID) {
    console.error("Paddle subscription price not configured");
    return NextResponse.json({ error: "Billing not configured" }, { status: 500 });
  }

  const successUrl = `${APP_URL}/onboarding?subscription=success`;

  try {
    const { checkoutUrl } = await createCheckout({
      priceId: PADDLE_SUBSCRIPTION_PRICE_ID,
      customerId: user.paddleCustomerId || undefined,
      customerEmail: user.email,
      successUrl,
      customData: {
        user_id: user.id,
        clerk_id: clerkId,
        type: "subscription",
        auto_topup: autoTopup ? "true" : "false",
      },
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("Paddle checkout creation failed:", error);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
