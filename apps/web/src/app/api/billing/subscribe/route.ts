/**
 * Subscribe endpoint - redirects to Polar checkout
 * 
 * Plans:
 * - Basic ($19/mo): cpx11 server + $5 credits
 * - Pro ($39/mo): cpx21 server + $5 credits + advanced features
 * 
 * Users can also use BYOK (bring own API key) - same price, no usage tracking
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

// Polar Product IDs
const POLAR_PRODUCTS = {
  basic: process.env.POLAR_PRODUCT_BASIC_ID,
  pro: process.env.POLAR_PRODUCT_PRO_ID,
};

type PlanType = "basic" | "pro";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get Clerk user for email
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress;

  // Parse request body
  let plan: PlanType = "basic";
  let byokMode = false;
  let anthropicKey: string | undefined;

  try {
    const body = await request.json();
    // Support both "plan" and "tier" field names
    const requestedPlan = body.plan || body.tier;
    if (requestedPlan === "pro" || requestedPlan === "basic") {
      plan = requestedPlan;
    }
    byokMode = body.byokMode === true;
    anthropicKey = body.anthropicKey;
  } catch {
    // Default values
  }

  // Validate BYOK has anthropic key
  if (byokMode && (!anthropicKey || !anthropicKey.startsWith("sk-ant-"))) {
    return NextResponse.json(
      { error: "Valid Anthropic API key required for BYOK mode" },
      { status: 400 }
    );
  }

  // Get or create user in database
  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId,
        email: email || `${clerkId}@pending.blitzclaw.com`,
        billingMode: byokMode ? "byok" : "managed",
        plan,
      },
    });
  } else {
    // Update billing mode and plan
    await prisma.user.update({
      where: { id: user.id },
      data: {
        billingMode: byokMode ? "byok" : "managed",
        plan,
        ...(byokMode && anthropicKey ? { anthropicKey } : {}),
      },
    });
  }

  // Store anthropic key for BYOK users
  if (byokMode && anthropicKey) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        anthropicKey,
        billingMode: "byok",
      },
    });
  }

  // Get Polar product ID
  const productId = POLAR_PRODUCTS[plan];

  if (!productId) {
    console.error(`Polar product not configured for plan: ${plan}`);
    return NextResponse.json(
      { error: `Billing not configured for ${plan} plan. Please try again later.` },
      { status: 500 }
    );
  }

  // Build Polar checkout URL
  // The checkout route at /api/polar/checkout handles this, but we can also redirect directly
  const checkoutUrl = `${APP_URL}/api/polar/checkout?product=${productId}&metadata[user_id]=${user.id}&metadata[clerk_id]=${clerkId}&metadata[plan]=${plan}&metadata[byok]=${byokMode}`;

  console.log("Redirecting to Polar checkout:", { plan, byokMode, userId: user.id });

  return NextResponse.json({ checkoutUrl });
}
