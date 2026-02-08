/**
 * Auto Top-Up Logic for BlitzClaw
 * 
 * Triggers a charge via Creem when user's balance falls below threshold.
 */

import { prisma } from "@blitzclaw/db";

const CREEM_API_KEY = process.env.CREEM_API_KEY;
const CREEM_API_URL = process.env.CREEM_API_URL || "https://api.creem.io/v1";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com";

interface TopupResult {
  success: boolean;
  error?: string;
  checkoutUrl?: string;
}

/**
 * Check if user needs auto top-up and trigger it if so.
 * Returns true if top-up was triggered (user should retry after payment).
 */
export async function checkAndTriggerTopup(userId: string): Promise<TopupResult> {
  // Get user with balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { balance: true },
  });

  if (!user || !user.balance) {
    return { success: false, error: "User or balance not found" };
  }

  const { balance } = user;
  
  // Check if auto top-up is needed
  if (balance.creditsCents >= balance.topupThresholdCents) {
    return { success: true }; // No top-up needed
  }

  if (!balance.autoTopupEnabled) {
    return { success: false, error: "Auto top-up disabled" };
  }

  if (!user.creemCustomerId) {
    return { success: false, error: "No payment method on file" };
  }

  // Trigger Creem charge
  try {
    const checkoutUrl = await createCreemCharge(
      user.id,
      user.creemCustomerId,
      balance.topupAmountCents
    );
    
    if (checkoutUrl) {
      return { success: true, checkoutUrl };
    }
    
    return { success: false, error: "Failed to create charge" };
  } catch (error) {
    console.error("Auto top-up failed:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create a Creem charge for auto top-up.
 * 
 * Note: Creem may require customer to confirm via checkout URL,
 * or may support direct charges for returning customers.
 */
async function createCreemCharge(
  userId: string,
  customerId: string,
  amountCents: number
): Promise<string | null> {
  if (!CREEM_API_KEY) {
    console.error("CREEM_API_KEY not configured");
    return null;
  }

  // Try to create a checkout session for the existing customer
  // This allows Creem to use their saved payment method
  const response = await fetch(`${CREEM_API_URL}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CREEM_API_KEY,
    },
    body: JSON.stringify({
      amount: amountCents,
      currency: "usd",
      customer_id: customerId,
      success_url: `${APP_URL}/dashboard?topup=success`,
      cancel_url: `${APP_URL}/dashboard?topup=cancelled`,
      metadata: {
        user_id: userId,
        amount_cents: String(amountCents),
        type: "auto_topup",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Creem checkout creation failed:", response.status, errorText);
    return null;
  }

  const data = await response.json();
  return data.checkout_url || data.url || null;
}

/**
 * Trigger immediate balance check and potential pause for an instance.
 * Call this after a failed API request due to low balance.
 */
export async function handleLowBalance(userId: string, instanceId: string): Promise<void> {
  const result = await checkAndTriggerTopup(userId);
  
  if (!result.success) {
    // Can't auto top-up - pause the instance
    await prisma.instance.update({
      where: { id: instanceId },
      data: { status: "PAUSED" },
    });
    
    console.log(`Instance ${instanceId} paused: ${result.error}`);
  }
}
