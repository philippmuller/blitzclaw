"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * Top-up page
 * 
 * For BYOK users: Shows info that they pay Anthropic directly
 * For managed users: Shows top-up options with working checkout
 */
export default function TopupPage() {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{
    isByok: boolean;
    balance: number;
  } | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Fetch user info on mount
  useEffect(() => {
    async function fetchUserInfo() {
      try {
        const res = await fetch("/api/user/info");
        if (res.ok) {
          const data = await res.json();
          setUserInfo({
            isByok: data.billingMode === "byok",
            balance: data.balance?.creditsCents ?? 0,
          });
        }
      } catch (e) {
        console.error("Failed to fetch user info:", e);
      } finally {
        setPageLoading(false);
      }
    }
    fetchUserInfo();
  }, []);

  const handleTopup = async (amount: 25 | 50) => {
    setLoading(amount);
    setError(null);

    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  };

  if (pageLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-8">
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
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const isByok = userInfo?.isByok ?? false;
  const balance = userInfo?.balance ?? 0;

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

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Top-up Options */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Select Amount</h2>
        
        <div className="grid gap-4">
          {[
            { amount: 25 as const, popular: true },
            { amount: 50 as const, popular: false },
          ].map(({ amount, popular }) => (
            <button
              key={amount}
              onClick={() => handleTopup(amount)}
              disabled={loading !== null}
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
              {loading === amount ? (
                <span className="text-muted-foreground flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Redirecting...
                </span>
              ) : (
                <span className="text-primary font-medium">Top up →</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-secondary/30 border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground">
          <strong>How it works:</strong> Credits are used for AI API calls (Claude, GPT-4, etc.). 
          Your monthly subscription includes credits — top up when you need more.
          Credits never expire.
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
