import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/ferguson.ts (Ferguson, ferguson.com, the US plumbing, HVAC and waterworks distributor;
// US only, USD). Credits per endpoint: search and category 2 (4 when a keyword Ferguson sends to a category is asked for
// a later page or best_selling and needs a second read); product 4 (2 when the page names no price). Rules the backend
// enforces and zod here does not: product takes item or url. No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const SITE =
  "Ferguson (ferguson.com, the US plumbing, HVAC and waterworks distributor), US only, prices in USD as ferguson.com shows them to a visitor who is not signed in (never Pro or account pricing)";
const BILL = "credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged (2 credits).";
const ITEM =
  "position, item, name, brand, collection, url, image, part_number (Ferguson's part number), manufacturer_part_number, family_id, rating, variant_attribute {name, values, selected}, unit_of_measure, price_shown (false: price and availability for signed-in customers only), availability {can_ship, has_shipping_inventory, shipping_restricted, ready_to_order, tariff_applies}, compliance";
const GRID = `Returns page, page_size (24), sort, total, total_pages, has_more, count, items [{${ITEM}}] and notes. Results carry no prices (Ferguson adds them after its page loads): use get_ferguson_product for an item's price. Store pickup counts depend on the store Ferguson picks for the visitor and are not returned.`;
const SLOW = "Usually 30 to 60 s (Ferguson's results pages are large); allow a client timeout of at least 240 s.";

const listing = {
  page: z.number().int().min(1).max(100).optional().describe("Results page, 1-based, 24 products a page (default 1). total_pages reports the last one."),
  sort: z.enum(["best_match", "best_selling"]).optional().describe("best_match (the default, Ferguson's own order) or best_selling."),
};

export function registerFergusonTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/ferguson/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_ferguson",
    `Search ${SITE}, by keyword, 24 products a page, best match or best selling. ${GRID} categories [{name, path, count}] are the matching categories (send path to get_ferguson_category). A keyword Ferguson sends straight to a category answers that category's products with redirected_to {category_path, name, url}. A keyword with no products returns total 0. Captured 2026-11-28: pex tubing matched 253 products in 8 categories, Pipe & Tubing holding 158. Costs 2 credits (4 when a keyword Ferguson sends to a category is asked for a later page or best_selling and needs a second page read). ${BILL} ${SLOW}`,
    {
      q: z.string().min(1).max(200).describe("Search keywords, as a buyer types them on ferguson.com (product type, brand, part or item number), e.g. 'pex tubing'."),
      ...listing,
    },
    post("search"),
  );

  server.tool(
    "get_ferguson_category",
    `One category of ${SITE}, by category path, paged and sorted like search_ferguson, with name, url, breadcrumbs [{name, path}] and subcategories [{name, path, count}]. ${GRID} An unknown category is a charged 404. Captured 2026-11-28: water-heaters/tankless-water-heaters held 138 products on 6 pages. Costs 2 credits. ${BILL} ${SLOW}`,
    {
      category: z.string().min(1).max(300)
        .describe("A Ferguson category path (categories[].path of search_ferguson, subcategories[].path of a category answer, or the part after /category/ in a ferguson.com link), e.g. 'water-heaters/tankless-water-heaters', or a ferguson.com /category/ link."),
      ...listing,
    },
    post("category"),
  );

  server.tool(
    "get_ferguson_product",
    `One product of ${SITE}, by item number or link: item, name, brand, collection, url, part_number, manufacturer_part_number, upc, family_id, rating, breadcrumbs, images, price, list_price, price_per_unit, currency, call_for_pricing, note (why price is null: signed-in customers only, or Call for Pricing), unit_of_measure, order_multiple, max_order_quantity, package_quantities [{package (Each, Inner Pack, Case, Pallet), quantity}], variants [{item, attribute, value, selected, price}], specs [{group, items [{name, value}]}], certifications, documents [{type, url}] (specification, installation, warranty sheets), has_parts_or_replacements, prop65_warning and notes. price is per unit_of_measure; package prices are not computed. Items Ferguson prices for signed-in customers only answer price null with a note. Ferguson prices by region: the price is the one Ferguson shows for the region it assigns, so the same item can read a different price on another read. Reviews, questions and store pickup counts are not returned. Captured 2026-11-28: item 4606091, a 1/2 in. brass full port press ball valve, 33.24 USD each, in inner packs of 40. Costs 4 credits (the product page and its price; 2 when the page names no price). ${BILL} Usually 10 to 25 s; allow a client timeout of at least 180 s.`,
    {
      item: z.union([z.string().min(3).max(20), z.number().int().positive()]).optional()
        .describe("A Ferguson item number (items[].item of search_ferguson: the digits after Item # on ferguson.com), e.g. '4606091'. Send item or url."),
      url: z.string().max(500).optional().describe("Or a ferguson.com /product/ link."),
    },
    post("product"),
  );
}
