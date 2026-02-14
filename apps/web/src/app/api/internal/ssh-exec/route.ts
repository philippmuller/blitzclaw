/**
 * Run arbitrary SSH commands on an instance (debug only)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const DEBUG_KEY = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";

export async function POST(req: NextRequest) {
  const debugKey = req.nextUrl.searchParams.get("key");
  if (debugKey !== DEBUG_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { instanceId, command } = body;

  if (!instanceId || !command) {
    return NextResponse.json({ error: "instanceId and command required" }, { status: 400 });
  }

  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    select: { ipAddress: true },
  });

  if (!instance?.ipAddress) {
    return NextResponse.json({ error: "Instance not found or no IP" }, { status: 404 });
  }

  try {
    const { sshExec } = await import("@/lib/ssh");
    const { stdout, stderr, code } = await sshExec(instance.ipAddress, command, { timeout: 30000 });
    return NextResponse.json({ stdout, stderr, code });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
