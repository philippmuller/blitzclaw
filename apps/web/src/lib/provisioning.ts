/**
 * Server pool and instance provisioning service
 */

import { prisma, ServerPoolStatus, InstanceStatus } from "@blitzclaw/db";
import { createServer, deleteServer, getServer, rebootServer } from "./hetzner";
import { generateCloudInit, generateSoulMd } from "./cloud-init";
import { randomBytes } from "crypto";

const MIN_POOL_SIZE = 3;
const MAX_POOL_SIZE = 10;
const PROVISIONING_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generate a secure random secret
 */
function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Get current pool status
 */
export async function getPoolStatus() {
  const servers = await prisma.serverPool.groupBy({
    by: ["status"],
    _count: true,
  });

  const statusMap = servers.reduce((acc, s) => {
    acc[s.status] = s._count;
    return acc;
  }, {} as Record<string, number>);

  return {
    available: statusMap[ServerPoolStatus.AVAILABLE] || 0,
    assigned: statusMap[ServerPoolStatus.ASSIGNED] || 0,
    provisioning: statusMap[ServerPoolStatus.PROVISIONING] || 0,
    total: Object.values(statusMap).reduce((a, b) => a + b, 0),
    minPoolSize: MIN_POOL_SIZE,
    maxPoolSize: MAX_POOL_SIZE,
  };
}

/**
 * Provision a new server and add it to the pool
 * For pool servers, we provision without Telegram config (added later when assigned)
 */
export async function provisionPoolServer(options?: {
  telegramBotToken?: string;
  instanceId?: string;
  model?: string;
  byokMode?: boolean;
  anthropicKey?: string;
}): Promise<{
  id: string;
  hetznerServerId: string;
  ipAddress: string;
  gatewayToken: string;
  proxySecret: string;
}> {
  console.log("provisionPoolServer called with:", {
    hasInstanceId: !!options?.instanceId,
    hasToken: !!options?.telegramBotToken,
    model: options?.model,
    byokMode: options?.byokMode,
    hasAnthropicKey: !!options?.anthropicKey,
  });

  // Generate unique instance ID and secrets
  const poolEntryId = options?.instanceId || `pool-${Date.now()}-${randomBytes(4).toString("hex")}`;
  const proxySecret = generateSecret();
  const gatewayToken = generateSecret();

  // Get API key - use user's key for BYOK, otherwise platform key
  const byokMode = options?.byokMode || false;
  const anthropicApiKey = byokMode && options?.anthropicKey 
    ? options.anthropicKey 
    : process.env.ANTHROPIC_API_KEY;

  console.log("API key check:", {
    byokMode,
    hasAnthropicKey: !!anthropicApiKey,
    keyLength: anthropicApiKey?.length,
    envKeySet: !!process.env.ANTHROPIC_API_KEY,
  });
    
  if (!anthropicApiKey) {
    throw new Error(byokMode 
      ? "Anthropic API key required for BYOK mode" 
      : "ANTHROPIC_API_KEY not configured");
  }

  // Generate cloud-init script with full configuration
  const braveApiKey = process.env.BRAVE_API_KEY;
  const cloudInit = generateCloudInit({
    instanceId: poolEntryId,
    proxySecret,
    gatewayToken,
    anthropicApiKey,
    telegramBotToken: options?.telegramBotToken,
    braveApiKey,
    model: options?.model,
    byokMode,
  });

  // Create server on Hetzner
  const serverName = `blitz-pool-${Date.now()}`;
  
  // Get SSH key ID from env (must be configured in Hetzner)
  const sshKeyId = process.env.HETZNER_SSH_KEY_ID;
  console.log("Hetzner config:", {
    sshKeyId,
    hasHetznerToken: !!process.env.HETZNER_API_TOKEN,
  });
  if (!sshKeyId) {
    console.warn("HETZNER_SSH_KEY_ID not set - server will not have SSH access");
  }
  
  console.log("Creating Hetzner server:", serverName);
  const { serverId, ipAddress } = await createServer({
    name: serverName,
    userData: cloudInit,
    sshKeys: sshKeyId ? [sshKeyId] : [],
    labels: {
      service: "blitzclaw",
      type: "pool",
      pool_id: poolEntryId,
    },
  });

  // Create pool entry in database
  const poolEntry = await prisma.serverPool.create({
    data: {
      hetznerServerId: serverId.toString(),
      ipAddress,
      status: ServerPoolStatus.PROVISIONING,
    },
  });

  return {
    id: poolEntry.id,
    hetznerServerId: serverId.toString(),
    ipAddress,
    gatewayToken,
    proxySecret,
  };
}

/**
 * Provision multiple servers at once
 */
export async function provisionPoolServers(count: number): Promise<{
  provisioned: number;
  errors: string[];
}> {
  const results = {
    provisioned: 0,
    errors: [] as string[],
  };

  // Check if we'd exceed max pool size
  const status = await getPoolStatus();
  const available = MAX_POOL_SIZE - status.total;
  const toProvision = Math.min(count, available);

  if (toProvision < count) {
    results.errors.push(
      `Can only provision ${toProvision} servers (max pool size: ${MAX_POOL_SIZE})`
    );
  }

  // Provision servers in parallel (but with some concurrency limit)
  const promises = Array(toProvision)
    .fill(null)
    .map(async () => {
      try {
        await provisionPoolServer();
        results.provisioned++;
      } catch (error) {
        results.errors.push((error as Error).message);
      }
    });

  await Promise.all(promises);

  return results;
}

/**
 * Mark a pool server as ready (called when cloud-init completes)
 */
export async function markServerReady(hetznerServerId: string): Promise<void> {
  await prisma.serverPool.updateMany({
    where: { hetznerServerId },
    data: { status: ServerPoolStatus.AVAILABLE },
  });
}

/**
 * Clean up stuck provisioning servers
 */
export async function cleanupStuckServers(): Promise<{
  cleaned: number;
  errors: string[];
}> {
  const cutoff = new Date(Date.now() - PROVISIONING_TIMEOUT_MS);

  const stuckServers = await prisma.serverPool.findMany({
    where: {
      status: ServerPoolStatus.PROVISIONING,
      createdAt: { lt: cutoff },
    },
  });

  const results = { cleaned: 0, errors: [] as string[] };

  for (const server of stuckServers) {
    try {
      // Delete from Hetzner
      await deleteServer(parseInt(server.hetznerServerId, 10));
      // Delete from database
      await prisma.serverPool.delete({ where: { id: server.id } });
      results.cleaned++;
    } catch (error) {
      results.errors.push(`Failed to clean ${server.id}: ${(error as Error).message}`);
    }
  }

  return results;
}

/**
 * Clean up orphaned servers (ASSIGNED but no instance linked)
 * These can occur when an instance is deleted but the pool entry isn't properly returned.
 */
export async function cleanupOrphanedServers(): Promise<number> {
  const orphaned = await prisma.serverPool.findMany({
    where: {
      status: ServerPoolStatus.ASSIGNED,
      assignedTo: null,
    },
  });

  if (orphaned.length === 0) {
    return 0;
  }

  console.log(`Found ${orphaned.length} orphaned server(s):`, orphaned.map(s => s.id));

  await prisma.serverPool.updateMany({
    where: {
      status: ServerPoolStatus.ASSIGNED,
      assignedTo: null,
    },
    data: {
      status: ServerPoolStatus.AVAILABLE,
    },
  });

  console.log(`Returned ${orphaned.length} orphaned server(s) to AVAILABLE`);
  return orphaned.length;
}

/**
 * Maintain the server pool (called periodically)
 */
export async function maintainPool(): Promise<{
  provisioned: number;
  cleaned: number;
  orphansCleaned: number;
  errors: string[];
}> {
  const errors: string[] = [];

  // Clean up orphaned servers first (ASSIGNED but no instance)
  const orphansCleaned = await cleanupOrphanedServers();

  // Clean up stuck provisioning servers
  const cleanupResult = await cleanupStuckServers();
  errors.push(...cleanupResult.errors);

  // Check pool status
  const status = await getPoolStatus();

  // Provision more if needed
  let provisioned = 0;
  if (status.available < MIN_POOL_SIZE) {
    const toProvision = MIN_POOL_SIZE - status.available;
    const result = await provisionPoolServers(toProvision);
    provisioned = result.provisioned;
    errors.push(...result.errors);
  }

  return {
    provisioned,
    cleaned: cleanupResult.cleaned,
    errors,
  };
}

/**
 * Assign a server from the pool to an instance
 */
export async function assignServerToInstance(instanceId: string): Promise<{
  serverId: string;
  ipAddress: string;
} | null> {
  // Try to get an available server from the pool
  const poolServer = await prisma.serverPool.findFirst({
    where: { status: ServerPoolStatus.AVAILABLE },
  });

  if (!poolServer) {
    return null;
  }

  // Mark as assigned
  await prisma.serverPool.update({
    where: { id: poolServer.id },
    data: {
      status: ServerPoolStatus.ASSIGNED,
      assignedTo: instanceId,
    },
  });

  return {
    serverId: poolServer.hetznerServerId,
    ipAddress: poolServer.ipAddress,
  };
}

/**
 * Return a server to the pool (when instance is deleted)
 */
export async function returnServerToPool(instanceId: string): Promise<void> {
  const poolServer = await prisma.serverPool.findFirst({
    where: { assignedTo: instanceId },
  });

  if (poolServer) {
    // Reset the server and return to pool
    // For now, just mark as available. In production, we'd wipe the server.
    await prisma.serverPool.update({
      where: { id: poolServer.id },
      data: {
        status: ServerPoolStatus.AVAILABLE,
        assignedTo: null,
      },
    });
  }
}

/**
 * Create a new instance for a user
 */
export interface CreateInstanceOptions {
  userId: string;
  channelType: "TELEGRAM" | "WHATSAPP";
  personaTemplate: string;
  model?: string;
  soulMd?: string;
  channelConfig?: string; // JSON string with bot_token, etc.
  byokMode?: boolean;     // If true, use user's Anthropic key directly
  anthropicKey?: string;  // User's Anthropic API key (for BYOK)
}

export async function createInstance(options: CreateInstanceOptions): Promise<{
  instanceId: string;
  status: InstanceStatus;
  ipAddress: string | null;
  gatewayToken?: string;
}> {
  const { userId, channelType, personaTemplate, model, soulMd, channelConfig, byokMode, anthropicKey } = options;

  // Parse channelConfig to extract bot token
  let telegramBotToken: string | undefined;
  if (channelConfig) {
    try {
      const config = JSON.parse(channelConfig);
      telegramBotToken = config.bot_token;
    } catch (e) {
      console.error("Failed to parse channelConfig:", e);
    }
  }

  // Create instance record
  const instance = await prisma.instance.create({
    data: {
      userId,
      channelType,
      personaTemplate,
      model: model || "claude-opus-4-6",
      soulMd: generateSoulMd(personaTemplate, soulMd),
      channelConfig,
      status: InstanceStatus.PENDING,
      useOwnApiKey: byokMode || false,
    },
  });

  // Generate secrets for this instance (used when assigning from pool)
  let finalGatewayToken = generateSecret();
  let finalProxySecret = generateSecret();
  
  // Get API key - use user's key for BYOK, otherwise platform key
  const anthropicApiKey = byokMode && anthropicKey 
    ? anthropicKey 
    : process.env.ANTHROPIC_API_KEY;
    
  if (!anthropicApiKey) {
    throw new Error(byokMode 
      ? "Anthropic API key required for BYOK mode" 
      : "ANTHROPIC_API_KEY not configured");
  }
  
  let server: { serverId: string; ipAddress: string } | null = null;
  
  // Try to assign from pool first (faster - server already running)
  const poolServer = await assignServerToInstance(instance.id);
  
  if (poolServer && telegramBotToken) {
    console.log("🚀 Found pool server, configuring via SSH:", poolServer.ipAddress);
    
    try {
      // Import SSH function dynamically to avoid build issues
      const { configurePoolServer } = await import("./ssh");
      
      const configResult = await configurePoolServer(poolServer.ipAddress, {
        telegramBotToken,
        proxySecret: finalProxySecret,
        gatewayToken: finalGatewayToken,
        anthropicApiKey,
        model: model || "claude-opus-4-6",
        byokMode: byokMode || false,
        braveApiKey: process.env.BRAVE_API_KEY,
      });
      
      if (configResult.ok) {
        console.log("✅ Pool server configured successfully");
        server = {
          serverId: poolServer.serverId,
          ipAddress: poolServer.ipAddress,
        };
      } else {
        console.error("❌ Pool server configuration failed:", configResult.error);
        // Return server to pool and fall back to on-demand
        await prisma.serverPool.update({
          where: { hetznerServerId: poolServer.serverId },
          data: { status: ServerPoolStatus.AVAILABLE, assignedTo: null },
        });
      }
    } catch (sshError) {
      console.error("❌ SSH error during pool server configuration:", sshError);
      // Return server to pool and fall back to on-demand
      await prisma.serverPool.update({
        where: { hetznerServerId: poolServer.serverId },
        data: { status: ServerPoolStatus.AVAILABLE, assignedTo: null },
      });
    }
  }
  
  // Fall back to on-demand provisioning if pool assignment failed
  if (!server) {
    console.log("📦 Provisioning on-demand server for instance:", instance.id);
    
    try {
      const newServer = await provisionPoolServer({
        telegramBotToken,
        instanceId: instance.id,
        model: model || "claude-opus-4-6",
        byokMode,
        anthropicKey,
      });
      
      // Immediately assign it to this instance
      await prisma.serverPool.update({
        where: { id: newServer.id },
        data: {
          status: ServerPoolStatus.ASSIGNED,
          assignedTo: instance.id,
        },
      });
      
      server = {
        serverId: newServer.hetznerServerId,
        ipAddress: newServer.ipAddress,
      };
      
      // For on-demand servers, use the secrets baked into cloud-init
      finalProxySecret = newServer.proxySecret;
      finalGatewayToken = newServer.gatewayToken;
      
    } catch (error) {
      console.error("Failed to provision on-demand server:", error);
      // Leave instance as PENDING, it can be manually fixed later
      return {
        instanceId: instance.id,
        status: InstanceStatus.PENDING,
        ipAddress: null,
      };
    }
  }

  // Update instance with server info
  await prisma.instance.update({
    where: { id: instance.id },
    data: {
      hetznerServerId: server!.serverId,
      ipAddress: server!.ipAddress,
      proxySecret: finalProxySecret,
      gatewayToken: finalGatewayToken,
      status: InstanceStatus.PROVISIONING,
    },
  });

  return {
    instanceId: instance.id,
    status: InstanceStatus.PROVISIONING,
    ipAddress: server!.ipAddress,
    gatewayToken: finalGatewayToken,
  };
}

/**
 * Get instance details
 */
export async function getInstance(instanceId: string, userId: string) {
  return prisma.instance.findFirst({
    where: { id: instanceId, userId },
    include: {
      usageLogs: {
        orderBy: { timestamp: "desc" },
        take: 10,
      },
    },
  });
}

/**
 * List user's instances
 */
export async function listInstances(userId: string) {
  return prisma.instance.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Delete an instance
 */
export async function deleteInstance(instanceId: string, userId: string): Promise<boolean> {
  const instance = await prisma.instance.findFirst({
    where: { id: instanceId, userId },
  });

  if (!instance) {
    return false;
  }

  // Return server to pool
  if (instance.hetznerServerId) {
    await returnServerToPool(instanceId);
  }

  // Delete instance record
  await prisma.instance.delete({
    where: { id: instanceId },
  });

  return true;
}

/**
 * Restart an instance (restart OpenClaw on the server)
 */
export async function restartInstance(instanceId: string, userId: string): Promise<boolean> {
  const instance = await prisma.instance.findFirst({
    where: { id: instanceId, userId },
  });

  if (!instance || !instance.hetznerServerId) {
    return false;
  }

  // For now, just reboot the server
  // In production, we'd SSH in and restart the OpenClaw service
  await rebootServer(parseInt(instance.hetznerServerId, 10));

  return true;
}
