import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPoolStatus } from "@/lib/provisioning";

// TODO: Add proper admin role check
// For now, we'll just check auth and log access
async function isAdmin(clerkId: string): Promise<boolean> {
  // In production, check against admin user list or Clerk metadata
  // For MVP, allow any authenticated user (we'll tighten this later)
  console.log(`Admin pool status accessed by: ${clerkId}`);
  return true;
}

/**
 * GET /api/admin/pool/status - Get server pool status
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isAdmin(clerkId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const status = await getPoolStatus();

    return NextResponse.json({
      pool: {
        available: status.available,
        assigned: status.assigned,
        provisioning: status.provisioning,
        total: status.total,
      },
      config: {
        minPoolSize: status.minPoolSize,
        maxPoolSize: status.maxPoolSize,
      },
      health: {
        healthy: status.available >= status.minPoolSize,
        message: status.available < status.minPoolSize
          ? `Pool below minimum (${status.available}/${status.minPoolSize})`
          : "Pool healthy",
      },
    });
  } catch (error) {
    console.error("Failed to get pool status:", error);
    return NextResponse.json(
      { error: "Failed to get pool status", details: (error as Error).message },
      { status: 500 }
    );
  }
}
