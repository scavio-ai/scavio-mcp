import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/hema.ts (HEMA webshops nl, be (nl / fr), fr, de;
// HEMA stores also in lu and at). Cross-field rules the backend enforces and zod here
// does not: language only for be (nl or fr; de takes de or nothing); product takes
// exactly one of sku or url; stores and store-stock take query or lat + lng, not both
// (neither = the whole country); price_min must not be above price_max. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SHOP_COUNTRIES = ["nl", "be", "fr", "de"] as const;
const STORE_COUNTRIES = ["nl", "be", "fr", "de", "lu", "at"] as const;
const LANGUAGES = ["nl", "fr", "de"] as const;
const SORTS = ["relevance", "price_asc", "price_desc", "newest", "best_selling"] as const;
const REVIEW_SORTS = ["newest", "highest"] as const;

const NAME = "HEMA (hema.com, the Dutch variety store; not the chemical HEMA, hydroxyethyl methacrylate)";
const STORE = `${NAME} on its four webshops: nl (www.hema.nl), be in Dutch or French, fr and de. Names, labels and promotion texts come in the market's language as HEMA writes them (Dutch on the default nl market); prices are numbers in EUR. Article numbers (sku) are the same in every market; prices are set per market, so price one article on each market you report. HEMA notes that online prices can differ from store prices.`;
const CREDITS = "Costs 1 credit. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NOT_AVAILABLE = "Not available: price history (poll and store the answers), brands (HEMA sells its own brand), checkout or ordering, the photo service and cake ordering, other countries (no UK or Spain).";
const MARKET_OUT = "country, language, market (e.g. nl-nl), currency";
const ITEM =
  "sku (the input of get_hema_product), name, url, image, price, was_price (HEMA's struck-through price, as shown), price_from (true when HEMA shows a from-price across sizes or colours), currency, discount_percent (computed by Scavio from was_price), promotion (HEMA's promotion text as it writes it, e.g. 2+1 gratis), labels, product_type, colour, sizes, stock_status (as HEMA marks it), online {available, limited_stock, variants [{sku, available}]}, rating";
const FACETS = "facets [{facet (the key to send in filters), name, values [{value, count}], min, max (price)}]";
const LIST = `${MARKET_OUT}, filters, new_only, price_min, price_max, redirected_to (the page HEMA sent the request to, or null), list_type (grid, or landing for a campaign page: its product carousels, no paging), title, sort, page, page_size, total, total_pages, has_more, count, items (${ITEM}), ${FACETS}`;
const STORE_FIELDS =
  "store_id, name, status (open, renovation), operator (hema or franchise), address {street, postcode, city, country_code}, latitude, longitude, distance_km (from the place asked, nearest first), phone, hours [{day, open, close}], special_hours [{date, type, open, close}], closed_dates, services";
const STOCK =
  "stock [{sku, sellable_units (the sellable units HEMA's store service reports for that store; null when it lists none), stock_level (full, regular or limited, as HEMA gives it), stock_indicator, shelf_locations, in_stock}]";
const STOCK_NOTE = "Stock is as HEMA's store service reports it, not a promise that the shelf has it.";

const shopCountry = z.enum(SHOP_COUNTRIES).optional()
  .describe("The HEMA webshop (default nl): nl (Netherlands, www.hema.nl), be (Belgium: language nl or fr), fr (France) or de (Germany). lu and at have HEMA stores but no webshop: only the stores, store and store-stock tools serve them.");
const language = z.enum(LANGUAGES).optional()
  .describe("For be: nl (default) or fr. The other countries have one language: leave it out (another language answers 400, not charged).");
const market = { country: shopCountry, language };
const storeMarket = {
  country: z.enum(STORE_COUNTRIES).optional()
    .describe("nl (default), be, fr, de, lu (Luxembourg) or at (Austria): every country with HEMA stores."),
  language,
};
const sku = z.union([z.string().min(5).max(40), z.number().int().positive()]);

const listFields = {
  sort: z.enum(SORTS).optional()
    .describe("relevance (default, HEMA's own order), price_asc, price_desc, newest or best_selling. A tile with a from-price (price_from) is placed by one of its variants' prices, so a price sort is not always strictly ordered by the price shown."),
  page: z.number().int().min(1).max(100).optional().describe("Page (24 products a page); total_pages says how deep the list goes."),
  filters: z.record(z.string(), z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).min(1).max(10)])).optional()
    .describe('Up to 6 facets: { "<facets[].facet>": "<facets[].values[].value>" or [values] } (e.g. size, maincolour, producttype, ref_gender; searchable for online stock), e.g. { "maincolour": "zwart" }. Values are in the market\'s language, as facets lists them.'),
  new_only: z.boolean().optional().describe("Only HEMA's new collection."),
  price_min: z.number().min(0).max(10_000).optional().describe("Lowest price (EUR)."),
  price_max: z.number().min(0).max(10_000).optional().describe("Highest price (EUR)."),
};
const { new_only: _no, ...newListFields } = listFields;

const location = {
  query: z.string().min(1).max(100).optional()
    .describe("A city, town or postcode, e.g. Utrecht (HEMA's own store finder places it; a place it cannot find is a charged 404). Leave query and lat / lng out for the whole country."),
  lat: z.number().min(-90).max(90).optional().describe("Or latitude (with lng)."),
  lng: z.number().min(-180).max(180).optional().describe("Longitude (with lat)."),
  radius_km: z.number().int().min(1).max(300).optional().describe("Search radius around the place in km (default 50, as HEMA's site uses)."),
};

export function registerHemaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/hema/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_hema",
    `Search ${NAME}, 24 products a page with total and total_pages: query, ${LIST}. Sorts relevance, price_asc, price_desc, newest, best_selling; filters from facets, new_only, price_min, price_max. HEMA sends some words to a category or campaign page (e.g. kerst): redirected_to names it and a landing page comes back as its product carousels. A search with no match answers 200 with total 0. ${STORE} ${NOT_AVAILABLE} ${CREDITS}`,
    {
      query: z.string().min(1).max(200).describe("Search text (the market's language works best: sokken, kaars, bougie, Kerze)."),
      ...market,
      ...listFields,
    },
    post("search"),
  );

  server.tool(
    "get_hema_product",
    `One ${NAME} product in full on one market, by article number or link: requested, ${MARKET_OUT}, sku, ean, name, description, url, status, product_type, parent_sku, images, breadcrumbs, colour, size, main_material, specifications [{key, name, value}], care, safety, nutrition, storage, price, was_price, currency, discount_percent (computed by Scavio from was_price), unit_price {price, unit}, promotion {label (HEMA's mechanic as it writes it, e.g. 2+1 gratis), loyalty_card_only, valid_from, valid_to}, price_schedule [{valid_from, valid_to, price, was_price, promotion, loyalty_card_only, unit_price}] (HEMA's dated prices, upcoming promotions included; valid_to null = open-ended), online_stock {type (LIMITED or UNLIMITED), units}, sellable_in_store, order_limit {min, max, step}, sales_blocked, availability, labels [{text, type, valid_from, valid_to}], variants {variant_axis, group_axis, groups [{value, label, colour_code, url, variants [{sku, label, in_stock, status, url}]}]}, fulfillment, personalizable, complete (false when only part of the page could be read). An article number HEMA does not have is a charged 404. For stock per store use get_hema_store_stock. ${STORE} ${CREDITS}`,
    {
      sku: sku.optional()
        .describe("HEMA article number: items[].sku (6 to 8 digits, the same in every market), e.g. 15300147, or a colour group id (e.g. 4230175BLACK). Send one of sku or url."),
      url: z.string().min(15).max(600).optional()
        .describe("Or a HEMA product link (www.hema.nl or www.hema.com/<locale>/...); the market comes from the link."),
      ...market,
    },
    post("product"),
  );

  server.tool(
    "get_hema_category",
    `One ${NAME} category's products by path or link, with filters, sort and paging: category, ${LIST}. ${STORE} ${CREDITS}`,
    {
      category: z.string().min(1).max(400)
        .describe("A category path (get_hema_categories categories[].path, e.g. baby/babykleding) or its HEMA link."),
      ...market,
      ...listFields,
    },
    post("category"),
  );

  server.tool(
    "get_hema_categories",
    `${NAME}'s category menu on one market (13 to 18 departments, 3 levels): ${MARKET_OUT}, depth, count, node_count, categories [{name, path (the input of get_hema_category), url, level, child_count, children}]. Names are in the market's language. ${CREDITS}`,
    { ...market, depth: z.number().int().min(1).max(3).optional().describe("Levels to return, 1 to 3 (default 3).") },
    post("categories"),
  );

  server.tool(
    "get_hema_new_arrivals",
    `${NAME}'s new collection on one market (about 550 to 1,100 products), with sort, paging and filters: path, ${LIST}. ${STORE} ${CREDITS}`,
    { ...market, ...newListFields },
    post("new-arrivals"),
  );

  server.tool(
    "get_hema_sale",
    `${NAME}'s sale page (nl) or outlet page (be, de: lasting price cuts), with sort, paging and filters: path, ${LIST}. France has no sale page (a 400, not charged). ${STORE} ${CREDITS}`,
    {
      country: z.enum(["nl", "be", "de"]).optional()
        .describe("nl (default, the sale page), be or de (the outlet page). France has no sale page."),
      language,
      ...listFields,
    },
    post("sale"),
  );

  server.tool(
    "get_hema_offers",
    `${NAME}'s weekly offers page (nl, be): ${MARKET_OUT}, path, title, label (HEMA's validity text as shown, e.g. geldig t/m 22 november), valid_to (ISO date: the label has no year, Scavio takes the nearest one), week (HEMA's offer week number), section_count, count, sections [{name, week, cards [{title, subtitle, url, category (the input of get_hema_category: the promotion's product list)}]}]. The offers page lists promotion cards, not products: each product's mechanic and dates are on the product lists (promotion) and get_hema_product (promotion, price_schedule). fr and de have no offers page (a 400, not charged). ${CREDITS}`,
    {
      country: z.enum(["nl", "be"]).optional().describe("nl (default) or be: the two markets with HEMA's weekly offers page."),
      language: z.enum(["nl", "fr"]).optional().describe("For be: nl (default) or fr."),
    },
    post("offers"),
  );

  server.tool(
    "get_hema_campaign",
    `A ${NAME} campaign page with its products and promotion texts: christmas on every market, sinterklaas on nl and be, or a campaign slug: campaign, slug, ${LIST}, carousels [{title, link, count, skus}]. ${STORE} ${CREDITS}`,
    {
      campaign: z.string().min(2).max(400)
        .describe("christmas (all markets), sinterklaas (nl and be), a campaign slug (kerst, noel, weihnachten, saint-nicolas) or its HEMA link."),
      ...market,
    },
    post("campaign"),
  );

  server.tool(
    "get_hema_suggestions",
    `${NAME}'s search suggestions for a partial query: ${MARKET_OUT}, query, count, total_results, phrases, categories [{name, product_count, url, category}], products [{sku, name, url, image, price, currency}] (up to 5), terms [{term, count, corrected}], content [{name, url}]. ${CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. kerst."),
      ...market,
    },
    post("suggestions"),
  );

  server.tool(
    "get_hema_store_stock",
    `HEMA store stock: in-store stock of up to 12 ${NAME} articles in the stores near a city, postcode or point (or across a country), in the Netherlands, Belgium, France, Germany, Luxembourg and Austria. Per store the sellable units HEMA's store service reports and the stock level (full, regular or limited): country, country_code, skus, location {query, formatted_address, postcode, city, latitude, longitude}, radius_km, limit, in_stock_only, count, summary [{sku, stores_with_stock}], stores [{${STORE_FIELDS}, ${STOCK}}]. ${STOCK_NOTE} Pair it with get_hema_product for the article's dated promotion. Send query or lat + lng, not both. ${CREDITS}`,
    {
      skus: z.array(sku).min(1).max(12)
        .describe("1 to 12 article numbers of one size and colour (items[].sku or variants[].sku; leading zeros are dropped), e.g. ['15300147', '10860090']."),
      ...storeMarket,
      ...location,
      limit: z.number().int().min(1).max(50).optional().describe("Stores to return, 1 to 50 (default 10)."),
      in_stock_only: z.boolean().optional().describe("Only stores that hold at least one of the articles."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_hema_stores",
    `${NAME} stores of one country (about 570 in nl, 111 be, 69 fr, 17 de, 5 at, 4 lu), or the ones near a city, postcode or point: country, country_code, location, radius_km, limit, count, stores [{${STORE_FIELDS}}]. Send query or lat + lng, not both, or neither for the whole country. ${CREDITS}`,
    {
      ...storeMarket,
      ...location,
      limit: z.number().int().min(1).max(1000).optional()
        .describe("Stores to return (default 20 near a place, every store of the country without one, up to 1000)."),
    },
    post("stores"),
  );

  server.tool(
    "get_hema_store",
    `One ${NAME} store by id: store_id, name, status, operator, address, latitude, longitude, phone, hours, special_hours, closed_dates, services, delivery_address, country, sku, stock (with sku: {sku, sellable_units, stock_level, stock_indicator, shelf_locations, in_stock}, as HEMA's store service reports it, not a promise that the shelf has it). Works for stores in every HEMA country (nl, be, fr, de, lu, at). A store id HEMA does not know is a charged 404. ${CREDITS}`,
    {
      store_id: z.union([z.string().min(1).max(4), z.number().int().min(1).max(9999)])
        .describe("A HEMA store id (stores[].store_id, up to 4 digits), e.g. 0013."),
      sku: sku.optional().describe("An article number: adds that article's stock in this store."),
    },
    post("store"),
  );

  server.tool(
    "get_hema_reviews",
    `Customer reviews of one ${NAME} article, from HEMA's own product reviews: ${MARKET_OUT}, sku, review_pool (nl-nl or nl-be: the nl, fr and de webshops show the shared Dutch pool; be has its own Belgian pool), review_pool_note, sort, page, offset, page_size, total_text_reviews, total_pages, has_more, average_rating, total_ratings (star ratings, with or without text), ratings_only, recommended, not_recommended, rating_distribution, count, reviews [{review_id, language, rating, title, text, submitted_at, experienced_on, recommends, syndicated, verified_purchaser, badges, helpful_votes, not_helpful_votes}]. No reviewer name or any reviewer identity is returned. Slower than the other tools (15 to 70 s). ${CREDITS}`,
    {
      sku: sku.describe("HEMA article number (items[].sku), e.g. 10860090."),
      ...market,
      sort: z.enum(REVIEW_SORTS).optional().describe("newest (default) or highest (highest rating first)."),
      page: z.number().int().min(1).max(5).optional()
        .describe("1 = the first 8 reviews, each later page the next 30 (as HEMA's show-more loads them), up to 5."),
    },
    post("reviews"),
  );
}
