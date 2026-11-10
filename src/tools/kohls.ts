import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/kohls.ts (kohls.com, US only, USD).
// Cross-field rules the backend enforces and zod here does not: product takes
// product_id or url; category takes path or url; brand takes brand or url;
// stores take one location (zip, city + state, or lat + lng). No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["featured", "new_arrivals", "best_sellers", "price_low_to_high", "price_high_to_low", "highest_rated", "percent_off"] as const;
const DEAL_TYPES = ["clearance", "sale", "kohls_cash", "sephora"] as const;
const SUGGESTION_TYPES = ["terms", "products"] as const;

const ITEM_FIELDS = "id, title, URL, image, price (price_max for a range), regular_price, sale_price, price_label (sale, clearance, clearance+regular), on_sale, is_clearance, percent_off, price_suppressed with price_note (Kohl's shows some prices only in the cart), with_code_price (the price after a public offer code) with with_code_offer_codes, promotions (BOGO...), rating, review_count, badges (best_seller, top_rated...), colors, is_sephora, coupon_eligible, available_online / available_pickup / available_ship_to_store, and is_sponsored";
const GRID_SHORT = "120 products per page (plus any sponsored items, kept and flagged is_sponsored) with the same item fields, facets and totals as search_kohls";
const GRID = `120 products per page, each with ${ITEM_FIELDS}. Sponsored placements (up to about 8) stay in the list, flagged is_sponsored and counted in sponsored_count. Also returns total, page, total_pages, the sort applied, applied_filters and every facet (id, label and values with their value id, count and a selected flag; any value id works in filters; price is a bucket such as "Price:$25 to $50", there is no free min / max). Average rating and review count only: review text is not available. Prices in USD`;

const textId = (re: RegExp) => z.union([z.number().int().positive(), z.string().regex(re)]);
const zip = () => z.union([z.string().regex(/^\d{5}(-\d{4})?$/), z.number().int().min(0).max(99999)]);
const brandFilter = () =>
  z.string().min(1).max(100).optional()
    .describe("Only this brand, as the Brand facet lists it, e.g. \"Levi's\", \"Hamilton Beach\", \"BLACK+DECKER\".");

const gridFields = {
  page: z.number().int().min(1).max(500).optional()
    .describe("Results page, 1-based (120 products per page). Defaults to 1."),
  sort: z.enum(SORTS).optional()
    .describe("featured (default), new_arrivals, best_sellers, price_low_to_high, price_high_to_low, highest_rated or percent_off."),
  color: z.string().min(1).max(100).optional()
    .describe("Only this color, as the Color facet lists it (Black, Blue, Beig/khaki...)."),
  size: z.string().min(1).max(100).optional()
    .describe("Only this size, as the Size facet lists it (M, 32X30, 10...)."),
  on_sale: z.boolean().optional()
    .describe("Only items on sale."),
  clearance: z.boolean().optional()
    .describe("Only clearance items."),
  filters: z.union([z.string().min(3).max(300), z.array(z.string().min(3).max(300)).max(10)]).optional()
    .describe("Any facet value id from a previous response's facets[].values[].value, e.g. \"Gender:Womens\", \"Price:%2425%20to%20%2450\" (price buckets), \"TopRated:4\", \"InStoreOnline:Pick%20Up%20in%20Store\". A list combines facets (AND). Unencoded values work too (\"Price:$25 to $50\")."),
};

export function registerKohlsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/kohls/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_kohls",
    `Search kohls.com (US) by keyword, filtered by brand, color, size, on sale, clearance and any facet value (price buckets, gender, rating, store pickup...), sorted by featured (default), new arrivals, best sellers, price, highest rated or percent off. ${GRID}. When the site autocorrects the keyword, corrected_query says so. Use an item's id with get_kohls_product. 2 credits.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'jeans'."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_kohls_product",
    `One kohls.com product by id or URL: title, brand, status, dept (what get_kohls_store_availability can take), breadcrumbs, Sephora at Kohl's flag, average rating, review_count and recommended_percent (review text is not available), is_new / best_seller / top_rated, badges, description, details, ingredients (beauty), images, videos, return policy, the price block (regular, sale, sale_status, percent_off, lowest_applicable_price, price_suppressed with price_note for cart-only prices, with_code_price with its savings and offer codes), kohls_cash (earn and redeem windows, amount earned) when the product has it, the public offers that apply (code, description, terms, start and end dates), pickup / ship-to-store eligibility, online_units, and every variant: sku, UPC, color, size, availability, online_units, max_per_order, price, sale price, with-code price, Kohl's Cash earned and pickup eligibility. Add store_id (from get_kohls_stores) for that store's availability and in-store price on each variant. A variants[].sku is what get_kohls_store_availability takes. An unknown id is a 404 (it can take about 20 seconds). 2 credits.`,
    {
      product_id: textId(/^\d{4,10}$/).optional()
        .describe("Kohl's product id: a search result's id, the number after prd- in a product URL, e.g. '6251213'."),
      url: z.string().min(1).max(600).optional()
        .describe("A kohls.com product URL (its prd-<id> is used). Alternative to product_id."),
      store_id: textId(/^\d{1,5}$/).optional()
        .describe("A Kohl's store number (get_kohls_stores stores[].store_id), e.g. '725': adds that store's availability and in-store price to every variant."),
    },
    post("product"),
  );

  server.tool(
    "get_kohls_category",
    `Browse one Kohl's catalog listing by its path or URL (Small Appliances, Women's Clothing, Men's Shoes...), with the same filters and sorts as search_kohls. The path must carry its CN=... filter, the way kohls.com category links and a product's breadcrumbs[].url do. ${GRID_SHORT}. Also returns the category's name, breadcrumbs, path and URL. 2 credits.`,
    {
      path: z.string().min(1).max(600).optional()
        .describe("A Kohl's catalog path with its CN=... part, e.g. '/catalog/small-appliances-kitchen-dining.jsp?CN=Category:Small%20Appliances+Department:Kitchen%20%26%20Dining'."),
      url: z.string().min(1).max(800).optional()
        .describe("A kohls.com catalog URL. Its CN facets define the listing; a sort or page in the URL is kept."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_kohls_brand",
    `Browse one brand at Kohl's by name or URL (Nike, Hamilton Beach, Levi's...), with the same filters and sorts as search_kohls (except brand). ${GRID_SHORT}. Also returns the brand's name, facet value and URL. An unknown brand is a 404. 2 credits.`,
    {
      brand: z.string().min(1).max(100).optional()
        .describe("A brand name as Kohl's lists it in the Brand facet, e.g. 'Hamilton Beach', 'Nike', \"Levi's\"."),
      url: z.string().min(1).max(800).optional()
        .describe("A kohls.com brand page URL (its CN carries Brand:...)."),
      ...gridFields,
    },
    post("brand"),
  );

  server.tool(
    "get_kohls_deals",
    `Kohl's deal listings: Clearance (default), Sale, items that earn Kohl's Cash right now, or Sephora at Kohl's, with the same filters and sorts as search_kohls. ${GRID_SHORT}. To track clearance prices over time, poll and store your own: there is no price history. 2 credits.`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("clearance (default), sale, kohls_cash (items that earn Kohl's Cash now) or sephora (Sephora at Kohl's)."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_kohls_stores",
    `Kohl's stores near a US ZIP code, a city + state or a point (lat + lng), within 25 miles by default (up to 100): store_id (what get_kohls_product store_id takes), name, address, city, state, ZIP, phone, lat / lng, distance in miles, weekly opening hours with the UTC offset, store badges (Sephora, Fine Jewelry, Lands' End...), services (In-Store Pickup, Amazon Returns...) and the store page URL. Pass one location. 1 credit.`,
    {
      zip: zip().optional()
        .describe("US ZIP code to search around, e.g. '60601'."),
      city: z.string().min(1).max(60).optional()
        .describe("City (with state), instead of zip, e.g. 'Austin'."),
      state: z.string().length(2).optional()
        .describe("2-letter state code (with city), e.g. 'TX'."),
      lat: z.number().min(-90).max(90).optional()
        .describe("Latitude (with lng), instead of zip."),
      lng: z.number().min(-180).max(180).optional()
        .describe("Longitude (with lat)."),
      radius: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles, 1-100. Defaults to 25."),
    },
    post("stores"),
  );

  server.tool(
    "get_kohls_store_availability",
    `Pickup stock for one Kohl's SKU at every store within about 50 miles of a US ZIP code, with unit counts: per store pickup_units, stock_level (In Stock, Low Stock, Out of Stock), in_stock, ship_to_store_units with the ship-to-store pickup window, pickup and ship-to-store eligibility, clearance and Sephora flags, and the store's address, phone, distance and hours for the week. Also returns how many stores have it (in_stock_count) and total_pickup_units. Take sku (variants[].sku) and dept from get_kohls_product. 2 credits.`,
    {
      sku: textId(/^\d{5,12}$/)
        .describe("A Kohl's SKU code: a product's variants[].sku, e.g. '73519108'."),
      dept: z.union([z.string().regex(/^\d{1,4}$/), z.number().int().min(0).max(9999)]).optional()
        .describe("The product's department code (get_kohls_product dept, e.g. '063')."),
      zip: zip()
        .describe("US ZIP code: stores within about 50 miles are listed, e.g. '10001'."),
    },
    post("store-availability"),
  );

  server.tool(
    "get_kohls_suggestions",
    `The kohls.com search-box suggestions for a partial query: keyword completions (type terms, default), or matching products with id, title, URL and image (type products). Useful for keyword research and for building queries for search_kohls. 2 credits.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'coff'."),
      type: z.enum(SUGGESTION_TYPES).optional()
        .describe("terms (default): keyword completions; products: matching products."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_kohls_coupons",
    `Today's public Kohl's coupon codes: code, description (the offer, minimum purchase and exclusions as stated), end date, whether it needs a Kohl's Card (requires_kohls_card), the terms page URL and the URL of the eligible products. Public codes only, no account offers or Kohl's Rewards balances. No parameters. 2 credits.`,
    {},
    post("coupons"),
  );
}
