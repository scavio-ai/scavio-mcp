import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { shapeResponse, trimResponse } from "../lib/trim-response.js";
import {
  CRAWL_DEFAULT_WAIT_SECONDS,
  MAX_WAIT_SECONDS,
  MCP_DEFAULT_CONTENT_CHARS,
  MCP_MAP_DEFAULT_LIMIT,
  MCP_RESULTS_DEFAULT_LIMIT,
  POLL_INTERVAL_MS,
  TERMINAL_STATUSES,
  shapeJobStatus,
  shapeMap,
} from "../lib/web-jobs.js";

// Schemas mirror backend/src/routes/extract-web.ts field for field: same names,
// enums, ranges and optionality, and no .default() -- an omitted field is
// omitted on the wire and the API's own default applies. The MCP-only knobs
// (wait_seconds, max_content_chars) are stripped before the request.

const MAX_GLOBS = 50;
const MAX_GLOB_LENGTH = 200;

const PRICING = "Per successful page: normal 1cr, advanced 1cr, ultra 2cr; failed/skipped pages free. Obeys robots.txt.";

const mode = z.enum(["normal", "advanced", "ultra"]).optional()
  .describe("PRICE-BEARING. 'normal'=1cr (default), 'advanced'=renders JavaScript 1cr, 'ultra'=hardest pages 2cr.");
const format = z.enum(["html", "markdown", "text"]).optional()
  .describe("Page format: 'markdown' (default), 'text', or 'html'.");
const globs = (what: string) => z.array(z.string().max(MAX_GLOB_LENGTH)).max(MAX_GLOBS).optional()
  .describe(`Path globs to ${what} (* one segment, ** any depth), e.g. ["/blog/**"].`);
const webhookUrl = z.string().max(2048).optional()
  .describe("Optional https URL that gets a signed POST when the job ends; secret returned once as webhook_secret.");
const idempotencyKey = z.string().max(255).optional()
  .describe("Optional; the same key within 24h returns the original job.");
const jobId = z.string().min(1).max(64).describe("Job id from the start call.");
const statusQuery = {
  cursor: z.string().max(20).optional().describe("next_cursor from the previous call."),
  limit: z.number().int().min(1).max(100).optional()
    .describe(`Results per call (default ${MCP_RESULTS_DEFAULT_LIMIT} here).`),
  status: z.enum(["succeeded", "failed", "skipped"]).optional().describe("Only results with this status."),
  include_content: z.boolean().optional().describe("false = results without content. Default true."),
  max_content_chars: z.number().int().min(200).max(200000).optional()
    .describe(`Clip each page's content to this many chars (default ${MCP_DEFAULT_CONTENT_CHARS}).`),
};
const waitSeconds = (dflt: number) => z.number().int().min(0).max(MAX_WAIT_SECONDS).optional()
  .describe(`Seconds to wait for the job to finish (default ${dflt}).`);

type Query = { cursor?: string; limit?: number; status?: string; include_content?: boolean };

function statusPath(type: "crawl" | "batch", id: string, q: Query): string {
  const p = new URLSearchParams();
  if (q.cursor !== undefined) p.set("cursor", q.cursor);
  p.set("limit", String(q.limit ?? MCP_RESULTS_DEFAULT_LIMIT));
  if (q.status !== undefined) p.set("status", q.status);
  if (q.include_content !== undefined) p.set("include_content", String(q.include_content));
  return `/api/v1/extract/${type}/${encodeURIComponent(id)}?${p.toString()}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Progress = { status?: string; pages?: unknown; credits_used?: number };

/** Poll (content-free) until the job is terminal or the wait runs out. */
async function waitFor(client: ScavioClient, type: "crawl" | "batch", id: string, seconds: number): Promise<{ done: boolean; progress: Progress }> {
  const deadline = Date.now() + seconds * 1000;
  for (;;) {
    const s = await client.get<{ data?: Progress }>(statusPath(type, id, { limit: 1, include_content: false }));
    const progress: Progress = { status: s.data?.status, pages: s.data?.pages, credits_used: s.data?.credits_used };
    if (TERMINAL_STATUSES.has(progress.status ?? "")) return { done: true, progress };
    const left = deadline - Date.now();
    if (left <= 0) return { done: false, progress };
    await sleep(Math.min(POLL_INTERVAL_MS, left));
  }
}

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
}

function strip<T extends Record<string, unknown>>(params: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) if (!keys.includes(k) && v !== undefined) out[k] = v;
  return out;
}

/**
 * Start a crawl/batch, then wait up to wait_seconds. Finished in time: the
 * first page of results. Still running: the job as created (id, status_url,
 * webhook_secret, which is shown only once) plus a hint to poll.
 */
async function startJob(
  client: ScavioClient,
  type: "crawl" | "batch",
  params: Record<string, unknown>,
  defaultWait: number,
) {
  const { wait_seconds, max_content_chars, idempotency_key } = params as {
    wait_seconds?: number; max_content_chars?: number; idempotency_key?: string;
  };
  const body = strip(params, ["wait_seconds", "max_content_chars", "idempotency_key"]);
  const headers = idempotency_key ? { "Idempotency-Key": idempotency_key } : undefined;
  const created = await client.post<{ data: { id: string; webhook_secret?: string } }>(`/api/v1/extract/${type}`, body, headers);
  const id = created.data.id;
  const wait = wait_seconds ?? defaultWait;
  const waited = wait > 0 ? await waitFor(client, type, id, wait) : null;
  if (waited?.done) {
    const status = await client.get(statusPath(type, id, {}));
    const shaped = shapeJobStatus(status, { type, maxContentChars: max_content_chars }) as Record<string, unknown>;
    return text(created.data.webhook_secret ? { ...shaped, webhook_secret: created.data.webhook_secret } : shaped);
  }
  return text({
    ...(shapeResponse(created) as Record<string, unknown>),
    ...(waited ? { progress: shapeResponse(waited.progress) } : {}),
    _hint: `Job ${id} is still running. Call get_${type}_status with id="${id}" (add wait_seconds up to ${MAX_WAIT_SECONDS} to wait) for progress and results.`,
  });
}

async function jobStatus(client: ScavioClient, type: "crawl" | "batch", params: Record<string, unknown>) {
  const { id, wait_seconds, max_content_chars, ...q } = params as Query & {
    id: string; wait_seconds?: number; max_content_chars?: number;
  };
  if (wait_seconds && wait_seconds > 0) await waitFor(client, type, id, wait_seconds);
  const status = await client.get(statusPath(type, id, q));
  return text(shapeJobStatus(status, { type, maxContentChars: max_content_chars }));
}

export function registerExtractTool(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "extract_url",
    `Read any web page as Markdown, text, or HTML. Tier-priced: normal=1cr, advanced(JS render)=1cr, ultra(hardest pages)=2cr. Start normal, escalate on empty/blocked. Only billed on success.`,
    {
      url: z.string().min(1).max(2048)
        .describe("http(s) URL. Bare hosts upgraded to https. Private/loopback rejected."),
      format: z.enum(["html", "markdown", "text"]).optional()
        .describe("'markdown' (default), 'text', or 'html'."),
      mode: z.enum(["normal", "advanced", "ultra"]).optional()
        .describe("PRICE-BEARING. 'normal'=1cr (default), 'advanced'=JS render 1cr, 'ultra'=hardest pages 2cr."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/extract", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "map_website",
    `List a site's page URLs from its sitemaps and start page (deduplicated, path-filtered, with lastmod when known). Obeys robots.txt. 1 credit (normal). Use to pick pages for batch_extract.`,
    {
      url: z.string().min(1).max(2048).describe("Site to map, e.g. https://example.com."),
      search: z.string().max(200).optional().describe("Only URLs containing every word of this text (case-insensitive)."),
      limit: z.number().int().min(1).max(5000).optional()
        .describe(`Max links (default ${MCP_MAP_DEFAULT_LIMIT} here). Plan caps: Free 500, PAYG 1,000, paid 5,000.`),
      sitemap: z.enum(["include", "only", "skip"]).optional()
        .describe("'include' (default) sitemaps + page links; 'only' sitemaps; 'skip' page links."),
      include_subdomains: z.boolean().optional().describe("Include subdomains. Default false."),
      include_paths: globs("keep"),
      exclude_paths: globs("drop"),
      ignore_query_parameters: z.boolean().optional().describe("Merge URLs differing only by query. Default true."),
      mode,
    },
    async (params) => {
      try {
        const body = { ...strip(params, []), limit: params.limit ?? MCP_MAP_DEFAULT_LIMIT };
        const data = await getClient().post("/api/v1/extract/map", body);
        return text(shapeMap(data));
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "crawl_website",
    `Crawl a site from one URL and extract its same-site pages as Markdown/text/HTML. Starts a job and waits up to wait_seconds: returns results if done, else the job id for get_crawl_status. ${PRICING} Max pages: Free 10, PAYG 100, Project 500, Bootstrap 2k, Startup 5k, Growth 10k. Results kept 3 days.`,
    {
      url: z.string().min(1).max(2048).describe("Start URL; pages under its path are crawled first."),
      max_pages: z.number().int().min(1).max(10000).optional().describe("Max pages (default 100, capped by plan)."),
      max_depth: z.number().int().min(0).max(10).optional().describe("Link depth to follow (default 3; 0 = start page only)."),
      include_paths: globs("crawl"),
      exclude_paths: globs("skip"),
      allow_subdomains: z.boolean().optional().describe("Include subdomains. Default false."),
      ignore_query_parameters: z.boolean().optional().describe("Merge URLs differing only by query. Default true."),
      sitemap: z.enum(["include", "skip", "only"]).optional()
        .describe("'include' (default) also seeds from the sitemap; 'skip' links only; 'only' sitemap pages, no link following."),
      format,
      mode,
      webhook_url: webhookUrl,
      idempotency_key: idempotencyKey,
      wait_seconds: waitSeconds(CRAWL_DEFAULT_WAIT_SECONDS),
      max_content_chars: statusQuery.max_content_chars,
    },
    async (params) => {
      try {
        return await startJob(getClient(), "crawl", params, CRAWL_DEFAULT_WAIT_SECONDS);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_crawl_status",
    `A crawl's status, page counts, credits used and page results (paged by cursor). Can wait for it to finish. Free.`,
    { id: jobId, ...statusQuery, wait_seconds: waitSeconds(0) },
    async (params) => {
      try {
        return await jobStatus(getClient(), "crawl", params);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "cancel_crawl",
    `Stop a running crawl; nothing more is billed and results so far stay readable. 409 if already finished. Free.`,
    { id: jobId },
    async ({ id }) => {
      try {
        return trimResponse(await getClient().delete(`/api/v1/extract/crawl/${encodeURIComponent(id)}`));
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "batch_extract",
    `Extract a list of URLs in one job, each as Markdown/text/HTML, results in input order; invalid URLs are reported, never billed. Waits up to wait_seconds: returns results if done, else the job id for get_batch_status. ${PRICING} Max URLs: Free 10, PAYG 50, Project 100, Bootstrap 500, Startup/Growth 1k.`,
    {
      urls: z.array(z.string().max(2048)).min(1).max(1000).describe("Pages to extract (duplicates removed)."),
      format,
      mode,
      webhook_url: webhookUrl,
      idempotency_key: idempotencyKey,
      wait_seconds: waitSeconds(CRAWL_DEFAULT_WAIT_SECONDS),
      max_content_chars: statusQuery.max_content_chars,
    },
    async (params) => {
      try {
        return await startJob(getClient(), "batch", params, CRAWL_DEFAULT_WAIT_SECONDS);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_batch_status",
    `A batch's status, page counts, credits used and results in input order (paged by cursor). Can wait for it to finish. Free.`,
    { id: jobId, ...statusQuery, wait_seconds: waitSeconds(0) },
    async (params) => {
      try {
        return await jobStatus(getClient(), "batch", params);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "cancel_batch",
    `Stop a running batch; nothing more is billed and results so far stay readable. 409 if already finished. Free.`,
    { id: jobId },
    async ({ id }) => {
      try {
        return trimResponse(await getClient().delete(`/api/v1/extract/batch/${encodeURIComponent(id)}`));
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
