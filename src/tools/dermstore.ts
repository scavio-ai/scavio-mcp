import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/dermstore.ts (markets us and ca). Rules the backend enforces
// and zod here does not: list takes path or url, product takes sku or url (not both); page x
// page_size stays within 10,000 positions. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const COUNTRIES = ["us", "ca"] as const;
const SORTS = ["relevance", "popularity", "price_low", "price_high", "name", "newest", "discount"] as const;

const FIRST = "Dermstore (dermstore.com, the US skincare and beauty retailer, shipping to the US and Canada)";
const NAME = "Dermstore";
const MARKETS =
  "Markets (country, default us): us (prices in USD, shipping to the US) or ca (Dermstore's own Canadian dollar prices, shipping to Canada; not converted). Every answer carries market {country, currency, shipping_destination}.";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Prices are Dermstore's for a visitor without an account, in the market's currency. rrp is Dermstore's RRP as given; discount_percent is computed by Scavio from price and rrp, only when the RRP is above the price. offer is Dermstore's own promotion text (code, gift, end date inside the text), as given.";
const NOT_AVAILABLE =
  "Not available: a full review feed or review paging (get_dermstore_product returns the 10 latest reviews only), Q&A, member (VIP) prices, cart or checkout prices (code discounts apply at the cart), price history (poll and store the answers), offer start dates. The same product at Sephora, Ulta or Amazon comes from those platforms' tools (match on UPC, or brand + name + size).";
const ITEM =
  "position, sku (the input of get_dermstore_product), name, brand, url, image, price, rrp, discount_percent, price_from (the lowest variant price when below price), currency, in_stock, rating, review_count, offer {title, description, free_gift, url}, variants_count, options";
const LIST = `market, total, total_pages, page, page_size, has_more, count, sort, filters_applied, items [{${ITEM}}], facets [{filter (the input it maps to), label, type, options [{value, label, count} or {label, from, to, count}]}] (with include_facets), notes`;

const country = z.enum(COUNTRIES).optional()
  .describe("The market (default us): us (USD, shipping to the US) or ca (Dermstore's own CAD prices, shipping to Canada).");
const many = (example: string, description: string) =>
  z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).min(1).max(10)]).optional()
    .describe(`${description} One value or a list of up to 10 (e.g. ${example}).`);

const listShape = {
  page: z.number().int().min(1).max(10_000).optional()
    .describe("Page (default 1). At most 10,000 positions (page x page_size)."),
  page_size: z.number().int().min(1).max(200).optional()
    .describe("Products per page (1-200, default 60)."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), popularity, price_low, price_high, name, newest or discount (highest percent off first): Dermstore's sort menu."),
  brand: many("EltaMD", "Brand as Dermstore names it (exact): facets[filter=brand].options[].value."),
  skin_type: many("Dry Skin", "Skin type as Dermstore lists it, e.g. Dry Skin, Oily Skin, Sensitive Skin."),
  concern: many("Aging", "Skin concern as Dermstore lists it, e.g. Aging, Dehydration, Breakouts & Blemishes."),
  spf: many("SPF 30+", "SPF band as Dermstore lists it, e.g. SPF 30+, SPF 50+, No SPF."),
  key_ingredient: many("Retinol", "Key ingredient as Dermstore lists it, e.g. Retinol, Hyaluronic Acid, Niacinamide."),
  preference: many("Clean", "Preference as Dermstore lists it, e.g. Clean, Vegan, Fragrance-Free."),
  gender: many("Female", "Gender as Dermstore lists it."),
  min_price: z.number().min(0).max(100_000).optional().describe("Lowest price, in the market's currency."),
  max_price: z.number().min(0).max(100_000).optional().describe("Highest price, in the market's currency."),
  min_rating: z.number().min(1).max(5).optional().describe("Lowest average star rating (1-5)."),
  min_discount: z.number().min(0).max(100).optional().describe("Lowest percent off Dermstore's RRP (0-100)."),
  max_discount: z.number().min(0).max(100).optional().describe("Highest percent off Dermstore's RRP (0-100)."),
  include_facets: z.boolean().optional()
    .describe("Also return Dermstore's filter counts for the results (facets). Still 1 credit."),
  country,
};
const FILTERS =
  "sorted (relevance, popularity, price low or high, name, newest, discount) and filtered (brand, skin type, concern, SPF band, key ingredient, preference, gender, price range, minimum rating, discount range), up to 200 a page";

export function registerDermstoreTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/dermstore/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_dermstore",
    `Search the catalogue of ${FIRST} by keywords or a Dermstore SKU, ${FILTERS}. A keyword Dermstore maps to one of its pages (a brand such as eltamd, an ingredient such as retinol, a category such as sunscreen) returns that page's products, as Dermstore's own search does, with resolved_from {type (brand, ingredient, category, landing or product), path, listed_path, url, title, sku}; null for a plain search. Returns query, resolved_from, corrected_query, ${LIST}. ${PRICES} Captured 2026-11-25: EltaMD UV Clear Broad-Spectrum SPF 46 (1.7 fl. oz., SKU 11370303) at 46 USD (us) and 65.78 CAD (ca), with the offer "20% Off With Code JOY + $22 Gift" on EltaMD. ${MARKETS} ${NOT_AVAILABLE} ${ONE}`,
    {
      q: z.string().min(1).max(200)
        .describe("Keywords or a Dermstore SKU (e.g. uv clear spf 46). A mapped keyword (e.g. sunscreen, retinol, eltamd) returns the page Dermstore sends it to, reported in resolved_from."),
      ...listShape,
    },
    post("search"),
  );

  server.tool(
    "get_dermstore_list",
    `The products of any ${NAME} list page by path or link: a category (/skin-care), brand (/brands/eltamd), sale (/sale), offer (/shop/black-friday/30-off), gift sets (/gift-sets) or ingredient page (/ingredient/retinol), ${FILTERS}. Paths come from get_dermstore_categories, get_dermstore_brands and get_dermstore_offers (list_path). An editorial page without a product list is listed through its view-all page (listed_path). Returns path, listed_path, url, ${LIST}. ${PRICES} An unknown path is a charged 404. ${MARKETS} ${ONE}`,
    {
      path: z.string().min(2).max(300).optional()
        .describe("A Dermstore list page path (the part after dermstore.com/c), e.g. /brands/eltamd, /skin-care, /sale, /shop/black-friday/30-off, /ingredient/retinol. Send path or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("A Dermstore list page link (https://www.dermstore.com/c/<page>/) instead of path."),
      ...listShape,
    },
    post("list"),
  );

  server.tool(
    "get_dermstore_product",
    `One ${NAME} product by SKU or link, for the market asked: market, requested_sku, sku, product_sku, name, product_name, brand, url, price, rrp, discount_percent, currency, in_stock, availability_message, upc (the barcode as Dermstore gives it; null when Dermstore lists none, as for sets), option_type and option (shade, size or strength, as given), variants [{sku, name, option_type, option, shade_colour, price, rrp, discount_percent, in_stock, availability_message, upc, preorder, max_per_order, loyalty_points}] (each variant has its own price and stock), subtitle, description, key_benefits, directions, ingredients, at_a_glance, volume, faq, images, offer {title, description, free_gift, url} (Dermstore's promotion banner, as given: its dates appear only inside its text), auto_replenish [{discount_first, discount_recurring, price_first, price_recurring, frequencies}] (Dermstore's subscribe-and-save plans, as given), loyalty_points, max_per_order, preorder, hsa_fsa (Dermstore's HSA/FSA eligibility tag), rating, review_count, recent_reviews [{rating, date, text}] (the 10 latest reviews the product page shows; no reviewer names), breadcrumbs, notes. ${PRICES} Captured 2026-11-25: Medik8 Crystal Retinal 20 30ml (SKU 13806521) at 123 USD with 6 strength variants priced on their own (Retinal 10 at 111, Retinal 6 at 87) and the offer "30% Off With Code JOY + Gift"; on ca, SkinCeuticals C E Ferulic (SKU 11289609) at 264.55 CAD with the offer "Earn 10% Back + $25 Gift" (double points, as Dermstore states it, instead of a code discount). An unknown SKU is a charged 404. ${MARKETS} ${ONE}`,
    {
      sku: z.union([z.string().min(5).max(10), z.number().int().positive()]).optional()
        .describe("A Dermstore SKU (items[].sku or variants[].sku, e.g. 11289609). Send sku or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("A Dermstore product link (https://www.dermstore.com/p/<name>/<sku>/) instead of sku."),
      country,
    },
    post("product"),
  );

  server.tool(
    "get_dermstore_suggestions",
    `${FIRST} search-box suggestions for typed text: market, query, count, terms (suggested searches), corrections, products [{sku, name, url, image, price, rrp, discount_percent, currency, rating, review_count}] (up to 5 each), notes. ${MARKETS} ${ONE}`,
    {
      q: z.string().min(1).max(100).describe("The text typed so far (e.g. eltamd)."),
      country,
    },
    post("suggestions"),
  );

  server.tool(
    "get_dermstore_offers",
    `The current offers of ${FIRST}, as its coupon-codes page lists them: market, count, offers [{title, description, code (when the offer text names one), gift, threshold (the spend the text states), ends (Dermstore's end time, ISO 8601 UTC), url, list_path (send to get_dermstore_list for the products)}], notes. Dermstore gives no start date. Code rates differ by brand. Captured 2026-11-25: "Enjoy 25% off jane iredale with code JOY" plus a gift over $75 on the brand, ends 2026-12-01T08:00:00.000Z. ${MARKETS} ${ONE}`,
    { country },
    post("offers"),
  );

  server.tool(
    "get_dermstore_brands",
    `The A-Z brand directory of ${FIRST} (about 235 brands): market, letter, total_brands, count, brands [{name, path, url, letter}], notes. path is the input of get_dermstore_list for a brand's products. ${MARKETS} ${ONE}`,
    {
      letter: z.string().min(1).max(3).optional()
        .describe("Optional: only brands under this letter (A-Z, or 0-9)."),
      country,
    },
    post("brands"),
  );

  server.tool(
    "get_dermstore_categories",
    `The category tree of ${FIRST}, as its site navigation shows it: market, count, total_categories, categories [{name, path, url, children [...]}], notes. path is the input of get_dermstore_list. ${MARKETS} ${ONE}`,
    { country },
    post("categories"),
  );
}
