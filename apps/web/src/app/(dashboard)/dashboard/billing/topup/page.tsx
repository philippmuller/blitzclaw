"use client";

import { useState } from "react";
import Link from "next/link";

const amounts = [
  { cents: 1000, label: "$10" },
  { cents: 2000, label: "$20" },
  { cents: 5000, label: "$50" },
  { cents: 10000, label: "$100" },
];

export default function TopupPage() {
  const [selectedAmount, setSelectedAmount] = useState(2000);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAmount = () => {
    if (useCustom && customAmount) {
      const parsed = parseFloat(customAmount);
      if (!isNaN(parsed) && parsed >= 10) {
        return Math.round(parsed * 100);
      }
    }
    return selectedAmount;
  };

  const handleTopup = async () => {
    const amountCents = getAmount();
    
    if (amountCents < 1000) {
      setError("Minimum top-up amount is $10");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: amountCents }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout");
      }

      // Redirect to Creem checkout
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create checkout");
      setLoading(false);
    }
  };

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

      {/* Amount Selection */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Select Amount</h2>
          
          <div className="grid grid-cols-2 gap-3">
            {amounts.map((amount) => (
              <button
                key={amount.cents}
                onClick={() => {
                  setSelectedAmount(amount.cents);
                  setUseCustom(false);
                }}
                className={`p-4 rounded-xl border text-center transition-all ${
                  !useCustom && selectedAmount === amount.cents
                    ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                <span className="text-2xl font-bold text-foreground">{amount.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div>
          <button
            onClick={() => setUseCustom(true)}
            className={`w-full p-4 rounded-xl border text-left transition-all ${
              useCustom
                ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">Custom Amount</span>
              {useCustom && (
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>
          
          {useCustom && (
            <div className="mt-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="number"
                  min="10"
                  step="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount (min $10)"
                  className="w-full pl-8 pr-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="p-4 bg-secondary/50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Amount to add</span>
            <span className="text-2xl font-bold text-foreground">
              ${(getAmount() / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Checkout Button */}
        <button
          onClick={handleTopup}
          disabled={loading || getAmount() < 1000}
          className="w-full px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating checkout...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Continue to Payment
            </>
          )}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Secure payment via Creem. All major cards accepted.
        </p>
      </div>

      {/* Info */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-foreground">How billing works</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span>
            Pay-as-you-go: Only pay for what you use
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span>
            $10 minimum balance required for active instances
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span>
            No subscriptions or hidden fees
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">✓</span>
            Credits never expire
          </li>
        </ul>
      </div>
    </div>
  );
}
