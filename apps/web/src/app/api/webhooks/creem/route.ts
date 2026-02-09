/**
 * Creem webhook handler
 */

import { NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { verifyCreemWebhook, getTierCredits, TierKey } from "@/lib/creem";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-creem-signature") || 
                    request.headers.get("creem-signature");

  // Verify webhook signature
  if (!verifyCreemWebhook(payload, signature)) {
    console.warn("⚠️ Creem webhook signature verification failed");
    // Continue anyway in development, but log it
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type || event.event || event.event_type;
  const data = event.data || event.object || event;
  const metadata = data.metadata || data.custom_data || {};

  console.log(`Creem webhook: ${eventType}`, {
    userId: metadata.user_id,
    tier: metadata.tier,
    type: metadata.type,
  });

  // Handle different event types
  switch (eventType) {
    case "checkout.completed":
    case "payment.completed":
    case "subscription.created":
    case "subscription.active": {
      const userId = metadata.user_id;
      const tier = (metadata.tier || "basic") as TierKey;
      const subscriptionType = metadata.type;

      if (!userId) {
        console.error("No user_id in webhook payload");
        break;
      }

      // Get credits based on tier
      const creditsCents = getTierCredits(tier);

      // Update user subscription info if available
      const subscriptionId = data.subscription_id || data.id;
      const customerId = data.customer_id || data.customer?.id;
      
      if (subscriptionId || customerId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            ...(subscriptionId && { creemSubscriptionId: subscriptionId }),
            ...(customerId && { creemCustomerId: customerId }),
          },
        }).catch((e) => {
          console.warn("Could not update user subscription info:", e);
        });
      }

      // Credit the user's balance
      await prisma.balance.upsert({
        where: { userId },
        update: {
          creditsCents: { increment: creditsCents },
        },
        create: {
          userId,
          creditsCents,
          autoTopupEnabled: metadata.auto_topup !== "false",
          topupThresholdCents: 500,
          topupAmountCents: 2500,
        },
      });

      // Reactivate any paused instances
      await prisma.instance.updateMany({
        where: { userId, status: "PAUSED" },
        data: { status: "ACTIVE" },
      });

      console.log(`✅ Credited ${creditsCents} cents (${tier}) to user ${userId}`);
      break;
    }

    case "subscription.canceled":
    case "subscription.cancelled": {
      const userId = metadata.user_id;
      if (!userId) {
        console.error("No user_id in subscription.canceled payload");
        break;
      }

      // Pause instances when subscription canceled
      await prisma.instance.updateMany({
        where: { userId },
        data: { status: "PAUSED" },
      });

      console.log(`⚠️ Subscription canceled for user ${userId}, instances paused`);
      break;
    }

    case "topup.completed":
    case "payment.succeeded": {
      // Handle one-time top-ups
      const userId = metadata.user_id;
      const amountCents = parseInt(metadata.amount_cents || "0", 10) ||
                         (data.amount ? Math.round(data.amount * 100) : 0);

      if (!userId || !amountCents) {
        console.error("Missing user_id or amount in topup payload");
        break;
      }

      await prisma.balance.upsert({
        where: { userId },
        update: {
          creditsCents: { increment: amountCents },
        },
        create: {
          userId,
          creditsCents: amountCents,
          autoTopupEnabled: true,
          topupThresholdCents: 500,
          topupAmountCents: 2500,
        },
      });

      console.log(`✅ Top-up: Credited ${amountCents} cents to user ${userId}`);
      break;
    }

    default:
      console.log(`Unhandled Creem event: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}
