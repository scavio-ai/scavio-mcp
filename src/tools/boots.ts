import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Boots: 4 tools on /api/v1/boots (product, store-stock, stores, store), markets uk (boots.com)
// and ie (boots.ie). No search endpoint yet. Shapes mirror backend/src/routes/boots.ts. Rules the
// backend enforces and zod here does not: product takes url or product_id (exactly one; a link's
// site sets the market, a different market is a 400); store-stock takes postcode (uk) or latitude
// + longitude together, and ie needs latitude + longitude; stores takes postcode or city (exactly
// one; ie takes city only); store takes exactly one of store, store_number (uk only) or name;
// postcodes must be full UK postcodes. No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const FIRST =
  "Boots (boots.com, the UK health and beauty retailer with over 1,800 stores, and boots.ie in Ireland)";
const NAME = "Boots";
const MARKET_TEXT =
  "Markets (market, default uk): uk (boots.com, GBP) or ie (boots.ie, EUR: its own prices, and some UK products are not sold there).";
const BILL =
  "Failed upstream calls and refused inputs are not charged; a not-found is charged. A request answered on its second attempt costs 2 credits (3 for two-step lookups); credits_used is what was charged.";
const NOT_AVAILABLE =
  "Boots search is not available yet: start from a Boots product link or its 8-digit product id. Not available: category, brand and deal lists, reviews, ratings, type-ahead, stock counts, price history (poll and store the answers).";
const SLOW = "Answers usually take 2 to 60 seconds: allow up to 4 minutes.";
const HOURS = "hours [{day, open, close, closed}] (monday to sunday)";

const market = z.enum(["uk", "ie"]).optional()
  .describe("uk (boots.com, GBP, default) or ie (boots.ie, EUR; its own prices, and some UK products are not sold there).");
const postcode = (example: string) => z.string().min(5).max(9).optional()
  .describe(`A full UK postcode (uk only, e.g. ${example}).`);

export function registerBootsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/boots/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_boots_product",
    `One product of ${FIRST} by link or 8-digit product id: market, product_id, requested_id, url, name, brand, price, currency (GBP on uk, EUR on ie), was_price (Boots' was price, when shown), saving (Boots' Save amount), size, unit_price, unit_price_per, unit_price_text (as Boots shows it), item_number, part_number, catentry_id (for get_boots_store_stock), online_in_stock, image, has_variants, variants [{name (shade or size), item_code (for get_boots_store_stock), catentry_id, online_in_stock}], offers [{text, code (a promo code the offer names, e.g. SAVE20)}], advantage_card_offers (the Advantage Card offers Boots names on the page; members add them to their card), description, sections [{title, text}] (e.g. How to use, Ingredients), ingredients. Not on the page: EAN, a price per shade or size, rating and reviews. Captured 2026-11-26: CeraVe AM Facial Moisturising Lotion SPF30 52ml (10331199) at 11.62 GBP on uk (was 15.50) and 13.50 EUR on ie (was 18); Maybelline Fit Me Matte & Poreless Liquid Foundation 30ml (10213975) at 9.99 GBP with 23 shades. A product not sold on the market's site is a charged 404. ${MARKET_TEXT} ${NOT_AVAILABLE} Costs 1 credit. ${BILL} ${SLOW}`,
    {
      url: z.string().min(20).max(500).optional()
        .describe("A Boots product link (www.boots.com or www.boots.ie; the market follows the link), e.g. https://www.boots.com/no7-protect-and-perfect-intense-advanced-serum-30ml-10288490. Send url or product_id."),
      product_id: z.union([z.string().min(8).max(10), z.number().int().positive()]).optional()
        .describe("The 8 digits a Boots product link ends with (e.g. 10288490). Looked up in Boots' product list first (one more call, usually 5 to 20 seconds)."),
      market,
    },
    post("product"),
  );

  server.tool(
    "get_boots_store_stock",
    `Whether the ${NAME} stores near a UK postcode or a point have one product (or one shade or size), from ${FIRST}: market, item_code, catentry_id, postcode or latitude / longitude, count, in_stock_count, stores_searched, message, stores [{name, address {lines, town, county, postcode}, phone, phone_international, latitude, longitude, distance_miles, availability (in_stock, out_of_stock), availability_text (Boots' words), in_stock, stockist (the store carries the line), ${HOURS}, pharmacy_hours, special_hours [{date, reason, open, close, closed, pharmacy_open, pharmacy_close}]}] nearest first. In stock or out of stock per store: Boots shows no unit counts. When no store near the place has it, Boots says so: stores is empty, stores_searched says how many it checked, and the answer is charged (Boots answers an item code it does not know the same way, so take item_code from get_boots_product). A place Boots cannot pin down answers towns [{name, county, latitude, longitude}] to retry with. boots.ie takes latitude and longitude (get_boots_stores returns them for a town). Captured 2026-11-26: CeraVe AM Facial Moisturising Lotion (10331199) near SW11 1QN in stock at 79 of 85 stores; near Dublin (53.34938, -6.26056) at 37 of 41. ${MARKET_TEXT} ${NOT_AVAILABLE} Costs 1 credit. ${BILL} ${SLOW}`,
    {
      item_code: z.union([z.string().min(8).max(11), z.number().int().positive()])
        .describe("Required. get_boots_product variants[].item_code (a shade or size, 11 digits, e.g. 10213975001), or the product's own 8-digit id when it has no shades or sizes."),
      catentry_id: z.union([z.string().min(4).max(10), z.number().int().positive()])
        .describe("Required. get_boots_product catentry_id (e.g. 1838584)."),
      market,
      postcode: postcode("NG2 3AA"),
      latitude: z.number().min(-90).max(90).optional()
        .describe("With longitude: stores near a point. Required on ie (get_boots_stores returns the point for a town)."),
      longitude: z.number().min(-180).max(180).optional().describe("With latitude."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_boots_stores",
    `${NAME} stores near a UK postcode or a town (uk and ie), from ${FIRST}: market, postcode or city, latitude and longitude (the place searched: use them for get_boots_store_stock on ie), count, message, stores [{store_number, store_id, name, address {lines, town, county, postcode}, latitude, longitude, distance_miles, services [{id, name, category}]}] nearest first. Boots' internal staff-only sites are left out. Captured 2026-11-26: 63 stores near SW11 1QN, the nearest London Battersea (868); 9 in Cork on ie, the nearest Cork Patrick Street. Send postcode or city (ie: city). ${MARKET_TEXT} ${NOT_AVAILABLE} Costs 1 credit. ${BILL} ${SLOW}`,
    {
      market,
      postcode: postcode("M1 1AE"),
      city: z.string().min(2).max(60).optional().describe("A town or city (uk and ie, e.g. Cork)."),
    },
    post("stores"),
  );

  server.tool(
    "get_boots_store",
    `One store page of ${FIRST} by store page slug or link, store_number (boots.com) or exact name: market, store (the page slug), store_number, url, name, address {lines, town, county, postcode}, phone, phone_international, latitude, longitude, ${HOURS}, pharmacy_hours, services [{category, name}]. Staff names are left out. Captured 2026-11-26: store 868, London Battersea, open 09:00 to 19:00 on Monday. Send one of store, store_number or name. ${MARKET_TEXT} ${NOT_AVAILABLE} Costs 1 credit. ${BILL}`,
    {
      store: z.string().min(3).max(300).optional()
        .describe("A Boots store page slug or link (boots.com /stores/868-london-battersea-sw11-1qn, boots.ie /stores/cork-boots-patrick-street)."),
      store_number: z.union([z.string().min(1).max(6), z.number().int().positive()]).optional()
        .describe("get_boots_stores stores[].store_number (boots.com, e.g. 868): found on Boots' store A-Z list (one more call)."),
      name: z.string().min(2).max(100).optional()
        .describe("get_boots_stores stores[].name, exactly (for boots.ie, whose store pages are not numbered; e.g. Cork Patrick Street): found on Boots' store A-Z list (one more call)."),
      market,
    },
    post("store"),
  );
}
