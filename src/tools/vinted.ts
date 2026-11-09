import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/vinted.ts (27 Vinted country sites,
// country defaults to fr on the backend). Cross-field rule the backend
// enforces and zod here does not: product takes item_id OR url. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const COUNTRIES = [
  "fr", "be", "lu", "es", "nl", "lt", "de", "at", "it", "uk", "pt", "us", "cz", "sk",
  "pl", "se", "ro", "hu", "dk", "fi", "hr", "gr", "ie", "ee", "lv", "si", "au",
] as const;
const SEARCH_SORTS = ["relevance", "newest_first", "price_low_to_high", "price_high_to_low"] as const;
const WARDROBE_SORTS = ["newest_first", "price_low_to_high", "relevance"] as const;
const FILTER_CODES = ["size", "status", "color", "material"] as const;
const CONDITIONS = "6 New with tags, 1 New without tags, 2 Very good, 3 Good, 4 Satisfactory";

const FEE = "service_fee is the Vinted fee the buyer pays on top of the price (formerly the Buyer Protection fee) and total_price is price plus that fee";

const country = () => z.enum(COUNTRIES).optional()
  .describe("Vinted country site: fr (default), be, lu, es, nl, lt, de, at, it, uk (vinted.co.uk), pt, us (vinted.com), cz, sk, pl, se, ro, hu, dk, fi, hr, gr, ie, ee, lv, si, au (vinted.com.au). Category, condition and filter names come back in the site's language. Every site can show listings from sellers in other countries, with the price converted to the site's currency (EUR, or CZK, PLN, SEK, RON, HUF, DKK, GBP for uk, USD for us, AUD for au); the EU sites share one cross-border pool. get_vinted_product returns the seller's own price and currency.");
const siteCode = () => z.enum(COUNTRIES).optional()
  .describe("Vinted country site, one of the 27 codes search_vinted takes (fr default, uk, us, de, pl, es, it, nl, au...). Names come back in the site's language.");
const numericId = (max: number) => z.union([z.number().int().positive(), z.string().regex(new RegExp(`^\\d{1,${max}}$`))]);
const idList = (description: string) =>
  z.union([z.array(numericId(9)).max(20), z.string().min(1).max(200)]).optional()
    .describe(`${description} Array or comma-separated string, up to 20.`);
const userId = () => numericId(12)
  .describe("Vinted member id: a search result's seller.id, a product's seller.id, or the number after /member/ in a profile URL, e.g. 65958245.");

export function registerVintedTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/vinted/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_vinted",
    `Search second-hand listings on any of 27 Vinted country sites (fr default; uk, us, de, pl, es, it, nl, au and more) by keywords, category, brand, condition, size, color, material and price range, sorted by relevance, newest or price. query is optional when category_id or brand_ids is given, to browse it. 96 items per page, pages 1-10 (Vinted serves no deeper). Each item has id, title, URL, price and currency (the country site's currency), price_with_discount, service_fee, total_price, brand, size, condition, favourite count, promoted flag, photos and the seller's id and business flag; ${FEE}. Also returns listed_results and total_pages (capped at 960 and 10; total_is_capped is true when the real number of matches is higher) and the filters Vinted actually applied, so an ignored filter is visible. Live listings only: sold items are not searchable. Use an item id with get_vinted_product and a seller id with get_vinted_seller. 1 credit.`,
    {
      country: country(),
      query: z.string().max(200).optional()
        .describe("Search keywords, e.g. 'barbour jacket'. Optional when category_id or brand_ids is given."),
      category_id: numericId(9).optional()
        .describe("Only this category and its subcategories, by id from get_vinted_categories (1907 is Women > Clothing > Outerwear > Coats)."),
      brand_ids: idList("Only these brands, by id from get_vinted_brands (Nike 53, Levi's 10, Barbour 46805)."),
      status_ids: idList(`Only these conditions: ${CONDITIONS}.`),
      size_ids: idList("Only these sizes, by option id from get_vinted_filters with filter size (4 is women's M / UK 12-14 / US 8-10)."),
      color_ids: idList("Only these colors, by option id from get_vinted_filters with filter color (1 is black)."),
      material_ids: idList("Only these materials, by option id from get_vinted_filters with filter material (123 is cashmere)."),
      price_from: z.number().min(0).optional()
        .describe("Minimum item price, in the country site's currency."),
      price_to: z.number().min(0).optional()
        .describe("Maximum item price, in the country site's currency."),
      sort: z.enum(SEARCH_SORTS).optional()
        .describe("relevance (default), newest_first, price_low_to_high or price_high_to_low. Price sorts rank loosely matching items too (very cheap or placeholder-priced listings), so pair them with a category or price range."),
      page: z.number().int().min(1).max(10).optional()
        .describe("Results page, 1-10 (Vinted serves at most 10 pages of 96). Defaults to 1."),
    },
    post("search"),
  );

  server.tool(
    "get_vinted_product",
    `One Vinted listing by item id or URL: title, description, price and currency (the seller's currency, which can differ from the country site's), brand, size, condition, color, material, when it was uploaded as Vinted words it (uploaded_relative, e.g. "8 hours ago"), category id and path, all photos, favourite count, reserved and sold state, whether it can be bought now, and the seller (id, login, profile URL, business flag, feedback count, rating 0-1, badges). Sold listings still return their last price. A URL's own site is used whatever country says. An unknown id is a 404. 1 credit.`,
    {
      country: siteCode(),
      item_id: numericId(13).optional()
        .describe("Vinted item id (a search result's id, the number after /items/ in a Vinted URL), e.g. 10671938315. Pass item_id or url."),
      url: z.string().min(1).max(600).optional()
        .describe("A Vinted item URL on any country site, e.g. https://www.vinted.co.uk/items/10671938315-nike-air-max-size-uk-75. Its own site is used (and echoed as country)."),
    },
    post("product"),
  );

  server.tool(
    "get_vinted_seller",
    "One Vinted member's public seller profile: login, profile URL, business flag, feedback count, rating (0-1), positive / neutral / negative feedback counts, listed item count, country, city (only when the member shows it), email / Facebook / Google verification, average response time, holiday mode and the date last seen. Public buyer-relevant fields only. An unknown id is a 404. 1 credit.",
    {
      country: siteCode(),
      user_id: userId(),
    },
    post("seller"),
  );

  server.tool(
    "get_vinted_seller_products",
    `The items one Vinted member has listed, newest first (default), cheapest first or by relevance, up to 96 per page: id, title, URL, price, currency, service_fee, total_price, brand, size, condition, favourite count, reserved, sold and promoted flags and photos; ${FEE}. Also total_results, total_pages and has_more. A member with no listings (or an unknown id) returns an empty list. 1 credit.`,
    {
      country: siteCode(),
      user_id: userId(),
      sort: z.enum(WARDROBE_SORTS).optional()
        .describe("newest_first (default), price_low_to_high or relevance."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based, up to 500. Defaults to 1."),
      limit: z.number().int().min(1).max(96).optional()
        .describe("Items per page, 1-96. Defaults to 20."),
    },
    post("seller-products"),
  );

  server.tool(
    "get_vinted_seller_feedback",
    "Reviews left for one Vinted member, newest first, up to 50 per page: rating 1-5, review text, date, whether it is Vinted's automatic feedback, and the member's reply. Reviewer identities and the items reviewed are not included. Also total_results, total_pages and has_more. 1 credit.",
    {
      country: siteCode(),
      user_id: userId(),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based, newest first, up to 500. Defaults to 1."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Feedback per page, 1-50. Defaults to 20."),
    },
    post("seller-feedback"),
  );

  server.tool(
    "get_vinted_brands",
    "Find Vinted brands by name: brand id (what search_vinted's brand_ids takes), title, slug, URL, number of listings, luxury flag and whether Vinted authenticity-checks it. 1 credit.",
    {
      country: siteCode(),
      query: z.string().min(1).max(100)
        .describe("Brand name or part of it, e.g. 'barbour'."),
    },
    post("brands"),
  );

  server.tool(
    "get_vinted_suggestions",
    "The Vinted search-box autocomplete for a partial query, in the country site's language: up to 10 suggestions, each with its type (popular_search, or the catalog match it comes from such as brand, brand+parent_cat or attr). 1 credit.",
    {
      country: siteCode(),
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'barb'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_vinted_filters",
    "The options of one Vinted search filter (size, condition, color or material) with live item counts, optionally for a query and a category: id (what search_vinted's size_ids, status_ids, color_ids and material_ids take), localized title, item count, the size group (e.g. \"Women > Women's items\") and, for conditions, the description. 1 credit.",
    {
      country: siteCode(),
      filter: z.enum(FILTER_CODES)
        .describe("size, status (condition), color or material."),
      query: z.string().max(200).optional()
        .describe("Count options for this search, e.g. 'dress'. Optional."),
      category_id: numericId(9).optional()
        .describe("Count options within this category, e.g. 1904 (Women). Sizes are grouped per category, so pass one for size."),
    },
    post("filters"),
  );

  server.tool(
    "get_vinted_categories",
    "The Vinted category tree in the country site's language (9 top-level categories, about 3,000 in all): id (what search_vinted's category_id takes), title, URL and children; or one category's subtree with its path. 1 credit.",
    {
      country: siteCode(),
      parent_id: numericId(9).optional()
        .describe("Return only this category's subtree (1904 is Women). Omit for the whole tree."),
    },
    post("categories"),
  );
}
