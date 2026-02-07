import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";
import { deploySoulMd } from "@/lib/instance-config";

/**
 * GET /api/instances/[id]/soul
 * 
 * Get the current SOUL.md content for an instance.
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
  
  // Find the instance and verify ownership
  const instance = await prisma.instance.findFirst({
    where: {
      id,
      userId: user.id,
    },
    select: {
      id: true,
      soulMd: true,
      personaTemplate: true,
      status: true,
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  return NextResponse.json({
    soul_md: instance.soulMd || "",
    persona_template: instance.personaTemplate,
    has_custom_soul: !!instance.soulMd,
    instance_status: instance.status,
  });
}

/**
 * POST /api/instances/[id]/soul
 * 
 * Update the SOUL.md content for an instance.
 */
export async function POST(
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
  
  // Parse request body
  let body: { soul_md?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { soul_md } = body;
  
  if (soul_md === undefined) {
    return NextResponse.json(
      { error: "soul_md is required" },
      { status: 400 }
    );
  }

  // Validate soul_md length (max 100KB)
  if (typeof soul_md !== "string") {
    return NextResponse.json(
      { error: "soul_md must be a string" },
      { status: 400 }
    );
  }
  
  if (soul_md.length > 100 * 1024) {
    return NextResponse.json(
      { error: "soul_md is too large (max 100KB)" },
      { status: 400 }
    );
  }

  // Find the instance and verify ownership
  const instance = await prisma.instance.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  // Update the instance
  await prisma.instance.update({
    where: { id },
    data: {
      soulMd: soul_md || null,
      personaTemplate: soul_md ? "custom" : instance.personaTemplate,
    },
  });

  // Deploy to instance if it's active
  let deploymentResult = { success: false, message: "Instance not active" };
  if (instance.status === "ACTIVE" && instance.ipAddress) {
    deploymentResult = await deploySoulMd(instance.ipAddress, soul_md);
  }

  return NextResponse.json({
    success: true,
    message: "SOUL.md updated",
    soul_md_length: soul_md.length,
    deployment: deploymentResult,
  });
}
