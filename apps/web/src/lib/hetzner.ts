/**
 * Hetzner Cloud API wrapper for BlitzClaw
 * https://docs.hetzner.cloud/
 */

const HETZNER_API_URL = "https://api.hetzner.cloud/v1";

interface HetznerServer {
  id: number;
  name: string;
  status: string;
  public_net: {
    ipv4: {
      ip: string;
    };
    ipv6: {
      ip: string;
    };
  };
  server_type: {
    name: string;
    description: string;
    cores: number;
    memory: number;
    disk: number;
  };
  datacenter: {
    name: string;
    location: {
      name: string;
      city: string;
    };
  };
  labels: Record<string, string>;
  created: string;
}

interface HetznerCreateServerResponse {
  server: HetznerServer;
  action: {
    id: number;
    status: string;
  };
  root_password: string | null;
}

interface HetznerListServersResponse {
  servers: HetznerServer[];
}

interface HetznerServerResponse {
  server: HetznerServer;
}

interface HetznerActionResponse {
  action: {
    id: number;
    status: string;
    progress: number;
  };
}

function getApiToken(): string {
  const token = process.env.HETZNER_API_TOKEN;
  if (!token) {
    throw new Error("HETZNER_API_TOKEN environment variable is not set");
  }
  return token;
}

async function hetznerRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getApiToken();

  const response = await fetch(`${HETZNER_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Request failed" } }));
    throw new Error(`Hetzner API error: ${error.error?.message || response.statusText}`);
  }

  // Handle 204 No Content (e.g., for DELETE)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export interface CreateServerOptions {
  name: string;
  serverType?: string;
  image?: string;
  location?: string;
  sshKeys?: string[];
  userData?: string;
  labels?: Record<string, string>;
}

/**
 * Create a new Hetzner server
 */
export async function createServer(options: CreateServerOptions): Promise<{
  serverId: number;
  ipAddress: string;
  rootPassword: string | null;
}> {
  const response = await hetznerRequest<HetznerCreateServerResponse>("/servers", {
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      server_type: options.serverType || "cx23", // ARM-based, cost-effective
      image: options.image || "ubuntu-24.04",
      location: options.location || "nbg1", // Nuremberg, Germany - GDPR compliant, low latency for EU
      ssh_keys: options.sshKeys || [],
      user_data: options.userData,
      labels: options.labels || {},
      start_after_create: true,
    }),
  });

  return {
    serverId: response.server.id,
    ipAddress: response.server.public_net.ipv4.ip,
    rootPassword: response.root_password,
  };
}

/**
 * Delete a Hetzner server
 */
export async function deleteServer(serverId: number): Promise<void> {
  await hetznerRequest<HetznerActionResponse>(`/servers/${serverId}`, {
    method: "DELETE",
  });
}

/**
 * Get a single Hetzner server by ID
 */
export async function getServer(serverId: number): Promise<HetznerServer | null> {
  try {
    const response = await hetznerRequest<HetznerServerResponse>(`/servers/${serverId}`);
    return response.server;
  } catch (error) {
    // Return null if server not found
    if ((error as Error).message.includes("not found")) {
      return null;
    }
    throw error;
  }
}

/**
 * List all Hetzner servers, optionally filtered by labels
 */
export async function listServers(labelSelector?: string): Promise<HetznerServer[]> {
  const params = new URLSearchParams();
  if (labelSelector) {
    params.set("label_selector", labelSelector);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await hetznerRequest<HetznerListServersResponse>(`/servers${query}`);
  return response.servers;
}

/**
 * List all BlitzClaw servers
 */
export async function listBlitzClawServers(): Promise<HetznerServer[]> {
  return listServers("service=blitzclaw");
}

/**
 * Reboot a server
 */
export async function rebootServer(serverId: number): Promise<void> {
  await hetznerRequest<HetznerActionResponse>(`/servers/${serverId}/actions/reboot`, {
    method: "POST",
  });
}

/**
 * Power on a server
 */
export async function powerOnServer(serverId: number): Promise<void> {
  await hetznerRequest<HetznerActionResponse>(`/servers/${serverId}/actions/poweron`, {
    method: "POST",
  });
}

/**
 * Power off a server (hard shutdown)
 */
export async function powerOffServer(serverId: number): Promise<void> {
  await hetznerRequest<HetznerActionResponse>(`/servers/${serverId}/actions/poweroff`, {
    method: "POST",
  });
}

/**
 * Graceful shutdown
 */
export async function shutdownServer(serverId: number): Promise<void> {
  await hetznerRequest<HetznerActionResponse>(`/servers/${serverId}/actions/shutdown`, {
    method: "POST",
  });
}

/**
 * Update server labels (for tracking user assignment)
 */
export async function updateServerLabels(
  serverId: number,
  labels: Record<string, string>
): Promise<void> {
  await hetznerRequest<HetznerServerResponse>(`/servers/${serverId}`, {
    method: "PUT",
    body: JSON.stringify({ labels }),
  });
}

/**
 * Update server name
 */
export async function renameServer(serverId: number, name: string): Promise<void> {
  await hetznerRequest<HetznerServerResponse>(`/servers/${serverId}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export type { HetznerServer };
