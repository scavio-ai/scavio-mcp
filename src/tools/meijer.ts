import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/meijer.ts (Meijer, meijer.com, the Midwest grocery and general-merchandise chain;
// US only, USD). 1 credit on every tool. Rules the backend enforces and zod here does not: product and reviews take
// meijer_id or upc (one, not both); a upc must carry a valid check digit. No zod `.default()`: the MCP SDK would post
// a defaulted field on every call.

const SITE =
  "Meijer (meijer.com, the Midwest grocery and general-merchandise chain: Michigan, Ohio, Indiana, Illinois, Kentucky, Wisconsin; US only, USD)";
const BILL = "1 credit. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW = "Allow a client timeout of at least 180 s.";
const STORE =
  "Meijer prices by store: prices, stock and aisles are those of the store_id you send, and they differ by store (Meijer Whole Milk, Gallon was $2.88 at Franklin IN, $2.99 at Jeffersonville IN and Cincinnati OH on 2026-11-28). store_requested is the store asked for, store_used {store_id, name} the store the page used, store_matches whether they agree; without store_id Meijer picks a store by location and store_used names it.";
const PRICE =
  "Prices are US dollars as numbers (3.99 = $3.99): price (per pricing_unit: EA each, LB pound), regular_price, clearance_price, price_per_sold_by_unit, regular_price_per_sold_by_unit and clearance_price_per_sold_by_unit (what one item costs, per sold_by_unit), avg_pricing_units_per_sold_by_unit, price_text (as the page shows it, e.g. $3.99 or Buy 4 for $5.00), multi_buy {quantity, total} (only when price_text says it; price is then the price of one), on_sale, on_clearance, savings_text, price_ends, deposit, currency (USD)";
const ITEM = `position, meijer_id (the input of get_meijer_product and get_meijer_reviews), upc, ean13, product_id, name, url, image, ${PRICE}, priced, stock_status (inStock, lowStock, outOfStock), promotions, mperks, mperks_offer_ids, wic_eligible, sold_by_weight, alcohol, age_restricted, pickup_eligible, pickup_within_3_hours, home_delivery, marketplace, ships_from_third_party, max_order_quantity, sponsored`;
const LIST = `country, currency, store_requested, store_used, store_matches, total, page, max_page, count, has_more, items [{${ITEM}}], facets [{name, label, values [{label, value, count}]}] (brand, price, promotions, ways to save incl. mPerks and On Sale, EBT-SNAP and WIC, fulfillment, sold by), notes. No sort.`;

const storeIdBase = () => z.union([z.string().regex(/^\d{1,5}$/), z.number().int().positive()]);
const storeIdOptional = () => storeIdBase().optional()
  .describe("A Meijer store number (stores[].store_id of find_meijer_stores), e.g. '295' (Franklin IN). Prices, stock and aisles are that store's. Without it Meijer picks a store by location: store_used names it.");
const storeIdRequired = () => storeIdBase()
  .describe("A Meijer store number (stores[].store_id of find_meijer_stores), e.g. '295' (Franklin IN).");
const meijerId = () => z.union([z.string().regex(/^\d{1,14}$/), z.number().int().positive()]).optional()
  .describe("A Meijer item id (items[].meijer_id: the UPC without its check digit, leading zeros dropped), e.g. '4125010200'. Send meijer_id or upc.");
const upc = () => z.union([z.string().regex(/^(\d{12}|\d{13})$/), z.number().int().positive()]).optional()
  .describe("A 12-digit UPC-A or 13-digit EAN as printed under the barcode, e.g. '041250102007', instead of meijer_id.");

export function registerMeijerTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/meijer/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_meijer",
    `Search ${SITE} by keywords or a Meijer item id, priced at the store you choose, with Meijer's filter counts and department counts. ${STORE} Returns query, ${LIST} departments [{group_id, name, count}]. Page 1 lists 52 items, page 2 the next 48 (page 2 is slower; max_page 2). ${BILL} ${SLOW}`,
    {
      query: z.string().min(1).max(200).describe("Keywords or a Meijer item id, e.g. 'large eggs'."),
      store_id: storeIdOptional(),
      page: z.number().int().min(1).max(2).optional().describe("Page 1 (52 items, default) or 2 (the next 48; slower)."),
    },
    post("search"),
  );

  server.tool(
    "get_meijer_product",
    `One item of ${SITE} by Meijer id or UPC / EAN (converted; both are returned), priced at the store you choose, with its stock and aisle at that store. ${STORE} Returns country, currency, store_requested, store_used, store_matches, meijer_id, upc, ean13, product_id, name, brand, short_description, url, image, images, ${PRICE}, priced, price_displayed, stock_status, aisle (the item's main shelf location at the store), aisle_locations, promotions, mperks, snap_eligible, wic_eligible, sold_by_weight, unit_of_measure_quantity, alcohol, age_restricted, choking_hazard, pickup_eligible, pickup_within_3_hours, home_delivery, ships_from_third_party, marketplace_offers, max_order_quantity, ingredients, nutrition (null: not on the page), allergens (null: not on the page), breadcrumbs [{group_id, name}], variations [{name, options [{name, meijer_id, selected, disabled, image, price_per_sold_by_unit, regular_price_per_sold_by_unit, stock_status}]}] (each size or kind with its own price at the store), notes. An unknown item or store number is a charged 404. ${BILL}`,
    {
      meijer_id: meijerId(),
      upc: upc(),
      store_id: storeIdOptional(),
    },
    post("product"),
  );

  server.tool(
    "get_meijer_category",
    `One department of ${SITE} by path, priced at the store you choose. ${STORE} Returns category, group {group_id, name, count}, ${LIST} subcategories [{group_id, name, count, path}], subcategory_links [{name, path}] (send a path as category). The first 52 items of the department (total counts them all; narrow with a subcategory path). An unknown department is a charged 404. ${BILL} ${SLOW}`,
    {
      category: z.string().min(1).max(300)
        .describe("A department path as Meijer writes it (categories[].path of get_meijer_categories), e.g. 'fresh/produce/fruit' or 'grocery/pantry', or a meijer.com department link."),
      store_id: storeIdOptional(),
    },
    post("category"),
  );

  server.tool(
    "get_meijer_categories",
    `The departments and collections of ${SITE} as the site navigation lists them: country, category, count, categories [{name, type (department, collection), path (the input of get_meijer_category, or of collection in get_meijer_deals), group_id, collection_id, parent, url}], notes. With category (a department path): that department's subcategories [{group_id, name, count, path}] and subcategory_links [{name, path}]. An unknown department is a charged 404. ${BILL}`,
    {
      category: z.string().min(1).max(300).optional()
        .describe("A department path, e.g. 'grocery/pantry': its subcategories. Leave out for Meijer's departments and collections."),
    },
    post("categories"),
  );

  server.tool(
    "get_meijer_deals",
    `One deals collection of ${SITE} (default grocery/grocery-sale, the grocery sale; get_meijer_categories lists the collections), priced at the store you choose. Meijer has no clearance collection: clearance shows per item as clearance_price. ${STORE} Returns collection, collection_name, collection_id, ${LIST} departments [{group_id, name, count}]. The first 52 items of the collection (total counts them all). An unknown collection is a charged 404. ${BILL} ${SLOW}`,
    {
      collection: z.string().min(1).max(300).optional()
        .describe("A collection path as Meijer writes it, e.g. 'grocery/grocery-sale' (default) or 'black-friday', or a meijer.com collection link."),
      store_id: storeIdOptional(),
    },
    post("deals"),
  );

  server.tool(
    "find_meijer_stores",
    `The stores of ${SITE} within 50 miles of a US ZIP code (up to 50), in the store finder's order: country, zip, radius_miles, count, stores [{position, store_id (the input of store_id everywhere), name, address {street, city, state, zip}, latitude, longitude, time_zone, store_type, format, pickup, delivery, url}], notes. Meijer Express gas stations are not listed. A ZIP with no store within 50 miles is a charged 404. ${BILL}`,
    {
      zip: z.union([z.string().min(5).max(10), z.number().int().positive()]).describe("A US ZIP code, e.g. '47274'."),
    },
    post("stores"),
  );

  server.tool(
    "get_meijer_store",
    `One store of ${SITE} by store number: country, store_id, name, store_type, address, phone, latitude, longitude, features, hours {store, pharmacy, delivery, pickup, deli, bakery, gas_station: {title, phone, hours [{days, hours}], amenities}} as the store's page shows them, other_sections, services, nearby_stores, url, notes. Store pages show no fuel prices. An unknown store number is a charged 404. ${BILL}`,
    {
      store_id: storeIdRequired(),
    },
    post("store"),
  );

  server.tool(
    "get_meijer_weekly_ad",
    `The current weekly ad of one store of ${SITE}, as its page shows it: country, store_requested, store_used, store_matches, region (the regional edition the store belongs to, e.g. GRR, CIN), flyer_url, ad {ad_id, name, valid_from, valid_to, available_from, available_to, page_count}, ads [{ad_id, name, valid_from, valid_to, image}] (every ad running, weekly and seasonal), page_count, block_count, pages [{page, image, starts, ends, blocks [{id, item, label, price_text, multi_buy, has_coupons}]}], notes. price_text is the one price a block's label carries, kept as written (2/$6, $3.99); null when the label has no single price (discounts, BOGO, mPerks, ranges). multi_buy {quantity, total} is filled for an N/$X price. ${BILL}`,
    {
      store_id: storeIdRequired(),
    },
    post("weekly-ad"),
  );

  server.tool(
    "get_meijer_coupons",
    `The mPerks coupons of one store of ${SITE}, as the coupons page lists them to a visitor without an account (listed, never clipped). Default: the first 48 with the total and each department's count; full_list true: every coupon of the store (slower, up to about 2 minutes). Returns country, store_requested, store_used, store_matches, full_list, department, total, count, coupons [{position, offer_id, title, description, discount, discount_type (amount, percent), minimum_quantity, starts, ends, manufacturer_coupon, label, departments [{department_id, name, subcategory}], image, terms, new_this_week, expiring_soon, clippable}], departments [{department_id, name, count, special, subcategories [{subcategory_id, name, count}]}], notes. ${BILL} ${SLOW}`,
    {
      store_id: storeIdRequired(),
      department: z.string().min(1).max(80).optional()
        .describe("Only coupons in this department: departments[].department_id or a department or subcategory name, e.g. 'Baby'."),
      full_list: z.boolean().optional()
        .describe("true: every coupon of the store (slower, up to about 2 minutes). Default false: the first 48 with the total and department counts."),
    },
    post("coupons"),
  );

  server.tool(
    "get_meijer_reviews",
    `The first page of written reviews of one item of ${SITE} as its product page shows it, with the rating summary: country, meijer_id, upc, ean13, url, name, rating {average, ratings_count (every rating), review_count (written reviews), distribution, recommended {yes, no}}, questions {questions, answers}, total, page_size, offset, page, reviews [{position, review_id, rating, rating_range, title, text, submitted_at, recommended, helpful_yes, helpful_no, badges, syndicated, photos, store_responses [{department, date, response}]}], notes. First page only (8). Reviewer nicknames, locations and ids are not returned. An unknown item is a charged 404. ${BILL} ${SLOW}`,
    {
      meijer_id: meijerId(),
      upc: upc(),
    },
    post("reviews"),
  );
}
