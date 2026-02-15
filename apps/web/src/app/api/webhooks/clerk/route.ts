import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@blitzclaw/db";

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!CLERK_WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Get the headers
  const svix_id = request.headers.get("svix-id");
  const svix_timestamp = request.headers.get("svix-timestamp");
  const svix_signature = request.headers.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  // Get the body
  const payload = await request.text();

  // Verify the webhook
  const wh = new Webhook(CLERK_WEBHOOK_SECRET);
  let event: {
    type: string;
    data: {
      id: string;
      email_addresses?: Array<{ email_address: string }>;
    };
  };

  try {
    event = wh.verify(payload, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as typeof event;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Handle the event
  if (event.type === "user.created") {
    const { id: clerkId, email_addresses } = event.data;
    const email = email_addresses?.[0]?.email_address ?? "";

    // Create user in our database
    await prisma.user.create({
      data: {
        clerkId,
        email,
        balance: {
          create: {
            creditsCents: 500,
            autoTopupEnabled: false,
            topupThresholdCents: 500,
            topupAmountCents: 2000,
          },
        },
      },
    });

    console.log(`Created user for Clerk ID: ${clerkId}`);
  }

  if (event.type === "user.deleted") {
    const { id: clerkId } = event.data;

    // Delete user from our database
    await prisma.user.delete({
      where: { clerkId },
    }).catch(() => {
      // User might not exist in our DB
      console.log(`User ${clerkId} not found in DB, skipping delete`);
    });

    console.log(`Deleted user for Clerk ID: ${clerkId}`);
  }

  return NextResponse.json({ received: true });
}
