#!/usr/bin/env npx tsx
/**
 * Test the subscribe endpoint with Clerk authentication
 * Usage: npx tsx scripts/test-subscribe.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), ".env.local") });

import { authenticatedFetch, cleanupTestSession } from "./test-helpers";

const BASE_URL = process.env.BLITZCLAW_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function testSubscribe() {
  console.log("🧪 Testing Subscribe Endpoint (Authenticated)");
  console.log(`📍 URL: ${BASE_URL}/api/billing/subscribe`);
  console.log("");

  try {
    // Test 1: Without auth (should get 401)
    console.log("1️⃣ Testing without auth (should get 401/403/404)...");
    const noAuthResp = await fetch(`${BASE_URL}/api/billing/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "byok", anthropicKey: "sk-ant-test" }),
    });
    console.log(`   Status: ${noAuthResp.status}`);
    const noAuthBody = await noAuthResp.text();
    console.log(`   Body: ${noAuthBody.substring(0, 100)}`);

    if (noAuthResp.status === 401 || noAuthResp.status === 403 || noAuthResp.status === 404) {
      console.log("   ✅ Endpoint is protected");
    } else {
      console.log("   ⚠️  Unexpected status - endpoint might not be protected");
    }

    // Test 2: BYOK with valid key format (authenticated)
    console.log("\n2️⃣ Testing BYOK with valid key format (authenticated)...");
    const byokResp = await authenticatedFetch(`${BASE_URL}/api/billing/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: "byok",
        anthropicKey: "sk-ant-api03-test-key-for-testing",
        autoTopup: false,
      }),
    });
    console.log(`   Status: ${byokResp.status}`);
    const byokBody = await byokResp.json();
    console.log(`   Body: ${JSON.stringify(byokBody, null, 2)}`);

    if (byokResp.ok && byokBody.checkoutUrl) {
      console.log("   ✅ Got checkout URL!");
    } else if (byokResp.status === 500 && byokBody.error) {
      console.log("   ⚠️  Billing service issue (auth worked, endpoint reached)");
    }

    // Test 3: BYOK without API key (should fail validation)
    console.log("\n3️⃣ Testing BYOK without API key (should fail validation)...");
    const noKeyResp = await authenticatedFetch(`${BASE_URL}/api/billing/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "byok" }),
    });
    console.log(`   Status: ${noKeyResp.status}`);
    const noKeyBody = await noKeyResp.json();
    console.log(`   Body: ${JSON.stringify(noKeyBody)}`);

    if (noKeyResp.status === 400 && noKeyBody.error?.includes("API key required")) {
      console.log("   ✅ Validation working correctly");
    }

    // Test 4: Basic tier
    console.log("\n4️⃣ Testing Basic tier...");
    const basicResp = await authenticatedFetch(`${BASE_URL}/api/billing/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "basic" }),
    });
    console.log(`   Status: ${basicResp.status}`);
    const basicBody = await basicResp.json();
    console.log(`   Body: ${JSON.stringify(basicBody)}`);

    // Test 5: Pro tier
    console.log("\n5️⃣ Testing Pro tier...");
    const proResp = await authenticatedFetch(`${BASE_URL}/api/billing/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "pro" }),
    });
    console.log(`   Status: ${proResp.status}`);
    const proBody = await proResp.json();
    console.log(`   Body: ${JSON.stringify(proBody)}`);

    console.log("\n✅ Subscribe endpoint tests complete!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  } finally {
    // Cleanup
    console.log("\n🧹 Cleaning up test session...");
    await cleanupTestSession();
  }
}

testSubscribe().catch(console.error);
