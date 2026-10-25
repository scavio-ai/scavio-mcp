import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { env } from "../lib/env.js";

import { registerExtractTool } from "./extract.js";
import { registerGoogleTools } from "./google.js";
import { registerChatgptTools, registerGeminiTools } from "./ai-chat.js";
import { registerYoutubeTools } from "./youtube.js";
import { registerTiktokTools } from "./tiktok.js";
import { registerInstagramTools } from "./instagram.js";
import { registerRedditTools } from "./reddit.js";
import { registerXTools } from "./x.js";
import { registerLinkedinTools } from "./linkedin.js";
import { registerThreadsTools } from "./threads.js";
import { registerKuaishouTools } from "./kuaishou.js";
import { registerAmazonTools } from "./amazon.js";
import { registerWalmartTools } from "./walmart.js";
import { registerEbayTools } from "./ebay.js";
import { registerTargetTools } from "./target.js";
import { registerHomeDepotTools } from "./homedepot.js";
import { registerCostcoTools } from "./costco.js";
import { registerHebTools } from "./heb.js";
import { registerKrogerTools } from "./kroger.js";
import { registerDecathlonTools } from "./decathlon.js";
import { registerMercadoLibreTools } from "./mercadolibre.js";
import { registerTiktokShopTools } from "./tiktok-shop.js";
import { registerBookingTools } from "./booking.js";
import { registerAirbnbTools } from "./airbnb.js";
import { registerTripadvisorTools } from "./tripadvisor.js";
import { registerYelpTools } from "./yelp.js";
import { registerZillowTools } from "./zillow.js";
import { registerRedfinTools } from "./redfin.js";
import { registerRealtorTools } from "./realtor.js";
import { registerRightmoveTools } from "./rightmove.js";
import { registerIndeedTools } from "./indeed.js";
import { registerGlassdoorTools } from "./glassdoor.js";
import { registerAppStoreTools } from "./appstore.js";
import { registerGooglePlayTools } from "./googleplay.js";
import { registerG2Tools } from "./g2.js";
import { registerCapterraTools } from "./capterra.js";
import { registerTrustpilotTools } from "./trustpilot.js";
import { registerGoogleAdsTools } from "./googleads.js";
import { registerMetaAdsTools } from "./metaads.js";
import { registerSecTools } from "./sec.js";
import { registerCompaniesHouseTools } from "./companieshouse.js";
import { registerUsageTool } from "./usage.js";

type RegisterFn = (server: McpServer, getClient: () => ScavioClient) => void;

/**
 * Every registrable surface, keyed by platform. Iteration order here is the
 * order tools are registered, and therefore the order they appear in
 * tools/list — keep it stable so client-side tool caches stay stable.
 *
 * Keys match the platform keys in gtm/fanout-spec.json. Lookups are normalised
 * (case-insensitive, punctuation-insensitive), so `meta-ads`, `metaads` and
 * `META_ADS` all resolve to the same entry.
 *
 * `get_usage` is deliberately NOT in here: it reports the caller's own credit
 * balance, costs nothing, and is what every install guide tells a user to call
 * to verify the server works. It registers unconditionally.
 */
const PLATFORMS: Record<string, RegisterFn> = {
  // Core
  extract: registerExtractTool,
  // Search
  google: registerGoogleTools,
  // AI assistants
  chatgpt: registerChatgptTools,
  gemini: registerGeminiTools,
  // Social and video
  youtube: registerYoutubeTools,
  tiktok: registerTiktokTools,
  instagram: registerInstagramTools,
  reddit: registerRedditTools,
  x: registerXTools,
  linkedin: registerLinkedinTools,
  threads: registerThreadsTools,
  kuaishou: registerKuaishouTools,
  // Retail and marketplaces
  amazon: registerAmazonTools,
  walmart: registerWalmartTools,
  ebay: registerEbayTools,
  target: registerTargetTools,
  homedepot: registerHomeDepotTools,
  costco: registerCostcoTools,
  heb: registerHebTools,
  kroger: registerKrogerTools,
  decathlon: registerDecathlonTools,
  mercadolibre: registerMercadoLibreTools,
  "tiktok-shop": registerTiktokShopTools,
  // Travel and local
  booking: registerBookingTools,
  airbnb: registerAirbnbTools,
  tripadvisor: registerTripadvisorTools,
  yelp: registerYelpTools,
  // Real estate
  zillow: registerZillowTools,
  redfin: registerRedfinTools,
  realtor: registerRealtorTools,
  rightmove: registerRightmoveTools,
  // Jobs and employer data
  indeed: registerIndeedTools,
  glassdoor: registerGlassdoorTools,
  // App stores
  appstore: registerAppStoreTools,
  googleplay: registerGooglePlayTools,
  // Software reviews
  g2: registerG2Tools,
  capterra: registerCapterraTools,
  // Business reviews
  trustpilot: registerTrustpilotTools,
  // Ad libraries
  googleads: registerGoogleAdsTools,
  metaads: registerMetaAdsTools,
  // Company and financial filings
  sec: registerSecTools,
  companieshouse: registerCompaniesHouseTools,
};

export const PLATFORM_KEYS = Object.keys(PLATFORMS);

/**
 * What registers when SCAVIO_PLATFORMS is unset.
 *
 * Registering everything is not an option any more. The full surface is 267
 * tools, which serialises to 254KB of tools/list (measured with
 * `npm run toolslist`, not estimated) — roughly 64k tokens pushed into the
 * context of EVERY session before the user has typed anything, and past the
 * hard tool-count ceiling some clients enforce. The default set below is 142
 * tools, 112KB (0.20.0: TikTok, YouTube, Reddit and X gained 19 tools; 0.21.0:
 * Extract gained map, crawl and batch, 7 tools; 0.22.0: Instagram gained 8; 0.23.0: google_custom_search; 0.24.0 added the opt-in chatgpt and gemini platforms).
 *
 * The default is therefore exactly what 0.12.x registered, plus extract:
 * upgrading must never silently remove a tool someone already depends on. A
 * user who had TikTok or LinkedIn working yesterday still has it today, and
 * the context cost is unchanged from the version they were already running.
 * extract joins them because it is a single tool and the read-any-page
 * primitive an agent reaches for in almost every session.
 *
 * The 22 platforms added in 0.13.0 are opt-in via SCAVIO_PLATFORMS — growth
 * goes behind the flag, the existing contract does not move.
 */
export const DEFAULT_PLATFORMS = [
  "extract",
  "google",
  "youtube",
  "amazon",
  "walmart",
  "reddit",
  "tiktok",
  "tiktok-shop",
  "instagram",
  "x",
  "linkedin",
];

/** Names users reasonably type that are not the canonical key. */
const ALIASES: Record<string, string> = {
  twitter: "x",
  metaadlibrary: "metaads",
  facebookads: "metaads",
  googleadstransparency: "googleads",
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const CANONICAL_BY_NORMALIZED = new Map<string, string>();
for (const key of PLATFORM_KEYS) CANONICAL_BY_NORMALIZED.set(normalize(key), key);
for (const [alias, key] of Object.entries(ALIASES)) CANONICAL_BY_NORMALIZED.set(normalize(alias), key);

const warned = new Set<string>();
function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  // stderr only — stdout is the JSON-RPC stream.
  console.error(message);
}

/**
 * Turn a SCAVIO_PLATFORMS value into the canonical platform keys to register.
 *
 * Accepts a comma-separated list of platform keys, plus three keywords:
 *   all      — every platform (267 tools)
 *   default  — expands to DEFAULT_PLATFORMS, so `default,sec,g2` is additive
 *   none     — no platform tools at all, leaving only get_usage
 *
 * Unknown entries are warned about and skipped rather than fatal: a typo in one
 * key must not take down a server the user has already wired into a client.
 * A list that is entirely typos falls back to the default for the same reason.
 * Always returned in PLATFORMS order, never in the order the user typed.
 */
export function resolvePlatforms(raw: string | undefined | null): string[] {
  if (raw === undefined || raw === null || raw.trim() === "") return [...DEFAULT_PLATFORMS];

  const selected = new Set<string>();
  const unknown: string[] = [];
  let explicitNone = false;

  for (const token of raw.split(",")) {
    const key = normalize(token);
    if (key === "") continue;
    if (key === "all" || key === "*") return [...PLATFORM_KEYS];
    if (key === "none") {
      explicitNone = true;
      continue;
    }
    if (key === "default") {
      for (const d of DEFAULT_PLATFORMS) selected.add(d);
      continue;
    }
    const canonical = CANONICAL_BY_NORMALIZED.get(key);
    if (canonical) selected.add(canonical);
    else unknown.push(token.trim());
  }

  if (unknown.length > 0) {
    warnOnce(
      `[scavio-mcp] Ignoring unknown SCAVIO_PLATFORMS ${unknown.length === 1 ? "value" : "values"}: ${unknown.join(", ")}. ` +
        `Known platforms: ${PLATFORM_KEYS.join(", ")} (or "all").`,
    );
  }

  if (selected.size === 0) {
    if (explicitNone) return [];
    warnOnce(`[scavio-mcp] SCAVIO_PLATFORMS matched no known platform; falling back to the default set: ${DEFAULT_PLATFORMS.join(", ")}.`);
    return [...DEFAULT_PLATFORMS];
  }

  return PLATFORM_KEYS.filter((key) => selected.has(key));
}

/** Words in tool names whose display form is not plain title case. */
const TITLE_WORDS: Record<string, string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  ebay: "eBay",
  heb: "HEB",
  sec: "SEC",
  g2: "G2",
  ai: "AI",
  url: "URL",
  chatgpt: "ChatGPT",
};

/** `get_tiktok_user_posts` -> `Get TikTok User Posts`. */
export function toolTitle(name: string): string {
  return name
    .split("_")
    .map((w) => TITLE_WORDS[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Every Scavio tool reads public data and changes nothing, so one annotation
 * set covers all of them. The Claude, ChatGPT and Microsoft connector
 * directories reject a server whose tools lack a title and these hints.
 * openWorldHint is true because the data comes from external sites.
 */
const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;

/**
 * The exceptions to "reads and changes nothing": starting a crawl or batch
 * creates a server-side job (not idempotent unless idempotency_key is set), and
 * cancelling one stops it for good. Still no change to any external site.
 */
const ANNOTATION_OVERRIDES: Record<string, { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean }> = {
  crawl_website: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  batch_extract: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  cancel_crawl: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  cancel_batch: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};

/**
 * Wrap the server so every tool() call is annotated at registration, instead
 * of editing 266 call sites. A tool added later picks this up automatically.
 */
function annotating(server: McpServer): McpServer {
  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop !== "tool") return Reflect.get(target, prop, receiver);
      return (name: string, ...rest: unknown[]) => {
        const registered: ReturnType<McpServer["tool"]> = Reflect.apply(target.tool, target, [name, ...rest]);
        const title = toolTitle(name);
        registered.update({ title, annotations: { title, ...READ_ONLY_ANNOTATIONS, ...ANNOTATION_OVERRIDES[name] } });
        return registered;
      };
    },
  });
}

/**
 * Register the allowlisted platform tools plus get_usage.
 *
 * `platformsRaw` lets the HTTP transport pass a per-request override (header or
 * query param), since a hosted remote has no per-user env var to read.
 */
export function registerAllTools(
  server: McpServer,
  getClient: () => ScavioClient,
  platformsRaw: string | undefined = env.SCAVIO_PLATFORMS,
): string[] {
  const platforms = resolvePlatforms(platformsRaw);
  const annotated = annotating(server);
  for (const key of platforms) PLATFORMS[key](annotated, getClient);
  registerUsageTool(annotated, getClient);
  return platforms;
}
