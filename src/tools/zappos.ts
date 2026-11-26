import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/zappos.ts (zappos.com and 6pm.com, the Zappos outlet site; US, USD).
// Rules the backend enforces and zod here does not: product takes exactly one of product_id, style_id,
// stock_id or asin; reviews, questions and lowest prices exist on zappos only (site 6pm is a 400, not
// charged); search facets take ONE value per facet. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const SITES = ["zappos", "6pm"] as const;
const SORTS = ["relevance", "price_asc", "price_desc", "percent_off", "rating", "newest", "best_sellers"] as const;
const MODES = ["all", "sale"] as const;
const REVIEW_SORTS = ["best", "latest"] as const;

const STORE = "Zappos (zappos.com, the US shoe and clothing store, an Amazon company), or 6pm (6pm.com, the Zappos outlet site) with site 6pm";
const MARKET = "Every answer carries site, host, country (us), currency (USD) and language (en).";
const ONE = "1 credit (credits_used is what was charged). A not-found is charged; refused inputs and failed calls are not.";
const ITEM =
  "position, product_id, style_id, color_id, name, brand, color, price, original_price, percent_off, on_sale, is_new, rating, review_count, on_hand (units in stock for that color, all sizes), gender, product_type, badges [{code, name}], promo_badges, image, url";

const site = () =>
  z.enum(SITES).optional()
    .describe("zappos (www.zappos.com, the default) or 6pm (www.6pm.com, the Zappos outlet site). Both are US stores in USD with the same product, style and stock ids; prices and stock differ between them, so every answer names its site.");
const zapposSite = () =>
  z.enum(SITES).optional()
    .describe("zappos (the default). 6pm has none of its own: site 6pm is a 400 that says so, not charged.");
const productId = () =>
  z.string().min(4).max(10)
    .describe("A Zappos product id (items[].product_id of search_zappos; the number after /product/ in a Zappos link), e.g. '10002909'. The same on 6pm.");
const facetValue = z.union([z.string().max(120), z.number(), z.boolean(), z.array(z.string().max(120)).max(1)]);

export function registerZapposTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/zappos/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_zappos",
    `Search ${STORE}: keywords (or the whole catalog), ONE value per facet (brand, brand id, gender, department, category, subcategory, size, width, color, price band, on sale, any attribute facet), sorted by relevance, price, percent off, rating, newest or best sellers; mode sale lists items on sale by percent off. Returns query, mode, sort, page, limit, total, total_pages, searched_as (the term the site searched when it corrected the query), applied_filters, count, items (${ITEM}), facets [{field (send back in facets), name, group, values [{value, name, count, selected}]}]. ${MARKET} Prices are the site's own in USD. Captured 2026-11-26: 'running shoes' on zappos.com gave 7142 items over 715 pages (10 a page); Women's Brooks on 6pm gave 37. ${ONE}`,
    {
      site: site(),
      query: z.string().min(1).max(200).optional()
        .describe("Search keywords, e.g. 'running shoes'. Leave out to browse the whole catalog (narrowed by facets)."),
      facets: z.record(z.string(), facetValue).optional()
        .describe("Facet filters, ONE value per facet (the site matches one value of a facet at a time), up to 12: {facet: value}. Names: brand (as facets[].values[].name lists it), brand_id (e.g. 26), gender (Women, Men, Girls, Boys), department (e.g. Shoes), category (e.g. Boots), subcategory (e.g. Running Shoes), color (e.g. Black), price (a price band as listed, e.g. \"$100 and Under\"; 6pm has its own bands), on_sale (true), size and width (with gender Men or Women, e.g. {\"gender\": \"Men\", \"size\": \"10\", \"width\": \"Wide\"}), or any facets[].field of an answer (txAttrFacet_Materials, hc_men_size, ...). Values are matched as the site writes them; an unknown value is an empty answer."),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default; the site's own order), price_asc, price_desc, percent_off, rating, newest (new arrivals) or best_sellers."),
      mode: z.enum(MODES).optional()
        .describe("all (default) or sale: items on sale, sorted by percent off unless sort is set."),
      page: z.number().int().min(1).max(2000).optional()
        .describe("Results page, 1-based (default 1). A page past the last one is an empty items list with the real total."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Items per page, 1 to 100 (default 50)."),
    },
    post("search"),
  );

  server.tool(
    "get_zappos_product",
    `One product of ${STORE} by product_id, style_id, stock_id or asin (send exactly one) with every color and size: requested, match {style_id, stock_id} (for a style, stock or ASIN lookup), product_id, name, brand {id, name}, brand_product_name, product_type, category, subcategory, genders, url, rating, review_count, fit {size, width, arch: {text, percent}} (the leading fit answer of reviewers), review_summary (totals, average rating, star counts, comfort / look star percent, size / width / arch fit counts and percent, most and least helpful review without reviewer names), description {bullets, measurements, size_charts}, out_of_stock, style_count, sku_count, in_stock_sku_count, total_on_hand, styles [{style_id, color_id, color, price, original_price, percent_off, price_note, on_sale, is_new, final_sale, launch_date, on_hand, in_stock, badges, promo_badges, attributes [{name, value}], images, url, skus [{stock_id, size, width, on_hand (exact units), price, original_price, upc, asin}]}], notes. on_hand is the exact number of units in Zappos' warehouse stock per size, width and color (Zappos sells online and has no stores). A color or size that is out of stock has no price on the site: price is null with a price_note. Captured 2026-11-26: Brooks Adrenaline GTS 25 (10002909) had 22 colors and 512 sizes, 114 in stock with 5995 units in all; color Black/Biscuit at 109.95 USD (was 155, 29% off) with 76 units. ${MARKET} An unknown id is a charged 404. ${ONE}`,
    {
      site: site(),
      product_id: productId().optional(),
      style_id: z.string().min(4).max(10).optional()
        .describe("A style (one color) id instead of product_id (items[].style_id), e.g. '6549810'."),
      stock_id: z.string().min(4).max(10).optional()
        .describe("A stock id (one size of one color, skus[].stock_id) instead of product_id, e.g. '60162981'."),
      asin: z.string().min(10).max(10).optional()
        .describe("An ASIN (skus[].asin) instead of product_id, e.g. 'B0F4JKCMQ2'."),
    },
    post("product"),
  );

  server.tool(
    "get_zappos_reviews",
    `Customer reviews of one Zappos product (zappos.com; 6pm has none of its own), 25 per page, most helpful first or latest: product_id, name, brand, rating, total_reviews, page, total_pages, per_page, sort, count, reviews [{id, overall_rating, comfort_rating, look_rating, size_fit, width_fit, arch_fit, text, date, upvotes, verified_purchase, incentivized, customer_reward_review, source (where a review was first written when it came from another site), other_shoes, media [{type, url}]}]. No reviewer names, locations or bylines. Captured 2026-11-26: HOKA Bondi 9 (9984296) had 2558 reviews over 103 pages. ${MARKET} A product without a reviews page is a charged 404. ${ONE}`,
    {
      site: zapposSite(),
      product_id: productId(),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Reviews page, 1-based, 25 reviews per page (total_pages says how many)."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("best (default; most helpful first) or latest."),
    },
    post("reviews"),
  );

  server.tool(
    "get_zappos_questions",
    `The customer questions of one Zappos product (zappos.com; 6pm has none of its own), all in one answer: product_id, total, count, staff_answer_count, questions [{id, text, votes, answer_count, top_answer, answers}] where each answer is {text, date, upvotes, best, is_staff (an answer by Zappos staff)}. No asker or answerer names. Captured 2026-11-26: product 9405856 had 33 questions with 11 answers by Zappos staff. ${MARKET} An unknown product is a charged 404. ${ONE}`,
    {
      site: zapposSite(),
      product_id: productId(),
    },
    post("questions"),
  );

  server.tool(
    "get_zappos_lowest_prices",
    `The lowest price of each style (color) of one Zappos product as Zappos gives it for its product page (zappos.com; 6pm has none of its own): product_id, count, styles [{style_id, price}], note. Zappos does not state the period these prices cover (they are not a 30-day low), and they can include colors out of stock now. Captured 2026-11-26: product 10002909 listed 20 styles, from 109.95 USD. ${MARKET} A product with no lowest prices is a charged 404. ${ONE}`,
    {
      site: zapposSite(),
      product_id: productId(),
    },
    post("lowest-prices"),
  );

  server.tool(
    "get_zappos_categories",
    `The department > category > subcategory tree of ${STORE}, one level per call with item counts: the departments, the categories of a department, or the subcategories of a category. Returns level, department, category, total (items in the level asked), count, categories [{name, count, level, facets (send to search_zappos as facets)}]. Captured 2026-11-26: department Shoes held 63603 items in 13 categories, the largest Sneakers & Athletic Shoes (21967). ${MARKET} An unknown department or category is a charged 404. ${ONE}`,
    {
      site: site(),
      department: z.string().min(1).max(120).optional()
        .describe("A department (categories[].name of the top level) to list its categories, e.g. 'Shoes'."),
      category: z.string().min(1).max(120).optional()
        .describe("A category to list its subcategories (with department, or alone), e.g. 'Sneakers & Athletic Shoes'."),
    },
    post("categories"),
  );

  server.tool(
    "get_zappos_suggestions",
    `The search-box suggestions of ${STORE}: up to 10 keyword completions for a partial query. Returns query, count, suggestions. ${MARKET} ${ONE}`,
    {
      site: site(),
      query: z.string().min(1).max(100)
        .describe("A partial search query, e.g. 'hoka bon'."),
    },
    post("suggestions"),
  );
}
