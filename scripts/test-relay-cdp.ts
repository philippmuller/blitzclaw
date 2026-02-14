#!/usr/bin/env npx tsx
/**
 * Test the full Browser Relay CDP flow:
 * Agent → API → PartyKit → Extension → Chrome → Response
 * 
 * Prerequisites:
 * 1. Extension connected to a test room
 * 2. Tab attached in Chrome
 */

import { prisma } from "@blitzclaw/db";

const API_BASE = process.env.API_BASE || "https://blitzclaw.com";

async function main() {
  // Find an active instance to test with (or use a specific one)
  const instanceId = process.argv[2];
  
  let instance;
  if (instanceId) {
    instance = await prisma.instance.findUnique({
      where: { id: instanceId },
      select: { id: true, name: true, proxySecret: true, status: true },
    });
  } else {
    // Find Philipp's instance
    instance = await prisma.instance.findFirst({
      where: { 
        status: "ACTIVE",
        user: { email: { contains: "philipp" } }
      },
      select: { id: true, name: true, proxySecret: true, status: true },
    });
  }

  if (!instance) {
    console.error("❌ No active instance found");
    console.log("\nUsage: npx tsx scripts/test-relay-cdp.ts [instanceId]");
    process.exit(1);
  }

  console.log(`\n🎯 Testing with instance: ${instance.name} (${instance.id})`);
  console.log(`   Status: ${instance.status}`);
  
  // Generate the connect URL for the extension
  const connectUrl = `${API_BASE}/relay/connect?token=${instance.proxySecret}`;
  console.log(`\n📎 Extension connect URL:`);
  console.log(`   ${connectUrl}`);
  console.log(`\n⏳ Make sure the extension is connected before continuing...`);
  console.log(`   Press Enter when ready (or Ctrl+C to cancel)`);
  
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  // Test 1: Get document title
  console.log("\n🧪 Test 1: Runtime.evaluate (get document.title)");
  try {
    const result1 = await sendCdpCommand(instance.proxySecret, {
      method: "Runtime.evaluate",
      params: { expression: "document.title" },
    });
    console.log("   ✅ Success:", JSON.stringify(result1, null, 2));
  } catch (err) {
    console.log("   ❌ Failed:", err instanceof Error ? err.message : err);
  }

  // Test 2: Get current URL
  console.log("\n🧪 Test 2: Runtime.evaluate (get location.href)");
  try {
    const result2 = await sendCdpCommand(instance.proxySecret, {
      method: "Runtime.evaluate",
      params: { expression: "location.href" },
    });
    console.log("   ✅ Success:", JSON.stringify(result2, null, 2));
  } catch (err) {
    console.log("   ❌ Failed:", err instanceof Error ? err.message : err);
  }

  // Test 3: Navigate to a page (optional)
  console.log("\n🧪 Test 3: Page.navigate (go to example.com)");
  try {
    const result3 = await sendCdpCommand(instance.proxySecret, {
      method: "Page.navigate",
      params: { url: "https://example.com" },
    });
    console.log("   ✅ Success:", JSON.stringify(result3, null, 2));
  } catch (err) {
    console.log("   ❌ Failed:", err instanceof Error ? err.message : err);
  }

  console.log("\n✨ Tests complete!");
  process.exit(0);
}

async function sendCdpCommand(
  instanceSecret: string,
  body: { method: string; params?: Record<string, unknown>; timeoutMs?: number }
): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/browser-relay/cdp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-instance-secret": instanceSecret,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.result;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
