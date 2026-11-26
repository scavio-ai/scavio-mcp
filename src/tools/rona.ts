import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// RONA: 9 tools on /api/v1/rona (search, product, prices, category, categories, stores, store, stock,
// deals), Canada only, prices in CAD, language en | fr. Shapes mirror backend/src/routes/rona.ts.
// Rules the backend enforces and zod here does not: page_size is 24, 48 or 96 (1-100 on a family_id
// list); product takes sku or url; category takes category or family_id (family_id needs store_id and
// no sort / filters / facets); latitude and longitude go together; stock takes store_id or latitude +
// longitude; postal codes are a 400; deals has no sort. Article numbers are strings (leading zeros
// count). No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_low_to_high", "price_high_to_low", "highest_rated", "newest", "best_sellers"] as const;
const PAGE_SIZES = [24, 48, 96];

const FIRST =
  "RONA (rona.ca, the Canadian home improvement retailer: RONA+ and RONA stores, about 425 corporate and affiliated dealer stores per RONA inc.)";
const NAME = "RONA";
const SLOW = "Answers can take up to about a minute: allow up to 2 minutes.";
const BILL = "Failed upstream calls and refused inputs are not charged; a not-found is charged (credits_used is what was charged).";
const STORE =
  "Without store_id the prices and units are for the store RONA's site picks for the visit (store.requested false); with store_id every item is priced at that store (store.requested true).";
const UNITS = "units are exact store units; null means RONA showed no count, not zero.";
const TILE =
  "sku (RONA's Article #, the id), name, brand, model, url, image, price, regular_price, on_sale, unit, rating, review_count, units, availability, price_shown";
const LIST = `page, page_size, sort, filters_applied, total, total_pages, has_more, count, items [{${TILE}}], store {store_id, name, requested}, facets (include_facets), market {country, currency, language}, notes`;
const NOT_AVAILABLE =
  "Not available: review text (rating and review count only), search suggestions, postal-code store lookup, the printed flyer, cart or checkout, price history (poll and store the answers). For the same item at Home Depot Canada use the Home Depot tools with country ca; match the same grade and length, or the same model.";

const language = z.enum(["en", "fr"]).optional()
  .describe("en (default) or fr: RONA's French names, links and labels. Article numbers and CAD prices are the same in both.");
const storeId = z.union([z.string().max(10), z.number().int()]).optional()
  .describe("A RONA store number (5 digits, from get_rona_stores; e.g. 55130 RONA+ Toronto Stockyards, 41460 RONA+ Brossard Dix/30, 62860 RONA+ Calgary NE). Prices and units are that store's.");
const sku = z.string().max(40)
  .describe("A RONA article number (Article #, items[].sku), as a string: leading zeros count (e.g. \"00277649\").");

const listing = {
  page: z.number().int().min(1).optional().describe("Page, 1-based (default 1)."),
  page_size: z.number().int().optional().describe(`Products per page: ${PAGE_SIZES.join(", ")} (default 48).`),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price_low_to_high, price_high_to_low, highest_rated, newest, best_sellers."),
  filters: z.array(z.string().max(20)).max(10).optional()
    .describe("Up to 10 facet values (facets[].values[].value from include_facets): brand, price band, rating, offer (on sale, clearance, Buy in Bulk), in-store or online-only products, category."),
  on_sale: z.boolean().optional().describe("Only products on sale."),
  clearance: z.boolean().optional().describe("Only clearance products."),
  include_facets: z.boolean().optional()
    .describe("Also return facets [{facet, name, values [{value, name, count}]}] to filter on."),
  store_id: storeId,
  language,
};
const { sort: _dealSort, ...dealListing } = listing;

const postalNote = "Postal code lookup is not supported (a postal_code is a 400): pass latitude and longitude, or a city or province.";

export function registerRonaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rona/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_rona",
    `Search the products of ${FIRST} by keywords, with paging (24, 48 or 96 a page), six sorts and RONA's filters (brand, price band, rating, on sale, clearance, Buy in Bulk, in-store or online-only products, category). For terms RONA sends to a category or a filtered search, that page is read and redirected_to says where. ${STORE} Returns query, redirected_to, ${LIST}. ${UNITS} Captured 2026-11-26: "2x4" at store 41460 listed 2440 products (102 pages); the first, 2-in x 4-in x 8-ft SPF Select Lumber (0971073), at 4.35 CAD. ${NOT_AVAILABLE} Costs 2 credits; 3 with store_id; 2 more when RONA redirects the term. ${BILL} ${SLOW}`,
    {
      query: z.string().min(1).max(200).describe("Keywords (required, e.g. 2x4)."),
      ...listing,
    },
    post("search"),
  );

  server.tool(
    "get_rona_product",
    `One product of ${FIRST} by article number or link: sku, item_number, name, brand, model, upc, format, unit, url, images, description, bullets, specs [{name, value}], breadcrumb, rating, review_count, price, regular_price, rebate, on_sale, sale_ends_text (the sale end as RONA shows it), sale_ends (ISO date only when unambiguous), price_shown, store {store_id, name, requested}, units, availability, aisle, dc_units, parcel_units, parcel_units_on_hand, back_in_stock, pickup_message, nearby_stores [{store_id, name, distance_km, units}], buyable, market, notes. ${STORE} ${UNITS} Captured 2026-11-26: the DEWALT 20 V MAX Brushless Compact Drill/Driver Kit (00277649) at store 55130 at 118 CAD (regular 219, rebate 101), sale_ends_text "until Dec 10th, 2026", 12 units in aisle F20T1, rated 4.6 from 50 reviews. No review text. An unknown article is a charged 404. Costs 3 credits. ${BILL} ${SLOW}`,
    {
      sku: sku.optional().describe("A RONA article number (items[].sku), as a string. Send sku or url."),
      url: z.string().min(10).max(2000).optional().describe("A rona.ca product link instead of sku."),
      store_id: storeId,
      language,
    },
    post("product"),
  );

  server.tool(
    "get_rona_prices",
    `Prices and exact stock for up to 60 articles at one ${NAME} store, from ${FIRST}: the per-store price check. RONA prices some goods per store: lumber and panels can differ between stores and provinces. Returns store, requested, count, items [{sku, found, sold_at_store, name, brand, model, upc, format, unit, price, regular_price, rebate, on_sale, units, dc_units, parcel_units, parcel_units_on_hand, aisle, availability, price_shown, buyable, rating, review_count, url, image}], not_found, market, notes. ${UNITS} Captured 2026-11-26: 2-in x 4-in x 8-ft SPF Select Lumber (0971073) at 4.35 CAD at store 41460 (Quebec), 4.22 at 55130 (Ontario), 4.19 at 62860 (Alberta); the DEWALT drill kit on sale (00277649) at 118 at all three. Run the same article list at several stores to compare them. An unknown store or no known article is a charged 404. Costs 1 credit. ${BILL} ${SLOW}`,
    {
      skus: z.union([z.array(z.string().max(40)).min(1).max(60), z.string().max(800)])
        .describe("Required. 1-60 RONA article numbers as strings (a list or comma-separated), e.g. [\"0971073\", \"0938002\", \"00277649\"]."),
      store_id: z.union([z.string().max(10), z.number().int()])
        .describe("Required. A RONA store number (5 digits, from get_rona_stores, e.g. 55130)."),
      language,
    },
    post("prices"),
  );

  server.tool(
    "get_rona_category",
    `Browse one category of ${FIRST} by path (from get_rona_categories) with paging, sorts, filters and facets. With family_id (from a category answer) and store_id and no sort, filters or facets, the products come from RONA's product list for the category at that store. ${STORE} Returns category {path, name, category_id, family_id, url}, source (page or family), ${LIST}. ${UNITS} Captured 2026-11-26: Cordless Drills and Drivers (/en/tools/power-tools-158001/cordless-drills-and-drivers-158003, family_id 318485) at store 55130 listed 233 products. An unknown path is a charged 404. Costs 2 credits (3 with store_id); 1 credit with family_id and store_id. ${BILL} ${SLOW}`,
    {
      category: z.string().min(1).max(400).optional()
        .describe("A category path from get_rona_categories (e.g. /en/tools/power-tools-158001/cordless-drills-and-drivers-158003) or a rona.ca category link. Its language (/en or /fr) is the answer's language."),
      family_id: z.union([z.string().max(20), z.number().int()]).optional()
        .describe("A category answer's family_id: with store_id and no sort, filters or facets, the category's products at that store for 1 credit."),
      ...listing,
      page_size: z.number().int().optional()
        .describe(`Products per page: ${PAGE_SIZES.join(", ")} (default 48); with family_id 1-100.`),
    },
    post("category"),
  );

  server.tool(
    "get_rona_categories",
    `The department tree of ${FIRST}: language, depth, count, total, departments [{name, path, url, category_id, children [...]}], market, notes. Paths are get_rona_category's category. Captured 2026-11-26: 22 departments, 232 categories at depth 2. Costs 1 credit. ${BILL}`,
    {
      depth: z.number().int().min(1).max(3).optional()
        .describe("Levels to return, 1-3 (default 3: departments, categories, sub-categories)."),
      language,
    },
    post("categories"),
  );

  server.tool(
    "get_rona_stores",
    `Every store on RONA's store locator (${FIRST}): RONA+ and RONA stores, corporate and dealer, filtered by province, city and banner, or nearest a latitude and longitude. Returns language, location, filters_applied, total, count, stores [{store_id, name, banner (RONA+ or RONA), format (big_box or proximity), relationship (corporate, dealer, franchisee), city, province, address, postal_code, phone, latitude, longitude, distance_km, services {click_and_collect, installation, truck_delivery, parcel_shipping, appliances}, url}], market, notes. store_id is the input of every per-store tool. Captured 2026-11-26: 403 stores; the nearest to 43.6426, -79.3871 (downtown Toronto) RONA+ Toronto Stockyards (55130, corporate) at 7.29 km. ${postalNote} Costs 1 credit. ${BILL}`,
    {
      latitude: z.number().optional().describe("With longitude: stores nearest this point, with distance_km."),
      longitude: z.number().optional().describe("With latitude."),
      province: z.string().max(40).optional().describe("A province code (qc, on, ab, bc ...) or name."),
      city: z.string().max(80).optional().describe("Stores whose city contains this (accents and case ignored)."),
      banner: z.enum(["rona", "rona_plus"]).optional().describe("rona (RONA stores) or rona_plus (RONA+ stores)."),
      limit: z.number().int().min(1).max(403).optional()
        .describe("Stores to return, 1-403 (default 20 with latitude and longitude, else all)."),
      language,
    },
    post("stores"),
  );

  server.tool(
    "get_rona_store",
    `One ${NAME} store of ${FIRST} by store number or link: store_id, name, banner, address {street, city, province, postal_code, country}, phone, latitude, longitude, hours [{day, opens, closes}], special_hours, departments [{name, hours}], url, relationship, services, market, notes. Hours are local store time. Captured 2026-11-26: store 55130, RONA+ Toronto Stockyards, 110 West Toronto Street, corporate. An unknown store is a charged 404. Costs 1 credit. ${BILL}`,
    {
      store_id: storeId.describe("A RONA store number (5 digits, from get_rona_stores, e.g. 55130). Send store_id or url."),
      url: z.string().max(400).optional().describe("A rona.ca store link instead of store_id."),
      language,
    },
    post("store"),
  );

  server.tool(
    "get_rona_stock",
    `Which ${NAME} stores near a store (or a latitude and longitude) have one article, from ${FIRST}: sku, name, model, center, count, in_stock_count, stores [{store_id, name, distance_km, address, city, province, postal_code, units (exact), in_stock, stock_message, pickup_message, latitude, longitude, url}] (RONA's list, nearest first), market, notes. RONA offers no nearby-store list for some articles (lumber), and the list can come back empty now and then: retry once. Captured 2026-11-26: the DEWALT drill kit (00277649) near store 62860 (Calgary NE): 12 stores, 10 in stock, 21 units at 62860. ${postalNote} An unknown article or store is a charged 404. Costs 3 credits. ${BILL} ${SLOW}`,
    {
      sku: sku.describe("Required. A RONA article number (items[].sku), as a string (e.g. \"00277649\")."),
      store_id: storeId.describe("The stores near this store (5 digits, from get_rona_stores, e.g. 62860). Send store_id or latitude and longitude."),
      latitude: z.number().optional().describe("Instead of store_id, with longitude: the stores near this point."),
      longitude: z.number().optional().describe("With latitude."),
      language,
    },
    post("stock"),
  );

  server.tool(
    "get_rona_deals",
    `RONA's weekly deals (or clearance) listing on ${FIRST}: every promoted product with its sale price and regular price, paged and filtered like search_rona, in RONA's own order (the listing has no sort). ${STORE} Returns type, ${LIST}. ${UNITS} A product's sale end is on get_rona_product (sale_ends_text). Not the printed flyer. Captured 2026-11-26: weekly deals at store 55130, the first a DEWALT 20 V MAX Impact Driver Kit (00277645) at 118 CAD, regular 219. Costs 2 credits; 3 with store_id. ${BILL} ${SLOW}`,
    {
      type: z.enum(["weekly", "clearance"]).optional().describe("weekly (default: RONA's weekly deals) or clearance."),
      ...dealListing,
    },
    post("deals"),
  );
}
