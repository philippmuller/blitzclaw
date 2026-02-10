/**
 * Billing portal redirect
 * Opens Creem's customer billing portal for subscription management
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { getCreemBillingPortal } from "@/lib/creem";

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

  // Try to get Creem billing portal URL
  if (user.creemCustomerId) {
    try {
      const portalUrl = await getCreemBillingPortal(user.creemCustomerId);
      return NextResponse.json({ portalUrl });
    } catch (error) {
      console.error("Failed to get Creem billing portal:", error);
      // Fall back to dashboard URL
    }
  }

  // Fallback to Creem dashboard
  return NextResponse.json({ 
    portalUrl: CREEM_DASHBOARD_URL,
    message: "Manage your subscription at creem.io" 
  });
}
