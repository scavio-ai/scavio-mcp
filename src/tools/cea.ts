import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/cea.ts (C&A Brasil, cea.com.br, the Brazilian arm of the C&A fashion chain; Brazil,
// BRL). Rules the backend enforces and zod here does not: product takes exactly one of product_id, sku, slug or url;
// facets takes query and/or one of category, brand or collection_id; reviews takes rating or filter, not both. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "C&A Brasil (cea.com.br, the Brazilian arm of the C&A fashion chain), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW_TIME = "Listings are large: usually 5 to 100 s; allow a client timeout of at least 240 s.";
const FAST_TIME = "Usually 2 to 15 s; allow a client timeout of at least 120 s.";
const SIZE =
  "sizes [{sku, size, color, available, available_quantity (the site's capped online figure: a round 100, 10000 or 99999 = plenty, 0 = none; not a store's units), price, list_price, discount_percent, pix_price}]";
const CARD = `position, product_id (what get_cea_product takes), name, brand, labels (the site's Marcas values: C&A labels such as Clock House or Yessica, and partner brands), reference, url, image, available, price (the lowest price among the sizes in stock), list_price, discount_percent, pix_price (the Pix price; Pix is Brazil's instant payment), best_installment {payment_system, count, value, total, interest_rate}, colors, ${SIZE}, categories, collection_ids (the promotion collections the product is in, by id: get_cea_deals takes one) and release_date`;
const GRID = `Returns page, page_size, total, total_pages (the site pages at most 50 pages deep), has_more, count, sort, items [{${CARD}}] and notes. No results is an empty answer.`;

const sort = z.enum(["relevance", "price_asc", "price_desc", "best_sellers", "newest", "discount", "name_asc", "name_desc"]).optional()
  .describe("The site's sorts: relevance (default), price_asc, price_desc, best_sellers (most ordered), newest (release date), discount (deepest discount first), name_asc or name_desc.");
const grid = {
  sort,
  page: z.number().int().min(1).max(50).optional()
    .describe("Results page, 1 to 50 (the site pages at most 50 pages deep); total_pages reports the last one."),
  page_size: z.number().int().min(1).max(24).optional().describe("Products per page, 1 to 24 (default 24)."),
};
const category = z.string().min(1).max(300)
  .describe("A category path of 1 to 3 levels (categories[].path of get_cea_categories: department, category, subcategory), e.g. 'moda-feminina', 'moda-feminina/roupas', 'moda-feminina/roupas/blusas', or its cea.com.br link.");
const brand = z.string().min(1).max(80)
  .describe("A brand as the site's Marcas filter writes it (get_cea_facets, key marcas), e.g. 'palomino', 'clock-house', 'yessica', 'angelo-litrico', or a partner brand.");
const collectionId = z.union([z.string().min(1).max(12), z.number().int().min(1)])
  .describe("A promotion collection id (items[].collection_ids), e.g. '19727'.");
const digits = (description: string) => z.union([z.string().min(1).max(12), z.number().int().min(1)]).describe(description);
const cep = z.union([z.string().min(1).max(9), z.number().int().min(1)])
  .describe("A Brazilian CEP (postal code, 8 digits), e.g. '01310-100'.");

export function registerCeaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/cea/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_cea",
    `Search ${SITE} by keyword, in the site's sorts (price, best sellers, newest, discount, name), up to 24 per page. ${GRID} Also query. Captured 2026-11-27: vestido matched 13549 products, the first a midi dress at 219.99 BRL (list 239.99), 5 interest-free C&A Pay installments of 43.99. ${COST} ${SLOW_TIME}`,
    {
      query: z.string().min(1).max(100).describe("Search keywords, in Portuguese, e.g. 'vestido'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_cea_category",
    `One department, category or subcategory listing of ${SITE}, by category path (categories[].path), sorted like search_cea. ${GRID} Also category and url. Captured 2026-11-27: moda-feminina/roupas held 93575 products. ${COST} ${SLOW_TIME}`,
    { category, ...grid },
    post("category"),
  );

  server.tool(
    "get_cea_brand",
    `One brand's products on ${SITE}, by the brand value of the site's Marcas filter (C&A's own labels such as Palomino, Clock House, Yessica, Angelo Litrico, and partner brands), sorted like search_cea. ${GRID} Also brand. Captured 2026-11-27: palomino held 20216 products. ${COST} ${SLOW_TIME}`,
    { brand, ...grid },
    post("brand"),
  );

  server.tool(
    "get_cea_deals",
    `One promotion collection of ${SITE}, by collection id (items[].collection_ids, e.g. a Black Friday or free-shipping collection), with list price, sale price and discount_percent; sort discount puts the deepest discounts first. ${GRID} Also collection_id. Collections are given by id only (the site's internal collection names are not returned). Captured 2026-11-27: collection 19727 sorted by discount held 1302 products, the first a skirt at 39.99 BRL (list 139.99, 71% off). ${COST} ${SLOW_TIME}`,
    { collection_id: collectionId, ...grid },
    post("deals"),
  );

  server.tool(
    "get_cea_facets",
    `The filter values of ${SITE} for a query, or one category, brand or collection: count and facets [{key, label, param, values [{value, label, count, selected}] or ranges [{from, to, count}]}] (department, category, subcategory, type, gender, size, color, Marcas, material, price range and more, with product counts). param names the request field a value goes back into: the category-1 / 2 / 3 values make a category path (category), marcas values go into brand; the other facets are counts only. Send query, and at most one of category, brand or collection_id. Captured 2026-11-27: vestido returned 13 facets, 8946 of the matches in Moda Feminina. ${COST} ${FAST_TIME}`,
    {
      query: z.string().min(1).max(100).optional().describe("Search keywords, e.g. 'jeans' (or send one of category, brand or collection_id)."),
      category: category.optional(),
      brand: brand.optional(),
      collection_id: collectionId.optional(),
    },
    post("facets"),
  );

  server.tool(
    "get_cea_suggestions",
    `The search box of ${SITE}: for the start of a search, suggestions [{term, count, attributes [{key, value, label, value_label}]}] (the completions with their search counts and, for some, the department / category they point to) and top_searches [{term, count}] (the site's most searched terms); without query, the top searches alone. Captured 2026-11-27: cal returned 5 suggestions; the top search was vestido, searched 190040 times. ${COST} ${FAST_TIME}`,
    {
      query: z.string().min(1).max(100).optional().describe("The start of a search, e.g. 'jaq'. Without it, the top searches alone."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_cea_categories",
    `The department tree of ${SITE}: count, node_count and categories [{category_id, name, path, url, children [...]}] over three levels. Use path as category in get_cea_category and get_cea_facets. Captured 2026-11-27: 8 departments, 363 nodes. ${COST} ${FAST_TIME}`,
    {},
    post("categories"),
  );

  server.tool(
    "get_cea_product",
    `One product of ${SITE} by product_id, size sku, slug or link (exactly one): requested, product_id, sku (when asked by sku), name, brand, labels, reference, model_id, url, images, available, price (the lowest price among the sizes in stock), list_price, discount_percent, pix_price, best_installment (the longest interest-free plan), installments [{payment_system, count, value, total, interest_rate}] (each payment method's longest plan, e.g. C&A Pay), colors, sizes [{sku, size, color, available, available_quantity, price, list_price, discount_percent, pix_price, seller {id, name}}] (every size), categories, specifications [{name, value}] (material, fit, sleeve, made in...), collection_ids and release_date. available_quantity is the site's capped online figure, not a store's units: get_cea_shipping tells which stores near a CEP can hand a size over. The reviews and the rating summary come from get_cea_reviews. Not available: marketing description, EAN (the site leaves it empty), Q&A, store units, price history. An unknown product is a charged not-found. Captured 2026-11-27: 4536055, an oversized cotton t-shirt, was 99.99 BRL in 5 sizes, payable in 3 interest-free C&A Pay installments of 33.33, in 69 promotion collections. ${COST} ${FAST_TIME}`,
    {
      product_id: digits("The product id (items[].product_id), e.g. '4536055'. Send one of product_id, sku, slug or url.").optional(),
      sku: digits("The id of one size (sizes[].sku): returns its product.").optional(),
      slug: z.string().min(1).max(300).optional().describe("The product slug (the link's path before /p)."),
      url: z.string().min(1).max(600).optional().describe("A product link on www.cea.com.br (items[].url, ending in /p)."),
    },
    post("product"),
  );

  server.tool(
    "get_cea_shipping",
    `The delivery quote of ${SITE} for one size (sku) and a CEP, as the product page gives it: sku, cep, availability, price, list_price, can_deliver, can_pick_up, delivery_options [{name, price (0 = free), list_price (before a shipping promotion), estimate, business_days, estimated_date}], pickup_stores [{pickup_point_id, store_code, name, distance_km, address, price, estimate, business_days, estimated_date}] (the stores near the CEP that can hand this size over, nearest first) and messages [{code, text, status}] (e.g. the site's cannot-be-delivered notice). The quote is for 1 unit; nothing is added to a cart or ordered. An unknown sku is a charged not-found. Captured 2026-11-27: sku 6493983 to CEP 01310-100 had free Normal delivery (list 24.40) in 6 business days, and 5 nearby stores could hand it over, the nearest 0.72 km away in 1 business day. ${COST} ${FAST_TIME}`,
    {
      sku: digits("The id of one size (sizes[].sku from get_cea_product or a listing), e.g. '6493983'."),
      cep,
    },
    post("shipping"),
  );

  server.tool(
    "get_cea_stores",
    `The pickup points near a CEP on ${SITE}, nearest first: cep, total (the site's count of pickup entries near the CEP, of which the nearest are listed), count and stores [{store_code, pickup_point_ids, name, type (cea_store or partner_point), partner, active, distance_km, address {street, number, complement, neighborhood, city, state, cep}, latitude, longitude, phone, hours [{day, opens, closes}]}]. The list includes third-party pickup lockers and counters (Clique Retire, type partner_point) next to the C&A stores. Which of them can hand a given size over: get_cea_shipping. Captured 2026-11-27: CEP 01310-100 listed 18 pickup points (17 C&A stores and 1 Clique Retire point) of 121. ${COST} ${FAST_TIME}`,
    { cep },
    post("stores"),
  );

  server.tool(
    "get_cea_reviews",
    `The customer reviews of one product of ${SITE}, by product_id, as the product page shows them: product_id, page, per_page, sort, filter, rating_filter, total (the reviews matching the request, from the rating summary), has_more, count, product_name, rating {average, count, histogram {1-5}}, review_counts {total, positive (ratings 3-5), negative (ratings 1-2), with_photos}, reviews [{id, rating, title, text (null when the review has stars but no text), date, purchase_date (the date of the order the review is linked to), recommends, helpful_votes, unhelpful_votes, photos [{image, thumbnail}], attributes [{name, answer}] (the store's follow-up questions, such as size, fit and height), store_reply, imported, influencer, purchased {sku, size, color} (the size bought, where the review carries it)}] and notes. Sorted newest (default) or most_helpful; filtered positive (ratings 3-5), negative (ratings 1-2) or with_photos, or rating for one star rating (rating or filter, not both); up to 100 per page, pages 1 to 200. Reviews can lag the product page by up to 4 hours. Review text is the customer's own; reviewer names are never returned. No questions and answers. A product id the reviews do not know answers with no reviews (count 0, charged), or a charged not-found. Captured 2026-11-28: 3700395, a white low-top sneaker, was rated 4.5 from 1189 reviews (854 five-star, 93 negative, 27 with photos). ${COST} Usually 2 to 20 s; allow a client timeout of at least 180 s.`,
    {
      product_id: digits("The product id (items[].product_id or product_id of get_cea_product), not a size sku or the reference, e.g. '3700395'."),
      page: z.number().int().min(1).max(200).optional().describe("Reviews page, 1 to 200 (default 1)."),
      per_page: z.number().int().min(1).max(100).optional().describe("Reviews per page, 1 to 100 (default 20)."),
      sort: z.enum(["newest", "most_helpful"]).optional().describe("newest (default) or most_helpful (the most helpful votes at the top)."),
      filter: z.enum(["all", "positive", "negative", "with_photos"]).optional()
        .describe("all (default), positive (ratings 3-5), negative (ratings 1-2) or with_photos. Not combined with rating."),
      rating: z.number().int().min(1).max(5).optional().describe("Only the reviews with this star rating, 1 to 5. Not combined with filter."),
    },
    post("reviews"),
  );
}
