/**
 * Auto Top-Up Logic for BlitzClaw
 *
 * Only applicable for managed billing users (future feature).
 * BYOK users pay Anthropic directly and don't use credits/balance.
 */

import { prisma } from "@blitzclaw/db";

interface TopupResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Check if user needs auto top-up and trigger it if so.
 * 
 * BYOK users: Skipped (they pay Anthropic directly)
 * Managed users: Not yet implemented
 */
export async function checkAndTriggerTopup(userId: string): Promise<TopupResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balance: true },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // BYOK users don't use balance/top-ups - skip entirely
  if (user.billingMode === "byok") {
    return { success: true, skipped: true };
  }

  // For non-BYOK users, check balance
  if (!user.balance) {
    return { success: false, error: "Balance not found" };
  }

  const { balance } = user;

  // Balance is above threshold - no action needed
  if (balance.creditsCents >= balance.topupThresholdCents) {
    return { success: true };
  }

  // Auto top-up is disabled
  if (!balance.autoTopupEnabled) {
    return { success: false, error: "Auto top-up disabled" };
  }

  // TODO: Implement managed billing top-ups when that feature launches
  // For now, just return an error since only BYOK is available
  return { 
    success: false, 
    error: "Managed billing top-ups not yet implemented" 
  };
}

/**
 * Trigger immediate balance check and potential pause for an instance.
 * Call this after a failed API request due to low balance.
 * 
 * Note: For BYOK users, this should never be called since they don't use balance.
 */
export async function handleLowBalance(userId: string, instanceId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  // BYOK users don't use balance - this shouldn't be called for them
  if (user?.billingMode === "byok") {
    console.warn(`handleLowBalance called for BYOK user ${userId} - this should not happen`);
    return;
  }

  const result = await checkAndTriggerTopup(userId);

  if (!result.success && !result.skipped) {
    await prisma.instance.update({
      where: { id: instanceId },
      data: { status: "PAUSED" },
    });

    console.log(`Instance ${instanceId} paused: ${result.error}`);
  }
}
