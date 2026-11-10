import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/saks.ts (saksfifthavenue.com, US only, USD).
// Cross-field rules the backend enforces and zod here does not: product takes
// product_id or url; category takes path or url; brand takes brand or url;
// stores and store availability take one location (zip, or lat + lng). No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["featured", "best_sellers", "newest", "price_high_to_low", "price_low_to_high", "sale_first", "brand_az"] as const;
const DEAL_TYPES = ["sale", "womens_sale", "mens_sale", "womens_new_arrivals", "mens_new_arrivals"] as const;

const ITEM_FIELDS = "id (variant_id too when the tile shows one variant), title, brand, URL, image, price (price_max when the item sells at a range), regular price, sale price, percent off, on-sale flag, review count, badge (Best Seller, Exclusive, Runway Look...), is_final_sale and is_clearance (null when the tile leaves them blank; get_saks_product is authoritative), returnable, limited_inventory, promotions, product_type and colors";
const GRID_SHORT = "24 grid positions per page with the same item fields, facets, totals and start / next_start paging as search_saks";
const GRID = `24 grid positions per page, each item with ${ITEM_FIELDS}. Also returns total, page, total_pages, start and next_start (pass next_start as start for the next page: an editorial tile can take a grid position, so a page may carry 22-23 items), the sort applied, the facets (id, label and values with counts; any value works in filters), price_ranges and applied_filters. Review count only on the grid: review text is not available. Prices in USD`;

const numericId = () => z.union([z.number().int().positive(), z.string().regex(/^\d{6,14}$/)]);
const textOrList = (description: string) =>
  z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).max(20)]).optional().describe(description);
const brandFilter = () =>
  textOrList("Only these designers, spelled as the brand facet lists them, e.g. \"Prada\" or [\"Prada\", \"ALICE + OLIVIA\"]. A list matches any of them.");

const gridFields = {
  page: z.number().int().min(1).max(500).optional()
    .describe("Results page, 1-based (24 grid positions per page). Defaults to 1."),
  start: z.number().int().min(0).max(12000).optional()
    .describe("Item offset, instead of page: pass a previous response's next_start to walk every item without gaps."),
  sort: z.enum(SORTS).optional()
    .describe("featured (default, the site's own order), best_sellers, newest, price_high_to_low, price_low_to_high, sale_first or brand_az."),
  color: textOrList("Only these colors, as the colorRefinement facet lists them (Black, Blue, Red...). A list matches any of them."),
  size: textOrList("Only these sizes, spelled as the sizeRefinement facet LABEL lists them (\"Medium\", \"X-Small, 0\"; \"M\" matches nothing). A list matches any of them."),
  min_price: z.number().min(0).optional()
    .describe("Minimum price in USD. Any bound works, not only the site's price buckets."),
  max_price: z.number().min(0).optional()
    .describe("Maximum price in USD."),
  on_sale: z.boolean().optional()
    .describe("Only items on sale."),
  new_arrivals: z.boolean().optional()
    .describe("Only new arrivals."),
  filters: z.record(z.string(), z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).max(20)])).optional()
    .describe("Any other facet from a previous response's facets: its id to one value or a list, e.g. {\"refGender\": \"Women's\", \"refMaterial\": \"Cashmere\"}."),
};

const locationFields = {
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
    .describe("US ZIP code to search around, e.g. '10022'."),
  lat: z.number().min(-90).max(90).optional()
    .describe("Latitude (with lng), instead of zip."),
  lng: z.number().min(-180).max(180).optional()
    .describe("Longitude (with lat)."),
  radius: z.union([z.literal(15), z.literal(30), z.literal(50), z.literal(100), z.literal(300)]).optional()
    .describe("Search radius in miles: 15, 30, 50, 100 or 300. Defaults to 50."),
};

export function registerSaksTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/saks/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_saks",
    `Search saksfifthavenue.com (US) by keyword, filtered by designer, color, size (the facet label, e.g. Medium), any price range, on sale, new arrivals and any other facet, sorted by featured (default), best sellers, newest, price, sale first or designer A-Z. ${GRID}. A keyword the site sends to a designer or category page is answered from that page, named in redirected_to. Use an item's id with get_saks_product. 2 credits.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'coat'."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_saks_product",
    `One saksfifthavenue.com product by id or URL: title, brand, type (master or variant), UPC (for a variant), price, price_max, regular and sale price, percent off, on-sale flag, is_new / is_sale / is_clearance / is_final_sale, badge, returnable, promotions, description, style code, images, colors and sizes (each with availability IN_STOCK / NOT_AVAILABLE, selectable and waitlist), every SKU in variants[] with its online warehouse unit count, in-stock and available counts, availability (units available to sell, message such as Limited Inventory, in_stock_date), available_in_store, marketplace, drop_ship, preorder, merchandising attributes (category, gender, material, length...), the average star rating and review_count. Review text is not available. Add color + size (or pass a variant sku) to resolve one variant: its sku is id, with its UPC and stock. A variants[].sku is what get_saks_store_availability takes. An unknown id is a 404. 2 credits.`,
    {
      product_id: numericId().optional()
        .describe("Saks product id: a search result's id (the number at the end of a product URL), or a variant sku, e.g. '0400019127312'."),
      url: z.string().min(1).max(600).optional()
        .describe("A saksfifthavenue.com product URL (its trailing id is used; a color / size it selects is kept). Alternative to product_id."),
      color: z.string().min(1).max(100).optional()
        .describe("Pick one color (a colors[].value), e.g. 'BLUE OPAL'."),
      size: z.string().min(1).max(100).optional()
        .describe("Pick one size (a sizes[].value). With color, the answer is that variant."),
    },
    post("product"),
  );

  server.tool(
    "get_saks_category",
    `Browse one Saks category by its /c/ path or URL (women's dresses, men's sweaters, beauty...), with the same filters and sorts as search_saks. ${GRID_SHORT}. Also returns the category's name, path, URL and breadcrumbs. An unknown path is a 404. 2 credits.`,
    {
      path: z.string().min(1).max(300).optional()
        .describe("A Saks category path (/c/...): from a category URL, a get_saks_suggestions categories[].path or a breadcrumb, e.g. '/c/women-s-apparel/dresses'."),
      url: z.string().min(1).max(600).optional()
        .describe("A saksfifthavenue.com category URL. Filters, sort and page already in the URL are kept."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_saks_brand",
    `Browse one designer's Saks page by slug (from get_saks_designers) or URL, with the same filters and sorts as search_saks (except brand). ${GRID_SHORT}. Also returns the brand's name, slug and URL. An unknown slug is a 404. 2 credits.`,
    {
      brand: z.string().min(1).max(120).optional()
        .describe("A designer slug from get_saks_designers, e.g. 'gucci', 'chloé', 'alice-olivia'. A plain name is slugified."),
      url: z.string().min(1).max(600).optional()
        .describe("A saksfifthavenue.com /brand/ URL. Filters, sort and page already in the URL are kept."),
      ...gridFields,
    },
    post("brand"),
  );

  server.tool(
    "get_saks_deals",
    `Saks sale and new-arrival listings: all Sale (default), Women's Clothing Sale, Men's Sale, Women's New Arrivals or Men's New Arrivals, with the same filters and sorts as search_saks. ${GRID_SHORT}. Saks has no clearance or final-sale listing (items carry is_clearance / is_final_sale flags). 2 credits.`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("sale (all sale, default), womens_sale (women's clothing), mens_sale, womens_new_arrivals or mens_new_arrivals."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_saks_stores",
    `Saks Fifth Avenue stores near a US ZIP code or a point (lat + lng), within 15 / 30 / 50 / 100 / 300 miles (default 50): store_id, name, address, city, state, ZIP, lat / lng, distance in miles (pickup stores), today's opening and closing times, hours as listed, closed flag, and pickup (true for stores that offer in-store pickup; other Saks locations are listed with pickup false). Pass one location. 2 credits.`,
    {
      ...locationFields,
    },
    post("stores"),
  );

  server.tool(
    "get_saks_store_availability",
    `Can one Saks variant (sku) be picked up near a US ZIP code or a point? For each pickup store: the site's availability message (In Stock, Limited Inventory, Not Available), in_stock, limited, units_at_store when the site gives a count (it does for stores that have the item; otherwise null), and the store's address, distance and today's hours. Needs a variant sku: take it from get_saks_product variants[].sku, or from get_saks_product with color + size. Pass one location. 2 credits.`,
    {
      sku: numericId()
        .describe("A variant sku: a product's variants[].sku, or a product's id after picking color + size, e.g. '10781654'."),
      ...locationFields,
    },
    post("store-availability"),
  );

  server.tool(
    "get_saks_suggestions",
    `The saksfifthavenue.com search-box suggestions for a partial query: the result count, matching designers, suggested categories (name, parent, path for get_saks_category), up to 5 featured products (id, title, brand, URL, image) and the site's popular searches. Useful for keyword research and for building queries for search_saks. 2 credits.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'gucci'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_saks_designers",
    `The Saks A-Z designer index (about 1,200 designers): name, slug (what get_saks_brand takes), URL and letter, optionally only one letter. 2 credits.`,
    {
      letter: z.string().regex(/^[A-Za-z#]$/).optional()
        .describe("Only designers under this letter (A-Z, or '#' for names starting with a digit)."),
    },
    post("designers"),
  );
}
