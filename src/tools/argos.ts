import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/argos.ts (argos.co.uk: one UK store, GBP,
// no country input; Argos Ireland closed in 2023). Cross-field rules the
// backend enforces and zod here does not: product, reviews and questions take
// exactly one of product_id or url; stores takes one of postcode or store;
// deals top_100 takes page only (2 pages of 60). No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_low", "price_high", "rating"] as const;
const SELLERS = ["argos", "trusted_seller"] as const;
const OFFERS = ["clearance", "special_offer", "black_friday"] as const;
const COLLECTIONS = ["black_friday", "clearance", "special_offers", "top_100"] as const;
const REVIEW_SORTS = ["newest", "oldest", "most_helpful", "highest_rating", "lowest_rating"] as const;
const QUESTION_SORTS = ["newest", "oldest"] as const;

const STORE = "Argos is argos.co.uk, the UK store, prices in GBP (Argos Ireland closed in 2023, so there is no country input).";
const CREDITS = "Costs 2 credits. Failed upstream calls are not charged; a not-found is charged.";
const PRICES =
  "Prices are numbers in GBP as Argos shows them: price (now), was_price (the site's was price, shown on offers), save = was_price - price (computed by Scavio where both exist), offer_text (the site's own words, e.g. Half Price, Save £60.00). Badges are the site's codes as given (e.g. Black_Friday, VALUE_amazing_deals, price_guarantee); neither says a price is the lowest anywhere.";
const ITEM =
  "product_id, url, name, brand, price, was_price, save, offer_text, currency, clearance, badges, rating, review_count, seller (argos: sold by Argos, or trusted_seller: Argos's marketplace of third-party sellers), deliverable, reservable (in-store collection), buyable, free_delivery, delivery_cost (null for Trusted Seller items: the seller sets it), has_variations, argos_pay {available, offering, message}, image";
const LIST_OUT = `sort, filters, page, page_size (24), total (Argos stops counting at 10,000), total_capped (true means 10,000 or more), total_pages, has_more, count, tu_clothing_excluded (Tu Clothing items Argos lists but sells on its own site: left out and counted here), currency, items (${ITEM}), facets [{name, label, values [{value, label, count, children}]}] (the filter inputs this list offers)`;
const FILTERS =
  "Filters: brand (several = OR), category, seller, offers, new_in, colour, price_min / price_max (GBP, any range), rating_min, and filters (any facet by facets[].name). Sorts: relevance (default, Argos's Most Popular), price_low, price_high, rating.";
const STATES =
  "Collection state per store and product: collect_now (in stock to collect right away), collect_today / collect_tomorrow (from a time today or tomorrow: available_from has it), collect_later, out_of_stock, not_available (Argos is not selling it now), other. Delivery state: same_day, next_day, later (Argos's \"Delivery within N days\", with days = N), out_of_stock, not_available, other. Delivery available_from is the date Argos returns, as given (it can read today on a next-day message): quote message and state. Argos shows no unit counts: the answer is whether and when, never how many.";
const STORE_OUT =
  "store_id, name, store (the store reference for get_argos_stores), url, type (argos_store: a standalone Argos store; inside_sainsburys: an Argos counter inside a Sainsbury's store; collection_point: a collect-only point, collection only, no shop), brand, distance_miles, address {lines, town, county, postcode}, latitude, longitude, phone (+44...), hours {monday..sunday: [{open, close}]}, special_hours";
const NOT_AVAILABLE =
  "Not available: unit counts, price history (poll and store the answers), a brand directory (brand is a filter), Argos Ireland, card or checkout prices, Argos Pay terms.";

const strList = (description: string, max = 10) =>
  z.union([z.string().min(1).max(400), z.array(z.string().min(1).max(60)).min(1).max(max)]).optional().describe(description);
const productId = z.union([z.string().min(7).max(8), z.number().int().positive()]);
const categoryField = z.union([z.string().min(3).max(12), z.number().int().positive()]).optional()
  .describe("Category id (get_argos_categories category_id, or the category facet's values), e.g. 29560 Kettles.");
const offers = strList("Offers, up to 3 (OR): clearance, special_offer, black_friday.", 3);

const listFields = {
  brand: strList("Brands, up to 10 (OR): facets name brands, values[].value in lower case, e.g. 'russell hobbs', 'ninja'."),
  seller: z.enum(SELLERS).optional().describe("argos (sold and fulfilled by Argos) or trusted_seller (Argos's marketplace of third-party sellers)."),
  new_in: z.boolean().optional().describe("Only products Argos marks New In."),
  colour: strList("Colour groups, up to 10 (facets name colour group), e.g. blacks, whites, greys."),
  price_min: z.number().min(0).max(100_000).optional().describe("Lowest price, GBP (any amount: the range is sent as is)."),
  price_max: z.number().min(0).max(100_000).optional().describe("Highest price, GBP."),
  rating_min: z.number().int().min(1).max(5).optional().describe("Customer rating: 5 (five stars only) or 1-4 (that many stars or more)."),
  filters: z
    .record(z.string(), z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).min(1).max(10)]))
    .optional()
    .describe("Any facet by facets[].name: a value or list of values (facets[].values[].value; values of one facet are OR, facets are AND), e.g. { \"kettle capacity (l)\": \"1.6l - 2.0l\" }. Up to 10 facets."),
  sort: z.enum(SORTS).optional().describe("relevance (default: Argos's Most Popular), price_low, price_high, rating."),
  page: z.number().int().min(1).max(200).optional().describe("Page, 24 products each, 1 to 200 (total_pages says how deep the list goes)."),
};

const productRef = {
  product_id: productId.optional()
    .describe("Argos product id: a 7-digit catalogue number (items[].product_id, e.g. 8377058) or a Trusted Seller item id (8 letters and digits)."),
  url: z.string().min(20).max(400).optional().describe("An Argos product link (https://www.argos.co.uk/product/<id>/)."),
};
const postcode = z.string().min(5).max(9).describe("A full UK postcode, any spacing or case, e.g. 'SW1A 1AA'.");
const maxDistance = z.number().int().min(1).max(50).optional().describe("Search radius in miles, 1 to 50 (default 50, as on Argos's product page).");
const maxResults = z.number().int().min(1).max(10).optional().describe("Stores, 1 to 10 (default 10, the most Argos returns).");

export function registerArgosTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/argos/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_argos",
    `Search Argos for prices, was prices, offers and badges: query, ${LIST_OUT}. 24 products per page, pages 1 to 200 (total_pages says how deep the list goes); narrow with filters. ${FILTERS} ${PRICES} ${STORE} ${NOT_AVAILABLE} ${CREDITS}`,
    {
      query: z.string().min(1).max(200).describe("Search text, e.g. 'air fryer'."),
      category: categoryField,
      offers,
      ...listFields,
    },
    post("search"),
  );

  server.tool(
    "get_argos_product",
    `One Argos product in full by product_id or link: product_id, requested_id, url, template (argos or trusted_seller), name, brand, seller, seller_name (Argos; null for Trusted Seller items, whose page names no seller), ean, price, was_price, save, offer_text, currency, badges [{badge, type, text, starts_at, ends_at}] (one entry per badge code, with the earliest start and latest end Argos gives), description, features (the specification lines), images, variants [{product_id, options, price}], special_offers [{id, title, description, starts_at, ends_at}], nectar_points, care_plans [{name, type, duration, price, excess, promotion}], payment_options [{provider, message, plans [{offering, months, apr}]}], argos_pay, bundles (frequently bought together [{product_id, name, price, url}]), breadcrumb [{name, category_id, url}], dimensions, energy_class, deliverable, collectable, delivery_price, free_delivery, fast_track, globally_out_of_stock, end_of_line, max_quantity, rating (null when the product has no reviews), review_count, recommended_percent, rating_distribution, secondary_ratings, question_count, answer_count, reviews (the first 10 as on the page; no reviewer names: get_argos_reviews pages them all). Trusted Seller items carry the fields their page shows (price, was price, description, images, breadcrumb, delivery). A withdrawn or unknown product answers 404 (charged); a Tu Clothing id (tuc...) answers 400 (Tu items have no product page on argos.co.uk). ${PRICES} ${STORE} ${CREDITS}`,
    productRef,
    post("product"),
  );

  server.tool(
    "get_argos_store_stock",
    `Argos store stock: whether 1 to 10 Argos products can be collected at the Argos stores near a UK postcode (nearest first), and delivered to a postcode. Returns postcode, delivery_postcode, max_distance, product_ids, count, stores [${STORE_OUT}, products [{product_id, state, available_from, message}]], delivery {postcode, products [{product_id, state, available_from, days, fast_track (Fast Track same-day delivery), message}]}, products [{product_id, known, collectable, deliverable, globally_out_of_stock}]. ${STATES} postcode is where stores are searched; delivery_postcode (default postcode) is where delivery is checked. Trusted Seller items are never stocked in stores (their ids answer 400). A malformed postcode or id answers 400 before anything is charged; a well-formed postcode that does not exist (e.g. ZZ99 9ZZ) gets no answer from Argos and ends in an unbilled 502 after about 50 seconds. ${CREDITS}`,
    {
      product_ids: z.union([z.string().min(7).max(200), z.array(productId).min(1).max(10)])
        .describe("1 to 10 Argos catalogue numbers (7 digits), as a list or comma-separated, e.g. ['8377058', '7163184']."),
      postcode,
      delivery_postcode: z.string().min(5).max(9).optional().describe("Postcode for home delivery availability (default: postcode)."),
      max_distance: maxDistance,
      max_results: maxResults,
    },
    post("store-stock"),
  );

  server.tool(
    "get_argos_stores",
    `Argos stores near a UK postcode (nearest first, up to 10 within 50 miles): postcode, max_distance, count, stores [${STORE_OUT}]; no stock (use get_argos_store_stock). Or one store by store (stores[].store): store_id, store, url, name, type, description, address {street, town, region, postcode, country}, latitude, longitude, phone (+44...), opening_hours (as Argos lists them), hours [{day, open, close}], special_hours [{date, open, close, closed}] (holiday and seasonal hours), services (e.g. Tu Collection Point). Send one of postcode or store. ${CREDITS}`,
    {
      postcode: postcode.optional(),
      store: z.string().min(3).max(200).optional()
        .describe("One store: stores[].store (the store's id and name, e.g. '661-manchester-arndale-argos') or its argos.co.uk/stores/... link. A bare store id is not accepted."),
      max_distance: maxDistance,
      max_results: maxResults,
    },
    post("stores"),
  );

  server.tool(
    "get_argos_reviews",
    `Customer reviews of one Argos product by product_id or link, up to 100 per page and every review reachable: product_id, sort, rating, page, limit, total (for the star filter), has_more, count, summary (Argos's own AI-generated summary of the reviews, labelled by summary_source), stats {product_name, review_count, average_rating, rating_distribution, recommended_percent, secondary_averages [{label, average}], first_review_at, last_review_at}, reviews [{id, rating, title, text, submitted_at, recommended, helpful_count, not_helpful_count, secondary_ratings, syndicated, syndication_source (the brand site a syndicated review came from), argos_colleague (written by an Argos colleague), badges, photos, reviewed_product_id, reviewed_product_name (reviews are shared across a product's colours and sizes), brand_response {count, department, date}}]. No reviewer name, location, age or gender is returned; a brand's reply is reported by presence and date only. ${CREDITS}`,
    {
      ...productRef,
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("newest (default), oldest, most_helpful (Argos's helpfulness order: the share of helpful votes, not their count), highest_rating, lowest_rating."),
      rating: z.union([z.number().int().min(1).max(5), z.array(z.number().int().min(1).max(5)).min(1).max(5)]).optional()
        .describe("Only reviews with these star ratings (one or a list), e.g. [1, 2]."),
      page: z.number().int().min(1).max(10_000).optional().describe("Page (page * limit up to total)."),
      limit: z.number().int().min(1).max(100).optional().describe("Reviews per page, 1 to 100 (default 20)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_argos_questions",
    `Customer questions about one Argos product (by product_id or link) with their answers: product_id, sort, page, limit, total, has_more, count, questions [{id, question, details, submitted_at, answer_count, answers [{id, text, submitted_at, source (staff: Argos's Q&A team, brand, or customer), best_answer, helpful_count, not_helpful_count}]}]. No asker or answerer names (a greeting's first name is cut). ${CREDITS}`,
    {
      ...productRef,
      sort: z.enum(QUESTION_SORTS).optional().describe("newest (default) or oldest."),
      page: z.number().int().min(1).max(10_000).optional().describe("Page."),
      limit: z.number().int().min(1).max(50).optional().describe("Questions per page, 1 to 50 (default 10)."),
    },
    post("questions"),
  );

  server.tool(
    "get_argos_categories",
    `Argos's department tree as its navigation shows it (14 departments): count, link_count, departments [{name, category_id, url, groups [{name, category_id, url, links [{name, category_id (for get_argos_category), url, url_filters (filters the link adds after the category, or null)}]}]}]. ${CREDITS}`,
    {},
    post("categories"),
  );

  server.tool(
    "get_argos_category",
    `One Argos category's products, 24 per page: category_id, query (optional text inside it), ${LIST_OUT}. ${FILTERS} ${PRICES} ${STORE} ${CREDITS}`,
    {
      category_id: z.union([z.string().min(3).max(12), z.number().int().positive()])
        .describe("Category id: get_argos_categories category_id (any level), the category facet's values, or the c:<id> of an argos.co.uk browse link (29560 Kettles, 29575 Air fryers)."),
      query: z.string().min(1).max(200).optional().describe("Optional text inside the category."),
      offers,
      ...listFields,
    },
    post("category"),
  );

  server.tool(
    "get_argos_deals",
    `Argos deal collections: black_friday (Argos's Black Friday deals), clearance and special_offers (Half Price, Save £X, multi-buys) as full lists, 24 per page with optional query, category, filters and sorts (${LIST_OUT}); or top_100, Argos's own Top 100 deals list (2 pages of 60, page only: collection, page, page_size, total, total_pages, has_more, count, items). ${PRICES} ${CREDITS}`,
    {
      collection: z.enum(COLLECTIONS).describe("black_friday, clearance, special_offers or top_100."),
      query: z.string().min(1).max(200).optional().describe("Optional text within the collection (top_100 takes page only)."),
      category: categoryField,
      ...listFields,
      page: z.number().int().min(1).max(200).optional().describe("Page: 24 products each, or 1 to 2 (60 each) for top_100."),
    },
    post("deals"),
  );

  server.tool(
    "get_argos_suggestions",
    `Argos's search suggestions for a partial query: query, count, suggestions [{text, weight (Argos's popularity weight)}], in Argos's order (not sorted by weight). ${CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'lego'."),
      limit: z.number().int().min(1).max(10).optional().describe("Suggestions, 1 to 10 (default 10)."),
    },
    post("suggestions"),
  );
}
