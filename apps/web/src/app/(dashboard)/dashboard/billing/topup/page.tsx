import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@blitzclaw/db";

/**
 * Top-up page
 * 
 * For BYOK users: Shows info that they pay Anthropic directly
 * For managed users: Shows top-up options (coming soon: actual checkout)
 */
export default async function TopupPage() {
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUser.id },
    include: { balance: true },
  });

  if (!user) redirect("/onboarding");

  const isByok = user.billingMode === "byok";
  const balance = user.balance?.creditsCents ?? 0;

  if (isByok) {
    return (
      <div className="max-w-xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/billing"
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Top Up Balance</h1>
            <p className="text-muted-foreground">Add credits to your account</p>
          </div>
        </div>

        {/* BYOK Info */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">BYOK Plan - No Top-ups Needed</h2>
              <p className="text-muted-foreground mt-1">
                You&apos;re on the Bring Your Own Key (BYOK) plan. You pay Anthropic directly for API usage 
                through your own API key.
              </p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground">How BYOK billing works</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span><strong>€14/month flat fee</strong> for BlitzClaw access</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>You provide your own Anthropic API key</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Pay Anthropic directly at their rates (no markup)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400 mt-0.5">✓</span>
              <span>Full control over your API usage and billing</span>
            </li>
          </ul>
        </div>

        {/* Link to Anthropic */}
        <div className="bg-secondary/30 border border-border rounded-xl p-6">
          <p className="text-sm text-muted-foreground mb-3">
            To add credits for API usage, visit your Anthropic dashboard:
          </p>
          <a
            href="https://console.anthropic.com/settings/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Anthropic Billing
          </a>
        </div>
      </div>
    );
  }

  // Managed billing - show top-up options
  return (
    <div className="max-w-xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/billing"
          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Top Up Balance</h1>
          <p className="text-muted-foreground">Add credits to your account</p>
        </div>
      </div>

      {/* Current Balance */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
        <p className="text-3xl font-bold text-foreground">
          €{(balance / 100).toFixed(2)}
        </p>
      </div>

      {/* Top-up Options */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Select Amount</h2>
        
        <div className="grid gap-4">
          {[
            { amount: 10, popular: false },
            { amount: 25, popular: true },
            { amount: 50, popular: false },
            { amount: 100, popular: false },
          ].map(({ amount, popular }) => (
            <button
              key={amount}
              disabled
              className="relative flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:border-primary/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-foreground">€{amount}</span>
                {popular && (
                  <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs font-medium rounded">
                    Popular
                  </span>
                )}
              </div>
              <span className="text-muted-foreground">Coming Soon</span>
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-secondary/30 border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground">
          <strong>How it works:</strong> Credits are used for AI API calls. 
          Your monthly subscription includes €{user.billingMode === "managed" ? "10-110" : "0"} in credits 
          depending on your plan. Top-up when you need more.
        </p>
      </div>

      {/* Manage subscription link */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">
          Want to upgrade your plan for more included credits?
        </p>
        <Link
          href="/dashboard/billing"
          className="text-primary hover:underline text-sm"
        >
          Manage Subscription →
        </Link>
      </div>
    </div>
  );
}
