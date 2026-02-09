"use client";

import { useState } from "react";

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open portal");
      }

      // Redirect to Paddle customer portal
      window.location.href = data.portalUrl;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="px-4 py-2.5 bg-secondary text-foreground font-medium rounded-lg hover:bg-secondary/80 transition disabled:opacity-50"
      >
        {loading ? "Loading..." : "Manage Subscription"}
      </button>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
