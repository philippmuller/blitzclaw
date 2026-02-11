"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

interface InstanceCardWithActionsProps {
  id: string;
  status: string;
  channelType: string;
  personaTemplate: string;
  ipAddress?: string | null;
  createdAt: string;
}

const channelIcons: Record<string, string> = {
  TELEGRAM: "📱",
  WHATSAPP: "💬",
};

const personaLabels: Record<string, string> = {
  assistant: "Personal Assistant",
  developer: "Dev Assistant",
  creative: "Creative Partner",
  custom: "Custom",
};

export function InstanceCardWithActions({
  id,
  status,
  channelType,
  personaTemplate,
  ipAddress,
  createdAt,
}: InstanceCardWithActionsProps) {
  const [restarting, setRestarting] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const channelIcon = channelIcons[channelType] || "🤖";
  const personaLabel = personaLabels[personaTemplate] || personaTemplate;
  const createdDate = new Date(createdAt).toLocaleDateString();
  const isActive = status === "ACTIVE";
  const canRunActions = isActive && ipAddress;

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRestart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!canRunActions || restarting) return;

    setRestarting(true);
    try {
      const res = await fetch(`/api/instances/${id}/restart`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.details || "Failed to restart");
      }

      showToast("success", data.message || "Instance restarted successfully");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to restart");
    } finally {
      setRestarting(false);
    }
  };

  const handleRepair = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!canRunActions || repairing) return;

    setRepairing(true);
    try {
      const res = await fetch(`/api/instances/${id}/repair`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.details || "Failed to repair");
      }

      showToast("success", data.message || "Repair completed successfully");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to repair");
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="relative bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 group">
      {/* Toast notification */}
      {toast && (
        <div
          className={`absolute top-2 left-2 right-2 px-3 py-2 rounded-lg text-sm font-medium z-10 ${
            toast.type === "success"
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-red-500/20 text-red-400 border border-red-500/30"
          }`}
        >
          {toast.message}
        </div>
      )}

      <Link href={`/dashboard/instances/${id}`} className="block">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center text-xl">
              {channelIcon}
            </div>
            <div>
              <p className="font-medium text-foreground group-hover:text-primary transition">
                {personaLabel}
              </p>
              <p className="text-sm text-muted-foreground">
                {channelType.charAt(0) + channelType.slice(1).toLowerCase()}
              </p>
            </div>
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span>Created {createdDate}</span>
          <span className="text-primary opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
            View Details
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>

      {/* Action buttons */}
      <div className="flex gap-2 pt-3 border-t border-border">
        <button
          onClick={handleRestart}
          disabled={!canRunActions || restarting}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-secondary transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          title={!canRunActions ? "Instance must be active" : "Restart OpenClaw service"}
        >
          {restarting ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Restarting...</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Restart</span>
            </>
          )}
        </button>
        <button
          onClick={handleRepair}
          disabled={!canRunActions || repairing}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-secondary transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          title={!canRunActions ? "Instance must be active" : "Run openclaw doctor --fix"}
        >
          {repairing ? (
            <>
              <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Repairing...</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Repair</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
