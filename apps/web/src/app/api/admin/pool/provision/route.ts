import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { provisionPoolServers, getPoolStatus } from "@/lib/provisioning";

// TODO: Add proper admin role check
async function isAdmin(clerkId: string): Promise<boolean> {
  console.log(`Admin pool provision accessed by: ${clerkId}`);
  return true;
}

/**
 * POST /api/admin/pool/provision - Provision new servers for the pool
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await isAdmin(clerkId);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse request body
  const body = await req.json().catch(() => ({}));
  const count = body.count || 1;

  if (typeof count !== "number" || count < 1 || count > 10) {
    return NextResponse.json(
      { error: "Count must be between 1 and 10" },
      { status: 400 }
    );
  }

  try {
    const result = await provisionPoolServers(count);
    const status = await getPoolStatus();

    return NextResponse.json({
      success: true,
      provisioned: result.provisioned,
      errors: result.errors,
      pool: {
        available: status.available,
        assigned: status.assigned,
        provisioning: status.provisioning,
        total: status.total,
      },
    });
  } catch (error) {
    console.error("Failed to provision servers:", error);
    return NextResponse.json(
      { error: "Failed to provision servers", details: (error as Error).message },
      { status: 500 }
    );
  }
}
