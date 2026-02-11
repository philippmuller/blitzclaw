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
  const [success, setSuccess] = useState<string | null>(null);

  // Skip plan switching for now - users can download data and recreate
  const canChangePlan = false;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Your Plan</h2>
      
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

      <div className="grid md:grid-cols-2 gap-4">
        {TIERS.map((tier) => {
          const isCurrent = currentPlan === tier.id;
          
          return (
            <div
              key={tier.id}
              className={`p-4 border rounded-xl ${
                isCurrent 
                  ? "border-primary bg-primary/5" 
                  : "border-border"
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
            </div>
          );
        })}
      </div>
      
      <p className="text-xs text-muted-foreground mt-4">
        To change plans, download your instance data and create a new subscription.
      </p>
    </div>
  );
}
