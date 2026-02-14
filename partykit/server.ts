/**
 * BlitzClaw Browser Relay - PartyKit Server
 * 
 * WebSocket relay that connects:
 * - User's Chrome extension (role: extension)
 * - BlitzClaw VM agent (role: agent)
 * 
 * CDP commands flow: Agent → Relay → Extension → Chrome
 * Results flow back: Chrome → Extension → Relay → Agent
 */

import type * as Party from "partykit/server";

interface Connection {
  role: "extension" | "agent";
  token: string;
  authenticated: boolean;
}

export default class BrowserRelayServer implements Party.Server {
  connections = new Map<string, Connection>();
  extensionConn: Party.Connection | null = null;
  agentConn: Party.Connection | null = null;

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    console.log(`[${this.room.id}] Connection opened: ${conn.id}`);
    
    // Initialize connection state
    this.connections.set(conn.id, {
      role: "extension", // Will be set on auth
      token: "",
      authenticated: false,
    });

    // Request authentication
    conn.send(JSON.stringify({
      type: "auth_required",
      message: "Please authenticate with your token"
    }));
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);
      const connState = this.connections.get(sender.id);

      if (!connState) {
        sender.send(JSON.stringify({ type: "error", error: "Unknown connection" }));
        return;
      }

      // Handle authentication
      if (data.type === "auth") {
        this.handleAuth(sender, connState, data);
        return;
      }

      // Require authentication for all other messages
      if (!connState.authenticated) {
        sender.send(JSON.stringify({ 
          type: "error", 
          error: "Not authenticated" 
        }));
        return;
      }

      // Route messages between extension and agent
      this.routeMessage(sender, connState, data);

    } catch (e) {
      console.error(`[${this.room.id}] Parse error:`, e);
      sender.send(JSON.stringify({ type: "error", error: "Invalid message format" }));
    }
  }

  handleAuth(conn: Party.Connection, state: Connection, data: any) {
    const { token, role } = data;

    if (!token || !role) {
      conn.send(JSON.stringify({ 
        type: "auth_error", 
        error: "Missing token or role" 
      }));
      return;
    }

    if (role !== "extension" && role !== "agent") {
      conn.send(JSON.stringify({ 
        type: "auth_error", 
        error: "Invalid role" 
      }));
      return;
    }

    // For MVP: Accept any token that starts with "brc_" for extensions
    // and any token for agents (they have instance secret)
    // Production: Validate against BlitzClaw API
    if (role === "extension" && !token.startsWith("brc_")) {
      conn.send(JSON.stringify({ 
        type: "auth_error", 
        error: "Invalid extension token format" 
      }));
      return;
    }

    // Update connection state
    state.role = role;
    state.token = token;
    state.authenticated = true;

    // Track role-specific connections
    if (role === "extension") {
      this.extensionConn = conn;
    } else if (role === "agent") {
      this.agentConn = conn;
    }

    console.log(`[${this.room.id}] Authenticated: ${role} (${conn.id})`);

    conn.send(JSON.stringify({ 
      type: "auth_success",
      role,
      roomId: this.room.id
    }));

    // Notify the other party if both are connected
    this.notifyPeerStatus();
  }

  routeMessage(sender: Party.Connection, state: Connection, data: any) {
    // Route based on message type and sender role
    if (state.role === "agent") {
      // Agent sending to extension
      if (this.extensionConn) {
        this.extensionConn.send(JSON.stringify(data));
      } else {
        sender.send(JSON.stringify({
          type: "error",
          error: "Extension not connected"
        }));
      }
    } else if (state.role === "extension") {
      // Extension sending to agent
      if (this.agentConn) {
        this.agentConn.send(JSON.stringify(data));
      } else {
        // Buffer or drop - for now just log
        console.log(`[${this.room.id}] No agent connected, dropping message`);
      }
    }
  }

  notifyPeerStatus() {
    if (this.extensionConn && this.connections.get(this.extensionConn.id)?.authenticated) {
      this.extensionConn.send(JSON.stringify({
        type: "peer_status",
        agentConnected: !!this.agentConn && !!this.connections.get(this.agentConn.id)?.authenticated
      }));
    }

    if (this.agentConn && this.connections.get(this.agentConn.id)?.authenticated) {
      this.agentConn.send(JSON.stringify({
        type: "peer_status",
        extensionConnected: !!this.extensionConn && !!this.connections.get(this.extensionConn.id)?.authenticated
      }));
    }
  }

  onClose(conn: Party.Connection) {
    const state = this.connections.get(conn.id);
    console.log(`[${this.room.id}] Connection closed: ${conn.id} (${state?.role || "unknown"})`);

    if (state?.role === "extension" && this.extensionConn?.id === conn.id) {
      this.extensionConn = null;
    } else if (state?.role === "agent" && this.agentConn?.id === conn.id) {
      this.agentConn = null;
    }

    this.connections.delete(conn.id);
    this.notifyPeerStatus();
  }

  onError(conn: Party.Connection, error: Error) {
    console.error(`[${this.room.id}] Connection error (${conn.id}):`, error);
  }
}
