"use client";

type InstanceStatus = "PENDING" | "PROVISIONING" | "ACTIVE" | "PAUSED" | "STOPPED" | "ERROR";

interface StatusBadgeProps {
  status: InstanceStatus | string;
  size?: "sm" | "md";
}

const statusConfig: Record<InstanceStatus, { label: string; className: string }> = {
  PENDING: {
    label: "Pending",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  },
  PROVISIONING: {
    label: "Provisioning",
    className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  PAUSED: {
    label: "Paused",
    className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  },
  STOPPED: {
    label: "Stopped",
    className: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  },
  ERROR: {
    label: "Error",
    className: "bg-red-500/20 text-red-400 border-red-500/30",
  },
};

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status as InstanceStatus] || statusConfig.PENDING;
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.className} ${sizeClass}`}
    >
      <span className="relative flex h-2 w-2">
        {(status === "ACTIVE" || status === "PROVISIONING") && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
              status === "ACTIVE" ? "bg-green-400" : "bg-blue-400"
            }`}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            status === "ACTIVE"
              ? "bg-green-400"
              : status === "PROVISIONING"
              ? "bg-blue-400"
              : status === "PAUSED"
              ? "bg-orange-400"
              : status === "ERROR"
              ? "bg-red-400"
              : "bg-gray-400"
          }`}
        />
      </span>
      {config.label}
    </span>
  );
}
