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
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body for auto-topup preference
  let autoTopup = true;
  try {
    const body = await request.json();
    autoTopup = body.autoTopup !== false;
  } catch {
    // Default to true if no body
  }

  // Get or create user in database
  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    // Create user if doesn't exist (first time)
    user = await prisma.user.create({
      data: {
        clerkId,
        email: `${clerkId}@pending.blitzclaw.com`, // Will be updated by webhook
      },
    });
  }

  // Save auto-topup preference for when subscription completes
  await prisma.user.update({
    where: { id: user.id },
    data: {
      // Store in a way that webhook can read it
      // We'll use a simple approach: store in user record temporarily
    },
  });

  if (!CREEM_API_KEY || !CREEM_SUBSCRIPTION_PRODUCT_ID) {
    console.error("Creem not configured");
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 500 }
    );
  }

  // Create Creem subscription checkout
  // Note: Creem doesn't support cancel_url, and success_url must be a simple URL
  const successUrl = `${APP_URL}/onboarding`;
  
  const response = await fetch(`${CREEM_API_URL}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CREEM_API_KEY,
    },
    body: JSON.stringify({
      product_id: CREEM_SUBSCRIPTION_PRODUCT_ID,
      success_url: successUrl,
      customer_id: user.creemCustomerId || undefined,
      request_id: `sub_${user.id}_${Date.now()}`,
      metadata: {
        user_id: user.id,
        clerk_id: clerkId,
        type: "subscription",
        auto_topup: autoTopup ? "true" : "false",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Creem checkout creation failed:", response.status, errorText);
    console.error("Request was:", {
      url: `${CREEM_API_URL}/checkouts`,
      product_id: CREEM_SUBSCRIPTION_PRODUCT_ID,
      user_id: user.id,
    });
    // Include debug info to help diagnose issues
    return NextResponse.json(
      { 
        error: "Failed to create checkout",
        debug: {
          creem_status: response.status,
          creem_error: errorText.substring(0, 500),
          creem_url: CREEM_API_URL,
          success_url: successUrl,
          app_url: APP_URL,
          product_id_set: !!CREEM_SUBSCRIPTION_PRODUCT_ID,
          product_id_prefix: CREEM_SUBSCRIPTION_PRODUCT_ID?.substring(0, 10),
        }
      },
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
