/**
 * Upgrade/downgrade subscription endpoint
 * 
 * With Polar, subscription changes are handled through the customer portal.
 * This endpoint redirects to the portal for plan changes.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { getCustomerPortalUrl } from "@/lib/polar";

export async function POST() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ 
    where: { clerkId },
    include: { balance: true }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.polarSubscriptionId) {
    return NextResponse.json(
      { error: "No subscription to upgrade. Please subscribe first." },
      { status: 400 }
    );
  }

  if (!user.polarCustomerId) {
    return NextResponse.json(
      { error: "Customer ID not found. Please contact support." },
      { status: 500 }
    );
  }

  try {
    // Redirect to Polar's customer portal for plan changes
    const portalUrl = await getCustomerPortalUrl(user.polarCustomerId);
    return NextResponse.json({
      success: true,
      portalUrl,
      message: "Manage your subscription in the billing portal",
    });
  } catch (error) {
    console.error("Failed to get Polar portal:", error);
    return NextResponse.json(
      { error: "Failed to access billing portal", details: (error as Error).message },
      { status: 500 }
    );
  }
}
