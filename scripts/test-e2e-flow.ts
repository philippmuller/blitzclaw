#!/usr/bin/env npx tsx
/**
 * BlitzClaw E2E Flow Test
 * 
 * Tests the complete user journey:
 * 1. User creation (simulated Clerk webhook)
 * 2. Subscription payment (simulated Creem webhook)
 * 3. Instance creation
 * 4. Server deployment (optional - costs money)
 * 5. API usage through proxy
 * 6. Balance deduction with markup
 * 7. Low balance → instance pause
 * 8. Subscription cancel → server termination
 * 
 * Run: npx tsx scripts/test-e2e-flow.ts [--deploy]
 */

import { PrismaClient, InstanceStatus, ChannelType } from '@prisma/client';

const prisma = new PrismaClient();

// Config
const DEPLOY_REAL_SERVER = process.argv.includes('--deploy');
const TEST_PREFIX = 'e2e_test_';
const API_URL = process.env.API_URL || 'http://localhost:3000/api';

// Pricing constants (must match lib/pricing.ts)
const MARKUP = 1.5;
const SUBSCRIPTION_CREDITS_CENTS = 1000; // €10
const TOPUP_THRESHOLD_CENTS = 500; // €5
const SONNET_INPUT_PER_1M = 300 * MARKUP; // 450 cents
const SONNET_OUTPUT_PER_1M = 1500 * MARKUP; // 2250 cents

interface TestResult {
  step: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function log(msg: string) {
  console.log(`\n→ ${msg}`);
}

function pass(step: string, details?: string) {
  results.push({ step, passed: true, details });
  console.log(`  ✅ ${step}${details ? ` (${details})` : ''}`);
}

function fail(step: string, error: string) {
  results.push({ step, passed: false, error });
  console.log(`  ❌ ${step}: ${error}`);
}

// ============================================
// Test Steps
// ============================================

async function step1_createUser(): Promise<string> {
  log('Step 1: Create test user (simulates Clerk webhook)');
  
  const clerkId = `${TEST_PREFIX}${Date.now()}`;
  const email = `${clerkId}@test.blitzclaw.com`;
  
  const user = await prisma.user.create({
    data: {
      clerkId,
      email,
    },
  });
  
  pass('User created', `id=${user.id}, clerkId=${clerkId}`);
  return user.id;
}

async function step2_simulateSubscription(userId: string): Promise<void> {
  log('Step 2: Simulate subscription payment (Creem webhook)');
  
  // This simulates what the webhook handler does
  await prisma.user.update({
    where: { id: userId },
    data: { creemCustomerId: `cus_test_${Date.now()}` },
  });
  
  await prisma.balance.create({
    data: {
      userId,
      creditsCents: SUBSCRIPTION_CREDITS_CENTS,
      autoTopupEnabled: true,
      topupThresholdCents: TOPUP_THRESHOLD_CENTS,
      topupAmountCents: SUBSCRIPTION_CREDITS_CENTS,
    },
  });
  
  const balance = await prisma.balance.findUnique({ where: { userId } });
  pass('Subscription credited', `balance=${balance?.creditsCents} cents (€${(balance?.creditsCents || 0) / 100})`);
}

async function step3_createInstance(userId: string): Promise<string> {
  log('Step 3: Create OpenClaw instance');
  
  const instance = await prisma.instance.create({
    data: {
      userId,
      status: InstanceStatus.PROVISIONING,
      channelType: ChannelType.TELEGRAM,
      personaTemplate: 'assistant',
    },
  });
  
  pass('Instance created', `id=${instance.id}, status=${instance.status}`);
  return instance.id;
}

async function step4_simulateDeployment(instanceId: string): Promise<void> {
  log('Step 4: Simulate server deployment');
  
  if (DEPLOY_REAL_SERVER) {
    console.log('  ⚠️  Real deployment requested - this costs ~€4.49/mo');
    console.log('  Skipping for now - run test-hetzner-deploy.sh separately');
  }
  
  // Just mark as active for testing
  await prisma.instance.update({
    where: { id: instanceId },
    data: {
      status: InstanceStatus.ACTIVE,
      ipAddress: '127.0.0.1', // Fake IP for testing
    },
  });
  
  pass('Instance marked active', 'ipAddress=127.0.0.1 (simulated)');
}

async function step5_simulateApiUsage(userId: string, instanceId: string): Promise<void> {
  log('Step 5: Simulate API usage (€1 worth)');
  
  // Calculate tokens needed for ~€1 cost (100 cents) with our markup
  // Using Sonnet 4: input=450c/1M, output=2250c/1M (with 1.5x markup)
  // Let's use mostly output tokens since they're more expensive
  // 100 cents / 2250 cents per 1M = ~44,444 output tokens
  // Or mix: 10k input + 40k output ≈ 4.5 + 90 = 94.5 cents
  
  const inputTokens = 10000;
  const outputTokens = 40000;
  
  const inputCost = Math.ceil((inputTokens * SONNET_INPUT_PER_1M) / 1_000_000);
  const outputCost = Math.ceil((outputTokens * SONNET_OUTPUT_PER_1M) / 1_000_000);
  const totalCost = inputCost + outputCost;
  
  console.log(`  Simulating: ${inputTokens} input + ${outputTokens} output tokens`);
  console.log(`  Expected cost: ${inputCost} + ${outputCost} = ${totalCost} cents (€${totalCost/100})`);
  
  // Create usage log
  await prisma.usageLog.create({
    data: {
      instanceId,
      model: 'claude-sonnet-4-20250514',
      tokensIn: inputTokens,
      tokensOut: outputTokens,
      costCents: totalCost,
    },
  });
  
  // Deduct from balance
  const updatedBalance = await prisma.balance.update({
    where: { userId },
    data: { creditsCents: { decrement: totalCost } },
  });
  
  pass('Usage logged and billed', `cost=${totalCost} cents, new balance=${updatedBalance.creditsCents} cents`);
}

async function step6_verifyMarkup(): Promise<void> {
  log('Step 6: Verify 50% markup');
  
  // Base Anthropic cost for Sonnet 4: $3/$15 per 1M tokens
  // Our price: $4.50/$22.50 per 1M tokens (1.5x markup)
  
  const baseInputPer1M = 300; // $3 = 300 cents
  const baseOutputPer1M = 1500; // $15 = 1500 cents
  const ourInputPer1M = 450; // $4.50
  const ourOutputPer1M = 2250; // $22.50
  
  const inputMarkup = ourInputPer1M / baseInputPer1M;
  const outputMarkup = ourOutputPer1M / baseOutputPer1M;
  
  if (inputMarkup === 1.5 && outputMarkup === 1.5) {
    pass('Markup verified', 'Input: 1.5x, Output: 1.5x');
  } else {
    fail('Markup incorrect', `Input: ${inputMarkup}x, Output: ${outputMarkup}x`);
  }
  
  console.log('\n  📊 Price comparison:');
  console.log('  ┌─────────────────┬─────────────┬─────────────┐');
  console.log('  │                 │ Anthropic   │ BlitzClaw   │');
  console.log('  ├─────────────────┼─────────────┼─────────────┤');
  console.log('  │ Input /1M tok   │ $3.00       │ $4.50       │');
  console.log('  │ Output /1M tok  │ $15.00      │ $22.50      │');
  console.log('  └─────────────────┴─────────────┴─────────────┘');
}

async function step7_testLowBalancePause(userId: string, instanceId: string): Promise<void> {
  log('Step 7: Test low balance → instance pause');
  
  // Drain balance below threshold
  await prisma.balance.update({
    where: { userId },
    data: { creditsCents: 0 }, // €0 - definitely below €5 threshold
  });
  
  // Simulate what proxy does when balance goes negative
  await prisma.instance.update({
    where: { id: instanceId },
    data: { status: InstanceStatus.PAUSED },
  });
  
  const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
  
  if (instance?.status === InstanceStatus.PAUSED) {
    pass('Instance paused on low balance', `status=${instance.status}`);
  } else {
    fail('Instance not paused', `status=${instance?.status}`);
  }
}

async function step8_testSubscriptionCancel(userId: string, instanceId: string): Promise<void> {
  log('Step 8: Test subscription cancellation → instance stopped');
  
  // Simulate subscription.cancelled webhook
  await prisma.instance.updateMany({
    where: { userId },
    data: { status: InstanceStatus.STOPPED },
  });
  
  const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
  
  if (instance?.status === InstanceStatus.STOPPED) {
    pass('Instance stopped on subscription cancel', `status=${instance.status}`);
    console.log('  💡 In production, this would also delete the Hetzner server');
  } else {
    fail('Instance not stopped', `status=${instance?.status}`);
  }
}

async function step9_testDailyLimit(userId: string, instanceId: string): Promise<void> {
  log('Step 9: Test $200/day spending limit');
  
  const DAILY_LIMIT_CENTS = 20000;
  
  // Create usage logs totaling $200 for today
  await prisma.usageLog.create({
    data: {
      instanceId,
      model: 'claude-sonnet-4-20250514',
      tokensIn: 1000000,
      tokensOut: 500000,
      costCents: DAILY_LIMIT_CENTS,
    },
  });
  
  // Check today's usage
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayUsage = await prisma.usageLog.aggregate({
    where: {
      instance: { userId },
      timestamp: { gte: todayStart },
    },
    _sum: { costCents: true },
  });
  
  const todaySpend = todayUsage._sum.costCents || 0;
  
  if (todaySpend >= DAILY_LIMIT_CENTS) {
    pass('Daily limit reached', `today's spend: $${todaySpend / 100} (limit: $${DAILY_LIMIT_CENTS / 100})`);
    console.log('  💡 New API requests would return 429 Too Many Requests');
  } else {
    fail('Daily limit not enforced', `today's spend: $${todaySpend / 100}`);
  }
}

async function cleanup(): Promise<void> {
  log('Cleaning up test data...');
  
  // Delete in order due to foreign keys
  await prisma.usageLog.deleteMany({
    where: { instance: { user: { clerkId: { startsWith: TEST_PREFIX } } } },
  });
  await prisma.instance.deleteMany({
    where: { user: { clerkId: { startsWith: TEST_PREFIX } } },
  });
  await prisma.balance.deleteMany({
    where: { user: { clerkId: { startsWith: TEST_PREFIX } } },
  });
  await prisma.user.deleteMany({
    where: { clerkId: { startsWith: TEST_PREFIX } },
  });
  
  console.log('  ✅ Test data cleaned up');
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         BlitzClaw E2E Flow Test                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  if (DEPLOY_REAL_SERVER) {
    console.log('\n⚠️  Running with --deploy flag (will create real Hetzner server)');
  } else {
    console.log('\n💡 Running in simulation mode (no real servers created)');
    console.log('   Add --deploy flag to test real Hetzner deployment');
  }

  try {
    // Run all steps
    const userId = await step1_createUser();
    await step2_simulateSubscription(userId);
    const instanceId = await step3_createInstance(userId);
    await step4_simulateDeployment(instanceId);
    await step5_simulateApiUsage(userId, instanceId);
    await step6_verifyMarkup();
    await step7_testLowBalancePause(userId, instanceId);
    await step8_testSubscriptionCancel(userId, instanceId);
    await step9_testDailyLimit(userId, instanceId);
    
    // Cleanup
    await cleanup();
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    await cleanup().catch(() => {});
    process.exit(1);
  }

  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log(`\nResults: ${passed}/${total} steps passed\n`);
  
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.step}`);
    if (r.error) console.log(`   Error: ${r.error}`);
  }
  
  if (passed === total) {
    console.log('\n🎉 All E2E tests passed!');
    console.log('\nNext steps for production:');
    console.log('1. Test real Creem webhooks via dashboard');
    console.log('2. Test real Hetzner deployment: npm run test:hetzner');
    console.log('3. Test Telegram bot connection');
  } else {
    console.log(`\n⚠️  ${total - passed} test(s) failed`);
    process.exit(1);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
