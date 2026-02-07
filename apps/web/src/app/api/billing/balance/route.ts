import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { balance: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const creditsCents = user.balance?.creditsCents ?? 0;
  const minimumCents = 1000; // $10 minimum

  return NextResponse.json({
    creditsCents,
    creditsDollars: (creditsCents / 100).toFixed(2),
    belowMinimum: creditsCents < minimumCents,
    minimumCents,
    autoTopupEnabled: user.balance?.autoTopupEnabled ?? false,
  });
}
