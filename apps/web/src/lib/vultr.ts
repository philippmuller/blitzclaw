/**
 * Vultr API wrapper for BlitzClaw
 * https://www.vultr.com/api/
 * 
 * Third fallback provider after Hetzner and DigitalOcean
 */

const VULTR_API_URL = "https://api.vultr.com/v2";

interface VultrInstance {
  id: string;
  label: string;
  status: string;
  main_ip: string;
  region: string;
  plan: string;
  tags: string[];
  date_created: string;
}

interface VultrCreateInstanceResponse {
  instance: VultrInstance;
}

interface VultrGetInstanceResponse {
  instance: VultrInstance;
}

interface VultrListInstancesResponse {
  instances: VultrInstance[];
}

function getApiToken(): string {
  const token = process.env.VULTR_API_TOKEN;
  if (!token) {
    throw new Error("VULTR_API_TOKEN environment variable is not set");
  }
  return token;
}

async function vultrRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getApiToken();

  const response = await fetch(`${VULTR_API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(`Vultr API error: ${error.error || response.statusText}`);
  }

  // Handle 204 No Content (e.g., for DELETE)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export interface CreateVultrInstanceOptions {
  name: string;
  plan?: string;  // "vc2-1c-1gb" ($5), "vc2-1c-2gb" ($10), "vc2-2c-4gb" ($20)
  region?: string;
  osId?: number;  // 2284 = Ubuntu 24.04 x64
  sshKeyIds?: string[];
  userData?: string;
  tags?: string[];
}

/**
 * Create a new Vultr instance
 */
export async function createVultrInstance(options: CreateVultrInstanceOptions): Promise<{
  instanceId: string;
  ipAddress: string;
}> {
  const response = await vultrRequest<VultrCreateInstanceResponse>("/instances", {
    method: "POST",
    body: JSON.stringify({
      label: options.name,
      plan: options.plan || "vc2-1c-2gb",  // $10/mo - 1 vCPU, 2GB RAM
      region: options.region || "fra",  // Frankfurt, Germany - GDPR compliant
      os_id: options.osId || 2284,  // Ubuntu 24.04 x64
      sshkey_id: options.sshKeyIds || [],
      user_data: options.userData ? Buffer.from(options.userData).toString("base64") : undefined,
      tags: options.tags || [],
      backups: "disabled",
      ddos_protection: false,
      activation_email: false,
    }),
  });

  const instanceId = response.instance.id;
  
  // Poll for IP address (instance needs time to get an IP)
  let ipAddress = "";
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
      const instance = await getVultrInstance(instanceId);
      if (instance && instance.main_ip && instance.main_ip !== "0.0.0.0") {
        ipAddress = instance.main_ip;
        break;
      }
    } catch {
      // Keep polling
    }
  }

  if (!ipAddress) {
    throw new Error(`Vultr instance ${instanceId} created but no IP assigned after 60s`);
  }

  return {
    instanceId,
    ipAddress,
  };
}

/**
 * Delete a Vultr instance
 */
export async function deleteVultrInstance(instanceId: string): Promise<void> {
  await vultrRequest<void>(`/instances/${instanceId}`, {
    method: "DELETE",
  });
}

/**
 * Get a single Vultr instance by ID
 */
export async function getVultrInstance(instanceId: string): Promise<VultrInstance | null> {
  try {
    const response = await vultrRequest<VultrGetInstanceResponse>(`/instances/${instanceId}`);
    return response.instance;
  } catch (error) {
    // Return null if instance not found
    if ((error as Error).message.includes("not found") || (error as Error).message.includes("404")) {
      return null;
    }
    throw error;
  }
}

/**
 * List all Vultr instances, optionally filtered by tag
 */
export async function listVultrInstances(tag?: string): Promise<VultrInstance[]> {
  const params = new URLSearchParams();
  if (tag) {
    params.set("tag", tag);
  }

  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await vultrRequest<VultrListInstancesResponse>(`/instances${query}`);
  return response.instances || [];
}

/**
 * List all BlitzClaw Vultr instances
 */
export async function listBlitzClawVultrInstances(): Promise<VultrInstance[]> {
  return listVultrInstances("blitzclaw");
}
