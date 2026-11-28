import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/globalindustrial.ts (Global Industrial, globalindustrial.com, the US
// industrial-equipment and MRO supplier; Global Industrial Canada at globalindustrial.ca). Rules the backend enforces
// and zod here does not: product takes url or item. No zod `.default()`: the MCP SDK would post a defaulted field on
// every call.

const SITE =
  "Global Industrial (globalindustrial.com, the US industrial-equipment and MRO supplier; Global Industrial Canada at globalindustrial.ca with market ca), prices as shown to a visitor who is not signed in, in USD (us) or CAD (ca)";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 5 to 60 s; allow a client timeout of at least 180 s.";
const PRICES =
  "price is the price of one selling unit (a pack or case where package_quantity is above 1) and unit_price the price per piece; quantity_breaks [{qty_start, qty_end, unit_price, package_price}] are the site's volume prices, counted in selling units. A MAP-priced item shows 'See price in cart' on the site instead of a price: its price fields are null and map_pricing is true. msrp is a list price Global Industrial does not show on the page, and it can sit below the price.";
const ITEM =
  "position, item_number, item_key, legacy_number, name, url, slug, image, brand, manufacturer_part_number, distributor_part_number, unspsc, product_group {group_id, name}, category, category_path, currency, price, price_type (regular, promotional, clearance), was_price, savings_percent, msrp, clearance_price, sale_price, map_pricing, price_in_cart, map_price, call_for_price, package_quantity (pieces per selling unit), unit_price (per piece), min_order_quantity, max_order_quantity, quantity_breaks, in_stock, availability (e.g. Ships in 5 Business Days), lead_time_days, ships_ltl_freight, free_shipping, hazardous, non_returnable, clearance, best_seller, new_arrival, rating, review_count, highlights [{name, value}], variants {name, options [{value, item_key}]}";
const FACETS = "facets [{key, name, type (field, range, category), values}]";
const NOT_BUILT = "No sort, reviews or questions.";

const market = z.enum(["us", "ca"]).optional()
  .describe("us (default: www.globalindustrial.com, USD) or ca (www.globalindustrial.ca, Global Industrial Canada, CAD, English).");
const brand = z.string().min(1).max(80)
  .describe("A brand as Global Industrial writes it (items[].brand or a brand facet value), e.g. 'Wesco', 'Global Industrial' or 'Valley Craft'.");

export function registerGlobalIndustrialTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/globalindustrial/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_globalindustrial",
    `Search ${SITE} by keyword, Global Industrial item number or manufacturer part number, optionally one brand. Global Industrial answers a keyword with a search listing, or sends it to a category or straight to the product page: landed_on (search, category, product) and redirected_to (the site path it opened) say which. Returns total, count, items [{${ITEM}}], groups [{group_id, name, count, shown, attributes}] (a leaf category lists products by product group, at most 10 each), subcategories [{name, path, url, total, leaf}] (when the keyword maps to a broad category; items are then that page's Top Selling products), category, ${FACETS} and notes. Up to 42 products of a search listing; total is the full count. ${PRICES} ${NOT_BUILT} A keyword with no products returns total 0. Captured 2026-11-28: nitrile gloves 6 mil matched 13 products; nitrile gloves opened the disposable gloves category (79 products). ${COST}`,
    {
      query: z.string().min(1).max(120)
        .describe("Keywords, a Global Industrial item number (e.g. '652508') or a manufacturer part number (e.g. '240083')."),
      brand: brand.optional(),
      market,
    },
    post("search"),
  );

  server.tool(
    "get_globalindustrial_category",
    `One category of ${SITE} by category path (/c/...) or department path (/t/...), optionally one brand or one product group. A leaf category returns its products grouped by product group: groups [{group_id, name, count (the group's full count), shown, attributes}] and items [{${ITEM}}] (at most 10 per group; group lists every product of one group). A broader category or a department returns subcategories [{name, path, url, total, leaf}]. Also category {name, path, url, leaf, breadcrumbs}, total, ${FACETS}, filters_selected and notes, in the site's default order. ${PRICES} An unknown category is a charged not-found. Captured 2026-11-28: /c/carts-trucks/hand_trucks/drum_trucks_cradles held 162 products. ${COST}`,
    {
      path: z.string().min(1).max(600)
        .describe("A category path (/c/..., as subcategories[].path or items[].category_path give it), e.g. '/c/carts-trucks/hand_trucks/drum_trucks_cradles', a department path ('/t/carts-trucks'), or a link to one."),
      brand: brand.optional().describe("Limit the category to this brand's products (as Global Industrial writes the brand)."),
      group: z.union([z.number().int().min(1), z.string().regex(/^\d{1,8}$/)]).optional()
        .describe("A product group of a leaf category (groups[].group_id), e.g. 42311: every product of that group."),
      market,
    },
    post("category"),
  );

  server.tool(
    "get_globalindustrial_brand",
    `The products of one brand on ${SITE}: brand (as matched), total (the brand's full product count), count, items [{${ITEM}}] (up to 42, as the brand page lists them) and facets (the brand's product count per top-level category). ${PRICES} An all-lowercase or all-uppercase name is also tried with the usual capitalisation. A brand with no products is a charged not-found. Captured 2026-11-28: Wesco listed 438 products. ${COST}`,
    {
      brand,
      market,
    },
    post("brand"),
  );

  server.tool(
    "get_globalindustrial_product",
    `One product of ${SITE} by product link or slug, or by item number or manufacturer part number. Returns the item fields (${ITEM}) plus summary (a one-line description), breadcrumbs [{name, path, url}], images, specs [{group, name, value, unit}], documents [{type, title, url}] (manuals and spec sheets) and launch_date. ${PRICES} ${NOT_BUILT} An unknown product is a charged not-found. Captured 2026-11-28: item 652508, a Wesco dispenser truck for poly and fiber drums, was 399.95 USD, ships in 15 business days; on globalindustrial.ca a Global Industrial manual pallet jack was 409.95 CAD (was 515). ${COST}`,
    {
      url: z.string().min(1).max(800).optional()
        .describe("A product link or path (items[].url, /p/<name>) or its slug (items[].slug), e.g. 'https://www.globalindustrial.com/p/dispenser-truck-poly-drums'. Send url or item."),
      item: z.string().min(1).max(40).optional()
        .describe("A Global Industrial item number (items[].item_number) or a manufacturer part number, instead of url, e.g. '652508'."),
      market,
    },
    post("product"),
  );

  server.tool(
    "get_globalindustrial_clearance",
    `The clearance section of ${SITE}. Without filters: total (all clearance products), categories [{id, name, count}] (clearance count per category), sections [{title, count}] and items [{${ITEM}, section}] (the page's New to Clearance and Bestsellers products). With category (categories[].id) and / or brand: up to 42 matching clearance products, total, the sub-category counts in categories and ${FACETS}. Clearance items carry price_type clearance, clearance_price, was_price and, where the site limits it, max_order_quantity. Captured 2026-11-28: PRIME30 (Carts & Trucks) held 65 clearance products, among them a stacking-chair dolly at 115.95 USD (was 209.95). ${COST}`,
    {
      category: z.string().min(1).max(20).optional()
        .describe("A clearance category id (categories[].id of a clearance answer), e.g. 'PRIME30' for Carts & Trucks."),
      brand: brand.optional().describe("Limit the clearance listing to this brand."),
      market,
    },
    post("clearance"),
  );
}
