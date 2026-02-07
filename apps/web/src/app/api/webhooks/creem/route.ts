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
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-creem-signature") || "";

  // Verify webhook signature
  if (!verifyCreemSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(payload);

  // Handle checkout.completed event
  if (event.event_type === "checkout.completed" || event.type === "checkout.completed") {
    const metadata = event.data?.metadata || event.metadata || {};
    const userId = metadata.user_id;
    const amountCents = parseInt(metadata.amount_cents || "2000", 10);

    if (!userId) {
      console.error("No user_id in webhook metadata:", event);
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    // Credit the user's balance
    await prisma.balance.upsert({
      where: { userId },
      update: {
        creditsCents: {
          increment: amountCents,
        },
      },
      create: {
        userId,
        creditsCents: amountCents,
        autoTopupEnabled: false,
        topupThresholdCents: 500,
        topupAmountCents: 2000,
      },
    });

    console.log(`Credited ${amountCents} cents to user ${userId}`);
  }

  return NextResponse.json({ received: true });
}
