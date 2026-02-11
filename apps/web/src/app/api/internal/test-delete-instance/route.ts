/**
 * Test endpoint to delete an instance
 * FOR TESTING ONLY - protected by debug key
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, ServerPoolStatus } from "@blitzclaw/db";

const DEBUG_KEY = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";

export async function POST(req: NextRequest) {
  const debugKey = req.nextUrl.searchParams.get("key");
  const instanceId = req.nextUrl.searchParams.get("instance");
  
  if (debugKey !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!instanceId) {
    return NextResponse.json({ error: "instance param required" }, { status: 400 });
  }

  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Return server to pool
  if (instance.hetznerServerId) {
    await prisma.serverPool.updateMany({
      where: { hetznerServerId: instance.hetznerServerId },
      data: { 
        status: ServerPoolStatus.AVAILABLE,
        assignedTo: null,
      },
    });
  }

  // Delete instance
  await prisma.instance.delete({
    where: { id: instanceId },
  });

  return NextResponse.json({
    success: true,
    deleted: instanceId,
    serverReturned: !!instance.hetznerServerId,
  });
}
