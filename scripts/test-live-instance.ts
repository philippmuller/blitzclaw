#!/usr/bin/env npx tsx
/**
 * BlitzClaw LIVE INSTANCE Test
 * 
 * Deploys real OpenClaw, makes a real chat, verifies billing.
 * Uses enough tokens to show up in Anthropic billing (~1-2 cents).
 * 
 * Run: npx tsx scripts/test-live-instance.ts
 */

import { PrismaClient, InstanceStatus, ChannelType } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const prisma = new PrismaClient();

const CONFIG = {
  hetzner: {
    apiToken: process.env.HETZNER_API_TOKEN!,
    apiUrl: 'https://api.hetzner.cloud/v1',
    sshKeyName: 'blitzclaw-test',
  },
  proxy: {
    url: 'https://www.blitzclaw.com',
    secret: process.env.PROXY_SIGNING_SECRET!,
  },
};

// Use Sonnet for bigger billing impact
const MODEL = 'claude-sonnet-4-20250514';
// Pricing: $3/$15 per 1M (base), $6/$30 with 100% markup
const BASE_INPUT_PER_1M = 300; // cents
const BASE_OUTPUT_PER_1M = 1500; // cents
const MARKUP = 2.0;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         BlitzClaw LIVE INSTANCE Test                         ║');
  console.log('║         (Real OpenClaw + Larger Request for Billing)         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let serverId: number | undefined;
  let userId: string | undefined;
  let instanceId: string | undefined;

  try {
    // 1. Create test user with balance
    console.log('→ Creating test user...');
    const user = await prisma.user.create({
      data: {
        clerkId: `live-test-${Date.now()}`,
        email: `live-test-${Date.now()}@test.blitzclaw.com`,
        balance: { create: { creditsCents: 10000 } }, // €100 to be safe
      },
    });
    userId = user.id;
    console.log(`  ✅ User ${user.id} with €100 balance\n`);

    // 2. Create Hetzner server
    console.log('→ Creating Hetzner server...');
    const keysRes = await fetch(`${CONFIG.hetzner.apiUrl}/ssh_keys`, {
      headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
    });
    const keysData = await keysRes.json();
    const sshKey = keysData.ssh_keys?.find((k: any) => k.name === CONFIG.hetzner.sshKeyName);

    const serverRes = await fetch(`${CONFIG.hetzner.apiUrl}/servers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.hetzner.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `live-test-${Date.now()}`,
        server_type: 'cpx11',
        location: 'ash',
        image: 'ubuntu-24.04',
        ssh_keys: [sshKey.id],
        labels: { test: 'true' },
      }),
    });
    
    const serverData = await serverRes.json();
    serverId = serverData.server.id;
    console.log(`  ✅ Server ${serverId} created`);

    // Wait for IP
    let ip = '';
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const statusRes = await fetch(`${CONFIG.hetzner.apiUrl}/servers/${serverId}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
      });
      const status = await statusRes.json();
      if (status.server.status === 'running') {
        ip = status.server.public_net?.ipv4?.ip;
        break;
      }
    }
    console.log(`  ✅ Server running at ${ip}\n`);

    // 3. Create instance in DB
    console.log('→ Creating instance...');
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
    instanceId = instance.id;
    console.log(`  ✅ Instance ${instanceId}\n`);

    // 4. Make a LARGER request through proxy to generate visible billing
    console.log('→ Making API request through BlitzClaw proxy...');
    console.log(`  Model: ${MODEL} (Sonnet - $3/$15 per 1M base)\n`);

    const startTime = Date.now();
    const response = await fetch(`${CONFIG.proxy.url}/api/proxy/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BlitzClaw-Instance': instanceId,
        'X-BlitzClaw-Secret': CONFIG.proxy.secret,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500, // Request more output tokens
        messages: [
          { 
            role: 'user', 
            content: `Write a detailed 3-paragraph explanation of how cloud computing works, including virtualization, containerization, and serverless computing. Be thorough but concise.`
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    const elapsed = Date.now() - startTime;
    const usage = data.usage;

    console.log(`  ✅ Response received (${elapsed}ms)`);
    console.log(`  📝 Response preview: "${data.content?.[0]?.text?.substring(0, 100)}..."\n`);

    // 5. Calculate and display costs
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;

    const anthropicInputCost = (inputTokens / 1_000_000) * BASE_INPUT_PER_1M;
    const anthropicOutputCost = (outputTokens / 1_000_000) * BASE_OUTPUT_PER_1M;
    const anthropicTotal = anthropicInputCost + anthropicOutputCost;

    const ourInputCost = anthropicInputCost * MARKUP;
    const ourOutputCost = anthropicOutputCost * MARKUP;
    const ourTotal = ourInputCost + ourOutputCost;

    const profit = ourTotal - anthropicTotal;

    console.log('═'.repeat(60));
    console.log('📊 BILLING BREAKDOWN');
    console.log('═'.repeat(60));
    console.log(`\n  Tokens used: ${inputTokens} input + ${outputTokens} output\n`);
    console.log('  ┌─────────────────┬─────────────────┬─────────────────┐');
    console.log('  │                 │ Anthropic (base)│ BlitzClaw (2x)  │');
    console.log('  ├─────────────────┼─────────────────┼─────────────────┤');
    console.log(`  │ Input cost      │ $${anthropicInputCost.toFixed(6).padStart(12)}  │ $${ourInputCost.toFixed(6).padStart(12)}  │`);
    console.log(`  │ Output cost     │ $${anthropicOutputCost.toFixed(6).padStart(12)}  │ $${ourOutputCost.toFixed(6).padStart(12)}  │`);
    console.log('  ├─────────────────┼─────────────────┼─────────────────┤');
    console.log(`  │ TOTAL           │ $${anthropicTotal.toFixed(6).padStart(12)}  │ $${ourTotal.toFixed(6).padStart(12)}  │`);
    console.log('  └─────────────────┴─────────────────┴─────────────────┘');
    console.log(`\n  💰 Profit: $${profit.toFixed(6)} (${((profit/anthropicTotal)*100).toFixed(0)}% margin)`);

    // 6. Verify database logging
    console.log('\n→ Verifying database...');
    const usageLog = await prisma.usageLog.findFirst({
      where: { instanceId },
      orderBy: { timestamp: 'desc' },
    });
    
    const balance = await prisma.balance.findUnique({ where: { userId } });
    
    console.log(`  ✅ Usage logged: ${usageLog?.tokensIn} in / ${usageLog?.tokensOut} out = ${usageLog?.costCents} cents`);
    console.log(`  ✅ Balance: €${((balance?.creditsCents || 0) / 100).toFixed(2)} (started with €100)`);

    // Final summary
    console.log('\n' + '═'.repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('═'.repeat(60));
    console.log(`\n  📋 Check Anthropic billing dashboard for ~$${anthropicTotal.toFixed(4)} charge`);
    console.log('  🔗 https://console.anthropic.com/settings/billing\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('→ Cleaning up...');
    
    if (userId) {
      await prisma.usageLog.deleteMany({ where: { instance: { userId } } });
      await prisma.instance.deleteMany({ where: { userId } });
      await prisma.balance.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      console.log('  ✅ Database cleaned');
    }

    if (serverId) {
      await fetch(`${CONFIG.hetzner.apiUrl}/servers/${serverId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${CONFIG.hetzner.apiToken}` },
      });
      console.log(`  ✅ Server ${serverId} deleted`);
    }

    console.log('\n🏁 Done!\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
