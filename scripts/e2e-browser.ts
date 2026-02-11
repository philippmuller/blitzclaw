#!/usr/bin/env npx tsx
/**
 * Browser-based E2E test using Playwright
 * Tests: Sign in → Onboarding → Polar checkout
 */

import { chromium } from "playwright";

const BASE_URL = "https://www.blitzclaw.com";
// Fresh test email for sign-up
const TEST_EMAIL = `blitzclaw-e2e-${Date.now()}@yopmail.com`;
const TEST_PASSWORD = "Blitz!Claw#2026$XyZ";

async function main() {
  console.log("🚀 Starting browser E2E test");
  console.log(`📧 Test email: ${TEST_EMAIL}`);
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500, // Slow down for visibility
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Go to sign-up
    console.log("\n1️⃣ Opening sign-up page...");
    await page.goto(`${BASE_URL}/sign-up`);
    await page.waitForLoadState("networkidle");
    console.log("   ✅ Sign-up page loaded");

    // 2. Fill sign-up form  
    console.log("\n2️⃣ Filling sign-up form...");
    await page.fill('input[name="emailAddress"]', TEST_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    console.log("   ✅ Form filled - PLEASE COMPLETE CAPTCHA");
    
    // 3. Click Continue after CAPTCHA is done
    console.log("\n3️⃣ ⏳ Waiting for CAPTCHA completion (120s)...");
    console.log("   👆 Complete CAPTCHA, then I'll click Continue");
    
    // Wait for Continue button to be enabled (CAPTCHA done)
    await page.waitForTimeout(5000); // Give time for CAPTCHA
    
    // Try clicking Continue
    try {
      await page.click('button:has-text("Continue")', { timeout: 120000 });
      console.log("   ✅ Clicked Continue");
    } catch (e) {
      console.log("   ⚠️ Continue click failed, maybe already processing");
    }
    
    // Wait for redirect
    console.log("\n4️⃣ Waiting for redirect (120s)...");
    await page.waitForURL(/onboarding|dashboard|verify/, { timeout: 120000 });
    console.log(`   ✅ Redirected to: ${page.url()}`);
    
    // 5. Handle email verification if needed
    if (page.url().includes("verify")) {
      console.log("\n5️⃣ Email verification needed - enter code 424242 (or check yopmail)");
      await page.waitForURL(/onboarding|dashboard/, { timeout: 180000 });
    }
    
    // 6. Should be on onboarding now
    console.log("\n6️⃣ Checking page...");
    console.log(`   Current URL: ${page.url()}`);
    
    // Take screenshot
    await page.screenshot({ path: "test-onboarding.png" });
    console.log("   📸 Screenshot saved: test-onboarding.png");

    // 5. Select Basic plan and continue
    console.log("\n5️⃣ Selecting Basic plan...");
    const basicButton = await page.$('button:has-text("Basic")');
    if (basicButton) {
      await basicButton.click();
    }
    
    // Click continue
    const continueButton = await page.$('button:has-text("Continue")');
    if (continueButton) {
      await continueButton.click();
      console.log("   ✅ Clicked Continue");
    }

    // 6. Should redirect to Polar checkout
    console.log("\n6️⃣ Waiting for Polar checkout...");
    await page.waitForURL(/polar\.sh|checkout/, { timeout: 30000 });
    console.log("   ✅ Redirected to Polar checkout!");
    console.log(`   🔗 URL: ${page.url()}`);
    
    // Take screenshot of checkout
    await page.screenshot({ path: "test-checkout.png" });
    console.log("   📸 Screenshot saved: test-checkout.png");

    console.log("\n✅ E2E TEST PASSED - Polar checkout reached!");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    await page.screenshot({ path: "test-error.png" });
    console.log("   📸 Error screenshot saved: test-error.png");
  } finally {
    // Keep browser open for inspection
    console.log("\n⏳ Browser staying open for 30s for inspection...");
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

main().catch(console.error);
