"use client";

import { useState } from "react";

interface BrowserRelayCardProps {
  instanceId: string;
}

export function BrowserRelayCard({ instanceId }: BrowserRelayCardProps) {
  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/browser-relay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceId }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate token");
      }

      setToken(data.token);
      setWsUrl(
        data.wsUrl || `wss://blitzclaw-relay.philippmuller.partykit.dev/parties/main/${instanceId}`
      );
      setConnectUrl(data.connectUrl || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate token");
    } finally {
      setLoading(false);
    }
  };

  const displayWsUrl =
    wsUrl || `wss://blitzclaw-relay.philippmuller.partykit.dev/parties/main/${instanceId}`;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">🌐</span>
            Connect Browser
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Generate an auth link to connect your local browser to this instance.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full px-4 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Generating..." : token ? "Regenerate Link" : "Connect Browser"}
          </button>

          {connectUrl && (
            <a
              href={connectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-4 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition text-center"
            >
              Open Auth Link
            </a>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </p>
        )}
      </div>

      {token && (
        <div className="mt-5 rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
          {connectUrl && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Connect URL
              </p>
              <code className="block text-sm font-mono bg-secondary px-2.5 py-2 rounded-md break-all">
                {connectUrl}
              </code>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Relay Token
            </p>
            <code className="block text-sm font-mono bg-secondary px-2.5 py-2 rounded-md break-all">
              {token}
            </code>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              WebSocket URL
            </p>
            <code className="block text-sm font-mono bg-secondary px-2.5 py-2 rounded-md break-all">
              {displayWsUrl}
            </code>
          </div>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-border p-4">
        <p className="text-sm font-medium mb-2">Connection instructions</p>
        <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
          <li>Click "Connect Browser" to generate a secure auth link.</li>
          <li>Open the link in the same browser where the extension is installed.</li>
          <li>Confirm "Allow and Connect" on the relay page.</li>
          <li>Keep your browser open while the agent uses authenticated sessions.</li>
        </ol>
      </div>
    </div>
  );
}
