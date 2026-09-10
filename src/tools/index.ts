import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { env } from "../lib/env.js";

import { registerExtractTool } from "./extract.js";
import { registerGoogleTools } from "./google.js";
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
import { registerTiktokShopTools } from "./tiktok-shop.js";
import { registerBookingTools } from "./booking.js";
import { registerAirbnbTools } from "./airbnb.js";
import { registerTripadvisorTools } from "./tripadvisor.js";
import { registerYelpTools } from "./yelp.js";
import { registerZillowTools } from "./zillow.js";
import { registerRedfinTools } from "./redfin.js";
import { registerIndeedTools } from "./indeed.js";
import { registerGlassdoorTools } from "./glassdoor.js";
import { registerAppStoreTools } from "./appstore.js";
import { registerGooglePlayTools } from "./googleplay.js";
import { registerG2Tools } from "./g2.js";
import { registerCapterraTools } from "./capterra.js";
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
  "tiktok-shop": registerTiktokShopTools,
  // Travel and local
  booking: registerBookingTools,
  airbnb: registerAirbnbTools,
  tripadvisor: registerTripadvisorTools,
  yelp: registerYelpTools,
  // Real estate
  zillow: registerZillowTools,
  redfin: registerRedfinTools,
  // Jobs and employer data
  indeed: registerIndeedTools,
  glassdoor: registerGlassdoorTools,
  // App stores
  appstore: registerAppStoreTools,
  googleplay: registerGooglePlayTools,
  // Software reviews
  g2: registerG2Tools,
  capterra: registerCapterraTools,
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
 * Registering everything is not an option any more. The full surface is 191
 * tools, which serialises to 136KB of tools/list (measured with
 * `npm run toolslist`, not estimated) — roughly 35k tokens pushed into the
 * context of EVERY session before the user has typed anything, and past the
 * hard tool-count ceiling some clients enforce. The default set below is 106
 * tools, 63KB.
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
 *   all      — every platform (191 tools)
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
  for (const key of platforms) PLATFORMS[key](server, getClient);
  registerUsageTool(server, getClient);
  return platforms;
}
