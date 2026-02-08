import { NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import crypto from "crypto";

const CREEM_WEBHOOK_SECRET = process.env.CREEM_WEBHOOK_SECRET;

function verifyCreemSignature(payload: string, signature: string): boolean {
  if (!CREEM_WEBHOOK_SECRET) {
    console.warn("CREEM_WEBHOOK_SECRET not set, skipping verification");
    return true; // Skip in dev
  }
  
  const expectedSignature = crypto
    .createHmac("sha256", CREEM_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-creem-signature") || "";

  // Log raw webhook for debugging
  console.log("=== CREEM WEBHOOK RECEIVED ===");
  console.log("Signature:", signature ? signature.substring(0, 20) + "..." : "NONE");
  console.log("Payload preview:", payload.substring(0, 500));

  // Verify webhook signature
  if (!verifyCreemSignature(payload, signature)) {
    console.error("Invalid Creem webhook signature");
    console.error("Expected secret starts with:", CREEM_WEBHOOK_SECRET?.substring(0, 10));
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log("✅ Signature verified");

  const event = JSON.parse(payload);
  const eventType = event.event_type || event.type;
  const data = event.data || event;
  const metadata = data?.metadata || {};

  // Also check for request_id which might contain user info
  const requestId = data?.request_id || event.request_id;
  
  console.log(`Creem webhook: ${eventType}`, { 
    userId: metadata.user_id,
    requestId,
    customerId: data?.customer?.id,
    metadata: JSON.stringify(metadata),
  });

  switch (eventType) {
    // ============ CHECKOUT ============
    case "checkout.completed": {
      // Try to get user_id from metadata, or parse from request_id
      let userId = metadata.user_id;
      
      // Fallback: extract from request_id (format: sub_<userId>_<timestamp>)
      if (!userId && requestId && requestId.startsWith("sub_")) {
        const parts = requestId.split("_");
        if (parts.length >= 2) {
          userId = parts[1];
          console.log(`Extracted userId from request_id: ${userId}`);
        }
      }
      // Subscription includes €10 credits (1000 cents)
      const SUBSCRIPTION_CREDITS = 1000;
      const amountCents = parseInt(metadata.amount_cents || String(SUBSCRIPTION_CREDITS), 10);
      const creemCustomerId = data.customer?.id || data.customer_id;
      const autoTopup = metadata.auto_topup !== "false"; // Default true

      if (!userId) {
        console.error("No user_id in checkout.completed metadata:", event);
        return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
      }

      // Store Creem customer ID for future auto top-ups
      if (creemCustomerId) {
        await prisma.user.update({
          where: { id: userId },
          data: { creemCustomerId },
        });
      }

      // Credit the user's balance with auto-topup preference
      await prisma.balance.upsert({
        where: { userId },
        update: {
          creditsCents: { increment: amountCents },
          autoTopupEnabled: autoTopup,
        },
        create: {
          userId,
          creditsCents: amountCents,
          autoTopupEnabled: autoTopup,
          topupThresholdCents: 500, // €5 threshold
          topupAmountCents: 2500, // €25 top-up
        },
      });

      // Unpause any paused instances after payment
      await prisma.instance.updateMany({
        where: { userId, status: "PAUSED" },
        data: { status: "ACTIVE" },
      });

      console.log(`✅ Credited ${amountCents} cents to user ${userId}, autoTopup: ${autoTopup}, customer: ${creemCustomerId || 'unknown'}`);
      break;
    }

    // ============ SUBSCRIPTION LIFECYCLE ============
    case "subscription.active":
    case "subscription.paid": {
      // Try to get user_id from metadata, or parse from request_id
      let userId = metadata.user_id;
      
      // Fallback: extract from request_id (format: sub_<userId>_<timestamp>)
      if (!userId && requestId && requestId.startsWith("sub_")) {
        const parts = requestId.split("_");
        if (parts.length >= 2) {
          userId = parts[1];
          console.log(`Extracted userId from request_id: ${userId}`);
        }
      }
      // €20/mo subscription includes €10 credits (1000 cents)
      const SUBSCRIPTION_CREDITS_CENTS = 1000;
      const amountCents = parseInt(metadata.amount_cents || String(SUBSCRIPTION_CREDITS_CENTS), 10);
      const creemCustomerId = data.customer?.id || data.customer_id;

      if (!userId) {
        console.error(`No user_id in ${eventType} metadata:`, event);
        return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
      }

      // Store Creem customer ID for future charges
      if (creemCustomerId) {
        await prisma.user.update({
          where: { id: userId },
          data: { creemCustomerId },
        });
      }

      // Credit balance for subscription payment
      await prisma.balance.upsert({
        where: { userId },
        update: {
          creditsCents: { increment: amountCents },
        },
        create: {
          userId,
          creditsCents: amountCents,
          autoTopupEnabled: true,
          topupThresholdCents: 500, // €5
          topupAmountCents: 1000, // €10 top-up
        },
      });

      // Unpause any paused instances
      await prisma.instance.updateMany({
        where: { userId, status: "PAUSED" },
        data: { status: "ACTIVE" },
      });

      console.log(`✅ Subscription ${eventType}: credited ${amountCents} cents to user ${userId}`);
      break;
    }

    case "subscription.trialing": {
      const userId = metadata.user_id;
      if (userId) {
        console.log(`ℹ️ User ${userId} started trial`);
        // Could grant trial credits here if needed
      }
      break;
    }

    case "subscription.canceled":
    case "subscription.expired": {
      const userId = metadata.user_id;
      if (userId) {
        // Pause all instances when subscription ends
        await prisma.instance.updateMany({
          where: { userId },
          data: { status: "PAUSED" },
        });
        console.log(`⚠️ Subscription ended for user ${userId}, instances paused`);
      }
      break;
    }

    case "subscription.scheduled_cancel": {
      const userId = metadata.user_id;
      if (userId) {
        console.log(`ℹ️ User ${userId} scheduled cancellation at period end`);
        // Could send reminder email, set flag, etc.
      }
      break;
    }

    case "subscription.unpaid":
    case "subscription.past_due": {
      const userId = metadata.user_id;
      if (userId) {
        // Pause instances on payment failure
        await prisma.instance.updateMany({
          where: { userId },
          data: { status: "PAUSED" },
        });
        console.log(`⚠️ Payment failed for user ${userId}, instances paused`);
      }
      break;
    }

    case "subscription.paused": {
      const userId = metadata.user_id;
      if (userId) {
        await prisma.instance.updateMany({
          where: { userId },
          data: { status: "PAUSED" },
        });
        console.log(`⏸️ Subscription paused for user ${userId}`);
      }
      break;
    }

    case "subscription.update": {
      const userId = metadata.user_id;
      if (userId) {
        console.log(`ℹ️ Subscription updated for user ${userId}`, data);
        // Could handle plan changes here
      }
      break;
    }

    // ============ REFUNDS & DISPUTES ============
    case "refund.created": {
      const userId = metadata.user_id;
      const amountCents = parseInt(data.amount || "0", 10);
      
      if (userId && amountCents > 0) {
        // Deduct refunded amount from balance
        await prisma.balance.update({
          where: { userId },
          data: { creditsCents: { decrement: amountCents } },
        });
        console.log(`💸 Refund: deducted ${amountCents} cents from user ${userId}`);
      }
      break;
    }

    case "dispute.created": {
      const userId = metadata.user_id;
      if (userId) {
        // Pause instances during dispute
        await prisma.instance.updateMany({
          where: { userId },
          data: { status: "PAUSED" },
        });
        console.log(`⚠️ Dispute opened for user ${userId}, instances paused`);
      }
      break;
    }

    default:
      console.log(`Unhandled Creem event: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}
