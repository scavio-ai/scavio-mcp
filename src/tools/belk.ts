import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/belk.ts (Belk, belk.com, the US Southern department store; US only, USD). Rules the
// backend enforces and zod here does not: product and reviews take product_id or url; store availability takes
// variant_id or items; min_discount is one of Belk's discount bands; filters hold at most 8 facets. Billed on actual
// cost: credits_used in the answer is what was charged. No zod `.default()`: the MCP SDK would post a defaulted field
// on every call.

const SITE = "Belk (belk.com, the US Southern department store), US only, prices in USD";
const TAIL =
  "credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged what it spent. Usually 2 to 15 s; allow a client timeout of at least 90 s.";
const TWO = `2 credits (${TAIL})`;
const PRICES =
  "Prices are as belk.com shows them to visitors who are not signed in: original_price and sale_price {min, max}, on_sale, belk_rewards_tier_prices (Belk's Belk Rewards+ insider / premier / elite prices as shown there, when Belk lists them), coupons [{code, discount_percent, promo_price (Belk's own price with the code, as given), ends (as Belk writes it), requirement}] and promotions [{id, type, message}].";
const ITEM =
  "items [{position, id (what get_belk_product and get_belk_reviews take), title, brand, url, image, rating, review_count, original_price, sale_price, on_sale, belk_rewards_tier_prices, coupons, promotions, badge, is_doorbuster, is_belk_market, colors [{color_id, name, swatch}]}]";
const GRID = `60 items a page: title, page, page_size, total (null past Belk's count), total_is_lower_bound (Belk shows "10,000+"), total_pages, count, sort, applied_filters, ${ITEM}, facets [{name, id, values [{value, label, count, selected}]}] (any value works in filters) and categories [{name, path, cgid, count, children}].`;

const textOrList = z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).max(20)]);
const storeId = z.union([z.string().regex(/^\d{1,5}$/), z.number().int().positive()]);
const PROMOTIONS = ["doorbusters", "super_buys", "sale", "clearance", "todays_offers", "belk_market"] as const;

const grid = {
  page: z.number().int().min(1).max(200).optional()
    .describe("Page, 1 to 200 (60 items a page). Defaults to 1."),
  sort: z.enum(["relevance", "newest", "price_low_to_high", "price_high_to_low", "top_rated", "discount", "doorbusters_first"]).optional()
    .describe("Belk's 7 sorts: relevance (default), newest, price_low_to_high, price_high_to_low, top_rated, discount (highest percent off at the top), doorbusters_first."),
  brand: textOrList.optional()
    .describe("Items of these brands, as the Brand facet spells them, e.g. 'Calvin Klein'. A list matches any of them."),
  color: textOrList.optional()
    .describe("Items in these colour groups (the Color facet: Black, Blue, Red ...). A list matches any of them."),
  size: textOrList.optional()
    .describe("Items in these sizes, as group/size from the size facets (facets[].values[].value where id is hierarchical_sizes), e.g. \"Women's Regular/10\", \"Plus/1X\"."),
  coupon_code: textOrList.optional()
    .describe("Items a Belk coupon applies to (the Coupon Eligible facet), e.g. 'BFISHERE'."),
  min_discount: z.number().int().optional()
    .describe("Items at least this percent off: one of Belk's discount bands 20, 30, 40, 50, 60, 70, 80."),
  min_price: z.number().min(0).optional()
    .describe("Minimum price in USD."),
  max_price: z.number().min(0).optional()
    .describe("Maximum price in USD."),
  pickup_store_id: storeId.optional()
    .describe("Items available for free store pickup at this Belk store (stores[].store_id from get_belk_stores), e.g. '452'."),
  filters: z.record(z.string(), textOrList).optional()
    .describe("Any other facet from a previous answer's facets: its id to one value or a list, e.g. {\"Gender\": \"Women\", \"Occasion\": \"Casual\"}. Up to 8."),
};
const salesPromotion = z.union([z.enum(PROMOTIONS), z.array(z.enum(PROMOTIONS)).max(6)]).optional()
  .describe("Items in Belk's Sales & Promotions: doorbusters, super_buys, sale, clearance, todays_offers, belk_market (Belk Market, the marketplace). A list matches any of them.");

const productTarget = {
  product_id: z.union([z.string().regex(/^[A-Za-z0-9]{5,30}$/), z.number().int().positive()]).optional()
    .describe("Belk product id (items[].id, or the part before .html in a product link), e.g. '18000269151219'. Send product_id or url."),
  url: z.string().min(10).max(600).optional()
    .describe("Or a belk.com product link (items[].url)."),
};
const variantId = z.string().regex(/^[A-Za-z0-9]{6,30}$/)
  .describe("Belk variant id (variants[].variant_id from get_belk_product), e.g. '0480046046048'.");
const orin = z.string().regex(/^\d{3,15}$/).optional()
  .describe("The variant's orin from get_belk_variant. With it there is no lookup (1 credit). A wrong orin answers 0 at every store.");

export function registerBelkTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/belk/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_belk",
    `${SITE} keyword search, sorted with Belk's 7 sorts and filtered by brand, colour, size, sales promotion (doorbusters, super buys, sale, clearance, today's offers, Belk Market), coupon code, discount band, price range, free-pickup store and any other facet: query, ${GRID} ${PRICES} Belk answers a query it cannot match with its closest matches. Captured 2026-11-27: sweater gave 7193 results, the first the Vince Camuto Women's Dolman Sleeve Crew Neck Sweater at 29.99 USD (original 69), a Doorbuster. ${TWO}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'sweater'."),
      sales_promotion: salesPromotion,
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_belk_category",
    `One ${SITE} category's products by path or link, with the same sorts and filters as search_belk: category {path, cgid, name} and ${GRID} ${PRICES} Captured 2026-11-27: women/womens-clothing/sweaters (Women's Sweaters) held 2334 items over 39 pages. An unknown category is a charged not-found. ${TWO}`,
    {
      category: z.string().min(1).max(600)
        .describe("A Belk category path (categories[].path from get_belk_categories), e.g. 'women/womens-clothing/sweaters', or a belk.com category link."),
      sales_promotion: salesPromotion,
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_belk_deals",
    `${SITE} deal listings: Doorbusters (default), Super Buys, Clearance, Sale Items or Today's Offers, across Belk or inside one category, with the same sorts and filters as search_belk: type, belk_filter, category and ${GRID} ${PRICES} End dates: a variant's sale end date is on get_belk_variant (sale_ends), a coupon's in coupons[].ends. Belk's weekly ad and coupon pages are not available. Captured 2026-11-27: Doorbusters across Belk showed 10,000+ items. ${TWO}`,
    {
      type: z.enum(["doorbusters", "super_buys", "clearance", "sale", "todays_offers"]).optional()
        .describe("doorbusters (default), super_buys, clearance, sale (Sale Items) or todays_offers (Today's Offers)."),
      category: z.string().min(1).max(600).optional()
        .describe("Deals inside this Belk category (a path from get_belk_categories), e.g. 'women'. Without it: all of Belk."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_belk_categories",
    `The ${SITE} department menu: count, node_count, categories [{name, path (what get_belk_category takes), url, cgid, children [...]}]. Captured 2026-11-27: 15 departments and 728 nodes. ${TWO}`,
    {},
    post("categories"),
  );

  server.tool(
    "get_belk_product",
    `One ${SITE} product by link or product id: requested, redirected, id, name, brand, brand_url, url, style_number, availability, currency, original_price, sale_price, price_label (e.g. Doorbuster), on_sale, belk_rewards_tier_prices, badge, is_doorbuster, coupons, promotions, rating, review_count, breadcrumbs, details [{title, items}] (details, specifications, material and care), images {main, gallery}, size_chart_url, is_belk_market, dropship, default_variant_id, colors [{color_id, name, image, swatch, all_sizes_on_sale}], sizes [{size_id, name}], variant_count and variants [{variant_id, color_id, color, size_id, size, online_units (Belk's online stock), out_of_stock}]. Per-variant UPC, orin and sale end date: get_belk_variant. ${PRICES} Captured 2026-11-27: the Vince Camuto Women's Dolman Sleeve Crew Neck Sweater at 29.99 USD (original 69, Doorbuster), rated 4.71 from 7 reviews, in 29 colours and 7 sizes, 147 variants. An unknown id is a charged not-found. Credits: 2 for Belk's canonical product link; 4 when Belk redirects to it, as an older or shortened link and a product id alone do (${TAIL})`,
    productTarget,
    post("product"),
  );

  server.tool(
    "get_belk_variant",
    `One ${SITE} variant (a colour + size of a product): variant_id, product_id, upc, orin (what get_belk_store_availability takes), color_id, size_id, availability, pickup_eligible, ship_eligible, online_only, dropship, max_buy_quantity, currency, price_type (Belk's: Doorbuster, Sale ...), original_price, sale_price, sale_ends (Belk's sale end date), badge, coupons, coupon_excluded, promotions and images. With include_color_prices: color_prices [{color_id, price, price_text, price_type, out_of_stock, all_sizes_on_sale}] for every colour at this size (Belk can price colours of one product differently). Captured 2026-11-27: variant 0480046046048 (size M) of the Dolman sweater at 29.99 USD, original 69, a Doorbuster until 2026-11-28. An unknown variant is a charged not-found. Credits: 2, or 4 with include_color_prices (${TAIL})`,
    {
      variant_id: variantId,
      include_color_prices: z.boolean().optional()
        .describe("Also the price and stock flag of every colour at this variant's size (4 credits instead of 2)."),
    },
    post("variant"),
  );

  server.tool(
    "get_belk_store_availability",
    `Exact store stock for 1 to 5 ${SITE} variants at 1 to 10 Belk stores, as Belk's store pickup check reports it: store_ids, count, variants [{variant_id, orin, orin_source (given or looked_up), in_stock_store_count, stores [{store_id, units, status (in_stock, limited = Belk's "Only N left!" at 1 to 5, out_of_stock)}]}], plus upc and the national price fields when the variant was looked up, notes. Belk prices are the same in every store. Captured 2026-11-27: one variant at stores 234, 345 and 497 showed 2, 3 and 4 units, all limited. A wrong orin answers 0 at every store, so it is never guessed. An unknown variant is a charged not-found. Credits: 1 per call when every orin is given (from get_belk_variant), plus 2 per variant whose orin is looked up (one variant without orin: 3; five: 11) (${TAIL})`,
    {
      variant_id: variantId.optional(),
      orin,
      items: z.array(z.object({ variant_id: variantId, orin })).min(1).max(5).optional()
        .describe("Up to 5 variants in one call, instead of variant_id: [{variant_id, orin?}]."),
      store_ids: z.union([z.array(storeId).min(1).max(10), z.string().min(1).max(80)])
        .describe("1 to 10 Belk store ids (stores[].store_id from get_belk_stores), as an array or comma-separated, e.g. ['452', '329']."),
    },
    post("store-availability"),
  );

  server.tool(
    "get_belk_stores",
    `The Belk stores near a US ZIP code: every store within about 150 miles, nearest first, as Belk lists them (Belk takes no radius; a ZIP far from any Belk answers an empty list): zip, count, stores [{store_id, name, address {line1, city, state, zip}, distance_miles, phone, regular_hours, this_week_hours [{day, hours, differs_from_regular (holiday hours Belk flags)}], pickup, closed_today}]. Captured 2026-11-27: ZIP 28202 listed 79 stores, the nearest Charlotte NC - Southpark at 5.2 miles. ${TWO}`,
    {
      zip: z.union([z.string().regex(/^\d{5}(-\d{4})?$/), z.number().int().min(0).max(99999)])
        .describe("A US ZIP code, e.g. '28202'."),
    },
    post("stores"),
  );

  server.tool(
    "get_belk_store",
    `One Belk store by id: store_id, name, address, phone, latitude, longitude, this_week_hours [{day, hours, differs_from_regular}], pickup_location (where in the store orders are picked up) and events. Captured 2026-11-27: store 452, Charlotte NC - Southpark, this week's hours showing Thursday closed and Friday 6AM-10PM, pickup at the Mens Shoe Department. An unknown store is a charged not-found. ${TWO}`,
    {
      store_id: storeId
        .describe("A Belk store id (stores[].store_id), e.g. '452'."),
    },
    post("store"),
  );

  server.tool(
    "get_belk_reviews",
    `The 8 newest reviews of one ${SITE} product as Belk shows them (no further pages, sort or star filter): product_id, total (the count in Belk's review block; it can differ from the product's review_count), count, reviews [{review_id, rating, title, text, date, incentivized}]. No reviewer names. A product without reviews answers an empty list. Captured 2026-11-27: product 590014100580155 counted 2267 reviews, the 8 newest from 2026-11-13 back. ${TWO}`,
    productTarget,
    post("reviews"),
  );
}
