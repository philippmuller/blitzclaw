/**
 * Top-up endpoint
 * 
 * BYOK users don't need top-ups - they pay Anthropic directly for usage.
 * This endpoint is disabled for BYOK mode.
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

  // BYOK users don't use balance/top-ups - they pay Anthropic directly
  if (user.billingMode === "byok") {
    return NextResponse.json(
      { 
        error: "Top-ups are not available for BYOK plans. You pay Anthropic directly for API usage.",
        billingMode: "byok"
      },
      { status: 400 }
    );
  }

  // Future: Implement managed billing top-ups here
  return NextResponse.json(
    { error: "Managed billing coming soon. BYOK is currently the only available plan." },
    { status: 501 }
  );
}
