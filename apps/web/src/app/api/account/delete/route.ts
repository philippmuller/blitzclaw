/**
 * Delete Account endpoint
 *
 * Deletes user account and all associated data:
 * - Cancels Paddle subscription
 * - Deletes Hetzner servers
 * - Deletes all database records
 */

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@blitzclaw/db";
import { deleteServer } from "@/lib/hetzner";
import { cancelSubscription } from "@/lib/paddle";

export async function DELETE() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      instances: true,
      balance: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const errors: string[] = [];

  // 1. Cancel Paddle subscription (if exists)
  if (user.paddleSubscriptionId) {
    try {
      await cancelSubscription(user.paddleSubscriptionId);
      console.log(`Cancelled Paddle subscription ${user.paddleSubscriptionId} for user ${user.id}`);
    } catch (error) {
      console.error("Failed to cancel Paddle subscription:", error);
      errors.push(`Subscription cancellation error: ${(error as Error).message}`);
    }
  }

  // 2. Delete Hetzner servers
  for (const instance of user.instances) {
    if (instance.hetznerServerId) {
      try {
        await deleteServer(parseInt(instance.hetznerServerId, 10));
        console.log(`Deleted Hetzner server ${instance.hetznerServerId} for instance ${instance.id}`);
      } catch (error) {
        console.error(`Failed to delete server ${instance.hetznerServerId}:`, error);
        errors.push(`Failed to delete server: ${(error as Error).message}`);
      }
    }
  }

  // 3. Delete from ServerPool (if any assigned)
  await prisma.serverPool.deleteMany({
    where: { assignedTo: { in: user.instances.map((i) => i.id) } },
  });

  // 4. Delete usage logs
  await prisma.usageLog.deleteMany({
    where: { instanceId: { in: user.instances.map((i) => i.id) } },
  });

  // 5. Delete instances
  await prisma.instance.deleteMany({
    where: { userId: user.id },
  });

  // 6. Delete balance
  if (user.balance) {
    await prisma.balance.delete({
      where: { userId: user.id },
    });
  }

  // 7. Delete user from our database
  await prisma.user.delete({
    where: { id: user.id },
  });

  // 8. Delete from Clerk
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(clerkId);
    console.log(`Deleted Clerk user ${clerkId}`);
  } catch (error) {
    console.error("Failed to delete Clerk user:", error);
    errors.push(`Failed to delete auth account: ${(error as Error).message}`);
  }

  if (errors.length > 0) {
    return NextResponse.json({
      success: true,
      message: "Account deleted with some errors",
      errors,
    });
  }

  return NextResponse.json({
    success: true,
    message: "Account and all data deleted successfully",
  });
}
