/**
 * Nuclear reset - delete all instances, users, and reset pool
 * USE WITH CAUTION - for testing only
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, ServerPoolStatus } from "@blitzclaw/db";
import { deleteServer } from "@/lib/hetzner";

const DEBUG_KEY = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";

export async function POST(req: NextRequest) {
  const debugKey = req.nextUrl.searchParams.get("key");
  const confirm = req.nextUrl.searchParams.get("confirm");
  const keepPool = req.nextUrl.searchParams.get("keepPool") === "true";
  
  if (debugKey !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (confirm !== "yes-delete-everything") {
    return NextResponse.json({ 
      error: "Add ?confirm=yes-delete-everything to confirm",
      warning: "This will delete ALL instances, users, and optionally pool servers",
      options: "Add &keepPool=true to keep pool servers"
    }, { status: 400 });
  }

  const results: Record<string, number | string[]> = {};

  try {
    // 1. Delete all usage logs first (foreign key constraint)
    const deletedLogs = await prisma.usageLog.deleteMany({});
    results.usageLogs = deletedLogs.count;

    // 2. Get all instances with their pool servers
    const instances = await prisma.instance.findMany({
      include: { serverPool: true }
    });

    // 3. Delete Hetzner servers for assigned instances (not pool)
    const deletedServers: string[] = [];
    for (const instance of instances) {
      if (instance.serverPool?.hetznerServerId) {
        try {
          await deleteServer(parseInt(instance.serverPool.hetznerServerId, 10));
          deletedServers.push(instance.serverPool.hetznerServerId);
        } catch (err) {
          console.error(`Failed to delete Hetzner server ${instance.serverPool.hetznerServerId}:`, err);
        }
      }
    }
    results.hetznerServersDeleted = deletedServers;

    // 4. Delete all instances
    const deletedInstances = await prisma.instance.deleteMany({});
    results.instances = deletedInstances.count;

    // 5. Delete all balances
    const deletedBalances = await prisma.balance.deleteMany({});
    results.balances = deletedBalances.count;

    // 6. Delete all users
    const deletedUsers = await prisma.user.deleteMany({});
    results.users = deletedUsers.count;

    // 7. Handle pool
    if (keepPool) {
      // Reset pool servers to AVAILABLE
      const resetPool = await prisma.serverPool.updateMany({
        where: { status: ServerPoolStatus.ASSIGNED },
        data: { 
          status: ServerPoolStatus.AVAILABLE,
          assignedTo: null,
        }
      });
      results.poolReset = resetPool.count;
    } else {
      // Delete pool entries (but keep Hetzner servers for now)
      const pool = await prisma.serverPool.findMany();
      const deletedPoolServers: string[] = [];
      
      for (const server of pool) {
        try {
          await deleteServer(parseInt(server.hetznerServerId, 10));
          deletedPoolServers.push(server.hetznerServerId);
        } catch (err) {
          console.error(`Failed to delete pool server ${server.hetznerServerId}:`, err);
        }
      }
      results.poolServersDeleted = deletedPoolServers;
      
      const deletedPool = await prisma.serverPool.deleteMany({});
      results.poolEntries = deletedPool.count;
    }

    return NextResponse.json({
      success: true,
      deleted: results,
    });
  } catch (error) {
    return NextResponse.json({
      error: "Reset failed",
      details: (error as Error).message,
      partialResults: results,
    }, { status: 500 });
  }
}
