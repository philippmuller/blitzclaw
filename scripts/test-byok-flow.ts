#!/usr/bin/env npx tsx
/**
 * Test BYOK flow end-to-end
 * Verifies: Anthropic key is properly passed through to cloud-init
 */

// Inline cloud-init check (avoid module import issues)
import * as fs from 'fs';
import * as path from 'path';

async function testByokFlow() {
  console.log("=== BYOK Flow Test ===\n");
  
  // Read the cloud-init.ts source to verify BYOK logic
  const cloudInitPath = path.join(__dirname, '../apps/web/src/lib/cloud-init.ts');
  const cloudInitSource = fs.readFileSync(cloudInitPath, 'utf-8');
  
  console.log("1. Checking cloud-init BYOK logic...");
  
  // Check BYOK mode uses anthropic directly
  if (cloudInitSource.includes('byokMode ? {') && cloudInitSource.includes('"anthropic"')) {
    console.log("   ✅ BYOK mode configured to use anthropic provider directly");
  } else {
    console.log("   ❌ BYOK mode configuration issue!");
  }
  
  // Check auth profiles switch on byokMode
  if (cloudInitSource.includes('const authProfilesJson = byokMode ?')) {
    console.log("   ✅ Auth profiles switch based on byokMode");
  } else {
    console.log("   ❌ Auth profiles not switching on byokMode!");
  }
  
  // Check anthropic key is used in BYOK auth profile
  if (cloudInitSource.includes('key: anthropicApiKey') && cloudInitSource.includes('provider: "anthropic"')) {
    console.log("   ✅ Anthropic API key used in BYOK auth profile");
  } else {
    console.log("   ❌ Anthropic key not properly configured!");
  }
  
  // Check managed mode uses proxy
  if (cloudInitSource.includes('key: proxySecret') && cloudInitSource.includes('provider: "blitzclaw"')) {
    console.log("   ✅ Managed mode uses blitzclaw proxy with proxySecret");
  } else {
    console.log("   ❌ Managed mode proxy configuration issue!");
  }
  
  console.log("\n2. Checking provisioning flow...");
  const provisioningPath = path.join(__dirname, '../apps/web/src/lib/provisioning.ts');
  const provisioningSource = fs.readFileSync(provisioningPath, 'utf-8');
  
  if (provisioningSource.includes('byokMode?: boolean') && provisioningSource.includes('anthropicKey?: string')) {
    console.log("   ✅ Provisioning accepts byokMode and anthropicKey");
  } else {
    console.log("   ❌ Provisioning missing BYOK params!");
  }
  
  if (provisioningSource.includes("byokMode && options?.anthropicKey")) {
    console.log("   ✅ Provisioning passes user's key for BYOK");
  } else {
    console.log("   ❌ Provisioning not passing user's key!");
  }
  
  console.log("\n3. Checking subscribe endpoint...");
  const subscribePath = path.join(__dirname, '../apps/web/src/app/api/billing/subscribe/route.ts');
  const subscribeSource = fs.readFileSync(subscribePath, 'utf-8');
  
  if (subscribeSource.includes('anthropicKey: anthropicKey') && subscribeSource.includes('billingMode: "byok"')) {
    console.log("   ✅ Subscribe stores anthropicKey and billingMode");
  } else {
    console.log("   ❌ Subscribe not storing BYOK data!");
  }
  
  console.log("\n4. Checking instance creation...");
  const instancesPath = path.join(__dirname, '../apps/web/src/app/api/instances/route.ts');
  const instancesSource = fs.readFileSync(instancesPath, 'utf-8');
  
  if (instancesSource.includes('isByokUser') && instancesSource.includes('user.billingMode === "byok"')) {
    console.log("   ✅ Instance creation checks for BYOK user");
  } else {
    console.log("   ❌ Instance creation BYOK check missing!");
  }
  
  if (instancesSource.includes('byokMode: isByokUser') && instancesSource.includes('anthropicKey: isByokUser')) {
    console.log("   ✅ Instance passes byokMode and anthropicKey to provisioning");
  } else {
    console.log("   ❌ Instance not passing BYOK params to provisioning!");
  }
  
  console.log("\n5. Checking account deletion (cancellation)...");
  const deletePath = path.join(__dirname, '../apps/web/src/app/api/account/delete/route.ts');
  const deleteSource = fs.readFileSync(deletePath, 'utf-8');
  
  if (deleteSource.includes('cancelCreemSubscription') && deleteSource.includes('user.creemSubscriptionId')) {
    console.log("   ✅ Account deletion cancels Creem subscription");
  } else {
    console.log("   ❌ Account deletion not cancelling Creem subscription!");
  }
  
  console.log("\n=== Code Review Complete ===");
  console.log("\n⚠️  Manual testing still needed:");
  console.log("1. Sign up with BYOK + real Anthropic key");
  console.log("2. Verify onboarding completes and redirects to dashboard");
  console.log("3. SSH to instance: ssh root@<IP>");
  console.log("4. Check: cat /root/.openclaw/agents/main/agent/auth-profiles.json");
  console.log("5. Verify your Anthropic key is in the file (not proxy secret)");
  console.log("6. Test: send a Telegram message, verify response");
  console.log("7. Test cancellation: delete account from dashboard");
}

testByokFlow().catch(console.error);
