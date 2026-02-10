#!/usr/bin/env npx tsx
/**
 * Seed the server pool with initial servers
 * 
 * Run this to pre-provision servers for faster instance creation.
 * Usage: npm run seed-pool
 */

import { config } from "dotenv";
config({ path: ".env.local" });

async function seedPool() {
  // Dynamic import to ensure env is loaded
  const { maintainPool, getPoolStatus } = await import("../apps/web/src/lib/provisioning");
  
  console.log("🌱 Seeding server pool...\n");
  
  const before = await getPoolStatus();
  console.log("Current pool status:", before);
  
  if (before.available >= before.minPoolSize) {
    console.log(`\n✅ Pool already has ${before.available} available servers (min: ${before.minPoolSize})`);
    return;
  }
  
  console.log(`\nNeed to provision ${before.minPoolSize - before.available} more servers...`);
  
  const result = await maintainPool();
  
  console.log("\n📊 Results:");
  console.log(`  Provisioned: ${result.provisioned}`);
  console.log(`  Cleaned up: ${result.cleaned}`);
  
  if (result.errors.length > 0) {
    console.log("  Errors:");
    result.errors.forEach(e => console.log(`    - ${e}`));
  }
  
  const after = await getPoolStatus();
  console.log("\nFinal pool status:", after);
  
  console.log("\n✅ Pool seeding complete!");
  console.log("Note: Servers are in PROVISIONING state. They'll become AVAILABLE when cloud-init completes (~3-5 min).");
}

seedPool()
  .catch(console.error)
  .finally(() => process.exit(0));
