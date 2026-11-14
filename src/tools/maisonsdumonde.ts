import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/maisonsdumonde.ts (maisonsdumonde.com: fr,
// be fr / nl, lu, nl, de, es, it, pt, ch fr / de / it). Cross-field rules the
// backend enforces and zod here does not: language must be one the market
// serves (be fr / nl, ch fr / de / it, every other market its one language);
// product takes id or url; category takes category or category_url; store
// takes store_id or url; seller takes seller_id or url; seller and sold_by
// filters are fr, de, es and it only. No zod `.default()`: the MCP SDK would
// post a defaulted field on every call.

const COUNTRIES = ["fr", "be", "lu", "nl", "de", "es", "it", "pt", "ch"] as const;
const STORE_COUNTRIES = ["fr", "be", "de", "es", "it", "pt", "ch"] as const;
const MARKETPLACE_COUNTRIES = ["fr", "de", "es", "it"] as const;
const LANGUAGES = ["fr", "nl", "de", "es", "it", "pt"] as const;
const SORTS = ["relevance", "price_asc", "price_desc", "rating"] as const;
const REVIEW_SORTS = ["newest", "rating_desc", "rating_asc"] as const;
const EVENTS = ["black_friday", "second_chance"] as const;

const CHARGE = "Costs 1 credit. Failed upstream calls are not charged; a not-found is charged.";
const MARKETS =
  "Markets (country, default fr): fr (EUR, French), be (EUR, fr or nl), lu (EUR, fr), nl (EUR, nl), de (EUR, de), es (EUR, es), it (EUR, it), pt (EUR, pt), ch (CHF, fr, de or it). Maisons du Monde closed its Austrian store in 2026 and its UK business in 2023: at and gb answer 400 before anything is charged. Data comes in the request language; every answer carries country, language and currency.";
const PRICES =
  "Prices are numbers in the market's currency, never converted (Switzerland is priced separately in CHF; the euro markets share one price per product, measured on 2026-11-14 on 4 products). price is what the site charges now; was_price is the crossed-out price shown next to a discount; discount_percent is the page's own percent off; eco_participation is the French furniture recycling fee included in the price (fr only). Maisons du Monde shows no 30-day lowest price and no price history: poll for changes.";
const ITEM =
  "position, id (digits for Maisons du Monde items, M + digits for marketplace items), name, collection, brand, url, image, price, was_price, discount_percent, currency, eco_participation (fr), badges (e.g. BLACK FRIDAY, Nouveau, Seconde Chance), rating, review_count, color_count, sold_by (mdm or marketplace), offer_id (marketplace), sponsored (true for sponsored marketplace tiles), condition (second-hand items), store_only and purchase_status";
const GRID = `40 items per page with ${ITEM}. Also count (organic items on the page; sponsored tiles are flagged and not counted), sponsored_count, total (exact), page, page_size, total_pages, sort, sorts_offered, requested_filters, applied_filters and facets (id, name, type, options with id, label and count, or a min / max range; the ids are what color, material, style, brand, seller and filters take).`;

const country = (markets: readonly string[], scope: string) =>
  z.enum(markets as unknown as [string, ...string[]]).optional()
    .describe(`Maisons du Monde market (default fr). ${scope}`);
const language = () => z.enum(LANGUAGES).optional()
  .describe("Language of the market's site (default its first): be fr or nl, ch fr, de or it; every other market has one language (fr and lu fr, nl nl, de de, es es, it it, pt pt). A language the market does not serve answers 400.");

const optionIds = (example: string, what: string) =>
  z.union([z.string(), z.array(z.string()).max(5)]).optional()
    .describe(`1 to 5 ${what} option ids (facets[].options[].id of that facet), e.g. '${example}'.`);

const gridFields = {
  page: z.number().int().min(1).max(250).optional()
    .describe("Results page, 1-based, 40 items per page. The site lists at most 250 pages; a page past the last returns no items and a note."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price_asc, price_desc or rating (customer rating). The site has no newest, best-seller or discount sort."),
  price_min: z.number().min(0).optional().describe("Lowest price, in the market's currency."),
  price_max: z.number().min(0).optional().describe("Highest price, in the market's currency."),
  on_sale: z.boolean().optional().describe("Only discounted items."),
  min_discount: z.union([z.literal(20), z.literal(30), z.literal(40), z.literal(50)]).optional()
    .describe("Only items at least this many percent off: 20, 30, 40 or 50."),
  in_stock: z.boolean().optional().describe("Only items in stock online."),
  min_rating: z.union([z.literal(3), z.literal(4), z.literal(5)]).optional()
    .describe("Customer rating: 5 = five stars only, 4 / 3 = that many stars and up."),
  color: optionIds("n9660c0e9e5310638a19012509703a483cebdb2b", "color (facet c)"),
  material: optionIds("nb8ebc86a80d334b9b406d1550e82ed18f33a77f", "material (facet f)"),
  style: optionIds("c56c1d2a7f9948cc83b776aed8b5c477", "style (facet st)"),
  brand: optionIds("BRAND_MAISONS_DU_MONDE", "brand (facet bra)"),
  seller: z.string().min(2).max(60).optional()
    .describe("One marketplace seller's items: seller.code from get_maisonsdumonde_seller or a Seller facet (se) option id, e.g. 'BESTMOBILIER'. fr, de, es and it only."),
  sold_by: z.enum(["mdm"]).optional()
    .describe("mdm: only items sold by Maisons du Monde itself (not marketplace sellers). fr, de, es and it only (elsewhere every item is)."),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional()
    .describe("Any other facet of the answer, keyed by facets[].id with facets[].options[].id values, e.g. {\"nbs\": [\"CAPACITY_2_places\"]}; dimension ranges (dd, dh, dw) as \"min-max\" in cm."),
};

const ALL_SCOPE = "All 9 markets: fr, be, lu, nl, de, es, it, pt, ch.";
const STORE_SCOPE = "fr, be, de, es, it, pt or ch (the store finder answers no stores on nl and lu).";
const MARKETPLACE_SCOPE = "fr, de, es or it (marketplace sellers exist there only).";

export function registerMaisonsdumondeTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/maisonsdumonde/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_maisonsdumonde",
    `Search Maisons du Monde (furniture and home decor) by keyword, sorted by price or customer rating and filtered by price range, discount, stock, rating, color, material, style, brand, marketplace seller or any facet. A keyword that names a category answers that category's grid and says so in redirected_to (type, category_id, name, url). ${GRID} The German site does not sort keyword results: on de a sorted search comes back in relevance order with a note (sort works on category and deals). ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, in the market's language, e.g. 'table' (fr), 'canape' (ch fr), 'couchtisch' (de)."),
      country: country(COUNTRIES, ALL_SCOPE),
      language: language(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_maisonsdumonde_product",
    `One Maisons du Monde product by reference or product URL: id, gtin13, name, collection, brand, url, price, was_price, discount_percent, currency, eco_participation (fr), badges, stock (status and the exact online quantity), store_only, sold_by, seller (marketplace items: id, name, url, rating, orders, member_since), offer_id, condition, variants (dimension color / model / package, value, name, id, url, price_difference against this item), dimensions, weight, materials (main, other), made_in, characteristics, composition, attributes, wood_and_finishes, assembly, care, documents (dimension sheet and assembly notice PDFs), images, breadcrumbs, categories, short_description, description, rating, review_count, review_summary (the summary of customer reviews the page shows), questions (the page's questions and answers) and markets (the same product on every other market: country, language, url). An unknown product, or one not sold in that market, is a charged 404. Home delivery and store stock: get_maisonsdumonde_availability; reviews: get_maisonsdumonde_reviews. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      id: z.string().min(4).max(12).optional()
        .describe("A product reference (items[].id): digits for Maisons du Monde items, e.g. '186339', or M + digits for marketplace items, e.g. 'M24132196'."),
      url: z.string().min(10).max(1000).optional()
        .describe("A product page of any market (alternative to id; its market and language are used unless country / language are sent)."),
      country: country(COUNTRIES, ALL_SCOPE),
      language: language(),
    },
    post("product"),
  );

  server.tool(
    "get_maisonsdumonde_category",
    `One Maisons du Monde category's products by category hash or category URL (send one), with the search sorts and filters. The hash is the same on every market, so a URL from any market works on any other. ${GRID} Also category (id, name, url, breadcrumbs). An unknown category is a charged 404. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      category: z.string().min(32).max(200).optional()
        .describe("A category hash (the end of a /c/ URL, the same on every market), optionally with its name, e.g. 'canapes-n4dc562d7bb509362a3a2102db4cbf90b6454f1f', or redirected_to.category_id of a search."),
      category_url: z.string().min(10).max(1000).optional()
        .describe("A category page of any market (filters in it are kept); fetched on country / language when sent, else on the URL's own market."),
      country: country(COUNTRIES, ALL_SCOPE),
      language: language(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_maisonsdumonde_deals",
    `A Maisons du Monde sale event's products: black_friday (default, on every market while it runs) or second_chance (fr only: used and returned items, condition per item); or send category / category_url instead for that category's discounted items (on_sale unless min_discount is sent). Same sorts and filters as search. ${GRID} Also event (type, name, url, category_id). An event that is not running is a charged 404. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      event: z.enum(EVENTS).optional()
        .describe("black_friday (default; every market while it runs) or second_chance (fr only)."),
      category: z.string().min(32).max(200).optional()
        .describe("A category hash: answers its discounted items instead of an event."),
      category_url: z.string().min(10).max(1000).optional()
        .describe("A category page of any market: answers its discounted items instead of an event."),
      country: country(COUNTRIES, ALL_SCOPE),
      language: language(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_maisonsdumonde_reviews",
    `A Maisons du Monde product's customer reviews: product_id, sort, rating, review_count, rating_histogram (5 to 1), criteria (average per criterion when the site shows one) and reviews (rating, text, date, author as the display name shown, country, source_market, syndicated, criteria scores such as style, value for money and comfort, brand_reply, images), plus next_cursor for the next page. Reviews are pooled across every Maisons du Monde market and shown translated into the request language (source_market is where a review was written). Sorted newest, rating_desc or rating_asc; the site has no star filter. Reviews carry no id, title or verified flag. A product with no reviews (or a marketplace item, whose reviews the site does not list) is a charged 404. ${MARKETS} ${CHARGE}`,
    {
      id: z.string().min(4).max(12)
        .describe("A Maisons du Monde product reference (product id), e.g. '186339'."),
      country: country(COUNTRIES, ALL_SCOPE),
      language: language(),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("newest (default), rating_desc or rating_asc."),
      cursor: z.string().min(8).max(600).optional()
        .describe("next_cursor of the previous answer, for the next page (keep the same sort)."),
      limit: z.number().int().min(1).max(30).optional()
        .describe("Reviews per page, 1 to 30 (default 10)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_maisonsdumonde_stores",
    `Up to 10 Maisons du Monde stores nearest a postcode: postcode, count and stores with id, name, address, postcode, city, country, lat, lng, distance_km, url, open_now, hours (per day, opening slots) and click_collect (the store's pickup service level). Call get_maisonsdumonde_store for the phone and services, and get_maisonsdumonde_availability with a store id for an item's stock there. Markets: ${STORE_SCOPE} ${CHARGE}`,
    {
      postcode: z.string().min(4).max(10)
        .describe("A postcode of the market: 5 digits on fr / de / es / it (e.g. '75011'), 4 on be / ch, 1000-001 on pt."),
      country: country(STORE_COUNTRIES, STORE_SCOPE),
      language: language(),
      limit: z.number().int().min(1).max(10).optional()
        .describe("Stores to return, nearest first (1 to 10, default 10)."),
    },
    post("stores"),
  );

  server.tool(
    "get_maisonsdumonde_store",
    `One Maisons du Monde store by store id or store page URL (send one): id, name, address, postcode, city, country, phone, lat, lng, url, hours (every day of the week, opening slots), services (as the store page lists them, e.g. click and collect, decoration services, furniture assembly), click_collect and hours_today (by id). Markets: ${STORE_SCOPE} ${CHARGE}`,
    {
      store_id: z.string().min(1).max(8).optional()
        .describe("A store id (stores[].id of get_maisonsdumonde_stores) of the market in country, e.g. '41'."),
      url: z.string().min(10).max(1000).optional()
        .describe("A store page (stores[].url), alternative to store_id."),
      country: country(STORE_COUNTRIES, STORE_SCOPE),
      language: language(),
    },
    post("store"),
  );

  server.tool(
    "get_maisonsdumonde_availability",
    `One Maisons du Monde item's stock at one store plus the market's delivery options: product_id, store (id, name, postcode, city), in_stock, quantity (the store's stock count), stock_text (the site's own wording), display_model (only the display piece is in store), click_collect and on_shelf (available, the site's texts) and delivery (type home, store_pickup or in_store: title, available, availability_text, from_price, currency, price_text). Home delivery is a from-price per product and market; the exact cost for a postcode is only shown in the cart and is not returned. Marketplace items are not stocked in stores. Get the store id from get_maisonsdumonde_stores. Markets: ${STORE_SCOPE} ${CHARGE}`,
    {
      id: z.string().min(4).max(12)
        .describe("A Maisons du Monde item reference (digits; marketplace items are not stocked in stores), e.g. '204172'."),
      store_id: z.string().min(1).max(8)
        .describe("A store id from get_maisonsdumonde_stores (stores[].id), e.g. '125'."),
      country: country(STORE_COUNTRIES, STORE_SCOPE),
      language: language(),
    },
    post("availability"),
  );

  server.tool(
    "get_maisonsdumonde_seller",
    `A Maisons du Monde marketplace seller by seller id or seller URL (send one): seller (id, name, code for the seller filter of search, url, rating, review_count, orders, member_since, order_approval, shipping zone, delay, types and policy, returns, company_city, description) plus the seller's catalog as a grid (sort as search). ${GRID} Markets: ${MARKETPLACE_SCOPE} ${PRICES} ${CHARGE}`,
    {
      seller_id: z.string().min(1).max(8).optional()
        .describe("A marketplace seller id (a product's seller.id), e.g. '2066'."),
      url: z.string().min(10).max(1000).optional()
        .describe("A seller page (seller.url), alternative to seller_id."),
      country: country(MARKETPLACE_COUNTRIES, MARKETPLACE_SCOPE),
      language: language(),
      page: gridFields.page,
      sort: gridFields.sort,
    },
    post("seller"),
  );
}
