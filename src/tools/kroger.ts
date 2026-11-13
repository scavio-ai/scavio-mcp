import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/kroger.ts (kroger.com plus the QFC and Fred
// Meyer banners). Cross-field rules the backend enforces and zod here does not:
// product takes product_url or upc; stores takes exactly one of zip, query or
// store_id; category takes url or taxonomy_id, not both; coupons takes
// store_id or zip, not both; a banner that contradicts a URL host or a
// store_id prefix is a 400. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const BANNERS = ["kroger", "qfc", "fred_meyer"] as const;

const BANNER_TEXT = "kroger (kroger.com, default), qfc (QFC, qfc.com: Washington and Oregon) or fred_meyer (Fred Meyer, fredmeyer.com: the Pacific Northwest and Alaska, grocery plus general merchandise, apparel and home)";
const CHARGE = "Failed upstream calls are not charged (they are retried automatically); a not-found is charged.";
const CENTS = "Prices are integer cents (price 399 = $3.99).";
const SITE_STORE = "Prices, promotions, stock and aisle are those of the store returned in store (location_id, name, banner, division, store_number, address): a store the site chooses, which can change between calls and cannot be picked here. For one specific store use get_kroger_prices with a store_id from find_kroger_stores.";
const ITEM = "upc (for get_kroger_product and get_kroger_prices), name, brand, url, image, price, list_price, promo_price with promo_ends_at, price_display, unit_price_display, nfor / nfor_price (multi-buy), size, in_stock (null when the store has no stock record), stock_level, SNAP eligibility, dietary info, category and rating (average, count, star distribution; no review text)";
const GRID = `banner, store, total (all matches, the site counts up to 1000), count and products with ${ITEM}. Only the first page (up to 24 products) is available and there is no sort: page above 1 is a 400, not charged.`;

const banner = () => z.enum(BANNERS).optional()
  .describe(`The store banner: ${BANNER_TEXT}. Defaults to kroger. Prices differ by banner and by store.`);
const storeBanner = () => z.enum(BANNERS).optional()
  .describe(`The store banner: ${BANNER_TEXT}. Optional with store_id: QFC ids start with 705, Fred Meyer ids with 701, anything else is kroger.`);
const storeId = () => z.string().regex(/^\d{8}$/)
  .describe("A store's 8-digit location_id: stores[].location_id of find_kroger_stores, e.g. '70500847'.");
const firstPage = () => z.number().int().min(1).max(100).optional()
  .describe("Results page. Only page 1 (up to 24 products) is available; page above 1 is refused with a 400 before any charge. Narrow the query or use get_kroger_category instead.");

export function registerKrogerTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/kroger/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_kroger",
    `Search Kroger, QFC or Fred Meyer products by keyword (banner). Returns ${GRID} ${SITE_STORE} ${CENTS} ${CHARGE} 2 credits.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'organic milk'."),
      banner: banner(),
      page: firstPage(),
    },
    post("search"),
  );

  server.tool(
    "get_kroger_product",
    `One Kroger, QFC or Fred Meyer product by product_url or upc: the search fields plus description, nutrition facts, ingredients, allergens, images, country of origin, dimensions, weight, dietary flags, the aisle at the store (store_location) and breadcrumbs. ${SITE_STORE} ${CENTS} An unknown upc is a charged 404. ${CHARGE} 2 credits.`,
    {
      product_url: z.string().min(1).max(500).optional()
        .describe("Full or relative product URL on kroger.com, qfc.com or fredmeyer.com (products[].url of search_kroger), e.g. '/p/simple-truth-organic-lactose-free-2-reduced-fat-milk-half-gallon/0001111050438'. An absolute URL sets the banner; a banner that contradicts its host is a 400."),
      upc: z.string().min(1).max(20).optional()
        .describe("The product's UPC (products[].upc of search_kroger, or the digits at the end of a product URL: /p/{slug}/{upc}), e.g. '0001111050438'."),
      slug: z.string().min(1).max(300).optional()
        .describe("Product slug (the readable part of the product URL). Optional with upc."),
      banner: banner(),
    },
    post("product"),
  );

  server.tool(
    "get_kroger_prices",
    `Price, promotion, stock and aisle for 1 to 25 UPCs at one Kroger, QFC or Fred Meyer store you choose (store_id from find_kroger_stores). The same item is priced differently by banner and by store. Per UPC: upc, name, brand, size, url, image, price, promo_price, promo_ends_at, on_sale, price_display, unit_price_display, in_stock (null when the store has no stock record), stock_level, quantity (the number the site reports as available; an estimate, not a shelf count), aisle (description, number, side, bay, shelf), fulfillment (pickup, delivery, in_store, ship) and priced_at (the store that priced it). UPCs the site does not know are listed in not_found. Also store (location_id, name, banner, address) and count. ${CENTS} An unknown store_id is a charged 404. Can take up to about a minute. ${CHARGE} 3 credits.`,
    {
      store_id: storeId(),
      upcs: z.array(z.string().regex(/^\d{13}$/)).min(1).max(25)
        .describe("1 to 25 13-digit UPCs as the site writes them (products[].upc of search_kroger or get_kroger_category), e.g. ['0001111050438', '0081006334306']."),
      banner: storeBanner(),
    },
    post("prices"),
  );

  server.tool(
    "find_kroger_stores",
    `Kroger, QFC or Fred Meyer stores near a ZIP or a city / address (nearest first), or one store by store_id. Send exactly one of zip, query or store_id. Each store: location_id (use it as store_id on get_kroger_prices, get_kroger_coupons and get_kroger_suggestions), banner, type (store or fuel_center), name, store_number, address (line1, city, state, zip), coordinates (lat, lng), phone, timezone, hours, open_24_hours, departments (name, phone, hours), has_pharmacy, has_fuel_center, pickup, delivery and distance_miles. Fuel center locations only, no fuel prices. Partner fuel stations are never returned; other Kroger banners only with include_other_banners. An unknown store_id is a charged 404. ${CHARGE} 1 credit.`,
    {
      zip: z.string().regex(/^\d{5}$/).optional()
        .describe("A 5-digit US ZIP code, e.g. '98101'."),
      query: z.string().min(2).max(100).optional()
        .describe("A city or address, as typed in the site's store finder, e.g. 'Portland, OR'."),
      store_id: storeId().optional(),
      banner: storeBanner(),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Stores to return, 1-50. Defaults to 10."),
      include_other_banners: z.boolean().optional()
        .describe("Also return nearby stores of other Kroger banners (for example Fred Meyer stores near a QFC search). Defaults to false."),
    },
    post("stores"),
  );

  server.tool(
    "get_kroger_category",
    `A Kroger, QFC or Fred Meyer category listing by /pl/ URL or taxonomy_id (send one, not both): category (id, name, url) and ${GRID} ${SITE_STORE} ${CENTS} ${CHARGE} 1 credit.`,
    {
      url: z.string().min(1).max(400).optional()
        .describe("A category listing URL (/pl/<name>/<id>) on kroger.com, qfc.com or fredmeyer.com, e.g. 'https://www.fredmeyer.com/pl/headphones-earbuds-headsets/2900300001'. The URL's host sets the banner."),
      taxonomy_id: z.string().regex(/^\d{3,14}$/).optional()
        .describe("The digits at the end of a /pl/ URL, e.g. '08190'. Category ids are shared across banners."),
      slug: z.string().min(1).max(120).optional()
        .describe("The name part of a /pl/ URL, e.g. 'Import-Beer'. Optional with taxonomy_id; without it category.name is null."),
      banner: banner(),
      page: firstPage(),
    },
    post("category"),
  );

  server.tool(
    "get_kroger_deals",
    `This week's weekly digital deals of Kroger, QFC or Fred Meyer: deals_week (id, ends_at: the promotion end most deal items share) and ${GRID} Items on a store promotion carry promo_price and promo_ends_at; items whose deal is a digital coupon show the shelf price (the coupon and its deal price are in get_kroger_coupons, tag Weekly Digital Deals). ${SITE_STORE} ${CENTS} The printed weekly ad circular is not available. ${CHARGE} 1 credit.`,
    {
      banner: banner(),
      page: firstPage(),
    },
    post("deals"),
  );

  server.tool(
    "get_kroger_coupons",
    `The digital coupons offered at one Kroger, QFC or Fred Meyer store (store_id, or the banner's store nearest a zip; send one, not both), 24 per page, optionally one department (category) or a text match (query). Each coupon: id, brand, title, description, details (the terms), savings (type amount_off / percent_off / price / free_item / other, amount in cents, percent), type, min_quantity, categories, tags (Weekly Digital Deals, Delivery Only...), valid_for (pickup, delivery, in_store), max_redemptions, starts_at, clip_by, expires_at (YYYY-MM-DD) and image. Also store, page, page_size, count, total_at_store (before any filter), has_more and the categories to filter on. Listing only: coupons are not clipped and no account is used. ${CHARGE} 1 credit.`,
    {
      store_id: storeId().optional(),
      zip: z.string().regex(/^\d{5}$/).optional()
        .describe("A 5-digit ZIP: the banner's nearest store is used. Alternative to store_id."),
      banner: storeBanner(),
      page: z.number().int().min(1).max(50).optional()
        .describe("Page of coupons, 24 per page, 1-based. Defaults to 1. Follow has_more."),
      category: z.string().min(2).max(60).optional()
        .describe("Only coupons in one department: a name from the response's categories list, e.g. 'Dairy'."),
      query: z.string().min(2).max(100).optional()
        .describe("Only coupons whose brand or text matches, e.g. 'coffee'."),
    },
    post("coupons"),
  );

  server.tool(
    "get_kroger_suggestions",
    `Kroger, QFC or Fred Meyer search box suggestions for a partial query: suggestions (text, type), count and the store they were asked for. Without store_id the banner's store nearest a representative ZIP is used (Kroger 45202 Cincinnati, QFC 98101 Seattle, Fred Meyer 97201 Portland). ${CHARGE} 1 credit.`,
    {
      query: z.string().min(2).max(100)
        .describe("What a shopper has typed so far (2+ characters), e.g. 'almond mi'."),
      banner: storeBanner(),
      store_id: storeId().optional(),
    },
    post("suggestions"),
  );
}
