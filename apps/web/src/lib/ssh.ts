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
