/**
 * Billing portal redirect
 * BYOK users manage subscriptions via Creem dashboard directly
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";

const CREEM_DASHBOARD_URL = "https://www.creem.io/dashboard";

export async function POST() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user?.creemSubscriptionId) {
    return NextResponse.json(
      { error: "No subscription found. Please subscribe first." },
      { status: 404 }
    );
  }

  // BYOK users manage their subscription directly via Creem
  // Creem doesn't have a customer portal API, so redirect to dashboard
  return NextResponse.json({ 
    portalUrl: CREEM_DASHBOARD_URL,
    message: "Manage your subscription at creem.io" 
  });
}
