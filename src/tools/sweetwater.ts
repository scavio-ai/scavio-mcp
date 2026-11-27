import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/sweetwater.ts (Sweetwater, sweetwater.com, US only, USD). Rules the backend
// enforces and zod here does not: product, serial units and reviews take exactly one of item_id or url; sort values
// are checked per endpoint (the site's own sort values are accepted too); facets hold at most 12 facets of at most 20
// values each. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE = "Sweetwater (sweetwater.com, the US online music instrument and pro audio retailer), US only, prices in USD";
const ONE = "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const TIME = "Usually 2 to 15 s; allow a client timeout of at least 120 s.";
const MARKET = "Every answer carries store, host, country (us), currency (USD) and language (en).";
const HIT =
  "position, item_id (what get_sweetwater_product takes), name, brand, type, category, url, image, condition, price (the price now), retail_price, base_price, has_price_drop, instant_rebate, mail_in_rebate, bundle_savings, special_offer {title, value}, in_stock, on_hand (units on hand), available (units available to sell; can be negative when more are sold than on hand), on_order (units on order), pre_order, special_order, free_shipping, open_box [{item_id, condition (Demo), price}], rating, review_count";
const CARD =
  "position, item_id, name, url, image, price, offer (the offer text as shown), rating, review_count, stock (the stock text as shown, e.g. In Stock or Only 6 Left; null when the card shows none), open_box {item_id, price, text}, serial {number, weight} (a serial-numbered instrument), bundle_savings_available";

const LIST_SORTS = ["popular", "rating", "lightest", "newest", "price_desc", "price_asc", "brand"] as const;
const LIST_SORT_TEXT =
  "popular (Most Popular, default), rating (Customer Rating), lightest (Lightest Guitar), newest (Newest Arrivals), price_desc (Price High - Low), price_asc (Price Low - High), brand (Brand A - Z). The site's own values (low2high, high2low, reviews, name) are accepted too.";

const itemId = z.string().min(2).max(40).optional()
  .describe("A Sweetwater item id (items[].item_id; the part before -- in a sweetwater.com/store/detail/ link), e.g. 'DD8'. An open-box unit has its own id (open_box[].item_id). Send item_id or url.");
const itemUrl = z.string().min(10).max(500).optional()
  .describe("Or a sweetwater.com product link (a ?cond= open-box link selects that unit).");
const page = z.number().int().min(1).max(120).optional()
  .describe("Page, 1-based, 42 products per page (default 1). Sweetwater counts at most 5,000 products in a listing, so the last page is 120.");

export function registerSweetwaterTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/sweetwater/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_sweetwater",
    `${SITE} keyword search. Free-text keywords show 42 results in Sweetwater's relevance order (the site does not page or sort free-text results): items [${HIT}]. A keyword that matches a category opens that category instead (landed_on category, e.g. 'stratocaster'): items are then its listing cards [${CARD}] with sort and page applied, plus facets. A keyword that opens one product page answers landed_on product and landed_url (read it with get_sweetwater_product). Returns query, landed_on (search, category, product or page), category {id, name, url}, sort, page, total, total_pages, per_page, count, items, facets, note. ${MARKET} Captured 2026-11-27: boss delay pedal gave 20 results, the first the Boss DD-8 Digital Delay Pedal at 168.88 USD (retail 197.99) with 204 units available. ${TIME} ${ONE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'boss delay pedal'."),
      sort: z.string().max(20).optional()
        .describe(`relevance (default) or a category sort: ${LIST_SORT_TEXT} Free-text results stay in relevance order; a sort applies when the keyword opens a category (landed_on category).`),
      page: page
        .describe("Page, 1-based (default 1). Free-text search shows 42 results on one page (a page past 1 is an empty list); when the keyword opens a category, pages of 42 apply (up to 120)."),
    },
    post("search"),
  );

  server.tool(
    "get_sweetwater_category",
    `One ${SITE} category listing, 42 products per page with the site's 7 sorts and facet filters: category {id, name, url}, breadcrumbs, sort, page, total (as the site counts it, at most 5,000), total_pages, per_page, requested_facets, applied_facets, count, items [${CARD}], facets [{name, values [{value, count, selected}]}] (send back in facets). ${MARKET} Captured 2026-11-27: c590 (Solidbody Guitars) counted 5,000 products, and sorted price_asc the first was the Kramer Focus VT-211S Electric Guitar - Teal at 149 USD. An unknown category is a charged not-found. ${TIME} ${ONE}`,
    {
      category: z.string().min(1).max(300)
        .describe("A Sweetwater category: an id ('c590'), a path ('c590--Solid_Body_Guitars') or a sweetwater.com category link (facets on a pasted link are kept when facets is not sent)."),
      sort: z.string().max(20).optional()
        .describe(LIST_SORT_TEXT),
      page,
      facets: z.record(z.string(), z.union([z.string().max(120), z.array(z.string().max(120)).max(20)])).optional()
        .describe("Facet filters as the site names them (facets[].name and values[].value of an answer), several values per facet, up to 12 facets, e.g. {\"Availability\": [\"In Stock\"], \"Brand\": [\"Fender\", \"Gibson\"], \"Price Range\": [\"$500 - $1,000\"]}."),
    },
    post("category"),
  );

  server.tool(
    "get_sweetwater_product",
    `One ${SITE} product by item_id or link: item_id, requested, name, full_name, brand, mpn, type, category, breadcrumbs, url, condition (New, or Used for an open-box unit), open_box, serial_number (an open-box or serial-numbered unit), price, currency, was_price, price_drop, instant_savings, new_price (the new price, on an open-box unit), availability (InStock, BackOrder ... as given), stock_text (as shown, e.g. In Stock! or Backordered - More On The Way!), estimated_by (the backorder date text), warehouse_flags {fw, az} (the page's in-stock flags per warehouse, as given), ship_weight_lbs, free_shipping, return_days, rating, review_count, dimensions {height_in, width_in, depth_in, weight_lbs}, images (the page's main image), specs [{name, value}]. ${MARKET} Captured 2026-11-27: DD8, the Boss DD-8 Digital Delay Pedal, at 168.88 USD (was 197.99, a 29.11 price drop), In Stock!, rated 5 from 39 reviews, with 17 specs. An unknown id is a charged not-found. ${TIME} ${ONE}`,
    { item_id: itemId, url: itemUrl },
    post("product"),
  );

  server.tool(
    "get_sweetwater_serial_units",
    `The serial-numbered units of one ${SITE} item (Sweetwater photographs and weighs many guitars and basses one by one): item_id, requested, name, brand, condition, price, parent_item_id, parent_price, url, serial_sold, serial_reserved (the flags of the requested unit, as given), open_box {item_id, condition, price}, count, units [{position, serial_number, item_id, weight_lbs (its shipping weight as given), url, photos [{view, url}]}], note. An item sold without serial numbers has an empty units list. ${MARKET} Captured 2026-11-27: StratAU2HEUB, the Fender American Ultra II Stratocaster HSS in Ultraburst at 2359.99 USD, listed 6 units (the first 8.05 lbs) and a Demo unit at 1919.99. An unknown id is a charged not-found. ${TIME} ${ONE}`,
    { item_id: itemId, url: itemUrl },
    post("serial-units"),
  );

  server.tool(
    "get_sweetwater_reviews",
    `Customer reviews of one ${SITE} product: every review the product has, filtered by stars, sorted newest, oldest, highest or lowest and paged: item_id, requested, name, brand, average_rating, total_reviews, star_percent {"5": 69, ...}, stars, sort, page, limit, total (reviews matching stars), total_pages, count, reviews [{rating, title, text, date}]. No reviewer names, locations or backgrounds. ${MARKET} Captured 2026-11-27: SM58, the Shure SM58 Cardioid Dynamic Vocal Microphone, averaged 4.7 from 372 reviews, 69 percent of them 5 stars. An unknown id is a charged not-found. ${TIME} ${ONE}`,
    {
      item_id: itemId,
      url: itemUrl,
      stars: z.number().int().min(1).max(5).optional()
        .describe("Reviews with this many stars (the site's own filter)."),
      sort: z.enum(["newest", "oldest", "highest", "lowest"]).optional()
        .describe("newest (default), oldest, highest or lowest: the site's review sort menu."),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Reviews page, 1-based (default 1)."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Reviews per page, 1 to 100 (default 25)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_sweetwater_deals",
    `The ${SITE} Deal Zone: the whole Deal Zone or one of its pages (guitar-deals, price-drops, demos, bundles, rebates-and-promos ...), 42 per page, with the Deal Zone's sort menu: deal, deal_name, sort, page, total, total_pages, per_page, sale_event {name, starts, ends, time_zone} (the sale window as the page gives it; the page states no time zone), count, items [${HIT}], deal_pages [{slug, name}] (what deal takes). ${MARKET} Captured 2026-11-27: guitar-deals held 8,493 items under the Black Friday event from 2026-11-13 10:00:00 to 2026-11-30 02:59:00, and the Deal Zone listed 145 deal pages. An unknown deal page is a charged not-found. ${TIME} ${ONE}`,
    {
      deal: z.string().min(1).max(100).optional()
        .describe("A Deal Zone page (deal_pages[].slug of an answer: guitar-deals, price-drops, demos, bundles, rebates-and-promos ...). Leave out for the whole Deal Zone."),
      sort: z.string().max(20).optional()
        .describe("featured (the Deal Zone's own order, default), popular, best_deals (Best Deals), newest_deals (Newest Deals), ending_soon (Ending Soon), newest, price_desc, price_asc, brand."),
      page,
    },
    post("deals"),
  );
}
