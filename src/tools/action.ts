import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/action.ts (action.com: 19 storefronts in 16
// countries, `country` + `language` where a country has two or three). Cross-field
// rules the backend enforces and zod here does not: language must be one the
// country serves (be nl / fr, ch de / fr / it, every other country its one
// language); product takes exactly one of product_code or url; stores one of
// query or lat + lng; store one of store or store_id; webshop search one of query
// or category; webshop product one of ean or url; reviews scope all needs
// offset + limit <= 100. No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const COUNTRIES = ["nl", "be", "fr", "lu", "de", "at", "ch", "it", "es", "pt", "pl", "cz", "sk", "ro", "hr", "si"] as const;
const LANGUAGES = ["nl", "fr", "de", "it", "es", "pt", "pl", "cs", "sk", "ro", "hr", "sl"] as const;
const REVIEW_COUNTRIES = ["nl", "de", "fr", "pl"] as const;
const SORTS = ["relevance", "price_asc", "price_desc", "newest"] as const;
const REVIEW_SORTS = ["relevant", "newest", "oldest", "highest", "lowest"] as const;
const REVIEW_SCOPES = ["local", "international", "all"] as const;

const NAME = "Action (action.com, the European non-food discount store; not Action S.A., the Polish IT distributor)";
const STORE = `${NAME} on 19 storefronts in 16 countries. Titles, descriptions and labels come in the storefront's language, as Action writes them (Dutch on the default nl storefront); prices are numbers in the market's currency (EUR, CHF on ch, PLN on pl, CZK on cz, RON on ro), never converted. Article numbers (product_code) are the same in every market; prices are set per market, so price one article on each market you report.`;
const MARKETS =
  "nl (Netherlands), be (Belgium: language nl or fr), fr (France), lu (Luxembourg), de (Germany), at (Austria), ch (Switzerland: language de, fr or it), it (Italy), es (Spain), pt (Portugal), pl (Poland), cz (Czechia), sk (Slovakia), ro (Romania), hr (Croatia), si (Slovenia)";
const CREDITS = "Costs 1 credit. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_STOCK = "Action does not publish store stock.";
const NOT_AVAILABLE = "Not available: store stock (Action does not publish it), price history (poll and store the answers), leaflets, checkout, other countries.";
const MARKET_OUT = "country, language, market (the storefront, e.g. nl-nl), currency";
const DEAL = "deal {label (Action's validity label, e.g. 18-11 t/m 24-11), valid_from, valid_to (ISO dates; the label has no year, Scavio adds the nearest one), loyalty_card (an Action Plus card deal, Belgium), loyalty_label}";
const ITEM = `product_code, title, description, url, image, brand, price, regular_price (Action's struck-through price, as shown), currency, unit_price (as shown, e.g. € 1,00/m), discount_percent (computed by Scavio from regular_price), price_note (Action's note on the struck-through price, e.g. the EU 30-day lowest price in Poland), available, is_new, is_deal, ${DEAL}, labels [{code (deal, new, sustainable_choice, loyalty_card_deal), label, note}], rating, review_count, energy_label, has_warnings`;
const FACETS = "facets [{facet (category, price_range, brand, new), input (the field to send a value back in), name, values [{name, value, count, selected}]}]";
const LIST = `${MARKET_OUT}, title, filters, sort, page, page_size, total, total_pages, has_more, count, items (${ITEM}), ${FACETS}`;

const country = z.enum(COUNTRIES).optional().describe(`The Action storefront's country (default nl): ${MARKETS}.`);
const language = z.enum(LANGUAGES).optional()
  .describe("The storefront's language where a country has more than one: be nl (default) or fr; ch de (default), fr or it. Other countries have one language: leave it out (another language answers 400, not charged).");
const market = { country, language };
const code = z.union([z.string().min(6).max(8), z.number().int().positive()]);

const listFields = {
  sort: z.enum(SORTS).optional().describe("relevance (default, Action's own order), price_asc, price_desc or newest."),
  page: z.number().int().min(1).max(200).optional().describe("Page (24 products a page, 23 on weekly deals); total_pages says how deep the list goes."),
  category_filter: z.string().min(1).max(120).optional()
    .describe("Narrow to one department: a value of facets[facet=category].values[].value (in the storefront's language, e.g. Hobby)."),
  price_range: z.string().min(1).max(20).optional()
    .describe("A price band: a value of facets[facet=price_range].values[].value (e.g. 2-5, <1, >20; the bands follow the market's currency)."),
  brand_filter: z.string().min(1).max(120).optional()
    .describe("Narrow to one brand: a value of facets[facet=brand].values[].value (e.g. Disney)."),
  new_only: z.boolean().optional().describe("New products only (Action's Nieuw / Neu label)."),
};
const { brand_filter: _bf, ...brandListFields } = listFields;
const { new_only: _no, ...newListFields } = listFields;

const webshopMarket = {
  country: z.enum(["nl", "be"]).optional()
    .describe("nl (default) or be: the Action webshop (shop.action.com) serves nl-nl, nl-be and fr-be only."),
  language: z.enum(["nl", "fr"]).optional().describe("For be: nl (default) or fr."),
};

export function registerActionTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/action/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_action",
    `Search ${NAME}, 24 products a page with total and total_pages: query, ${LIST}. Sorts relevance, price_asc, price_desc, newest; filters category_filter, price_range, brand_filter, new_only (values from facets). A search with no match answers 200 with total 0. ${STORE} ${NOT_AVAILABLE} ${CREDITS}`,
    {
      query: z.string().min(1).max(200).describe("Search text (the storefront's language works best: kerst, weihnachten, noel, opbergbox)."),
      ...market,
      ...listFields,
    },
    post("search"),
  );

  server.tool(
    "get_action_product",
    `One ${NAME} product in full on one market, by article number or link: requested, ${MARKET_OUT}, ${ITEM}, images, brand_info {name, brand_id, own_brand, slug, url}, long_description, highlights, specifications [{name, value}], aisle (the store aisle Action names), deposit, category {name, path, url}, subcategory, related_categories, sustainability {title, certifications}, warning_label, hazards {biocide, dangerous_good, plant_protection}, availability (in stock online as Action marks it), related [{product_code, title, url, image, price, regular_price, is_deal}]. An article the market does not sell is a charged 404. No EAN here (EANs are on get_action_webshop_product). ${NO_STOCK} ${STORE} ${CREDITS}`,
    {
      product_code: code.optional()
        .describe("Action article number: items[].product_code (7 digits, the same code in every market), e.g. 3225277. Send one of product_code or url."),
      url: z.string().min(20).max(500).optional()
        .describe("An action.com product link (https://www.action.com/<market>/p/<code>/<name>/); the market comes from the link."),
      ...market,
    },
    post("product"),
  );

  server.tool(
    "get_action_products",
    `Up to 60 ${NAME} articles priced on one market in one request: requested, ${MARKET_OUT}, count, not_sold (codes the market does not sell), items (${ITEM}). To compare one article's price across markets, call once per country with the same product_codes. None sold: a charged 404. ${STORE} ${CREDITS}`,
    {
      product_codes: z.array(code).min(1).max(60)
        .describe("1 to 60 Action article numbers (items[].product_code), e.g. ['3225277', '3011615']."),
      ...market,
    },
    post("products"),
  );

  server.tool(
    "get_action_weekly_deals",
    `This week's ${NAME} deals on one market (about 130 to 190; a deal week runs Wednesday to Tuesday, the same week everywhere, and the assortment changes weekly): week_id (Action's week id, e.g. Promo2026Week47), label (as shown), valid_from, valid_to (ISO dates: the label has no year, Scavio takes it from the week id), loyalty_deals (Belgium: Action Plus card deals the page shows beside the grid, items with deal.loyalty_card), ${LIST}. 23 deals a page. regular_price is the price outside the deal. ${STORE} ${CREDITS}`,
    { ...market, ...listFields },
    post("weekly-deals"),
  );

  server.tool(
    "get_action_category",
    `One ${NAME} category's products by path, with filters, sort and paging: category, ${LIST}. ${STORE} ${CREDITS}`,
    {
      category: z.string().min(1).max(300)
        .describe("A category path (get_action_categories categories[].path, e.g. wonen or wonen/woonaccessoires) or its action.com/<market>/c/... link."),
      ...market,
      ...listFields,
    },
    post("category"),
  );

  server.tool(
    "get_action_categories",
    `${NAME}'s category tree on one market (15 departments, about 300 categories in 3 levels): ${MARKET_OUT}, depth, count, node_count, categories [{category_id, name, path (the input of get_action_category), url, level, child_count, children}]. Names are in the storefront's language. ${CREDITS}`,
    { ...market, depth: z.number().int().min(1).max(3).optional().describe("Levels to return, 1 to 3 (default 3).") },
    post("categories"),
  );

  server.tool(
    "get_action_brand",
    `One brand's products on ${NAME}, with sort, paging and filters: brand, ${LIST}. ${STORE} ${CREDITS}`,
    {
      brand: z.string().min(1).max(300)
        .describe("A brand: get_action_brands brands[].slug or a product's brand_info.slug (e.g. max-more, magic-village) or its action.com/<market>/brand/<slug>/ link."),
      ...market,
      ...brandListFields,
    },
    post("brand"),
  );

  server.tool(
    "get_action_brands",
    `${NAME}'s own brands (about 54 private labels, e.g. Max & More, Magic Village) as its own-brands page lists them: ${MARKET_OUT}, query, total_brands, count, brands [{name, slug (the input of get_action_brand), url, image}]. ${CREDITS}`,
    { ...market, query: z.string().min(1).max(60).optional().describe("Brands whose name contains this text.") },
    post("brands"),
  );

  server.tool(
    "get_action_new_arrivals",
    `${NAME}'s new products on one market (about 200), with sort, paging and filters: ${LIST}. ${STORE} ${CREDITS}`,
    { ...market, ...newListFields },
    post("new-arrivals"),
  );

  server.tool(
    "get_action_collection",
    `One ${NAME} collection (a seasonal moment page, e.g. black-friday, kerst, sinterklaas, basics) with sort, paging and filters: collection, collection_tag, ${LIST}. ${STORE} ${CREDITS}`,
    {
      collection: z.string().min(1).max(300)
        .describe("An Action collection: its slug (black-friday, kerst, sinterklaas, basics) or its action.com/<market>/moment/<slug>/ link. An unknown slug is a charged 404."),
      ...market,
      ...listFields,
    },
    post("collection"),
  );

  server.tool(
    "get_action_suggestions",
    `${NAME}'s search suggestions for a partial query: ${MARKET_OUT}, query, count, suggestions (search terms), category_suggestion {query, category}, products (${ITEM}; up to 5). ${CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. opberg."),
      ...market,
    },
    post("suggestions"),
  );

  server.tool(
    "get_action_stores",
    `The 20 ${NAME} stores nearest a city, town, postcode or point, as Action's store finder lists them (they may cross a border: each store names its country_code): ${MARKET_OUT}, query, latitude, longitude, complete (false when the store finder is down and the stores come from Action's store list: store_id, coordinates, distance and dates, no address or hours), count, countries, stores [{store_id, name, store (the input of get_action_store), url, country_code, address {street, house_number, street2, postcode, city, country}, latitude, longitude, distance_km (only for lat/lng input, nearest first), opening_date, closing_date (a store announced to close), hours [{date, day, closed, open, close}] (7 dated days)}]. A store announced to open later carries its opening_date. ${NO_STOCK} Send one of query or lat + lng. ${CREDITS}`,
    {
      query: z.string().min(1).max(80).optional().describe("A city, town or postcode, e.g. Amsterdam."),
      lat: z.number().min(-90).max(90).optional().describe("Latitude (with lng): the 20 stores nearest this point, with distance_km."),
      lng: z.number().min(-180).max(180).optional().describe("Longitude (with lat)."),
      ...market,
    },
    post("stores"),
  );

  server.tool(
    "get_action_store",
    `One ${NAME} store by its reference (stores[].store, link or slug) or by store_id: ${MARKET_OUT}, store_id, name, store, url, country_code, address, latitude, longitude, opening_date, closing_date, hours [{date, day, closed, open, close}] (7 dated days). No phone or services. ${NO_STOCK} Send one of store or store_id. ${CREDITS}`,
    {
      store: z.string().min(1).max(300).optional()
        .describe("A store: get_action_stores stores[].store (e.g. /nl-nl/winkels/amsterdam-kinkerstraat/), its action.com link, or its slug (amsterdam-kinkerstraat) with country."),
      store_id: z.union([z.string().min(2).max(8), z.number().int().positive()]).optional()
        .describe("Or an Action store id (stores[].store_id, e.g. 1260 or 3A11)."),
      ...market,
    },
    post("store"),
  );

  server.tool(
    "get_action_reviews",
    `Customer reviews of one ${NAME} article, up to 100 per call with offset paging. Action publishes reviews on four storefronts only (nl, de, fr, pl; other countries answer 400, not charged): ${MARKET_OUT}, product_code, scope, sort, rating, query, offset, limit, total, local_total, international_total, count, has_more, reviews [{review_id, language (the review's own language, e.g. nl-NL), rating, title, text, reviewed_at, recommends, aspect_ratings [{aspect, name, rating}], pros, cons}]. scope local (default) is the reviews written on that storefront, in its language; international the reviews written on the other three; all both (offset + limit up to 100). No reviewer name or any reviewer identity is returned. ${CREDITS}`,
    {
      product_code: code.describe("Action article number (items[].product_code), e.g. 3224838."),
      country: z.enum(REVIEW_COUNTRIES).optional()
        .describe("nl (default), de, fr or pl: the four storefronts where Action publishes reviews."),
      scope: z.enum(REVIEW_SCOPES).optional()
        .describe("local (default: reviews written on this storefront), international (the reviews written on the other three) or all (both; offset + limit up to 100)."),
      sort: z.enum(REVIEW_SORTS).optional().describe("relevant (default, Action's own order), newest, oldest, highest or lowest."),
      rating: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional().describe("Star ratings to include, e.g. [1, 2]."),
      query: z.string().min(1).max(100).optional().describe("Reviews that mention this text."),
      limit: z.number().int().min(1).max(100).optional().describe("Reviews per call, 1 to 100 (default 20)."),
      offset: z.number().int().min(0).max(100_000).optional().describe("Reviews to skip (paging)."),
    },
    post("reviews"),
  );

  server.tool(
    "search_action_webshop",
    `Search the ${NAME} webshop (shop.action.com: nl-nl, nl-be and fr-be only), or list one of its categories: ${MARKET_OUT}, query, category, page, page_size, total, total_pages, has_more, count, items [{ean, product_code, title, subtitle, url, image, brand, price, regular_price, currency, discount_percent, stock_level (Action's online stock level: HIGH ... SOLD_OUT), stock_label (as shown), order_limit, shipping_cost, is_deal, is_new, promo_label}]. stock_level is the webshop's online stock, not store stock. Send one of query or category. ${CREDITS}`,
    {
      query: z.string().min(1).max(200).optional().describe("Search text, e.g. stofzuiger."),
      category: z.string().min(1).max(200).optional()
        .describe("Or a webshop category slug (the /c/<slug> part of a shop.action.com link, e.g. alle-tijdelijke-deals)."),
      page: z.number().int().min(1).max(200).optional().describe("Page."),
      ...webshopMarket,
    },
    post("webshop-search"),
  );

  server.tool(
    "get_action_webshop_product",
    `One ${NAME} webshop product (shop.action.com) by EAN or link: requested, ${MARKET_OUT}, ean, product_code, title, subtitle, url, image, images, brand, price, regular_price, currency, discount_percent, stock_level (online stock), stock_label, order_limit, order_minimum, order_multiple, shipping_cost, availability {status, release_date, end_date}, is_deal, is_new, promo_label, description, highlights, specifications, supplier {name, address}, other_markets (the same product's webshop links in the other webshop markets). An EAN the webshop does not sell is a charged 404. Send one of ean or url. ${CREDITS}`,
    {
      ean: z.string().min(8).max(14).optional().describe("The product's EAN (search_action_webshop items[].ean), e.g. 8718969571098."),
      url: z.string().min(20).max(500).optional().describe("Or a shop.action.com product link."),
      ...webshopMarket,
    },
    post("webshop-product"),
  );
}
