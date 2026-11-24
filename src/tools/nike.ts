import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/nike.ts (61 www.nike.com storefronts plus
// www.nike.com.cn, markets in scrapedo-nike.ts MARKET_ROWS). Rules the backend
// enforces and zod here does not: language must be one the country offers
// (listed in MARKETS); product and reviews take url or style_color; release
// takes url, slug or style_color; category takes path or url; a url sets the
// storefront; releases / release are not offered on jp with language en (jp ja
// is); search takes ONE filter token, the list tools up to 6. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

// country -> "<currency> <languages, the first is the default>".
const MARKETS: Record<string, string> = {
  us: "USD en es", at: "EUR de en", au: "AUD en", be: "EUR nl de en fr", bg: "EUR en", ca: "CAD en fr",
  ch: "CHF de en fr it", cn: "CNY zh-Hans", cz: "EUR cs en", de: "EUR de", dk: "DKK da en", es: "EUR es ca",
  fi: "EUR en", fr: "EUR fr", gb: "GBP en", gr: "EUR el", hr: "EUR en", hu: "EUR hu en", id: "IDR en",
  ie: "EUR en", il: "ILS en", it: "EUR it", jp: "JPY ja en", kr: "KRW ko", lu: "EUR fr de en", mx: "MXN es",
  my: "MYR en", nl: "EUR nl en", no: "NOK no en", ph: "PHP en", pl: "PLN pl", pt: "EUR pt en", ro: "RON en",
  se: "SEK sv en", sg: "SGD en", si: "EUR en", sk: "EUR en", th: "THB th", tr: "TRY tr", tw: "TWD zh-Hant",
  vn: "VND en", za: "ZAR en",
};
const COUNTRIES = Object.keys(MARKETS) as [string, ...string[]];
// The launch calendar does not list launches on vn or cn (nor on jp in English).
const LAUNCH_COUNTRIES = COUNTRIES.filter((c) => c !== "vn" && c !== "cn") as [string, ...string[]];
// nike.com.cn has no reviews page.
const REVIEW_COUNTRIES = COUNTRIES.filter((c) => c !== "cn") as [string, ...string[]];
const LANGUAGES = ["en", "es", "de", "nl", "fr", "it", "zh-Hans", "cs", "da", "ca", "el", "hu", "ja", "ko", "no", "pl", "pt", "sv", "th", "tr", "zh-Hant"] as const;
const SORTS = ["featured", "newest", "price_high", "price_low"] as const;
const BRANDS = ["jordan", "acg", "sb"] as const;
const GENDERS = ["men", "women", "unisex", "boys", "girls"] as const;
const RELEASE_VIEWS = ["upcoming", "feed", "in_stock"] as const;

const NAME = "Nike (nike.com, including Jordan Brand)";
const MARKET_LIST = Object.entries(MARKETS)
  .map(([c, v]) => {
    const [currency, ...langs] = v.split(" ");
    return `${c} (${currency}; ${langs.join(", ")})`;
  })
  .join(", ");
const MARKETS_TEXT = `Storefronts (country, default us; language, default the first listed): ${MARKET_LIST}. cn is www.nike.com.cn. Not served (a 400, not charged): ae, sa, ar, br, cl, in (separate partner sites), co, pe, kw, qa, eg, ma, nz, pr, ru, uy, hk; uk is gb. Every answer carries market {country, language, currency, locale}.`;
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Price and full price as Nike shows them; discount_percent as Nike gives it. Prices are per storefront, in its own currency, and differ between markets (also inside the euro zone); no store prices.";
const FIRST_PAGE =
  "First page only: the 24 product groups Nike's page shows first (total and total_pages are as Nike gives them; Nike's page does not page further).";
const NOT_AVAILABLE =
  "Not available: store locator, in-store or pickup stock, stock levels for regular products (sizes only), review paging or Q&A, search suggestions, pages past the first, member prices, gift cards, Nike Factory store prices, Converse, checkout.";
const ITEM =
  "position, style_color (the input of get_nike_product, get_nike_reviews and get_nike_release), name, subtitle, color, price, full_price, discount_percent, currency, product_type, image, url, by_you (Nike By You), badge, featured_attributes, is_new_until, promotions [{text, starts, ends}] (Nike's offer text with its dates, UTC), colorways [{style_color, color, price, full_price, discount_percent, currency, image, url}] (us, ca, mx and au group every colorway; other storefronts show one per item)";
const LIST = `market, sort, path, title, total, total_pages, count, items (${ITEM}), facets [{name, options [{name, count, selected, filter}]}] (send filter back), categories [{name, count, path}], notes. ${FIRST_PAGE}`;
const LAUNCH =
  "launches [{style_color, name, subtitle, price, full_price, currency, product_type, release_start, method (LINE or DRAW, as Nike labels it), entry_start, entry_end, exclusive_access, launch_status, thread {slug, title, url}, image, sizes [{size, localized_size, gtin, level (HIGH, MEDIUM, LOW or OOS as Nike gives it), available}]}]";

const country = z.enum(COUNTRIES).optional()
  .describe("The storefront's two-letter country code (default us: www.nike.com). The storefronts and their languages are listed in the tool description.");
const launchCountry = z.enum(LAUNCH_COUNTRIES).optional()
  .describe("The storefront's two-letter country code (default us). Every storefront except vn and cn (and jp with language en): Nike's launch calendar does not list launches there.");
const reviewCountry = z.enum(REVIEW_COUNTRIES).optional()
  .describe("The storefront's two-letter country code (default us). Every www.nike.com storefront; cn (www.nike.com.cn) has no reviews page.");
const language = z.enum(LANGUAGES).optional()
  .describe("The storefront language where a country has several (default its primary language), e.g. ch: de, en, fr, it; be: nl, de, en, fr; ca: en, fr; us: en, es; jp: ja, en. A language the country does not offer answers 400, not charged, naming the offered ones.");
const market = { country, language };
const styleColor = z.string().min(9).max(20)
  .describe("A Nike style color: style code, dash, color code (items[].style_color, e.g. DD1503-103).");
const sort = z.enum(SORTS).optional()
  .describe("featured (default), newest, price_high or price_low: Nike's sort menu.");
const filter = z.union([z.string().min(2).max(300), z.array(z.string().min(2).max(300)).min(1).max(6)]).optional()
  .describe("One or more (up to 6) facet tokens exactly as an earlier answer gives them in facets[].options[].filter (size, gender, colour, price band, sport, brand, discount band, ...), e.g. black-90poy. A token from a filtered answer already carries the filters applied there.");
const listShape = { sort, filter, ...market };

export function registerNikeTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/nike/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_nike",
    `Search ${NAME} by keywords or a style color on any of its storefronts, sorted (featured, newest, price high or low) and filtered by one facet token of an earlier answer (size, gender, colour, price band, sport, brand). ${PRICES} Returns query, filters_applied, ${LIST} ${MARKETS_TEXT} ${NOT_AVAILABLE} ${ONE}`,
    {
      q: z.string().min(1).max(200).describe("Keywords (dunk low) or a style color."),
      sort,
      filter: z.union([z.string().min(2).max(300), z.array(z.string().min(2).max(300)).min(1).max(1)]).optional()
        .describe("ONE facet token exactly as an earlier search answer gives it in facets[].options[].filter, e.g. black-90poy. A token from a filtered answer already carries every filter applied there, so one token narrows step by step."),
      ...market,
    },
    post("search"),
  );

  server.tool(
    "get_nike_product",
    `One ${NAME} product by link or style color, on any storefront: market, requested_style_color, found_requested_style_color, style_color, style_code, prebuild_id (Nike By You), name, title, subtitle, url, color, price, full_price, discount_percent, currency, description, features [{header, items}], details [{header, items}], status (Nike's label as given, e.g. BUYABLE_BUY, COMING_SOON, NOTIFY_ME), release_type (FLOW, RELEASE or LAUNCH as given), availability_date, launch {start, end}, launch_product, member_product, by_you, promo_excluded, product_type, brands, genders, sports, categories [{name, values}], badge, featured_attributes, fit_message, size_chart_url, sizes [{label, localized_label, gtin, status}] (every size with its GTIN and Nike's status; sizes, not stock levels: Nike's product page shows no stock), colorways [{group, style_color, color, price, full_price, discount_percent, currency, status, url, image}], images, notes. ${PRICES} The same style color priced on several storefronts is one call per country. A launch-only product answers a charged 404 pointing to get_nike_release; an unknown product is a charged 404. ${ONE}`,
    {
      url: z.string().min(10).max(1000).optional()
        .describe("A Nike product link (items[].url; a Nike By You /u/ link too), instead of style_color. Its storefront comes from the link."),
      style_color: styleColor.optional()
        .describe("A Nike style color instead of url, e.g. DD1503-103 (found through Nike's search on the storefront first)."),
      ...market,
    },
    post("product"),
  );

  server.tool(
    "get_nike_category",
    `One ${NAME} listing by path token or link (men's shoes, running, a collection, ...), sorted and filtered by up to 6 facet tokens. ${PRICES} Returns category, filters_applied, ${LIST} A listing with no products is a charged 404. ${ONE}`,
    {
      path: z.string().min(2).max(300).optional()
        .describe("A Nike listing path token (categories[].path of an earlier answer, or the part after /w/ of a Nike listing link), e.g. mens-shoes-nik1zy7ok."),
      url: z.string().min(10).max(1000).optional()
        .describe("A Nike listing link (www.nike.com/.../w/<path>) instead of path. Its storefront comes from the link."),
      ...listShape,
    },
    post("category"),
  );

  server.tool(
    "get_nike_brand",
    `Jordan Brand, ACG or Nike SB products on any ${NAME} storefront, sorted and filtered. ${PRICES} Returns brand, filters_applied, ${LIST} ${ONE}`,
    {
      brand: z.enum(BRANDS).describe("jordan (Jordan Brand), acg or sb (Nike SB skateboarding)."),
      ...listShape,
    },
    post("brand"),
  );

  server.tool(
    "get_nike_deals",
    `${NAME}'s Sale listing on any storefront, optionally for one gender or one category, sorted and filtered (e.g. by discount band). ${PRICES} Returns gender, category, filters_applied, ${LIST} ${ONE}`,
    {
      gender: z.enum(GENDERS).optional().describe("men, women, unisex, boys or girls."),
      category: z.string().min(2).max(300).optional()
        .describe("Only this listing path token (categories[].path of an earlier deals answer, e.g. shoes-y7ok)."),
      ...listShape,
    },
    post("deals"),
  );

  server.tool(
    "get_nike_releases",
    `${NAME}'s launch calendar (the upcoming, feed or in stock tab) on a storefront: market, view, count, thread_count, ${LAUNCH}, notes. Price, release start and method per launch item, and per-size level and availability as Nike gives them; before a launch Nike can show LOW on every size. Not on vn, cn or jp in English. Read-only launch data: no entry or purchase. ${ONE}`,
    {
      view: z.enum(RELEASE_VIEWS).optional().describe("upcoming (default), feed or in_stock: the launch calendar's tabs."),
      country: launchCountry,
      language,
    },
    post("releases"),
  );

  server.tool(
    "get_nike_release",
    `One launch of ${NAME}'s launch calendar by link, thread slug or style color (past launches too, back to 2022): market, requested_style_color, found_requested_style_color, thread {slug, title, url}, count, ${LAUNCH}, notes. A thread can list several products (e.g. men's and kids' sizes). An unknown launch, or a style color that is not a launch-calendar product, is a charged 404. Not on vn, cn or jp in English. ${ONE}`,
    {
      url: z.string().min(10).max(1000).optional()
        .describe("A Nike launch link (launches[].thread.url, e.g. https://www.nike.com/launch/t/air-jordan-4-bred). Its storefront comes from the link."),
      slug: z.string().min(2).max(200).optional().describe("A launch thread slug (launches[].thread.slug) instead of url."),
      style_color: styleColor.optional()
        .describe("The style color of a launch-calendar product instead of url, e.g. IX8180-001 (past launches too)."),
      country: launchCountry,
      language,
    },
    post("release"),
  );

  server.tool(
    "get_nike_reviews",
    `The review summary of one ${NAME} product by link or style color (www.nike.com storefronts): market, requested_style_color, url, style_color (the colorway the reviews page names, which can differ from the requested one), total_reviews, average_rating, average_size_rating, average_comfort_rating (as Nike gives them), review_summary (Nike's own summary, where Nike shows one), count, reviews [{heading, rating, created_at, text, verified_purchase, sweepstakes_entry}] (the 3 newest reviews Nike's page shows; no reviewer names), notes. Summary and 3 newest reviews only: no paging, sorting or Q&A. A product without a reviews page is a charged 404. ${ONE}`,
    {
      url: z.string().min(10).max(1000).optional()
        .describe("A Nike product link (items[].url), instead of style_color. Its storefront comes from the link."),
      style_color: styleColor.optional()
        .describe("A Nike style color instead of url, e.g. CW2288-111 (found through Nike's search first)."),
      country: reviewCountry,
      language,
    },
    post("reviews"),
  );
}
