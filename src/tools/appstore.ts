import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// Two-letter ISO only. The transport falls back to the US storefront for
// anything that is not two letters, so 'usa' would silently buy a US result set
// on a billed call — rejecting it here costs nothing.
const countryField = z.string().regex(/^[A-Za-z]{2}$/, "country must be a two-letter ISO country code, e.g. us").optional()
  .describe("Storefront to answer from, as a two-letter ISO code ('us', 'gb', 'jp'). Decides price, currency, localised title and whether the app is sold there at all. Must be exactly two letters - 'usa' is rejected rather than silently answered from the US. Defaults to 'us'.");

export function registerAppStoreTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_app_store",
    `Search Apple's App Store (iPhone, iPad and Mac apps) and return up to 200 fully-shaped app rows as JSON - the same 43-field row get_app_store_app returns, so this doubles as a bulk metadata fetch. Apple matches an app name, a keyword OR a publisher name, so searching a developer returns their whole catalogue. SEARCH HAS NO PAGINATION: limit (1-200) is the only lever on result volume - raise limit, never ask for a page or an offset, which are silently ignored. country decides price, currency, localised title and whether the app is sold in that storefront at all. With entity=mac_software the iPad/Apple TV screenshots, advisories, features, supported devices and Game Center flag come back EMPTY rather than absent. Costs 1 credit.`,
    {
      term: z.string().min(1).max(500)
        .describe("What to search for. Apple matches an app name, a keyword, or a PUBLISHER name - searching a developer returns their catalogue even when the words appear in none of their app titles."),
      limit: z.number().int().min(1).max(200).optional()
        .describe("Apps to return, 1-200. THE ONLY lever on result volume - the search API has no pagination and there is no second page to ask for. Defaults to 25."),
      country: countryField,
      entity: z.enum(["software", "ipad_software", "mac_software"]).optional()
        .describe("Which catalogue to search: 'software' (iPhone/iPad apps, the default), 'ipad_software', or 'mac_software'. Mac rows carry no iPad/Apple TV screenshots, advisories, features, supported devices or Game Center flag - those come back empty rather than absent."),
      lang: z.string().regex(/^[A-Za-z]{2}_[A-Za-z]{2}$/, "lang must be a five-letter code, e.g. en_us or ja_jp").optional()
        .describe("Language of the returned listing text as a five-letter code ('en_us', 'ja_jp'). Independent of country: the storefront decides the price, this decides the words."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/appstore/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_app_store_app",
    `Get one Apple App Store listing in full as JSON: title, description, developer and seller identity, price and currency, all-time and current-version ratings, version and release notes, genres, content rating and advisories, icons at three sizes, screenshots, download size, minimum OS, languages, supported devices, Game Center and VPP flags. Accepts BOTH a numeric App Store id (the digits after 'id' in an apps.apple.com URL) and a bundle id such as 'notion.id' - both resolve to the identical payload. A pasted apps.apple.com URL is rejected with a free 400, so pull the id out of it first. An id Apple cannot resolve is a BILLED 404. Mac apps carry no iPad/Apple TV screenshots, advisories, features, supported devices or Game Center flag - empty rather than absent. Costs 1 credit.`,
    {
      app_id: z.string().min(1).max(255).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "app_id must be a numeric App Store id (e.g. 1232780281) or a bundle id (e.g. notion.id)")
        .describe("App Store id - the digits after 'id' in an apps.apple.com URL, e.g. '1232780281' - or the app's bundle id ('notion.id', 'com.burbn.instagram'). Both resolve to the identical payload. A full apps.apple.com URL is rejected."),
      country: countryField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/appstore/app", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_app_store_reviews",
    `Get a page of Apple App Store customer reviews as JSON: star rating, title, full text, author, and the APP VERSION each review was written against. NUMERIC APP STORE IDS ONLY - unlike get_app_store_app, the reviews feed has no bundle-id form. HARD STOP AT PAGE 10 at 50 reviews per page: 500 reviews per storefront is Apple's anonymous ceiling, and the way to reach further is to ask a different country. Under sort=most_recent the review vote fields come back as ZEROES (those reviews are too new to have been voted on); most_helpful returns them densely populated. These reviews CANNOT 404 - an unknown id and a real app with zero reviews return the same empty feed, so an empty result does not mean the app is missing. Costs 1 credit per page.`,
    {
      app_id: z.string().regex(/^\d+$/, "app_id must be a numeric App Store id")
        .describe("App Store id, e.g. '1232780281'. NUMERIC ONLY - unlike get_app_store_app, the reviews feed has no bundle-id form."),
      country: countryField,
      page: z.number().int().min(1).max(10).optional()
        .describe("Reviews page, 1-10, 50 reviews each. Apple hard-stops at page 10, so 500 reviews per storefront is the ceiling - reach further by asking a different country. Defaults to 1."),
      sort: z.enum(["most_recent", "most_helpful"]).optional()
        .describe("Review ordering. Also decides whether the vote fields mean anything: under 'most_recent' almost every review is too new to have been voted on and the vote fields return zeroes, while 'most_helpful' returns them densely populated. Defaults to 'most_recent'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/appstore/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
