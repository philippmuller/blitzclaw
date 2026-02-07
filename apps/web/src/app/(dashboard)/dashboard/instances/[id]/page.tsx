"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge, TelegramSetup, SoulEditor } from "@/components";

interface Instance {
  id: string;
  status: string;
  channelType: string;
  personaTemplate: string;
  soulMd: string | null;
  ipAddress: string | null;
  hetznerServerId: string | null;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck: string | null;
  channelConfig: {
    bot_id?: string;
    bot_username?: string;
    bot_name?: string;
    connected_at?: string;
  } | null;
  recentUsage: {
    totalCostCents: number;
    totalCostDollars: string;
    totalTokensIn: number;
    totalTokensOut: number;
    logCount: number;
  };
}

export default function InstanceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const instanceId = params.id as string;

  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);

  const fetchInstance = async () => {
    try {
      const res = await fetch(`/api/instances/${instanceId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch instance");
      }

      setInstance(data);
      setTelegramConnected(!!data.channelConfig?.bot_username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch instance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstance();
    // Poll for updates every 10s if provisioning
    const interval = setInterval(() => {
      if (instance?.status === "PROVISIONING" || instance?.status === "PENDING") {
        fetchInstance();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [instanceId, instance?.status]);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const res = await fetch(`/api/instances/${instanceId}/restart`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restart");
      }

      await fetchInstance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart");
    } finally {
      setRestarting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/instances/${instanceId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      router.push("/dashboard/instances");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleTelegramSuccess = (botInfo: { username: string; name: string; link: string }) => {
    setTelegramConnected(true);
    if (instance) {
      setInstance({
        ...instance,
        channelConfig: {
          ...instance.channelConfig,
          bot_username: botInfo.username,
          bot_name: botInfo.name,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center">
        <div className="text-4xl mb-4">❌</div>
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {error || "Instance not found"}
        </h3>
        <Link
          href="/dashboard/instances"
          className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Back to Instances
        </Link>
      </div>
    );
  }

  const personaLabels: Record<string, string> = {
    assistant: "Personal Assistant",
    developer: "Dev Assistant",
    creative: "Creative Partner",
    custom: "Custom",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/instances"
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {personaLabels[instance.personaTemplate] || instance.personaTemplate}
              </h1>
              <StatusBadge status={instance.status} />
            </div>
            <p className="text-muted-foreground mt-1">
              {instance.channelType.charAt(0) + instance.channelType.slice(1).toLowerCase()} • 
              Created {new Date(instance.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRestart}
            disabled={restarting || instance.status !== "ACTIVE"}
            className="px-4 py-2 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition disabled:opacity-50 flex items-center gap-2"
          >
            {restarting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Restarting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Restart
              </>
            )}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 font-medium rounded-lg hover:bg-red-500/20 transition"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground mb-1">Status</p>
          <StatusBadge status={instance.status} />
          {instance.lastHealthCheck && (
            <p className="text-xs text-muted-foreground mt-2">
              Last check: {new Date(instance.lastHealthCheck).toLocaleString()}
            </p>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground mb-1">IP Address</p>
          <p className="font-mono text-foreground">
            {instance.ipAddress || "Assigning..."}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-sm text-muted-foreground mb-1">Usage (24h)</p>
          <p className="text-xl font-bold text-foreground">
            ${instance.recentUsage.totalCostDollars}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {instance.recentUsage.totalTokensIn.toLocaleString()} in / {instance.recentUsage.totalTokensOut.toLocaleString()} out
          </p>
        </div>
      </div>

      {/* Telegram Setup or Connection Info */}
      {instance.channelType === "TELEGRAM" && (
        <>
          {telegramConnected && instance.channelConfig?.bot_username ? (
            <div className="bg-card border border-green-500/30 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center text-2xl">
                    ✅
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Telegram Connected</h3>
                    <p className="text-muted-foreground">
                      @{instance.channelConfig.bot_username}
                    </p>
                  </div>
                </div>
                <a
                  href={`https://t.me/${instance.channelConfig.bot_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition"
                >
                  Open in Telegram →
                </a>
              </div>
            </div>
          ) : (
            <TelegramSetup instanceId={instanceId} onSuccess={handleTelegramSuccess} />
          )}
        </>
      )}

      {/* SOUL.md Editor */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">SOUL.md</h2>
        <SoulEditor
          instanceId={instanceId}
          initialValue={instance.soulMd || ""}
          showSaveButton={true}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Delete Instance?</h3>
              <p className="text-muted-foreground mb-6">
                This will permanently delete this instance and all its data. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 border border-border text-foreground font-medium rounded-lg hover:bg-secondary transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    "Delete Instance"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
