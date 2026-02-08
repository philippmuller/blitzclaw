/**
 * Generate Creem customer portal link
 * Allows users to manage subscription, update payment method, view invoices
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";

const CREEM_API_KEY = process.env.CREEM_API_KEY;
const CREEM_API_URL = process.env.CREEM_API_URL || 
  (CREEM_API_KEY?.includes('test') 
    ? "https://test-api.creem.io/v1" 
    : "https://api.creem.io/v1");

export async function POST() {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user?.creemCustomerId) {
    return NextResponse.json(
      { error: "No subscription found. Please subscribe first." },
      { status: 404 }
    );
  }

  if (!CREEM_API_KEY) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 500 }
    );
  }

  // Generate customer portal link
  const response = await fetch(`${CREEM_API_URL}/customers/billing-portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CREEM_API_KEY,
    },
    body: JSON.stringify({
      customer_id: user.creemCustomerId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to get portal link:", response.status, errorText);
    return NextResponse.json(
      { error: "Failed to generate portal link" },
      { status: 500 }
    );
  }

  const data = await response.json();
  const portalUrl = data.customer_portal_link || data.url;

  if (!portalUrl) {
    return NextResponse.json(
      { error: "No portal URL returned" },
      { status: 500 }
    );
  }

  return NextResponse.json({ portalUrl });
}
