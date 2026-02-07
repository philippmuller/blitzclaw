import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { restartInstance } from "@/lib/provisioning";

/**
 * POST /api/instances/[id]/restart - Restart an instance
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  
  try {
    const restarted = await restartInstance(id, user.id);

    if (!restarted) {
      return NextResponse.json(
        { error: "Instance not found or not running" },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Instance restart initiated" 
    });
  } catch (error) {
    console.error("Failed to restart instance:", error);
    return NextResponse.json(
      { error: "Failed to restart instance", details: (error as Error).message },
      { status: 500 }
    );
  }
}
