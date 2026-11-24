import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/michaels.ts (www.michaels.com for country us,
// canada.michaels.com for country ca with language en or fr; stores, categories and
// suggestions are us only). Rules the backend enforces and zod here does not: language fr
// needs country ca; zip is a US ZIP for us and a Canadian postal code for ca; product takes
// sku or url (a url sets the country); deals needs q or category; pickup needs store; with
// country ca a category is a code path (root//Categories//...), never a /shop/ path. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["best_match", "best_sellers", "new_arrivals", "price_asc", "price_desc", "rating"] as const;
const SELLERS = ["michaels", "marketplace", "michaels_pro"] as const;
const DEAL_TYPES = ["sale", "new", "clearance", "great_buy"] as const;

const NAME = "Michaels (michaels.com, the US and Canada arts and crafts retailer)";
const CHARGES = "Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const TWO = `Costs 2 credits (credits_used is what was charged). ${CHARGES}`;
const PRICES =
  "Price and was price as Michaels shows them (was_price_text keeps its own Reg. label); discount_percent is computed by Scavio from the two. Prices are national per country (USD on www.michaels.com, CAD on canada.michaels.com): the store does not change them, the store matters for stock.";
const NOT_AVAILABLE =
  "Not available: review or Q&A text (rating and review_count only), the weekly ad, coupons, classes and events, aisle locations, Marketplace seller names, custom framing, price history (poll and store the answers), checkout.";
const ITEM =
  "position, sku (the input of get_michaels_product, get_michaels_store_stock and get_michaels_store_inventory), name, url, image, images, category, price, was_price, price_min and price_max (across sizes), was_price_min, was_price_max, price_text and was_price_text (as Michaels writes them), on_sale, discount_percent, unit_price, rating, review_count, seller_type (michaels, marketplace, michaels_pro, dropship), channel, sponsored, store_pickup, same_day_delivery, ship_to_me, online_only, store_only, badges, gtin, variant_counts, colors [{sku, name}], promotions [{text, details, rewards_text, starts, ends}] (dates as Michaels gives them, no timezone)";
const LIST = `market {country, language, currency}, total, page, page_size, total_pages, count, sort, filters_applied, corrected_query, items (${ITEM}), facets [{key, name, values [{value, count, label}]}] (send key and value in filters), notes`;

const country = z.enum(["us", "ca"]).optional()
  .describe("us (default: www.michaels.com, USD) or ca (canada.michaels.com, CAD).");
const usOnly = z.enum(["us"]).optional()
  .describe("us only (default): Michaels Canada does not answer this one.");
const language = z.enum(["en", "fr"]).optional()
  .describe("en (default) or fr (country ca only: canada.michaels.com/fr, French names and texts).");
const market = { country, language };
const skuValue = z.union([z.string().min(5).max(24), z.number().int().positive()]);
const sku = skuValue
  .describe("A Michaels SKU (items[].sku: 8 digits for Michaels items, e.g. \"10228177\"; 18 for Marketplace items; MP... for Pro packs).");
const store = z.union([z.string().min(1).max(8), z.number().int().positive()])
  .describe("A Michaels store number (get_michaels_store_stock and get_michaels_stores list them, e.g. \"1040\" Chicago IL, \"4936\" Toronto ON).");
const zip = z.union([z.string().min(5).max(10), z.number().int().positive()])
  .describe("A US ZIP code (\"10001\"), or with country ca a Canadian postal code (\"M5V 2T6\").");
const radius = z.number().int().min(1).max(200).optional()
  .describe("Miles around the location (1-200, default 20).");
const page = z.number().int().min(1).optional().describe("Page, from 1 ((page - 1) x page_size at most 8000).");
const pageSize = z.number().int().min(1).max(100).optional().describe("Products per page (1-100, default 40).");
const sort = z.enum(SORTS).optional()
  .describe("best_match (default), best_sellers, new_arrivals, price_asc, price_desc or rating: Michaels's sort menu.");
const brandFilter = z.string().min(1).max(80).optional()
  .describe("Only this brand (the Brand facet's values, e.g. Cricut, Lion Brand Yarn).");
const codePath = z.string().min(3).max(400);
const listShape = {
  page,
  page_size: pageSize,
  sort,
  min_price: z.number().min(0).optional().describe("Lowest price."),
  max_price: z.number().min(0).optional().describe("Highest price."),
  min_rating: z.number().int().min(1).max(4).optional().describe("Only products rated at least this many stars (1-4)."),
  store: store.optional().describe("A Michaels store number: only products with free store pickup at that store."),
  pickup: z.boolean().optional().describe("Free store pickup only (needs store)."),
  same_day: z.boolean().optional().describe("Only products offered for same-day delivery."),
  ship_to_me: z.boolean().optional().describe("Only products Michaels ships."),
  on_sale: z.boolean().optional().describe("Only products in Michaels's Sale filter."),
  new: z.boolean().optional().describe("Only products in Michaels's New filter."),
  clearance: z.boolean().optional().describe("Only products in Michaels's Clearance filter."),
  great_buy: z.boolean().optional().describe("Only products in Michaels's Great Buy filter (www.michaels.com)."),
  seller: z.enum(SELLERS).optional()
    .describe("michaels (Michaels's own items), marketplace (MakerPlace sellers) or michaels_pro (Pro bulk packs). US only."),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional()
    .describe('Facet filters: {facets[].key: [facets[].values[].value]} from an earlier answer, sent exactly as given, e.g. {"material": ["Acrylic"]} (refinementColor, size, material, yarnWeight, ...).'),
  ...market,
};
const { on_sale: _onSale, new: _new, clearance: _clearance, great_buy: _greatBuy, ...dealsListShape } = listShape;

export function registerMichaelsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/michaels/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_michaels",
    `Search ${NAME} by keywords, a Michaels item number or a UPC (a UPC answers with the product group's lead SKU, which can be another colour or size: get_michaels_product lists every variant's UPC), sorted (best match, best sellers, new arrivals, price, rating), filtered (brand, price, rating, store pickup, same-day, ship to me, sale, new, clearance, great buy, seller, colour, size, material, yarn weight, any facet) and paged (up to 100 a page). Michaels items and Marketplace items come together (seller_type tells them apart). ${PRICES} Returns query, category, ${LIST}. ${NOT_AVAILABLE} ${TWO}`,
    {
      q: z.string().min(1).max(200).describe("Keywords (yarn), a Michaels item number or a UPC."),
      brand: brandFilter,
      category: codePath.optional()
        .describe("Only this category: a code path (categories[].code_path or a By category code facet value, e.g. root//Categories//809187838)."),
      ...listShape,
    },
    post("search"),
  );

  server.tool(
    "get_michaels_product",
    `One ${NAME} product in full by SKU or link: market, sku, requested_sku, found_requested_sku, master_sku, name, brand, url, image, images, price, was_price, price ranges, price_text, was_price_text, on_sale, discount_percent, unit_price, rating, review_count, seller_type, channel, seller_id (Marketplace items: the seller's id as the page gives it; no seller name), upc, options (the variant's colour or size), description, details, specifications [{name, value}], category, breadcrumbs [{name, url}], online_stock {units, in_stock} (Michaels's online stock, not a store's: use get_michaels_store_stock for stores), pro_pack {sku, units_per_pack, unit_price, unit_price_text}, store_pickup, store_only, online_only, badges, same_day_delivery_fee, variant_counts, variants [{sku, options, price, was_price, on_sale, discount_percent, upc, online_stock, image}], promotions [{text, details, rewards_text, starts, ends}] (Michaels's own offer text and dates), notes. ${PRICES} An unknown SKU is a charged 404. ${TWO}`,
    {
      sku: sku.optional(),
      url: z.string().min(10).max(600).optional()
        .describe("A www.michaels.com or canada.michaels.com product link (items[].url), instead of sku. The link sets the country."),
      ...market,
    },
    post("product"),
  );

  server.tool(
    "get_michaels_store_stock",
    `Units of one SKU at the ${NAME} stores near a US ZIP or a Canadian postal code, exactly as Michaels reports them for pickup: market, sku, location, radius_miles, count, in_stock_count, total_units, stores [{store_id, name, address {line1, line2, city, state, zip, country}, phone, latitude, longitude, distance_miles, units, in_stock, pickup, pickup_text (Michaels's pickup message as given, e.g. TODAY), same_day_delivery, open_now, hours, virtual (true: a virtual or pop-up store Michaels lists by that name, shown with 0 units)}], notes. Stock is as Michaels reports it; Scavio makes no promise of its accuracy. A SKU Michaels does not know shows 0 units at every store. ${TWO}`,
    { sku, zip, radius, ...market },
    post("store-stock"),
  );

  server.tool(
    "get_michaels_store_inventory",
    `Units of up to 30 SKUs at one ${NAME} store, as Michaels reports them: market, store_id, count, in_stock_count, total_units, items [{sku, units}], not_reported (SKUs Michaels gave no units for), notes. A store number or SKU Michaels does not know answers 0 units or no units: check it with get_michaels_store or get_michaels_product. ${TWO}`,
    {
      store,
      skus: z.array(skuValue).min(1).max(30)
        .describe("1-30 Michaels SKUs, e.g. [\"10228177\", \"10816737\"]."),
      ...market,
    },
    post("store-inventory"),
  );

  server.tool(
    "get_michaels_stores",
    `The ${NAME} stores near a US ZIP, a city or a point (United States only; for Canada, get_michaels_store_stock lists the stores near a postal code): market, location {query, latitude, longitude, formatted_address}, radius_miles, count, stores [{position, store_id, name, address, phone, latitude, longitude, distance_miles, time_zone, hours (the 7 entries Michaels lists for the current week, holiday hours included, unlabelled as Michaels gives them), hours_text, curbside_pickup_hours, open_now, services {in_store_shopping, store_pickup, curbside_pickup, same_day_delivery, custom_framing, frame_and_print, balloon_inflation, birthday_parties, fabrics}, virtual}], notes. Send zip, city or latitude + longitude. ${TWO}`,
    {
      zip: z.union([z.string().min(5).max(10), z.number().int().positive()]).optional()
        .describe("A US ZIP code (e.g. \"60657\")."),
      city: z.string().min(2).max(80).optional().describe("A city, e.g. San Francisco, CA."),
      latitude: z.number().min(-90).max(90).optional().describe("Latitude (with longitude)."),
      longitude: z.number().min(-180).max(180).optional().describe("Longitude (with latitude)."),
      radius,
      country: usOnly,
    },
    post("stores"),
  );

  server.tool(
    "get_michaels_store",
    `One ${NAME} store by store number (US or Canada): market, store_id, name, address, phone, fax, latitude, longitude, time_zone, hours, hours_text, curbside_pickup_hours, services, virtual, open_date, closing_dates, temporarily_closed_date, notes. An unknown store number is a charged 404. ${TWO}`,
    { store, ...market },
    post("store"),
  );

  server.tool(
    "get_michaels_category",
    `One ${NAME} category's products by /shop/ link or path or by code path, optionally matching keywords, sorted, filtered and paged. ${PRICES} Returns category {code_path, name, path, url}, query, ${LIST}. With country ca the category must be a code path (search facets By category code list them). A wrong category is a charged 404. Costs 2 credits with a code path, 4 with a /shop/ link or path (one more call finds its code path); credits_used is what was charged. ${CHARGES}`,
    {
      category: codePath
        .describe("A Michaels category: a /shop/ link or path (e.g. /shop/art-supplies/artist-canvas, categories[].path) or its code path (categories[].code_path: 2 credits instead of 4)."),
      q: z.string().min(1).max(200).optional().describe("Only products matching these keywords."),
      brand: brandFilter,
      ...listShape,
    },
    post("category"),
  );

  server.tool(
    "get_michaels_categories",
    `${NAME}'s departments, or one category's subcategories (United States: www.michaels.com): market, path, name, url, code_path, leaf, count, categories [{name, path (the input of path here), url, code_path (the category input of get_michaels_category, search_michaels, get_michaels_brand and get_michaels_deals), leaf, children}], notes. Departments without a code_path (Sale, Clearance) are deals pages: use get_michaels_deals. An unknown path is a charged 404. ${TWO}`,
    {
      path: z.string().min(3).max(400).optional()
        .describe("A category's /shop/ path or link (categories[].path, e.g. /shop/art-supplies): its subcategories. Without it: the departments."),
      country: usOnly,
    },
    post("categories"),
  );

  server.tool(
    "get_michaels_brand",
    `One brand's products on ${NAME} (Michaels's Brand filter, as Michaels names brands), optionally matching keywords or within a category, sorted, filtered and paged. ${PRICES} Returns brand, query, category, ${LIST}. A brand with no products is a charged 404. ${TWO}`,
    {
      brand: z.string().min(1).max(80)
        .describe("A brand as Michaels names it (the Brand facet values of a search, e.g. Cricut, Lion Brand Yarn)."),
      q: z.string().min(1).max(200).optional().describe("Only this brand's products matching these keywords (default: the brand name)."),
      category: codePath.optional().describe("Only this category (a code path, categories[].code_path)."),
      ...listShape,
    },
    post("brand"),
  );

  server.tool(
    "get_michaels_deals",
    `${NAME}'s Sale (type sale, default), New, Clearance or Great Buy (US) products matching keywords or within a category (q or category is required), sorted, filtered and paged: Michaels's own More Ways to Shop filters. ${PRICES} Returns type, query, category, ${LIST}. Costs 2 credits (4 with a category given as a /shop/ link or path; credits_used is what was charged). ${CHARGES}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("sale (default), new, clearance or great_buy (www.michaels.com only)."),
      q: z.string().min(1).max(200).optional().describe("Deals matching these keywords, e.g. christmas (q or category is required)."),
      category: codePath.optional()
        .describe("Deals in this category: a code path, or in the US a /shop/ path."),
      brand: brandFilter,
      ...dealsListShape,
    },
    post("deals"),
  );

  server.tool(
    "get_michaels_suggestions",
    `The search suggestions ${NAME} shows as you type (United States: www.michaels.com): market, query, count, suggestions [{term, categories, brands}], notes. ${TWO}`,
    {
      q: z.string().min(1).max(100).describe("The text typed so far, e.g. yarn."),
      country: usOnly,
    },
    post("suggestions"),
  );
}
