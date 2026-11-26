import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/academy.ts (academy.com, Academy Sports +
// Outdoors, US, USD). Cross-field rules the backend enforces and zod here does
// not: product takes url or slug; category takes path or url; stores takes zip
// or latitude + longitude. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const SORTS = ["relevance", "best_selling", "newest", "top_rated", "price_asc", "price_desc"] as const;
const DEAL_TYPES = ["hot_deals", "clearance", "black_friday", "flash_sale"] as const;
const STATES = ["AL", "AR", "FL", "GA", "IL", "IN", "KS", "KY", "LA", "MD", "MS", "MO", "NC", "OH", "OK", "PA", "SC", "TN", "TX", "VA", "WV"] as const;

const SITE = "academy.com (Academy Sports + Outdoors, the US sporting goods retailer; US, USD; prices are national, the same at every store)";
const ONE = "1 credit. A not-found is charged; failed calls and refused inputs are not. Usually 2-20 s; allow a client timeout of at least 90 s.";
const ITEM_FIELDS =
  "position, id, part_number (for get_academy_store_availability), name, brand, slug and url (for get_academy_product), image, price and price_max (current), was_price, saving and percent_off (the tile's default variant, as Academy lists them), price_in_cart (Academy shows the lowest price only in the cart), promotion {message, promo_price}, rating, review_count, badges (Academy's deal tags: Hot Deal, Clearance, New...), color_count, ecom_code (Academy's selling code as given, e.g. 01 SELL ONLINE), special_order, ships_to_store, same_day_delivery, free_shipping and default_variant {item_id, sku, attributes, url}";
const GRID = `Up to 29 organic results per page (page_size reports it), each with ${ITEM_FIELDS}. Also returns page, page_size, total, total_pages, has_more, count, sort, sponsored (paid placements, flagged apart from the organic items, with ad_position), facets (id, label, values with value, label, count, selected; any id and value works in facets), subcategories (id, name, path, url, image), title, filters_applied and notes`;
const GRID_SHORT = "Same items, sponsored placements, facets, subcategories and totals as search_academy";

const gridFields = {
  page: z.number().int().min(1).max(500).optional()
    .describe("Results page, 1-based. A page past the last one returns an empty items list (total 0). Defaults to 1."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default, the site's own order), best_selling, newest, top_rated, price_asc or price_desc (Academy's own price order, by its list price: promotions and cart prices can sit slightly out of order)."),
  facets: z.record(z.string(), z.union([z.string(), z.array(z.string()).max(10)])).optional()
    .describe("Facet filters from a previous answer: {facets[].id: facets[].values[].value, or a list of values}, e.g. {\"facet_Brand\": \"Nike\"}, {\"facet_Deals\": \"Clearance\"}. Values are case-sensitive, exactly as the site lists them (\"Yeti\" and \"YETI\" differ). Facets combine."),
  min_price: z.number().min(0).max(100000).optional()
    .describe("Lowest price in USD (the site's price filter)."),
  max_price: z.number().min(0).max(100000).optional()
    .describe("Highest price in USD."),
};

const zip = () => z.union([z.string().regex(/^\d{5}(-\d{4})?$/), z.number().int().min(0).max(99999)]);
const storeId = () => z.union([z.string().min(1).max(20), z.number().int().positive()]);

export function registerAcademyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/academy/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_academy",
    `Search ${SITE} by keyword, sorted by relevance, best selling, newest, top rated or price, filtered by any facet (brand, product type, color, deals, size...) and a price range. ${GRID}. ${ONE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'yeti tumbler'."),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_academy_product",
    `One Academy Sports + Outdoors product by link or slug with every variant: id, part_number, name, brand, description, breadcrumbs, images, rating, review_count, price {min, max, map_price_applies, currency}, badges, ecom_code, product_type, special_order, is_firearm, is_ammo, returnable, shippable, notices and warnings (Academy's own text on the product page, as given), rebate {text, starts_at, ends_at, link}, promotion, option_axes, features, specifications, whats_in_the_box, selected_variant and variants (sku_id, item_id, manufacturer_item_id, sku, url, attributes, UPC, price, was_price, saving, percent_off, price_type, savings_text, unit_price_text such as a per-round price, price_valid_until as the page gives it, availability, images, badges, is_clearance, online_only, pickup_eligible, ship_to_store_eligible, free_shipping, same_day_delivery, rebate, online_units, online_status, add_to_cart, special_order, online_message). Review text is not available (rating and count only). For per-store units use get_academy_store_availability with part_number. An unknown product is a charged 404. ${ONE}`,
    {
      url: z.string().min(1).max(800).optional()
        .describe("An academy.com product link (/p/<slug>; a ?sku= in it is not needed, every variant is returned)."),
      slug: z.string().min(1).max(220).optional()
        .describe("The product slug (items[].slug, the part after /p/), e.g. 'yeti-duracoat-rambler-20-oz-tumbler'. Alternative to url."),
    },
    post("product"),
  );

  server.tool(
    "get_academy_store_availability",
    `Per-variant stock of one Academy Sports + Outdoors product at one store, by part_number, store_id and the store's state: store {store_id, state, pickup_eligible, ship_to_store_eligible}, variants_in_stock_at_store, in_store_units_total and variants (item_id, sku_id, store_status, store_message, fulfillment: BOPIS, STS or LSI, in_store_units: exact units at the store for pickup, ship_to_store_units, available_today_units for in-store-only items, nearest_store_with_stock {store_id, units, inventory_type, status, as_of}, online_units, online_status, add_to_cart, special_order, is_clearance, online_message). Match variants to get_academy_product by item_id. Find store ids with get_academy_stores. An unknown part number is a charged 404. ${ONE}`,
    {
      part_number: z.string().regex(/^\d{5,12}$/)
        .describe("The product's part number: items[].part_number or get_academy_product part_number, e.g. '111805768'."),
      store_id: storeId()
        .describe("The store: stores[].store_id (19, 0019 and store-0019 all work)."),
      state: z.string().regex(/^[A-Za-z]{2}$/)
        .describe(`The store's state (stores[].address.state), one of ${STATES.join(", ")}.`),
    },
    post("store-availability"),
  );

  server.tool(
    "get_academy_stores",
    `Academy Sports + Outdoors stores near a US ZIP code or a point (latitude + longitude), nearest first, within 50 miles by default (up to 250). Each store: store_id, name, address {street, city, state, zip}, neighborhood, phone, latitude, longitude, distance_miles, status, today, next_change, today_date, time_zone_utc_offset, hours, hours_by_day, services (licenses, line spooling, propane exchange...), pickup_eligible, ship_to_store_eligible, special_order_eligible, doordash_eligible, temporarily_closed, future_store and nearby_store_ids. Academy has stores in 21 states; a place with none in range is an empty list. ${ONE}`,
    {
      zip: zip().optional()
        .describe("US ZIP code to search around, e.g. '77098'."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude (with longitude), instead of zip."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude (with latitude)."),
      radius: z.number().int().min(1).max(250).optional()
        .describe("Radius in miles, 1-250. Defaults to 50."),
    },
    post("stores"),
  );

  server.tool(
    "get_academy_store",
    `1 to 20 Academy Sports + Outdoors stores by id, in the order asked, with the same fields as get_academy_stores (distance excepted) and not_found for ids Academy does not know. When none is found it is a charged 404. ${ONE}`,
    {
      store_ids: z.union([z.string().min(1).max(200), z.number().int().positive(), z.array(storeId()).min(1).max(20)])
        .describe("1 to 20 store ids (stores[].store_id), a list or a comma-separated string, e.g. ['19', '327', '256']."),
    },
    post("store"),
  );

  server.tool(
    "get_academy_category",
    `Browse one Academy Sports + Outdoors category by path or link (Coolers, Men's Running Shoes, Handguns...), sorted and filtered like search_academy. ${GRID_SHORT}, plus path and url. Category paths come from get_academy_categories or subcategories[].path. An unknown category is a charged 404. ${ONE}`,
    {
      path: z.string().min(1).max(300).optional()
        .describe("A category path (/c/...), as get_academy_categories and subcategories[].path give it, e.g. '/c/outdoors/coolers'."),
      url: z.string().min(1).max(800).optional()
        .describe("An academy.com category link (its query string is not read: send filters in facets). Alternative to path."),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_academy_categories",
    `The Academy Sports + Outdoors category navigation as the site's header shows it: departments (name, path, url, id, children: groups with their own children links) with count, group_count and link_count. Any path works in get_academy_category. ${ONE}`,
    {},
    post("categories"),
  );

  server.tool(
    "get_academy_deals",
    `Academy Sports + Outdoors deal listings: Hot Deals (default), Clearance, Black Friday (and one of its sub-shops) or the Flash Sale, sorted and filtered like search_academy. ${GRID_SHORT}, plus type, sub_shop, path, url, sub_shops (id, name, path, url, image, slug) and site_banner (starts_at, ends_at: the schedule of the banner the page shows, as the site gives it). Listings carry no end date per item; Academy has no weekly ad. To track deal prices over time, poll and store your own: there is no price history. ${ONE}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("hot_deals (default), clearance, black_friday or flash_sale."),
      sub_shop: z.string().min(1).max(120).optional()
        .describe("black_friday only: one sub-shop, sub_shops[].slug of a black_friday answer."),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_academy_suggestions",
    `Academy Sports + Outdoors search-box suggestions for a partial query: suggestions (keyword completions), products (the same item fields as search_academy) and, with include_popular, popular_searches. ${ONE}`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'yeti'."),
      include_popular: z.boolean().optional()
        .describe("Also return the site's popular searches. Defaults to false."),
    },
    post("suggestions"),
  );
}
