import { NextRequest, NextResponse } from "next/server";
import { prisma, InstanceStatus } from "@blitzclaw/db";
import { sendInstanceReadyEmail } from "@/lib/email";

/**
 * POST /api/internal/instance-ready
 * 
 * Called by cloud-init when an instance finishes setup.
 * Marks the instance as ACTIVE and sends email notification.
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

    // Helper to send notification email
    async function notifyUser(instanceId: string) {
      try {
        const inst = await prisma.instance.findUnique({
          where: { id: instanceId },
          include: { user: true },
        });
        if (inst?.user?.email) {
          // Try to extract bot username from channel config
          let botUsername = "your_bot";
          if (inst.channelConfig) {
            try {
              const config = JSON.parse(inst.channelConfig);
              botUsername = config.botUsername || config.bot_username || "your_bot";
            } catch {
              // Ignore parse errors
            }
          }
          await sendInstanceReadyEmail(inst.user.email, botUsername);
          console.log(`📧 Sent instance ready email to ${inst.user.email}`);
        }
      } catch (e) {
        console.error("Failed to send instance ready email:", e);
      }
    }

    // Find the instance or pool entry
    // The instance_id from cloud-init is the Hetzner server ID (from metadata service)
    // It might also be a pool ID or instance ID for backwards compatibility
    const instanceIdStr = String(instance_id);
    
    // First try to find by pool entry (checking hetznerServerId which stores the Hetzner ID)
    const poolEntry = await prisma.serverPool.findFirst({
      where: {
        OR: [
          { id: instanceIdStr },
          { hetznerServerId: instanceIdStr },
        ]
      },
      include: {
        instance: true,
      }
    });
    
    console.log(`Looking for pool entry with id=${instanceIdStr}, found:`, poolEntry?.id || "none");

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
      
      // Send email notification
      await notifyUser(poolEntry.assignedTo);
      
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
      
      // Send email notification
      await notifyUser(instance.id);
      
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
