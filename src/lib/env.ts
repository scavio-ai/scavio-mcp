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
});

export const env = envSchema.parse(process.env);
