/**
 * OpenClaw instance configuration generation and deployment
 * 
 * Generates config.yaml files for OpenClaw instances and provides
 * stubs for SSH deployment (to be implemented with real SSH later).
 */

import { Instance } from "@prisma/client";
import { parseTelegramConfig } from "./telegram";

export interface OpenClawConfig {
  model: string;
  apiEndpoint: string;
  telegram?: {
    botToken: string;
  };
  // Future: whatsapp, discord, etc.
}

/**
 * Default model for new instances
 */
const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

/**
 * Token proxy endpoint
 */
const PROXY_ENDPOINT = process.env.BLITZCLAW_PROXY_URL || "https://proxy.blitzclaw.com/v1";

/**
 * Generate OpenClaw config.yaml content for an instance
 */
export function generateConfigYaml(instance: Instance, proxySecret: string): string {
  const lines: string[] = [];
  
  // OpenClaw configuration header
  lines.push("# BlitzClaw-managed OpenClaw configuration");
  lines.push("# Do not edit manually - changes will be overwritten");
  lines.push("");
  
  // Model configuration
  const model = instance.useOwnApiKey ? DEFAULT_MODEL : DEFAULT_MODEL;
  lines.push(`model: ${model}`);
  lines.push("");
  
  // API endpoint (proxy or direct)
  if (!instance.useOwnApiKey) {
    lines.push("# Token proxy (usage-based billing)");
    lines.push(`apiEndpoint: ${PROXY_ENDPOINT}`);
    lines.push("");
    lines.push("# Proxy authentication");
    lines.push("apiHeaders:");
    lines.push(`  X-BlitzClaw-Instance: ${instance.id}`);
    lines.push(`  X-BlitzClaw-Secret: ${proxySecret}`);
  } else {
    lines.push("# Using user's own API key");
    lines.push("# apiEndpoint: default (direct to Anthropic)");
  }
  lines.push("");
  
  // Channel configuration
  if (instance.channelType === "TELEGRAM") {
    const telegramConfig = parseTelegramConfig(instance.channelConfig);
    if (telegramConfig?.bot_token) {
      lines.push("# Telegram channel");
      lines.push("telegram:");
      lines.push(`  botToken: ${telegramConfig.bot_token}`);
      lines.push("");
    }
  }
  
  // WhatsApp would go here in future
  // if (instance.channelType === "WHATSAPP") { ... }
  
  return lines.join("\n");
}

/**
 * Generate SOUL.md content for an instance
 */
export function generateSoulMd(instance: Instance): string {
  // If custom soul_md is set, use it
  if (instance.soulMd) {
    return instance.soulMd;
  }
  
  // Otherwise use persona template
  return getPersonaTemplate(instance.personaTemplate);
}

/**
 * Get persona template content
 */
function getPersonaTemplate(template: string): string {
  const templates: Record<string, string> = {
    assistant: `# SOUL.md

You are a personal assistant. Helpful, proactive, concise.

You help with:
- Daily planning and reminders
- Quick research and answers
- Writing and editing
- General productivity

Be warm but efficient. Respect the user's time.
`,
    developer: `# SOUL.md

You are a technical assistant for developers.

You help with:
- Code review and suggestions
- Debugging and problem-solving
- Documentation
- Git workflows

Be precise and technical. Show code examples when relevant.
`,
    creative: `# SOUL.md

You are a creative collaborator.

You help with:
- Brainstorming and ideation
- Writing and storytelling
- Content planning
- Feedback and editing

Be imaginative but grounded. Push ideas forward.
`,
    custom: `# SOUL.md

Write your custom personality and instructions here.
`,
  };
  
  return templates[template] || templates.assistant;
}

/**
 * Full instance configuration bundle
 */
export interface InstanceConfigBundle {
  configYaml: string;
  soulMd: string;
  instanceId: string;
  ipAddress: string;
}

/**
 * Generate full configuration bundle for an instance
 */
export function generateConfigBundle(
  instance: Instance,
  proxySecret: string
): InstanceConfigBundle {
  return {
    configYaml: generateConfigYaml(instance, proxySecret),
    soulMd: generateSoulMd(instance),
    instanceId: instance.id,
    ipAddress: instance.ipAddress || "",
  };
}

/**
 * Deploy configuration to an instance via SSH
 * 
 * STUB: This is a placeholder for real SSH deployment.
 * In production, this will:
 * 1. Connect to instance via SSH
 * 2. Write config.yaml to /root/.openclaw/config.yaml
 * 3. Write SOUL.md to /root/.openclaw/workspace/SOUL.md
 * 4. Restart OpenClaw gateway
 */
export async function deployConfig(bundle: InstanceConfigBundle): Promise<{
  success: boolean;
  message: string;
}> {
  // STUB: Real SSH deployment to be implemented
  // For now, simulate a successful deployment
  
  if (!bundle.ipAddress) {
    return {
      success: false,
      message: "Instance has no IP address - still provisioning?",
    };
  }
  
  console.log(`[STUB] Would deploy config to ${bundle.ipAddress}:`);
  console.log(`  - config.yaml: ${bundle.configYaml.length} bytes`);
  console.log(`  - SOUL.md: ${bundle.soulMd.length} bytes`);
  
  // In production:
  // const ssh = new SSH2Client();
  // await ssh.connect({ host: bundle.ipAddress, ... });
  // await ssh.exec(`mkdir -p /root/.openclaw/workspace`);
  // await ssh.writeFile('/root/.openclaw/config.yaml', bundle.configYaml);
  // await ssh.writeFile('/root/.openclaw/workspace/SOUL.md', bundle.soulMd);
  // await ssh.exec('openclaw gateway restart');
  
  return {
    success: true,
    message: `Configuration ready for deployment to ${bundle.ipAddress}`,
  };
}

/**
 * Deploy just the SOUL.md to an instance
 * 
 * STUB: Placeholder for real SSH deployment
 */
export async function deploySoulMd(
  ipAddress: string,
  soulMd: string
): Promise<{ success: boolean; message: string }> {
  if (!ipAddress) {
    return {
      success: false,
      message: "Instance has no IP address",
    };
  }
  
  console.log(`[STUB] Would deploy SOUL.md to ${ipAddress}: ${soulMd.length} bytes`);
  
  // In production:
  // await ssh.writeFile('/root/.openclaw/workspace/SOUL.md', soulMd);
  // await ssh.exec('openclaw gateway restart');
  
  return {
    success: true,
    message: `SOUL.md ready for deployment to ${ipAddress}`,
  };
}

/**
 * Generate a unique proxy secret for an instance
 */
export function generateProxySecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
}
