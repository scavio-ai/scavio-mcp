import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/gap.ts (Gap Inc.: Gap, Old Navy, Banana
// Republic, Athleta, Gap Factory, Banana Republic Factory; US in USD, Canada in
// CAD, English or French). Cross-field rules the backend enforces and zod here
// does not: product takes pid or url; category takes cid or url; stores takes
// zip or latitude + longitude; store stock takes sku_ids or style_id; language
// fr needs country ca; a link sets brand and country. No zod `.default()`: the
// MCP SDK would post a defaulted field on every call.

const BRANDS = ["gap", "old_navy", "banana_republic", "athleta", "gap_factory", "banana_republic_factory"] as const;
const SORTS = ["featured", "price_asc", "price_desc", "top_rated", "best_sellers"] as const;
const SALE_TYPES = ["regular", "sale", "clearance"] as const;

const PRICES = "regular_price is the list price, effective_price the price shown (price_type regular, promotion or markdown; percent_off). A checkout code discount is never applied to a price: it shows as text in flags";
const ITEM = "style_id, pid (color id, for get_gap_product and get_gap_prices), name, URL, regular_price, effective_price, price_type, percent_off";
const SITE = "Gap Inc. (gap.com: Gap, Old Navy, Banana Republic, Athleta and the factory stores; brand picks the banner, country us in USD or ca in CAD, language en or fr on ca). Ids are per banner and market.";
const CREDITS = "Failed calls and refused inputs are not charged; a not-found is charged. 1 credit.";

const brand = () =>
  z.enum(BRANDS).optional()
    .describe("gap (default), old_navy, banana_republic, athleta, gap_factory or banana_republic_factory.");
const country = () =>
  z.enum(["us", "ca"]).optional()
    .describe("us (default; the US sites, USD) or ca (the Canadian sites, CAD).");
const language = () =>
  z.enum(["en", "fr"]).optional()
    .describe("en (default) or fr (country ca only: the French Canadian site).");
const sort = () =>
  z.enum(SORTS).optional()
    .describe("featured (default, the site's order), price_asc, price_desc, top_rated or best_sellers.");
const page = () =>
  z.number().int().min(1).max(1000).optional()
    .describe("Page, from 1. A page past the last is a charged not-found.");
const pageSize = () =>
  z.number().int().min(1).max(200).optional()
    .describe("Per page, 1 to 200 (default 50). Large pages are slow (200 items can take 25 s).");
const facets = () =>
  z.record(z.string(), z.string().max(80)).optional()
    .describe("Other filters as facet name to value: facets[].name and facets[].options[].value of an answer, e.g. {\"fit\": \"Baggy\"}.");
const pid = () => z.string().regex(/^\d{9,11}$/);
const storeIdRe = /^\d{1,6}$/;

const brandMarket = { brand: brand(), country: country(), language: language() };

export function registerGapTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/gap/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_gap",
    `Keyword search on one banner of ${SITE} Filters: department, sale_type (regular, sale, clearance), color, min_price / max_price, rating, store_id (available for pickup there) and any facet; sorts featured, price_asc, price_desc, top_rated, best_sellers; up to 200 per page. Returns brand, country, language, currency, query, sort, page, page_size, total, pages, has_more, count, items (${ITEM}, regular_price_range, sale_price_range, rating, review_count, product_type, excluded_from_promotion, free_shipping, color_count, image, badges, flags, colors with pid, name, description, URL, prices, badges, flags and image), facets (name, label, type, options with value, label and count, range) and notes. ${PRICES}. A query the site cannot match answers its closest products. ${CREDITS}`,
    {
      query: z.string().min(1).max(100)
        .describe("Keywords, e.g. 'jeans'."),
      ...brandMarket,
      sort: sort(),
      page: page(),
      page_size: pageSize(),
      department: z.string().min(1).max(60).optional()
        .describe("A department as the facets list it, e.g. 'Women', 'Men', 'Girls', 'Boys'."),
      sale_type: z.enum(SALE_TYPES).optional()
        .describe("regular, sale (promotion) or clearance (markdown): styles with at least one color of that type."),
      color: z.string().min(1).max(40).optional()
        .describe("A color family as the facets list it, e.g. 'Black'."),
      min_price: z.number().min(0).max(100000).optional()
        .describe("Lowest price, in the market's currency."),
      max_price: z.number().min(0).max(100000).optional()
        .describe("Highest price, in the market's currency."),
      rating: z.number().int().min(1).max(4).optional()
        .describe("Minimum star rating, 1 to 4 (\"4 & up\")."),
      store_id: z.string().regex(storeIdRe).optional()
        .describe("Only products available for pickup at this store (get_gap_stores stores[].store_id)."),
      facets: facets(),
    },
    post("search"),
  );

  server.tool(
    "get_gap_category",
    `The items of one Gap Inc. category by cid (and style) from get_gap_categories, or a category link, sorted and filtered by facets, with each color's online unit count as given: brand, country, cid, style, sort, page, page_size, total_colors, pages, has_more, count, items (${ITEM}, rating, review_count, product_type, excluded_from_promotion, flags, colors with pid, name, description, URL, prices, online_units, online_status, backorder_units, badges, flags and image), groups, facets and notes. page_size counts colors. ${PRICES}. An unknown cid is a charged not-found. ${SITE} ${CREDITS}`,
    {
      cid: z.string().regex(/^\d{1,10}$/).optional()
        .describe("A category id: get_gap_categories categories[].cid (the cid of the category link), e.g. '3033077'."),
      style: z.string().regex(/^\d{1,10}$/).optional()
        .describe("The link's style= (categories[].style), when it has one."),
      url: z.string().min(20).max(500).optional()
        .describe("Or a Gap Inc. category link (sets brand and country). Alternative to cid."),
      ...brandMarket,
      sort: sort(),
      page: page(),
      page_size: pageSize(),
      facets: facets(),
    },
    post("category"),
  );

  server.tool(
    "get_gap_categories",
    `One Gap Inc. banner's navigation tree as its site menu lists it: brand, country, language, currency, url, division_count, category_count, categories (name, type: division, section or category; cid, style, url, children) and notes. cid and style are the inputs of get_gap_category. ${SITE} ${CREDITS}`,
    brandMarket,
    post("categories"),
  );

  server.tool(
    "get_gap_product",
    `One Gap Inc. product by color id or product link: pid, style_id, brand, name, URL, currency, category, product_type, rating, rating_count, review_count, review_summary (the site's own summary of its reviews with likes and dislikes; no review texts or reviewer names), highlights, details (section, description, bullets), flags, excluded_from_promotion, max_order_quantity, fully_out_of_stock, pickup_available and variants (REGULAR, TALL, PETITE...: price range, sizes, colors with pid, name, price, stock_status, low_stock, out_of_stock, final_sale, flags, badges, image and skus: sku_id, size, regular_price, effective_price, price_type, discount_percentage, discount_saving, on_clearance, stock_status (in_stock, low_stock, out_of_stock, on_order), backordered, backorder_date, estimated_ship_date, UPC). A sku_id is what get_gap_store_stock takes. ${PRICES}. A dead or other-market id is a charged not-found. ${SITE} ${CREDITS}`,
    {
      pid: pid().optional()
        .describe("A color id (search items[].pid or colors[].pid; the pid= of a product link), e.g. '403540002'."),
      url: z.string().min(20).max(500).optional()
        .describe("Or a Gap Inc. product link (sets brand and country). Alternative to pid."),
      ...brandMarket,
    },
    post("product"),
  );

  server.tool(
    "get_gap_prices",
    `Current prices for up to 100 Gap Inc. colors in one call, banners may mix: requested, found, items (brand, pid, found, style_id, name, color, category, URL, currency, regular_price, effective_price, max_regular_price, max_effective_price, percent_off, price_types, online_status, rating, review_count, flags, badges, excluded_from_promotion, image) and notes. For price monitoring, poll and store the answers: there is no price history. ${PRICES}. ${SITE} ${CREDITS}`,
    {
      items: z.array(z.union([
        z.string().min(9).max(40),
        z.object({ brand: z.enum(BRANDS).optional(), pid: pid() }),
      ])).min(1).max(100)
        .describe("Up to 100 colors, banners may mix: {\"brand\", \"pid\"} or \"brand:pid\", e.g. [{\"brand\": \"old_navy\", \"pid\": \"903453022\"}, \"athleta:1177198082\"]."),
      brand: brand().describe("The brand of items that do not name one. No default here: every item needs a brand, its own or this one."),
      country: country(),
      language: language(),
    },
    post("prices"),
  );

  server.tool(
    "get_gap_stores",
    `Stores of one Gap Inc. banner near a US ZIP / Canadian postal code or a point, nearest first: brand, country, count, stores (store_id, brand, name, address with lines, city, state, postal_code and country; phone, latitude, longitude, distance_mi, time_zone, hours, holiday_hours (dated), pickup) and notes. An invalid ZIP or postal code is refused. ${SITE} ${CREDITS}`,
    {
      zip: z.string().min(5).max(10).optional()
        .describe("A US ZIP (country us) or a Canadian postal code (A1A 1A1, country ca), e.g. '10001'."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Or a point: latitude with longitude."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude (with latitude)."),
      radius: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles (the site's default when omitted)."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Stores to return, 1 to 20 (default 10)."),
      brand: brand(),
      country: country(),
    },
    post("stores"),
  );

  server.tool(
    "get_gap_store",
    `One Gap Inc. store's public details by store id: store_id, brand, brand_name, name, status, opened, address, phone, latitude, longitude, time_zone, languages, pickup, services (in_store_pickup, ship_from_store, order_in_store) and notes. Hours are on get_gap_stores. An unknown id is a charged not-found. ${SITE} ${CREDITS}`,
    {
      store_id: z.string().regex(storeIdRe)
        .describe("A store id (get_gap_stores stores[].store_id), e.g. '4132'."),
      brand: brand(),
      country: country(),
    },
    post("store"),
  );

  server.tool(
    "get_gap_store_stock",
    `Pickup stock at up to 10 Gap Inc. stores for up to 20 SKUs (or every SKU of one style), as the site's buckets: brand, country, store_ids, sku_ids, sku_count, skus (sku_id; pid, variant and status for a style; stores with store_id and status: in_stock, low_stock or out_of_stock) and notes. No unit counts and no per-store price exist (an in-store price may differ from the online price). Sizes and colors of each sku_id are on get_gap_product. ${SITE} ${CREDITS}`,
    {
      store_ids: z.array(z.string().regex(storeIdRe)).min(1).max(10)
        .describe("1 to 10 store ids from get_gap_stores (same banner and market), e.g. ['220', '1519', '1456']."),
      sku_ids: z.array(z.string().regex(/^\d{12,15}$/)).min(1).max(20).optional()
        .describe("1 to 20 SKU ids (get_gap_product colors[].skus[].sku_id), e.g. ['4035400023503']."),
      style_id: z.string().regex(/^\d{5,8}$/).optional()
        .describe("Or a style id (every SKU of the style): get_gap_product style_id or search items[].style_id."),
      brand: brand(),
      country: country(),
    },
    post("store-stock"),
  );

  server.tool(
    "get_gap_suggestions",
    `A Gap Inc. banner's search box suggestions for what has been typed: count, suggestions (query, display_query, filters with key, value and name), product_count, products (pid, name, URL, regular_price, effective_price, price_type, sale_price_range, colors, image) and notes. ${SITE} ${CREDITS}`,
    {
      query: z.string().min(1).max(100)
        .describe("What has been typed so far, e.g. 'jea'."),
      ...brandMarket,
    },
    post("suggestions"),
  );

  server.tool(
    "get_gap_trending",
    `The trending searches a Gap Inc. banner's search box shows, in its order: brand, country, language, count, searches and notes. ${SITE} ${CREDITS}`,
    brandMarket,
    post("trending"),
  );

  server.tool(
    "get_gap_deals",
    `A Gap Inc. banner's current promotions as its promo drawer words them, and its menu's sale, deal and clearance links: offer_count, offers (promo_id, text, message, applied e.g. "Applied at checkout", links with name, cid and url), deal_link_count, deal_links (name, path, cid, style, url: cid and style work in get_gap_category) and notes. Scavio never computes a price after a checkout code, and the site gives no end dates. ${SITE} ${CREDITS}`,
    brandMarket,
    post("deals"),
  );
}
