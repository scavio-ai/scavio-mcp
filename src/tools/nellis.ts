import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/nellis.ts (6 shopping locations in scrapedo-nellis.ts
// NELLIS_LOCATIONS). Rules the backend enforces and zod here does not: item takes id or url;
// pickup_location must be a warehouse of the shopping location asked; page_size x page stays
// within Nellis's 30,000 positions. No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const LOCATIONS = ["las-vegas", "phoenix", "houston", "philadelphia", "denver", "dallas"] as const;
const SORTS = ["featured", "price_low", "price_high", "ending_soon", "ending_last", "retail_low", "retail_high", "bids_low", "bids_high"] as const;

const FIRST =
  "Nellis Auction (nellisauction.com, the liquidation auction marketplace with pickup warehouses in Las Vegas, Phoenix, Houston, Philadelphia, Denver and Dallas)";
const NAME = "Nellis Auction";
const LOCATIONS_TEXT =
  "Shopping locations (location, default las-vegas): las-vegas (Las Vegas, NV), phoenix (Phoenix, AZ), houston (Houston, TX), philadelphia (Philadelphia, PA; pickup in Delran, NJ), denver (Denver, CO) and dallas (Dallas, TX; run by Lots Of Auctions), 13 pickup warehouses in all. Every answer carries location {id, slug, name}.";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const FEES =
  'Fees as Nellis\'s FAQ and terms state them: a buyer\'s premium added to the winning bid ("typically 15% but may vary based on the auction event"; each item carries buyer_premium_percent), plus sales tax. Pickup only, no shipping.';
const PRICES =
  'current_bid is the current high bid in USD (0 before the first bid), as of the fetch: bids move live and a late bid extends the close (extended). retail_price is Nellis\'s own "Estimated Retail Price", as Nellis labels it (Nellis does not state its source): not an MSRP or a verified retail price.';
const NOT_AVAILABLE =
  "Not available: closed or sold items in search (read them by id with get_nellis_item), search suggestions, shipping (pickup only), UPC or model numbers, buy-now, reserve prices, live bid updates, bidding, watchlists, checkout. The same item's new price at Amazon or Walmart, or eBay sold prices, come from those platforms' tools (match on title and brand: Nellis shows no UPC).";
const ITEM =
  "id (the input of get_nellis_item), title, url, inventory_number, current_bid, currency, bid_count, retail_price, buyer_premium_percent, opens, closes, initial_closes (ISO 8601 UTC), extended, market_status (Nellis's own: open, sold, relisted, closed ...), is_closed, condition {rating (1-5 stars), condition, functional, damage, missing_parts, assembly, package} (Nellis's inspection answers, as given), inspection_notes, pickup_location {id, name, address, city, state, zip, timezone}, not_returnable, photos";

const location = z.enum(LOCATIONS).optional()
  .describe("The Nellis shopping location (default las-vegas): las-vegas, phoenix, houston, philadelphia (pickup in Delran, NJ), denver or dallas (run by Lots Of Auctions).");
const many = (example: string, description: string) =>
  z.union([z.string().min(1).max(200), z.array(z.string().min(1).max(200)).min(1).max(10)]).optional()
    .describe(`${description} One name or a list of up to 10 (e.g. ${example}).`);

export function registerNellisTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/nellis/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_nellis",
    `Search the open auctions of ${FIRST} in one shopping location, by keywords (or none: every open auction), sorted (featured, current bid low or high, ending soon or last, estimated retail low or high, bids low or high), filtered by category and subcategory, brand, pickup warehouse, condition stars, estimated retail range, auction event, color and size, and paged (48, 120 or 240 a page). Open auctions only (Nellis's own search shows no closed items): a closed or sold item is read by id with get_nellis_item. Returns location, query, page, page_size, total, total_pages, has_more, count, sort, filters_applied, items [{position, ${ITEM}}], facets {categories, subcategories, brands, pickup_locations, condition_ratings, auction_event_types, auction_event_names, colors, sizes} (Nellis's counts of open items), notes. ${PRICES} ${FEES} ${LOCATIONS_TEXT} ${NOT_AVAILABLE} ${ONE}`,
    {
      q: z.string().max(200).optional()
        .describe("Keywords (e.g. robot vacuum). Empty or omitted: every open auction in the location (filters and sort still apply)."),
      location,
      page: z.number().int().min(1).max(625).optional()
        .describe("Page (default 1). Nellis pages through 30,000 positions at most (page_size x page)."),
      page_size: z.union([z.literal(48), z.literal(120), z.literal(240)]).optional()
        .describe("Items per page: 48, 120 (default) or 240 (Nellis's page sizes)."),
      sort: z.enum(SORTS).optional()
        .describe("featured (default, Nellis's own order), price_low / price_high (current bid), ending_soon / ending_last, retail_low / retail_high (Nellis's Estimated Retail Price) or bids_low / bids_high. Nellis has no newest sort."),
      category: many("Electronics", "Top-level category: categories[].name from get_nellis_categories."),
      subcategory: many("TVs", "Second-level category: subcategories[].name from get_nellis_categories."),
      brand: many("Samsung", "Brand as Nellis lists it: facets.brands[].name."),
      pickup_location: many("North Las Vegas", "Pickup warehouse within the shopping location: facets.pickup_locations[].name or locations[].name of get_nellis_locations. A warehouse of another shopping location is a 400, not charged."),
      condition_rating: z.union([z.number().int().min(1).max(5), z.array(z.number().int().min(1).max(5)).min(1).max(5)]).optional()
        .describe("Nellis's condition grade in stars, 1-5 (one or a list)."),
      retail_min: z.number().min(0).optional().describe("Lowest Nellis Estimated Retail Price, USD."),
      retail_max: z.number().min(0).optional().describe("Highest Nellis Estimated Retail Price, USD."),
      auction_event_type: many("Retail Returns", "Auction event type: facets.auction_event_types[].name (Retail Returns or Consigner / Third Party)."),
      auction_event_name: many("Daily Auction - North Las Vegas - Nov 24th", "Auction event: facets.auction_event_names[].name or auction_events[].name of get_nellis_categories."),
      color: many("Black", "Color as Nellis lists it: facets.colors[].name."),
      size: many("Large", "Size as Nellis lists it: facets.sizes[].name."),
    },
    post("search"),
  );

  server.tool(
    "get_nellis_item",
    `One ${NAME} item by id or link, open, closed or sold: requested_id, ${ITEM}, category, subcategory, brand, color, size, features, descriptions, dimensions, weight, operator (the seller running the auction as Nellis names it: Nellis Auction or a partner such as Lots Of Auctions), final_price (the winning bid of a sold item, before Nellis's buyer's premium and tax; null otherwise), bid_history [{time, amount (USD), status (Winning or Outbid)}] (Nellis's public bid list, no bidder names or ids), notes. A sold item's final price is public by id. Captured 2026-11-25: a sold lot (id 141100004, wax seal beads, Estimated Retail Price 9.99) had final_price 6 after 5 bids; an open LG 65" OLED TV (id 141281552, Estimated Retail Price 1595.75) stood at a current bid of 101 after 8 bids. ${PRICES} ${FEES} An unknown id is a charged 404. ${ONE}`,
    {
      id: z.union([z.string().min(5).max(20), z.number().int().positive()]).optional()
        .describe("A Nellis Auction item id (items[].id of search_nellis, the number at the end of a nellisauction.com/p/ link, e.g. 141281552). Send id or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("A Nellis Auction item link (https://www.nellisauction.com/p/<title>/<id>) instead of id."),
    },
    post("item"),
  );

  server.tool(
    "get_nellis_locations",
    `The pickup warehouses of ${FIRST} (13 in all), or those of one shopping location: location, count, shopping_locations [{id, slug, name, warehouses}], locations [{id, name, address, city, state, coordinates {lat, lng}, operator (Nellis Auction or a partner), shopping_location {id, slug, name}, hours {monday ... sunday: {open, close} or null when closed}}] (hours as Nellis's location page gives them, local time), notes. locations[].name is the input of search_nellis's pickup_location. Pickup only: won items are picked up at the warehouse by appointment. ${ONE}`,
    {
      location: location.describe("Optional: only the warehouses of this shopping location (las-vegas, phoenix, houston, philadelphia, denver, dallas). Without it: all 13."),
    },
    post("locations"),
  );

  server.tool(
    "get_nellis_categories",
    `The live category, brand and auction-event counts of one ${NAME} shopping location (open auctions only), or the subcategories of one category: location, category, total_open_items, count, categories [{name, count}], subcategories [{name, count}], brands [{name, count}] (Nellis's top 100), auction_events [{name, count}], auction_event_types [{name, count}], pickup_locations [{name, count}], notes. Names are the inputs of search_nellis's category, subcategory, brand, auction_event_name and pickup_location. A category with no open items is a charged 404. ${LOCATIONS_TEXT} ${ONE}`,
    {
      location,
      category: z.string().min(1).max(120).optional()
        .describe("Optional: one top-level category (categories[].name, e.g. Electronics): its subcategories, brands and auction events."),
    },
    post("categories"),
  );
}
