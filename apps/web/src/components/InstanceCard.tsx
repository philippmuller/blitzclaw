"use client";

import Link from "next/link";
import { StatusBadge } from "./StatusBadge";

interface InstanceCardProps {
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

export function InstanceCard({
  id,
  status,
  channelType,
  personaTemplate,
  createdAt,
}: InstanceCardProps) {
  const channelIcon = channelIcons[channelType] || "🤖";
  const personaLabel = personaLabels[personaTemplate] || personaTemplate;
  const createdDate = new Date(createdAt).toLocaleDateString();

  return (
    <Link
      href={`/dashboard/instances/${id}`}
      className="block bg-card border border-border rounded-xl p-5 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 group"
    >
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
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Created {createdDate}</span>
        <span className="text-primary opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
          View Details
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
