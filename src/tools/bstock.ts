import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/bstock.ts (B-Stock, bstock.com, the liquidation marketplace where retailers sell
// returns and overstock; limits in scrapedo-bstock.ts BSTOCK_*). Rules the backend enforces and zod here does not: lot
// takes id or url; sort relevance needs q. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "B-Stock (bstock.com, the liquidation marketplace where retailers and brands sell customer returns and overstock by the pallet or truckload), as a visitor who is not signed in sees it";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const FAST = `${ONE} Usually 1 to 10 s; allow a client timeout of at least 180 s.`;
const SLOW = `${ONE} Usually 3 to 45 s; allow a client timeout of at least 180 s.`;
const MONEY =
  "Amounts are in each listing's currency (USD for most lots; EUR or GBP for Amazon Europe lots). Bids move live: current_bid, bids and end_time are as of the fetch (a late bid can extend the close). retail_value is the seller's stated total retail of the lot, as B-Stock lists it. No bidder identities are returned.";
const CARD =
  "position, listing_id (what get_bstock_lot takes), title, url, lot_source (marketplace or amazon_europe), storefront {id, name}, currency, current_bid, bids, unique_bidders (a count), retail_value, buy_now {available, ends_at}, pricing_strategy, listing_type, start_time, end_time, condition, inventory_type, categories, lot_categories [{category, percent_by_quantity, percent_by_retail_value}], units, pallets, manufacturers, models, shipment_type, transport_mode, allowed_shipment_types, has_manifest, deal (B-Stock's Great / Good / Fair Price badge), location {city, state, country, region}, image";

const many = (example: string, description: string, max = 120) =>
  z.union([z.string().min(1).max(max), z.array(z.string().min(1).max(max)).min(1).max(10)]).optional()
    .describe(`${description} One value or a list of up to 10 (any of them), e.g. ${example}.`);

export function registerBstockTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/bstock/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_bstock",
    `Search the open liquidation lots of ${SITE}, by keyword (or none: every open lot), filtered by storefront, category, subcategory, condition, inventory type, buying format, region, shipment type and manufacturer, sorted recommended, end_time or relevance, 20 per call by default (up to 200), paged with offset. Returns query, sort, limit, offset, total, count, has_more, filters_applied, listings [{${CARD}}] and notes. ${MONEY} Closed and sold lots and their final prices are not available; search suggestions are not offered. No results is an empty answer (charged). Captured 2026-11-28: laptop matched 20 open lots, the first 8 Apple 16-inch MacBook Pro laptops at a 1,680 USD opening bid. ${FAST}`,
    {
      q: z.string().max(200).optional().describe("Keywords, e.g. 'laptop'. Omitted: every open listing (filters and sort still apply)."),
      storefront: many("'Target' or ['Walmart', 'The Home Depot']", "A retailer or brand marketplace on B-Stock: storefronts[].id, value or name from get_bstock_storefronts."),
      category: many("'Electronics'", "Top-level category: categories[].value from get_bstock_filters."),
      subcategory: many("'Laptops'", "Second-level category: subcategories[].value from get_bstock_filters."),
      condition: many("'Like New'", "Lot condition: conditions[].value (New, Like New, Used Good, Used Fair, Mixed, Salvage ...).", 60),
      inventory_type: many("'Customer Returns'", "Inventory type: inventory_types[].value (Customer Returns, Overstock, Shelf Pulls, Mixed/Other ...).", 60),
      buying_format: many("'AUCTION'", "How the lot is sold: AUCTION, BUY_NOW or MAKE_AN_OFFER.", 40),
      region: many("'GA/US'", "Where the lot ships from: regions[].value from get_bstock_filters ('GA/US' a US state, 'ON/CA' a Canadian province, '/ES' a European country).", 12),
      shipment_type: many("'LTL'", "Shipment size: LTL, PARCEL or Truckload.", 40),
      manufacturer: many("'Apple'", "Manufacturer as B-Stock lists it: manufacturers[].value from get_bstock_filters."),
      sort: z.enum(["recommended", "end_time", "relevance"]).optional()
        .describe("recommended (B-Stock's order; the default without q), end_time (soonest closing first) or relevance (needs q; the default with q)."),
      limit: z.number().int().min(1).max(200).optional().describe("Listings per call, 1-200 (default 20)."),
      offset: z.number().int().min(0).max(10000).optional().describe("Listings to skip, 0-10000 (default 0): offset + limit pages through total."),
    },
    post("search"),
  );

  server.tool(
    "get_bstock_lot",
    `One lot of ${SITE}, by listing id or link: requested_id, listing_id, listing_number, title, url, lot_source, status, storefront {id, name, slug}, currency, pricing_strategy, listing_type, purchasing_starts, purchasing_ends, auction {state, start_price, current_bid, next_minimum_bid, bids, unique_bidders, start_time, end_time, initial_end_time, extended, closed, canceled, buying_format_sequence, buy_now {enabled, price, starts_at, ends_at}}, views, deal, retail_value, units, pallets, condition, conditions, inventory_types, packaging, categories, manufacturers, models (the seller's breakdown with quantity and shares), description, location, shipping {transport_mode, allowed_shipment_types, truck_count, hazmat, note}, images, seller_terms_url, manifest {items_total, preview_count, full_manifest, preview [{description, quantity, unit_retail, ext_retail, condition, categories, seller_category, brand, model, ids, attributes, seller_grade, comments}]} and notes. The manifest preview is the rows B-Stock shows publicly (up to 10); the full manifest needs a signed-in buyer account. An Amazon Europe lot (a numeric id) returns what its public page shows (title, currency, status, current_bid, bids, next_minimum_bid, retail_value, units, end_time). A make-an-offer listing or an unknown id is a charged not-found. ${MONEY} Captured 2026-11-28: 6b05cd6821e9e20881d2a998, 2 pallets of insulated work boots (218 units, stated retail 61,522 USD) at a 1,508 USD bid after 21 bids, next minimum 1,533 USD, 11 manifest rows. ${SLOW}`,
    {
      id: z.string().min(1).max(40).optional()
        .describe("listings[].listing_id of search_bstock (24 hex characters), e.g. '6b05cd6821e9e20881d2a998', or the number of an Amazon Europe lot. Send id or url."),
      url: z.string().min(10).max(500).optional().describe("Or a bstock.com listing link (listings[].url)."),
    },
    post("lot"),
  );

  server.tool(
    "get_bstock_storefronts",
    `The retailer and brand marketplaces of ${SITE} with open listings right now: count, total_open_listings, storefronts [{id, name, value, open_listings, lot_source}] and notes. id, value or name is search_bstock's storefront input. Captured 2026-11-28: 37 storefronts, 735 open listings. ${FAST}`,
    {},
    post("storefronts"),
  );

  server.tool(
    "get_bstock_filters",
    `The search filters of ${SITE} with B-Stock's counts of open listings: total_open_listings, categories, subcategories, conditions, inventory_types, buying_formats, shipment_types, regions [{value, path, count}], manufacturers (the top 500), listing_types and deals ([{value, count}] each), storefront_count and notes. Each value is the input of the search_bstock field of the same name. Captured 2026-11-28: 18 categories and 111 subcategories over 735 open listings. ${FAST}`,
    {},
    post("filters"),
  );
}
