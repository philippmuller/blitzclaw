"use client";

import { useState } from "react";

interface UpgradeButtonsProps {
  currentPlan: string | null; // "basic" | "pro" | null
  currentBillingMode: string | null; // "managed" | "byok"
}

const TIERS = [
  { id: "basic", name: "Basic", price: 19, credits: 5, description: "$5 credits included" },
  { id: "pro", name: "Pro", price: 39, credits: 15, description: "$15 credits included" },
];

export function UpgradeButtons({ currentPlan, currentBillingMode }: UpgradeButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPortal = async (actionLabel: string) => {
    setLoading(actionLabel);
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
        <h2 className="text-lg font-semibold text-foreground mb-1">Plan & Billing Options</h2>
        <p className="text-sm text-muted-foreground">
          Switch plans or billing mode anytime from the billing portal.
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

              <button
                onClick={() => openPortal(actionLabel)}
                disabled={loading !== null}
                className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {loading === actionLabel
                  ? "Opening portal..."
                  : isCurrent
                  ? "Manage in portal"
                  : `Switch to ${tier.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-4 border border-border rounded-xl bg-secondary/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-foreground">Billing Mode</p>
            <p className="text-sm text-muted-foreground">
              Current mode: <span className="capitalize">{currentBillingMode || "managed"}</span>
            </p>
          </div>
          <button
            onClick={() => openPortal("mode")}
            disabled={loading !== null}
            className="px-3 py-2 rounded-lg border border-border bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
          >
            {loading === "mode" ? "Opening portal..." : "Switch mode"}
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Note: plan and billing-mode changes are processed by Polar in the customer portal.
      </p>
    </div>
  );
}
