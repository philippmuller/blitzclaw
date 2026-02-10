/**
 * User info endpoint - returns current user's billing info
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";

export async function GET() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { balance: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    billingMode: user.billingMode,
    balance: user.balance ? {
      creditsCents: user.balance.creditsCents,
      autoTopupEnabled: user.balance.autoTopupEnabled,
    } : null,
  });
}
