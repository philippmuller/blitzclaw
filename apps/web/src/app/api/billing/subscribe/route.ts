/**
 * Subscribe endpoint - creates a Creem subscription checkout
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";

const CREEM_API_KEY = process.env.CREEM_API_KEY;
// Test mode uses test-api.creem.io
const CREEM_API_URL = process.env.CREEM_API_URL || 
  (CREEM_API_KEY?.includes('test') 
    ? "https://test-api.creem.io/v1" 
    : "https://api.creem.io/v1");
const CREEM_SUBSCRIPTION_PRODUCT_ID = process.env.CREEM_SUBSCRIPTION_PRODUCT_ID;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com";

export async function POST() {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!CREEM_API_KEY || !CREEM_SUBSCRIPTION_PRODUCT_ID) {
    console.error("Creem not configured");
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 500 }
    );
  }

  // Create Creem subscription checkout
  const response = await fetch(`${CREEM_API_URL}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CREEM_API_KEY,
    },
    body: JSON.stringify({
      product_id: CREEM_SUBSCRIPTION_PRODUCT_ID,
      success_url: `${APP_URL}/dashboard?subscription=success`,
      cancel_url: `${APP_URL}/dashboard?subscription=cancelled`,
      customer_id: user.creemCustomerId || undefined,
      metadata: {
        user_id: user.id,
        clerk_id: clerkId,
        type: "subscription",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Creem checkout creation failed:", response.status, errorText);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }

  const data = await response.json();
  const checkoutUrl = data.checkout_url || data.url;

  if (!checkoutUrl) {
    console.error("No checkout URL in Creem response:", data);
    return NextResponse.json(
      { error: "Failed to get checkout URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ checkoutUrl });
}
