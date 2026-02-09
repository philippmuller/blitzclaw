#!/usr/bin/env npx tsx
import "dotenv/config";
import { getTestUserToken, authenticatedFetch, cleanupTestSession } from "./test-helpers";

const BASE_URL = "https://www.blitzclaw.com";
const TELEGRAM_TOKEN = process.env.TEST_TELEGRAM_TOKEN || "8438134005:AAFIVK7UxIQZudxHgRHYRC_qEVkGMpGF39Y";
const ANTHROPIC_KEY = process.env.TEST_ANTHROPIC_KEY || "sk-ant-api03-test";

async function testFullByokFlow() {
  console.log("=== Full BYOK Flow Test ===\n");
  
  try {
    console.log("1. Getting Clerk auth token...");
    const token = await getTestUserToken();
    console.log("   ✅ Got auth token");
    
    console.log("\n2. Validating Telegram bot...");
    const telegramRes = await authenticatedFetch(`${BASE_URL}/api/telegram/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_token: TELEGRAM_TOKEN }),
    });
    const telegramData = await telegramRes.json();
    console.log(`   Status: ${telegramRes.status}`);
    if (telegramRes.ok) console.log(`   ✅ Bot: @${telegramData.bot?.username}`);
    
    console.log("\n3. Testing BYOK subscribe...");
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
    console.log(`   Response: ${JSON.stringify(subscribeData)}`);
    
    await cleanupTestSession();
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testFullByokFlow();
