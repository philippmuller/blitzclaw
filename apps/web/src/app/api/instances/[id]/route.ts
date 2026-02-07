import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { getInstance, deleteInstance } from "@/lib/provisioning";

/**
 * GET /api/instances/[id] - Get instance details
 */
export async function GET(
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
  const instance = await getInstance(id, user.id);

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Calculate recent usage stats
  const recentUsage = instance.usageLogs.reduce(
    (acc, log) => ({
      totalCostCents: acc.totalCostCents + log.costCents,
      totalTokensIn: acc.totalTokensIn + log.tokensIn,
      totalTokensOut: acc.totalTokensOut + log.tokensOut,
    }),
    { totalCostCents: 0, totalTokensIn: 0, totalTokensOut: 0 }
  );

  return NextResponse.json({
    id: instance.id,
    status: instance.status,
    channelType: instance.channelType,
    personaTemplate: instance.personaTemplate,
    soulMd: instance.soulMd,
    ipAddress: instance.ipAddress,
    hetznerServerId: instance.hetznerServerId,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
    lastHealthCheck: instance.lastHealthCheck,
    channelConfig: instance.channelConfig ? JSON.parse(instance.channelConfig) : null,
    recentUsage: {
      totalCostCents: recentUsage.totalCostCents,
      totalCostDollars: (recentUsage.totalCostCents / 100).toFixed(2),
      totalTokensIn: recentUsage.totalTokensIn,
      totalTokensOut: recentUsage.totalTokensOut,
      logCount: instance.usageLogs.length,
    },
  });
}

/**
 * DELETE /api/instances/[id] - Delete an instance
 */
export async function DELETE(
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
  const deleted = await deleteInstance(id, user.id);

  if (!deleted) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: "Instance deleted" });
}
