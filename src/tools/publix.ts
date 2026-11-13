import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/publix.ts (publix.com, US). Cross-field
// rules the backend enforces and zod here does not: category takes
// category_url or category_id; stores takes zip, city + state, or store_id.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "featured", "name_asc", "name_desc", "popularity", "savings_amount", "most_viewed"] as const;
const SECTIONS = ["subs", "all"] as const;

const CHARGE = "Failed upstream calls are not charged (they are retried automatically); a not-found is charged. 1 credit.";
const STORE = "Store-scoped: aisles, promotions and prices are those of the store_id you send (from find_publix_stores), echoed in store (id, name). Prices differ by store.";
const PRICES =
  "Publix shows prices online only for items on sale and for order-ahead (deli and bakery) items, so price is a number only when the site shows one and null otherwise; it is never estimated (no regular shelf prices). price_text is the price as shown ('$5.49/lb', '3 for $10.00'), price_unit lb when per pound, bundle {quantity, price} for multi-buys, starting_price for 'Starts at' items, regular_price the crossed-out price.";
const ITEM =
  "item_code (for get_publix_product), base_product_id, title, brand, size, description, image, url, category_path, aisle (where it sits in that store), on_sale, price, price_unit, bundle, starting_price, regular_price, price_text, regular_price_text, promo (type single, bogo or multi; message, conditions, savings, valid_from, valid_through), has_coupon and is_order_ahead";
const GRID = `items with ${ITEM}. Also total, page, page_size (48), total_pages, count, sort, applied_filters and facets (name, label, values with value, label and count: deals, BOGO, weekly ad, brand, type, diet, nutrition ranges).`;
const DEAL =
  "Each item: id, item_code, base_product_id, title, description, brand, department, categories, savings_text (as shown, e.g. 'Buy 1 Get 1 FREE', '$6.89 lb', '2 for $5.00'), deal_type (bogo, b2g1, multi, price, percent_off or other), price (only when savings_text is a plain price), price_unit, bundle, save_up_to, additional_savings, min_quantity, fine_print, stacked_with_coupon, promotion (Weekly Ad, Extra Savings, a seasonal flyer), valid_from, valid_to and image";

const storeId = () => z.string().regex(/^\d{1,5}$/)
  .describe("A Publix store number: stores[].store_id of find_publix_stores, e.g. '1614' (Miami) or '1825' (Atlanta).");

const gridFields = {
  page: z.number().int().min(1).max(100).optional()
    .describe("Results page, 1-based (48 products per page). A page past the last answers an empty list."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), featured, name_asc, name_desc, popularity, savings_amount (biggest promo savings first) or most_viewed."),
  on_sale: z.boolean().optional()
    .describe("Only items on sale at the store (weekly ad, BOGO, multi-buy or extra savings)."),
  bogo: z.boolean().optional()
    .describe("Only Buy One Get One Free items at the store."),
  brand: z.string().min(1).max(60).optional()
    .describe("Only this brand, as the site lists it (facets: Brand values), e.g. 'Tyson'."),
};

export function registerPublixTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/publix/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_publix",
    `Search Publix products at one store by keyword: sort by name, popularity, savings or views; filter to items on sale, BOGO (Buy One Get One Free) or a brand. Returns query, corrected_query, store and ${GRID} Keywords the site sends to a category answer that category's products; keywords it sends to an order-ahead page set redirected_to (items may be empty). ${STORE} ${PRICES} ${CHARGE}`,
    {
      query: z.string().min(1).max(100)
        .describe("Search keywords, e.g. 'chicken'."),
      store_id: storeId(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_publix_product",
    `One Publix product by item code at one store: the product card (${ITEM}; order-ahead items also short_description, lead_time, serves, calories) and its nutrition facts (labels with serving size, servings per container and every nutrient with amount, unit and percent daily value; a deli sub has one label per component and size; null when Publix has none). ${PRICES} ${STORE} Ingredients, allergens, UPC and reviews are not published by Publix online. An unknown item code is a charged 404. ${CHARGE}`,
    {
      item_code: z.string().regex(/^\d{1,8}$/)
        .describe("A Publix item code (not a UPC): items[].item_code of search_publix, get_publix_category or get_publix_order_ahead, e.g. '90355'."),
      store_id: storeId(),
    },
    post("product"),
  );

  server.tool(
    "get_publix_category",
    `One Publix category's products at one store, by category_url or category_id (send one), with the search sorts and filters: category (id, name, path), store and ${GRID} ${STORE} ${PRICES} ${CHARGE}`,
    {
      category_url: z.string().min(1).max(400).optional()
        .describe("A publix.com category link (/c/<name>/<id>), e.g. 'https://www.publix.com/c/chicken/6772da29-55bf-4051-83d5-104d73ae9a96'."),
      category_id: z.string().length(36).optional()
        .describe("A category id (categories[].id of get_publix_categories), e.g. '6772da29-55bf-4051-83d5-104d73ae9a96'. Alternative to category_url."),
      store_id: storeId(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_publix_categories",
    `The Publix product category tree: departments (Bakery, Dairy, Meat, Produce ...) with their categories and sub-categories, each with id (for get_publix_category), name, url, parent_id, level and children; plus count. parent_id returns one department's or category's subtree. store_id is optional. ${CHARGE}`,
    {
      store_id: storeId().optional(),
      parent_id: z.string().length(36).optional()
        .describe("Return only this department's or category's subtree (categories[].id)."),
    },
    post("categories"),
  );

  server.tool(
    "get_publix_weekly_ad",
    `The store's current Publix weekly ad (English), about 700 items: BOGO deals (about 230 a week), sale prices, multi-buys and percent-off deals, with ad (start_date, end_date), total, count, applied_filters and departments. Weekly ads start on different days by state (Thursday to Wednesday in Florida, Wednesday to Tuesday in Georgia and North Carolina; weekly_ad_break_day of find_publix_stores gives each store's start day), and prices of some items (beer, wine) differ by store. ${DEAL}. Filter by department, BOGO only or a text query. ${CHARGE}`,
    {
      store_id: storeId(),
      department: z.string().min(1).max(60).optional()
        .describe("Only items of this department (departments of the answer, e.g. 'Meat', 'Produce', 'Deli', 'Wine')."),
      bogo_only: z.boolean().optional()
        .describe("Only Buy 1 Get 1 Free and Buy 2 Get 1 Free items."),
      query: z.string().min(1).max(100).optional()
        .describe("Only items whose title, description or brand contains this text."),
    },
    post("weekly-ad"),
  );

  server.tool(
    "get_publix_extra_savings",
    `The store's Publix Extra Savings (temporary price reductions), several hundred items: id, base_product_id, title, size, brand, categories, savings_text (the amount saved as shown), savings, additional_savings, final_price (the reduced price, as the site lists it), min_quantity, image and url; plus store, count and period (start_date, end_date of the current Extra Savings period). ${CHARGE}`,
    {
      store_id: storeId(),
    },
    post("extra-savings"),
  );

  server.tool(
    "get_publix_coupons",
    `The store's Publix digital coupons as every visitor sees them (about 100-130): id, title, description, brand, savings_text, value (the dollar amount when the coupon states one), min_quantity, limit_per_transaction, categories, valid_from, valid_to, terms and image; plus store and count. Read-only: coupons are listed, never clipped, and no account is used. ${CHARGE}`,
    {
      store_id: storeId(),
    },
    post("coupons"),
  );

  server.tool(
    "search_publix_savings",
    `Find a keyword across the store's Publix weekly ad, Extra Savings and digital coupons in one call: query, store, count and items, each with saving_type (weekly_ad, extra_savings or coupon) and that feed's fields. ${CHARGE}`,
    {
      query: z.string().min(1).max(100)
        .describe("A keyword to find in the store's weekly ad, Extra Savings and digital coupons, e.g. 'coffee'."),
      store_id: storeId(),
    },
    post("savings-search"),
  );

  server.tool(
    "get_publix_order_ahead",
    `The store's Publix deli and bakery order-ahead (in-store pickup) menu with this store's prices: Pub Subs (section subs, default) or the whole catalog of subs, platters, cakes, wings and meals (section all, about 1,150 items, 60 per page). Each item: ${ITEM}, short_description, lead_time (e.g. 'Ready as soon as 30 minutes'), serves, calories and pay_online. Pub Sub prices differ by store (e.g. $12.09 in Miami, $11.99 in Atlanta). Also section, store, total, page, page_size, total_pages and count. ${CHARGE}`,
    {
      store_id: storeId(),
      section: z.enum(SECTIONS).optional()
        .describe("subs (default: the Pub Sub menu) or all (the whole deli and bakery order-ahead catalog: subs, platters, cakes, meals ...)."),
      page: z.number().int().min(1).max(50).optional()
        .describe("Results page, 1-based (60 items per page)."),
    },
    post("order-ahead"),
  );

  server.tool(
    "find_publix_stores",
    `Find Publix stores near a ZIP code or in a city (city + state), or read one store by store_id. Each store: store_id (for every other Publix tool), name, short_name, type (supermarket, liquor, pharmacy), address (street, city, state, zip), phone, hours for the next 7 days, time_zone, departments, services, pharmacy (phone, hours), liquor_store, latitude, longitude, distance_miles, weekly_ad_break_day (the day the store's weekly ad starts), opening_date, closing_date and image. Publix operates in FL, GA, AL, SC, NC, TN, VA and KY. An unknown store_id is a charged 404. ${CHARGE}`,
    {
      zip: z.string().regex(/^\d{5}$/).optional()
        .describe("A 5-digit US ZIP code: the stores nearest to it, e.g. '33101'."),
      city: z.string().min(1).max(60).optional()
        .describe("A city name, with state, e.g. 'Nashville'."),
      state: z.string().regex(/^[A-Za-z]{2}$/).optional()
        .describe("A 2-letter state code, with city, e.g. 'TN'."),
      store_id: storeId().optional(),
      limit: z.number().int().min(1).max(30).optional()
        .describe("Stores to return, up to 30 (default 10)."),
      radius_miles: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles (default 50)."),
    },
    post("stores"),
  );

  server.tool(
    "get_publix_suggestions",
    `The suggestions the Publix search box shows for what a user typed: up to 10 popular searches (suggestions: text, type) and, with store_id, up to 4 products (item_code, base_product_id, title, description, saving_text, image, url); plus query, store_id and count. ${CHARGE}`,
    {
      query: z.string().min(1).max(100)
        .describe("What the user has typed so far, e.g. 'chick'."),
      store_id: storeId().optional(),
    },
    post("suggestions"),
  );
}
