import { z } from "zod";

const envSchema = z.object({
  SCAVIO_API_BASE_URL: z.string().url()
    .default("https://api.scavio.dev"),
  SCAVIO_API_KEY: z.string().optional(),
  PORT: z.coerce.number().int().min(1).max(65535)
    .default(3000),
  TRANSPORT: z.enum(["http", "stdio"])
    .default("stdio"),
});

export const env = envSchema.parse(process.env);
