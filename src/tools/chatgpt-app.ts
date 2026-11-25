/**
 * The tool profile served at /chatgpt, the endpoint submitted to the ChatGPT /
 * Codex plugin directory.
 *
 * OpenAI's plugin guidelines differ from every other directory we list in, so
 * this profile reshapes the shared tools instead of forking them. The
 * guidelines it answers to (developers.openai.com/plugins/plugin-guidelines):
 *  - a narrow, fixed tool set (CHATGPT_TOOLS), not the per-connection platform
 *    allowlist: the guidelines reject plugins that are primarily unofficial
 *    connectors to third-party services;
 *  - no pricing in model-readable text, and no upgrade or top-up links in
 *    results (commerce rules), so descriptions are rewritten and the 402 text
 *    is replaced;
 *  - minimal inputs: raw location, coordinates, outbound webhooks, raw HTML and
 *    the 'ultra' mode (pages that block automated reads) are not exposed;
 *  - response minimization: billing counters, timings, request ids and job
 *    timestamps are stripped from results.
 *
 * Plugin 1.1 adds social, retail and real estate platforms
 * (CHATGPT_BROAD_PLATFORMS) on the same rules, minus tools that list or profile
 * private individuals in bulk.
 *
 * Everything here applies to /chatgpt only. /mcp and the REST API are unchanged.
 */
import type { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { INVALID_KEY_MESSAGE, OUT_OF_CREDITS_PREFIX } from "../lib/tool-error.js";

/** The platform registrars the hand-written core draws from (keys of PLATFORMS in index.ts). */
export const CHATGPT_PLATFORMS = ["extract", "company", "google"] as const;

/**
 * Platforms added in plugin 1.1, in the owner's priority order (2026-11-17):
 * Google products, then every US retailer, then TikTok, YouTube, Instagram,
 * then real estate. ChatGPT stops exposing tools once tools/list gets too
 * large (measured: 568 tools / 964KB exposed only 3), and the guidelines forbid
 * a generic executor for the rest, so the list is cut at the measured budget,
 * from the end. Their tools keep their shared descriptions with pricing
 * clauses removed (scrubPricing), except the tools in BROAD_EXCLUDED.
 */
export const CHATGPT_BROAD_PLATFORMS = [
  // Google products beyond search, news, shopping and Maps (those are in CHATGPT_TOOLS)
  "googleplay", "googleads",
  // US retailers
  "amazon", "walmart", "target", "costco", "homedepot", "lowes", "bestbuy", "ebay", "kroger", "samsclub",
  "cvs", "walgreens", "wholefoods", "heb", "publix", "aldi", "dollargeneral", "sephora", "ulta", "macys",
  "nordstrom", "nordstromrack", "kohls", "jcpenney", "saks", "dicks", "footlocker", "fanatics", "chewy",
  "petsmart", "petco", "iherb", "menards", "harborfreight", "microcenter", "wayfair", "ashley", "tcgplayer",
  "mercari", "specs",
  // If room
  "tiktok", "youtube", "instagram",
  "zillow", "redfin", "realtor",
] as const;

/** Tools from the core registrars that are not served: a format variant of search_google. */
const CORE_EXCLUDED = new Set(["google_custom_search"]);

/**
 * Broad tools left out: follower, liker and retweeter lists and individuals'
 * stories, profiles and account region (bulk data about private people), raw
 * media stream URLs, a deprecated alias, and the Home Depot Canada only tools
 * (the profile's retail set is US retailers; added 0.91.0, kept out so the
 * reviewed tool set does not change).
 */
const BROAD_EXCLUDED = new Set([
  "get_home_depot_category",
  "get_home_depot_categories",
  "get_home_depot_stock",
  "get_home_depot_store",
  "get_home_depot_suggestions",
  "get_tiktok_user_followers",
  "get_tiktok_user_followings",
  "get_tiktok_user_region",
  "get_instagram_user_followers",
  "get_instagram_user_followings",
  "get_instagram_post_likers",
  "get_instagram_user_stories",
  "get_instagram_highlight_stories",
  "get_tweet_retweeters",
  "get_x_user_followers",
  "get_x_user_followings",
  "get_linkedin_person",
  "get_linkedin_person_about",
  "get_linkedin_person_posts",
  "get_youtube_streams",
  "get_youtube_metadata",
]);

/** Exposed core tools. Anything else the core registrars add is removed. */
export const CHATGPT_TOOLS = [
  "search_google",
  "google_news",
  "google_shopping",
  "google_maps_search",
  "google_maps_place",
  "google_maps_reviews",
  "company_enrich",
  "extract_url",
  "map_website",
  "crawl_website",
  "get_crawl_status",
  "cancel_crawl",
  "batch_extract",
  "get_batch_status",
  "cancel_batch",
  "get_usage",
] as const;

const DESCRIPTIONS: Record<(typeof CHATGPT_TOOLS)[number], string> = {
  search_google:
    "Search Google and return the results page as structured data: organic results with title, link and snippet, the AI Overview, related questions, videos and local results. Use it when the user needs current information from the web.",
  google_news:
    "Search Google News by keyword, or browse a topic, story or publication by its token. Returns articles with title, source, link and date, the first 20 by default (change with limit).",
  google_shopping:
    "Search Google Shopping for products, with prices, ratings and the stores selling them. Returns the top 10 results by default (change with limit).",
  google_maps_search:
    "Search Google Maps for businesses and places, with rating, review count, address, phone, website, hours and a place_id. Put the area in the query, for example 'coffee shops in Austin TX'. Pass a place_id to google_maps_place for full details, google_maps_reviews for reviews, or company_enrich for the business's published contact details.",
  google_maps_place:
    "Get full details for one Google Maps place by place_id or data_cid: address, phone, website, opening hours, rating, review count and category.",
  google_maps_reviews:
    "Get reviews for one Google Maps place by place_id or data_id, with rating, review text and date. Page through more reviews with next_page_token.",
  company_enrich:
    "Find a company's published contact details from its website or a Google Maps place_id: emails, phone numbers, social profiles and the contact page, plus the owner or founder's name and title when a page on the site names them, with the page that names them. Provide url or place_id. Takes 10 to 45 seconds.",
  extract_url:
    "Read one public web page and return its content as Markdown, plain text or HTML. Use it when the user gives a URL or asks what a specific page says. Use mode 'advanced' only when the normal read comes back empty because the page builds its content with JavaScript. Private and local network addresses are rejected.",
  map_website:
    "List the page URLs of a website from its sitemaps and start page, deduplicated and optionally filtered by keyword or path, with last-modified dates when the site publishes them. Respects robots.txt. Use it to choose pages to read with extract_url or batch_extract.",
  crawl_website:
    "Start a crawl job that follows links from one URL and returns the content of the same site's pages as Markdown, text or HTML. Respects robots.txt. Waits up to wait_seconds; if the crawl is still running, returns a job id to check with get_crawl_status. Results are kept for 3 days.",
  get_crawl_status:
    "Get a crawl job's status, page counts and page results, paged by cursor. Can wait for the job to finish.",
  cancel_crawl:
    "Stop a running crawl job. This cannot be undone; pages already read stay available. Returns an error if the job has already finished.",
  batch_extract:
    "Start a job that reads a list of URLs and returns each page as Markdown, text or HTML, in input order. Invalid URLs are reported and skipped. Respects robots.txt. Waits up to wait_seconds; if the job is still running, returns a job id to check with get_batch_status. Results are kept for 3 days.",
  get_batch_status:
    "Get a batch job's status, page counts and results in input order, paged by cursor. Can wait for the job to finish.",
  cancel_batch:
    "Stop a running batch job. This cannot be undone; pages already read stay available. Returns an error if the job has already finished.",
  get_usage:
    "Show the connected Scavio account's plan, remaining credit balance and credits used in the current period.",
};

/** Inputs not exposed in this profile. The zod object strips them if sent anyway. */
const HIDDEN_PARAMS: Partial<Record<(typeof CHATGPT_TOOLS)[number], string[]>> = {
  search_google: ["include_html", "location", "uule", "web_only"],
  google_shopping: ["location", "uule"],
  google_maps_search: ["ll"],
  crawl_website: ["webhook_url"],
  batch_extract: ["webhook_url"],
};

const MODE = z
  .enum(["normal", "advanced"])
  .optional()
  .describe("'normal' (default), or 'advanced' to render JavaScript for pages that build their content in the browser.");

/** Inputs whose shared definition quotes credits or plan names, replaced here. */
const PARAM_OVERRIDES: Partial<Record<(typeof CHATGPT_TOOLS)[number], Record<string, z.ZodType>>> = {
  extract_url: { mode: MODE },
  map_website: {
    mode: MODE,
    limit: z.number().int().min(1).max(5000).optional().describe("Maximum number of URLs to return (default 200)."),
  },
  crawl_website: { mode: MODE },
  batch_extract: { mode: MODE },
  company_enrich: {
    place_id: z
      .string()
      .min(10)
      .max(300)
      .optional()
      .describe("A Google Maps place_id from google_maps_search. The listing is looked up first, then its website is read. Provide this or url."),
  },
  google_shopping: {
    limit: z.number().int().min(1).max(100).optional().describe("Maximum shopping_results returned (default 10)."),
  },
  google_news: {
    limit: z.number().int().min(1).max(100).optional().describe("Maximum news_results returned (default 20)."),
  },
};

/** Billing counters, timings, request ids and job timestamps: not needed to answer the user. */
const STRIPPED_KEYS = new Set([
  "credits",
  "credits_used",
  "credits_remaining",
  "response_time",
  "time_taken_displayed",
  "cached",
  "fetched_at",
  "request_id",
  "status_url",
  "created_at",
  "started_at",
  "completed_at",
]);

export const CHATGPT_OUT_OF_CREDITS = "This Scavio account has no credits left, so the request was not run.";
export const CHATGPT_NOT_AUTHORIZED = "The Scavio connection is no longer authorized. Reconnect Scavio in ChatGPT and try again.";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type ToolResult = { content?: { type: string; text?: string }[]; isError?: boolean; [k: string]: unknown };

/** Pricing, billing and plan words; kept in step with BANNED in scripts/chatgpt-check.mjs. */
const PRICING =
  /\b\d+\s*cr\b|\bcredits?\b|\bfree\b(?! shipping)|\bPAYG\b|\bBootstrap\b|\bStartup\b|\bGrowth\b|\bProject\b|\bHobby\b|\bbill(ed|ing)?\b|\bupgrade\b|\btop up\b|\bultra\b|\bcost\b/i;

const balanced = (s: string) => (s.match(/\(/g)?.length ?? 0) === (s.match(/\)/g)?.length ?? 0);

/**
 * Remove pricing from a shared description. Sentences end at a period followed
 * by whitespace (so domains and field paths like data.location survive). In a
 * sentence that quotes pricing, drop just the clauses that do; drop the whole
 * sentence when its opening clause does or what is left would not parse.
 */
export function scrubPricing(text: string): string {
  const sentences = text.split(/(?<=\.)\s+/);
  const kept = sentences.map((sentence) => {
    if (!PRICING.test(sentence)) return sentence;
    const parts = sentence.split(/(, |; | - )/);
    if (PRICING.test(parts[0])) return "";
    let out = parts[0];
    for (let i = 1; i < parts.length; i += 2) if (!PRICING.test(parts[i + 1])) out += parts[i] + parts[i + 1];
    if (!balanced(out) || PRICING.test(out)) return "";
    return /[.!?]$/.test(out) ? out : `${out}.`;
  });
  return kept.filter(Boolean).join(" ").trim();
}

export function stripTelemetry(value: Json): Json {
  if (Array.isArray(value)) return value.map(stripTelemetry);
  if (value && typeof value === "object") {
    const out: { [k: string]: Json } = {};
    for (const [k, v] of Object.entries(value)) if (!STRIPPED_KEYS.has(k)) out[k] = stripTelemetry(v);
    return out;
  }
  return value;
}

/** get_usage returns the account's plan settings too; keep only what answers "how much do I have left". */
function projectUsage(value: Json): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const out: { [k: string]: Json } = {};
  if ("plan" in value) out.plan = value.plan;
  if ("credit_balance" in value) out.credit_balance = value.credit_balance;
  if ("searches_used" in value) out.credits_used_this_period = value.searches_used;
  if ("period_start" in value) out.period_start = value.period_start;
  return out;
}

function reshapeResult(name: string, result: ToolResult): ToolResult {
  const content = result.content?.map((part) => {
    if (part.type !== "text" || typeof part.text !== "string") return part;
    if (result.isError) {
      return part.text.startsWith(OUT_OF_CREDITS_PREFIX) ? { ...part, text: CHATGPT_OUT_OF_CREDITS } : part;
    }
    let parsed: Json;
    try {
      parsed = JSON.parse(part.text) as Json;
    } catch {
      return part;
    }
    const shaped = name === "get_usage" ? projectUsage(parsed) : stripTelemetry(parsed);
    return { ...part, text: JSON.stringify(shaped) };
  });
  return { ...result, content };
}

function wrap(name: string, tool: RegisteredTool) {
  const original = tool.handler as (...args: unknown[]) => Promise<ToolResult>;
  return async (...args: unknown[]): Promise<ToolResult> => {
    try {
      return reshapeResult(name, await original(...args));
    } catch (err) {
      if (err instanceof McpError && err.message.includes(INVALID_KEY_MESSAGE)) {
        throw new McpError(ErrorCode.InternalError, CHATGPT_NOT_AUTHORIZED);
      }
      throw err;
    }
  };
}

/** Keep a shared tool with its own description and inputs, pricing clauses removed. */
function applyShared(name: string, tool: RegisteredTool): void {
  const shape = { ...((tool.inputSchema as z.ZodObject | undefined)?.shape ?? {}) } as Record<string, z.ZodType>;
  for (const [param, schema] of Object.entries(shape)) {
    if (schema.description) shape[param] = schema.describe(scrubPricing(schema.description));
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tool.update({ description: scrubPricing(tool.description ?? ""), paramsSchema: shape as any, callback: wrap(name, tool) as any });
}

/**
 * Turn the tools registered by CHATGPT_PLATFORMS + get_usage (core) and
 * CHATGPT_BROAD_PLATFORMS (broad) into the ChatGPT profile: remove the rest,
 * rewrite descriptions and inputs, wrap handlers.
 */
export function applyChatgptProfile(
  registered: Map<string, RegisteredTool>,
  broad: Map<string, RegisteredTool> = new Map(),
): void {
  for (const [name, tool] of broad) {
    if (BROAD_EXCLUDED.has(name) || registered.has(name)) tool.remove();
    else applyShared(name, tool);
  }
  const keep = new Set<string>(CHATGPT_TOOLS);
  for (const [name, tool] of registered) {
    if (!keep.has(name)) {
      if (CORE_EXCLUDED.has(name)) tool.remove();
      else applyShared(name, tool);
      continue;
    }
    const key = name as (typeof CHATGPT_TOOLS)[number];
    const shape = { ...((tool.inputSchema as z.ZodObject | undefined)?.shape ?? {}) } as Record<string, z.ZodType>;
    for (const hidden of HIDDEN_PARAMS[key] ?? []) delete shape[hidden];
    Object.assign(shape, PARAM_OVERRIDES[key] ?? {});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool.update({ description: DESCRIPTIONS[key], paramsSchema: shape as any, callback: wrap(name, tool) as any });
  }
  const missing = CHATGPT_TOOLS.filter((n) => !registered.has(n));
  if (missing.length) throw new Error(`[scavio-mcp] ChatGPT profile: tools not registered: ${missing.join(", ")}`);
}
