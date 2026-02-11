/**
 * Nuclear reset - delete all instances and pool entries
 * USE WITH CAUTION - for testing only
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const DEBUG_KEY = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";

export async function POST(req: NextRequest) {
  const debugKey = req.nextUrl.searchParams.get("key");
  const confirm = req.nextUrl.searchParams.get("confirm");
  
  if (debugKey !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (confirm !== "yes-delete-everything") {
    return NextResponse.json({ 
      error: "Add ?confirm=yes-delete-everything to confirm",
      warning: "This will delete ALL instances and pool entries"
    }, { status: 400 });
  }

  try {
    // Delete all usage logs first (foreign key constraint)
    const deletedLogs = await prisma.usageLog.deleteMany({});
    
    // Delete all instances
    const deletedInstances = await prisma.instance.deleteMany({});
    
    // Delete all pool entries
    const deletedPool = await prisma.serverPool.deleteMany({});

    return NextResponse.json({
      success: true,
      deleted: {
        usageLogs: deletedLogs.count,
        instances: deletedInstances.count,
        poolEntries: deletedPool.count,
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: "Reset failed",
      details: (error as Error).message,
    }, { status: 500 });
  }
}
