import { Hono } from "hono";
import { cors } from "hono/cors";
import { createHash } from "node:crypto";
import { env } from "../lib/env.js";
import {
  authCodeStore,
  pendingSessionStore,
  clientStore,
  verifySignedToken,
} from "./provider.js";

export const authApp = new Hono();

// --- OAuth Metadata ---

const buildOAuthMetadata = () => ({
  issuer: env.ISSUER_URL,
  authorization_endpoint: `${env.ISSUER_URL}/authorize`,
  token_endpoint: `${env.ISSUER_URL}/token`,
  registration_endpoint: `${env.ISSUER_URL}/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  client_id_metadata_document_supported: true,
});

const buildResourceMetadata = () => ({
  resource: `${env.ISSUER_URL}/mcp`,
  authorization_servers: [env.ISSUER_URL],
  resource_name: "Scavio MCP Server",
  resource_documentation: "https://scavio.dev/docs/mcp",
});

authApp.get(
  "/.well-known/oauth-authorization-server",
  cors({ origin: "*" }),
  (c) => c.json(buildOAuthMetadata())
);

authApp.get(
  "/.well-known/oauth-protected-resource/mcp",
  cors({ origin: "*" }),
  (c) => c.json(buildResourceMetadata())
);

// --- Dynamic Client Registration (RFC 7591) ---

authApp.post("/register", cors({ origin: "*" }), async (c) => {
  const body = await c.req.json();
  if (!body.redirect_uris || !Array.isArray(body.redirect_uris)) {
    return c.json({ error: "invalid_client_metadata", error_description: "redirect_uris required" }, 400);
  }
  const client = await clientStore.registerClient(body);
  return c.json(client, 201);
});

// --- Authorization Endpoint ---

authApp.all("/authorize", async (c) => {
  if (!env.MCP_AUTH_SECRET) {
    return c.json({ error: "server_error", error_description: "OAuth not configured" }, 500);
  }

  const params = c.req.method === "GET" ? c.req.query() : await c.req.parseBody();
  const clientId = params.client_id as string;
  const redirectUri = params.redirect_uri as string | undefined;
  const responseType = params.response_type as string;
  const codeChallenge = params.code_challenge as string;
  const codeChallengeMethod = params.code_challenge_method as string;
  const state = params.state as string | undefined;
  const scope = params.scope as string | undefined;

  // Validate client
  if (!clientId) {
    return c.json({ error: "invalid_request", error_description: "client_id required" }, 400);
  }

  const client = await clientStore.getClient(clientId);
  if (!client) {
    return c.json({ error: "invalid_client", error_description: "Unknown client_id" }, 400);
  }

  // Resolve redirect_uri
  let resolvedRedirect = redirectUri;
  if (!resolvedRedirect) {
    if (client.redirect_uris.length === 1) {
      resolvedRedirect = client.redirect_uris[0].toString();
    } else {
      return c.json({ error: "invalid_request", error_description: "redirect_uri required" }, 400);
    }
  }

  // Validate remaining params (errors redirect to client)
  const errorRedirect = (error: string, desc: string) => {
    const url = new URL(resolvedRedirect!);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", desc);
    if (state) url.searchParams.set("state", state);
    return c.redirect(url.toString(), 302);
  };

  if (responseType !== "code") return errorRedirect("unsupported_response_type", "Only 'code' supported");
  if (!codeChallenge) return errorRedirect("invalid_request", "code_challenge required");
  if (codeChallengeMethod !== "S256") return errorRedirect("invalid_request", "Only S256 supported");

  // Store pending session, redirect to dashboard consent page
  const sessionId = pendingSessionStore.create({
    clientId,
    redirectUri: resolvedRedirect,
    state,
    codeChallenge,
    scopes: scope ? scope.split(" ") : [],
  });

  const callbackUrl = `${env.ISSUER_URL}/oauth/callback`;
  const dashboardUrl = new URL(`${env.DASHBOARD_URL}/mcp/authorize`);
  dashboardUrl.searchParams.set("session", sessionId);
  dashboardUrl.searchParams.set("callback", callbackUrl);

  return c.redirect(dashboardUrl.toString(), 302);
});

// --- OAuth Callback (from dashboard consent page) ---

authApp.get("/oauth/callback", async (c) => {
  const token = c.req.query("token");
  const sessionId = c.req.query("session");
  const error = c.req.query("error");

  if (!sessionId) {
    return c.json({ error: "invalid_request", error_description: "Missing session" }, 400);
  }

  const session = pendingSessionStore.consume(sessionId);
  if (!session) {
    return c.json({ error: "invalid_request", error_description: "Invalid or expired session" }, 400);
  }

  const errorRedirect = (errCode: string, desc: string) => {
    const url = new URL(session.redirectUri);
    url.searchParams.set("error", errCode);
    url.searchParams.set("error_description", desc);
    if (session.state) url.searchParams.set("state", session.state);
    return c.redirect(url.toString(), 302);
  };

  // User denied
  if (error === "access_denied") {
    return errorRedirect("access_denied", "User denied authorization");
  }

  if (!token) {
    return errorRedirect("server_error", "Missing token");
  }

  // Verify the signed token from the backend
  const payload = verifySignedToken(token);
  if (!payload) {
    return errorRedirect("server_error", "Invalid or expired token");
  }

  if (payload.sid !== sessionId) {
    return errorRedirect("server_error", "Session mismatch");
  }

  // Generate auth code
  const code = authCodeStore.generate({
    apiKey: payload.key,
    codeChallenge: session.codeChallenge,
    redirectUri: session.redirectUri,
    clientId: session.clientId,
  });

  const redirectUrl = new URL(session.redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (session.state) redirectUrl.searchParams.set("state", session.state);

  return c.redirect(redirectUrl.toString(), 302);
});

// --- Token Endpoint ---

authApp.post("/token", cors({ origin: "*" }), async (c) => {
  const body = await c.req.parseBody();
  const grantType = body.grant_type as string;
  const code = body.code as string;
  const codeVerifier = body.code_verifier as string;
  const clientId = body.client_id as string;
  const redirectUri = body.redirect_uri as string | undefined;

  if (grantType !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  if (!code || !codeVerifier || !clientId) {
    return c.json({ error: "invalid_request", error_description: "code, code_verifier, client_id required" }, 400);
  }

  // Validate client
  const client = await clientStore.getClient(clientId);
  if (!client) {
    return c.json({ error: "invalid_client" }, 401);
  }

  // Consume the auth code
  const codeData = authCodeStore.consume(code);
  if (!codeData) {
    return c.json({ error: "invalid_grant", error_description: "Invalid or expired code" }, 400);
  }

  if (codeData.clientId !== clientId) {
    return c.json({ error: "invalid_grant", error_description: "Client mismatch" }, 400);
  }

  if (redirectUri && codeData.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  }

  // PKCE: verify S256
  const expectedChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  if (expectedChallenge !== codeData.codeChallenge) {
    return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
  }

  // Issue the access token (the user's actual API key)
  return c.json({
    access_token: codeData.apiKey,
    token_type: "Bearer",
  });
});
