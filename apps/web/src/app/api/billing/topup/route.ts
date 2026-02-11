/**
 * Top-up endpoint
 * 
 * With Polar's metered billing, usage overages are billed automatically.
 * Manual top-ups are not needed - users pay per credit used.
 * 
 * This endpoint is kept for future use but currently disabled.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";

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

  // BYOK users don't use balance/top-ups
  if (user.billingMode === "byok") {
    return NextResponse.json(
      { 
        error: "Top-ups are not available for BYOK plans. You pay Anthropic directly for API usage.",
        billingMode: "byok"
      },
      { status: 400 }
    );
  }

  // With Polar metered billing, usage is billed automatically
  return NextResponse.json(
    { 
      error: "Manual top-ups are not needed. Your usage is billed automatically at $0.01 per credit.",
      message: "Visit the billing portal to view your usage and payment methods.",
    },
    { status: 400 }
  );
}
