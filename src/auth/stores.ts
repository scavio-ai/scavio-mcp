import { randomBytes } from "node:crypto";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { fetchClientMetadata } from "./cimd.js";

type AuthCodeData = {
  apiKey: string;
  codeChallenge: string;
  redirectUri: string;
  clientId: string;
  expiresAt: number;
};

type PendingSession = {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
  scopes: string[];
  expiresAt: number;
};

const AUTH_CODE_TTL = 5 * 60 * 1000;      // 5 min
const SESSION_TTL = 10 * 60 * 1000;       // 10 min
const CLIENT_CACHE_TTL = 60 * 60 * 1000;  // 1 hour

export class AuthCodeStore {
  private codes = new Map<string, AuthCodeData>();

  generate(data: Omit<AuthCodeData, "expiresAt">): string {
    const code = randomBytes(32).toString("hex");
    this.codes.set(code, { ...data, expiresAt: Date.now() + AUTH_CODE_TTL });
    return code;
  }

  consume(code: string): AuthCodeData | null {
    const data = this.codes.get(code);
    if (!data) return null;
    this.codes.delete(code);
    if (data.expiresAt < Date.now()) return null;
    return data;
  }
}

export class PendingSessionStore {
  private sessions = new Map<string, PendingSession>();

  create(data: Omit<PendingSession, "expiresAt">): string {
    const id = randomBytes(24).toString("hex");
    this.sessions.set(id, { ...data, expiresAt: Date.now() + SESSION_TTL });
    return id;
  }

  consume(id: string): PendingSession | null {
    const data = this.sessions.get(id);
    if (!data) return null;
    this.sessions.delete(id);
    if (data.expiresAt < Date.now()) return null;
    return data;
  }
}

export class ClientStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, { client: OAuthClientInformationFull; cachedAt: number }>();

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    // Check cache first
    const cached = this.clients.get(clientId);
    if (cached && cached.cachedAt + CLIENT_CACHE_TTL > Date.now()) {
      return cached.client;
    }

    // CIMD: if client_id is a URL, fetch metadata from it
    if (clientId.startsWith("https://")) {
      const meta = await fetchClientMetadata(clientId);
      if (meta) {
        this.clients.set(clientId, { client: meta, cachedAt: Date.now() });
        return meta;
      }
    }

    return cached?.client;
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">
  ): Promise<OAuthClientInformationFull> {
    const clientId = `scavio_${randomBytes(16).toString("hex")}`;
    const full: OAuthClientInformationFull = {
      ...client,
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    this.clients.set(clientId, { client: full, cachedAt: Date.now() });
    return full;
  }
}
