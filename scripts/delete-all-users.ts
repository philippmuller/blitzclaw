import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // List all users first
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { balance: true, instances: true }
  });
  
  console.log("Found users:");
  for (const u of users) {
    console.log(`- ${u.id} | ${u.email} | billingMode: ${u.billingMode} | balance: ${u.balance?.creditsCents ?? 0} | instances: ${u.instances.length}`);
  }

  if (users.length === 0) {
    console.log("No users to delete");
    return;
  }
  
  // Delete all test data (balances, instances, users)
  console.log("\nDeleting all data...");
  const delBalance = await prisma.balance.deleteMany({});
  const delInstance = await prisma.instance.deleteMany({});
  const delUser = await prisma.user.deleteMany({});
  
  console.log(`✅ Deleted: ${delUser.count} users, ${delBalance.count} balances, ${delInstance.count} instances`);
}

main().finally(() => prisma.$disconnect());
