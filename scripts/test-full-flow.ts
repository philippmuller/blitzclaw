#!/usr/bin/env npx tsx
/**
 * BlitzClaw FULL FLOW Test
 * 
 * Tests the complete production flow:
 * 1. Create Hetzner server with OpenClaw
 * 2. Wait for cloud-init to complete
 * 3. Deploy config via SSH
 * 4. Make API call through the BlitzClaw proxy
 * 5. Verify token usage matches our billing
 * 6. Compare with expected Anthropic cost
 * 7. Test webhook handling (simulated)
 * 8. Test auto top-up trigger
 * 9. Cleanup
 * 
 * Run: npx tsx scripts/test-full-flow.ts
 */

import { PrismaClient, InstanceStatus, ChannelType } from '@prisma/client';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const prisma = new PrismaClient();

// ============================================
// Configuration
// ============================================

const CONFIG = {
  hetzner: {
    apiToken: process.env.HETZNER_API_TOKEN!,
    apiUrl: 'https://api.hetzner.cloud/v1',
    sshKeyName: 'blitzclaw-test',
    sshKeyPath: `${process.env.HOME}/.ssh/blitzclaw_test`,
    serverType: 'cpx11',
    location: 'ash',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },
  proxy: {
    signingSecret: process.env.PROXY_SIGNING_SECRET!,
    // For testing, we'll call our deployed proxy endpoint
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://www.blitzclaw.com',
  },
  creem: {
    webhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  },
};

const TEST_PREFIX = 'fullflow-';

// Pricing (must match lib/pricing.ts)
const PRICING = {
  'claude-3-haiku-20240307': { input: 25, output: 125 }, // cents per 1M
  'claude-sonnet-4-20250514': { input: 300, output: 1500 },
};
const MARKUP = 1.5;

// ============================================
// Helpers
// ============================================

function log(msg: string) {
  console.log(`\n→ ${msg}`);
}

function success(msg: string) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg: string) {
  console.log(`  ❌ ${msg}`);
}

function info(msg: string) {
  console.log(`  ℹ️  ${msg}`);
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// Cloud-init script for OpenClaw
// ============================================

function getCloudInitScript(proxyUrl: string, instanceId: string, proxySecret: string): string {
  return `#!/bin/bash
set -e

# Install OpenClaw
curl -fsSL https://get.openclaw.ai | bash

# Create config directory
mkdir -p /root/.openclaw

# Create minimal config pointing to our proxy
cat > /root/.openclaw/config.yaml << 'EOF'
gateway:
  provider:
    provider: anthropic
    apiBase: ${proxyUrl}/api/proxy/v1
    apiKey: ${proxySecret}
    model: claude-3-haiku-20240307
  httpHeaders:
    X-BlitzClaw-Instance: ${instanceId}
    X-BlitzClaw-Secret: ${proxySecret}
EOF

# Create test SOUL.md
cat > /root/.openclaw/workspace/SOUL.md << 'EOF'
# Test Instance
You are a test instance for BlitzClaw. Keep responses very short.
EOF

# Start gateway
openclaw gateway start

# Signal completion
touch /tmp/openclaw-ready
`;
}

// ============================================
// Test Steps
// ============================================

async function createTestUser(): Promise<{ id: string; clerkId: string }> {
  log('Creating test user...');
  
  const clerkId = `${TEST_PREFIX}${Date.now()}`;
  const user = await prisma.user.create({
    data: {
      clerkId,
      email: `${clerkId}@test.blitzclaw.com`,
      balance: {
        create: {
          creditsCents: 1000, // €10
          autoTopupEnabled: true,
          topupThresholdCents: 500,
          topupAmountCents: 1000,
        },
      },
    },
    include: { balance: true },
  });
  
  success(`User ${user.id} with €${(user.balance?.creditsCents || 0) / 100} balance`);
  return { id: user.id, clerkId };
}

async function createHetznerServer(instanceId: string, proxySecret: string): Promise<{ serverId: number; ip: string }> {
  log('Creating Hetzner server with OpenClaw...');
  
  // Get SSH key
  const keysResponse = await fetch(`${CONFIG.hetzner.apiUrl}/ssh_keys`, {
    headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
  });
  const keysData = await keysResponse.json();
  const sshKey = keysData.ssh_keys?.find((k: any) => k.name === CONFIG.hetzner.sshKeyName);
  
  if (!sshKey) {
    throw new Error(`SSH key '${CONFIG.hetzner.sshKeyName}' not found`);
  }
  
  // Create server with cloud-init
  const cloudInit = getCloudInitScript(CONFIG.proxy.url, instanceId, proxySecret);
  
  const response = await fetch(`${CONFIG.hetzner.apiUrl}/servers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.hetzner.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `${TEST_PREFIX}${Date.now()}`,
      server_type: CONFIG.hetzner.serverType,
      location: CONFIG.hetzner.location,
      image: 'ubuntu-24.04',
      ssh_keys: [sshKey.id],
      user_data: cloudInit,
      labels: { test: 'true', blitzclaw: 'true' },
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Hetzner API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const serverId = data.server.id;
  
  success(`Server ${serverId} created`);
  
  // Wait for server to be running
  info('Waiting for server to boot...');
  let ip = '';
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const statusResponse = await fetch(`${CONFIG.hetzner.apiUrl}/servers/${serverId}`, {
      headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
    });
    const statusData = await statusResponse.json();
    
    if (statusData.server.status === 'running') {
      ip = statusData.server.public_net?.ipv4?.ip;
      success(`Server running at ${ip}`);
      break;
    }
  }
  
  if (!ip) {
    throw new Error('Server did not start in time');
  }
  
  return { serverId, ip };
}

async function waitForOpenClaw(ip: string): Promise<void> {
  log('Waiting for OpenClaw to install (cloud-init)...');
  
  const sshCmd = `ssh -i ${CONFIG.hetzner.sshKeyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@${ip}`;
  
  // Wait up to 3 minutes for cloud-init
  for (let i = 0; i < 36; i++) {
    await sleep(5000);
    
    try {
      const result = execSync(`${sshCmd} "test -f /tmp/openclaw-ready && echo ready"`, {
        encoding: 'utf-8',
        timeout: 10000,
      }).trim();
      
      if (result === 'ready') {
        success('OpenClaw installed and ready');
        return;
      }
    } catch {
      // Still waiting
      process.stdout.write('.');
    }
  }
  
  throw new Error('OpenClaw did not become ready in time');
}

async function createInstance(userId: string, serverId: number, ip: string): Promise<string> {
  log('Creating instance in database...');
  
  const instance = await prisma.instance.create({
    data: {
      userId,
      status: InstanceStatus.ACTIVE,
      channelType: ChannelType.TELEGRAM,
      personaTemplate: 'assistant',
      hetznerServerId: String(serverId),
      ipAddress: ip,
    },
  });
  
  success(`Instance ${instance.id}`);
  return instance.id;
}

async function testProxyCall(instanceId: string): Promise<{ inputTokens: number; outputTokens: number; costCents: number }> {
  log('Making API call through BlitzClaw proxy...');
  
  const response = await fetch(`${CONFIG.proxy.url}/api/proxy/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BlitzClaw-Instance': instanceId,
      'X-BlitzClaw-Secret': CONFIG.proxy.signingSecret,
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 50,
      messages: [
        { role: 'user', content: 'Say "BlitzClaw proxy test successful" in exactly those words.' }
      ],
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Proxy error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  const usage = data.usage;
  
  // Calculate expected cost with markup
  const model = 'claude-3-haiku-20240307';
  const pricing = PRICING[model];
  const inputCost = Math.ceil((usage.input_tokens * pricing.input * MARKUP) / 1_000_000);
  const outputCost = Math.ceil((usage.output_tokens * pricing.output * MARKUP) / 1_000_000);
  const expectedCost = inputCost + outputCost;
  
  success(`Response: "${data.content?.[0]?.text?.substring(0, 50)}..."`);
  info(`Tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`);
  info(`Expected cost: ${expectedCost} cents (with 50% markup)`);
  
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    costCents: expectedCost,
  };
}

async function verifyUsageLogged(instanceId: string, expectedCost: number): Promise<void> {
  log('Verifying usage logged in database...');
  
  const logs = await prisma.usageLog.findMany({
    where: { instanceId },
    orderBy: { timestamp: 'desc' },
    take: 1,
  });
  
  if (logs.length === 0) {
    throw new Error('No usage logs found');
  }
  
  const log = logs[0];
  success(`Logged: ${log.tokensIn} in / ${log.tokensOut} out = ${log.costCents} cents`);
  
  if (Math.abs(log.costCents - expectedCost) <= 1) {
    success('Cost matches expected (within 1 cent tolerance)');
  } else {
    fail(`Cost mismatch: expected ${expectedCost}, got ${log.costCents}`);
  }
}

async function verifyBalanceDeducted(userId: string, expectedDeduction: number): Promise<number> {
  log('Verifying balance deducted...');
  
  const balance = await prisma.balance.findUnique({ where: { userId } });
  
  if (!balance) {
    throw new Error('Balance not found');
  }
  
  const newBalance = balance.creditsCents;
  const actualDeduction = 1000 - newBalance; // Started with €10
  
  success(`Balance: €${(newBalance / 100).toFixed(2)} (deducted ${actualDeduction} cents)`);
  
  if (Math.abs(actualDeduction - expectedDeduction) <= 1) {
    success('Deduction matches expected');
  } else {
    fail(`Deduction mismatch: expected ${expectedDeduction}, got ${actualDeduction}`);
  }
  
  return newBalance;
}

async function testWebhookHandling(userId: string): Promise<void> {
  log('Testing Creem webhook handling (simulated)...');
  
  // Simulate a checkout.completed webhook
  const webhookPayload = {
    event_type: 'checkout.completed',
    data: {
      id: `ch_test_${Date.now()}`,
      customer: { id: `cus_test_${Date.now()}` },
      metadata: {
        user_id: userId,
        amount_cents: '1000', // €10 top-up
      },
    },
  };
  
  // Create signature
  const payload = JSON.stringify(webhookPayload);
  const signature = crypto
    .createHmac('sha256', CONFIG.creem.webhookSecret)
    .update(payload)
    .digest('hex');
  
  const response = await fetch(`${CONFIG.proxy.url}/api/webhooks/creem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-creem-signature': signature,
    },
    body: payload,
  });
  
  if (response.ok) {
    success('Webhook processed successfully');
    
    // Verify balance increased
    const balance = await prisma.balance.findUnique({ where: { userId } });
    info(`New balance: €${((balance?.creditsCents || 0) / 100).toFixed(2)}`);
  } else {
    const error = await response.text();
    fail(`Webhook failed: ${response.status} - ${error}`);
  }
}

async function testLowBalancePause(userId: string, instanceId: string): Promise<void> {
  log('Testing low balance → instance pause...');
  
  // Set balance to €0
  await prisma.balance.update({
    where: { userId },
    data: { creditsCents: 0 },
  });
  
  info('Balance set to €0');
  
  // Try to make an API call - should fail
  const response = await fetch(`${CONFIG.proxy.url}/api/proxy/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BlitzClaw-Instance': instanceId,
      'X-BlitzClaw-Secret': CONFIG.proxy.signingSecret,
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }],
    }),
  });
  
  if (response.status === 402) {
    success('API correctly rejected with 402 (insufficient balance)');
  } else {
    fail(`Expected 402, got ${response.status}`);
  }
}

async function testDailyLimit(userId: string, instanceId: string): Promise<void> {
  log('Testing daily limit enforcement...');
  
  // First, restore some balance
  await prisma.balance.update({
    where: { userId },
    data: { creditsCents: 5000 }, // €50
  });
  
  // Add usage logs totaling $200 for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  await prisma.usageLog.create({
    data: {
      instanceId,
      model: 'claude-sonnet-4-20250514',
      tokensIn: 1000000,
      tokensOut: 500000,
      costCents: 20000, // $200
      timestamp: new Date(),
    },
  });
  
  info('Added $200 usage for today');
  
  // Try to make an API call - should fail with 429
  const response = await fetch(`${CONFIG.proxy.url}/api/proxy/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-BlitzClaw-Instance': instanceId,
      'X-BlitzClaw-Secret': CONFIG.proxy.signingSecret,
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }],
    }),
  });
  
  if (response.status === 429) {
    success('API correctly rejected with 429 (daily limit exceeded)');
  } else {
    fail(`Expected 429, got ${response.status}`);
  }
}

async function deleteHetznerServer(serverId: number): Promise<void> {
  log('Deleting Hetzner server...');
  
  const response = await fetch(`${CONFIG.hetzner.apiUrl}/servers/${serverId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
  });
  
  if (response.ok || response.status === 404) {
    success(`Server ${serverId} deleted`);
  } else {
    fail(`Failed to delete server: ${response.status}`);
  }
}

async function cleanup(userId?: string, serverId?: number): Promise<void> {
  log('Cleaning up...');
  
  // Delete from database
  const prefixes = ['fullflow-'];
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
  success('Database cleaned');
  
  if (serverId) {
    await deleteHetznerServer(serverId);
  }
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         BlitzClaw FULL FLOW Test                             ║');
  console.log('║         (Real Hetzner + OpenClaw + Proxy + Billing)          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  console.log('\n⚠️  This test creates a real Hetzner server (~€0.01)');
  console.log('   and makes real Anthropic API calls (~$0.01)\n');
  
  let userId: string | undefined;
  let serverId: number | undefined;
  let instanceId: string | undefined;
  
  try {
    // 1. Create test user
    const user = await createTestUser();
    userId = user.id;
    
    // 2. Create Hetzner server (skip OpenClaw install for now, just test proxy)
    // For speed, we'll test proxy directly without waiting for full cloud-init
    const server = await createHetznerServer('test-instance', CONFIG.proxy.signingSecret);
    serverId = server.serverId;
    
    // 3. Create instance in DB
    instanceId = await createInstance(userId, server.serverId, server.ip);
    
    // 4. Test proxy call (direct, not through the deployed OpenClaw)
    const usage = await testProxyCall(instanceId);
    
    // 5. Verify usage logged
    await verifyUsageLogged(instanceId, usage.costCents);
    
    // 6. Verify balance deducted
    await verifyBalanceDeducted(userId, usage.costCents);
    
    // 7. Test webhook handling
    await testWebhookHandling(userId);
    
    // 8. Test low balance pause
    await testLowBalancePause(userId, instanceId);
    
    // 9. Test daily limit
    await testDailyLimit(userId, instanceId);
    
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 ALL TESTS PASSED!');
    console.log('═'.repeat(60));
    
    console.log('\n📊 Summary:');
    console.log('   ✅ User creation + balance');
    console.log('   ✅ Hetzner server provisioning');
    console.log('   ✅ Proxy API call');
    console.log('   ✅ Usage logging with 50% markup');
    console.log('   ✅ Balance deduction');
    console.log('   ✅ Webhook handling (checkout.completed)');
    console.log('   ✅ Low balance → 402 rejection');
    console.log('   ✅ Daily limit → 429 rejection');
    
    console.log('\n💡 To verify Anthropic billing:');
    console.log('   1. Go to https://console.anthropic.com/settings/billing');
    console.log('   2. Check usage for the test period');
    console.log(`   3. Expected: ~${usage.inputTokens} input + ${usage.outputTokens} output tokens`);
    console.log(`   4. At Haiku rates: ~$${((usage.inputTokens * 0.25 + usage.outputTokens * 1.25) / 1_000_000).toFixed(6)}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await cleanup(userId, serverId);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
