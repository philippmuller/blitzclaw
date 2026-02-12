"use client";

import Link from "next/link";

interface BalanceCardProps {
  creditsCents: number;
  belowMinimum: boolean;
  compact?: boolean;
}

export function BalanceCard({ creditsCents, belowMinimum, compact = false }: BalanceCardProps) {
  const dollars = (creditsCents / 100).toFixed(2);
  const percentage = Math.min(100, (creditsCents / 5000) * 100); // $50 as full bar
  
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Balance:</span>
          <span className={`font-semibold ${belowMinimum ? "text-red-400" : "text-foreground"}`}>
            ${dollars}
          </span>
        </div>
        {belowMinimum && (
          <Link
            href="/dashboard/billing/topup"
            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Top Up
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
          <p className={`text-3xl font-bold ${belowMinimum ? "text-red-400" : "text-foreground"}`}>
            ${dollars}
          </p>
        </div>
        <div className="text-3xl">💰</div>
      </div>
      
      {/* Balance bar */}
      <div className="w-full h-2 bg-secondary rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            belowMinimum ? "bg-red-500" : "bg-green-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {belowMinimum && (
        <p className="text-sm text-amber-400 mb-4 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Included credits used — additional usage will be billed
        </p>
      )}
      
      <Link
        href="/dashboard/billing/topup"
        className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
      >
        Top Up Balance
      </Link>
    </div>
  );
}
