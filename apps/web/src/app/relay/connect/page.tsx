"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type ConnectState = "idle" | "connecting" | "connected" | "error";

type ConnectResult = {
  success?: boolean;
  error?: string;
};

function RelayConnectContent() {
  const searchParams = useSearchParams();
  const [token] = useState(() => searchParams.get("token") ?? "");
  const [instanceId] = useState(() => searchParams.get("instance") ?? "");

  const [extensionDetected, setExtensionDetected] = useState(false);
  const [connectState, setConnectState] = useState<ConnectState>("idle");
  const [message, setMessage] = useState("");

  const isValid = useMemo(() => {
    return token.startsWith("brc_") && instanceId.length > 0;
  }, [instanceId, token]);

  useEffect(() => {
    if (!token) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
  }, [token]);

  useEffect(() => {
    let checkTimer: number | null = null;
    let attempts = 0;

    const markDetected = () => {
      setExtensionDetected(true);
    };

    const handleResult = (event: Event) => {
      const customEvent = event as CustomEvent<ConnectResult>;
      if (customEvent.detail?.success) {
        setConnectState("connected");
        setMessage("Browser relay connected. You can return to your agent.");
      } else {
        setConnectState("error");
        setMessage(customEvent.detail?.error || "Connection failed");
      }
    };

    window.addEventListener("blitzclaw-relay-extension-ready", markDetected);
    window.addEventListener("blitzclaw-relay-extension-pong", markDetected);
    window.addEventListener("blitzclaw-relay-connect-result", handleResult);

    // Probe for extension availability for a few seconds.
    checkTimer = window.setInterval(() => {
      attempts += 1;
      window.dispatchEvent(new CustomEvent("blitzclaw-relay-extension-ping"));
      if (attempts >= 8) {
        if (checkTimer) {
          window.clearInterval(checkTimer);
        }
      }
    }, 500);

    return () => {
      window.removeEventListener("blitzclaw-relay-extension-ready", markDetected);
      window.removeEventListener("blitzclaw-relay-extension-pong", markDetected);
      window.removeEventListener("blitzclaw-relay-connect-result", handleResult);
      if (checkTimer) {
        window.clearInterval(checkTimer);
      }
    };
  }, []);

  const handleAllow = () => {
    setConnectState("connecting");
    setMessage("");
    window.dispatchEvent(
      new CustomEvent("blitzclaw-relay-connect-request", {
        detail: { token, instanceId },
      })
    );
  };

  return (
    <section className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 shadow-2xl">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 mb-3">
        BlitzClaw Browser Relay
      </p>
      <h1 className="text-2xl font-semibold mb-2">Allow browser control?</h1>
      <p className="text-sm text-neutral-300 mb-6">
        This grants your active BlitzClaw instance access to Chrome DevTools commands in this browser.
        You can disconnect any time from the extension popup.
      </p>

      {!isValid && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200 mb-6">
          Invalid or expired connect link. Generate a new link from your instance dashboard.
        </div>
      )}

      {isValid && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm mb-6 space-y-2">
          <p>
            <span className="text-neutral-400">Instance:</span> {instanceId}
          </p>
          <p>
            <span className="text-neutral-400">Extension:</span>{" "}
            {extensionDetected ? "Detected" : "Not detected yet"}
          </p>
        </div>
      )}

      {message && (
        <div
          className={`rounded-lg p-3 text-sm mb-4 ${
            connectState === "connected"
              ? "border border-emerald-500/40 bg-emerald-950/30 text-emerald-200"
              : "border border-red-500/40 bg-red-950/30 text-red-200"
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          disabled={!isValid || connectState === "connecting"}
          onClick={handleAllow}
          className="px-5 py-2.5 rounded-lg bg-emerald-500 text-emerald-950 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-400 transition"
        >
          {connectState === "connecting" ? "Connecting..." : "Allow and Connect"}
        </button>
        <Link
          href="/dashboard/instances"
          className="px-5 py-2.5 rounded-lg border border-neutral-700 text-neutral-200 text-center hover:bg-neutral-800 transition"
        >
          Cancel
        </Link>
      </div>

      {!extensionDetected && isValid && (
        <p className="text-xs text-neutral-400 mt-4">
          If this stays unavailable, install/open the BlitzClaw Browser Relay extension and reload this page.
        </p>
      )}
    </section>
  );
}

function LoadingFallback() {
  return (
    <section className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 shadow-2xl">
      <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 mb-3">
        BlitzClaw Browser Relay
      </p>
      <h1 className="text-2xl font-semibold mb-2">Loading...</h1>
      <div className="animate-pulse h-4 bg-neutral-800 rounded w-3/4 mb-4"></div>
      <div className="animate-pulse h-4 bg-neutral-800 rounded w-1/2"></div>
    </section>
  );
}

export default function RelayConnectPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6 py-12">
      <Suspense fallback={<LoadingFallback />}>
        <RelayConnectContent />
      </Suspense>
    </main>
  );
}
