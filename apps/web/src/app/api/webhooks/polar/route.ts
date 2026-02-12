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
import { sendWelcomeEmail } from "@/lib/email";

// Webhook event types we care about
type PolarEventType =
  | "checkout.created"
  | "checkout.updated"
  | "subscription.created"
  | "subscription.active"
  | "subscription.updated"
  | "subscription.canceled"
  | "subscription.revoked"
  | "order.created"
  | "benefit_grant.created"
  | "benefit_grant.updated"
  | "benefit_grant.revoked";

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
  
  // Standard Webhooks headers
  const webhookId = request.headers.get("webhook-id");
  const webhookTimestamp = request.headers.get("webhook-timestamp");
  const webhookSignature = request.headers.get("webhook-signature");

  // Verify webhook signature
  if (!verifyWebhookSignature(payload, webhookId, webhookTimestamp, webhookSignature)) {
    console.warn("⚠️ Polar webhook signature verification failed", {
      hasId: !!webhookId,
      hasTimestamp: !!webhookTimestamp,
      hasSignature: !!webhookSignature,
    });
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
  
  // Log full payload for debugging (temporary)
  console.log(`📨 Polar webhook FULL PAYLOAD:`, JSON.stringify(event, null, 2).slice(0, 2000));

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

      // Credit balance for subscription - $5 for basic, $15 for pro
      const creditsCents = plan === "pro" ? 1500 : 500;
      const existingBalance = await prisma.balance.findUnique({ where: { userId } });

      if (existingBalance) {
        await prisma.balance.update({
          where: { userId },
          data: { 
            creditsCents: { increment: creditsCents },
            autoTopupEnabled: true,
          },
        });
      } else {
        await prisma.balance.create({
          data: {
            userId,
            creditsCents,
            autoTopupEnabled: true,
            topupThresholdCents: 0,
            topupAmountCents: 0,
          },
        });
      }

      // Reactivate any paused instances
      await prisma.instance.updateMany({
        where: { userId, status: InstanceStatus.PAUSED },
        data: { status: InstanceStatus.ACTIVE },
      });

      // Send welcome email for new subscriptions
      if (event.type === "subscription.created" && data.customer?.email) {
        sendWelcomeEmail(data.customer.email, plan as "basic" | "pro")
          .then((sent) => {
            if (sent) console.log(`📧 Welcome email sent to ${data.customer?.email}`);
          })
          .catch((e) => console.error("Failed to send welcome email:", e));
      }

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

    case "benefit_grant.created":
    case "benefit_grant.updated": {
      // Benefit granted - this is where credits get assigned
      // The benefit should include the credit amount
      const benefitData = data as {
        id: string;
        customer_id?: string;
        customer?: { id: string; external_id?: string };
        benefit?: { 
          id: string; 
          type: string; 
          description?: string;
          properties?: { amount?: number };
        };
        properties?: { amount?: number };
        is_granted?: boolean;
      };
      
      const benefitCustomerId = benefitData.customer_id || benefitData.customer?.id;
      const benefitUserId = benefitData.customer?.external_id || data.metadata?.user_id;
      
      console.log(`🎁 Benefit grant event:`, {
        type: event.type,
        benefitType: benefitData.benefit?.type,
        benefitId: benefitData.benefit?.id,
        customerId: benefitCustomerId,
        userId: benefitUserId,
        isGranted: benefitData.is_granted,
        properties: benefitData.properties,
      });

      // If this is a credit grant and we have a user ID, credit their balance
      if (benefitUserId) {
        // Get or create customer mapping if we have Polar customer ID
        if (benefitCustomerId) {
          await prisma.user.update({
            where: { id: benefitUserId },
            data: { polarCustomerId: benefitCustomerId },
          }).catch(() => {});
        }

        // Get credit amount from Polar benefit properties (already in cents)
        const benefitAmount = benefitData.properties?.amount || benefitData.benefit?.properties?.amount;
        const creditsCents = benefitAmount || 500; // Default 500 cents ($5) if not specified
        
        console.log(`💰 Benefit credit amount: ${creditsCents} cents`);

        const existingBenefitBalance = await prisma.balance.findUnique({ 
          where: { userId: benefitUserId } 
        });
        
        if (!existingBenefitBalance) {
          await prisma.balance.create({
            data: {
              userId: benefitUserId,
              creditsCents,
              autoTopupEnabled: true,
              topupThresholdCents: 0,
              topupAmountCents: 0,
            },
          });
          console.log(`✅ Created balance for user ${benefitUserId}`);
        } else if (existingBenefitBalance.creditsCents === 0) {
          // Balance exists but is 0 - credit from benefit
          await prisma.balance.update({
            where: { userId: benefitUserId },
            data: { creditsCents },
          });
          console.log(`✅ Credited ${creditsCents} cents for user ${benefitUserId}`);
        } else {
          console.log(`✅ Balance already exists for user ${benefitUserId}: ${existingBenefitBalance.creditsCents} cents`);
        }
      }
      break;
    }

    case "benefit_grant.revoked": {
      // Benefit revoked - could pause access
      console.log(`⚠️ Benefit revoked:`, {
        benefitId: (data as { benefit?: { id: string } }).benefit?.id,
        customerId: data.customer_id || data.customer?.id,
      });
      break;
    }

    default:
      console.log(`Unhandled Polar event: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
