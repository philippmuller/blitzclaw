/**
 * Diagnostics endpoint for debugging provisioning issues
 * 
 * Protected by PROXY_SIGNING_SECRET or simple bearer check
 * Returns pool status, recent instances, and health info
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const INTERNAL_SECRET = process.env.PROXY_SIGNING_SECRET;

export async function GET(req: NextRequest) {
  // Simple auth check
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");
  
  // Allow if secret matches OR if a specific debug key is provided
  const debugKey = req.nextUrl.searchParams.get("key");
  const expectedDebugKey = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";
  
  // Allow searching for specific user
  const searchEmail = req.nextUrl.searchParams.get("email");
  const searchClerkId = req.nextUrl.searchParams.get("clerkId");
  
  if (providedSecret !== INTERNAL_SECRET && debugKey !== expectedDebugKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // If searching for specific user
    if (searchEmail || searchClerkId) {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            searchEmail ? { email: { contains: searchEmail } } : {},
            searchClerkId ? { clerkId: searchClerkId } : {},
          ].filter(o => Object.keys(o).length > 0),
        },
        include: {
          balance: true,
          instances: true,
        },
      });
      
      if (!user) {
        return NextResponse.json({ found: false, searchEmail, searchClerkId });
      }
      
      return NextResponse.json({
        found: true,
        user: {
          id: user.id,
          email: user.email,
          clerkId: user.clerkId,
          plan: user.plan,
          billingMode: user.billingMode,
          polarCustomerId: user.polarCustomerId,
          balance: user.balance?.creditsCents,
          instances: user.instances.map(i => ({
            id: i.id,
            status: i.status,
            ip: i.ipAddress,
            channel: i.channelType,
            created: i.createdAt,
          })),
          created: user.createdAt,
        },
      });
    }
    
    // Get pool status
    const poolServers = await prisma.serverPool.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    
    const poolSummary = {
      total: poolServers.length,
      byStatus: poolServers.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      servers: poolServers.map(s => ({
        id: s.id,
        status: s.status,
        ip: s.ipAddress,
        hetzerId: s.hetznerServerId,
        assignedTo: s.assignedTo,
        created: s.createdAt,
      })),
    };
    
    // Get recent instances
    const recentInstances = await prisma.instance.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: {
          select: { email: true, clerkId: true },
        },
      },
    });
    
    const instancesSummary = recentInstances.map(i => ({
      id: i.id,
      status: i.status,
      ip: i.ipAddress,
      hetzerId: i.hetznerServerId,
      channel: i.channelType,
      useOwnKey: i.useOwnApiKey,
      created: i.createdAt,
      lastHealth: i.lastHealthCheck,
      userEmail: i.user?.email?.slice(0, 10) + "...",
    }));
    
    // Get recent users
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        balance: true,
        _count: { select: { instances: true } },
      },
    });
    
    const usersSummary = recentUsers.map(u => ({
      id: u.id.slice(0, 8),
      email: u.email?.slice(0, 15) + "...",
      plan: u.plan,
      billing: u.billingMode,
      balance: u.balance?.creditsCents,
      instances: u._count.instances,
      created: u.createdAt,
    }));

    // Check environment
    const envCheck = {
      hasHetznerToken: !!process.env.HETZNER_API_TOKEN,
      hasHetznerSshKeyId: !!process.env.HETZNER_SSH_KEY_ID,
      hasDoToken: !!process.env.DIGITALOCEAN_API_TOKEN,
      hasDoSshKeyId: !!process.env.DIGITALOCEAN_SSH_KEY_ID,
      hasVultrToken: !!process.env.VULTR_API_TOKEN,
      hasVultrSshKeyId: !!process.env.VULTR_SSH_KEY_ID,
      hasSshPrivateKey: !!process.env.BLITZCLAW_SSH_PRIVATE_KEY,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasPolarToken: !!process.env.POLAR_ACCESS_TOKEN,
      polarSandbox: process.env.POLAR_SANDBOX,
      hasProxySecret: !!process.env.PROXY_SIGNING_SECRET,
    };

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      pool: poolSummary,
      instances: instancesSummary,
      users: usersSummary,
      env: envCheck,
    });
  } catch (error) {
    console.error("Diagnostics error:", error);
    return NextResponse.json({ 
      error: "Diagnostics failed",
      details: (error as Error).message 
    }, { status: 500 });
  }
}
