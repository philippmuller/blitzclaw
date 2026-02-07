import { currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";

async function getOrCreateUser(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
    include: { balance: true },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        balance: {
          create: {
            creditsCents: 0,
            autoTopupEnabled: false,
            topupThresholdCents: 500,
            topupAmountCents: 2000,
          },
        },
      },
      include: { balance: true },
    });
  }

  return user;
}

export default async function DashboardPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const user = await getOrCreateUser(clerkUser);
  const balance = user.balance?.creditsCents ?? 0;
  const balanceDollars = (balance / 100).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-blue-600">
            ⚡ BlitzClaw
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">{clerkUser.emailAddresses[0]?.emailAddress}</span>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Balance Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Current Balance</div>
            <div className="text-3xl font-bold text-gray-900">${balanceDollars}</div>
            {balance < 1000 && (
              <div className="text-sm text-red-500 mt-2">
                ⚠️ Below $10 minimum
              </div>
            )}
            <Link
              href="/dashboard/topup"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Top Up
            </Link>
          </div>

          {/* Instances Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">Active Instances</div>
            <div className="text-3xl font-bold text-gray-900">0</div>
            <Link
              href="/dashboard/instances/new"
              className="mt-4 inline-block px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
            >
              Create Instance
            </Link>
          </div>

          {/* Usage Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border">
            <div className="text-sm text-gray-500 mb-1">This Month&apos;s Usage</div>
            <div className="text-3xl font-bold text-gray-900">$0.00</div>
            <Link
              href="/dashboard/usage"
              className="mt-4 inline-block px-4 py-2 border text-gray-700 text-sm rounded-lg hover:bg-gray-50"
            >
              View Details
            </Link>
          </div>
        </div>

        {/* Empty state */}
        <div className="bg-white p-12 rounded-xl shadow-sm border text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-xl font-semibold mb-2">No instances yet</h2>
          <p className="text-gray-600 mb-6">
            Create your first AI assistant instance to get started.
          </p>
          <Link
            href="/dashboard/instances/new"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Your First Instance →
          </Link>
        </div>
      </main>
    </div>
  );
}
