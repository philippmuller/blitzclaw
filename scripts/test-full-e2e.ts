#!/usr/bin/env npx tsx
/**
 * BlitzClaw FULL End-to-End Test
 * 
 * Tests the complete flow including real Hetzner deployment:
 * 1. Auth via Clerk
 * 2. Subscribe (BYOK or Managed)
 * 3. Create instance with real Telegram token
 * 4. Wait for Hetzner provisioning
 * 5. Verify OpenClaw is installed and running
 * 6. Verify Anthropic key is correct (BYOK) or proxy works (Managed)
 * 7. Cleanup
 * 
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx npx tsx scripts/test-full-e2e.ts [--mode byok|managed] [--cleanup]
 * 
 * Cost: ~€0.01-0.02 per run (Hetzner server for ~5 min)
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { 
  authenticatedFetch, 
  getTestUserClerkId, 
  cleanupTestSession,
  getTestUserToken 
} from "./test-helpers";
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as readline from "readline";

const prisma = new PrismaClient();
const BASE_URL = process.env.BLITZCLAW_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.blitzclaw.com";
const HETZNER_API_TOKEN = process.env.HETZNER_API_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_TEST_KEY || process.env.ANTHROPIC_API_KEY;

// Parse args
const args = process.argv.slice(2);
const mode = args.includes("--mode") ? args[args.indexOf("--mode") + 1] : "byok";
const cleanup = args.includes("--cleanup");
const skipDeploy = args.includes("--skip-deploy");

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
  duration?: number;
}

const results: TestResult[] = [];
let testInstanceId: string | null = null;
let testServerId: number | null = null;
let testServerIp: string | null = null;

function log(msg: string) {
  console.log(msg);
}

function pass(name: string, details?: string, duration?: number) {
  results.push({ name, passed: true, details, duration });
  const durationStr = duration ? ` (${(duration/1000).toFixed(1)}s)` : "";
  log(`  ✅ ${name}${details ? ` - ${details}` : ""}${durationStr}`);
}

function fail(name: string, error: string) {
  results.push({ name, passed: false, error });
  log(`  ❌ ${name} - ${error}`);
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

// ==============================================================
// PREREQUISITE CHECKS
// ==============================================================
async function checkPrerequisites() {
  log("\n🔍 PREREQUISITE CHECKS");
  log("=".repeat(50));

  if (!HETZNER_API_TOKEN) {
    fail("Hetzner API token", "HETZNER_API_TOKEN not set");
    return false;
  }
  pass("Hetzner API token", "configured");

  if (!TELEGRAM_BOT_TOKEN) {
    log("  ⚠️  TELEGRAM_BOT_TOKEN not set - will use mock token (no real bot test)");
  } else {
    pass("Telegram bot token", "configured");
  }

  if (mode === "byok" && !ANTHROPIC_API_KEY) {
    fail("Anthropic API key", "ANTHROPIC_API_KEY or ANTHROPIC_TEST_KEY required for BYOK mode");
    return false;
  }
  if (mode === "byok") {
    pass("Anthropic API key", "configured for BYOK");
  }

  // Verify Clerk auth works
  try {
    const resp = await authenticatedFetch(`${BASE_URL}/api/auth/me`);
    if (resp.ok) {
      const data = await resp.json();
      pass("Clerk authentication", `User: ${data.email}`);
    } else {
      fail("Clerk authentication", `Status ${resp.status}`);
      return false;
    }
  } catch (e) {
    fail("Clerk authentication", `Error: ${e}`);
    return false;
  }

  return true;
}

// ==============================================================
// STEP 1: SUBSCRIBE
// ==============================================================
async function testSubscribe() {
  log("\n📦 STEP 1: Subscribe");
  log("=".repeat(50));

  const clerkId = await getTestUserClerkId();
  
  // Set up user in database for BYOK mode
  if (mode === "byok") {
    try {
      let user = await prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            clerkId,
            email: "blitzclaw-e2e-test@example.com",
            billingMode: "byok",
            anthropicKey: ANTHROPIC_API_KEY,
          },
        });
      } else {
        user = await prisma.user.update({
          where: { clerkId },
          data: {
            billingMode: "byok",
            anthropicKey: ANTHROPIC_API_KEY,
          },
        });
      }
      pass("User setup for BYOK", `ID: ${user.id}`);
    } catch (e) {
      fail("User setup for BYOK", `${e}`);
      return false;
    }
  } else {
    // Managed mode - need to set up balance
    try {
      let user = await prisma.user.findUnique({ 
        where: { clerkId },
        include: { balance: true }
      });
      if (!user) {
        user = await prisma.user.create({
          data: {
            clerkId,
            email: "blitzclaw-e2e-test@example.com",
            billingMode: "managed",
            balance: { create: { creditsCents: 10000 } }, // €100 test balance
          },
          include: { balance: true }
        });
      } else {
        await prisma.user.update({
          where: { clerkId },
          data: { billingMode: "managed" },
        });
        // Ensure balance exists
        await prisma.balance.upsert({
          where: { userId: user.id },
          create: { userId: user.id, creditsCents: 10000 },
          update: { creditsCents: 10000 },
        });
      }
      pass("User setup for Managed", `ID: ${user.id}, Balance: €100`);
    } catch (e) {
      fail("User setup for Managed", `${e}`);
      return false;
    }
  }

  return true;
}

// ==============================================================
// STEP 2: CREATE INSTANCE
// ==============================================================
async function testCreateInstance() {
  log("\n🖥️  STEP 2: Create Instance");
  log("=".repeat(50));

  const telegramToken = TELEGRAM_BOT_TOKEN || "123456789:TEST_TOKEN_E2E";
  const start = Date.now();

  try {
    const resp = await authenticatedFetch(`${BASE_URL}/api/instances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel_type: "telegram",
        persona_template: "assistant",
        telegramToken,
        model: "claude-sonnet-4-20250514",
      }),
    });

    const data = await resp.json();

    if (resp.ok && data.id) {
      testInstanceId = data.id;
      testServerId = data.hetznerServerId || null;
      testServerIp = data.ipAddress || null;
      pass("Instance created", `ID: ${data.id}, Status: ${data.status}`, Date.now() - start);
      return true;
    } else if (resp.status === 402) {
      fail("Instance created", `Payment required: ${data.error}`);
      return false;
    } else {
      fail("Instance created", `Status ${resp.status}: ${JSON.stringify(data)}`);
      return false;
    }
  } catch (e) {
    fail("Instance created", `Error: ${e}`);
    return false;
  }
}

// ==============================================================
// STEP 3: WAIT FOR PROVISIONING
// ==============================================================
async function testWaitForProvisioning() {
  log("\n⏳ STEP 3: Wait for Provisioning");
  log("=".repeat(50));

  if (!testInstanceId) {
    fail("Wait for provisioning", "No instance ID");
    return false;
  }

  const maxWait = 5 * 60 * 1000; // 5 minutes
  const start = Date.now();
  let lastStatus = "";

  while (Date.now() - start < maxWait) {
    try {
      const resp = await authenticatedFetch(`${BASE_URL}/api/instances/${testInstanceId}`);
      if (!resp.ok) {
        await sleep(5000);
        continue;
      }

      const data = await resp.json();
      
      if (data.status !== lastStatus) {
        log(`  📊 Status: ${data.status}`);
        lastStatus = data.status;
      }

      if (data.status === "ACTIVE") {
        testServerIp = data.ipAddress;
        testServerId = data.hetznerServerId;
        pass("Provisioning complete", `IP: ${data.ipAddress}`, Date.now() - start);
        return true;
      }

      if (data.status === "ERROR" || data.status === "FAILED") {
        fail("Provisioning complete", `Server failed: ${data.error || "Unknown error"}`);
        return false;
      }

      await sleep(5000);
    } catch (e) {
      await sleep(5000);
    }
  }

  fail("Provisioning complete", "Timeout after 5 minutes");
  return false;
}

// ==============================================================
// STEP 4: VERIFY OPENCLAW INSTALLATION
// ==============================================================
async function testVerifyOpenClaw() {
  log("\n🔧 STEP 4: Verify OpenClaw Installation");
  log("=".repeat(50));

  if (!testServerIp) {
    fail("Verify OpenClaw", "No server IP");
    return false;
  }

  // Wait for cloud-init to complete
  log("  ⏳ Waiting for cloud-init to complete...");
  const maxWait = 3 * 60 * 1000; // 3 minutes
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    try {
      // Check if OpenClaw is installed
      const result = execSync(
        `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i ~/.ssh/blitzclaw_test root@${testServerIp} "which openclaw && openclaw --version" 2>/dev/null`,
        { encoding: "utf-8", timeout: 10000 }
      );
      
      if (result.includes("openclaw")) {
        pass("OpenClaw installed", result.trim().split("\n").pop());
        break;
      }
    } catch (e) {
      // SSH not ready yet or command failed
    }
    await sleep(5000);
  }

  if (Date.now() - start >= maxWait) {
    fail("OpenClaw installed", "Timeout waiting for installation");
    return false;
  }

  // Verify gateway is running (with retries - systemd needs time to start it)
  log("  ⏳ Waiting for gateway to start...");
  const gatewayMaxWait = 60 * 1000; // 60 seconds
  const gatewayStart = Date.now();
  let gatewayRunning = false;

  while (Date.now() - gatewayStart < gatewayMaxWait) {
    try {
      // Check systemd service OR process
      const status = execSync(
        `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i ~/.ssh/blitzclaw_test root@${testServerIp} "systemctl is-active openclaw 2>/dev/null || systemctl is-active openclaw-gateway 2>/dev/null || pgrep -f 'openclaw gateway' || pgrep -f 'node.*openclaw'" 2>/dev/null`,
        { encoding: "utf-8", timeout: 15000 }
      );
      if (status.trim() === "active" || status.trim().match(/^\d+$/)) {
        pass("OpenClaw gateway running", status.trim() === "active" ? "Service active" : `PID: ${status.trim()}`);
        gatewayRunning = true;
        break;
      }
    } catch (e) {
      // Try alternative check - look at port 18789
      try {
        const portCheck = execSync(
          `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -i ~/.ssh/blitzclaw_test root@${testServerIp} "ss -tlnp | grep 18789 || netstat -tlnp | grep 18789" 2>/dev/null`,
          { encoding: "utf-8", timeout: 10000 }
        );
        if (portCheck.includes("18789")) {
          pass("OpenClaw gateway running", "Listening on port 18789");
          gatewayRunning = true;
          break;
        }
      } catch {
        // Keep waiting
      }
    }
    await sleep(5000);
  }

  if (!gatewayRunning) {
    // Final check - look at process list
    try {
      const ps = execSync(
        `ssh -o StrictHostKeyChecking=no -i ~/.ssh/blitzclaw_test root@${testServerIp} "ps aux | grep -E 'openclaw|node.*gateway'" 2>/dev/null`,
        { encoding: "utf-8", timeout: 10000 }
      );
      if (ps.includes("openclaw") && !ps.includes("grep")) {
        pass("OpenClaw gateway running", "Process found in ps");
        gatewayRunning = true;
      } else {
        fail("OpenClaw gateway running", "Process not found after 60s");
        return false;
      }
    } catch {
      fail("OpenClaw gateway running", "Could not verify after 60s");
      return false;
    }
  }

  return true;
}

// ==============================================================
// STEP 5: VERIFY ANTHROPIC KEY (BYOK) OR PROXY (MANAGED)
// ==============================================================
async function testVerifyAnthropicConfig() {
  log("\n🔑 STEP 5: Verify Anthropic Configuration");
  log("=".repeat(50));

  if (!testServerIp) {
    fail("Verify Anthropic config", "No server IP");
    return false;
  }

  try {
    // Check auth-profiles.json
    const authProfiles = execSync(
      `ssh -o StrictHostKeyChecking=no -i ~/.ssh/blitzclaw_test root@${testServerIp} "cat /root/.openclaw/agents/main/agent/auth-profiles.json 2>/dev/null || cat /root/.openclaw/auth-profiles.json 2>/dev/null" 2>/dev/null`,
      { encoding: "utf-8", timeout: 10000 }
    );

    const parsed = JSON.parse(authProfiles);
    
    if (mode === "byok") {
      // BYOK should have direct Anthropic key
      // Profile structure: { profiles: { "anthropic:default": { key: "sk-ant-..." } } }
      const anthropicProfile = parsed.profiles?.["anthropic:default"] || parsed.profiles?.anthropic;
      const key = anthropicProfile?.key || anthropicProfile?.apiKey;
      if (key && key.startsWith("sk-ant-")) {
        pass("BYOK Anthropic key configured", "Key starts with sk-ant-*****");
      } else {
        fail("BYOK Anthropic key configured", `Key not found or invalid. Found: ${JSON.stringify(parsed.profiles)}`);
        return false;
      }
    } else {
      // Managed should point to BlitzClaw proxy
      // Profile structure: { profiles: { "blitzclaw:default": { key: "..." } } }
      const blitzclawProfile = parsed.profiles?.["blitzclaw:default"];
      if (blitzclawProfile?.key) {
        pass("Managed proxy configured", "Proxy key configured");
      } else {
        fail("Managed proxy configured", `Profile not found. Found: ${JSON.stringify(parsed.profiles)}`);
        return false;
      }
    }
  } catch (e) {
    fail("Verify Anthropic config", `Error: ${e}`);
    return false;
  }

  return true;
}

// ==============================================================
// STEP 6: VERIFY TELEGRAM BOT (if real token)
// ==============================================================
async function testVerifyTelegramBot() {
  log("\n🤖 STEP 6: Verify Telegram Bot");
  log("=".repeat(50));

  if (!TELEGRAM_BOT_TOKEN) {
    log("  ⚠️  Skipping - no real Telegram token provided");
    pass("Telegram bot", "Skipped (no token)");
    return true;
  }

  try {
    // Check Telegram bot info
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await resp.json();

    if (data.ok) {
      pass("Telegram bot valid", `@${data.result.username}`);
    } else {
      fail("Telegram bot valid", data.description);
      return false;
    }
  } catch (e) {
    fail("Telegram bot valid", `Error: ${e}`);
    return false;
  }

  // For a full test, we would send a message and verify response
  // That requires webhook to be set up correctly
  log("  ℹ️  Full bot response test requires manual verification");

  return true;
}

// ==============================================================
// CLEANUP (includes account deletion + subscription cancellation)
// ==============================================================
async function cleanupTest() {
  log("\n🧹 CLEANUP");
  log("=".repeat(50));

  // Step 1: Delete the account via API (this should cascade delete instances, cancel subscription, kill servers)
  try {
    const resp = await authenticatedFetch(`${BASE_URL}/api/account/delete`, {
      method: "DELETE",
    });
    if (resp.ok) {
      const data = await resp.json();
      log(`  ✓ Account deleted via API`);
      if (data.errors && data.errors.length > 0) {
        log(`    ⚠️  Some cleanup errors: ${data.errors.join(", ")}`);
      }
      if (data.creem?.cancelled) {
        log(`  ✓ Creem subscription cancelled`);
      } else if (data.creem?.error) {
        log(`    ⚠️  Creem cancellation error: ${data.creem.error}`);
      }
      if (data.hetzner?.deleted) {
        log(`  ✓ Hetzner servers deleted`);
      }
    } else {
      const body = await resp.text();
      log(`  ⚠️  Account delete failed (${resp.status}): ${body}`);
      
      // Fallback: try to delete instance directly
      if (testInstanceId) {
        try {
          const instResp = await authenticatedFetch(`${BASE_URL}/api/instances/${testInstanceId}`, {
            method: "DELETE",
          });
          if (instResp.ok) {
            log(`  ✓ Deleted instance ${testInstanceId} (fallback)`);
          }
        } catch (e) {
          log(`  ⚠️  Error deleting instance: ${e}`);
        }
      }
    }
  } catch (e) {
    log(`  ⚠️  Error during account delete: ${e}`);
    
    // Fallback cleanup
    if (testInstanceId) {
      try {
        await authenticatedFetch(`${BASE_URL}/api/instances/${testInstanceId}`, {
          method: "DELETE",
        });
        log(`  ✓ Deleted instance (fallback)`);
      } catch {}
    }
  }

  // Step 2: Verify Hetzner server is deleted (double-check)
  if (testServerId && HETZNER_API_TOKEN) {
    try {
      const resp = await fetch(`https://api.hetzner.cloud/v1/servers/${testServerId}`, {
        headers: { Authorization: `Bearer ${HETZNER_API_TOKEN}` },
      });
      if (resp.status === 404) {
        log(`  ✓ Hetzner server ${testServerId} confirmed deleted`);
      } else if (resp.ok) {
        // Server still exists - delete it directly
        log(`  ⚠️  Server still exists, deleting directly...`);
        await fetch(`https://api.hetzner.cloud/v1/servers/${testServerId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${HETZNER_API_TOKEN}` },
        });
        log(`  ✓ Deleted Hetzner server ${testServerId}`);
      }
    } catch (e) {
      log(`  ⚠️  Error verifying server deletion: ${e}`);
    }
  }

  // Step 3: Revoke Clerk session
  await cleanupTestSession();
  log("  ✓ Revoked test session");
  
  // Step 4: Verify cleanup in database
  try {
    const clerkId = await getTestUserClerkId();
    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      log("  ✓ User deleted from database");
    } else {
      log(`  ⚠️  User still exists in database (ID: ${user.id})`);
    }
  } catch {
    // User lookup failed, probably deleted
  }
}

// ==============================================================
// MAIN
// ==============================================================
async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         BlitzClaw FULL E2E Test                              ║");
  console.log(`║         Mode: ${mode.toUpperCase().padEnd(45)}║`);
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`🌐 Target: ${BASE_URL}`);
  console.log(`📅 Time: ${new Date().toISOString()}`);

  const startTime = Date.now();

  try {
    // Prerequisites
    if (!(await checkPrerequisites())) {
      console.log("\n❌ Prerequisite checks failed. Aborting.");
      process.exit(1);
    }

    // Step 1: Subscribe
    if (!(await testSubscribe())) {
      console.log("\n❌ Subscribe failed. Aborting.");
      await cleanupTest();
      process.exit(1);
    }

    if (skipDeploy) {
      console.log("\n⚠️  --skip-deploy: Skipping deployment tests");
    } else {
      // Step 2: Create Instance
      if (!(await testCreateInstance())) {
        console.log("\n❌ Create instance failed. Aborting.");
        await cleanupTest();
        process.exit(1);
      }

      // Step 3: Wait for Provisioning
      if (!(await testWaitForProvisioning())) {
        console.log("\n❌ Provisioning failed. Cleaning up...");
        await cleanupTest();
        process.exit(1);
      }

      // Step 4: Verify OpenClaw
      if (!(await testVerifyOpenClaw())) {
        console.log("\n⚠️  OpenClaw verification failed. Continuing...");
      }

      // Step 5: Verify Anthropic Config
      if (!(await testVerifyAnthropicConfig())) {
        console.log("\n⚠️  Anthropic config verification failed. Continuing...");
      }

      // Step 6: Verify Telegram Bot
      if (!(await testVerifyTelegramBot())) {
        console.log("\n⚠️  Telegram bot verification failed. Continuing...");
      }
    }

    // Summary
    const totalDuration = Date.now() - startTime;
    console.log("\n" + "━".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("━".repeat(60));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Total:  ${results.length}`);
    console.log(`⏱️  Duration: ${(totalDuration / 1000).toFixed(1)}s`);

    // Cleanup
    if (cleanup || !skipDeploy) {
      await cleanupTest();
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error("\n💥 Unexpected error:", e);
    await cleanupTest();
    process.exit(1);
  }
}

main();
