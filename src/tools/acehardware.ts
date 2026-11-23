import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/acehardware.ts (acehardware.com, US only, so no tool
// takes country). Cross-field rules the backend enforces and zod here does not: product
// takes product_code or url (not both); store-stock takes store or stores (not both) and
// nearby only with one store; list tools take at most 6 filters in all (brand, offer and
// filters), on_sale is offer sale, and (page - 1) * page_size stays within 10,000;
// brand's query only on the brand index (no brand). No zod `.default()`: the MCP SDK would
// post a defaulted field on every call.

const SORTS = ["relevance", "price_asc", "price_desc", "name_asc", "name_desc", "newest", "oldest"] as const;
const OFFERS = ["sale", "ace_rewards", "buy_and_get", "buy_more_save"] as const;
const PAGE_SIZES = [15, 30, 50, 100, 200] as const;

const NAME = "Ace Hardware (acehardware.com, the US hardware cooperative)";
const CHARGES = "Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const ONE = `Costs 1 credit (occasionally 2; credits_used is what was charged). ${CHARGES}`;
const LISTING_PRICES =
  "Listing prices are the price Ace shows in its listing (price_list per item; CORP is Ace's online price), not a store's price. Ace stores are independently owned and operated and prices differ by store: for one store's price call get_acehardware_product with store.";
const NOT_AVAILABLE =
  "Not available: review or Q&A text (rating and review_count only), search suggestions, store search by ZIP or city (tools take a 5-digit Ace store number, shown in every Ace store page link acehardware.com/store-details/<number>), pickup or delivery dates, price history (poll and store the answers), Ace Rewards member prices, Ace Handyman, rentals, Ace-licensed stores outside the US, checkout.";
const PRICE =
  "price (what Ace charges now: the sale price when on sale), original_price (the list price when on sale), list_price, sale_price, on_sale, discount_percent (computed by Scavio from list_price), msrp (as Ace gives it; it can be below a store's price), currency (USD), price_list (the price list Ace priced it from: CORP is Ace's online price, a store number or a price zone is a store's)";
const ITEM = `position, product_code (the input of get_acehardware_product and get_acehardware_store_stock), name, brand, url, image, ${PRICE}, upc, mfg_part_number, rating, review_count, special_offers (Ace's Special Offers labels: Sale, Ace Rewards, Buy & Get, Buy More & Save), in_store_promo {start, end}, fulfillment {ship_to_home, store_pickup, delivery}, in_stock_online, purchasable, product_type`;
const FACETS = "facets [{name, field, values [{label, count, filter (send it in filters), applied, children}]}]";
const LIST = `title, total, page, page_size, total_pages, count, sort, sort_applied, brand, offer, filters, applied_filters, items (${ITEM}), ${FACETS}, subcategories [{category_id, name, url, product_count}], notes. A department page answers items [] with its subcategories`;

const storeNumber = z.union([z.string().min(1).max(5), z.number().int().positive()])
  .describe("An Ace store number: 5 digits, sent as a string to keep leading zeros (e.g. \"18250\", \"03085\"). It is in every Ace store page link (acehardware.com/store-details/<number>); get_acehardware_store and get_acehardware_stores list more.");
const productCode = z.union([z.string().min(3).max(600), z.number().int().positive()])
  .describe("An Ace item number (items[].product_code, e.g. \"72779\") or an acehardware.com product link.");
const page = z.number().int().min(1).max(200).optional()
  .describe("Page (1-200; the first item of the page stays within 10,000).");
const pageSize = z.number().int().optional()
  .describe(`Products per page: ${PAGE_SIZES.join(", ")} (default 30), as Ace lists them.`);
const sort = z.enum(SORTS).optional()
  .describe("relevance (default, Ace's order), price_asc, price_desc, name_asc, name_desc, newest or oldest: Ace's sort menu.");
const brandFilter = z.string().min(1).max(80).optional()
  .describe("Only this brand (the Brand Name facet's value, e.g. dewalt, black+decker).");
const offer = z.enum(OFFERS).optional()
  .describe("Only products in one of Ace's Special Offers: sale, ace_rewards (Ace Rewards member offers), buy_and_get, buy_more_save.");
const onSale = z.boolean().optional().describe("Only products on sale (same as offer sale).");
const filters = z.array(z.string().min(3).max(220)).max(6).optional()
  .describe('Facet filters: facets[].values[].filter values from an earlier answer (e.g. "tenant~A00317:lithium-ion", "price:[100 TO 250]", "tenant~rating:[4 TO *]"). At most 6 in all with brand and offer.');
const listShape = { page, page_size: pageSize, sort, brand: brandFilter, offer, on_sale: onSale, filters };
const { brand: _brand, ...brandListShape } = listShape;

export function registerAcehardwareTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/acehardware/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_acehardware",
    `Search ${NAME} by keywords, an Ace item number or a UPC, sorted (relevance, price, name, newest), filtered (brand, Special Offers, any facet) and paged (15-200 a page): country, currency, query, redirected_to {type (category or product), url} (Ace sends many searches to a category page, and an item number or UPC to its product), ${LIST}. ${LISTING_PRICES} ${NOT_AVAILABLE} Costs 2 credits (3 when Ace redirects the search to a category and the list options are applied to it). ${CHARGES}`,
    {
      query: z.string().min(1).max(200).describe("Keywords (brass hose nozzle), an Ace item number or a UPC."),
      ...listShape,
    },
    post("search"),
  );

  server.tool(
    "get_acehardware_product",
    `One ${NAME} product in full by item number or link, priced for an Ace store if you send one. Ace stores are independently owned and operated, and the same item can be priced differently at different stores (Ace's terms: pricing varies by location). Returns country, currency, store_requested, priced_for {store_id, price_list} (the store and price list Ace priced the page from, as Ace names them; CORP is Ace's online price), product_code, name, brand, sub_brand, url, ${PRICE}, displayed_price and displayed_was_price (the page's own price pair), promotion_text, special_offers, in_store_promo, upc, mfg_part_number, rating, review_count, short_description, description, features, specifications [{name, value}], whats_included, country_of_origin, product_type, family_code, measurements {height, width, length, weight: {value, unit}}, breadcrumbs [{name, url}], image, images, options [{option, name, product_code, price_delta, required}] (assembly add-ons), fulfillment {ship_to_home, store_pickup, delivery}, in_stock_online, purchasable, notes. When Ace prices the page for another store than the one requested, priced_for says so and notes explains. An unknown product is a charged 404. Costs 2 credits, with or without store. ${CHARGES}`,
    {
      product_code: productCode.optional(),
      url: z.string().min(10).max(600).optional()
        .describe("An acehardware.com product link (items[].url), instead of product_code."),
      store: storeNumber.optional()
        .describe("An Ace store number (5 digits as a string, e.g. \"10665\", \"03085\"): the price as Ace shows it for that store. Without it, priced_for names the price list Ace used (CORP: Ace's online price)."),
    },
    post("product"),
  );

  server.tool(
    "get_acehardware_store_stock",
    `Exact units on hand as ${NAME} reports them, for one product at up to 25 Ace stores, or at one store and the 25 stores Ace lists as nearest to it (nearby): country, product_code, store_requested, nearby, count, in_stock_count, total_units, stores [{store_id, units_in_stock, soft_units, in_stock, location_code (the store's shelf location code), distribution_center {id, units} (the regional distribution centre's stock)}], failed_stores, notes. Ace answers 0 for a store number or product it does not know, exactly as for one out of stock (no not-found). Stock is as Ace reports it, not a promise. Costs 1 credit per 5 stores (1 store 1, 5 stores 1, 25 stores 5; nearby 6). ${CHARGES}`,
    {
      product_code: productCode,
      store: storeNumber.optional().describe("One Ace store number (5 digits as a string, e.g. \"18250\"). Send store or stores."),
      stores: z.array(z.union([z.string().min(1).max(5), z.number().int().positive()])).min(1).max(25).optional()
        .describe("Up to 25 Ace store numbers (instead of store), e.g. [\"18250\", \"17309\"]: 1 credit per 5 stores."),
      nearby: z.boolean().optional()
        .describe("With one store: also the 25 stores Ace lists as nearest to it (6 credits)."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_acehardware_store",
    `One ${NAME} store by store number: country, store_id, name, display_name, url, address {line1, city, state, zip}, phone, latitude, longitude, time_zone, hours [{day, open, close, closed}], services, departments, brands [{name, url}], programs, features {store_pickup, curbside_pickup, delivery, third_party_delivery, assembly, propane, benjamin_moore, ace_rewards}, max_delivery_radius_miles, price_zones, distribution_centers, nearest_stores (the 25 store numbers Ace lists as nearest), same_owner_stores [{store_id, name, address}]. No owner or staff names. An unknown store number is a charged 404. ${ONE}`,
    { store: storeNumber },
    post("store"),
  );

  server.tool(
    "get_acehardware_stores",
    `The ${NAME} stores nearest an Ace store, as Ace lists them (Ace has no public store search by ZIP or city): country, store_id, name, address, latitude, longitude, distribution_centers, details, count, stores [{position, store_id}], and with details: true each store's name, display_name, url, address, phone, latitude, longitude, distance_miles (computed by Scavio), hours, services, features. An unknown store number is a charged 404. Costs 1 credit without details; with details 1 lookup per store (25 stores: 6 credits). ${CHARGES}`,
    {
      store: storeNumber,
      details: z.boolean().optional()
        .describe("Each nearest store's name, address, phone, hours and distance (25 stores: 6 credits)."),
      limit: z.number().int().min(1).max(25).optional()
        .describe("How many of the nearest stores (1-25, default 25)."),
    },
    post("stores"),
  );

  server.tool(
    "get_acehardware_category",
    `One ${NAME} category's products by link, path or id, sorted, filtered and paged: country, category, url, category_id, ${LIST}. A wrong path is a charged 404. ${LISTING_PRICES} ${ONE}`,
    {
      category: z.union([z.string().min(1).max(500), z.number().int().positive()])
        .describe("An Ace category link or path (/departments/..., /c/<id>) or a category id (get_acehardware_categories lists them), e.g. /departments/tools/power-tools/cordless-drills."),
      ...listShape,
    },
    post("category"),
  );

  server.tool(
    "get_acehardware_categories",
    `${NAME}'s departments and their categories (two levels), or one department's: country, root {category_id, name, url}, count, node_count, categories [{category_id, name, url (the input of get_acehardware_category), product_count, children [...]}]. An unknown path is a charged 404. ${ONE}`,
    {
      category: z.union([z.string().min(1).max(500), z.number().int().positive()]).optional()
        .describe("A department or category (link, path or id): its subcategories. Without it: every department."),
    },
    post("categories"),
  );

  server.tool(
    "get_acehardware_brand",
    `One brand's products on ${NAME} by slug or link, sorted, filtered and paged: country, brand_path, url, category_id, ${LIST}. Without brand: Ace's brand index (about 5,700 brands, 500 a page, optionally filtered by query): total_brands, total, page, page_size, total_pages, count, brands [{name, url, category_id, product_count}]. An unknown brand is a charged 404. ${LISTING_PRICES} ${ONE}`,
    {
      brand: z.string().min(1).max(400).optional()
        .describe("A brand slug (weber) or its link (brands[].url, /brands/weber). Without it: Ace's brand index."),
      query: z.string().min(1).max(80).optional()
        .describe("Brand index only: brands whose name contains this text."),
      ...brandListShape,
    },
    post("brand"),
  );

  server.tool(
    "get_acehardware_deals",
    `${NAME}'s sales and specials list, sorted, filtered (offer: sale, ace_rewards, buy_and_get, buy_more_save; brand; any facet) and paged, plus Ace's site-wide promotions: country, url, promotions [{slot (current or next), title, details, code, starts, ends}], ${LIST}. ${LISTING_PRICES} ${ONE}`,
    { ...listShape },
    post("deals"),
  );

  server.tool(
    "get_acehardware_weekly_ad",
    `One ${NAME} store's weekly ad, page by page: country, store_id, title, valid_from, valid_to, ad_group (send it with page for later pages), zone, page, total_pages, count, items [{item_id, heading (e.g. IN-STORE ONLY), title, description, price_text, details, item_numbers (the Ace item numbers the tile names), image}], notes. Prices and details are in the ad's words; some tiles are image-only. An unknown store number is a charged 404. ${ONE}`,
    {
      store: storeNumber,
      page: z.number().int().min(1).max(40).optional()
        .describe("Page of the weekly ad (total_pages says how many)."),
      ad_group: z.string().min(3).max(60).optional()
        .describe("ad_group from an earlier answer (e.g. 261101_WCAS), with page for page 2 and later."),
    },
    post("weekly-ad"),
  );

  server.tool(
    "get_acehardware_paint_colors",
    `${NAME}'s paint colour list (about 5,300 colours: Benjamin Moore, Clark+Kensington, Magnolia Home), filtered by name or code, family, brand or collection and paged: country, palette_date, total_colors, total, page, page_size, total_pages, count, colors [{code, name, brand, hex, rgb {r, g, b}, families, collections, sample_product_code}], families [{name, count}], brands [{name, count}]. ${ONE}`,
    {
      query: z.string().min(1).max(80).optional().describe("Colour name or code contains this text, e.g. pink."),
      family: z.string().min(1).max(40).optional().describe("A colour family (families[].name, e.g. Blue, Gray / Black)."),
      brand: z.string().min(1).max(60).optional()
        .describe("A paint brand (brands[].name: Benjamin Moore, Clark+Kensington, Magnolia Home)."),
      collection: z.string().min(1).max(80).optional().describe("A collection name (colors[].collections)."),
      page: z.number().int().min(1).max(1000).optional().describe("Page (1-1000)."),
      page_size: z.number().int().min(1).max(500).optional().describe("Colours per page (1-500, default 100)."),
    },
    post("paint-colors"),
  );
}
