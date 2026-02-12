/**
 * Internal endpoint to clean up orphaned pool servers
 * 
 * Orphaned servers are:
 * 1. ASSIGNED but have no instance linked (assignedTo: null) - returns to AVAILABLE
 * 2. In DB but no longer exist in Hetzner - deletes from DB
 * 
 * Usage: GET /api/internal/cleanup-orphans?key=blitz-debug-2026
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { cleanupOrphanedServers, getPoolStatus } from "@/lib/provisioning";
import { getServer } from "@/lib/hetzner";

const DEBUG_KEY = "blitz-debug-2026";

/**
 * Clean up pool servers that no longer exist in Hetzner
 */
async function cleanupDeletedHetznerServers(): Promise<number> {
  // Get all pool servers from DB
  const poolServers = await prisma.serverPool.findMany({
    select: { id: true, hetznerServerId: true, status: true },
  });

  let cleaned = 0;
  for (const server of poolServers) {
    // Check if server exists in Hetzner (returns null if not found)
    const hetznerServer = await getServer(parseInt(server.hetznerServerId, 10));
    
    if (!hetznerServer) {
      // Server doesn't exist in Hetzner - delete from DB
      console.log(`Pool server ${server.id} (Hetzner ${server.hetznerServerId}) no longer exists - removing from DB`);
      await prisma.serverPool.delete({ where: { id: server.id } });
      cleaned++;
    }
  }

  return cleaned;
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  
  if (key !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const beforeStatus = await getPoolStatus();
    
    // First clean up pool servers that don't exist in Hetzner
    const deletedFromDb = await cleanupDeletedHetznerServers();
    
    // Then clean up orphaned assigned servers
    const orphansCleaned = await cleanupOrphanedServers();
    
    const afterStatus = await getPoolStatus();

    return NextResponse.json({
      success: true,
      deletedFromDb,
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
