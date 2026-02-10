import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";
import { BalanceCard, InstanceCard } from "@/components";

async function getOrCreateUser(clerkUser: NonNullable<Awaited<ReturnType<typeof currentUser>>>) {
  let user = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
    include: { 
      balance: true,
      instances: {
        orderBy: { createdAt: "desc" },
        take: 6,
      },
    },
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
      include: { 
        balance: true,
        instances: {
          orderBy: { createdAt: "desc" },
          take: 6,
        },
      },
    });
  }

  return user;
}

async function getMonthlyUsage(userId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const usage = await prisma.usageLog.aggregate({
    where: {
      instance: { userId },
      timestamp: { gte: startOfMonth },
    },
    _sum: { costCents: true },
  });

  return usage._sum.costCents || 0;
}

export default async function DashboardPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const user = await getOrCreateUser(clerkUser);
  const creditsCents = user.balance?.creditsCents ?? 0;
  const totalInstances = user.instances.length;

  // Redirect to onboarding if user hasn't completed setup
  // (no subscription/balance AND no instances)
  if (creditsCents === 0 && totalInstances === 0) {
    redirect("/onboarding");
  }

  // Check if user is in BYOK mode (any instance using their own API key)
  const isByokUser = user.instances.some(i => i.useOwnApiKey);

  const belowMinimum = creditsCents < 1000;
  const monthlyUsageCents = await getMonthlyUsage(user.id);
  
  const activeInstances = user.instances.filter(i => i.status === "ACTIVE").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here&apos;s an overview of your BlitzClaw account.
        </p>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 ${isByokUser ? 'md:grid-cols-1 max-w-md' : 'md:grid-cols-3'} gap-6`}>
        {/* Balance - only for managed billing users */}
        {!isByokUser && (
          <BalanceCard creditsCents={creditsCents} belowMinimum={belowMinimum} />
        )}

        {/* Instances */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Active Instances</p>
              <p className="text-3xl font-bold text-foreground">
                {activeInstances}
                <span className="text-lg text-muted-foreground">/{totalInstances}</span>
              </p>
            </div>
            <div className="text-3xl">🤖</div>
          </div>
          <Link
            href="/dashboard/instances/new"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition"
          >
            Create Instance
          </Link>
        </div>

        {/* Monthly Usage - only for managed billing users */}
        {!isByokUser && (
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">This Month&apos;s Usage</p>
                <p className="text-3xl font-bold text-foreground">
                  ${(monthlyUsageCents / 100).toFixed(2)}
                </p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition"
            >
              View Details
            </Link>
          </div>
        )}
      </div>

      {/* Recent Instances */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent Instances</h2>
          {totalInstances > 0 && (
            <Link
              href="/dashboard/instances"
              className="text-sm text-primary hover:underline"
            >
              View All →
            </Link>
          )}
        </div>

        {totalInstances === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <div className="text-6xl mb-4">🤖</div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              No instances yet
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first AI assistant instance to get started. It only takes a minute!
            </p>
            <Link
              href="/dashboard/instances/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Instance
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {user.instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                id={instance.id}
                status={instance.status}
                channelType={instance.channelType}
                personaTemplate={instance.personaTemplate}
                ipAddress={instance.ipAddress}
                createdAt={instance.createdAt.toISOString()}
              />
            ))}
          </div>
        )}
      </div>

      {/* Quick Tips - only show for new users without instances */}
      {totalInstances === 0 && !isByokUser && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl mb-3">1️⃣</div>
            <h3 className="font-medium text-foreground mb-1">Subscribe</h3>
            <p className="text-sm text-muted-foreground">
              Choose a plan to get started with your AI assistant.
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl mb-3">2️⃣</div>
            <h3 className="font-medium text-foreground mb-1">Create Instance</h3>
            <p className="text-sm text-muted-foreground">
              Choose a persona template or create a custom AI assistant.
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="text-2xl mb-3">3️⃣</div>
            <h3 className="font-medium text-foreground mb-1">Connect Telegram</h3>
            <p className="text-sm text-muted-foreground">
              Link your Telegram bot and start chatting with your AI.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
