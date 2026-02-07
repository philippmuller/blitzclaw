/**
 * BlitzClaw - Database Operations Tests
 * 
 * Tests:
 * - User CRUD
 * - Balance operations
 * - Instance lifecycle
 * - Usage logging
 * 
 * Run: npx tsx scripts/test-database.ts
 * 
 * Requires: DATABASE_URL in .env or environment
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  // Delete test data
  await prisma.usageLog.deleteMany({ where: { instance: { user: { clerkId: { startsWith: 'test_' } } } } });
  await prisma.instance.deleteMany({ where: { user: { clerkId: { startsWith: 'test_' } } } });
  await prisma.balance.deleteMany({ where: { user: { clerkId: { startsWith: 'test_' } } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: 'test_' } } });
  await prisma.serverPool.deleteMany({ where: { hetznerServerId: { startsWith: 'test_' } } });
}

async function main() {
  console.log('==========================================');
  console.log('BlitzClaw Database Tests');
  console.log('==========================================\n');
  
  // Cleanup any previous test data
  console.log('Cleaning up previous test data...\n');
  await cleanup();

  // Test 1: Create user
  let testUserId: string;
  await test('Create user with balance', async () => {
    const user = await prisma.user.create({
      data: {
        clerkId: 'test_db_user_' + Date.now(),
        email: 'test@example.com',
        balance: {
          create: {
            creditsCents: 5000, // $50
          },
        },
      },
      include: { balance: true },
    });
    testUserId = user.id;
    
    if (!user.balance) throw new Error('Balance not created');
    if (user.balance.creditsCents !== 5000) throw new Error('Wrong balance');
  });

  // Test 2: Update balance
  await test('Update balance (deduct)', async () => {
    const updated = await prisma.balance.update({
      where: { userId: testUserId },
      data: { creditsCents: { decrement: 100 } },
    });
    
    if (updated.creditsCents !== 4900) throw new Error(`Expected 4900, got ${updated.creditsCents}`);
  });

  // Test 3: Create instance
  let testInstanceId: string;
  await test('Create instance', async () => {
    const instance = await prisma.instance.create({
      data: {
        userId: testUserId,
        hetznerServerId: 'test_server_123',
        ipAddress: '10.0.0.1',
        status: 'ACTIVE',
        channelType: 'TELEGRAM',
        personaTemplate: 'assistant',
        soulMd: '# Test SOUL',
      },
    });
    testInstanceId = instance.id;
    
    if (instance.status !== 'ACTIVE') throw new Error('Wrong status');
  });

  // Test 4: Log usage
  await test('Log token usage', async () => {
    const log = await prisma.usageLog.create({
      data: {
        instanceId: testInstanceId,
        model: 'claude-sonnet-4',
        tokensIn: 1000,
        tokensOut: 500,
        costCents: 5,
      },
    });
    
    if (log.tokensIn !== 1000) throw new Error('Wrong token count');
  });

  // Test 5: Query usage aggregate
  await test('Aggregate usage by instance', async () => {
    const usage = await prisma.usageLog.aggregate({
      where: { instanceId: testInstanceId },
      _sum: { tokensIn: true, tokensOut: true, costCents: true },
    });
    
    if (usage._sum.tokensIn !== 1000) throw new Error('Wrong aggregate');
    if (usage._sum.costCents !== 5) throw new Error('Wrong cost aggregate');
  });

  // Test 6: Update instance status
  await test('Update instance status to PAUSED', async () => {
    const updated = await prisma.instance.update({
      where: { id: testInstanceId },
      data: { status: 'PAUSED' },
    });
    
    if (updated.status !== 'PAUSED') throw new Error('Status not updated');
  });

  // Test 7: Server pool operations
  await test('Server pool add/assign/release', async () => {
    // Add to pool
    const server = await prisma.serverPool.create({
      data: {
        hetznerServerId: 'test_pool_server_' + Date.now(),
        ipAddress: '10.0.0.2',
        status: 'AVAILABLE',
      },
    });
    
    // Assign
    const assigned = await prisma.serverPool.update({
      where: { id: server.id },
      data: { status: 'ASSIGNED', assignedTo: testInstanceId },
    });
    if (assigned.status !== 'ASSIGNED') throw new Error('Not assigned');
    
    // Release
    const released = await prisma.serverPool.update({
      where: { id: server.id },
      data: { status: 'AVAILABLE', assignedTo: null },
    });
    if (released.status !== 'AVAILABLE') throw new Error('Not released');
  });

  // Test 8: Cascade delete
  await test('Cascade delete user → balance + instances', async () => {
    await prisma.user.delete({ where: { id: testUserId } });
    
    const balance = await prisma.balance.findUnique({ where: { userId: testUserId } });
    const instances = await prisma.instance.findMany({ where: { userId: testUserId } });
    
    if (balance !== null) throw new Error('Balance not cascaded');
    if (instances.length > 0) throw new Error('Instances not cascaded');
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
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
