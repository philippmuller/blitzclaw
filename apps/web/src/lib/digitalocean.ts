/**
 * DigitalOcean API wrapper for BlitzClaw
 * https://docs.digitalocean.com/reference/api/
 */

const DIGITALOCEAN_API_URL = "https://api.digitalocean.com/v2";

interface DigitalOceanDroplet {
  id: number;
  name: string;
  status: string;
  region: {
    slug: string;
    name: string;
  };
  networks: {
    v4: Array<{ ip_address: string; type: "public" | "private" }>;
    v6: Array<{ ip_address: string; type: "public" | "private" }>;
  };
  tags: string[];
  created_at: string;
}

interface DigitalOceanCreateDropletResponse {
  droplet: DigitalOceanDroplet;
}

interface DigitalOceanDropletResponse {
  droplet: DigitalOceanDroplet;
}

function getApiToken(): string {
  const token = process.env.DIGITALOCEAN_API_TOKEN;
  if (!token) {
    throw new Error("DIGITALOCEAN_API_TOKEN environment variable is not set");
  }
  return token;
}

async function digitalOceanRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getApiToken();

  const response = await fetch(`${DIGITALOCEAN_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(`DigitalOcean API error: ${error.message || response.statusText}`);
  }

  // Handle 204 No Content (e.g., for DELETE)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

function parseSshKeyIds(raw?: string): Array<number | string> {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (entry.match(/^\d+$/) ? Number(entry) : entry));
}

function labelsToTags(labels?: Record<string, string>): string[] {
  if (!labels) {
    return [];
  }
  return Object.entries(labels).map(([key, value]) => {
    const raw = `${key}-${value}`;
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/--+/g, "-")
      .replace(/^-+|-+$/g, "");
  });
}

export interface CreateDropletOptions {
  name: string;
  size?: string;
  image?: string;
  region?: string;
  sshKeys?: Array<number | string>;
  userData?: string;
  tags?: string[];
  labels?: Record<string, string>;
}

/**
 * Create a new DigitalOcean droplet
 */
export async function createDroplet(options: CreateDropletOptions): Promise<{
  dropletId: number;
  ipAddress: string;
}> {
  const response = await digitalOceanRequest<DigitalOceanCreateDropletResponse>("/droplets", {
    method: "POST",
    body: JSON.stringify({
      name: options.name,
      region: options.region || "fra1",
      size: options.size || "s-1vcpu-2gb",
      image: options.image || "ubuntu-24-04-x64",
      ssh_keys: options.sshKeys ?? parseSshKeyIds(process.env.DIGITALOCEAN_SSH_KEY_ID),
      user_data: options.userData,
      tags: [
        "blitzclaw",
        ...labelsToTags(options.labels),
        ...(options.tags || []),
      ].filter(Boolean),
    }),
  });

  const publicIpv4 = response.droplet.networks?.v4?.find((net) => net.type === "public");

  return {
    dropletId: response.droplet.id,
    ipAddress: publicIpv4?.ip_address || "",
  };
}

/**
 * Delete a DigitalOcean droplet
 */
export async function deleteDroplet(dropletId: number): Promise<void> {
  await digitalOceanRequest<void>(`/droplets/${dropletId}`, {
    method: "DELETE",
  });
}

/**
 * Get a single DigitalOcean droplet by ID
 */
export async function getDroplet(dropletId: number): Promise<DigitalOceanDroplet | null> {
  try {
    const response = await digitalOceanRequest<DigitalOceanDropletResponse>(`/droplets/${dropletId}`);
    return response.droplet;
  } catch (error) {
    if ((error as Error).message.toLowerCase().includes("not found")) {
      return null;
    }
    throw error;
  }
}

export type { DigitalOceanDroplet };
