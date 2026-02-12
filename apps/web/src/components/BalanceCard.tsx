"use client";

interface BalanceCardProps {
  creditsCents: number;
  belowMinimum?: boolean; // Kept for compatibility but not used
  compact?: boolean;
}

export function BalanceCard({ creditsCents, compact = false }: BalanceCardProps) {
  // Positive = credits remaining, Negative = usage beyond credits
  const hasCredits = creditsCents > 0;
  const displayAmount = Math.abs(creditsCents / 100).toFixed(2);
  
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Intelligence Cost:</span>
          {hasCredits ? (
            <span className="font-semibold text-green-500">-${displayAmount}</span>
          ) : (
            <span className="font-semibold text-foreground">${displayAmount}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Intelligence Cost</p>
          {hasCredits ? (
            <p className="text-3xl font-bold text-green-500">-${displayAmount}</p>
          ) : (
            <p className="text-3xl font-bold text-foreground">${displayAmount}</p>
          )}
        </div>
        <div className="text-3xl">🧠</div>
      </div>
      
      <p className="text-sm text-muted-foreground">
        {hasCredits 
          ? `$${displayAmount} in included credits remaining`
          : `$${displayAmount} billed this cycle (beyond included credits)`
        }
      </p>
    </div>
  );
}
