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
import { getDroplet } from "@/lib/digitalocean";
import { getVultrInstance } from "@/lib/vultr";

const DEBUG_KEY = "blitz-debug-2026";

/**
 * Clean up pool servers that no longer exist in their cloud provider
 */
async function cleanupDeletedCloudServers(): Promise<number> {
  // Get all pool servers from DB
  const poolServers = await prisma.serverPool.findMany({
    select: { id: true, hetznerServerId: true, status: true, provider: true },
  });

  let cleaned = 0;
  for (const server of poolServers) {
    let serverExists = false;
    
    try {
      if (server.provider === "DIGITALOCEAN") {
        // Check DigitalOcean
        const droplet = await getDroplet(parseInt(server.hetznerServerId, 10));
        serverExists = droplet !== null;
      } else if (server.provider === "VULTR") {
        // Check Vultr
        const instance = await getVultrInstance(server.hetznerServerId);
        serverExists = instance !== null;
      } else {
        // Default to Hetzner
        const hetznerServer = await getServer(parseInt(server.hetznerServerId, 10));
        serverExists = hetznerServer !== null;
      }
    } catch {
      // If we can't check, assume it doesn't exist
      serverExists = false;
    }
    
    if (!serverExists) {
      // Server doesn't exist in cloud provider - delete from DB
      console.log(`Pool server ${server.id} (${server.provider || "HETZNER"} ${server.hetznerServerId}) no longer exists - removing from DB`);
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
    
    // First clean up pool servers that don't exist in cloud providers
    const deletedFromDb = await cleanupDeletedCloudServers();
    
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
