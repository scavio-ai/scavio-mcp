import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/ashley.ts (ashleyfurniture.com; Ashley's
// licensed storefronts in Canada, Mexico, the Philippines, Saudi Arabia and
// Turkey for search + product). Cross-field rules the backend enforces and zod
// here does not: product takes sku (us), handle (ca, mx, ph, sa, tr) or url;
// page and sort are us only on search; category takes path or category_url;
// store takes store_id or url. category, deals, stores and store are us only,
// so they take no country. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const COUNTRIES = ["us", "ca", "mx", "ph", "sa", "tr"] as const;
const SORTS = ["best_sellers", "price_asc", "price_desc", "newest", "rating", "name"] as const;
const DEALS = ["black_friday", "clearance", "hot_buys"] as const;
const RADII = [10, 25, 50, 100] as const;

const FAILED = "Failed upstream calls are not charged; a not-found is charged.";
const CHARGE_MARKETS = `Costs 2 credits on us and mx, 1 credit on ca, ph, sa and tr. ${FAILED}`;
const CHARGE_US = `us only (ashleyfurniture.com). Costs 2 credits. ${FAILED}`;
const MARKETS =
  "Markets (country, default us): us (ashleyfurniture.com, USD), ca (ashleyhomestore.ca, CAD), mx (store.ashleyfurniture.com.mx, MXN, Spanish), ph (store.ashleyfurniture.ph, PHP), sa (store.ashley.sa, SAR, English) and tr (ashleyturkiye.com, TRY, Turkish). ca, mx, ph, sa and tr are Ashley's licensed storefronts and serve search and product only. Every answer carries country, language, currency and source_domain.";
const PRICES =
  "Prices are numbers in the market's currency, never converted. price is what Ashley charges now; regular_price is Ashley's own \"Regular Price\" (the struck-through price; Ashley's terms define it as its highest advertised price in store and online, offered to customers using special long-term financing), set only when it is at or above price; discount_percent is computed from the two.";
const REGION =
  "Ashley prices vary by region (price zone), and there is no ZIP input: every us answer returns priced_for (zipcode, price_zone), the ZIP and price zone Ashley priced that answer for. Two calls can land in different price zones, so prices can differ between calls and consecutive pages can overlap slightly.";
const BADGES =
  "badges (sale, clearance, doorbuster, outlet, hot_buy, online_only, ashley_exclusive, luxe, daily_deal)";
const GRID = `30 products per page: items with position, sku, name, brand, upc, category, url, image, price, regular_price, discount_percent, color, flag, ${BADGES}, promotion, rating, review_count, swatch_count, stock_text and delivery_method (home_delivery or direct_ship). Also priced_for, count, total, page, page_size, total_pages, sort, requested_filters and facets (id, name, options with value, label and count). Filter with filters and price_min / price_max.`;

const gridFields = {
  page: z.number().int().min(1).max(100).optional()
    .describe("Grid page, 1-based (30 products per page). A page past the last returns no items and a note."),
  sort: z.enum(SORTS).optional()
    .describe("best_sellers (default), price_asc, price_desc, newest, rating (customer rating) or name (A to Z)."),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string()).max(10)])).optional()
    .describe("Facet refinements from the answer's facets, keyed by facets[].id with options[].value values, e.g. {\"facetUpholsteryDesign\": \"Chaise\"}; several values of one facet match any of them. At most 6 facets."),
  price_min: z.number().min(0).optional()
    .describe("Lowest price (USD). Applied to Ashley's own price list, so an item priced for another region can sit just outside the range."),
  price_max: z.number().min(0).optional().describe("Highest price (USD)."),
};

export function registerAshleyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/ashley/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_ashley",
    `Search Ashley Furniture by keyword. us: 48 results per page with the exact total, sorted by best sellers, price, newest, customer rating or name; items carry position, sku, master_id, name, brand, url, image, swatch_image, price, regular_price, discount_percent, color, size, flag, ${BADGES}, new_since, rating, review_count, variant_count, variants (sku, color, size, url, price, regular_price, rating, review_count) and promotions; also priced_for, total, total_pages, page_size, sorts_offered and facets (informational: search takes no facet filters, use get_ashley_category for filters). ca, mx, ph, sa, tr: the storefront's best matches (up to 10; tr its first results page) with handle (for get_ashley_product), product_id, name, brand, product_type, url, image, price, regular_price, discount_percent and available; no sort, paging or total. ${PRICES} ${REGION} ${MARKETS} ${CHARGE_MARKETS}`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. 'sofa' (tr: Turkish keywords such as 'koltuk')."),
      country: z.enum(COUNTRIES).optional()
        .describe("Ashley market (default us): us, ca, mx, ph, sa or tr."),
      page: z.number().int().min(1).max(100).optional()
        .describe("us only: results page, 1-based (48 per page)."),
      sort: z.enum(SORTS).optional()
        .describe("us only: best_sellers (default), price_asc, price_desc, newest, rating or name."),
    },
    post("search"),
  );

  server.tool(
    "get_ashley_product",
    `One Ashley product. us (by item number or URL): priced_for, sku, master_id, name, brand, url, price, regular_price, discount_percent, ${BADGES}, new_since, item_status, color, size, description, features, options (dimension and every value), variants (sku, dimension values, url, selected; per-variant prices are not on the page: call again with that sku), is_set and components (each piece of a set with sku, name, price, regular_price, dimensions, stock_status, stock_quantity), dimensions, materials, assembly, images, category, breadcrumbs, stock (status, quantity, delivery_method, delivery_message, delivery_date, white_glove), nearest_store, rating, review_count, rating_histogram (5 to 1), reviews (the first 10 the page shows: id, rating, title, text, date, purchase_date, incentivized, would_recommend, helpful votes, display_name, location, photos, brand responses; no review paging, sort or star filter), customer_photos, questions_total and questions (customer Q&A with staff or customer answers). ca, mx, ph, sa, tr (by handle or URL, not sku): sku, handle, product_id, name, brand, product_type, url, price, regular_price, discount_percent, available, description, options, variants (sku, options, price, regular_price, available, barcode) and images. An unknown item number is a charged 404. ${PRICES} ${REGION} ${MARKETS} ${CHARGE_MARKETS}`,
    {
      sku: z.string().min(3).max(40).optional()
        .describe("us: an Ashley item number (items[].sku), e.g. '5950418' or 'APK-29004-R3'."),
      handle: z.string().min(1).max(200).optional()
        .describe("ca, mx, ph, sa, tr: the product handle from search (items[].handle), e.g. 'aviemore-sofa'. Send it with country."),
      url: z.string().min(10).max(1000).optional()
        .describe("A product page on a served storefront (alternative to sku / handle; the market is read from it)."),
      country: z.enum(COUNTRIES).optional()
        .describe("Ashley market (default us): us, ca, mx, ph, sa or tr. Required with handle."),
    },
    post("product"),
  );

  server.tool(
    "get_ashley_category",
    `One ashleyfurniture.com category's products by path or category URL (send one), sorted and filtered. ${GRID} Also category (path, name, url, breadcrumbs). An unknown category is a charged 404. ${PRICES} ${REGION} ${CHARGE_US}`,
    {
      path: z.string().min(1).max(300).optional()
        .describe("A category path: the part after /c/ in an ashleyfurniture.com category URL, e.g. 'furniture/living-room/sofas', 'bedroom/beds', 'mattresses'."),
      category_url: z.string().min(10).max(1000).optional()
        .describe("An ashleyfurniture.com category page (/c/... URL); refinements in it are kept."),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_ashley_deals",
    `The products of one Ashley deal event: black_friday (Black Friday furniture deals, the default), clearance (clearance furniture) or hot_buys (Ashley's Hot Buys), with the category sorts and filters. ${GRID} Also event, event_name and event_url. ${PRICES} ${REGION} ${CHARGE_US}`,
    {
      event: z.enum(DEALS).optional().describe("black_friday (default), clearance or hot_buys."),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_ashley_stores",
    `Ashley stores near a point (lat and lng are required; there is no address or ZIP lookup): latitude, longitude, radius_miles, count and stores with store_id, name and url, in the order Ashley lists them (alphabetical, not by distance). Call get_ashley_store with a store_id for the address, phone and hours. ${CHARGE_US}`,
    {
      lat: z.number().min(18).max(72).describe("Latitude in decimal degrees, e.g. 40.7506."),
      lng: z.number().min(-180).max(-60).describe("Longitude in decimal degrees, e.g. -73.9972."),
      radius: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]).optional()
        .describe(`Search radius in miles: ${RADII.join(", ")} (default 50).`),
    },
    post("stores"),
  );

  server.tool(
    "get_ashley_store",
    `One Ashley store by store_id or store page URL (send one): store_id, name, url, phone, address (street, city, state, zip, country), latitude, longitude, hours (day, opens, closes), payment_accepted, services, rating, image and map_url. An unknown store is a charged 404. ${CHARGE_US}`,
    {
      store_id: z.string().min(5).max(300).optional()
        .describe("A store id from get_ashley_stores (stores[].store_id), e.g. 'us/wisconsin/greenfield/4771-s-27th-st/luxe'."),
      url: z.string().min(10).max(1000).optional()
        .describe("A store page on stores.ashleyfurniture.com (stores[].url)."),
    },
    post("store"),
  );
}
