#!/usr/bin/env npx tsx
/**
 * Full BYOK flow test with Clerk auth
 */
import "dotenv/config";
import { getTestUserToken, authenticatedFetch, cleanupTestSession } from "./test-helpers";

const BASE_URL = "https://www.blitzclaw.com";
const TELEGRAM_TOKEN = "8438134005:AAFIVK7UxIQZudxHgRHYRC_qEVkGMpGF39Y";
const ANTHROPIC_KEY = ""YOUR_ANTHROPIC_KEY_HERE"";

async function testFullByokFlow() {
  console.log("=== Full BYOK Flow Test ===\n");
  
  try {
    // Step 1: Get auth token
    console.log("1. Getting Clerk auth token...");
    const token = await getTestUserToken();
    console.log("   ✅ Got auth token");
    
    // Step 2: Test telegram validation
    console.log("\n2. Validating Telegram bot...");
    const telegramRes = await authenticatedFetch(`${BASE_URL}/api/telegram/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_token: TELEGRAM_TOKEN }),
    });
    const telegramData = await telegramRes.json();
    console.log(`   Status: ${telegramRes.status}`);
    console.log(`   Response: ${JSON.stringify(telegramData)}`);
    if (telegramRes.ok) {
      console.log(`   ✅ Bot validated: @${telegramData.bot?.username}`);
    } else {
      console.log(`   ❌ Telegram validation failed: ${telegramData.error}`);
    }
    
    // Step 3: Test subscribe (BYOK)
    console.log("\n3. Testing BYOK subscribe endpoint...");
    const subscribeRes = await authenticatedFetch(`${BASE_URL}/api/billing/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier: "byok",
        anthropicKey: ANTHROPIC_KEY,
        autoTopup: false,
      }),
    });
    const subscribeData = await subscribeRes.json();
    console.log(`   Status: ${subscribeRes.status}`);
    if (subscribeRes.ok && subscribeData.checkoutUrl) {
      console.log(`   ✅ Got checkout URL: ${subscribeData.checkoutUrl.substring(0, 60)}...`);
    } else {
      console.log(`   Response: ${JSON.stringify(subscribeData)}`);
    }
    
    // Step 4: Check current user status
    console.log("\n4. Checking user status...");
    const meRes = await authenticatedFetch(`${BASE_URL}/api/auth/me`);
    const meData = await meRes.json();
    console.log(`   Status: ${meRes.status}`);
    console.log(`   Response: ${JSON.stringify(meData, null, 2)}`);
    
    // Cleanup
    await cleanupTestSession();
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testFullByokFlow();
