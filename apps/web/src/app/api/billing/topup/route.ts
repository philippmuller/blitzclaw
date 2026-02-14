/**
 * Top-up endpoint
 *
 * BlitzClaw uses metered billing with automatic charges for managed plans.
 * "Top-up" means opening the billing portal to add/update payment method,
 * review usage, and manage billing preferences.
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
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // BYOK users pay Anthropic directly
  if (user.billingMode === "byok") {
    return NextResponse.json(
      {
        error: "Top-ups are not available for BYOK plans. You pay Anthropic directly for API usage.",
        billingMode: "byok",
      },
      { status: 400 }
    );
  }

  if (!user.polarCustomerId) {
    return NextResponse.json(
      { error: "Billing account not ready yet. Please contact support if this persists." },
      { status: 400 }
    );
  }

  try {
    const portalUrl = await getCustomerPortalUrl(user.polarCustomerId);

    return NextResponse.json({
      checkoutUrl: portalUrl,
      mode: "metered",
      message:
        "BlitzClaw bills usage automatically. Use the billing portal to add/update payment methods and review charges.",
    });
  } catch (error) {
    console.error("Failed to create billing portal URL for top-up:", error);
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    );
  }
}
