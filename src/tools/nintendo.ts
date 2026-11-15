import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/nintendo.ts (the Nintendo eShop and My
// Nintendo Store: 46 countries). Cross-field rules the backend enforces and
// zod here does not: language must be one the market serves (listed in
// MARKETS); product and dlc take nsuid, url or slug (slug: Americas only);
// sorts and filters are per region (Americas search: relevance and newest,
// no filters; jp and Europe: see each field) and an unsupported one answers
// 400, never silently dropped; sale is Americas only; price_min / price_max
// only where the catalog is priced in the market's currency. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

// Catalog markets: search, product, deals, releases and dlc.
const CATALOG_COUNTRIES = [
  "us", "ca", "mx", "br", "ar", "cl", "co", "pe",
  "gb", "ie", "de", "at", "ch", "fr", "be", "nl", "lu", "it", "es", "pt", "au", "nz", "za",
  "pl", "cz", "se", "no", "dk", "fi", "sk", "hu", "ro", "bg", "gr", "hr", "si", "ee", "lv", "lt", "mt", "cy",
  "jp",
] as const;
// prices also answers kr, hk, tw and il.
const PRICE_COUNTRIES = [...CATALOG_COUNTRIES, "kr", "hk", "tw", "il"] as const;
const LANGUAGES = ["en", "fr", "es", "pt", "de", "it", "nl", "ja", "ko", "zh"] as const;
const SORTS = ["relevance", "newest", "price_asc", "price_desc", "title", "discount"] as const;
const DEAL_SORTS = ["featured", "discount", "price_asc", "newest", "ending_soon"] as const;
const TYPES = ["game", "dlc", "bundle", "all"] as const;
const PLATFORMS = ["switch", "switch_2"] as const;
const RELEASE_TYPES = ["new", "upcoming"] as const;

const CHARGE = "Costs 1 credit. Failed upstream calls are not charged; a not-found is charged.";
const MARKET_LIST =
  "Americas: us (USD; en), ca (CAD; en or fr), mx (MXN; es), br (BRL; pt), ar (ARS), cl (CLP), co (COP), pe (PEN) (es). Europe, in the market's language: gb (GBP; en), ie (EUR; en), de and at (EUR; de), ch (CHF; de, fr or it), fr (fr), be (fr or nl), nl (nl), lu (fr), it (it), es (es), pt (pt) (EUR); au (AUD), nz (NZD), za (ZAR) (en). Europe without a Nintendo site of its own (the English European catalog with that country's own prices): pl (PLN), cz (CZK), se (SEK), no (NOK), dk (DKK), fi, sk, hu, ro, bg, gr, hr, si, ee, lv, lt, mt, cy (EUR) (en). Japan: jp (JPY; ja). Prices only: kr (KRW; ko), hk (HKD; zh), tw (TWD; zh), il (EUR; en, European item ids)";
const MARKETS = `Markets (country, default us; language, default the market's first): ${MARKET_LIST}. ph (no Philippines item ids published yet), ru (no eShop), uk (use gb) and countries with no eShop data answer 400 before anything is charged. Every answer carries country, language, currency and region (americas, europe, japan or asia).`;
const IDS =
  "Item ids (nsuid, 14 digits starting 70) are per eShop region: americas (US CA MX BR AR CL CO PE), europe (EU / EFTA, GB, AU, NZ, ZA, IL), japan, kr, and hk-tw (Taiwan uses Hong Kong ids). An id from one region is not_found in another: there is no cross-region title mapping, so look the game up with search or product in each region, then call get_nintendo_prices for any country of that region.";
const PRICES =
  "Prices are numbers in the market's currency, always the requested country's eShop price: price (what it costs now), regular_price, sale_price, discount_percent, sale_start and sale_end (the eShop's own sale window), is_free (free-to-play is 0 with is_free true), sales_status (onsale, preorder, unreleased; not_found when that eShop does not sell the item, kept with price null). Nintendo shows no price history or historical low: poll get_nintendo_prices to build one.";
const ITEM =
  "nsuid, slug (Americas), page_id (Europe), url, title (in the request language), platform (switch / switch_2), release_date (ISO), release_date_text, publisher, price, regular_price, sale_price, discount_percent, sale_start, sale_end, currency, is_free, sales_status, image, type (game, dlc, bundle; Americas also hardware and merchandise) and age_rating (system such as ESRB, PEGI, USK or CERO, and rating)";
const GRID =
  "Also count, total, page, page_size, total_pages, sort, sorts_offered, requested_filters and notes.";

const country = (markets: readonly string[] = CATALOG_COUNTRIES) =>
  z.enum(markets as unknown as [string, ...string[]]).optional()
    .describe(
      markets.length === CATALOG_COUNTRIES.length
        ? "eShop country (default us): any of the 42 catalog markets in the tool description. kr, hk, tw and il answer get_nintendo_prices only (400 here)."
        : "eShop country (default us): any of the 46 markets in the tool description, including the prices-only kr, hk, tw and il.",
    );
const language = () => z.enum(LANGUAGES).optional()
  .describe("Language of the market (default its first; the languages each market serves are listed under Markets in the tool description). Titles and descriptions come back in it; a language the market does not serve answers 400.");
const platform = () => z.enum(PLATFORMS).optional()
  .describe("switch or switch_2 (Europe and jp; default both). Not on Americas search (400).");
const page = (description: string) => z.number().int().min(1).max(400).optional().describe(description);
const pageSize = (description: string) => z.number().int().min(1).max(50).optional().describe(description);

const productRef = {
  nsuid: z.union([z.string(), z.number()]).optional()
    .describe("An eShop item id (14 digits starting 70; items[].nsuid, prices[].nsuid), e.g. 70010000095431. Ids are per eShop region: an Americas id is not found in Europe. One of nsuid, url or slug."),
  url: z.string().min(10).max(1000).optional()
    .describe("A nintendo.com product link: an Americas store page (/us/store/products/<slug>/), a European game page (ending -<id>.html) or a nintendo.com/au game page."),
  slug: z.string().min(2).max(200).optional()
    .describe("Americas markets only: the store slug (items[].slug of an Americas search, which carries no nsuid), e.g. mario-kart-world-switch-2."),
};

export function registerNintendoTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/nintendo/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_nintendo",
    `Search the Nintendo eShop catalog of one country by keyword. Europe and jp: items with ${ITEM}, paged (page_size up to 50, default 24) with an exact total; sorted by relevance, newest, price_asc, price_desc, title or discount (Europe: all six; jp: relevance, newest, price_asc, price_desc) and filtered by platform, on_sale, publisher and type (Europe also price range, genre, players and has_demo). Americas: Nintendo's store search, 40 tiles per page (games, hardware and merchandise together), sorted by relevance or newest only, no filters, with slug, title, platform, release_date, price fields, badges (e.g. Sale ends: 1 day), category and has_more (total null, nsuid null: read get_nintendo_product with the slug). An unsupported sort or filter answers 400, never silently dropped. Americas searches take about 8 to 13 seconds. ${GRID} ${PRICES} ${IDS} ${MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'mario' (Japanese titles on jp, e.g. 'マリオ')."),
      country: country(),
      language: language(),
      page: page("Results page, 1-based (Americas: up to 50)."),
      page_size: pageSize("Items per page, 1 to 50 (default 24; Europe and jp). Americas pages are fixed at 40."),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), newest, price_asc, price_desc, title or discount. Americas: relevance and newest; jp: relevance, newest, price_asc, price_desc; Europe: all six."),
      platform: platform(),
      on_sale: z.boolean().optional().describe("Only discounted games (Europe and jp)."),
      price_min: z.number().min(0).optional()
        .describe("Lowest price (Europe, on markets whose catalog is priced in the market's currency: gb, and the EUR markets with a catalog of their own)."),
      price_max: z.number().min(0).optional().describe("Highest price (as price_min)."),
      genre: z.string().min(1).max(60).optional()
        .describe("A genre as the catalog names it, in the request language (Europe: e.g. RPG, Action)."),
      players: z.number().int().min(1).max(99).optional().describe("At least this many players (Europe)."),
      publisher: z.string().min(1).max(100).optional()
        .describe("Exact publisher name (Europe; jp in Japanese, e.g. 任天堂)."),
      has_demo: z.boolean().optional().describe("Only games with a free demo (Europe)."),
      type: z.enum(TYPES).optional()
        .describe("game (default), dlc, bundle or all (Europe: game, dlc or all; jp: all four)."),
    },
    post("search"),
  );

  server.tool(
    "get_nintendo_product",
    `One Nintendo eShop or My Nintendo Store product by nsuid, link or (Americas) slug, as product: nsuid, application_id, title, url, platform, type, release_date, publisher, developer, genres, players (system / local / online), languages, file size, age_rating (system such as ESRB, PEGI, USK, CERO or CLASSIND, rating and descriptors), description, price, regular_price, sale_price, discount_percent, sale_start, sale_end, sales_status, has_demo, nintendo_switch_online (required, features), images; on the Americas store also sku, slug, editions, is_upgrade, play_modes, availability, the game's dlc with prices, and for hardware, amiibo and merchandise the stock signal (in_stock, sold_out_permanently, max_per_order); in Europe also nsuids, page_id, physical_version, digital_version, game_series and base_game; on jp also title_reading, format and dlc_nsuids. An id unknown to that region's eShop answers 404 (charged). Nintendo's stores carry no user reviews (age ratings only). ${PRICES} ${IDS} ${MARKETS} ${CHARGE}`,
    {
      ...productRef,
      country: country(),
      language: language(),
    },
    post("product"),
  );

  server.tool(
    "get_nintendo_prices",
    `The eShop price of 1 to 50 item ids in one country: prices (nsuid, sales_status, price, regular_price, sale_price, discount_percent, sale_start, sale_end, currency, is_free), not_found (ids that eShop does not sell), count and notes. Serves every market including the prices-only kr, hk, tw and il. Use it to compare one game's regular price, sale price and sale end date across the countries of its eShop region, in each country's currency, and to watch prices and sales over time (Nintendo publishes no price history). ${IDS} ${MARKETS} ${CHARGE}`,
    {
      ids: z.union([z.string().min(1).max(800), z.array(z.union([z.string(), z.number()])).min(1).max(50)])
        .describe("1 to 50 eShop item ids of one region, as an array or comma-separated, e.g. '70010000095431,70010000063714'. More than 50 answers 400."),
      country: country(PRICE_COUNTRIES),
      language: language(),
    },
    post("prices"),
  );

  server.tool(
    "get_nintendo_deals",
    `Games on sale now in one country. Europe and jp: every discounted game in the catalog with the country's sale price, discount and sale_end (items with ${ITEM} and on_sale), paged (up to 50, default 24), sorted by discount (default), price_asc or newest (Europe) or newest (default) / price_asc (jp). Americas: Nintendo's featured sale pages (the nintendo.com sales and deals pages, not every discounted game: check any id with get_nintendo_prices), with sale on each item (the sale page it is featured in: sale, name, headline), amount_off, sales (every sale page: pass its sale slug as sale), heading, and sorts featured (default, Nintendo's order), discount, price_asc, newest and ending_soon. ${GRID} ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      country: country(),
      language: language(),
      page: page("Results page, 1-based."),
      page_size: pageSize("Items per page, 1 to 50 (default 24)."),
      sort: z.enum(DEAL_SORTS).optional()
        .describe("Americas: featured (default), discount, price_asc, newest or ending_soon; Europe: discount (default), price_asc or newest; jp: newest (default) or price_asc."),
      platform: z.enum(PLATFORMS).optional().describe("switch or switch_2 (default both)."),
      sale: z.string().min(1).max(80).optional()
        .describe("Americas only: one sale page, by its slug from sales[].sale, e.g. 'square-enix'."),
    },
    post("deals"),
  );

  server.tool(
    "get_nintendo_releases",
    `New releases (released games, newest first) or upcoming games (future release dates, soonest first) in one country, with the search item fields (${ITEM}). Europe and jp: paged (up to 50, default 24), filtered by platform. Americas: Nintendo's new releases / coming soon lists in one page (page > 1 answers 400); titles announced for a year or month only carry release_date null and release_date_text. ${GRID} ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      country: country(),
      language: language(),
      type: z.enum(RELEASE_TYPES).optional()
        .describe("new (default: released games, newest first) or upcoming (future release dates, soonest first)."),
      platform: z.enum(PLATFORMS).optional().describe("switch or switch_2 (default both)."),
      page: page("Results page, 1-based (Europe and jp; the Americas lists are one page)."),
      page_size: pageSize("Items per page, 1 to 50 (default 24; Europe and jp)."),
    },
    post("releases"),
  );

  server.tool(
    "get_nintendo_dlc",
    `A game's DLC, bundles and upgrade packs by the game's nsuid, link or (Americas) slug: game (nsuid, title, url) and dlc (nsuid, title, url, slug (Americas), type dlc / bundle / upgrade, release_date, price, regular_price, sale_price, discount_percent, sale_start, sale_end, currency, is_free, sales_status, image), count and total. ${PRICES} ${IDS} ${MARKETS} ${CHARGE}`,
    {
      ...productRef,
      country: country(),
      language: language(),
    },
    post("dlc"),
  );
}
