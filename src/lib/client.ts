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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "User-Agent": USER_AGENT,
        "X-Client-Source": CLIENT_SOURCE,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const text = await response.text();
      let message: string;
      let billingUrl: string | undefined;
      try {
        const json = JSON.parse(text);
        message = json.error ?? json.message ?? text;
        if (typeof json.billing_url === "string") billingUrl = json.billing_url;
      } catch {
        message = text;
      }
      throw new ApiError(response.status, message, undefined, billingUrl);
    }

    return response.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }
}
