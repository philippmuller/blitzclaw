/**
 * Polar Webhook Handler
 * 
 * Handles subscription lifecycle events from Polar:
 * - checkout.created/updated - Checkout started
 * - subscription.created - New subscription
 * - subscription.active - Subscription became active
 * - subscription.updated - Plan change, renewal, etc.
 * - subscription.canceled - User canceled
 * - subscription.revoked - Payment failed / access revoked
 * 
 * Polar automatically handles metered usage billing at period end.
 */

import { NextResponse } from "next/server";
import { prisma, InstanceStatus } from "@blitzclaw/db";
import { verifyWebhookSignature, polarConfig } from "@/lib/polar";

// Webhook event types we care about
type PolarEventType =
  | "checkout.created"
  | "checkout.updated"
  | "subscription.created"
  | "subscription.active"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.revoked"
  | "order.created";

interface PolarWebhookEvent {
  type: PolarEventType;
  data: {
    id: string;
    customer_id?: string;
    customer?: {
      id: string;
      email: string;
      external_id?: string;
    };
    product_id?: string;
    product?: {
      id: string;
      name: string;
    };
    subscription_id?: string;
    metadata?: Record<string, string>;
    status?: string;
    customer_external_id?: string;
  };
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("polar-signature") ||
                    request.headers.get("x-polar-signature");

  // Verify webhook signature
  if (!verifyWebhookSignature(payload, signature)) {
    console.warn("⚠️ Polar webhook signature verification failed");
    // In sandbox/dev, continue anyway but log it
    if (process.env.NODE_ENV === "production" && polarConfig.server === "production") {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let event: PolarWebhookEvent;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log(`📨 Polar webhook [${polarConfig.server}]:`, {
    type: event.type,
    dataId: event.data?.id,
    customerId: event.data?.customer_id || event.data?.customer?.id,
    externalId: event.data?.customer_external_id || event.data?.customer?.external_id,
    metadata: event.data?.metadata,
  });

  const data = event.data;
  
  // Get our user ID from external_id or metadata
  const userId = data.customer_external_id || 
                 data.customer?.external_id || 
                 data.metadata?.user_id;
  
  const polarCustomerId = data.customer_id || data.customer?.id;
  const subscriptionId = data.subscription_id || data.id;
  const plan = data.metadata?.plan || 
               (data.product?.name?.toLowerCase().includes("pro") ? "pro" : "basic");

  switch (event.type) {
    case "checkout.created":
    case "checkout.updated":
      // Checkout in progress - no action needed
      console.log(`Checkout ${data.id} ${event.type.split(".")[1]}`);
      break;

    case "subscription.created":
    case "subscription.active":
    case "order.created": {
      if (!userId) {
        console.error("No user_id in webhook - cannot process subscription", {
          event: event.type,
          metadata: data.metadata,
          externalId: data.customer_external_id,
        });
        return NextResponse.json({ 
          error: "Missing user_id", 
          received: data.metadata 
        }, { status: 400 });
      }

      // IDEMPOTENCY: Check if already processed
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { polarSubscriptionId: true, polarCustomerId: true },
      });

      if (existingUser?.polarSubscriptionId === subscriptionId) {
        console.log(`⏭️ Skipping duplicate webhook for subscription ${subscriptionId}`);
        return NextResponse.json({ received: true, skipped: "duplicate" });
      }

      // Update user with Polar IDs
      await prisma.user.update({
        where: { id: userId },
        data: {
          polarCustomerId,
          polarSubscriptionId: subscriptionId,
          plan: plan as "basic" | "pro",
          billingMode: data.metadata?.byok === "true" ? "byok" : "managed",
        },
      });

      // Ensure balance record exists (Polar handles credits via meter benefits)
      // We still track balance locally for usage limits
      await prisma.balance.upsert({
        where: { userId },
        update: {
          // Don't override existing balance - Polar handles credit grants
        },
        create: {
          userId,
          creditsCents: 500, // $5 initial credit (matches Polar benefit)
          autoTopupEnabled: true, // Polar handles overage automatically
          topupThresholdCents: 0,
          topupAmountCents: 0,
        },
      });

      // Reactivate any paused instances
      await prisma.instance.updateMany({
        where: { userId, status: InstanceStatus.PAUSED },
        data: { status: InstanceStatus.ACTIVE },
      });

      console.log(`✅ Subscription active for user ${userId} (${plan})`);
      break;
    }

    case "subscription.updated": {
      if (!userId) break;

      // Plan change or renewal
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: plan as "basic" | "pro",
          polarSubscriptionId: subscriptionId,
        },
      }).catch(e => console.warn("Could not update user plan:", e));

      console.log(`📝 Subscription updated for user ${userId}: ${plan}`);
      break;
    }

    case "subscription.canceled": {
      if (!userId) break;

      // User canceled - access continues until period end
      // We don't pause immediately; Polar will send revoked when access ends
      console.log(`⚠️ Subscription canceled for user ${userId} - access continues until period end`);
      break;
    }

    case "subscription.revoked": {
      if (!userId) break;

      // Access revoked - pause instances
      await prisma.instance.updateMany({
        where: { userId },
        data: { status: InstanceStatus.PAUSED },
      });

      // Clear subscription ID
      await prisma.user.update({
        where: { id: userId },
        data: { polarSubscriptionId: null },
      }).catch(() => {});

      console.log(`🚫 Subscription revoked for user ${userId}, instances paused`);
      break;
    }

    default:
      console.log(`Unhandled Polar event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
