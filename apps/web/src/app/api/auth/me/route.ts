import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get or create user in our database
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { balance: true, instances: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        balance: {
          create: {
            creditsCents: 0,
            autoTopupEnabled: false,
            topupThresholdCents: 500,
            topupAmountCents: 2000,
          },
        },
      },
      include: { balance: true, instances: true },
    });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    balance: {
      creditsCents: user.balance?.creditsCents ?? 0,
      autoTopupEnabled: user.balance?.autoTopupEnabled ?? false,
    },
    instanceCount: user.instances.length,
  });
}
