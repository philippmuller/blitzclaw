import { getApiUrl, getToken } from "./config.js";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const apiUrl = getApiUrl();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: "Request failed" })) as { error?: string; message?: string };
    throw new ApiError(response.status, errorBody.error || errorBody.message || "Request failed");
  }
  
  return response.json() as Promise<T>;
}

export async function getMe() {
  return apiRequest<{
    id: string;
    email: string;
    createdAt: string;
    balance: {
      creditsCents: number;
      autoTopupEnabled: boolean;
    };
    instanceCount: number;
  }>("/auth/me");
}

export async function getBalance() {
  return apiRequest<{
    creditsCents: number;
    creditsDollars: string;
    belowMinimum: boolean;
    minimumCents: number;
    autoTopupEnabled: boolean;
  }>("/billing/balance");
}

export async function createTopup(amountCents: number) {
  return apiRequest<{
    checkoutUrl: string;
    checkoutId: string;
  }>("/billing/topup", {
    method: "POST",
    body: JSON.stringify({ amount_cents: amountCents }),
  });
}

export async function getUsage(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  
  const query = params.toString() ? `?${params.toString()}` : "";
  
  return apiRequest<{
    from: string;
    to: string;
    totalCostCents: number;
    totalCostDollars: string;
    totalTokensIn: number;
    totalTokensOut: number;
    byModel: Array<{
      model: string;
      tokensIn: number;
      tokensOut: number;
      costCents: number;
      costDollars: string;
    }>;
    instances: Array<{
      id: string;
      channelType: string;
      status: string;
      usageCount: number;
      costCents: number;
    }>;
  }>(`/billing/usage${query}`);
}

// Instance API

export interface Instance {
  id: string;
  status: string;
  channelType: string;
  personaTemplate: string;
  ipAddress: string | null;
  hetznerServerId: string | null;
  soulMd: string | null;
  createdAt: string;
  updatedAt: string;
  lastHealthCheck: string | null;
  channelConfig: Record<string, unknown> | null;
  recentUsage: {
    totalCostCents: number;
    totalCostDollars: string;
    totalTokensIn: number;
    totalTokensOut: number;
    logCount: number;
  };
}

export async function listInstances() {
  return apiRequest<{
    instances: Array<{
      id: string;
      status: string;
      channelType: string;
      personaTemplate: string;
      ipAddress: string | null;
      createdAt: string;
      lastHealthCheck: string | null;
    }>;
  }>("/instances");
}

export async function createInstance(options: {
  channelType: string;
  personaTemplate: string;
  soulMd?: string;
}) {
  return apiRequest<{
    id: string;
    status: string;
    ipAddress: string | null;
    message: string;
  }>("/instances", {
    method: "POST",
    body: JSON.stringify({
      channel_type: options.channelType,
      persona_template: options.personaTemplate,
      soul_md: options.soulMd,
    }),
  });
}

export async function getInstance(id: string) {
  return apiRequest<Instance>(`/instances/${id}`);
}

export async function deleteInstance(id: string) {
  return apiRequest<{ success: boolean; message: string }>(`/instances/${id}`, {
    method: "DELETE",
  });
}

export async function restartInstance(id: string) {
  return apiRequest<{ success: boolean; message: string }>(
    `/instances/${id}/restart`,
    { method: "POST" }
  );
}

// Telegram API

export interface TelegramBotInfo {
  id: string;
  username: string;
  name: string;
  link: string;
}

export async function validateTelegramToken(token: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    bot: TelegramBotInfo;
  }>("/telegram/validate", {
    method: "POST",
    body: JSON.stringify({ bot_token: token }),
  });
}

export async function connectTelegram(instanceId: string, token: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    bot: TelegramBotInfo;
  }>(`/instances/${instanceId}/telegram/connect`, {
    method: "POST",
    body: JSON.stringify({ bot_token: token }),
  });
}

export async function getTelegramInfo(instanceId: string) {
  return apiRequest<{
    connected: boolean;
    bot: TelegramBotInfo;
    instance_status: string;
  }>(`/instances/${instanceId}/telegram/info`);
}

// Soul API

export async function getSoul(instanceId: string) {
  return apiRequest<{
    soul_md: string;
    persona_template: string;
    has_custom_soul: boolean;
    instance_status: string;
  }>(`/instances/${instanceId}/soul`);
}

export async function updateSoul(instanceId: string, soulMd: string) {
  return apiRequest<{
    success: boolean;
    message: string;
    soul_md_length: number;
    deployment: {
      success: boolean;
      message: string;
    };
  }>(`/instances/${instanceId}/soul`, {
    method: "POST",
    body: JSON.stringify({ soul_md: soulMd }),
  });
}

// Admin API

export async function getPoolStatus() {
  return apiRequest<{
    pool: {
      available: number;
      assigned: number;
      provisioning: number;
      total: number;
    };
    config: {
      minPoolSize: number;
      maxPoolSize: number;
    };
    health: {
      healthy: boolean;
      message: string;
    };
  }>("/admin/pool/status");
}

export async function provisionPool(count: number) {
  return apiRequest<{
    success: boolean;
    provisioned: number;
    errors: string[];
    pool: {
      available: number;
      assigned: number;
      provisioning: number;
      total: number;
    };
  }>("/admin/pool/provision", {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}
