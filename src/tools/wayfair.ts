import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/wayfair.ts (wayfair.com, wayfair.ca en/fr,
// wayfair.co.uk, wayfair.ie; AllModern, Birch Lane, Joss & Main and Perigold
// via site). Cross-field rules the backend enforces and zod here does not:
// product takes sku or url; category takes category_id or category_url;
// language fr is ca only; a banner site is country us only; zip is us and ca
// only. No zod `.default()`: the MCP SDK would post a defaulted field on
// every call.

const COUNTRIES = ["us", "ca", "gb", "ie"] as const;
const SITES = ["wayfair", "allmodern", "birchlane", "jossandmain", "perigold"] as const;
const SORTS = ["recommended", "price_asc", "price_desc", "rating"] as const;

const CHARGE = "1 credit. Failed upstream calls are not charged; a not-found is charged.";
const MARKETS =
  "Markets: us (wayfair.com, USD), ca (wayfair.ca, CAD; language en or fr), gb (wayfair.co.uk, GBP), ie (wayfair.ie, EUR). Wayfair no longer sells in Germany or Austria (de / at answer 400). Every answer echoes country, language, site and currency.";
const PRICES =
  "Prices are numbers in the market's currency (never converted). price is what Wayfair charges now (sale_price when on sale, with price_label such as Sale, Closeout or Solde); was_price is Wayfair's strikethrough price, which Wayfair's terms define as the manufacturer's suggested price or the highest price Wayfair offered or sold the item at in the past; Wayfair's Sale label means a discount against a price in the previous 90 days. No price history: Wayfair shows none, so poll price, sale_price, was_price and badge to build one.";
const ITEM =
  "position, sku, variant_id, name, brand (id, name), url, image, price, sale_price, was_price, price_label, discount_percent, per_item_price (sets), loyalty_savings, prices (every price line), badge (e.g. Early Black Friday, Sale), rating, review_count, stock_status, stock_text (e.g. 542 Left in Stock), open_box_price, option_counts, selected_options, category and sponsored";
const GRID = `items with ${ITEM}. Also count, total (approximate: Wayfair's own count, total_is_approximate), page, page_size, total_pages, sort, sorts_offered, requested_filters, applied_filters (including filters Wayfair infers from the keywords), unapplied_filters and facets (id, name, type, options with id and label; the ids are what filters takes; no per-option counts).`;

const country = () => z.enum(COUNTRIES).optional()
  .describe("Wayfair market (default us): us (wayfair.com), ca (wayfair.ca), gb (wayfair.co.uk), ie (wayfair.ie).");
const language = () => z.enum(["en", "fr"]).optional()
  .describe("ca only: en (default) or fr (wayfair.ca in French: French names, labels and dates). Every other market is English.");
const site = () => z.enum(SITES).optional()
  .describe("Wayfair's US banner sites (USD, country us only): allmodern, birchlane, jossandmain or perigold. Default wayfair.");

const gridFields = {
  page: z.number().int().min(1).max(1000).optional()
    .describe("Results page, 1-based. A page past the last returns no items and a note."),
  sort: z.enum(SORTS).optional()
    .describe("recommended (default), price_asc, price_desc or rating. Price sorts follow Wayfair's price per item: a set is ordered by its per_item_price."),
  on_sale: z.boolean().optional().describe("Only products on sale."),
  closeout: z.boolean().optional().describe("Only closeout products."),
  open_box: z.boolean().optional().describe("Only products with an open-box offer (open_box_price)."),
  new_arrivals: z.boolean().optional().describe("Only new arrivals."),
  in_stock: z.boolean().optional().describe("Only products in stock."),
  brand: z.union([z.number().int(), z.string(), z.array(z.union([z.number().int(), z.string()])).max(5)]).optional()
    .describe("1 to 5 brand ids, not names: items[].brand.id or a Brand facet option id, e.g. 44308 = Ebern Designs."),
  min_rating: z.number().int().min(1).max(5).optional()
    .describe("Customer rating, one of 1, 3, 4 or 5: 5 = five stars only, 4 / 3 = that many stars and up, 1 = every reviewed product."),
  price_min: z.number().min(0).optional().describe("Lowest price, in the market's currency."),
  price_max: z.number().min(0).optional().describe("Highest price, in the market's currency."),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()]))])).optional()
    .describe("Any facet of the answer, keyed by facets[].id with facets[].options[].id values, e.g. {\"2471\": [\"274623\"]}; ranges as \"min~max\"."),
};

export function registerWayfairTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/wayfair/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_wayfair",
    `Search Wayfair products by keyword, sorted by price or customer rating and filtered by sale, closeout, open box, new arrivals, in stock, brand id, minimum rating, price range or any facet. Keyword pages return 30 results per page; a keyword that matches a category answers that category's grid (48 per page) and says so in redirected_to (type, category_id, name, url), and a SKU answers redirected_to a product. Returns query, ${GRID} site searches AllModern, Birch Lane, Joss & Main or Perigold (us). ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'office chair' (a SKU opens that product: redirected_to)."),
      country: country(),
      language: language(),
      site: site(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_wayfair_product",
    `One Wayfair product by SKU or product URL: sku, variant_id, name, brand (id, name, url), url, price, sale_price, was_price, price_label, percent_off, per_item_price, loyalty_savings, prices, badge, limited_time_deal (end date when Wayfair shows one), stock_status, max_quantity, part_number, options (category such as Color or Rug Size, total, the selected choice and every choice with name, option_id, stock_status and url; choices carry no price: call again with option_id for that option's price and stock, one call per option), dimensions, specifications, features, description, image, images, breadcrumbs, documents (manuals), collection, returns (returnable, cancelable), rating, review_count, rating_histogram (5 to 1), review_summary (text and the page's own label), review_aspects and reviews (the 5 reviews the page shows: id, rating, date, verified, badge, text, author, location, options, language; no review paging, sort or star filter). delivery (name, date_min, date_max, text, badge) and delivery_zip come back for the ZIP / postal code sent in zip (us and ca only); without zip there is no delivery estimate. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      sku: z.string().min(3).max(20).optional()
        .describe("A Wayfair SKU (items[].sku, or \"SKU:\" on the product page), e.g. 'W005006988'."),
      url: z.string().min(10).max(1000).optional()
        .describe("A Wayfair product page of a served site (alternative to sku; the market, language and site are read from it)."),
      option_id: z.union([z.string(), z.number().int()]).optional()
        .describe("A size / color / configuration: options[].choices[].option_id (several comma-separated for multi-choice products), e.g. '1820607042'. Returns that option's price and stock."),
      zip: z.string().min(3).max(10).optional()
        .describe("Delivery estimate to this ZIP / postal code, e.g. '10001' (us and ca only)."),
      country: country(),
      language: language(),
      site: site(),
    },
    post("product"),
  );

  server.tool(
    "get_wayfair_category",
    `One Wayfair category's products (48 per page) by category id or category URL (send one), with the search sorts and filters: category (id, name, url, breadcrumbs) and ${GRID} An unknown category answers 404; a department page (/cat/) is not a product list. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      category_id: z.union([z.string(), z.number().int()]).optional()
        .describe("A Wayfair category id, e.g. '413892' = Sofas (or 'c413892'), from a category URL (...-c413892.html) or a search's redirected_to.category_id."),
      category_url: z.string().min(10).max(1000).optional()
        .describe("A category page of a served site (/sb0/, /sb1/ or /sb2/ URL; filters in it are kept)."),
      country: country(),
      language: language(),
      site: site(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_wayfair_deals",
    `The market's current Wayfair sale events (the Daily Sales list): events (event_id, slug, title, url, image) and count; about 38 on us, 34 on ca, 6 on gb and ie. Events are listed, not expanded: for sale, closeout or open-box products use search_wayfair or get_wayfair_category with on_sale, closeout or open_box. wayfair sites only (no banner site). ${MARKETS} ${CHARGE}`,
    {
      country: country(),
      language: language(),
    },
    post("deals"),
  );
}
