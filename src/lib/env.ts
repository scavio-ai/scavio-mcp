import { z } from "zod";

const envSchema = z.object({
  SCAVIO_API_BASE_URL: z.string().url()
    .default("https://api.scavio.dev"),
  SCAVIO_API_KEY: z.string().optional(),
  // Comma-separated allowlist of platform keys to register (see src/tools/index.ts).
  // Unset = the curated default set. "all" = every platform. Left as a free-form
  // string on purpose: an unknown key is warned about and skipped, never fatal.
  SCAVIO_PLATFORMS: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535)
    .default(3000),
  TRANSPORT: z.enum(["http", "stdio"])
    .default("stdio"),
  // OAuth
  MCP_AUTH_SECRET: z.string().min(32).optional(),
  ISSUER_URL: z.string().url().default("https://mcp.scavio.dev"),
  DASHBOARD_URL: z.string().url().default("https://dashboard.scavio.dev"),
  // Domain-verification token from the OpenAI plugin submission portal, served
  // verbatim at /.well-known/openai-apps-challenge. Unset = that path 404s.
  // Deploy always writes this line; an unset GitHub secret arrives as "".
  OPENAI_APPS_CHALLENGE: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
});

export const env = envSchema.parse(process.env);
