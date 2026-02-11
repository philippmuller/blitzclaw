/**
 * Check instance health by SSHing to the server and verifying config
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const DEBUG_KEY = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";

export async function GET(req: NextRequest) {
  const debugKey = req.nextUrl.searchParams.get("key");
  const instanceId = req.nextUrl.searchParams.get("instance");
  
  if (debugKey !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!instanceId) {
    return NextResponse.json({ error: "instance param required" }, { status: 400 });
  }

  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    include: { user: { select: { email: true } } },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  if (!instance.ipAddress) {
    return NextResponse.json({ 
      error: "Instance has no IP", 
      status: instance.status 
    }, { status: 400 });
  }

  // Try to SSH and check config
  const sshKey = process.env.BLITZCLAW_SSH_PRIVATE_KEY;
  if (!sshKey) {
    return NextResponse.json({ 
      error: "SSH key not configured",
      instance: {
        id: instance.id,
        ip: instance.ipAddress,
        status: instance.status,
        hasProxySecret: !!instance.proxySecret,
        hasGatewayToken: !!instance.gatewayToken,
      }
    });
  }

  try {
    const { sshExec } = await import("@/lib/ssh");
    
    // Check OpenClaw service status
    const { stdout: serviceStatus, code: serviceCode } = await sshExec(
      instance.ipAddress,
      "systemctl is-active openclaw && systemctl status openclaw --no-pager | tail -20"
    );

    // Check OpenClaw config
    const { stdout: configCheck } = await sshExec(
      instance.ipAddress,
      "cat /root/.openclaw/openclaw.json | jq '.channels.telegram // \"NO TELEGRAM CONFIG\"'"
    );

    // Check if ready file exists
    const { stdout: readyCheck } = await sshExec(
      instance.ipAddress,
      "ls -la /etc/blitzclaw/ready 2>/dev/null || echo 'NOT READY'"
    );

    // Check cloud-init log
    const { stdout: cloudInitLog } = await sshExec(
      instance.ipAddress,
      "tail -30 /var/log/blitzclaw-setup.log 2>/dev/null || echo 'No setup log'"
    );

    return NextResponse.json({
      instance: {
        id: instance.id,
        ip: instance.ipAddress,
        status: instance.status,
        channel: instance.channelType,
        user: instance.user?.email?.slice(0, 15) + "...",
      },
      ssh: {
        connected: true,
        serviceActive: serviceCode === 0,
        serviceStatus: serviceStatus.slice(0, 500),
      },
      config: {
        telegram: configCheck.trim(),
      },
      ready: !readyCheck.includes("NOT READY"),
      setupLog: cloudInitLog.slice(-1000),
    });
  } catch (error) {
    return NextResponse.json({
      instance: {
        id: instance.id,
        ip: instance.ipAddress,
        status: instance.status,
      },
      ssh: {
        connected: false,
        error: (error as Error).message,
      },
    });
  }
}
