/**
 * BlitzClaw - Token Proxy Logic Tests
 * 
 * Tests the proxy's request handling logic WITHOUT making real API calls.
 * Tests:
 * - Instance authentication
 * - Balance checking
 * - Usage calculation & logging
 * - Balance deduction
 * - Instance pausing on low balance
 * 
 * Run: npx tsx scripts/test-proxy-logic.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// Proxy Logic (extracted from route handler)
// ============================================

const PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'claude-sonnet-4': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
};

const MARKUP = 1.5;
const MIN_BALANCE_CENTS = 1000;
const PROXY_SECRET = 'test-proxy-secret';

function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || PRICING['claude-sonnet-4'];
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M * MARKUP;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M * MARKUP;
  return Math.ceil((inputCost + outputCost) * 100);
}

interface ProxyRequest {
  instanceId: string;
  proxySecret: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface ProxyResult {
  success: boolean;
  error?: string;
  errorCode?: number;
  costCents?: number;
  newBalanceCents?: number;
  instancePaused?: boolean;
}

async function processProxyRequest(req: ProxyRequest): Promise<ProxyResult> {
  // 1. Validate instance
  const instance = await prisma.instance.findUnique({
    where: { id: req.instanceId },
    include: { user: { include: { balance: true } } },
  });

  if (!instance) {
    return { success: false, error: 'Instance not found', errorCode: 404 };
  }

  // 2. Validate secret (in real impl, this would be hashed)
  // For test, we just check it exists
  if (!req.proxySecret || req.proxySecret.length < 10) {
    return { success: false, error: 'Invalid proxy secret', errorCode: 401 };
  }

  // 3. Check balance
  const balance = instance.user.balance;
  if (!balance || balance.creditsCents < MIN_BALANCE_CENTS) {
    return { 
      success: false, 
      error: 'Insufficient balance', 
      errorCode: 402 
    };
  }

  // 4. Calculate cost
  const costCents = calculateCostCents(req.model, req.inputTokens, req.outputTokens);

  // 5. Deduct balance and log usage (in transaction)
  const [updatedBalance, _usageLog] = await prisma.$transaction([
    prisma.balance.update({
      where: { userId: instance.userId },
      data: { creditsCents: { decrement: costCents } },
    }),
    prisma.usageLog.create({
      data: {
        instanceId: instance.id,
        model: req.model,
        tokensIn: req.inputTokens,
        tokensOut: req.outputTokens,
        costCents: costCents,
      },
    }),
  ]);

  // 6. Check if should pause
  let instancePaused = false;
  if (updatedBalance.creditsCents < MIN_BALANCE_CENTS) {
    await prisma.instance.update({
      where: { id: instance.id },
      data: { status: 'PAUSED' },
    });
    instancePaused = true;
  }

  return {
    success: true,
    costCents,
    newBalanceCents: updatedBalance.creditsCents,
    instancePaused,
  };
}

// ============================================
// Tests
// ============================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error) });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error}`);
  }
}

async function cleanup() {
  await prisma.usageLog.deleteMany({ where: { instance: { user: { clerkId: { startsWith: 'proxy_test_' } } } } });
  await prisma.instance.deleteMany({ where: { user: { clerkId: { startsWith: 'proxy_test_' } } } });
  await prisma.balance.deleteMany({ where: { user: { clerkId: { startsWith: 'proxy_test_' } } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: 'proxy_test_' } } });
}

async function setupTestUser(balanceCents: number) {
  const user = await prisma.user.create({
    data: {
      clerkId: `proxy_test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      email: 'proxy-test@test.local',
      balance: {
        create: { creditsCents: balanceCents },
      },
    },
  });
  
  const instance = await prisma.instance.create({
    data: {
      userId: user.id,
      status: 'ACTIVE',
      channelType: 'TELEGRAM',
      personaTemplate: 'assistant',
    },
  });
  
  return { user, instance };
}

async function main() {
  console.log('==========================================');
  console.log('BlitzClaw Token Proxy Logic Tests');
  console.log('==========================================\n');

  await cleanup();

  // Test 1: Successful request
  await test('Process request with sufficient balance', async () => {
    const { instance } = await setupTestUser(5000); // $50
    
    const result = await processProxyRequest({
      instanceId: instance.id,
      proxySecret: PROXY_SECRET,
      model: 'claude-sonnet-4',
      inputTokens: 1000,
      outputTokens: 500,
    });
    
    if (!result.success) throw new Error(`Expected success, got: ${result.error}`);
    if (!result.costCents || result.costCents < 1) throw new Error('Expected cost > 0');
    if (result.instancePaused) throw new Error('Instance should not be paused');
  });

  // Test 2: Invalid instance
  await test('Reject request for non-existent instance', async () => {
    const result = await processProxyRequest({
      instanceId: 'non-existent-id',
      proxySecret: PROXY_SECRET,
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
    });
    
    if (result.success) throw new Error('Expected failure');
    if (result.errorCode !== 404) throw new Error(`Expected 404, got ${result.errorCode}`);
  });

  // Test 3: Insufficient balance (below minimum)
  await test('Reject request when balance below minimum', async () => {
    const { instance } = await setupTestUser(500); // $5 (below $10 min)
    
    const result = await processProxyRequest({
      instanceId: instance.id,
      proxySecret: PROXY_SECRET,
      model: 'claude-sonnet-4',
      inputTokens: 1000,
      outputTokens: 500,
    });
    
    if (result.success) throw new Error('Expected failure');
    if (result.errorCode !== 402) throw new Error(`Expected 402, got ${result.errorCode}`);
  });

  // Test 4: Request that depletes balance → pause instance
  await test('Pause instance when balance depleted', async () => {
    const { instance, user } = await setupTestUser(1050); // $10.50 (just above min)
    
    // Large request that will deplete balance
    const result = await processProxyRequest({
      instanceId: instance.id,
      proxySecret: PROXY_SECRET,
      model: 'claude-sonnet-4',
      inputTokens: 100000, // Large request
      outputTokens: 4000,
    });
    
    if (!result.success) throw new Error(`Expected success, got: ${result.error}`);
    if (!result.instancePaused) throw new Error('Instance should be paused');
    
    // Verify instance status in DB
    const updatedInstance = await prisma.instance.findUnique({ where: { id: instance.id } });
    if (updatedInstance?.status !== 'PAUSED') {
      throw new Error(`Expected PAUSED status, got ${updatedInstance?.status}`);
    }
  });

  // Test 5: Usage logging
  await test('Log usage correctly', async () => {
    const { instance } = await setupTestUser(5000);
    
    await processProxyRequest({
      instanceId: instance.id,
      proxySecret: PROXY_SECRET,
      model: 'claude-3-haiku-20240307',
      inputTokens: 5000,
      outputTokens: 1000,
    });
    
    const logs = await prisma.usageLog.findMany({
      where: { instanceId: instance.id },
    });
    
    if (logs.length !== 1) throw new Error(`Expected 1 log, got ${logs.length}`);
    if (logs[0].tokensIn !== 5000) throw new Error('Wrong input tokens logged');
    if (logs[0].tokensOut !== 1000) throw new Error('Wrong output tokens logged');
    if (logs[0].model !== 'claude-3-haiku-20240307') throw new Error('Wrong model logged');
  });

  // Test 6: Multiple requests accumulate
  await test('Multiple requests accumulate usage', async () => {
    const { instance } = await setupTestUser(5000);
    
    // 3 requests
    for (let i = 0; i < 3; i++) {
      await processProxyRequest({
        instanceId: instance.id,
        proxySecret: PROXY_SECRET,
        model: 'claude-sonnet-4',
        inputTokens: 1000,
        outputTokens: 500,
      });
    }
    
    const logs = await prisma.usageLog.findMany({
      where: { instanceId: instance.id },
    });
    
    if (logs.length !== 3) throw new Error(`Expected 3 logs, got ${logs.length}`);
    
    const totalCost = logs.reduce((sum, log) => sum + log.costCents, 0);
    if (totalCost < 3) throw new Error('Total cost should be at least 3 cents');
  });

  // Cleanup
  console.log('\nCleaning up...');
  await cleanup();

  // Summary
  console.log('\n==========================================');
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(`✅ ALL TESTS PASSED (${passed}/${total})`);
  } else {
    console.log(`❌ SOME TESTS FAILED (${passed}/${total} passed)`);
    process.exit(1);
  }
  console.log('==========================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
