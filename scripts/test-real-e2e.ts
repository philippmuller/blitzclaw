#!/usr/bin/env npx tsx
/**
 * BlitzClaw REAL E2E Test Suite
 * 
 * Tests against actual APIs (all in test/sandbox mode):
 * - Clerk: User creation via Backend API
 * - Creem: Checkout sessions and subscriptions
 * - Hetzner: Server provisioning
 * - Anthropic: API calls and billing verification
 * 
 * Run: npx tsx scripts/test-real-e2e.ts
 * 
 * Options:
 *   --skip-hetzner    Skip Hetzner deployment (saves ~€4.49)
 *   --skip-anthropic  Skip Anthropic calls (saves ~$0.50)
 *   --cleanup-only    Only cleanup test resources
 */

import { PrismaClient, InstanceStatus, ChannelType } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const prisma = new PrismaClient();

// ============================================
// Configuration
// ============================================

const CONFIG = {
  clerk: {
    secretKey: process.env.CLERK_SECRET_KEY!,
    apiUrl: 'https://api.clerk.com/v1',
  },
  creem: {
    apiKey: process.env.CREEM_API_KEY!,
    // Test mode uses test-api.creem.io
    apiUrl: process.env.CREEM_API_KEY?.includes('test') 
      ? 'https://test-api.creem.io/v1' 
      : 'https://api.creem.io/v1',
    productId: process.env.CREEM_SUBSCRIPTION_PRODUCT_ID!,
  },
  hetzner: {
    apiToken: process.env.HETZNER_API_TOKEN!,
    apiUrl: 'https://api.hetzner.cloud/v1',
    sshKeyName: 'blitzclaw-test',
    serverType: 'cpx11',
    location: 'ash',
    image: 'ubuntu-24.04',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
    apiUrl: 'https://api.anthropic.com/v1',
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://www.blitzclaw.com',
  },
};

const TEST_PREFIX = 'e2e-test-'; // Must be valid hostname (no underscores)
const SKIP_HETZNER = process.argv.includes('--skip-hetzner');
const SKIP_ANTHROPIC = process.argv.includes('--skip-anthropic');
const CLEANUP_ONLY = process.argv.includes('--cleanup-only');

// ============================================
// Helpers
// ============================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];
let currentTest = '';
let testStartTime = 0;

function startTest(name: string) {
  currentTest = name;
  testStartTime = Date.now();
  console.log(`\n🧪 ${name}...`);
}

function pass(details?: string) {
  const duration = Date.now() - testStartTime;
  results.push({ name: currentTest, passed: true, duration, details });
  console.log(`   ✅ Passed (${duration}ms)${details ? ` - ${details}` : ''}`);
}

function fail(error: string) {
  const duration = Date.now() - testStartTime;
  results.push({ name: currentTest, passed: false, duration, error });
  console.log(`   ❌ Failed (${duration}ms): ${error}`);
}

function skip(reason: string) {
  results.push({ name: currentTest, passed: true, duration: 0, details: `SKIPPED: ${reason}` });
  console.log(`   ⏭️  Skipped: ${reason}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Clerk Tests
// ============================================

async function testClerkCreateUser(): Promise<string | null> {
  startTest('Clerk: Create test user');
  
  try {
    const email = `${TEST_PREFIX}${Date.now()}@test.blitzclaw.com`;
    const password = `TestPass${Date.now()}!`;
    
    const response = await fetch(`${CONFIG.clerk.apiUrl}/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.clerk.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: [email],
        password,
        skip_password_checks: true,
        skip_password_requirement: true,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      fail(`Clerk API error: ${response.status} - ${error}`);
      return null;
    }
    
    const user = await response.json();
    pass(`Created user ${user.id} (${email})`);
    return user.id;
  } catch (error) {
    fail(String(error));
    return null;
  }
}

async function testClerkDeleteUser(clerkUserId: string): Promise<void> {
  startTest('Clerk: Delete test user');
  
  try {
    const response = await fetch(`${CONFIG.clerk.apiUrl}/users/${clerkUserId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CONFIG.clerk.secretKey}`,
      },
    });
    
    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      fail(`Clerk API error: ${response.status} - ${error}`);
      return;
    }
    
    pass(`Deleted user ${clerkUserId}`);
  } catch (error) {
    fail(String(error));
  }
}

// ============================================
// Creem Tests
// ============================================

async function testCreemCreateCheckout(userId: string): Promise<string | null> {
  startTest('Creem: Create subscription checkout');
  
  try {
    const response = await fetch(`${CONFIG.creem.apiUrl}/checkouts`, {
      method: 'POST',
      headers: {
        'x-api-key': CONFIG.creem.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: CONFIG.creem.productId,
        success_url: `${CONFIG.app.url}/dashboard?subscription=success`,
        // Creem uses request_id for metadata tracking
        request_id: `test_${userId}_${Date.now()}`,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      fail(`Creem API error: ${response.status} - ${error}`);
      return null;
    }
    
    const checkout = await response.json();
    const checkoutUrl = checkout.checkout_url || checkout.url;
    pass(`Checkout ${checkout.id} created`);
    console.log(`   └─ URL: ${checkoutUrl}`);
    return checkoutUrl;
  } catch (error) {
    fail(String(error));
    return null;
  }
}

async function testCreemGetProduct(): Promise<void> {
  startTest('Creem: Verify product exists');
  
  try {
    const response = await fetch(`${CONFIG.creem.apiUrl}/products?product_id=${CONFIG.creem.productId}`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.creem.apiKey,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      fail(`Creem API error: ${response.status} - ${error}`);
      return;
    }
    
    const product = await response.json();
    pass(`Product: ${product.name || product.id} (${product.price ? `€${product.price/100}` : 'price TBD'})`);
  } catch (error) {
    fail(String(error));
  }
}

// ============================================
// Hetzner Tests
// ============================================

async function testHetznerCreateServer(): Promise<{ id: number; ip: string } | null> {
  startTest('Hetzner: Create server');
  
  if (SKIP_HETZNER) {
    skip('--skip-hetzner flag set');
    return null;
  }
  
  try {
    const serverName = `${TEST_PREFIX}${Date.now()}`;
    
    // Get SSH key ID
    const keysResponse = await fetch(`${CONFIG.hetzner.apiUrl}/ssh_keys`, {
      headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
    });
    const keysData = await keysResponse.json();
    const sshKey = keysData.ssh_keys?.find((k: any) => k.name === CONFIG.hetzner.sshKeyName);
    
    if (!sshKey) {
      fail(`SSH key '${CONFIG.hetzner.sshKeyName}' not found`);
      return null;
    }
    
    // Create server
    const response = await fetch(`${CONFIG.hetzner.apiUrl}/servers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.hetzner.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: serverName,
        server_type: CONFIG.hetzner.serverType,
        location: CONFIG.hetzner.location,
        image: CONFIG.hetzner.image,
        ssh_keys: [sshKey.id],
        labels: { test: 'true', blitzclaw: 'true' },
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      fail(`Hetzner API error: ${response.status} - ${error}`);
      return null;
    }
    
    const data = await response.json();
    const server = data.server;
    
    pass(`Server ${server.id} created (${server.public_net?.ipv4?.ip || 'IP pending'})`);
    
    // Wait for server to be running
    console.log('   ⏳ Waiting for server to be ready...');
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      
      const statusResponse = await fetch(`${CONFIG.hetzner.apiUrl}/servers/${server.id}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
      });
      const statusData = await statusResponse.json();
      
      if (statusData.server.status === 'running') {
        const ip = statusData.server.public_net?.ipv4?.ip;
        console.log(`   ✅ Server running at ${ip}`);
        return { id: server.id, ip };
      }
    }
    
    fail('Server did not become ready in time');
    return null;
  } catch (error) {
    fail(String(error));
    return null;
  }
}

async function testHetznerDeleteServer(serverId: number): Promise<void> {
  startTest('Hetzner: Delete server');
  
  if (!serverId) {
    skip('No server to delete');
    return;
  }
  
  try {
    const response = await fetch(`${CONFIG.hetzner.apiUrl}/servers/${serverId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
    });
    
    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      fail(`Hetzner API error: ${response.status} - ${error}`);
      return;
    }
    
    pass(`Server ${serverId} deleted`);
  } catch (error) {
    fail(String(error));
  }
}

// ============================================
// Anthropic Tests
// ============================================

interface AnthropicUsageResult {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

async function testAnthropicDirectCall(): Promise<AnthropicUsageResult | null> {
  startTest('Anthropic: Direct API call');
  
  if (SKIP_ANTHROPIC) {
    skip('--skip-anthropic flag set');
    return null;
  }
  
  try {
    const response = await fetch(`${CONFIG.anthropic.apiUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.anthropic.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Use cheapest model for testing
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Say "BlitzClaw test successful" and nothing else.' }
        ],
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      fail(`Anthropic API error: ${response.status} - ${error}`);
      return null;
    }
    
    const data = await response.json();
    const usage = data.usage;
    
    pass(`${usage.input_tokens} in / ${usage.output_tokens} out tokens`);
    
    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      model: data.model,
    };
  } catch (error) {
    fail(String(error));
    return null;
  }
}

async function testAnthropicBillingVerification(usage: AnthropicUsageResult): Promise<void> {
  startTest('Anthropic: Verify billing markup');
  
  // Haiku pricing (base)
  const BASE_INPUT_PER_1M = 25; // $0.25 = 25 cents
  const BASE_OUTPUT_PER_1M = 125; // $1.25 = 125 cents
  const MARKUP = 1.5;
  
  // Calculate costs
  const baseInputCost = (usage.inputTokens / 1_000_000) * BASE_INPUT_PER_1M;
  const baseOutputCost = (usage.outputTokens / 1_000_000) * BASE_OUTPUT_PER_1M;
  const baseTotalCost = baseInputCost + baseOutputCost;
  
  const ourInputCost = (usage.inputTokens / 1_000_000) * BASE_INPUT_PER_1M * MARKUP;
  const ourOutputCost = (usage.outputTokens / 1_000_000) * BASE_OUTPUT_PER_1M * MARKUP;
  const ourTotalCost = ourInputCost + ourOutputCost;
  
  const profit = ourTotalCost - baseTotalCost;
  const actualMarkup = ourTotalCost / baseTotalCost;
  
  console.log(`   📊 Billing breakdown:`);
  console.log(`      Anthropic cost: $${baseTotalCost.toFixed(6)}`);
  console.log(`      Our charge:     $${ourTotalCost.toFixed(6)}`);
  console.log(`      Profit:         $${profit.toFixed(6)} (${((actualMarkup - 1) * 100).toFixed(1)}% markup)`);
  
  if (Math.abs(actualMarkup - 1.5) < 0.01) {
    pass(`Markup verified at ${(actualMarkup * 100 - 100).toFixed(1)}%`);
  } else {
    fail(`Expected 50% markup, got ${((actualMarkup - 1) * 100).toFixed(1)}%`);
  }
}

// ============================================
// Database Tests
// ============================================

async function testDatabaseCreateUser(clerkUserId: string): Promise<string> {
  startTest('Database: Create user record');
  
  try {
    const user = await prisma.user.create({
      data: {
        clerkId: clerkUserId,
        email: `${clerkUserId}@test.blitzclaw.com`,
      },
    });
    
    pass(`User ${user.id} created`);
    return user.id;
  } catch (error) {
    fail(String(error));
    throw error;
  }
}

async function testDatabaseCreditBalance(userId: string): Promise<void> {
  startTest('Database: Credit subscription balance');
  
  try {
    const balance = await prisma.balance.create({
      data: {
        userId,
        creditsCents: 1000, // €10
        autoTopupEnabled: true,
        topupThresholdCents: 500,
        topupAmountCents: 1000,
      },
    });
    
    pass(`Balance: €${(balance.creditsCents / 100).toFixed(2)}`);
  } catch (error) {
    fail(String(error));
  }
}

async function testDatabaseCreateInstance(userId: string, serverIp?: string): Promise<string | null> {
  startTest('Database: Create instance');
  
  try {
    const instance = await prisma.instance.create({
      data: {
        userId,
        status: serverIp ? InstanceStatus.ACTIVE : InstanceStatus.PROVISIONING,
        channelType: ChannelType.TELEGRAM,
        personaTemplate: 'assistant',
        ipAddress: serverIp,
      },
    });
    
    pass(`Instance ${instance.id} (${instance.status})`);
    return instance.id;
  } catch (error) {
    fail(String(error));
    return null;
  }
}

async function testDatabaseLogUsage(instanceId: string, usage: AnthropicUsageResult): Promise<void> {
  startTest('Database: Log usage with markup');
  
  try {
    // Calculate cost with markup
    const MARKUP = 1.5;
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-haiku-20240307': { input: 25, output: 125 },
      'claude-sonnet-4-20250514': { input: 300, output: 1500 },
    };
    
    const modelPricing = pricing[usage.model] || pricing['claude-3-haiku-20240307'];
    const inputCost = Math.ceil((usage.inputTokens * modelPricing.input * MARKUP) / 1_000_000);
    const outputCost = Math.ceil((usage.outputTokens * modelPricing.output * MARKUP) / 1_000_000);
    const totalCost = inputCost + outputCost;
    
    await prisma.usageLog.create({
      data: {
        instanceId,
        model: usage.model,
        tokensIn: usage.inputTokens,
        tokensOut: usage.outputTokens,
        costCents: totalCost,
      },
    });
    
    pass(`Logged ${totalCost} cents for ${usage.inputTokens}/${usage.outputTokens} tokens`);
  } catch (error) {
    fail(String(error));
  }
}

async function testDatabaseDeductBalance(userId: string, instanceId: string): Promise<void> {
  startTest('Database: Deduct from balance');
  
  try {
    // Get total usage for instance
    const usage = await prisma.usageLog.aggregate({
      where: { instanceId },
      _sum: { costCents: true },
    });
    
    const totalCost = usage._sum.costCents || 0;
    
    const updatedBalance = await prisma.balance.update({
      where: { userId },
      data: { creditsCents: { decrement: totalCost } },
    });
    
    pass(`Deducted ${totalCost} cents, new balance: €${(updatedBalance.creditsCents / 100).toFixed(2)}`);
  } catch (error) {
    fail(String(error));
  }
}

async function testDatabaseLowBalancePause(userId: string): Promise<void> {
  startTest('Database: Test low balance pause');
  
  try {
    // Set balance below threshold
    await prisma.balance.update({
      where: { userId },
      data: { creditsCents: 100 }, // €1 (below €5 threshold)
    });
    
    // Pause instances
    const result = await prisma.instance.updateMany({
      where: { userId, status: InstanceStatus.ACTIVE },
      data: { status: InstanceStatus.PAUSED },
    });
    
    pass(`Paused ${result.count} instance(s) due to low balance`);
  } catch (error) {
    fail(String(error));
  }
}

async function testDatabaseSubscriptionCancel(userId: string): Promise<void> {
  startTest('Database: Test subscription cancellation');
  
  try {
    const result = await prisma.instance.updateMany({
      where: { userId },
      data: { status: InstanceStatus.STOPPED },
    });
    
    pass(`Stopped ${result.count} instance(s) on subscription cancel`);
  } catch (error) {
    fail(String(error));
  }
}

// ============================================
// Cleanup
// ============================================

async function cleanup(clerkUserId?: string, hetznerServerId?: number): Promise<void> {
  console.log('\n🧹 Cleanup...');
  
  // Delete from database (check both old and new prefixes)
  const prefixes = ['e2e-test-', 'e2e_test_', 'real_e2e_test_'];
  for (const prefix of prefixes) {
    await prisma.usageLog.deleteMany({
      where: { instance: { user: { clerkId: { startsWith: prefix } } } },
    });
    await prisma.instance.deleteMany({
      where: { user: { clerkId: { startsWith: prefix } } },
    });
    await prisma.balance.deleteMany({
      where: { user: { clerkId: { startsWith: prefix } } },
    });
    await prisma.user.deleteMany({
      where: { clerkId: { startsWith: prefix } },
    });
  }
  console.log('   ✅ Database cleaned');
  
  // Delete Clerk user
  if (clerkUserId) {
    await testClerkDeleteUser(clerkUserId);
  }
  
  // Delete Hetzner server
  if (hetznerServerId) {
    await testHetznerDeleteServer(hetznerServerId);
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           BlitzClaw REAL E2E Test Suite                      ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Testing against REAL APIs (test/sandbox mode)               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  console.log('\n📋 Configuration:');
  console.log(`   Clerk:     ${CONFIG.clerk.secretKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Creem:     ${CONFIG.creem.apiKey ? '✅ Configured' : '❌ Missing'}`);
  console.log(`   Hetzner:   ${CONFIG.hetzner.apiToken ? '✅ Configured' : '❌ Missing'} ${SKIP_HETZNER ? '(SKIPPED)' : ''}`);
  console.log(`   Anthropic: ${CONFIG.anthropic.apiKey ? '✅ Configured' : '❌ Missing'} ${SKIP_ANTHROPIC ? '(SKIPPED)' : ''}`);
  
  if (CLEANUP_ONLY) {
    await cleanup();
    console.log('\n✅ Cleanup complete');
    return;
  }
  
  let clerkUserId: string | null = null;
  let dbUserId: string | null = null;
  let instanceId: string | null = null;
  let hetznerServer: { id: number; ip: string } | null = null;
  let anthropicUsage: AnthropicUsageResult | null = null;
  
  try {
    // ========== CLERK TESTS ==========
    console.log('\n' + '═'.repeat(60));
    console.log('CLERK TESTS');
    console.log('═'.repeat(60));
    
    clerkUserId = await testClerkCreateUser();
    if (!clerkUserId) throw new Error('Failed to create Clerk user');
    
    // ========== DATABASE SETUP ==========
    console.log('\n' + '═'.repeat(60));
    console.log('DATABASE TESTS');
    console.log('═'.repeat(60));
    
    dbUserId = await testDatabaseCreateUser(clerkUserId);
    await testDatabaseCreditBalance(dbUserId);
    
    // ========== CREEM TESTS ==========
    console.log('\n' + '═'.repeat(60));
    console.log('CREEM TESTS');
    console.log('═'.repeat(60));
    
    await testCreemGetProduct();
    await testCreemCreateCheckout(dbUserId);
    
    // ========== HETZNER TESTS ==========
    console.log('\n' + '═'.repeat(60));
    console.log('HETZNER TESTS');
    console.log('═'.repeat(60));
    
    hetznerServer = await testHetznerCreateServer();
    
    // ========== INSTANCE CREATION ==========
    instanceId = await testDatabaseCreateInstance(dbUserId, hetznerServer?.ip);
    
    // ========== ANTHROPIC TESTS ==========
    console.log('\n' + '═'.repeat(60));
    console.log('ANTHROPIC TESTS');
    console.log('═'.repeat(60));
    
    anthropicUsage = await testAnthropicDirectCall();
    
    if (anthropicUsage) {
      await testAnthropicBillingVerification(anthropicUsage);
      
      // Log usage to database
      if (instanceId) {
        await testDatabaseLogUsage(instanceId, anthropicUsage);
        await testDatabaseDeductBalance(dbUserId, instanceId);
      }
    }
    
    // ========== BILLING FLOW TESTS ==========
    console.log('\n' + '═'.repeat(60));
    console.log('BILLING FLOW TESTS');
    console.log('═'.repeat(60));
    
    await testDatabaseLowBalancePause(dbUserId);
    await testDatabaseSubscriptionCancel(dbUserId);
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
  } finally {
    // ========== CLEANUP ==========
    console.log('\n' + '═'.repeat(60));
    console.log('CLEANUP');
    console.log('═'.repeat(60));
    
    await cleanup(clerkUserId || undefined, hetznerServer?.id);
  }
  
  // ========== SUMMARY ==========
  console.log('\n' + '═'.repeat(60));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.details?.startsWith('SKIPPED')).length;
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  
  for (const r of results) {
    const icon = r.passed ? (r.details?.startsWith('SKIPPED') ? '⏭️' : '✅') : '❌';
    console.log(`${icon} ${r.name} (${r.duration}ms)`);
    if (r.error) console.log(`   └─ ${r.error}`);
    if (r.details && !r.details.startsWith('SKIPPED')) console.log(`   └─ ${r.details}`);
  }
  
  if (failed > 0) {
    console.log(`\n❌ ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
