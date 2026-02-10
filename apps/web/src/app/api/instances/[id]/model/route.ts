import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { updateRemoteModel } from "@/lib/ssh";

const VALID_MODELS = [
  "claude-opus-4-6",           // Opus 4.6 - most intelligent
  "claude-sonnet-4-5",         // Sonnet 4.5 - speed + intelligence  
  "claude-haiku-4-5",          // Haiku 4.5 - fastest
];

/**
 * PATCH /api/instances/[id]/model - Update instance model
 * 
 * This updates both the database AND the remote server config via SSH,
 * then restarts the OpenClaw service for changes to take effect.
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

  // Check if model is already the same
  if (instance.model === model) {
    return NextResponse.json({
      id: instance.id,
      model: instance.model,
      remoteUpdate: "skipped",
      message: "Model is already set to this value.",
    });
  }

  // Update instance in database first
  const updated = await prisma.instance.update({
    where: { id },
    data: { model },
  });

  // Try to update the remote server config via SSH
  let remoteUpdateStatus = "not_attempted";
  let remoteUpdateMessage = "";
  
  if (instance.ipAddress && instance.status === "ACTIVE") {
    console.log(`Updating model on ${instance.ipAddress} to ${model}...`);
    
    const result = await updateRemoteModel(
      instance.ipAddress,
      model,
      instance.useOwnApiKey
    );
    
    if (result.ok) {
      remoteUpdateStatus = "success";
      remoteUpdateMessage = "Model updated and service restarted. Changes are active now.";
    } else {
      remoteUpdateStatus = "failed";
      remoteUpdateMessage = `Remote update failed: ${result.error}. Database updated but server may need manual restart.`;
      console.error(`Remote model update failed for instance ${id}:`, result.error);
    }
  } else if (!instance.ipAddress) {
    remoteUpdateStatus = "no_server";
    remoteUpdateMessage = "No server assigned. Model will be applied when server is provisioned.";
  } else {
    remoteUpdateStatus = "not_active";
    remoteUpdateMessage = `Instance is ${instance.status}. Model saved and will apply when instance becomes active.`;
  }

  return NextResponse.json({
    id: updated.id,
    model: updated.model,
    remoteUpdate: remoteUpdateStatus,
    message: remoteUpdateMessage,
  });
}
