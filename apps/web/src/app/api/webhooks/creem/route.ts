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

  // Log full payload for debugging
  console.log("📨 Creem webhook raw payload:", JSON.stringify(event, null, 2));

  const eventType = event.eventType || event.type || event.event || event.event_type;
  const data = event.data || event.object || event;
  
  // Creem might nest metadata differently - check multiple locations
  const metadata = data.metadata || data.custom_data || event.metadata || event.custom_data || {};

  console.log(`Creem webhook: ${eventType}`, {
    userId: metadata.user_id,
    tier: metadata.tier,
    type: metadata.type,
    hasData: !!data,
    dataKeys: Object.keys(data || {}),
    metadataKeys: Object.keys(metadata),
  });

  // Handle different event types
  switch (eventType) {
    case "checkout.completed":
    case "payment.completed":
    case "subscription.created":
    case "subscription.active":
    case "subscription.paid": {
      const userId = metadata.user_id;
      const tier = (metadata.tier || "basic") as TierKey;
      const subscriptionType = metadata.type;
      const subscriptionId = data.subscription_id || data.id;

      if (!userId) {
        console.error("No user_id in webhook payload. Full metadata:", JSON.stringify(metadata));
        console.error("Full data object:", JSON.stringify(data));
        // Return error so Creem knows it failed
        return NextResponse.json({ 
          error: "No user_id in metadata",
          received_metadata: metadata,
          received_data_keys: Object.keys(data || {}),
        }, { status: 400 });
      }

      // IDEMPOTENCY CHECK: Skip if we've already processed this subscription
      // (Creem may send multiple events for the same subscription)
      if (subscriptionId) {
        const existingUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { creemSubscriptionId: true, balance: true }
        });
        
        if (existingUser?.creemSubscriptionId === subscriptionId && existingUser?.balance?.creditsCents && existingUser.balance.creditsCents > 0) {
          console.log(`⏭️ Skipping duplicate webhook for subscription ${subscriptionId} - already processed`);
          return NextResponse.json({ received: true, skipped: "duplicate" });
        }
      }

      // Get credits based on tier
      const creditsCents = getTierCredits(tier);

      // Update user subscription info if available
      const customerId = data.customer_id || data.customer?.id;
      
      if (subscriptionId || customerId || tier) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            ...(subscriptionId && { creemSubscriptionId: subscriptionId }),
            ...(customerId && { creemCustomerId: customerId }),
            // Set billing mode based on tier
            billingMode: tier === "byok" ? "byok" : "managed",
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
