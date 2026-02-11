/**
 * Reconfigure an instance via SSH
 * 
 * Re-runs the SSH configuration to fix broken telegram settings
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@blitzclaw/db";

const DEBUG_KEY = process.env.DIAGNOSTICS_KEY || "blitz-debug-2026";

export async function POST(req: NextRequest) {
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
    include: { user: { select: { email: true, anthropicKey: true } } },
  });

  if (!instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  if (!instance.ipAddress) {
    return NextResponse.json({ error: "Instance has no IP" }, { status: 400 });
  }

  // Extract telegram token from channelConfig
  let telegramBotToken: string | undefined;
  if (instance.channelConfig) {
    try {
      const config = JSON.parse(instance.channelConfig);
      telegramBotToken = config.bot_token;
    } catch (e) {
      return NextResponse.json({ error: "Failed to parse channelConfig" }, { status: 400 });
    }
  }

  if (!telegramBotToken) {
    return NextResponse.json({ error: "No telegram bot token in config" }, { status: 400 });
  }

  const anthropicApiKey = instance.useOwnApiKey && instance.user?.anthropicKey
    ? instance.user.anthropicKey
    : process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    return NextResponse.json({ error: "No Anthropic API key" }, { status: 400 });
  }

  try {
    const { sshExec } = await import("@/lib/ssh");
    
    // First, check current config
    const { stdout: currentConfig } = await sshExec(
      instance.ipAddress,
      "cat /root/.openclaw/openclaw.json | jq '.channels.telegram' 2>&1"
    );
    
    console.log("Current telegram config:", currentConfig);

    // Build the correct telegram config
    const telegramConfig = {
      enabled: true,
      botToken: telegramBotToken,
      dmPolicy: "open",
      allowFrom: ["*"],
    };

    // Use a simpler approach - read, modify with node, write back
    const fixCmd = `
cd /root/.openclaw && \\
cp openclaw.json openclaw.json.backup && \\
node -e '
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("openclaw.json", "utf8"));
config.channels = config.channels || {};
config.channels.telegram = ${JSON.stringify(telegramConfig)};
config.plugins = config.plugins || { entries: {} };
config.plugins.entries.telegram = { enabled: true };
fs.writeFileSync("openclaw.json", JSON.stringify(config, null, 2));
console.log("Updated telegram config");
' && \\
cat openclaw.json | jq '.channels.telegram' && \\
systemctl restart openclaw && \\
sleep 2 && \\
systemctl status openclaw --no-pager | head -10
`;

    const { stdout: fixResult, stderr: fixStderr, code } = await sshExec(
      instance.ipAddress, 
      fixCmd,
      { timeout: 60000 }
    );

    if (code !== 0) {
      return NextResponse.json({
        error: "Fix command failed",
        code,
        stdout: fixResult,
        stderr: fixStderr,
        currentConfig,
      });
    }

    // Verify the fix
    const { stdout: newConfig } = await sshExec(
      instance.ipAddress,
      "cat /root/.openclaw/openclaw.json | jq '.channels.telegram'"
    );

    return NextResponse.json({
      success: true,
      instance: {
        id: instance.id,
        ip: instance.ipAddress,
      },
      before: currentConfig.trim(),
      after: newConfig.trim(),
      fixOutput: fixResult,
    });
  } catch (error) {
    return NextResponse.json({
      error: "SSH error",
      details: (error as Error).message,
    }, { status: 500 });
  }
}
