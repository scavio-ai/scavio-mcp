import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../lib/env.js";
import { ScavioClient } from "../lib/client.js";
import { AuthCodeStore, PendingSessionStore, ClientStore } from "./stores.js";

type SignedPayload = {
  key: string;
  sid: string;
  exp: number;
};

export function verifySignedToken(token: string): SignedPayload | null {
  const secret = env.MCP_AUTH_SECRET;
  if (!secret) return null;

  const dotIndex = token.indexOf(".");
  if (dotIndex < 0) return null;

  const payloadB64 = token.slice(0, dotIndex);
  const sigB64 = token.slice(dotIndex + 1);

  const expectedSig = createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  const actualSig = Buffer.from(sigB64, "base64url");

  if (expectedSig.length !== actualSig.length || !timingSafeEqual(expectedSig, actualSig)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString()
    ) as SignedPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function verifyApiKey(apiKey: string): Promise<boolean> {
  try {
    const client = new ScavioClient(apiKey);
    await client.get("/api/v1/usage");
    return true;
  } catch {
    return false;
  }
}

export const authCodeStore = new AuthCodeStore();
export const pendingSessionStore = new PendingSessionStore();
export const clientStore = new ClientStore();
