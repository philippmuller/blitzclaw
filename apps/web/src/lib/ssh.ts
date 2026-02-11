/**
 * SSH utility for remote server management
 * Uses the ssh2 library to execute commands on BlitzClaw instances
 */

import { Client } from "ssh2";

const SSH_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Execute a command on a remote server via SSH
 */
export async function sshExec(
  host: string,
  command: string,
  options?: { timeout?: number }
): Promise<{ stdout: string; stderr: string; code: number }> {
  const privateKey = process.env.BLITZCLAW_SSH_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("BLITZCLAW_SSH_PRIVATE_KEY not configured");
  }

  return new Promise((resolve, reject) => {
    const conn = new Client();
    const timeout = options?.timeout || SSH_TIMEOUT_MS;
    
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    
    const timeoutId = setTimeout(() => {
      timedOut = true;
      conn.end();
      reject(new Error(`SSH command timed out after ${timeout}ms`));
    }, timeout);

    conn.on("ready", () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          conn.end();
          reject(err);
          return;
        }

        stream.on("close", (code: number) => {
          clearTimeout(timeoutId);
          conn.end();
          if (!timedOut) {
            resolve({ stdout, stderr, code: code || 0 });
          }
        });

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });

    conn.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    conn.connect({
      host,
      port: 22,
      username: "root",
      privateKey: privateKey.replace(/\\n/g, "\n"), // Handle escaped newlines from env
      readyTimeout: 10000,
    });
  });
}

/**
 * Sync secrets to a remote server
 * Writes secrets to /root/.openclaw/secrets.env and restarts OpenClaw
 */
export async function syncSecretsToServer(
  ipAddress: string,
  secrets: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Convert secrets to KEY=VALUE format, properly escaping values
    const envContent = Object.entries(secrets)
      .map(([key, value]) => {
        // Escape single quotes by ending the string, adding escaped quote, and continuing
        const escapedValue = value.replace(/'/g, "'\\''");
        return `${key}='${escapedValue}'`;
      })
      .join('\n');

    // Write secrets to file using heredoc for safe multi-line content
    const writeCmd = `cat > /root/.openclaw/secrets.env << 'BLITZCLAW_EOF'
${envContent}
BLITZCLAW_EOF
chmod 600 /root/.openclaw/secrets.env`;

    const { code: writeCode, stderr: writeStderr } = await sshExec(ipAddress, writeCmd);

    if (writeCode !== 0) {
      console.error("Failed to write secrets:", writeStderr);
      return { ok: false, error: `Failed to write secrets: ${writeStderr}` };
    }

    // Restart the OpenClaw service
    const restartCmd = "systemctl restart openclaw";
    const { code: restartCode, stderr: restartStderr } = await sshExec(ipAddress, restartCmd);

    if (restartCode !== 0) {
      console.error("Failed to restart service:", restartStderr);
      return { ok: false, error: `Service restart failed: ${restartStderr}` };
    }

    // Wait a moment and verify the service is running
    await new Promise(resolve => setTimeout(resolve, 2000));

    const checkCmd = "systemctl is-active openclaw";
    const { stdout: checkStdout } = await sshExec(ipAddress, checkCmd);

    if (!checkStdout.trim().includes("active")) {
      return { ok: false, error: "Service not active after restart" };
    }

    return { ok: true };
  } catch (error) {
    console.error("SSH error:", error);
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Configure a pool server with user's instance config
 * Called when assigning a pre-provisioned server to a new instance
 */
export async function configurePoolServer(
  ipAddress: string,
  config: {
    telegramBotToken: string;
    proxySecret: string;
    gatewayToken: string;
    anthropicApiKey: string;
    model: string;
    byokMode: boolean;
    braveApiKey?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const { telegramBotToken, proxySecret, gatewayToken, anthropicApiKey, model, byokMode, braveApiKey } = config;
  
  const modelPrefix = byokMode ? "anthropic" : "blitzclaw";
  const blitzclawApiUrl = "https://www.blitzclaw.com";

  try {
    // Build auth profiles
    const authProfiles = byokMode ? JSON.stringify({
      version: 1,
      profiles: { "anthropic:default": { type: "api_key", provider: "anthropic", key: anthropicApiKey } },
      lastGood: { anthropic: "anthropic:default" }
    }) : JSON.stringify({
      version: 1,
      profiles: { "blitzclaw:default": { type: "api_key", provider: "blitzclaw", key: proxySecret } },
      lastGood: { blitzclaw: "blitzclaw:default" }
    });

    // Update openclaw.json with telegram + model config
    // Using Node.js instead of jq for more reliable JSON handling
    const telegramConfig = JSON.stringify({
      enabled: true,
      botToken: telegramBotToken,
      dmPolicy: "open",
      allowFrom: ["*"],
    });
    
    const modelsConfigObj = byokMode ? {} : {
      providers: {
        blitzclaw: {
          baseUrl: `${blitzclawApiUrl}/api/proxy`,
          api: "anthropic-messages",
          models: [
            { id: "claude-opus-4-6", name: "Claude Opus 4.6", input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 },
            { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 },
            { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", input: ["text", "image"], contextWindow: 200000, maxTokens: 8192 }
          ]
        }
      }
    };

    const configUpdateCmd = `
cd /root/.openclaw && \\
node -e '
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("openclaw.json", "utf8"));

// Update telegram config
config.channels = config.channels || {};
config.channels.telegram = ${telegramConfig};

// Update plugins
config.plugins = config.plugins || { entries: {} };
config.plugins.entries.telegram = { enabled: true };

// Update gateway token
config.gateway = config.gateway || {};
config.gateway.auth = config.gateway.auth || {};
config.gateway.auth.token = "${gatewayToken}";

// Update model
config.agents = config.agents || { defaults: {} };
config.agents.defaults = config.agents.defaults || {};
config.agents.defaults.model = config.agents.defaults.model || {};
config.agents.defaults.model.primary = "${modelPrefix}/${model}";

// Update models config
config.models = ${JSON.stringify(modelsConfigObj)};

fs.writeFileSync("openclaw.json", JSON.stringify(config, null, 2));
console.log("Config updated successfully");
' && \\
chmod 600 /root/.openclaw/openclaw.json
`;

    const { code: configCode, stderr: configStderr, stdout: configStdout } = await sshExec(ipAddress, configUpdateCmd);
    if (configCode !== 0) {
      console.error("Failed to update config:", configStderr, configStdout);
      return { ok: false, error: `Config update failed: ${configStderr || configStdout}` };
    }
    console.log("Config update output:", configStdout);

    // Update auth-profiles.json
    const authCmd = `echo '${authProfiles.replace(/'/g, "'\\''")}' > /root/.openclaw/agents/main/agent/auth-profiles.json && chmod 600 /root/.openclaw/agents/main/agent/auth-profiles.json`;
    
    const { code: authCode, stderr: authStderr } = await sshExec(ipAddress, authCmd);
    if (authCode !== 0) {
      console.error("Failed to update auth profiles:", authStderr);
      return { ok: false, error: `Auth profiles update failed: ${authStderr}` };
    }

    // Update proxy secret
    const secretCmd = `echo "${proxySecret}" > /etc/blitzclaw/proxy_secret && chmod 600 /etc/blitzclaw/proxy_secret`;
    
    const { code: secretCode, stderr: secretStderr } = await sshExec(ipAddress, secretCmd);
    if (secretCode !== 0) {
      console.error("Failed to update proxy secret:", secretStderr);
      return { ok: false, error: `Proxy secret update failed: ${secretStderr}` };
    }

    // Restart OpenClaw
    const restartCmd = "systemctl restart openclaw";
    const { code: restartCode, stderr: restartStderr } = await sshExec(ipAddress, restartCmd);
    if (restartCode !== 0) {
      console.error("Failed to restart service:", restartStderr);
      return { ok: false, error: `Service restart failed: ${restartStderr}` };
    }

    // Wait and verify
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const checkCmd = "systemctl is-active openclaw";
    const { stdout: checkStdout } = await sshExec(ipAddress, checkCmd);
    
    if (!checkStdout.trim().includes("active")) {
      return { ok: false, error: "Service not active after configuration" };
    }

    return { ok: true };
  } catch (error) {
    console.error("SSH configuration error:", error);
    return { ok: false, error: (error as Error).message };
  }
}

/**
 * Update the OpenClaw model on a remote server
 */
export async function updateRemoteModel(
  ipAddress: string,
  model: string,
  useOwnApiKey: boolean
): Promise<{ ok: boolean; error?: string }> {
  const modelPrefix = useOwnApiKey ? "anthropic" : "blitzclaw";
  const fullModel = `${modelPrefix}/${model}`;
  
  try {
    // Update the model in openclaw.json using jq
    const updateCmd = `cat /root/.openclaw/openclaw.json | jq '.agents.defaults.model.primary = "${fullModel}"' > /tmp/oc.json && mv /tmp/oc.json /root/.openclaw/openclaw.json`;
    
    const { code: updateCode, stderr: updateStderr } = await sshExec(ipAddress, updateCmd);
    
    if (updateCode !== 0) {
      console.error("Failed to update config:", updateStderr);
      return { ok: false, error: `Config update failed: ${updateStderr}` };
    }

    // Restart the OpenClaw service
    const restartCmd = "systemctl restart openclaw";
    const { code: restartCode, stderr: restartStderr } = await sshExec(ipAddress, restartCmd);
    
    if (restartCode !== 0) {
      console.error("Failed to restart service:", restartStderr);
      return { ok: false, error: `Service restart failed: ${restartStderr}` };
    }

    // Wait a moment and verify the service is running
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const checkCmd = "systemctl is-active openclaw";
    const { stdout: checkStdout } = await sshExec(ipAddress, checkCmd);
    
    if (!checkStdout.trim().includes("active")) {
      return { ok: false, error: "Service not active after restart" };
    }

    return { ok: true };
  } catch (error) {
    console.error("SSH error:", error);
    return { ok: false, error: (error as Error).message };
  }
}
