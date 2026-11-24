import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/staples.ts (www.staples.com for country us; www.staples.ca,
// Staples Canada, for country ca with language en or fr, on search and product only). Rules the
// backend enforces and zod here does not: language fr needs country ca; product takes item_id,
// url or (ca) handle; deals needs q or category; stores needs zip or city. No zod `.default()`:
// the MCP SDK would post a defaulted field on every call.

const SORTS = ["best_match", "price_low", "price_high", "rating", "newest"] as const;
const DEAL_TYPES = ["on_promotion", "clearance"] as const;
const REVIEW_SORTS = ["most_relevant", "newest", "oldest", "highest_rating", "lowest_rating", "most_helpful"] as const;
const QUESTION_SORTS = ["newest", "most_answered"] as const;

const NAME = "Staples (staples.com, the US office supply retailer; Staples Canada at staples.ca)";
const ONE =
  "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Price and was price as Staples shows them (was_price is Staples' Regular price, given only when above the price); discount_percent is computed by Scavio from the two. Prices are national (USD): ZIP and store change availability, not price.";
const NOT_AVAILABLE =
  "Not available: the weekly ad, search suggestions, print and tech service prices, ink recycling rewards, Rewards member prices, price match requests, Staples Business Advantage contract prices, price history (poll and store the answers), checkout.";
const ITEM =
  "position, organic_position, sponsored, item_id (the input of get_staples_product, get_staples_store_stock, get_staples_reviews and get_staples_questions), name, url, image, brand, manufacturer, model, price, price_text, was_price, was_price_label, discount_percent, savings [{type, text}], price_per_unit, price_per_unit_unit, price_per_unit_text (Staples' own, e.g. $5.00/Ream or $0.10 Cost Per Page, as given), pack_size, rating, review_count, category {id, name}, department, supercategory, delivery {text, date, type}, in_stock_for_delivery, out_of_stock, pickup_eligible, pickup_message, ship_to_store_eligible, in_store_only, restriction, badges, highlights [{name, value}], supplier_type";
const LIST = `market {country, language, currency, locale}, title, page, page_size, total, total_pages, count, sponsored_count, sort, filters_applied [{group, filter, name}], min_price, max_price, corrected_query, items (${ITEM}), facets [{name, values [{filter, name, count, selected}]}] (send filter back in filters), notes`;

const country = z.enum(["us", "ca"]).optional()
  .describe("us (default: www.staples.com, USD) or ca (www.staples.ca, Staples Canada, CAD).");
const language = z.enum(["en", "fr"]).optional()
  .describe("en (default) or fr (country ca only: www.staples.ca/fr, French products).");
const usOnly = z.enum(["us"]).optional()
  .describe("us only (default): this tool serves www.staples.com; ca is refused.");
const market = { country, language };
const itemId = z.union([z.string().min(3).max(20), z.number().int().positive()])
  .describe("A Staples item number (items[].item_id, the number after product_ in a staples.com link, e.g. \"122374\").");
const zip = z.union([z.string().min(5).max(10), z.number().int().positive()]);
const radius = z.number().int().min(1).max(100).optional();
const categoryClass = z.string().min(3).max(600);
const listShape = {
  page: z.number().int().min(1).max(250).optional()
    .describe("Page (1-250; 40 products a page)."),
  sort: z.enum(SORTS).optional()
    .describe("best_match (default), price_low, price_high, rating (top rated) or newest: Staples' sort menu."),
  brand: z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).min(1).max(5)]).optional()
    .describe("One or more brands (up to 5) as Staples names them (the Brand facet's values, e.g. Hammermill)."),
  filters: z.array(z.string().min(5).max(200)).min(1).max(10).optional()
    .describe("Up to 10 facet values exactly as an earlier answer gives them in facets[].values[].filter (reams, sheet size, colour, yield, rating, price band, ...); several are combined."),
  min_price: z.number().min(0).optional().describe("Lowest price (USD)."),
  max_price: z.number().min(0).optional().describe("Highest price (USD)."),
};
const deal = z.enum(DEAL_TYPES).optional()
  .describe("on_promotion or clearance: only products in Staples' On Promotion or Clearance deals filter.");
const store = z.union([z.string().min(1).max(8), z.number().int().positive()]);

export function registerStaplesTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/staples/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_staples",
    `Search ${NAME} by keywords, a model number or a Staples item number (an item number answers with that product), sorted (best match, price low or high, top rated, newest), filtered (brand, any facet value, price range, On Promotion, Clearance) and paged (40 a page, to page 250). ${PRICES} Returns query, redirect {type (product, category, page), item_id, category_id, url} when Staples answers the search with one product or a category, ${LIST}. Canada (country ca, language en or fr): Staples Canada's top matches (about 5): market, query, count, items [{position, item_id, handle, language, name, brand, url, image, price, was_price, discount_percent, currency, available}], suggested_queries, notes; no paging, sort or filters. ${NOT_AVAILABLE} ${ONE}`,
    {
      q: z.string().min(1).max(200).describe("Keywords (copy paper, hp 64xl), a model number or a Staples item number."),
      ...listShape,
      deal,
      ...market,
    },
    post("search"),
  );

  server.tool(
    "get_staples_product",
    `One ${NAME} product in full by item number or link: market, requested_item_id, found_requested_item_id, item_id, name, brand, manufacturer, model (manufacturer part number; staples.com publishes no UPC), url, image, images, price, was_price, was_price_label, discount_percent, savings, on_promotion, price_per_unit, price_per_unit_unit (Ream, Cost Per Page, ... as given), pack_size, promotions [{type, name, text}] and offer_expires (Staples' own promotion texts and expiry), coupon_codes [{code, limit}], page_yield, sheets_per_ream, number_of_reams, total_sheets, specifications [{name, value, group}], description, bullets, rating, review_count, question_count, rating_breakdown [{stars, count, percent}], review_summary (Staples' own AI-generated summary), category, hierarchy, breadcrumbs, pickup_eligible, ship_to_store_eligible, free_shipping, free_returns, in_store_only, back_order, coming_soon, clearance, instant_savings, restriction, supplier_type, availability {zip, store, out_of_stock, options [{mode, method, units, earliest_date, latest_date, date_text, order_within, back_order}], pickup {store_number, units, in_stock}} for an optional zip and store, variant_group, variants [{item_id, name, url, price, options [{name, value}], image, selected}] (ream / carton / size packs), currency, notes. ${PRICES} An unknown item is a charged 404. Canada (country ca, by item_id, handle or staples.ca link; language en or fr): market, item_id, handle, language, name, brand, url, image, images, price, was_price, discount_percent, currency (CAD), available, barcode (UPC), rating, review_count, pickup_eligible, clearance, model, breadcrumbs, description, variants [{sku, name, options, price, was_price, discount_percent, available, barcode}], notes. ${ONE}`,
    {
      item_id: itemId.optional(),
      url: z.string().min(10).max(1000).optional()
        .describe("A staples.com product link (items[].url), or with country ca a staples.ca product link, instead of item_id."),
      handle: z.string().min(5).max(300).optional()
        .describe("With country ca: a Staples Canada product handle (items[].handle of a ca search)."),
      zip: zip.optional()
        .describe("A US ZIP code (e.g. \"10001\"): delivery availability and dates for it (price does not change with it)."),
      store: store.optional()
        .describe("A Staples store number (stores[].store_number, e.g. \"1633\"): that store's pickup units."),
      ...market,
    },
    post("product"),
  );

  server.tool(
    "get_staples_category",
    `One ${NAME} class listing by CL id or staples.com category link (United States), sorted, filtered and paged like search_staples. ${PRICES} Returns category {id, name}, ${LIST}. An unknown class is a charged 404. ${ONE}`,
    {
      category: categoryClass
        .describe("A Staples class id (CL..., e.g. CL140691 Copy & Printer Paper: items[].category.id or a CL entry of get_staples_categories) or a staples.com category link (/<name>/cat_CL<id>)."),
      ...listShape,
      deal,
      country: usOnly,
    },
    post("category"),
  );

  server.tool(
    "get_staples_categories",
    `${NAME}'s top-level departments, or one department's sub-departments and classes (United States): market, category {id, name, url}, parents [{id, type, name, url}], count, categories [{id, type (SC, CG, DP, CL), name, url}], notes. A class id (CL) is the input of get_staples_category and get_staples_deals. An unknown department is a charged 404. ${ONE}`,
    {
      category: z.string().min(3).max(600).optional()
        .describe("A department id (SC, CG or DP, e.g. SC1676 Paper, from an earlier answer or a staples.com link): its sub-departments and classes. Without it: Staples' top-level departments."),
      country: usOnly,
    },
    post("categories"),
  );

  server.tool(
    "get_staples_deals",
    `${NAME}'s On Promotion (type on_promotion, default) or Clearance products for keywords or a class (q or category is required; United States), sorted, filtered and paged. ${PRICES} Returns type, query or category, redirect, ${LIST}. ${ONE}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("on_promotion (default) or clearance: Staples' deals filters."),
      q: z.string().min(1).max(200).optional().describe("Deals matching these keywords, e.g. laptop (q or category is required)."),
      category: categoryClass.optional().describe("Deals in this class (a CL id or a staples.com category link)."),
      ...listShape,
      country: usOnly,
    },
    post("deals"),
  );

  server.tool(
    "get_staples_coupons",
    `The coupons on ${NAME}'s public coupons page (United States): market, category, count, categories, coupons [{position, code, headline, details, ends (ISO date), ends_text (as given), channel (Online or omni), category, url, image}], notes. Coupon text and end dates are Staples' own. ${ONE}`,
    {
      category: z.string().min(1).max(80).optional()
        .describe("Only coupons of this category, as Staples names it (categories of an earlier answer, e.g. Printers)."),
      country: usOnly,
    },
    post("coupons"),
  );

  server.tool(
    "get_staples_store_stock",
    `Units of one item at the ${NAME} stores near a US ZIP that have it for pickup today, as Staples reports them: market, item_id, name, image, location, radius_miles, count, total_units, stores [{position, store_number, address {line1, city, state, zip}, phone, distance_miles, units, threshold (the value Staples returns beside the units, as given), in_stock, pickup_type, pickup_text (e.g. Ready in 30 mins), your_store, hours [{day, open, close, closed}]}], notes. Staples lists only stores that have the item (nearest first; 7 to 10 seen); an empty list means no nearby store has it or it is not offered for store pickup. Price does not change by store. An unknown item is a charged 404. ${ONE}`,
    {
      item_id: itemId,
      zip: zip.describe("A US ZIP code (e.g. \"60540\"). get_staples_stores gives the ZIP codes of the stores near a city."),
      radius: radius.describe("Miles around the ZIP (1-100, default 100)."),
      country: usOnly,
    },
    post("store-stock"),
  );

  server.tool(
    "get_staples_stores",
    `The ${NAME} stores near a US ZIP or city: market, location, radius_miles, count, stores [{position, store_number, name, address {line1, city, state, zip, country}, phone, fax, latitude, longitude, distance_miles, utc_offset, hours [{day, open, close, closed}] (this week's, holiday closures included), services (Print and Marketing Services, Shredding, Recycling, UPS, Amazon Lockers, ... as Staples lists them)}], notes. Send zip or city. ${ONE}`,
    {
      zip: zip.optional().describe("A US ZIP code (e.g. \"10001\"; zip or city is required)."),
      city: z.string().min(4).max(80).optional().describe("A US city and state, e.g. \"Chicago, IL\", instead of zip."),
      radius: radius.describe("Miles around the location (1-100, default 25)."),
      country: usOnly,
    },
    post("stores"),
  );

  server.tool(
    "get_staples_store",
    `One ${NAME} store by store number: market, store_number, name, address, phone, fax, latitude, longitude, utc_offset, hours, services, notes. An unknown store number is a charged 404. ${ONE}`,
    {
      store: store.describe("A Staples store number (stores[].store_number, e.g. \"1574\")."),
      country: usOnly,
    },
    post("store"),
  );

  server.tool(
    "get_staples_reviews",
    `Reviews of one ${NAME} item (United States), paged (up to 100 a page), sorted and filtered by stars or photos: market, item_id, name, rating, review_count, rating_breakdown [{stars, count, percent}], review_summary (Staples' own AI-generated summary), sort, rating_filter, photos_only, page, limit, total, total_pages, count, reviews [{id, rating, title, text, date, locale, verified_purchase, incentivized, helpful_votes, unhelpful_votes, photos [{url, thumbnail_url}], product {item_id, name, url} (the variant reviewed: reviews are pooled across the item's sizes and packs), syndicated_from, responses [{text, date}]}], notes. No reviewer names. An unknown item is a charged 404. ${ONE}`,
    {
      item_id: itemId,
      page: z.number().int().min(1).optional().describe("Page (1-based)."),
      limit: z.number().int().min(1).max(100).optional().describe("Reviews per page (1-100, default 10)."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_relevant (default, Staples' order), newest, oldest, highest_rating, lowest_rating or most_helpful."),
      rating: z.number().int().min(1).max(5).optional().describe("Only reviews with this many stars (1-5)."),
      photos_only: z.boolean().optional().describe("Only reviews with photos."),
      country: usOnly,
    },
    post("reviews"),
  );

  server.tool(
    "get_staples_questions",
    `Customer questions and answers on one ${NAME} item (United States), 10 a page, newest or most answered first: market, item_id, sort, page, total, total_pages, count, questions [{id, text, date, locale, helpful_votes, answer_count, answers [{id, text, date, helpful_votes, staff, badge, reply_count}]}], notes. No asker or answerer names. ${ONE}`,
    {
      item_id: itemId,
      page: z.number().int().min(1).optional().describe("Page (1-based; 10 questions a page)."),
      sort: z.enum(QUESTION_SORTS).optional().describe("newest (default) or most_answered."),
      country: usOnly,
    },
    post("questions"),
  );

  server.tool(
    "get_staples_trending",
    `The trending searches ${NAME} shows in its search box (United States): market, count, terms, notes. ${ONE}`,
    { country: usOnly },
    post("trending"),
  );
}
