import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { repairInstance } from "@/lib/provisioning";

/**
 * POST /api/instances/[id]/repair - Run openclaw doctor --fix on an instance
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
    const result = await repairInstance(id, user.id);

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || "Repair failed",
          output: result.output 
        },
        { status: result.error?.includes("not found") ? 404 : 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Instance repaired and restarted",
      output: result.output
    });
  } catch (error) {
    console.error("Failed to repair instance:", error);
    return NextResponse.json(
      { error: "Failed to repair instance", details: (error as Error).message },
      { status: 500 }
    );
  }
}
