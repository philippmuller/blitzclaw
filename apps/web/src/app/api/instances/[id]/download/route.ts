import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

/**
 * GET /api/instances/[id]/download - Download instance data as tarball
 * 
 * Creates a tarball of /root/.openclaw and streams it to the user.
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
  });

  if (!instance || !instance.ipAddress) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  try {
    const { sshExec } = await import("@/lib/ssh");
    
    // Create tarball of openclaw folder and output to stdout (base64 encoded)
    const { stdout, code } = await sshExec(
      instance.ipAddress,
      "cd /root && tar czf - .openclaw | base64",
      { timeout: 120000 } // 2 min timeout for large folders
    );

    if (code !== 0) {
      return NextResponse.json({ error: "Failed to create backup" }, { status: 500 });
    }

    // Decode base64 and return as file download
    const tarBuffer = Buffer.from(stdout, "base64");
    
    const filename = `openclaw-backup-${instance.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.tar.gz`;

    return new NextResponse(tarBuffer, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": tarBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Download failed:", error);
    return NextResponse.json(
      { error: "Download failed", details: (error as Error).message },
      { status: 500 }
    );
  }
}
