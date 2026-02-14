/**
 * BlitzClaw Browser Relay - PartyKit Server
 *
 * WebSocket relay that connects:
 * - User's Chrome extension (role: extension)
 * - BlitzClaw VM agent (role: agent)
 *
 * CDP commands flow: Agent -> Relay -> Extension -> Chrome
 * Results flow back: Chrome -> Extension -> Relay -> Agent
 */

import type * as Party from "partykit/server";

type RelayRole = "extension" | "agent";

type ConnectionState = {
  role: RelayRole | null;
  token: string;
  authenticated: boolean;
};

type AuthPayload = {
  type: "auth";
  token?: unknown;
  role?: unknown;
};

type ValidationResponse = {
  valid?: boolean;
  instanceId?: string;
  error?: string;
};

type ValidationResult = {
  ok: boolean;
  error?: string;
};

const DEFAULT_API_BASE_URL = "https://www.blitzclaw.com";

export default class BrowserRelayServer implements Party.Server {
  private readonly connections = new Map<string, ConnectionState>();
  private extensionConn: Party.Connection | null = null;
  private agentConn: Party.Connection | null = null;
  private lastAgentConnectedForExtension = false;
  private lastExtensionConnectedForAgent = false;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    this.log("info", "connection_open", { connId: conn.id });
    this.connections.set(conn.id, {
      role: null,
      token: "",
      authenticated: false,
    });

    this.send(conn, {
      type: "auth_required",
      message: "Authenticate with role + token",
    });
  }

  async onMessage(rawMessage: string, sender: Party.Connection) {
    const connState = this.connections.get(sender.id);
    if (!connState) {
      this.send(sender, { type: "error", error: "Unknown connection" });
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(rawMessage);
    } catch {
      this.send(sender, { type: "error", error: "Invalid message format" });
      return;
    }

    if (!this.isRecord(data) || typeof data.type !== "string") {
      this.send(sender, { type: "error", error: "Invalid message payload" });
      return;
    }

    if (data.type === "auth") {
      await this.handleAuth(sender, connState, data as AuthPayload);
      return;
    }

    if (!connState.authenticated || !connState.role) {
      this.send(sender, { type: "error", error: "Not authenticated" });
      return;
    }

    this.routeMessage(sender, connState.role, data);
  }

  onClose(conn: Party.Connection) {
    const state = this.connections.get(conn.id);
    this.log("info", "connection_close", { connId: conn.id, role: state?.role || "unknown" });

    if (this.extensionConn?.id === conn.id) {
      this.extensionConn = null;
    }
    if (this.agentConn?.id === conn.id) {
      this.agentConn = null;
    }

    this.connections.delete(conn.id);
    this.notifyPeerStatus();
  }

  onError(conn: Party.Connection, error: Error) {
    this.log("error", "connection_error", { connId: conn.id, error: error.message });
  }

  private async handleAuth(conn: Party.Connection, state: ConnectionState, payload: AuthPayload) {
    const token = typeof payload.token === "string" ? payload.token : "";
    const role = payload.role === "extension" || payload.role === "agent" ? payload.role : null;

    if (!token || !role) {
      this.authFailAndClose(conn, "Missing or invalid auth payload");
      return;
    }

    const validation = await this.validateRoleToken(role, token);
    if (!validation.ok) {
      this.authFailAndClose(conn, validation.error || "Auth validation failed");
      return;
    }

    this.replaceExistingRoleConnection(role, conn.id);

    state.role = role;
    state.token = token;
    state.authenticated = true;

    if (role === "extension") {
      this.extensionConn = conn;
    } else {
      this.agentConn = conn;
    }

    this.log("info", "auth_success", { connId: conn.id, role, roomId: this.room.id });
    this.send(conn, {
      type: "auth_success",
      role,
      roomId: this.room.id,
    });
    this.notifyPeerStatus();
  }

  private replaceExistingRoleConnection(role: RelayRole, newConnId: string) {
    const existing = role === "extension" ? this.extensionConn : this.agentConn;
    if (!existing || existing.id === newConnId) {
      return;
    }

    this.log("warn", "auth_replace_existing", { role, oldConnId: existing.id, newConnId });
    this.send(existing, { type: "error", error: `Another ${role} connected; closing this socket` });
    try {
      existing.close(4001, "Superseded by newer connection");
    } catch {
      // Ignore close errors.
    }

    if (role === "extension") {
      this.extensionConn = null;
    } else {
      this.agentConn = null;
    }
  }

  private async validateRoleToken(role: RelayRole, token: string): Promise<ValidationResult> {
    const apiBase = this.getApiBaseUrl();
    const encodedRoomId = encodeURIComponent(this.room.id);
    const validateUrl =
      role === "extension"
        ? `${apiBase}/api/browser-relay?action=validate&token=${encodeURIComponent(token)}&instanceId=${encodedRoomId}`
        : `${apiBase}/api/browser-relay?action=validate-agent&instanceId=${encodedRoomId}`;

    try {
      const response = await fetch(validateUrl, {
        method: "GET",
        headers:
          role === "agent"
            ? {
                "x-instance-secret": token,
              }
            : undefined,
      });

      const body = (await response.json().catch(() => ({}))) as ValidationResponse;
      if (!response.ok || body.valid !== true) {
        const reason = body.error || `Validation failed (${response.status})`;
        this.log("warn", "auth_validation_failed", { role, roomId: this.room.id, reason });
        return { ok: false, error: reason };
      }

      if (body.instanceId !== this.room.id) {
        return { ok: false, error: "Auth validated for wrong relay room" };
      }

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown validation error";
      this.log("error", "auth_validation_request_failed", { role, roomId: this.room.id, error: message });
      return { ok: false, error: "Relay auth validation request failed" };
    }
  }

  private routeMessage(sender: Party.Connection, role: RelayRole, data: Record<string, unknown>) {
    const messageType = typeof data.type === "string" ? data.type : "";
    this.log("debug", "route_message", { connId: sender.id, role, type: messageType });

    if (role === "agent") {
      if (messageType !== "cdp" && messageType !== "pong") {
        this.send(sender, { type: "error", error: `Agent cannot send message type: ${messageType}` });
        return;
      }

      if (!this.extensionConn) {
        this.send(sender, { type: "error", error: "Extension not connected" });
        return;
      }

      this.sendRaw(this.extensionConn, data);
      return;
    }

    if (
      messageType !== "cdp_result" &&
      messageType !== "cdp_error" &&
      messageType !== "cdp_event" &&
      messageType !== "pong"
    ) {
      this.send(sender, { type: "error", error: `Extension cannot send message type: ${messageType}` });
      return;
    }

    if (!this.agentConn) {
      this.log("debug", "drop_extension_message_without_agent", { type: messageType });
      return;
    }

    this.sendRaw(this.agentConn, data);
  }

  private notifyPeerStatus() {
    const extensionConnected =
      !!this.extensionConn && !!this.connections.get(this.extensionConn.id)?.authenticated;
    const agentConnected = !!this.agentConn && !!this.connections.get(this.agentConn.id)?.authenticated;

    if (extensionConnected && this.extensionConn) {
      this.send(this.extensionConn, {
        type: "peer_status",
        agentConnected,
      });

      if (agentConnected !== this.lastAgentConnectedForExtension) {
        this.send(this.extensionConn, {
          type: agentConnected ? "peer_connected" : "peer_disconnected",
          peer: "agent",
        });
      }
    }

    if (agentConnected && this.agentConn) {
      this.send(this.agentConn, {
        type: "peer_status",
        extensionConnected,
      });

      if (extensionConnected !== this.lastExtensionConnectedForAgent) {
        this.send(this.agentConn, {
          type: extensionConnected ? "peer_connected" : "peer_disconnected",
          peer: "extension",
        });
      }
    }

    this.lastAgentConnectedForExtension = extensionConnected ? agentConnected : false;
    this.lastExtensionConnectedForAgent = agentConnected ? extensionConnected : false;
  }

  private authFailAndClose(conn: Party.Connection, error: string) {
    this.log("warn", "auth_error", { connId: conn.id, error });
    this.send(conn, { type: "auth_error", error });
    try {
      conn.close(4003, "Authentication failed");
    } catch {
      // Ignore close errors.
    }
  }

  private getApiBaseUrl(): string {
    const env = (this.room as unknown as { env?: Record<string, unknown> }).env || {};
    const candidate = env.BROWSER_RELAY_API_BASE_URL || env.API_BASE_URL;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.replace(/\/$/, "");
    }
    return DEFAULT_API_BASE_URL;
  }

  private send(conn: Party.Connection, data: Record<string, unknown>) {
    conn.send(JSON.stringify(data));
  }

  private sendRaw(conn: Party.Connection, data: Record<string, unknown>) {
    conn.send(JSON.stringify(data));
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private log(
    level: "debug" | "info" | "warn" | "error",
    event: string,
    meta?: Record<string, unknown>
  ) {
    const payload = meta ? ` ${JSON.stringify(meta)}` : "";
    const line = `[browser-relay][party][${this.room.id}] ${event}${payload}`;
    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    console.log(line);
  }
}
