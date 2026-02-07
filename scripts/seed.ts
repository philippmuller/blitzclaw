/**
 * Database Seed Script
 * 
 * Creates test data for local development:
 * - Test user with $50 balance
 * 
 * Usage:
 *   npx ts-node scripts/seed.ts
 * 
 * Or with tsx:
 *   npx tsx scripts/seed.ts
 */

import { PrismaClient } from '@blitzclaw/db';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { 
      clerkId: 'test_user_123' 
    },
    update: {},
    create: {
      clerkId: 'test_user_123',
      email: 'test@blitzclaw.local',
      balance: {
        create: {
          creditsCents: 5000, // $50
          autoTopupEnabled: false,
          topupThresholdCents: 1000,
          topupAmountCents: 2000,
        },
      },
    },
    include: {
      balance: true,
    },
  });

  console.log('✅ Created test user:');
  console.log(`   ID: ${testUser.id}`);
  console.log(`   Email: ${testUser.email}`);
  console.log(`   Clerk ID: ${testUser.clerkId}`);
  console.log(`   Balance: $${(testUser.balance?.creditsCents || 0) / 100}`);
  console.log('');

  // Create a sample instance (no server, just for UI testing)
  const testInstance = await prisma.instance.upsert({
    where: {
      id: 'test_instance_123',
    },
    update: {},
    create: {
      id: 'test_instance_123',
      userId: testUser.id,
      hetznerServerId: 'mock_server_1',
      ipAddress: '10.0.0.1',
      status: 'active',
      channelType: 'telegram',
      channelConfig: {
        botToken: 'mock_token',
        botUsername: 'test_bot',
      },
      personaTemplate: 'assistant',
      soulMd: `# SOUL.md

You are a helpful personal assistant.

## Behavior
- Be concise and helpful
- This is a test instance for development
`,
      useOwnApiKey: false,
    },
  });

  console.log('✅ Created test instance:');
  console.log(`   ID: ${testInstance.id}`);
  console.log(`   Status: ${testInstance.status}`);
  console.log(`   Channel: ${testInstance.channelType}`);
  console.log('');

  console.log('🎉 Seeding complete!\n');
  console.log('You can now run the app and log in as the test user.');
  console.log('Note: Clerk auth will create a separate user - this seed data is for API testing.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
