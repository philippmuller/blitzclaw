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
