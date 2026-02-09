/**
 * Paddle webhook handler
 */

import { NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { verifyWebhookSignature } from "@/lib/paddle";

function parseAmountCents(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    if (value.includes(".")) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature =
    request.headers.get("paddle-signature") ||
    request.headers.get("Paddle-Signature") ||
    request.headers.get("paddle-signature".toLowerCase());

  const signatureValid = verifyWebhookSignature(payload, signature);

  if (!signatureValid) {
    console.warn("⚠️ Paddle signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(payload);
  const eventType = event.event_type || event.eventType || event.type;
  const data = event.data || event.object || {};
  const customData = data.custom_data || {};

  console.log(`Paddle webhook: ${eventType}`, {
    userId: customData.user_id,
    subscriptionId: data.id,
    transactionId: data.transaction_id || data.id,
  });

  switch (eventType) {
    case "transaction.completed": {
      const userId = customData.user_id;
      const amountCents =
        parseAmountCents(customData.amount_cents) ||
        parseAmountCents(data.details?.totals?.grand_total) ||
        parseAmountCents(data.totals?.grand_total);

      if (!userId) {
        console.error("No user_id in transaction.completed payload");
        break;
      }

      if (data.customer_id) {
        await prisma.user.update({
          where: { id: userId },
          data: { paddleCustomerId: data.customer_id },
        });
      }

      await prisma.balance.upsert({
        where: { userId },
        update: {
          creditsCents: { increment: amountCents },
        },
        create: {
          userId,
          creditsCents: amountCents,
          autoTopupEnabled: customData.auto_topup !== "false",
          topupThresholdCents: 500,
          topupAmountCents: 2500,
        },
      });

      await prisma.instance.updateMany({
        where: { userId, status: "PAUSED" },
        data: { status: "ACTIVE" },
      });

      console.log(`✅ Credited ${amountCents} cents to user ${userId}`);
      break;
    }

    case "subscription.created": {
      const userId = customData.user_id;
      if (!userId) {
        console.error("No user_id in subscription.created payload");
        break;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customer_id || undefined,
        },
      });

      if (customData.auto_topup) {
        await prisma.balance.update({
          where: { userId },
          data: { autoTopupEnabled: customData.auto_topup !== "false" },
        }).catch(() => undefined);
      }

      console.log(`✅ Stored Paddle subscription ${data.id} for user ${userId}`);
      break;
    }

    case "subscription.canceled": {
      const userId = customData.user_id;
      if (!userId) {
        console.error("No user_id in subscription.canceled payload");
        break;
      }

      await prisma.instance.updateMany({
        where: { userId },
        data: { status: "PAUSED" },
      });

      console.log(`⚠️ Subscription canceled for user ${userId}, instances paused`);
      break;
    }

    default:
      console.log(`Unhandled Paddle event: ${eventType}`);
  }

  return NextResponse.json({ received: true });
}
