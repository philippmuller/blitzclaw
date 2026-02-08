import { NextRequest, NextResponse } from "next/server";
import { prisma, InstanceStatus } from "@blitzclaw/db";

/**
 * POST /api/internal/instance-ready
 * 
 * Called by cloud-init when an instance finishes setup.
 * Marks the instance as ACTIVE.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instance_id } = body;
    
    // Verify the secret matches
    const secret = req.headers.get("x-instance-secret");
    if (!secret) {
      return NextResponse.json({ error: "Missing secret" }, { status: 401 });
    }

    // Find the instance or pool entry
    // The instance_id from cloud-init might be a pool ID or instance ID
    
    // First try to find by pool entry
    const poolEntry = await prisma.serverPool.findFirst({
      where: {
        OR: [
          { id: instance_id },
          { hetznerServerId: instance_id },
        ]
      },
      include: {
        instance: true,
      }
    });

    if (poolEntry?.assignedTo) {
      // Update the associated instance to ACTIVE
      await prisma.instance.update({
        where: { id: poolEntry.assignedTo },
        data: { 
          status: InstanceStatus.ACTIVE,
          lastHealthCheck: new Date(),
        },
      });
      
      console.log(`Instance ${poolEntry.assignedTo} marked as ACTIVE`);
      
      return NextResponse.json({ 
        ok: true, 
        instanceId: poolEntry.assignedTo,
        status: "ACTIVE" 
      });
    }

    // Try to find instance directly
    const instance = await prisma.instance.findFirst({
      where: {
        OR: [
          { id: instance_id },
          { hetznerServerId: instance_id },
        ]
      }
    });

    if (instance) {
      await prisma.instance.update({
        where: { id: instance.id },
        data: { 
          status: InstanceStatus.ACTIVE,
          lastHealthCheck: new Date(),
        },
      });
      
      console.log(`Instance ${instance.id} marked as ACTIVE`);
      
      return NextResponse.json({ 
        ok: true, 
        instanceId: instance.id,
        status: "ACTIVE" 
      });
    }

    // If using server pool without assignment yet, just mark the pool entry as available
    if (poolEntry) {
      await prisma.serverPool.update({
        where: { id: poolEntry.id },
        data: { status: "AVAILABLE" },
      });
      
      console.log(`Pool entry ${poolEntry.id} marked as AVAILABLE`);
      
      return NextResponse.json({ 
        ok: true, 
        poolId: poolEntry.id,
        status: "AVAILABLE" 
      });
    }

    console.log(`Instance not found for ID: ${instance_id}`);
    return NextResponse.json({ 
      ok: false, 
      error: "Instance not found" 
    }, { status: 404 });

  } catch (error) {
    console.error("Instance ready callback error:", error);
    return NextResponse.json({ 
      error: "Internal error",
      details: (error as Error).message 
    }, { status: 500 });
  }
}
