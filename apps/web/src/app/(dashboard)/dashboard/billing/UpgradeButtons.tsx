"use client";

import { useState } from "react";

interface UpgradeButtonsProps {
  currentBillingMode: string | null;
}

const TIERS = [
  { id: "byok", name: "BYOK", price: 14, credits: 0, description: "Bring your own API key" },
  { id: "basic", name: "Basic", price: 19, credits: 10, description: "€10 credits included" },
  { id: "pro", name: "Pro", price: 119, credits: 110, description: "€110 credits included" },
];

export function UpgradeButtons({ currentBillingMode }: UpgradeButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Determine current tier from billing mode
  const getCurrentTier = () => {
    if (currentBillingMode === "byok") return "byok";
    // For managed mode, we'd need to check subscription details to know if basic or pro
    // For now, default to showing all upgrade options
    return "managed";
  };

  const handleUpgrade = async (newTier: string) => {
    setLoading(newTier);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: newTier }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change plan");
      }

      setSuccess(`Successfully changed to ${data.newTier} plan!`);
      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const currentTier = getCurrentTier();

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Change Plan</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {TIERS.map((tier) => {
          const isCurrent = currentBillingMode === tier.id || 
            (currentBillingMode === "managed" && tier.id !== "byok");
          
          return (
            <div
              key={tier.id}
              className={`p-4 border rounded-xl ${
                isCurrent 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
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
              <p className="text-2xl font-bold text-foreground mb-1">€{tier.price}/mo</p>
              <p className="text-sm text-muted-foreground mb-4">{tier.description}</p>
              
              {!isCurrent && (
                <button
                  onClick={() => handleUpgrade(tier.id)}
                  disabled={loading !== null}
                  className="w-full px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-lg hover:bg-secondary/80 transition disabled:opacity-50"
                >
                  {loading === tier.id ? "Changing..." : `Switch to ${tier.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground mt-4">
        Plan changes take effect immediately. Credits are adjusted on your next billing cycle.
      </p>
    </div>
  );
}
