import type * as Party from "partykit/server";

type ClientRole = "extension" | "vm";

type AuthMessage = {
  type: "auth";
  token: string;
  role?: ClientRole;
  client?: ClientRole;
};

type RelayMessage = {
  type: "cdp" | "cdp_result" | "cdp_event" | "cdp_error" | "ping" | "pong";
  [key: string]: unknown;
};

type ConnectionMeta = {
  role: ClientRole;
  instanceId: string;
};

type ValidateResponse = {
  valid: boolean;
  instanceId?: string;
  error?: string;
};

export default class BrowserRelayServer implements Party.Server {
  private connections = new Map<string, ConnectionMeta>();

  constructor(readonly room: Party.Room) {}

  onConnect(connection: Party.Connection) {
    connection.send(
      JSON.stringify({
        type: "ping",
        message: "auth_required",
      })
    );
  }

  async onMessage(message: string | ArrayBuffer, connection: Party.Connection) {
    const data = this.parseMessage(message);
    if (!data) {
      return;
    }

    if (data.type === "auth") {
      await this.handleAuth(data, connection);
      return;
    }

    const meta = this.connections.get(connection.id);
    if (!meta) {
      connection.send(
        JSON.stringify({
          type: "auth_error",
          error: "Not authenticated",
        })
      );
      connection.close();
      return;
    }

    switch (data.type) {
      case "cdp":
        this.forwardToRole("extension", data, connection.id);
        break;
      case "cdp_result":
      case "cdp_event":
      case "cdp_error":
        this.forwardToRole("vm", data, connection.id);
        break;
      case "ping":
        connection.send(JSON.stringify({ type: "pong" }));
        break;
      default:
        connection.send(
          JSON.stringify({
            type: "error",
            error: "Unknown message type",
          })
        );
        break;
    }
  }

  onClose(connection: Party.Connection) {
    this.connections.delete(connection.id);
  }

  private parseMessage(message: string | ArrayBuffer): (AuthMessage | RelayMessage) | null {
    try {
      const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  private async handleAuth(message: AuthMessage, connection: Party.Connection) {
    if (!message.token) {
      connection.send(
        JSON.stringify({
          type: "auth_error",
          error: "Missing token",
        })
      );
      connection.close();
      return;
    }

    const role = message.role || message.client || "extension";
    const validation = await this.validateToken(message.token);

    if (!validation.valid || !validation.instanceId) {
      connection.send(
        JSON.stringify({
          type: "auth_error",
          error: validation.error || "Invalid token",
        })
      );
      connection.close();
      return;
    }

    if (this.room.id !== validation.instanceId) {
      connection.send(
        JSON.stringify({
          type: "auth_error",
          error: "Invalid room for token",
        })
      );
      connection.close();
      return;
    }

    this.connections.set(connection.id, {
      role,
      instanceId: validation.instanceId,
    });

    connection.send(
      JSON.stringify({
        type: "auth_success",
        instanceId: validation.instanceId,
      })
    );
  }

  private async validateToken(token: string): Promise<ValidateResponse> {
    const apiBase = "https://www.blitzclaw.com";
    const url = `${apiBase}/api/browser-relay?action=validate&token=${encodeURIComponent(token)}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { valid: false, error: `Validation failed (${response.status})` };
      }

      const data = (await response.json()) as ValidateResponse;
      if (!data.valid) {
        return { valid: false, error: data.error || "Invalid token" };
      }

      return { valid: true, instanceId: data.instanceId };
    } catch (error) {
      return { valid: false, error: "Validation request failed" };
    }
  }

  private forwardToRole(role: ClientRole, payload: RelayMessage, senderId: string) {
    const message = JSON.stringify(payload);
    for (const connection of this.room.getConnections()) {
      if (connection.id === senderId) continue;
      const meta = this.connections.get(connection.id);
      if (meta?.role === role) {
        connection.send(message);
      }
    }
  }
}
