import { env } from "./env.js";
import { ApiError } from "./errors.js";
import { SERVER_VERSION } from "./version.js";

export const USER_AGENT = `scavio-mcp/${SERVER_VERSION}`;

/**
 * Local npx installs run over stdio; the hosted server (mcp.scavio.dev) runs
 * over HTTP. The API logs this header per call, so the two are told apart.
 */
export const CLIENT_SOURCE = env.TRANSPORT === "http" ? "scavio-mcp-remote" : "scavio-mcp";

export class ScavioClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string) {
    this.baseUrl = env.SCAVIO_API_BASE_URL;
    this.apiKey = apiKey;
  }

  private async request<T>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "User-Agent": USER_AGENT,
        "X-Client-Source": CLIENT_SOURCE,
        ...extraHeaders,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      let message: string;
      let billingUrl: string | undefined;
      let body: Record<string, unknown> | undefined;
      try {
        const json = JSON.parse(text);
        // The Custom Search compatible endpoint answers errors in Google's
        // envelope: { error: { code, message, details } }.
        const env = json?.error && typeof json.error === "object" ? json.error : null;
        message = env ? (env.message ?? text) : (json.error ?? json.message ?? text);
        if (typeof json.billing_url === "string") billingUrl = json.billing_url;
        else if (typeof env?.details?.billing_url === "string") billingUrl = env.details.billing_url;
        if (json && typeof json === "object" && !Array.isArray(json)) body = env?.details ? { ...env.details, message: env.message } : json;
      } catch {
        message = text;
      }
      throw new ApiError(response.status, message, undefined, billingUrl, body);
    }

    return response.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>("POST", path, body, headers);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
