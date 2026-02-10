#!/usr/bin/env npx tsx
/**
 * Test that database schema is in sync with Prisma schema
 * Run this in CI to catch schema drift before deployment
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testSchemaSync() {
  console.log("🔍 Testing database schema sync...\n");
  
  const tests: { name: string; fn: () => Promise<void> }[] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Can query User table
  tests.push({
    name: "Query User table",
    fn: async () => {
      await prisma.user.findFirst();
    }
  });

  // Test 2: Can query Balance table
  tests.push({
    name: "Query Balance table",
    fn: async () => {
      await prisma.balance.findFirst();
    }
  });

  // Test 3: Can query Instance table with all fields
  tests.push({
    name: "Query Instance table",
    fn: async () => {
      await prisma.instance.findFirst();
    }
  });

  // Test 4: Can query ServerPool table
  tests.push({
    name: "Query ServerPool table",
    fn: async () => {
      await prisma.serverPool.findFirst();
    }
  });

  // Test 5: Can query UsageLog table
  tests.push({
    name: "Query UsageLog table",
    fn: async () => {
      await prisma.usageLog.findFirst();
    }
  });

  // Test 6: Can create and delete a test user (full write test)
  tests.push({
    name: "Create/delete test user",
    fn: async () => {
      const testClerkId = `test-schema-${Date.now()}`;
      const user = await prisma.user.create({
        data: {
          clerkId: testClerkId,
          email: `schema-test-${Date.now()}@test.blitzclaw.com`,
        }
      });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  // Run all tests
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`  ✅ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`  ❌ ${test.name}`);
      console.log(`     Error: ${(error as Error).message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log("\n⚠️  Schema drift detected! Run 'npm run db:push' to sync.");
    process.exit(1);
  }
  
  console.log("\n✅ Database schema is in sync with Prisma schema");
}

testSchemaSync()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
