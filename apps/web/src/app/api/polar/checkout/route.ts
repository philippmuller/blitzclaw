/**
 * Polar Checkout API
 * 
 * Creates a Polar checkout session and redirects to payment page.
 * Called from subscribe flow after user selects a plan.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { createCheckout, POLAR_PRODUCTS, polarConfig } from "@/lib/polar";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

export async function GET(request: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.redirect(`${APP_URL}/sign-in`);
  }

  const searchParams = request.nextUrl.searchParams;
  const productId = searchParams.get("product");
  const metadataUserId = searchParams.get("metadata[user_id]");
  const metadataClerkId = searchParams.get("metadata[clerk_id]");
  const metadataPlan = searchParams.get("metadata[plan]") || "basic";
  const metadataByok = searchParams.get("metadata[byok]") || "false";

  if (!productId) {
    return NextResponse.json({ error: "Missing product ID" }, { status: 400 });
  }

  // Get Clerk user for email
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

  // Get or verify user in our database
  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user && metadataUserId) {
    user = await prisma.user.findUnique({
      where: { id: metadataUserId },
    });
  }

  if (!user) {
    // Create user if not exists
    user = await prisma.user.create({
      data: {
        clerkId,
        email: email || `${clerkId}@pending.blitzclaw.com`,
        plan: metadataPlan as "basic" | "pro",
        billingMode: metadataByok === "true" ? "byok" : "managed",
      },
    });
  }

  try {
    // Create Polar checkout
    const checkout = await createCheckout({
      productId,
      successUrl: `${APP_URL}/onboarding?subscription=success&tier=${metadataPlan}`,
      customerEmail: email,
      externalCustomerId: user.id, // Our user ID as external reference
      metadata: {
        user_id: user.id,
        clerk_id: clerkId,
        plan: metadataPlan,
        byok: metadataByok,
      },
    });

    console.log(`Created Polar checkout for user ${user.id}`, {
      checkoutId: checkout.id,
      plan: metadataPlan,
      server: polarConfig.server,
    });

    // Redirect to Polar checkout
    return NextResponse.redirect(checkout.url);
  } catch (error) {
    console.error("Failed to create Polar checkout:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for programmatic checkout creation
 */
export async function POST(request: NextRequest) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { plan = "basic", byokMode = false } = body;

  const productId = plan === "pro" ? POLAR_PRODUCTS.pro : POLAR_PRODUCTS.basic;

  if (!productId) {
    return NextResponse.json(
      { error: `Product not configured for plan: ${plan}` },
      { status: 500 }
    );
  }

  // Get user
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId,
        email: email || `${clerkId}@pending.blitzclaw.com`,
        plan: plan as "basic" | "pro",
        billingMode: byokMode ? "byok" : "managed",
      },
    });
  }

  try {
    const checkout = await createCheckout({
      productId,
      successUrl: `${APP_URL}/onboarding?subscription=success&tier=${plan}`,
      customerEmail: email,
      externalCustomerId: user.id,
      metadata: {
        user_id: user.id,
        clerk_id: clerkId,
        plan,
        byok: String(byokMode),
      },
    });

    return NextResponse.json({ checkoutUrl: checkout.url });
  } catch (error) {
    console.error("Failed to create Polar checkout:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
