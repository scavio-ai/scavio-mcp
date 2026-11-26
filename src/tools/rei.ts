import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/rei.ts (rei.com, the US outdoor co-op, US,
// USD). Cross-field rules the backend enforces and zod here does not: category
// takes slug or url; product and reviews take product_id or url; store stock
// takes zip, city + state or latitude + longitude; stores takes zip or
// latitude + longitude. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const SORTS = ["relevance", "brand_a_z", "brand_z_a", "price_asc", "price_desc", "newest", "top_rated", "best_selling", "percent_off"] as const;
const DEAL_TYPES = ["deals", "outlet"] as const;
const REVIEW_SORTS = ["relevance", "most_helpful", "newest", "highest_rating", "lowest_rating"] as const;

const SITE = "rei.com (REI, the US outdoor co-op; US, USD, prices as shown to a visitor who is not signed in)";
const TWO = "2 credits. A not-found is charged; failed calls and refused inputs are not. Usually 3-20 s; allow a client timeout of at least 90 s.";
const ITEM_FIELDS =
  "position, product_id (for get_rei_product and get_rei_reviews), name, brand, url, image, rating, review_count, price and price_max (current), compare_at, regular_price, percent_off, savings_text, price_text, price_type (regular, sale or outlet), price_display (single or range), sale, clearance, partial_clearance, outlet, members_only (REI's Just for Members badge), available, online_only, badges (REI Outlet, Top Rated, Staff Pick, New arrival...), flair (dated promo text as given, e.g. Sale Ends Dec 1), attributes, colors (color_id, name, family, sample_sku, available, image) and sizes (size, available, skus with color_id and sku_id; a sku_id is what get_rei_store_stock takes)";
const GRID = `30 or 90 items per page, each with ${ITEM_FIELDS}. Also returns page, page_size, total, total_pages, has_more, count, sort, title, facets (key, title, multi_select, values with value, label, count, selected; any key and value works in facets), categories (slug, label, count, value, selected, children), breadcrumbs, store_filter, filters_applied, store and notes`;
const GRID_SHORT = "Same items, facets, categories and totals as search_rei";

const storeNumber = () => z.union([z.string().regex(/^\d{1,4}$/), z.number().int().min(1).max(9999)]);
const zip = () => z.union([z.string().regex(/^\d{5}(-\d{4})?$/), z.number().int().min(0).max(99999)]);

const gridFields = {
  page: z.number().int().min(1).max(400).optional()
    .describe("Results page, 1-based. Defaults to 1; total_pages reports the last one."),
  page_size: z.union([z.literal(30), z.literal(90)]).optional()
    .describe("30 (default) or 90 results per page, the two sizes REI offers."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default, REI's Best Match), brand_a_z, brand_z_a, price_asc, price_desc, newest, top_rated (rating, then review count), best_selling or percent_off."),
  facets: z.record(z.string(), z.union([z.string(), z.array(z.string()).max(10)])).optional()
    .describe("Facet filters from a previous answer: {facets[].key: facets[].values[].value, or a list of values (OR-ed)}, at most 10 keys. Values exactly as REI writes them, e.g. {\"brand\": \"arcteryx\"}, {\"price\": \"$20.00 to $49.99\"}, {\"average-rating\": \"4 to 5\"}, {\"category\": \"womens-clothing|womens-jackets\"} (categories[].value). Keys combine."),
  store: storeNumber().optional()
    .describe("A store_number (from get_rei_stores or get_rei_store_stock): limits results to items REI shows as available at that store. store_filter reports the store and its count."),
};

export function registerReiTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rei/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  const productTarget = {
    product_id: z.string().min(1).max(20).optional()
      .describe("The REI product id (items[].product_id), e.g. '243702' or 'C09719'."),
    url: z.string().min(1).max(800).optional()
      .describe("An rei.com product link. Alternative to product_id."),
  };

  server.tool(
    "search_rei",
    `Search ${SITE} by keyword in the site's 9 sorts, filtered by any facet (brand, price, rating, deals, features, color, size...) and by one store. ${GRID}. Used gear is not listed: REI does not sell it online. ${TWO}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'rain jacket'."),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_rei_category",
    `Browse one REI category by slug or link (tents, mens-rain-jackets, camping-and-hiking...), sorted and filtered like search_rei. ${GRID_SHORT}, plus slug and url; categories holds the child categories with counts. An unknown category is a charged 404. ${TWO}`,
    {
      slug: z.string().min(1).max(120).optional()
        .describe("A category slug (categories[].slug or breadcrumbs[].slug, the part after /c/ in an rei.com link), e.g. 'tents'."),
      url: z.string().min(1).max(800).optional()
        .describe("An rei.com category link (its query string is not read: send filters in facets). Alternative to slug."),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_rei_deals",
    `REI deal listings: deals (default: everything on sale or clearance) or outlet (REI Outlet), optionally in one category, sorted and filtered like search_rei. ${GRID_SHORT}, plus type, category and url. Per-item end dates come as flair text as REI gives it (Sale Ends Dec 1). To track deal prices over time, poll and store your own: there is no price history. ${TWO}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("deals (default: everything on sale or clearance) or outlet (REI Outlet)."),
      category: z.string().min(1).max(120).optional()
        .describe("Optional category slug, e.g. 'tents': limits the deals to one category."),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_rei_product",
    `One REI product by id or link: product_id, name, brand, url, description, features, specs, featured_specs, breadcrumbs, primary_category, price {min, max, compare_at_min, compare_at_max}, outlet, badges, members_only, member_reward_estimate (REI's estimate of the co-op member reward; not a member price), return_days, colors, sizes, images, sku_count, available_sku_count, skus (sku_id, color, size, available, status, sellable, price, compare_at, price_type: regular or clearance, savings_percent, savings_amount, UPC, members_only, new_arrival, store_pickup_only), review_summary {count, average_rating, histogram, recommended_percent, ratings_only_count, fit} and questions (question, submitted_at, answer_count, answers with answer, is_brand_answer, submitted_at; no author names). A sku_id is what get_rei_store_stock takes; review text comes from get_rei_reviews. An unknown product is a charged 404. ${TWO}`,
    productTarget,
    post("product"),
  );

  server.tool(
    "get_rei_reviews",
    `Reviews of one REI product, 10 per page in the site's 5 sorts, optionally filtered by star rating: product_id, page, total (matching reviews), total_reviews, total_pages, has_more and reviews (review_id, rating, title, text, submitted_at, modified_at, would_recommend, ratings_only, helpful_votes, unhelpful_votes, badges, verified_purchaser, incentivized, syndicated, syndicated_from, fit, reviewer_context: age, height and weight bands, purchased_size, date_of_use, photo_count, brand_responses with department, response, date and source, original_product_name). No reviewer names or locations; staff and reviewer names are taken out of brand responses. ${TWO}`,
    {
      ...productTarget,
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("relevance (default), most_helpful, newest, highest_rating or lowest_rating."),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Page of 10 reviews, 1-based. Defaults to 1."),
      rating: z.union([z.number().int().min(1).max(5), z.array(z.number().int().min(1).max(5)).min(1).max(5)]).optional()
        .describe("Star filter: 1-5 or a list, e.g. [1, 2] for the critical reviews. total then counts the matching reviews."),
    },
    post("reviews"),
  );

  server.tool(
    "get_rei_store_stock",
    `Store pickup status of one REI SKU at the 4-10 REI stores nearest a US ZIP code, a city + state or a point: count, in_stock_count, ship_to_store_count and stores (status: in_stock = on the shelf for pickup, ship_to_store = free shipping to that store, unavailable; status_text, estimated_arrival, store with store_number, name, type, address, phone, latitude, longitude, distance_miles, hours, holidays, services, rentals, departments...). These are REI's pickup flags: REI publishes no unit counts. Take the SKU from get_rei_product skus[].sku_id or items[].sizes[].skus[].sku_id. A location REI cannot place is an unbilled 400. ${TWO}`,
    {
      sku: z.string().min(1).max(20)
        .describe("A SKU id: get_rei_product skus[].sku_id or items[].sizes[].skus[].sku_id, e.g. '2437020001'."),
      zip: zip().optional()
        .describe("US ZIP code, e.g. '98101'. Pass one of zip, city + state, or latitude + longitude."),
      city: z.string().min(1).max(60).optional()
        .describe("US city (with state), e.g. 'Portland'."),
      state: z.string().regex(/^[A-Za-z]{2}$/).optional()
        .describe("2-letter state code (with city), e.g. 'OR'."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude (with longitude)."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude (with latitude)."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_rei_stores",
    `REI stores near a US ZIP code or a point (latitude + longitude), ordered by distance, up to 10 within 100 miles by default (radius up to 250): store_number, name, type, address, phone, latitude, longitude, distance_miles, url, open_for_shopping, curbside_pickup, product_count and events (upcoming special hours as given, e.g. Thanksgiving and #OptOutside closures, plus normal hours). A place with no store in range is an empty list. ${TWO}`,
    {
      zip: zip().optional()
        .describe("US ZIP code to search around, e.g. '80202'."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude (with longitude), instead of zip."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude (with latitude)."),
      limit: z.number().int().min(1).max(10).optional()
        .describe("Stores to return, 1-10. Defaults to 10."),
      radius: z.number().int().min(1).max(250).optional()
        .describe("Radius in miles, 1-250. Defaults to 100."),
    },
    post("stores"),
  );

  server.tool(
    "get_rei_store",
    `One REI store by store number: name, type, address, phone, coordinates, time_zone, url, opened, open and closure flags, curbside, has_rentals, has_bike_shop, has_ski_shop, has_used_gear, has_trade_in, services, rentals, rentals_reservation_url, departments, hours (normal, curbside and dated special hours as given) and holidays (dates the store is closed). An unknown store is a charged 404. ${TWO}`,
    {
      store_number: storeNumber()
        .describe("The store number (stores[].store_number), e.g. 18 for Denver Flagship."),
    },
    post("store"),
  );

  server.tool(
    "get_rei_suggestions",
    `REI search-term suggestions for a partial query: suggestions (term, top_products_available): terms that start with the query, then terms that contain it, as the site's search box matches them. ${TWO}`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'tent'."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Suggestions to return, 1-50. Defaults to 10."),
    },
    post("suggestions"),
  );
}
