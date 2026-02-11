/**
 * Billing portal redirect
 * Opens Polar's customer portal for subscription management
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

  const user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user?.polarSubscriptionId) {
    return NextResponse.json(
      { error: "No subscription found. Please subscribe first." },
      { status: 404 }
    );
  }

  if (!user.polarCustomerId) {
    return NextResponse.json(
      { error: "Customer ID not found. Please contact support." },
      { status: 500 }
    );
  }

  try {
    const portalUrl = await getCustomerPortalUrl(user.polarCustomerId);
    return NextResponse.json({ portalUrl });
  } catch (error) {
    console.error("Failed to get Polar billing portal:", error);
    return NextResponse.json(
      { error: "Failed to get billing portal. Please try again." },
      { status: 500 }
    );
  }
}
