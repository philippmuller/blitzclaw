/**
 * Top-up endpoint - creates a Paddle one-time charge against subscription
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { createOneTimeCharge } from "@/lib/paddle";

const PADDLE_TOPUP_10_PRICE_ID = process.env.PADDLE_TOPUP_10_PRICE_ID;
const PADDLE_TOPUP_25_PRICE_ID = process.env.PADDLE_TOPUP_25_PRICE_ID;
const PADDLE_TOPUP_50_PRICE_ID = process.env.PADDLE_TOPUP_50_PRICE_ID;

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { amount_cents: amountCents } = await request.json();
  const amount = Number(amountCents || 2500);

  if (amount < 1000) {
    return NextResponse.json(
      { error: "Minimum topup amount is €10 (1000 cents)" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.paddleSubscriptionId) {
    return NextResponse.json(
      { error: "No active subscription found" },
      { status: 400 }
    );
  }

  const priceId =
    amount >= 5000
      ? PADDLE_TOPUP_50_PRICE_ID
      : amount >= 2500
        ? PADDLE_TOPUP_25_PRICE_ID
        : PADDLE_TOPUP_10_PRICE_ID;

  if (!priceId) {
    return NextResponse.json(
      { error: "Top-up price not configured" },
      { status: 500 }
    );
  }

  try {
    const transaction = await createOneTimeCharge({
      subscriptionId: user.paddleSubscriptionId,
      priceId,
      customData: {
        user_id: user.id,
        amount_cents: String(amount),
        type: "manual_topup",
      },
    });

    const checkoutUrl =
      transaction?.data?.checkout?.url ||
      transaction?.data?.checkout_url ||
      transaction?.data?.url ||
      transaction?.checkout?.url ||
      transaction?.checkout_url ||
      transaction?.url ||
      null;

    return NextResponse.json({
      success: true,
      checkoutUrl,
      transaction,
    });
  } catch (error) {
    console.error("Paddle top-up error:", error);
    return NextResponse.json(
      { error: "Failed to create top-up" },
      { status: 500 }
    );
  }
}
