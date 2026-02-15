"use client";

import { useState } from "react";

interface UpgradeButtonsProps {
  currentPlan: string | null; // "basic" | "pro" | null
  currentBillingMode: string | null; // "managed" | "byok"
  hasSubscription: boolean;
}

const TIERS = [
  { id: "basic", name: "Basic", price: 19, credits: 5, description: "$5 credits included monthly" },
  { id: "pro", name: "Pro", price: 39, credits: 20, description: "$20 credits included monthly" },
];

export function UpgradeButtons({ currentPlan, currentBillingMode, hasSubscription }: UpgradeButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (plan: string) => {
    setLoading(`plan-${plan}`);
    setError(null);

    try {
      const res = await fetch("/api/polar/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, byokMode: false }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      throw new Error("Checkout URL not available");
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  };

  const openPortal = async () => {
    setLoading("portal");
    setError(null);

    try {
      const res = await fetch("/api/billing/upgrade", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.portalUrl) {
        window.location.href = data.portalUrl;
        return;
      }

      throw new Error("Billing portal URL not available");
    } catch (e) {
      setError((e as Error).message);
      setLoading(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {hasSubscription ? "Plan & Billing" : "Subscribe"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasSubscription
            ? "Manage your subscription or switch plans."
            : "Subscribe to add monthly credits and keep your assistant running."}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {TIERS.map((tier) => {
          const isCurrent = currentPlan === tier.id;
          const actionLabel = `plan-${tier.id}`;

          return (
            <div
              key={tier.id}
              className={`p-4 border rounded-xl ${
                isCurrent ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-foreground">{tier.name}</h3>
                {isCurrent && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                    Current
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground mb-1">${tier.price}/mo</p>
              <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>

              {hasSubscription ? (
                <button
                  onClick={openPortal}
                  disabled={loading !== null}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {loading === "portal"
                    ? "Opening portal..."
                    : isCurrent
                    ? "Manage subscription"
                    : `Switch to ${tier.name}`}
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={loading !== null}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                    tier.id === "pro"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {loading === actionLabel ? "Creating checkout..." : `Subscribe to ${tier.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {hasSubscription && (
        <p className="text-xs text-muted-foreground">
          Subscription changes are managed through the Polar billing portal.
        </p>
      )}
    </div>
  );
}
