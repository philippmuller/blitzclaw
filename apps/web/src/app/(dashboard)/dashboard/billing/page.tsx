import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";
import { BalanceCard } from "@/components";
import { ManageSubscriptionButton } from "./ManageSubscriptionButton";
import { UpgradeButtons } from "./UpgradeButtons";

async function getUserWithUsage(clerkId: string) {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      balance: true,
      instances: {
        include: {
          usageLogs: {
            orderBy: { timestamp: "desc" },
            take: 100,
          },
        },
      },
    },
  });

  return user;
}

export default async function BillingPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const user = await getUserWithUsage(clerkUser.id);
  if (!user) return null;

  const creditsCents = user.balance?.creditsCents ?? 0;
  const belowMinimum = creditsCents < 1000;

  // Calculate usage stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const allLogs = user.instances.flatMap((i) => i.usageLogs);
  const monthlyLogs = allLogs.filter((log) => log.timestamp >= startOfMonth);
  
  const monthlyUsage = monthlyLogs.reduce(
    (acc, log) => ({
      costCents: acc.costCents + log.costCents,
      tokensIn: acc.tokensIn + log.tokensIn,
      tokensOut: acc.tokensOut + log.tokensOut,
    }),
    { costCents: 0, tokensIn: 0, tokensOut: 0 }
  );

  // Group by model
  const usageByModel: Record<string, { costCents: number; tokensIn: number; tokensOut: number }> = {};
  for (const log of monthlyLogs) {
    if (!usageByModel[log.model]) {
      usageByModel[log.model] = { costCents: 0, tokensIn: 0, tokensOut: 0 };
    }
    usageByModel[log.model].costCents += log.costCents;
    usageByModel[log.model].tokensIn += log.tokensIn;
    usageByModel[log.model].tokensOut += log.tokensOut;
  }

  // Recent transactions (last 10 logs)
  const recentLogs = allLogs.slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing</h1>
          <p className="text-muted-foreground mt-1">
            Manage your balance and view usage history.
          </p>
        </div>
        <div className="flex gap-3">
          <ManageSubscriptionButton />
          <Link
            href="/dashboard/billing/topup"
            className="px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
          >
            Top Up Balance
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance */}
        <BalanceCard creditsCents={creditsCents} belowMinimum={belowMinimum} />

        {/* Monthly Usage */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">This Month</p>
              <p className="text-3xl font-bold text-foreground">
                ${(monthlyUsage.costCents / 100).toFixed(2)}
              </p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {monthlyUsage.tokensIn.toLocaleString()} tokens in
            </p>
            <p>
              {monthlyUsage.tokensOut.toLocaleString()} tokens out
            </p>
          </div>
        </div>

        {/* Subscription Info */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your Plan</p>
              <p className="text-xl font-semibold text-foreground capitalize">
                {user.plan || "No Plan"}
              </p>
            </div>
            <div className="text-3xl">📋</div>
          </div>
          <p className="text-sm text-muted-foreground">
            {user.plan === "basic" && "$5 credits included monthly"}
            {user.plan === "pro" && "$15 credits included monthly"}
            {!user.plan && "Subscribe to a plan to get started"}
          </p>
        </div>
      </div>

      {/* Upgrade/Downgrade Options */}
      <UpgradeButtons currentPlan={user.plan} currentBillingMode={user.billingMode} />

      {/* Usage by Model */}
      {Object.keys(usageByModel).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Usage by Model</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Model</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Tokens In</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Tokens Out</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(usageByModel).map(([model, data]) => (
                  <tr key={model}>
                    <td className="px-4 py-3 font-medium text-foreground">{model}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {data.tokensIn.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {data.tokensOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground font-medium">
                      ${(data.costCents / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
        {recentLogs.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No usage activity yet.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-secondary/50">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Time</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Model</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Tokens</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{log.model}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {log.tokensIn.toLocaleString()} / {log.tokensOut.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground font-medium">
                      ${(log.costCents / 100).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
