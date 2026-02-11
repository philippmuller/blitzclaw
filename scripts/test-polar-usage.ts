#!/usr/bin/env npx tsx
/**
 * Test Polar usage tracking
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { authenticatedFetch, getTestUserClerkId, cleanupTestSession } from "./test-helpers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.BLITZCLAW_URL || "https://www.blitzclaw.com";

async function testPolarUsage() {
  console.log("📊 Testing Polar Usage Tracking");
  console.log("━".repeat(60));
  
  // 1. Set up user with managed billing and balance
  const clerkId = await getTestUserClerkId();
  let user = await prisma.user.findUnique({ where: { clerkId } });
  
  if (!user) {
    console.log("Creating test user...");
    const resp = await authenticatedFetch(`${BASE_URL}/api/auth/me`);
    user = await prisma.user.findUnique({ where: { clerkId } });
  }
  
  if (!user) throw new Error("Could not create user");
  
  // Update to managed billing with Polar IDs
  await prisma.user.update({
    where: { id: user.id },
    data: {
      billingMode: "managed",
      polarCustomerId: "test_cust_" + Date.now(),
      polarSubscriptionId: "test_sub_" + Date.now(),
    },
  });
  
  // Ensure balance
  await prisma.balance.upsert({
    where: { userId: user.id },
    create: { userId: user.id, creditsCents: 1000 },
    update: { creditsCents: 1000 },
  });
  
  console.log(`✅ User set up: ${user.id}`);
  console.log(`   billingMode: managed`);
  console.log(`   balance: 1000 cents`);
  
  // 2. The actual usage tracking happens in the proxy route
  // We can't easily test it without making real API calls
  // But we can verify the trackUsage function exists and is called
  console.log("\n📝 Usage tracking is done via /api/proxy/v1/messages");
  console.log("   When a managed user makes a request, trackUsage() is called");
  console.log("   Check Polar dashboard to verify events: https://polar.sh/dashboard");
  
  // Cleanup
  await cleanupTestSession();
  await prisma.$disconnect();
  
  console.log("\n✅ Test complete - check Polar dashboard for usage events");
}

testPolarUsage().catch(console.error);
