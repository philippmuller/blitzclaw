/**
 * Internal endpoint to clean up orphaned pool servers
 * 
 * Orphaned servers are ASSIGNED but have no instance linked (assignedTo: null).
 * This returns them to AVAILABLE status.
 * 
 * Usage: GET /api/internal/cleanup-orphans?key=blitz-debug-2026
 */

import { NextRequest, NextResponse } from "next/server";
import { cleanupOrphanedServers, getPoolStatus } from "@/lib/provisioning";

const DEBUG_KEY = "blitz-debug-2026";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  
  if (key !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const beforeStatus = await getPoolStatus();
    const orphansCleaned = await cleanupOrphanedServers();
    const afterStatus = await getPoolStatus();

    return NextResponse.json({
      success: true,
      orphansCleaned,
      before: beforeStatus,
      after: afterStatus,
    });
  } catch (error) {
    console.error("Failed to clean up orphans:", error);
    return NextResponse.json(
      { error: "Cleanup failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
