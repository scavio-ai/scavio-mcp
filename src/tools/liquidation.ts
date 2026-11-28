import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/liquidation.ts (Liquidation.com, the US online liquidation auction site of Liquidity
// Services; categories and filter names in the backend's LIQUIDATION_* constants). Rules the backend enforces and zod
// here does not: search needs q, category, seller or a filter; order needs a sort other than relevance; relevance needs
// q; lot and manifest take id or url; closed takes seller, category, page and per_page only. No zod `.default()`: the
// MCP SDK would post a defaulted field on every call.

const SITE =
  "Liquidation.com (liquidation.com, the US online liquidation auction site of Liquidity Services, where retailers, brands and marketplace sellers sell customer returns, overstock and shelf pulls by the package, pallet or truckload), as a visitor who is not signed in sees it";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW = `${ONE} Usually 3 to 60 s; allow a client timeout of at least 180 s.`;
const FAST = `${ONE} Usually 1 to 10 s; allow a client timeout of at least 180 s.`;
const MONEY =
  "Amounts in USD, or CAD for lots in Canadian warehouses (Brampton, ON); the buyer's premium, shipping and sales tax come on top of a bid. est_retail is the seller's stated retail value. Bids move live: current_bid, bids and watchers are as of the fetch. Seller handles are as the site shows them; bidder identities are not returned.";
const CARD =
  "position, id (what get_liquidation_lot and get_liquidation_manifest take), title, url, image, seller, closing_text, closes_at, location_state, condition, packages {count, unit}, items, currency, current_bid, sealed_bid, bids, watchers, views, est_retail";
const CATEGORIES =
  "Appliances 1700, Clothing & Accessories 1001, Computers & Networking 1002, Consumer Electronics 1004, Furniture 1600, General Merchandise 1005, Health & Beauty 1800, Holiday & Seasonal 1045, Home Improvement 1900, Housewares 1006, Jewelry & Watches 1011, Mystery Box 1017, Tools & Machinery 1003";
const SELLER = "A seller handle as Liquidation.com shows it (results[].seller, lot seller.handle or facets.seller[].value), e.g. 'Amazon FBA', 'Newegg_Business' or 'Titan Electronics'.";

const many = (values: string, max: number) =>
  z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).min(1).max(max)]).optional()
    .describe(`${values}. One value or a list (any of them).`);
const category = many(`A top category, by id or name: ${CATEGORIES}. Up to 8`, 8);
const page = {
  page: z.number().int().min(1).max(500).optional().describe("Results page, 1-500 (default 1)."),
  per_page: z.number().int().min(1).max(100).optional().describe("Lots per page, 1-100 (default 27, the site's default)."),
};
const lotRef = {
  id: z.string().min(1).max(20).optional().describe("results[].id of search_liquidation: a Liquidation.com auction id (digits), e.g. '21648824'. Send id or url."),
  url: z.string().min(10).max(500).optional().describe("Or a liquidation.com auction link (/auction/view?id=<id>)."),
};

export function registerLiquidationTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/liquidation/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_liquidation",
    `Search the open auctions of ${SITE}, by keyword, category, lot size, condition, US region, auction type and seller (at least one), sorted by close_time, current_bid, items, title (asc / desc) or relevance, 27 per page by default (up to 100). Returns query, filters_applied, sort, order, page, per_page, total, count, has_more, results [{${CARD}}], facets (the site's counts by category, condition, region, state, lot_size, warehouse, seller, retail_price, number_of_bids, shipping, auction_type and lot_price) and notes. ${MONEY} Search suggestions are not offered. No results is an empty answer (charged). Captured 2026-11-28: laptop matched 73 open auctions, the first a gaming PC lot of 7 items (stated retail 6,600 USD) at a 3,000 USD opening bid. ${SLOW}`,
    {
      q: z.string().max(200).optional().describe("Keywords (title and description), e.g. 'laptop'."),
      category,
      lot_size: many("Lot size: package, pallet, truckload, large_item", 4),
      condition: many("Condition: new, used, refurbished, returns, shelf_pulls, salvage, damaged, scratch_and_dent", 8),
      region: many("US region of the warehouse: northeast, midwest, west, south", 4),
      auction_type: many("Auction type: standard, fixed_price, sealed_bid, mixed_format", 4),
      seller: z.string().max(80).optional().describe(SELLER),
      sort: z.enum(["close_time", "current_bid", "items", "relevance", "title"]).optional()
        .describe("close_time (soonest closing first by default), current_bid (highest first), items (items per lot, most first), title (A-Z) or relevance (needs q). Omitted: the site's default order."),
      order: z.enum(["asc", "desc"]).optional().describe("With sort (not relevance): asc or desc."),
      ...page,
    },
    post("search"),
  );

  server.tool(
    "get_liquidation_lot",
    `One open auction of ${SITE}, by auction id or link: requested_id, id, title, url, status, closes_at (ISO 8601 with the America/New_York offset), closes_text, time_left, currency, current_bid, minimum_bid, buy_now_price, sealed_bid, bids, bidders (a count), watchers, views, auction_type, buyers_premium_pct, seller {handle, marketplace_seller, selling_for, lifetime_completed_transactions, past_90_days {completed_transactions, cancelled_transactions_pct, average_days_to_ship, honored_disputes_pct}}, fulfilled_by, location {city, state}, condition, condition_definition, category, subcategories, quantity, quantity_variance_pct, est_retail_per_unit, bid_price_per_unit, size_class, packages {count, unit}, available_lots, shipping {terms, minimum_fee, weight_lbs, dimensional_weight_lbs, weight_text, ship_from_zip3, restrictions}, has_manifest, images, description (plain text), attributes and notes. A closed or unknown auction is a charged not-found (get_liquidation_closed lists a seller's closed lots). ${MONEY} Captured 2026-11-28: 21648824, a gaming PC lot of 4 returns from a marketplace seller, at a 1,100 USD bid (minimum next bid 1,150 USD, 11% buyer's premium). ${SLOW}`,
    lotRef,
    post("lot"),
  );

  server.tool(
    "get_liquidation_manifest",
    `The item manifest of one auction of ${SITE}, by auction id or link: id, lot_url, columns [{header (as the seller wrote it), key}], row_count, truncated, rows (one object per item, keyed by columns[].key: description, quantity, brand, model, category, upc, asin, lpn and the seller's price columns such as retail_price, ext_retail_price, total_retail_price) and notes. Columns differ by seller and price columns keep the seller's label. A lot without a manifest is a charged not-found. Captured 2026-11-28: 21648824 listed 4 rows under 7 columns. ${FAST}`,
    lotRef,
    post("manifest"),
  );

  server.tool(
    "get_liquidation_closed",
    `Closed auctions of one seller on ${SITE}, by seller (required), optionally narrowed by category, 27 per page by default (up to 100): filters_applied, page, per_page, total, count, has_more, results [{position, id, title, url, image, seller, location_state, condition, packages, items, currency, final_bid, sealed_bid, bids, views, est_retail}], facets and notes. The site shows no close date for closed lots and does not apply keywords to them, so this tool takes a seller, a category and paging only (anything else is refused, not charged). Captured 2026-11-28: Titan Electronics had 2,373 closed lots. ${SLOW}`,
    {
      seller: z.string().min(1).max(80).describe(`Required. ${SELLER}`),
      category: many(`Narrows the seller's closed lots. A top category, by id or name: ${CATEGORIES}. Up to 8`, 8),
      ...page,
    },
    post("closed"),
  );
}
