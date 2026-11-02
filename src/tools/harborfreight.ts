import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/harborfreight.ts. Cross-field rules the
// backend enforces and zod here does not: search takes query, category_id, or
// both; product takes sku, id or url; stores takes query OR latitude+longitude;
// availability takes store_ids, zip, or latitude+longitude. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["best_match", "price_low", "price_high", "member_price_low", "member_price_high", "top_rated", "newest"] as const;

const PRICE_FIELDS =
  "price (what the shelf charges now), regular_price, on_sale and clearance flags, sale (sale price, end date, savings, banner code; CLR is clearance), coupon (public coupon price, code, expiry and per-customer limit), member_deal (Inside Track Club member price) and compare_at (the competitor brand, model and price Harbor Freight quotes). Prices are national and in dollars.";

const sku = () => z.string().regex(/^\d{3,8}$/);

const listingFields = () => ({
  category_id: z.string().regex(/^\d{1,7}$/).optional()
    .describe("Harbor Freight category id, e.g. '1827' (Drills, Drivers & Drill Presses). Ids are the value of the category facet in any search answer."),
  page: z.number().int().min(1).max(100).optional()
    .describe("Page, 1-based."),
  page_size: z.number().int().min(1).max(48).optional()
    .describe("Results per page, 1-48. Default 36."),
  sort: z.enum(SORTS).optional()
    .describe("best_match (default), price_low, price_high, member_price_low, member_price_high (Inside Track Club price), top_rated or newest."),
  brand: z.string().min(1).max(60).optional()
    .describe("Only this brand, as listed in the brand facet, e.g. 'BAUER', 'HERCULES', 'PITTSBURGH'. Case-insensitive."),
});

export function registerHarborFreightTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/harborfreight/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_harbor_freight",
    `Search Harbor Freight by keyword and/or category, with brand and clearance filters and 7 sorts. Each result has item number (sku), id, title, brand, URL, image, ${PRICE_FIELDS} Plus badges, rating and review count, where it sells (in store only, online only) and variant info. Also returns total_results, facets (category ids, brands, ratings, price points, attributes) and, when a keyword maps to a category page (e.g. "wrench"), redirect with that category's results. 1 credit/call.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Search keywords, e.g. 'cordless drill'. Pass this, category_id, or both."),
      ...listingFields(),
      clearance: z.boolean().optional()
        .describe("Only clearance items. Default false."),
    },
    post("search"),
  );

  server.tool(
    "get_harbor_freight_clearance",
    `Harbor Freight clearance items, optionally narrowed by keyword, category or brand. Same fields as search_harbor_freight: each item's clearance price and end date are in sale. 1 credit/call.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Optional keywords to narrow the clearance list, e.g. 'drill'."),
      ...listingFields(),
    },
    post("clearance"),
  );

  server.tool(
    "get_harbor_freight_product",
    `One Harbor Freight product by item number, id or URL: title, brand, UPC, ${PRICE_FIELDS} Plus rating, review count, badges, description, highlights, the full specification table, warranty, shipping notes, owner's manuals, images and variants. An unknown item is a 404. 1 credit.`,
    {
      sku: sku().optional()
        .describe("Harbor Freight item number (a search result's sku), e.g. '73216'. Pass sku, id or url."),
      id: z.number().int().min(1).optional()
        .describe("Numeric product id (a search result's id), e.g. 48725."),
      url: z.string().max(500).optional()
        .describe("harborfreight.com product URL."),
    },
    post("product"),
  );

  server.tool(
    "get_harbor_freight_prices",
    `Current national prices for up to 50 Harbor Freight item numbers in one call: ${PRICE_FIELDS} Unknown item numbers are listed in not_found. 1 credit.`,
    {
      skus: z.array(sku()).min(1).max(50)
        .describe("Up to 50 Harbor Freight item numbers, e.g. ['73216', '59716', '64508']."),
    },
    post("prices"),
  );

  server.tool(
    "get_harbor_freight_stores",
    `Harbor Freight stores near a ZIP code, "City, ST" or coordinates, nearest first: store number (store_id), name, address, phone, coordinates, distance in miles, status, opening date and hours. Use store ids with get_harbor_freight_availability. 1 credit/call.`,
    {
      query: z.string().min(2).max(64).optional()
        .describe("US ZIP code or 'City, ST', e.g. '60601' or 'Los Angeles, CA'. Pass this, or latitude and longitude."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude, e.g. 40.7128."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude, e.g. -74.006."),
      radius: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles, 1-100. Default 50."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Most stores to return, 1-50. Default 10."),
    },
    post("stores"),
  );

  server.tool(
    "get_harbor_freight_availability",
    `In-store stock for up to 20 Harbor Freight items at chosen stores, or at the stores nearest a ZIP code or coordinates. Each store lists every item with stock_status (in_stock, limited, out_of_stock or not_carried), the raw stock_code (IS, LS, NS, null), the aisle, and a nearby store that has it. inventory_updated_at is the time of the daily stock snapshot. Stock is a status, not a unit count. 1 credit/call.`,
    {
      skus: z.array(sku()).min(1).max(20)
        .describe("Up to 20 Harbor Freight item numbers, e.g. ['73216', '58139']."),
      store_ids: z.array(z.string().regex(/^\d{1,5}$/)).min(1).max(20).optional()
        .describe("Up to 20 store numbers from get_harbor_freight_stores, e.g. ['374', '820']. Or pass zip, or latitude and longitude, for the nearest stores."),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US ZIP code, e.g. '90012': stock at the stores nearest to it."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude: stock at the stores nearest to it."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude: stock at the stores nearest to it."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Nearest stores to return with zip or coordinates, 1-100. Default 10."),
    },
    post("availability"),
  );

  server.tool(
    "get_harbor_freight_reviews",
    `Customer reviews for one Harbor Freight item, newest first, with limit/offset paging: title, text, star rating, author, review and purchase dates, incentivized flag, helpful votes and the reviewer's answers (would recommend, what they liked). Also the item's average rating and total review count. An unknown item is a 404. 1 credit/call.`,
    {
      sku: sku()
        .describe("Harbor Freight item number, e.g. '73216'."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Reviews per call, 1-50. Default 10."),
      offset: z.number().int().min(0).max(100000).optional()
        .describe("Reviews to skip, for paging. Default 0."),
    },
    post("reviews"),
  );
}
