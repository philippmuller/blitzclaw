/**
 * Update instance status/fields directly
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma, InstanceStatus } from "@blitzclaw/db";

const DEBUG_KEY = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";

export async function POST(req: NextRequest) {
  const debugKey = req.nextUrl.searchParams.get("key");
  
  if (debugKey !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { instanceId, status, lastHealthCheck } = body;

  if (!instanceId) {
    return NextResponse.json({ error: "instanceId required" }, { status: 400 });
  }

  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (status) {
    if (!Object.values(InstanceStatus).includes(status as InstanceStatus)) {
      return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
    }
    updateData.status = status;
  }

  if (lastHealthCheck !== undefined) {
    updateData.lastHealthCheck = lastHealthCheck ? new Date(lastHealthCheck) : new Date();
  }

  const updated = await prisma.instance.update({
    where: { id: instanceId },
    data: updateData,
    select: {
      id: true,
      status: true,
      ipAddress: true,
      lastHealthCheck: true,
    },
  });

  return NextResponse.json({
    success: true,
    instance: updated,
  });
}
