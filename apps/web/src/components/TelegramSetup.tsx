"use client";

import { useState } from "react";

interface TelegramSetupProps {
  instanceId: string;
  onSuccess?: (botInfo: { username: string; name: string; link: string }) => void;
}

export function TelegramSetup({ instanceId, onSuccess }: TelegramSetupProps) {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const handleConnect = async () => {
    if (!token.trim()) {
      setError("Please enter your bot token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/instances/${instanceId}/telegram/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: token }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to connect bot");
      }

      onSuccess?.(data.bot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span className="text-2xl">📱</span> Connect Telegram Bot
      </h3>

      {/* Steps */}
      <div className="space-y-4 mb-6">
        <div
          className={`p-4 rounded-lg border ${
            step >= 1 ? "border-primary/50 bg-primary/5" : "border-border"
          }`}
          onClick={() => setStep(1)}
        >
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 1 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}>
              1
            </div>
            <div>
              <p className="font-medium">Open BotFather in Telegram</p>
              <p className="text-sm text-muted-foreground mt-1">
                Search for <code className="bg-secondary px-1 py-0.5 rounded">@BotFather</code> or{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  click here to open
                </a>
              </p>
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border ${
            step >= 2 ? "border-primary/50 bg-primary/5" : "border-border"
          }`}
          onClick={() => setStep(2)}
        >
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 2 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}>
              2
            </div>
            <div>
              <p className="font-medium">Create a new bot</p>
              <p className="text-sm text-muted-foreground mt-1">
                Send <code className="bg-secondary px-1 py-0.5 rounded">/newbot</code> and follow the instructions.
                Choose a name and username for your bot.
              </p>
            </div>
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border ${
            step >= 3 ? "border-primary/50 bg-primary/5" : "border-border"
          }`}
          onClick={() => setStep(3)}
        >
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 3 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}>
              3
            </div>
            <div>
              <p className="font-medium">Copy the bot token</p>
              <p className="text-sm text-muted-foreground mt-1">
                BotFather will give you a token like{" "}
                <code className="bg-secondary px-1 py-0.5 rounded text-xs">123456:ABC-DEF...</code>
                <br />Copy and paste it below.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Token Input */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Bot Token</label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="123456789:ABCdefGHI..."
          className="w-full px-4 py-2.5 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-mono"
        />
        
        {error && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        )}
        
        <button
          onClick={handleConnect}
          disabled={loading || !token.trim()}
          className="w-full px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Connecting...
            </>
          ) : (
            "Connect Bot"
          )}
        </button>
      </div>
    </div>
  );
}
