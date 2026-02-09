/**
 * Generate Paddle customer portal link
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { createCustomerPortalSession } from "@/lib/paddle";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com").trim();

export async function POST() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId } });

  if (!user?.paddleCustomerId) {
    return NextResponse.json(
      { error: "No subscription found. Please subscribe first." },
      { status: 404 }
    );
  }

  try {
    const session = await createCustomerPortalSession(user.paddleCustomerId, `${APP_URL}/dashboard`);
    const portalUrl =
      session?.data?.url ||
      session?.data?.portal_url ||
      session?.data?.portalUrl ||
      session?.url ||
      session?.portal_url ||
      session?.portalUrl ||
      null;

    if (!portalUrl) {
      return NextResponse.json(
        { error: "No portal URL returned" },
        { status: 500 }
      );
    }

    return NextResponse.json({ portalUrl });
  } catch (error) {
    console.error("Failed to get Paddle portal link:", error);
    return NextResponse.json(
      { error: "Failed to generate portal link" },
      { status: 500 }
    );
  }
}
