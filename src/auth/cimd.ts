import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

export async function fetchClientMetadata(
  clientIdUrl: string
): Promise<OAuthClientInformationFull | null> {
  try {
    const res = await fetch(clientIdUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const meta = await res.json();
    if (!meta.client_id || !Array.isArray(meta.redirect_uris)) return null;
    return meta as OAuthClientInformationFull;
  } catch {
    return null;
  }
}
