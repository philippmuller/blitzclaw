import { PrismaClient } from '@blitzclaw/db';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting all users and related data...');
  
  // Delete in order (foreign key constraints)
  const logs = await prisma.usageLog.deleteMany({});
  console.log(`Deleted ${logs.count} usage logs`);
  
  const instances = await prisma.instance.deleteMany({});
  console.log(`Deleted ${instances.count} instances`);
  
  const balances = await prisma.balance.deleteMany({});
  console.log(`Deleted ${balances.count} balances`);
  
  const users = await prisma.user.deleteMany({});
  console.log(`Deleted ${users.count} users`);
  
  // Keep pool servers but reset them to AVAILABLE
  const pool = await prisma.serverPool.updateMany({
    data: { 
      status: 'AVAILABLE',
      assignedTo: null,
    }
  });
  console.log(`Reset ${pool.count} pool servers`);
  
  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
