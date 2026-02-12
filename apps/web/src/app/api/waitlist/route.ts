/**
 * Waitlist API - collect emails when no servers are available
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { getPoolStatus } from "@/lib/provisioning";

// Check if we have capacity
export async function GET() {
  try {
    const status = await getPoolStatus();
    const hasCapacity = status.available > 0 || status.provisioning > 0;
    
    return NextResponse.json({
      hasCapacity,
      available: status.available,
      provisioning: status.provisioning,
    });
  } catch (error) {
    console.error("Failed to check capacity:", error);
    return NextResponse.json({ hasCapacity: true }); // Fail open
  }
}

// Add email to waitlist
export async function POST(req: NextRequest) {
  try {
    const { email, plan } = await req.json();
    
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    // Check if already on waitlist
    const existing = await prisma.waitlist.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: "You're already on the waitlist!",
      });
    }

    // Add to waitlist
    await prisma.waitlist.create({
      data: {
        email,
        plan: plan || "basic",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Added to waitlist! We'll email you when capacity is available.",
    });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json(
      { error: "Failed to join waitlist" },
      { status: 500 }
    );
  }
}
