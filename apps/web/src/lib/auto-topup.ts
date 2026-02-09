/**
 * Auto Top-Up Logic for BlitzClaw
 *
 * Triggers a Paddle charge when user's balance falls below threshold.
 */

import { prisma } from "@blitzclaw/db";
import { createOneTimeCharge } from "@/lib/paddle";

const PADDLE_TOPUP_20_PRICE_ID = process.env.PADDLE_TOPUP_20_PRICE_ID;
const PADDLE_TOPUP_50_PRICE_ID = process.env.PADDLE_TOPUP_50_PRICE_ID;
const PADDLE_TOPUP_100_PRICE_ID = process.env.PADDLE_TOPUP_100_PRICE_ID;

interface TopupResult {
  success: boolean;
  error?: string;
}

/**
 * Check if user needs auto top-up and trigger it if so.
 */
export async function checkAndTriggerTopup(userId: string): Promise<TopupResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balance: true },
  });

  if (!user || !user.balance) {
    return { success: false, error: "User or balance not found" };
  }

  const { balance } = user;

  if (balance.creditsCents >= balance.topupThresholdCents) {
    return { success: true };
  }

  if (!balance.autoTopupEnabled) {
    return { success: false, error: "Auto top-up disabled" };
  }

  if (!user.paddleSubscriptionId) {
    return { success: false, error: "No subscription on file" };
  }

  try {
    const priceId =
      balance.topupAmountCents >= 10000
        ? PADDLE_TOPUP_100_PRICE_ID
        : balance.topupAmountCents >= 5000
          ? PADDLE_TOPUP_50_PRICE_ID
          : PADDLE_TOPUP_20_PRICE_ID;

    if (!priceId) {
      return { success: false, error: "Top-up price not configured" };
    }

    await createOneTimeCharge({
      subscriptionId: user.paddleSubscriptionId,
      priceId,
      customData: {
        user_id: user.id,
        amount_cents: String(balance.topupAmountCents),
        type: "auto_topup",
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Auto top-up failed:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Trigger immediate balance check and potential pause for an instance.
 * Call this after a failed API request due to low balance.
 */
export async function handleLowBalance(userId: string, instanceId: string): Promise<void> {
  const result = await checkAndTriggerTopup(userId);

  if (!result.success) {
    await prisma.instance.update({
      where: { id: instanceId },
      data: { status: "PAUSED" },
    });

    console.log(`Instance ${instanceId} paused: ${result.error}`);
  }
}
