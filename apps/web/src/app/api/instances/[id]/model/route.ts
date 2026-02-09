import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const VALID_MODELS = [
  "claude-opus-4-6",           // Opus 4.6 - most intelligent
  "claude-sonnet-4-5",         // Sonnet 4.5 - speed + intelligence  
  "claude-haiku-4-5",          // Haiku 4.5 - fastest
];

/**
 * Update the OpenClaw config on the remote server via gateway API
 */
async function updateRemoteConfig(
  ipAddress: string,
  gatewayToken: string,
  model: string,
  useOwnApiKey: boolean
): Promise<{ ok: boolean; error?: string }> {
  const modelPrefix = useOwnApiKey ? "anthropic" : "blitzclaw";
  const fullModel = `${modelPrefix}/${model}`;
  
  try {
    // Use the gateway's config.patch API to update the model
    const res = await fetch(`http://${ipAddress}:18789/api/config/patch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        patch: {
          agents: {
            defaults: {
              model: {
                primary: fullModel,
              },
            },
          },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`Failed to update remote config: ${res.status} ${text}`);
      return { ok: false, error: `Gateway returned ${res.status}` };
    }

    return { ok: true };
  } catch (error) {
    console.error("Error updating remote config:", error);
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * PATCH /api/instances/[id]/model - Update instance model
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId: clerkId } = await auth();
  
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get user
  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get instance and verify ownership
  const instance = await prisma.instance.findUnique({
    where: { id },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  if (instance.userId !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Parse body
  const body = await req.json();
  const { model } = body;

  if (!model || !VALID_MODELS.includes(model)) {
    return NextResponse.json(
      { error: `Invalid model. Must be one of: ${VALID_MODELS.join(", ")}` },
      { status: 400 }
    );
  }

  // Update instance in database
  const updated = await prisma.instance.update({
    where: { id },
    data: { model },
  });

  // Try to update the remote server config
  let remoteUpdateStatus = "not_attempted";
  if (instance.ipAddress && instance.gatewayToken && instance.status === "ACTIVE") {
    const result = await updateRemoteConfig(
      instance.ipAddress,
      instance.gatewayToken,
      model,
      instance.useOwnApiKey
    );
    remoteUpdateStatus = result.ok ? "success" : `failed: ${result.error}`;
  }

  return NextResponse.json({
    id: updated.id,
    model: updated.model,
    remoteUpdate: remoteUpdateStatus,
    message: remoteUpdateStatus === "success" 
      ? "Model updated on server. Changes take effect on next message."
      : "Model saved. Server update may require restart.",
  });
}
