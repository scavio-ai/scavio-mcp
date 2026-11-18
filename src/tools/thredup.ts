import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/thredup.ts. thredUP has one US store
// (thredup.com, English, USD; it ships to the US and Canada), so there is no
// country input. Cross-field rules the backend enforces and zod here does not:
// product and similar take exactly one of item_number or url; sold needs brand
// or category and takes no query; deals new_arrivals / price_drops take no
// sort and under_10 takes no price range; brands takes query or letter, not
// both, and page / limit only with one of them. No zod `.default()`: the MCP
// SDK would post a defaulted field on every call.

const DEPARTMENTS = ["women", "girls", "boys", "handbags", "shoes", "designer", "plus", "juniors", "maternity", "accessories"] as const;
const ASSORTMENTS = ["women", "girls", "boys"] as const;
const CONDITIONS = ["new_with_tags", "excellent", "very_good", "good", "flawed"] as const;
const SELLER_TYPES = ["thredup", "direct_listing", "dropship"] as const;
const SORTS = ["default", "recommended", "relevance", "newest", "price_high", "price_low", "price_drop"] as const;
const COLLECTIONS = ["clearance", "under_10", "new_arrivals", "price_drops"] as const;
const COLORS = ["black", "grey", "white", "ivory", "tan", "brown", "purple", "blue", "teal", "green", "red", "pink", "orange", "yellow"] as const;
const MATERIALS = [
  "natural", "cashmere", "cotton", "linen", "silk", "wool", "leather", "suede", "blend", "cashmere blend", "cotton blend",
  "linen blend", "silk blend", "wool blend", "synthetic", "acrylic", "faux fur", "nylon", "polyester", "rayon", "spandex", "vegan leather",
] as const;
const PATTERNS = [
  "animal print", "argyle", "camo", "checkered-gingham", "chevron-herringbone", "color block", "floral", "graphic", "hearts",
  "houndstooth", "metallic", "paisley", "plaid", "polka dots", "print", "solid", "stars", "stripes", "tie-dye", "tropical", "tweed",
] as const;

const STORE = "thredUP's US store (thredup.com, USD; it ships to the US and Canada; no country input)";
const CREDITS = "Costs 1 credit. Failed upstream calls are not charged; a not-found is charged.";
const RETAIL =
  "estimated_retail is the estimated original retail price (thredUP's estimate; on Direct Listing items the seller enters it); percent_off is round((1 - price / estimated_retail) * 100), computed from the price and the estimated retail, null when there is no estimated retail or it is not above the price.";
const SELLER_TEXT =
  "seller_type: thredup (items thredUP prices and ships), direct_listing (Direct Listings: private sellers list and ship) or dropship (partner listings shipped by a retail partner).";
const ITEM =
  "item_number, url, title, brand, category, category_tags, department, size, condition (new_with_tags, excellent, very_good, good, flawed), price, currency, estimated_retail, percent_off, promo {percent, price, code} (a promotion code thredUP offers on the item; price stays the list price), clearance, final_sale, new_with_tags, seller_type, status (available, reserved, sold), colors, materials, picture_url, picture_count, favorite_count";
const LIST_OUT = `sort (the order applied), filters, page, page_size (119), total (thredUP's approximate count; it caps at 10,000: total_capped true means 10,000+), total_capped, has_more, count, currency, items (${ITEM})`;
const PAGES =
  "119 items per page, pages 1 to 21 (about 2,500 items per query and filter combination: narrow with filters or split by price_min / price_max to reach more; a later page answers 400 before anything is charged).";
const SORT_TEXT =
  "Sorts: default (the page's own order: relevance for a search, recommended for a list, recently discounted for sold; the answer's sort says which), recommended, relevance, newest, price_high, price_low, price_drop (recently discounted).";
const NOT_AVAILABLE =
  "Not available: product reviews (thredUP shows none), seller shops, sold dates, men's clothing (thredUP has no men's department), price history.";

const department = z.enum(DEPARTMENTS).optional()
  .describe(`Department (default women): ${DEPARTMENTS.join(", ")}. thredUP has no men's department.`);
const strList = (values: readonly string[], description: string, max = 5) =>
  z.union([z.string().min(1).max(200), z.array(z.string().min(1).max(40)).min(1).max(max)]).optional()
    .describe(`${description} Values: ${values.join(", ")}.`);
const brand = z.string().min(1).max(80).optional()
  .describe("Brand as thredUP writes it (items[].brand, get_thredup_brands brands[].brand, get_thredup_suggestions), e.g. 'Patagonia'. \"<Brand> - all brands\" covers a brand's sub-lines.");
const category = z.string().min(1).max(40).optional()
  .describe("Category tag from get_thredup_categories (categories[].category), e.g. dresses, jeans, outerwear, one-pieces.");

const filters = {
  department,
  category,
  size: z.union([
    z.number().int().positive(),
    z.string().min(1).max(120),
    z.array(z.union([z.number().int().positive(), z.string().min(1).max(12)])).min(1).max(10),
  ]).optional().describe("Sizing ids from get_thredup_categories (sizes[].size, e.g. 20778 = women's Small tops), up to 10. Ids, not labels."),
  condition: strList(CONDITIONS, "Conditions, up to 5 (flawed = thredUP's Flawed Gems)."),
  color: strList(COLORS, "Colours, up to 5."),
  material: strList(MATERIALS, "Material groups, up to 5."),
  pattern: z.enum(PATTERNS).optional().describe("One pattern."),
  price_min: z.number().min(0).max(100_000).optional()
    .describe("Lowest price, whole USD. Approximate: thredUP matches the price filter on an item's base price, so an item can show slightly outside the range."),
  price_max: z.number().min(0).max(100_000).optional().describe("Highest price, whole USD (approximate, see price_min)."),
  clearance: z.boolean().optional().describe("Only clearance items."),
  seller_type: strList(SELLER_TYPES, "Who sells (default all three).", 3),
  sort: z.enum(SORTS).optional().describe(SORT_TEXT),
  page: z.number().int().min(1).max(21).optional().describe("Page, 1 to 21, 119 items each."),
};
const { sort: _sort, ...dealFilters } = filters;

const itemNumber = z.union([z.number().int().positive(), z.string().regex(/^\d{1,12}$/)]).optional()
  .describe("thredUP item number (items[].item_number; the number at the end of a thredup.com/product/... link), e.g. 241601590.");
const itemUrl = z.string().min(20).max(400).optional()
  .describe("A thredup.com item link (https://www.thredup.com/product/<slug>/<item number>).");
const assortment = z.enum(ASSORTMENTS).optional().describe("women (default), girls or boys.");

export function registerThredupTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/thredup/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_thredup",
    `Search ${STORE}: query, ${LIST_OUT}. Free text is matched loosely (semantic: it matches the look, so 'lululemon' also returns similar brands); for one brand use the brand filter. Filters: brand, department (default women), category, size (sizing ids), condition, color, material, pattern, price_min / price_max (approximate), clearance, seller_type. ${SORT_TEXT} ${PAGES} ${RETAIL} ${SELLER_TEXT} ${NOT_AVAILABLE} ${CREDITS}`,
    {
      query: z.string().min(1).max(200).describe("Search text, e.g. 'denim jacket'. Semantic: use brand for one brand."),
      brand,
      ...filters,
    },
    post("search"),
  );

  server.tool(
    "get_thredup_sold",
    `Sold thredUP listings by filters only: brand and / or category required, no keyword (thredUP answers no sold items for free text). status (sold), ${LIST_OUT}; every item status sold, price is the price the item last listed at. thredUP shows no sold date. Filters: brand, department (default women), category, size, condition, color, material, pattern, price_min / price_max, clearance, seller_type. ${SORT_TEXT} ${PAGES} ${RETAIL} ${CREDITS}`,
    { brand, ...filters },
    post("sold"),
  );

  server.tool(
    "get_thredup_product",
    `One thredUP item in full by item_number or link: ${ITEM}, plus description (the seller's text on Direct Listings), brand_id, departments, sale, condition_notes (the flaws thredUP noted), condition_detail, size_detail {chart, scale, value}, sizing_id, measurements, characteristics {fit, pattern, material, sleeve_length, neckline, features, stretch, care, inseam_in, rise_in, length_in, chest_in, waist_in}, style_tags, pictures, authentication, certified_authenticity (partner listings), direct_listing {shipping_cost, shipping_covered, buyer_protection_price, on_vacation} (Direct Listings only), similar_brands. Sold items still answer (status sold, the price they last listed at). ${RETAIL} ${SELLER_TEXT} No seller or consignor names or ids are returned. ${CREDITS}`,
    { item_number: itemNumber, url: itemUrl },
    post("product"),
  );

  server.tool(
    "get_thredup_category",
    `One department's category on ${STORE}: department and category (a tag from get_thredup_categories) required. department, category, ${LIST_OUT}. Filters: brand, size, condition, color, material, pattern, price_min / price_max, clearance, seller_type. ${SORT_TEXT} ${PAGES} ${RETAIL} ${CREDITS}`,
    {
      ...filters,
      department: z.enum(DEPARTMENTS).describe(`Department: ${DEPARTMENTS.join(", ")}. thredUP has no men's department.`),
      category: z.string().min(1).max(40).describe("Category tag from get_thredup_categories (categories[].category), e.g. dresses."),
      brand,
    },
    post("category"),
  );

  server.tool(
    "get_thredup_brand",
    `One brand's items on ${STORE} in a department (default women): brand, department, ${LIST_OUT}. An unknown brand answers 0 items. Filters: department, category, size, condition, color, material, pattern, price_min / price_max, clearance, seller_type. ${SORT_TEXT} ${PAGES} ${RETAIL} ${CREDITS}`,
    {
      ...filters,
      brand: z.string().min(1).max(80).describe("Brand as thredUP writes it (get_thredup_brands brands[].brand, items[].brand), e.g. 'Madewell'."),
    },
    post("brand"),
  );

  server.tool(
    "get_thredup_deals",
    `thredUP's deal collections on ${STORE}: clearance, under_10 (Under $10, matched on the base price, so some items show slightly above $10), new_arrivals (newest first) and price_drops (recently discounted first), in a department (default women) with the usual filters. collection, department, ${LIST_OUT}. sort only for clearance and under_10; under_10 takes no price_min / price_max. ${PAGES} ${RETAIL} ${CREDITS}`,
    {
      collection: z.enum(COLLECTIONS).describe("clearance, under_10, new_arrivals or price_drops."),
      brand,
      ...dealFilters,
      sort: z.enum(SORTS).optional().describe(`Only for clearance and under_10 (new_arrivals and price_drops are sorts themselves). ${SORT_TEXT}`),
    },
    post("deals"),
  );

  server.tool(
    "get_thredup_rescue_boxes",
    `thredUP Rescue boxes (mystery bundles of items): count, available_count, currency, boxes [{id, name, description, available, sizes, picture_url, bundles [{items (e.g. "5 Items"), price, currency, state (listed = on sale now), sizes}]}]. No input. ${CREDITS}`,
    {},
    post("rescue-boxes"),
  );

  server.tool(
    "get_thredup_categories",
    `One thredUP department's categories and filter values (default women), the inputs of the list tools: department, categories [{name, category}], other_departments [{name, department}], sizes [{group, label, long_label, size (the sizing id for the size filter)}], conditions [{label, condition}], colors [{label, color}], materials [{label, material}], patterns [{label, pattern}], price_ranges [{label, price_min, price_max}], category_count, size_count. ${CREDITS}`,
    { department },
    post("categories"),
  );

  server.tool(
    "get_thredup_brands",
    `thredUP's brand directory per department (default women): query (brands matching a term), letter (every brand under one letter A-Z, paged with page and limit) or neither (the letter groups, 50 brands each). brands [{id, name, brand (the brand input of get_thredup_brand, search_thredup and get_thredup_sold)}], total, page, limit, has_more, count; groups [{letter, total, count, brands}] without query or letter. Send query or letter, not both. ${CREDITS}`,
    {
      query: z.string().min(1).max(60).optional().describe("Brands matching a term, e.g. 'coach'."),
      letter: z.string().regex(/^[A-Za-z]$/).optional().describe("Every brand under one letter, A-Z."),
      department,
      page: z.number().int().min(1).max(1000).optional().describe("Page of a letter or query answer."),
      limit: z.number().int().min(1).max(500).optional().describe("Brands per page, 1 to 500 (default 100)."),
    },
    post("brands"),
  );

  server.tool(
    "get_thredup_suggestions",
    `thredUP's search suggestions for a partial query (department women, girls or boys): query, department, count, suggestions [{text, query (the free-text part), department, brand, category, free_text}]. Each suggestion is a ready filter set: pass brand / category / department / query to search_thredup. ${CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'made'."),
      department: assortment,
    },
    post("suggestions"),
  );

  server.tool(
    "get_thredup_trending",
    `Trending searches on thredUP for a department (women, girls or boys): department, count, searches [{text, query, department, brand, category, free_text}]. ${CREDITS}`,
    { department: assortment },
    post("trending"),
  );

  server.tool(
    "get_thredup_similar",
    `Items thredUP shows as similar to one item (by item_number or link; the first 120, no paging): item_number, total, total_capped, page_size, count, currency, items (${ITEM}). An unknown item is a charged 404. ${RETAIL} ${CREDITS}`,
    { item_number: itemNumber, url: itemUrl },
    post("similar"),
  );
}
