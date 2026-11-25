import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/dollartree.ts (www.dollartree.com for country us on every
// tool; Dollar Tree Canada store pages for country ca on get_dollartree_store only). Rules the
// backend enforces and zod here does not: product, store stock and reviews take item_id or url;
// stores needs zip or city; store needs url or slug; deals takes category with type sale or
// clearance only. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_low", "price_high", "newest", "rating"] as const;
const DEAL_TYPES = ["sale", "clearance", "new", "more_choices"] as const;

const NAME = "Dollar Tree (dollartree.com, the US and Canada discount variety store chain)";
const ONE =
  "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Prices are Dollar Tree's online unit prices (USD) from one national online price list (the same at every store and ZIP measured); Dollar Tree notes that prices and availability may vary between stores and online, and in-store shelf prices are not published online. Online orders are by the case: case_price is the price of case_pack units and minimum_quantity the order minimum, as Dollar Tree gives them (null when Dollar Tree gives 0, never computed); stores sell single units.";
const SLOW = "Slow: usually 10-35 s, up to about 2.5 minutes.";
const NOT_AVAILABLE =
  "Not available: search suggestions, the weekly ad, deal validity dates, Quick Order / bulk ordering, gift cards, Canada products and prices (Dollar Tree Canada has no shopping site), price history (poll and store the answers), checkout.";
const ITEM =
  "position, item_id (the input of get_dollartree_product, get_dollartree_store_stock and get_dollartree_reviews), name, brand (as Dollar Tree writes it), url, image, price (unit), list_price, on_sale, unit_price_text, case_price, case_pack, minimum_quantity, split_case {available (minimum_quantity < case_pack, computed by Scavio), multiple}, not_for_individual_sale, rating, review_count, online_availability, in_stock_online, in_store_only, clearance, new, snap_eligible, upcs (as given), categories";
const LIST = `market {country, language, currency, locale}, category, page, page_size, total, total_pages, count, sort, filters_applied [{facet, label, count}], resolved_filters [{facet, requested, id, label, other_spellings}], price_range, items (${ITEM}), facets [{key, name, multi_select, values [{id, label, count}]}] (send id back in filters), notes`;
const STORE_HEAD =
  "store_number, name, location_note, address {line1, line2, city, state, zip, country}, phone, latitude, longitude";
const STORE_TAIL =
  "closed, timezone, hours [{day, open, close, closed}], holiday_hours [{date, open, close, closed}], reopen_date, amenities, accepts_ebt, frozen_foods, more_choices, store_pickup, pickup_and_delivery, payment_options, slug, url";

const usOnly = z.enum(["us"]).optional()
  .describe("us only (default: www.dollartree.com, USD). Dollar Tree Canada has no shopping site: ca is served by get_dollartree_store only.");
const itemId = z.union([z.string().min(3).max(24), z.number().int().positive()])
  .describe("A Dollar Tree item number (items[].item_id, the number at the end of a dollartree.com product link; e.g. \"221159\" or \"FD1402202\"). UPCs are not item numbers.");
const productUrl = z.string().min(10).max(1000).optional()
  .describe("A dollartree.com product link (items[].url) instead of item_id.");
const categoryRef = z.union([z.string().min(1).max(600), z.number().int().positive()]);
const brand = z.string().min(1).max(80).optional()
  .describe("Only this brand, as Dollar Tree writes it (the Brand facet's labels, e.g. Dixie).");
const zip = z.union([z.string().min(5).max(10), z.number().int().positive()]);
const listShape = {
  page: z.number().int().min(1).max(200).optional().describe("Page (1-200)."),
  page_size: z.number().int().min(1).max(250).optional()
    .describe("Items per page (1-250, default 48, the site's own page size)."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price_low, price_high, newest or rating (highest average rating first): Dollar Tree's sort menu."),
  filters: z.array(z.string().min(1).max(12)).min(1).max(10).optional()
    .describe("Up to 10 refinement ids exactly as an earlier answer gives them in facets[].values[].id (price point, rating, material, color, collection, dietary needs, ...); several are combined."),
  price_point: z.union([z.number().positive(), z.string().min(1).max(10)]).optional()
    .describe("Only items at this price point, as Dollar Tree's Price facet lists them (e.g. 1.25, 1.50, 5.00)."),
  rating: z.number().int().min(1).max(5).optional().describe("Only items rated this many stars and up (1-5)."),
  in_store_only: z.boolean().optional().describe("Only items Dollar Tree sells in stores only (not shipped)."),
  min_price: z.number().min(0).optional().describe("Lowest unit price (USD)."),
  max_price: z.number().min(0).optional().describe("Highest unit price (USD)."),
};

export function registerDollarTreeTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/dollartree/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_dollartree",
    `Search ${NAME} United States by keywords or a Dollar Tree item number (an item number answers with that item), sorted (relevance, price low or high, newest, rating), filtered (category, brand, price point, rating, in-store only, price range, any facet value) and paged (48 a page by default, up to 250). ${PRICES} Returns query, corrected_query, ${LIST}. Dollar Tree's search does not match UPCs: look items up by item number. ${NOT_AVAILABLE} ${ONE}`,
    {
      q: z.string().min(1).max(200)
        .describe("Keywords (paper plates, christmas ornaments) or a Dollar Tree item number. UPCs are not matched."),
      category: categoryRef.optional()
        .describe("Only items in this category: categories[].dimension_id or a Category facet value id (e.g. \"4070223595\")."),
      brand,
      ...listShape,
      country: usOnly,
    },
    post("search"),
  );

  server.tool(
    "get_dollartree_product",
    `One ${NAME} item in full by item number or link: market, requested_item_id, item_id, name, brand, banner_code (Dollar Tree's banner code as given: DT or FD, not a store-brand flag), url, image, images, description, long_description, price, list_price, sale_price, on_sale, unit_price_text, case_price, case_pack, minimum_quantity, split_case {available (minimum_quantity < case_pack, computed by Scavio), multiple}, split_case_fee (Dollar Tree's field as given; it does not publish what it means or its unit, so it is not a fee), not_for_individual_sale, varying_case_packs, assortment, assortment_details, upcs, rating, review_count, in_store_only, store_pickup_eligible, shippable, online_only, delivery_options (as given), order_limit, clearance, new, deals, snap_eligible, gift_card, available_since, online_stock {status, in_stock, units, orderable_units} (Dollar Tree's online inventory; get_dollartree_store_stock gives a store's units), specifications [{name, value}] (dimensions, weight, count, flavor, allergens, ...), categories [{id, name, dimension_id, url}], child_skus [{sku_id, color, size, list_price, sale_price, sale_starts, sale_ends, active}], currency, notes. ${PRICES} Item 221159 (9-in. White Paper Plates, 40-ct. Packs) was $1.50 a unit, case_pack 30, case_price $45.00, minimum_quantity 5, split_case {available true, multiple 5}, split_case_fee 0, banner_code DT. An unknown item is a charged 404. ${ONE}`,
    {
      item_id: itemId.optional(),
      url: productUrl,
      country: usOnly,
    },
    post("product"),
  );

  server.tool(
    "get_dollartree_category",
    `One ${NAME} category listing by dimension_id or dollartree.com category link (United States), sorted, filtered and paged like search_dollartree. ${PRICES} Returns category_id, query, ${LIST}. An unknown category is a charged 404. ${ONE}`,
    {
      category: categoryRef
        .describe("A Dollar Tree category: categories[].dimension_id of get_dollartree_categories (e.g. \"3804024826\", Christmas Decor) or a dollartree.com category link."),
      q: z.string().min(1).max(200).optional().describe("Keywords inside the category."),
      brand,
      ...listShape,
      country: usOnly,
    },
    post("category"),
  );

  server.tool(
    "get_dollartree_categories",
    `${NAME}'s category tree (United States): market, category, parents, count, total_categories, categories [{id, name, dimension_id, url, route, children [...]}], notes. Without category: the departments with every sub-category; with category: that category's sub-categories. dimension_id is the input of get_dollartree_category. An unknown category is a charged 404. ${ONE}`,
    {
      category: categoryRef.optional()
        .describe("One category (dimension_id, id or dollartree.com category link, e.g. \"2264625405\" Holidays): its sub-categories. Without it: the departments with every sub-category."),
      country: usOnly,
    },
    post("categories"),
  );

  server.tool(
    "get_dollartree_brand",
    `One brand's ${NAME} items (United States), sorted, filtered and paged like search_dollartree: brand (as Dollar Tree writes it), brand_id, other_spellings [{id, label, count}] (the same brand under other spellings: send an id in filters), ${LIST}. ${PRICES} A brand Dollar Tree does not list is a charged 404. ${ONE}`,
    {
      brand: z.string().min(1).max(80)
        .describe("A brand as Dollar Tree writes it (search's Brand facet labels, e.g. Dixie). Matched case-insensitively."),
      category: categoryRef.optional()
        .describe("Only this brand's items in this category (categories[].dimension_id)."),
      ...listShape,
      country: usOnly,
    },
    post("brand"),
  );

  server.tool(
    "get_dollartree_deals",
    `${NAME}'s sale (default), clearance, New Arrivals or MORE CHOICES items (United States; More Choices is Dollar Tree's multi-price assortment), sorted, filtered and paged like search_dollartree: type, query, ${LIST}. ${PRICES} Dollar Tree publishes no validity dates and no weekly ad. ${ONE}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("sale (default), clearance, new (New Arrivals, newest first by default) or more_choices (MORE CHOICES, Dollar Tree's multi-price department)."),
      q: z.string().min(1).max(200).optional().describe("Keywords inside the deal listing."),
      category: categoryRef.optional()
        .describe("With type sale or clearance only: only this category (categories[].dimension_id)."),
      brand,
      ...listShape,
      country: usOnly,
    },
    post("deals"),
  );

  server.tool(
    "get_dollartree_store_stock",
    `Units of one ${NAME} item at a store, as Dollar Tree's product page reports them for the store chosen: market, item_id, item {name, url, price}, store {store_number, units, status (null when Dollar Tree gives none), in_stock, unit_size}, nearby_stores [{store_number, units, status, in_stock}] (up to about 63, none at some rural stores; store numbers only: get_dollartree_stores and get_dollartree_store give their addresses), nearby_in_stock, ship_to_home {available, dc_number, cases (whole cases at that distribution centre), case_size, max_order_units (the most units Dollar Tree lets you order for delivery, the same at every store; not cases x case_size), eta, express_eta, back_order}, ship_to_store {available, dc_number, units, cases, case_size, eta}, split_case_ship_to_home, notes. Stores sell single units (unit_size 1). Item 221159 showed 116 units at store 5126 (New York) and 63 nearby stores, 59 with stock; ship_to_home from dc_number 99006, 2,374 cases of 30, max_order_units 75,570. store (a store number from get_dollartree_stores) is required: a ZIP alone does not pick a store. Price does not change by store. An unknown item or store is a charged 404. ${SLOW} ${ONE}`,
    {
      item_id: itemId.optional(),
      url: productUrl,
      store: z.union([z.string().min(1).max(8), z.number().int().positive()])
        .describe("A Dollar Tree store number (stores[].store_number of get_dollartree_stores, e.g. \"5126\"). Required."),
      zip: zip.optional()
        .describe("Optional: the store's ZIP, sent along with the store as Dollar Tree's own store picker does."),
      state: z.string().min(2).max(2).optional()
        .describe("Optional: the store's two-letter state (e.g. NY), sent along with the store."),
      country: usOnly,
    },
    post("store-stock"),
  );

  server.tool(
    "get_dollartree_stores",
    `The ${NAME} stores near a US ZIP or city, as Dollar Tree's store locator lists them (20 per answer, in its order): market, location, total, count, stores [{position, ${STORE_HEAD}, distance_miles, ${STORE_TAIL}}], notes. Services include EBT, frozen foods and More Choices as Dollar Tree lists them. Send zip or city. ${SLOW} Costs 5 credits (credits_used is what was charged). Failed upstream calls and refused inputs are not charged.`,
    {
      zip: zip.optional().describe("A US ZIP code (e.g. \"60540\"; zip or city is required)."),
      city: z.string().min(4).max(80).optional().describe("A US city and state, e.g. \"Naperville, IL\", instead of zip."),
      country: usOnly,
    },
    post("stores"),
  );

  server.tool(
    "get_dollartree_store",
    `One ${NAME} store page by link or slug (United States; Canada with country ca): market, ${STORE_HEAD}, ${STORE_TAIL}, nearby_stores [{store_number, address, closed, slug, url}], notes. Canada store pages are in English and carry no prices. An unknown store page is a charged 404. ${ONE}`,
    {
      url: z.string().min(10).max(400).optional()
        .describe("A Dollar Tree store page (stores[].url, e.g. https://locations.dollartree.com/ny/new-york/2182-3rd-avenue; Canada: a locations.dollartreecanada.com page with country ca)."),
      slug: z.string().min(5).max(300).optional()
        .describe("Instead of url: the store page slug (stores[].slug, e.g. ny/new-york/2182-3rd-avenue; Canada e.g. on/toronto/2340-eglinton-ave-west)."),
      country: z.enum(["us", "ca"]).optional()
        .describe("us (default: Dollar Tree US store pages) or ca (Dollar Tree Canada store pages, English, no prices)."),
    },
    post("store"),
  );

  server.tool(
    "get_dollartree_reviews",
    `The newest English reviews of one ${NAME} item (up to about 98 per call, newest first): market, item_id, item {name, url}, rating, review_count, rating_breakdown [{stars, count, percent}], recommended_count, not_recommended_count, total, count, sort, reviews [{id, rating, rating_range, title, text, date, recommended, syndicated, syndication_source, badges, secondary_ratings [{name, value, range}], helpful_votes, unhelpful_votes, locale, photos [{url, thumbnail_url}], responses [{text, date, department}]}], notes. Many reviews are syndicated from brand sites (syndicated, syndication_source). No other sort, no star filter, no questions and answers; no reviewer names. An unknown item is a charged 404. ${SLOW} ${ONE}`,
    {
      item_id: itemId.optional(),
      url: productUrl,
      country: usOnly,
    },
    post("reviews"),
  );
}
