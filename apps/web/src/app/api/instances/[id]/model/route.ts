import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const VALID_MODELS = [
  "claude-opus-4-20250514",
  "claude-sonnet-4-20250514",
  "claude-3-5-haiku-20241022",
];

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

  // Update instance
  const updated = await prisma.instance.update({
    where: { id },
    data: { model },
  });

  return NextResponse.json({
    id: updated.id,
    model: updated.model,
    message: "Model updated. Changes take effect immediately.",
  });
}
