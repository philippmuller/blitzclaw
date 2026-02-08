import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const CREEM_API_KEY = process.env.CREEM_API_KEY;
// Test mode uses test-api.creem.io
const CREEM_API_URL = process.env.CREEM_API_URL || 
  (CREEM_API_KEY?.includes('test') 
    ? "https://test-api.creem.io/v1" 
    : "https://api.creem.io/v1");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(request: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const amountCents = body.amount_cents || 2000; // Default $20

  // Minimum topup $10
  if (amountCents < 1000) {
    return NextResponse.json(
      { error: "Minimum topup amount is $10 (1000 cents)" },
      { status: 400 }
    );
  }

  // Get or create user
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Select the right product based on amount
  // €25 = 2500 cents, €50 = 5000 cents
  let productId = process.env.CREEM_TOPUP_PRODUCT_ID; // Default €25
  if (amountCents >= 5000) {
    productId = process.env.CREEM_TOPUP_50_PRODUCT_ID || productId;
  }

  if (!productId) {
    return NextResponse.json(
      { error: "Top-up product not configured" },
      { status: 500 }
    );
  }

  // Create Creem checkout session
  try {
    const response = await fetch(`${CREEM_API_URL}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CREEM_API_KEY || "",
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: `${APP_URL}/dashboard?topup=success`,
        request_id: `topup_${user.id}_${Date.now()}`,
        metadata: {
          user_id: user.id,
          clerk_id: userId,
          amount_cents: String(amountCents),
          type: "topup",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Creem API error:", error);
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    const checkout = await response.json();

    return NextResponse.json({
      checkoutUrl: checkout.checkout_url,
      checkoutId: checkout.id,
    });
  } catch (error) {
    console.error("Creem checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
