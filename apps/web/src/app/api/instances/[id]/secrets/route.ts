import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { syncSecretsToServer } from "@/lib/ssh";

/**
 * GET /api/instances/[id]/secrets - Get redacted secrets for display
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;
  const instance = await prisma.instance.findFirst({
    where: { id, userId: user.id },
    select: { secrets: true },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Return secrets with redacted values for display
  const secrets = (instance.secrets as Record<string, string>) || {};
  const redactedSecrets: Record<string, { redacted: string; length: number }> = {};

  for (const [key, value] of Object.entries(secrets)) {
    redactedSecrets[key] = {
      redacted: value.length > 8
        ? `${value.slice(0, 4)}${"•".repeat(Math.min(value.length - 8, 20))}${value.slice(-4)}`
        : "••••••••",
      length: value.length,
    };
  }

  return NextResponse.json({ secrets: redactedSecrets });
}

/**
 * PUT /api/instances/[id]/secrets - Update secrets and sync to server
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;
  const instance = await prisma.instance.findFirst({
    where: { id, userId: user.id },
    select: { id: true, ipAddress: true, status: true },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Parse and validate the secrets
  let secrets: Record<string, string>;
  try {
    const body = await req.json();
    secrets = body.secrets || {};

    // Validate: all keys and values must be strings
    for (const [key, value] of Object.entries(secrets)) {
      if (typeof key !== "string" || typeof value !== "string") {
        return NextResponse.json(
          { error: "All keys and values must be strings" },
          { status: 400 }
        );
      }
      // Validate key format (env var style)
      if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
        return NextResponse.json(
          { error: `Invalid key format: ${key}. Use UPPER_SNAKE_CASE.` },
          { status: 400 }
        );
      }
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Update secrets in database
  await prisma.instance.update({
    where: { id },
    data: { secrets },
  });

  // Sync to server if instance is active and has an IP
  if (instance.ipAddress && instance.status === "ACTIVE") {
    const syncResult = await syncSecretsToServer(instance.ipAddress, secrets);
    if (!syncResult.ok) {
      // DB was updated but sync failed - return partial success
      return NextResponse.json({
        success: true,
        syncedToServer: false,
        syncError: syncResult.error,
        message: "Secrets saved to database but failed to sync to server",
      });
    }
    return NextResponse.json({
      success: true,
      syncedToServer: true,
      message: "Secrets saved and synced to server",
    });
  }

  // Instance not active - just save to DB
  return NextResponse.json({
    success: true,
    syncedToServer: false,
    message: "Secrets saved. Will sync when instance becomes active.",
  });
}
