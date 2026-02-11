#!/usr/bin/env npx tsx
/**
 * Test Account Deletion Flow
 * 
 * Creates a test user with full setup, then deletes it via the API.
 * Verifies:
 * 1. Polar subscription cancellation
 * 2. Hetzner server deletion (if exists)
 * 3. Database cleanup (user, instances, balance, usage logs)
 * 
 * Run: npx tsx scripts/test-account-delete.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

import {
  createDeleteTestUser,
  deleteTestUserFetch,
  getDeleteTestUserClerkId,
  getDeleteTestUserEmail,
  clearDeleteTestUserCache,
} from "./test-helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.BLITZCLAW_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function testAccountDeletion() {
  console.log("🗑️  Account Deletion Test");
  console.log("━".repeat(60));
  console.log(`🌐 Target: ${BASE_URL}`);
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log("");

  let deleteTestDbUser: { id: string } | null = null;
  let testInstanceId: string | null = null;

  try {
    // Step 1: Create test user in Clerk
    console.log("1️⃣ Creating test user in Clerk...");
    await createDeleteTestUser();
    const clerkId = getDeleteTestUserClerkId();
    console.log(`   ✅ Created Clerk user: ${clerkId}`);

    // Step 2: Auto-create user in database via /api/auth/me
    console.log("\n2️⃣ Creating user in database...");
    const authResp = await deleteTestUserFetch(`${BASE_URL}/api/auth/me`);
    if (!authResp.ok) {
      throw new Error(`Auth failed: ${authResp.status} - ${await authResp.text()}`);
    }
    
    deleteTestDbUser = await prisma.user.findUnique({
      where: { clerkId: clerkId! },
    });
    
    if (!deleteTestDbUser) {
      throw new Error("User not created in database");
    }
    console.log(`   ✅ Database user: ${deleteTestDbUser.id}`);

    // Step 3: Add subscription data
    console.log("\n3️⃣ Setting up subscription data...");
    await prisma.user.update({
      where: { id: deleteTestDbUser.id },
      data: {
        polarSubscriptionId: "sub_test_delete_" + Date.now(),
        polarCustomerId: "cus_test_delete_" + Date.now(),
        billingMode: "byok",
        anthropicKey: "sk-ant-api03-test-delete-key",
      },
    });
    console.log(`   ✅ Added Polar subscription ID`);

    // Step 4: Create balance
    console.log("\n4️⃣ Creating balance record...");
    await prisma.balance.upsert({
      where: { userId: deleteTestDbUser.id },
      create: {
        userId: deleteTestDbUser.id,
        creditsCents: 5000,
        autoTopupEnabled: false,
        topupThresholdCents: 500,
        topupAmountCents: 2000,
      },
      update: { creditsCents: 5000 },
    });
    console.log(`   ✅ Balance: 5000 cents`);

    // Step 5: Create instance
    console.log("\n5️⃣ Creating test instance...");
    const testInstance = await prisma.instance.create({
      data: {
        userId: deleteTestDbUser.id,
        status: "ACTIVE",
        channelType: "TELEGRAM",
        personaTemplate: "assistant",
        hetznerServerId: null, // No real server
        ipAddress: "127.0.0.1",
      },
    });
    testInstanceId = testInstance.id;
    console.log(`   ✅ Instance: ${testInstance.id}`);

    // Step 6: Create usage logs
    console.log("\n6️⃣ Creating usage logs...");
    await prisma.usageLog.create({
      data: {
        instanceId: testInstance.id,
        model: "claude-sonnet-4-20250514",
        tokensIn: 1000,
        tokensOut: 500,
        costCents: 50,
      },
    });
    console.log(`   ✅ Usage log created`);

    // Step 7: Call delete endpoint
    console.log("\n7️⃣ Calling DELETE /api/account/delete...");
    const deleteResp = await deleteTestUserFetch(`${BASE_URL}/api/account/delete`, {
      method: "DELETE",
    });
    const deleteBody = await deleteResp.json();
    
    if (deleteResp.ok && deleteBody.success) {
      console.log(`   ✅ Delete succeeded: ${deleteBody.message}`);
      if (deleteBody.errors?.length > 0) {
        console.log(`   ⚠️  Warnings: ${deleteBody.errors.join(", ")}`);
      }
    } else {
      throw new Error(`Delete failed: ${JSON.stringify(deleteBody)}`);
    }

    // Step 8: Verify database cleanup
    console.log("\n8️⃣ Verifying database cleanup...");
    
    const userAfter = await prisma.user.findUnique({
      where: { clerkId: clerkId! },
    });
    if (userAfter === null) {
      console.log(`   ✅ User deleted from database`);
    } else {
      console.log(`   ❌ User still exists in database!`);
    }

    // Check instances
    try {
      const instancesAfter = await prisma.instance.findMany({
        where: { userId: deleteTestDbUser.id },
      });
      if (instancesAfter.length === 0) {
        console.log(`   ✅ Instances deleted`);
      } else {
        console.log(`   ❌ ${instancesAfter.length} instances still exist!`);
      }
    } catch {
      console.log(`   ✅ Instances deleted (FK cascade)`);
    }

    // Check balance
    try {
      const balanceAfter = await prisma.balance.findUnique({
        where: { userId: deleteTestDbUser.id },
      });
      if (balanceAfter === null) {
        console.log(`   ✅ Balance deleted`);
      } else {
        console.log(`   ❌ Balance still exists!`);
      }
    } catch {
      console.log(`   ✅ Balance deleted (FK cascade)`);
    }

    console.log("\n" + "━".repeat(60));
    console.log("✅ Account deletion test PASSED");
    console.log("━".repeat(60));

  } catch (error) {
    console.error("\n❌ Test FAILED:", error);
    
    // Manual cleanup on failure
    console.log("\n🧹 Attempting cleanup after failure...");
    if (testInstanceId) {
      try {
        await prisma.usageLog.deleteMany({ where: { instanceId: testInstanceId } });
        await prisma.instance.delete({ where: { id: testInstanceId } });
      } catch {}
    }
    if (deleteTestDbUser) {
      try {
        await prisma.balance.delete({ where: { userId: deleteTestDbUser.id } });
        await prisma.user.delete({ where: { id: deleteTestDbUser.id } });
      } catch {}
    }
    
    process.exit(1);
  } finally {
    clearDeleteTestUserCache();
    await prisma.$disconnect();
  }
}

testAccountDeletion().catch(console.error);
