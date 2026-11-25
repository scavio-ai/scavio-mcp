import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. That matters more here than elsewhere: Home Depot
// does NOT fall back on an unknown sort — it answers 200 with an empty page
// that is still billed — so a bad value costs credits and returns
// nothing. Upstream defaults are documented in the describe text instead.
//
// Shapes mirror backend/src/routes/homedepot.ts + homedepot-ca.ts. `country`
// is optional and absent by default, so a US call posts exactly what it did
// before Home Depot Canada existed. With country "ca" the shared tools read
// Home Depot Canada (homedepot.ca); the five get_home_depot_* tools below the
// shared ones are Home Depot Canada only and need no country.

const country = () =>
  z.enum(["us", "ca"]).optional()
    .describe("'us' (default, homedepot.com) or 'ca' (Home Depot Canada, homedepot.ca, CAD).");

const language = () =>
  z.enum(["en", "fr"]).optional()
    .describe("ca only: 'en' (default) or 'fr'. Same ids and CAD prices; names, links and facets in that language.");

const caStoreId = () =>
  z.union([z.string().min(1).max(10), z.number().int()])
    .describe("Home Depot Canada store number, e.g. '7080' (from get_home_depot_stock or get_home_depot_store).");

const caItemId = () =>
  z.string().min(1).max(2000)
    .describe("Home Depot Canada item id (10 digits), e.g. '1001769719', or a homedepot.ca/product/... link.");

/** Listing inputs Home Depot Canada takes on search and category. */
const caListing = () => ({
  store_id: caStoreId().optional()
    .describe("ca only: store whose price and units to read, e.g. '7080'. Default: the site's store 7274; data.store says which."),
  page_size: z.number().int().min(1).max(40).optional()
    .describe("ca only: products/page, 1-40 (default 40)."),
  filters: z.array(z.object({ facet: z.string().max(80).optional(), value: z.string().max(8) })).max(10).optional()
    .describe("ca only: up to 10 facet filters [{facet, value}], values from facets (include_facets), e.g. [{facet:'manufacturerName', value:'9wh'}]."),
  deals: z.array(z.enum(["special_buy", "new_lower_price", "savings"])).min(1).max(3).optional()
    .describe("ca only: Special Offers filter. With no query, every product with that offer."),
  include_facets: z.boolean().optional()
    .describe("ca only: also return facets to filter on."),
  language: language(),
});

export function registerHomeDepotTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/homedepot/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_home_depot",
    `Search Home Depot (homedepot.com) or, with country 'ca', Home Depot Canada (homedepot.ca, 182 stores in 10 provinces): price, brand and model, ratings, badges. us: fixed 12 items/page; invalid sort_by returns billed empty page. ca: priced at store_id with exact store_units and aisle/bay, CAD, 1-40/page, facet filters and deals; query, category_id or deals. 2 credits/page us, 1 ca.`,
    {
      query: z.string().min(1).max(500).optional()
        .describe("Search query, e.g. 'cordless drill 20v'. Required for us; for ca pass query, category_id or deals."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. us fixed 12/page; ca max 500."),
      sort_by: z.enum(["best_match", "top_sellers", "top_rated", "price_low", "price_high"]).optional()
        .describe("Sort order. Default 'best_match'. top_sellers is us only (400 for ca)."),
      min_price: z.number().min(0).optional()
        .describe("Min price (USD for us, CAD for ca)."),
      max_price: z.number().min(0).optional()
        .describe("Max price (USD for us, CAD for ca)."),
      country: country(),
      category_id: z.string().min(1).max(80).optional()
        .describe("ca only: a category id from get_home_depot_categories, e.g. 'l4-drill-drivers'."),
      ...caListing(),
    },
    post("search"),
  );

  server.tool(
    "get_home_depot_product",
    `Get full Home Depot product detail. us: only 10-review preview; use get_home_depot_reviews for full reviews. ca (Home Depot Canada): with store_id, price is that store's price (price_source 'store') and online_price the online price, which can differ; store_units exact, aisle, bay. When Home Depot Canada has no store record for the item, the online price comes back with store_price_returned false. No UPC for ca. 2 credits us, 1 ca.`,
    {
      item_id: z.string().min(1)
        .describe("Item id, e.g. '206566893', or homedepot.com URL; for ca a 10-digit id, e.g. '1000112108', or homedepot.ca link."),
      country: country(),
      store_id: caStoreId().optional()
        .describe("ca only: store number, e.g. '7128', for that store's price, units and aisle/bay."),
      language: language(),
    },
    post("product"),
  );

  server.tool(
    "get_home_depot_reviews",
    `Get Home Depot product reviews. us: 30/page, stop at total_pages. ca (Home Depot Canada): the first 8 reviews per language plus the first page of questions; page > 1 is a 400. No reviewer names for ca. 2 credits/page us, 1 ca.`,
    {
      item_id: z.string().min(1)
        .describe("Item id, e.g. '206566893', or homedepot.com URL; for ca a 10-digit id or homedepot.ca link."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based, 30/page (us only)."),
      country: country(),
      language: language(),
    },
    post("reviews"),
  );

  server.tool(
    "get_home_depot_stores",
    `Find Home Depot stores. us: near a ZIP, city or address: store number, address, coordinates, distance, phones, hours, services; use the store number with get_home_depot_availability and get_home_depot_shipping. ca (Home Depot Canada): near a postal code or city (query) or latitude + longitude, with 7 dated days of hours. 2 credits us, 1 ca.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("ZIP, city or address, e.g. '98101'. Required for us; for ca a postal code or city, e.g. 'M5V 2T6', or pass latitude + longitude."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Stores to return, nearest first. us 1-20 (default 20); ca 1-50 (default 10)."),
      country: country(),
      latitude: z.number().optional()
        .describe("ca only: with longitude, instead of query."),
      longitude: z.number().optional()
        .describe("ca only: with latitude, instead of query."),
      page: z.number().int().min(1).max(100).optional()
        .describe("ca only: page, 1-based."),
      language: language(),
    },
    post("stores"),
  );

  server.tool(
    "get_home_depot_availability",
    `One Home Depot item at a store. us: price, promotions and pickup stock at store_id, and/or delivery options, dates and charges to zip (pass either or both). ca (Home Depot Canada): store_id required; the store's price, exact store_units, aisle, bay, online units (zip is a 400: no delivery quotes for Canada). When Home Depot Canada has no store record for an existing item: unbilled 502. 2 credits us, 1 ca.`,
    {
      item_id: z.string().min(1)
        .describe("Item id, e.g. '206566893', or homedepot.com URL; for ca a 10-digit id, e.g. '1001769719', or homedepot.ca link."),
      store_id: z.string().min(1).max(10).optional()
        .describe("Store number from get_home_depot_stores, e.g. '4702' (us) or '7076' (ca). Required for ca."),
      zip: z.string().optional()
        .describe("us only: 5-digit ZIP to quote delivery to, e.g. '98101'."),
      country: country(),
      language: language(),
    },
    post("availability"),
  );

  server.tool(
    "get_home_depot_shipping",
    `US only (homedepot.com): every delivery option Home Depot quotes for an item to a ZIP for a quantity: charge, free-shipping status, delivery dates, delivery level on bulky items, states it will not ship to. Not available for Home Depot Canada (country 'ca' is a 400, not charged). 4 credits.`,
    {
      item_id: z.string().min(1)
        .describe("Item id, e.g. '206566893', or homedepot.com URL."),
      zip: z.string()
        .describe("5-digit US ZIP, e.g. '98101'."),
      quantity: z.number().int().min(1).max(999).optional()
        .describe("Units to quote delivery for. Default 1."),
      store_id: z.string().optional()
        .describe("Optional store number from get_home_depot_stores."),
    },
    post("shipping"),
  );

  server.tool(
    "get_home_depot_category",
    `Home Depot Canada only (homedepot.ca): one category or collection page by category_id from get_home_depot_categories (e.g. 'l4-drill-drivers', '661103' Christmas Trees), priced at store_id, with search_home_depot's ca filters and sorts. CAD. Unknown category or store is a charged 404. 1 credit.`,
    {
      category_id: z.string().min(1).max(80)
        .describe("Category or collection id, e.g. 'l4-drill-drivers' or '661103'."),
      query: z.string().min(1).max(500).optional()
        .describe("Optional keywords inside the category."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based."),
      sort_by: z.enum(["best_match", "price_low", "price_high", "top_rated"]).optional()
        .describe("Default 'best_match'."),
      min_price: z.number().min(0).optional()
        .describe("Min price CAD."),
      max_price: z.number().min(0).optional()
        .describe("Max price CAD."),
      ...caListing(),
    },
    post("category"),
  );

  server.tool(
    "get_home_depot_categories",
    `Home Depot Canada only (homedepot.ca): the department tree (about 1,750 nodes) and current event/collection pages (e.g. Black Friday). departments[].id and events[].id are category_id inputs. 1 credit.`,
    {
      depth: z.number().int().min(1).max(4).optional()
        .describe("Tree levels, 1-4 (default 4: all)."),
      language: language(),
    },
    post("categories"),
  );

  server.tool(
    "get_home_depot_stock",
    `Home Depot Canada only (homedepot.ca): exact units of one item at every store near a postal code or city, one call. No prices; use get_home_depot_product with store_id for a store's price. When Home Depot Canada has no store record for an existing item: unbilled 502. 1 credit.`,
    {
      item_id: caItemId(),
      location: z.string().min(1).max(100)
        .describe("Canadian postal code or city, e.g. 'M5V 2T6' or 'Montreal'."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Stores/page, 1-50 (default 20)."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      language: language(),
    },
    post("stock"),
  );

  server.tool(
    "get_home_depot_store",
    `Home Depot Canada only (homedepot.ca): one store by number: address, phone, coordinates, services, 7 dated days of hours, nearby stores. Unknown store is a charged 404. 1 credit.`,
    {
      store_id: caStoreId(),
      language: language(),
    },
    post("store"),
  );

  server.tool(
    "get_home_depot_suggestions",
    `Home Depot Canada only (homedepot.ca): search-box keyword suggestions for typed text, plus suggested installation services. 1 credit.`,
    {
      query: z.string().min(1).max(100)
        .describe("Text typed so far, e.g. 'christ'."),
      store_id: caStoreId().optional()
        .describe("Optional store number."),
      language: language(),
    },
    post("suggestions"),
  );
}
