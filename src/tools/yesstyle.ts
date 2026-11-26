import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// YesStyle: 9 tools on /api/v1/yesstyle (search, category, brand, brands, deals, product, reviews,
// suggestions, markets). Shapes mirror backend/src/routes/yesstyle.ts. Rules the backend enforces and
// zod here does not: product and reviews take product_id or url (not both); country "uk" is read as
// gb; listings stop at page 200; at most 12 filter values in all (featured, type, region, ingredients
// and filters together); min_price must not be above max_price; department takes one id; the search
// tool does not take type, region or ingredients (YesStyle's search does not apply them: a 400), and
// the category tool does not take department (the category is the department). Brazil is held back
// from the page tools. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const PAGE_COUNTRIES = [
  "ae", "at", "au", "be", "ca", "ch", "cl", "cz", "de", "dk", "es", "fr", "gb", "gr", "hk", "hu", "ie", "il", "in", "it",
  "jp", "kr", "kz", "mx", "my", "nl", "no", "nz", "ph", "pl", "pt", "ro", "sa", "se", "sg", "th", "tw", "us", "za",
] as const;
const LANGUAGES = ["en", "fr", "de", "es", "it", "nl", "pl", "pt", "ru", "ar", "zh_TW"] as const;
const SORTS = ["bestsellers", "newest", "price_low_to_high", "price_high_to_low", "best_value", "availability", "discount"] as const;
const FEATURED = [
  "in_stock", "just_arrived", "new_this_week", "trending_new", "flash_sales", "black_friday", "clearance",
  "rock_bottom_prices", "price_drop", "new_items_24hr_sale", "value_gift_sets", "twin_packs_bundles",
  "mini_travel_sizes", "mini_size_exclusives", "korean_brands", "japanese_brands", "chinese_cosmetics",
  "southeast_asian_beauty", "western_beauty", "korean_pharmacy", "cruelty_free", "vegan", "yesstyle_awards_2026",
];
const DEALS = ["black_friday", "flash_sales", "clearance", "rock_bottom_prices", "price_drop", "new_items_24hr_sale", "value_gift_sets", "twin_packs_bundles"] as const;
const REVIEW_SORTS = ["relevant", "highest_rating", "newest", "helpful"] as const;
const REVIEW_FILTERS = ["all", "5", "4", "3", "2", "1", "positive", "negative", "photo", "video"] as const;

const FIRST =
  "YesStyle (yesstyle.com, the Hong Kong-based online store for Asian beauty and fashion, shipping to 150+ countries; owned by YesAsia Holdings)";
const NAME = "YesStyle";
const BILL =
  "Billed on what the request actually costs (credits_used is what was charged). Failed upstream calls, a page that came back for another country, and refused inputs are not charged; a not-found is charged.";
const MARKET =
  "Prices are YesStyle's own for the shipping country, in that country's currency (YesStyle keeps regional price lists, so the same product can cost a different amount in two countries that share a currency); which products ship differs by country. Every answer is checked for its country; market {country, country_name, currency, language} says which.";
const PAGE_MARKETS = `Countries (country, default us; uk is read as gb): the ${PAGE_COUNTRIES.length} countries ${PAGE_COUNTRIES.join(", ")}. Brazil is held back (YesStyle answered for another country). Any other country is a 400 before anything is charged; reviews and suggestions take any of the 153 countries YesStyle ships to.`;
const TILE =
  "product_id, name, brand, brand_id, url, image, price, list_price, discount_percent, currency, price_text, list_price_text (as YesStyle shows them), rating (0-5), review_count, size, status (YesStyle's label, e.g. FLASH SALE, Black Friday), badges (flash_sale, black_friday, clearance, buy_one_get_one, trending_new, yesstyle_awards_2026 ...), brand_region, pack_label, child_product_ids, has_videos";
const LIST = `page, page_size (100), sort, sort_applied, filters_applied, total, total_pages, has_more, count, items [{${TILE}}], heading, description, breadcrumbs, category (tree), facets [{name, type, key, values [{value, name, selected}]}] / price_range / sorts (with include_facets), coupon (YesStyle's site code: code, tiers, expires_at), market, notes`;
const NOT_AVAILABLE =
  "Not available: stores (YesStyle has none to look up), a currency other than the country's, cart or checkout, price history (poll and store the answers), EAN / UPC (YesStyle shows none).";
const SLOW = "Answers usually take 2-30 seconds and can take up to about 225 seconds: allow up to 4 minutes.";
const TWO = `Costs 2 credits. ${BILL}`;
const ONE = `Costs 1 credit. ${BILL}`;

const pageCountry = z.enum(PAGE_COUNTRIES).optional()
  .describe(`Shipping country, ISO-2 lower case (default us). YesStyle prices and stocks by shipping country; ${PAGE_COUNTRIES.length} countries are served here (Brazil is held back).`);
const anyCountry = z.string().min(2).max(4).optional()
  .describe("Shipping country, ISO-2 lower case (default us; uk is read as gb): any of the 153 countries YesStyle ships to (get_yesstyle_markets lists them).");
const language = z.enum(LANGUAGES).optional()
  .describe(`Page language: ${LANGUAGES.join(", ")} (default: the country's own on YesStyle, e.g. de for Germany, ar for Saudi Arabia, zh_TW for Taiwan and Hong Kong, en for most).`);
const ids = (description: string) =>
  z.union([z.string().max(12), z.array(z.string().max(12))]).optional().describe(description);

const listing = {
  country: pageCountry,
  language,
  page: z.number().int().min(1).max(200).optional()
    .describe("Page, 1-based (100 products a page; default 1; up to page 200)."),
  sort: z.enum(SORTS).optional()
    .describe("bestsellers (default), newest, price_low_to_high, price_high_to_low, best_value, availability, discount."),
  featured: z.union([z.string().max(40), z.array(z.string().max(40))]).optional()
    .describe(`YesStyle's Featured filters, one or a list: ${FEATURED.join(", ")}, or Featured ids from facets (key oc).`),
  min_price: z.number().min(0).max(100_000_000).optional()
    .describe("Lowest price, whole units of the country's currency."),
  max_price: z.number().min(0).max(100_000_000).optional()
    .describe("Highest price, whole units of the country's currency."),
  filters: z.array(z.object({
    key: z.string().max(10).describe("A facet key from facets[].key (e.g. stp skin type, scrn skin concern, si size, cf color family)."),
    value: z.union([z.string().max(60), z.array(z.string().max(60))]).describe("facets[].values[].value, one or a list."),
  })).optional()
    .describe("Any other facet as {key, value} from an earlier answer's facets (include_facets). At most 12 filter values in all."),
  include_facets: z.boolean().optional()
    .describe("Also return facets [{name, type, key, values [{value, name, selected}]}], price_range and sorts. Same credits."),
};
const categoryFilters = {
  type: ids("Type ids from facets (key t), one or a list."),
  region: ids("Brand Region ids from facets (key bcs, e.g. 1 South Korea), one or a list."),
  ingredients: ids("Ingredient ids from facets (key inp), one or a list."),
};
const department = z.union([z.string().max(12), z.number().int()]).optional()
  .describe("One department id (category ids from breadcrumbs or category, e.g. 15478 Beauty, 15544 Skin Care).");
const productId = z.union([z.string().max(20), z.number().int()]).optional();
const productUrl = z.string().max(2000).optional();
const FILTERS =
  "with paging (100 a page), seven sorts (bestsellers, newest, price both ways, best value, availability, discount) and YesStyle's filters: Featured (in stock, flash sales, Black Friday, clearance, rock-bottom prices, value & gift sets, twin packs, mini sizes, Korean / Japanese brands, cruelty-free, vegan, YesStyle Awards ...), price band and any facet";

export function registerYesstyleTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/yesstyle/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_yesstyle",
    `Search the catalog of ${FIRST} by keywords or a brand name, ${FILTERS}, on one department if given. Returns query, department, ${LIST}. ${MARKET} Captured 2026-11-26: "snail mucin" listed 422 products in the US; the first, COSRX Advanced Snail 96 Mucin Power Essence (product_id 1052684695), at US$ 16.09 (list price 25, 36% off, FLASH SALE), with the site code BLACK26 (8% off over US$ 79, up to 15% off over US$ 199). Not offered here: type, region and ingredients (YesStyle's search does not apply them; use get_yesstyle_category, get_yesstyle_brand or get_yesstyle_deals). ${PAGE_MARKETS} ${NOT_AVAILABLE} ${TWO} ${SLOW}`,
    {
      query: z.string().min(1).max(200).describe("Keywords or a brand name (required, e.g. snail mucin)."),
      department,
      ...listing,
    },
    post("search"),
  );

  server.tool(
    "get_yesstyle_category",
    `Browse one category of ${FIRST} by category id or link, ${FILTERS}, plus the Type, Region (brand country) and Ingredients filters. Returns category_id, ${LIST}. ${MARKET} The category is the department (no department input). ${PAGE_MARKETS} ${TWO} ${SLOW}`,
    {
      category: z.union([z.string().max(2000), z.number().int()])
        .describe("A category id (e.g. 15556 Face Serums, from breadcrumbs, category or a link's bcc.<id>_bpt.46) or a category link (/en/beauty-face-serums/list.html/bcc.15556_bpt.46)."),
      ...listing,
      ...categoryFilters,
    },
    post("category"),
  );

  server.tool(
    "get_yesstyle_brand",
    `One brand's products on ${FIRST} by brand id or link, ${FILTERS}, plus department, Type, Region and Ingredients, and the brand's name, region and customer satisfaction: brand {name, region, satisfaction_percent, total_reviews, star_counts}. Returns brand_id, brand, ${LIST}. ${MARKET} Captured 2026-11-26: COSRX (brand id 317041) listed 271 products in the US, brand satisfaction 96.6% over 264,080 reviews. ${PAGE_MARKETS} ${TWO} ${SLOW}`,
    {
      brand: z.union([z.string().max(2000), z.number().int()])
        .describe("A brand id (e.g. 317041 COSRX, from get_yesstyle_brands or items[].brand_id) or a brand link (/en/cosrx/list.html/bpt.299_bid.317041)."),
      department,
      ...listing,
      ...categoryFilters,
    },
    post("brand"),
  );

  server.tool(
    "get_yesstyle_brands",
    `Every brand of ${FIRST} (about 4,300): query, total, matched, page, page_size, has_more, count, brands [{brand_id (the input of get_yesstyle_brand), slug (the brand's link name), url, last_modified}], notes. Filter by query and page through the list. ${ONE} ${SLOW}`,
    {
      query: z.string().max(100).optional()
        .describe("Brands whose link name contains this (accents, case and punctuation ignored), e.g. cosrx."),
      page: z.number().int().min(1).optional().describe("Page, 1-based (default 1)."),
      page_size: z.number().int().min(1).max(5000).optional().describe("Brands a page (default 500, at most 5000)."),
    },
    post("brands"),
  );

  server.tool(
    "get_yesstyle_deals",
    `The deal lists of ${FIRST}: Black Friday, flash sales, clearance, rock-bottom prices, price drops, new items 24-hour sale, value & gift sets, twin packs, on a department (default Beauty), ${FILTERS}, plus Type, Region and Ingredients. Returns deal, department_id, ${LIST}. get_yesstyle_product adds a deal's sale_end_date and claimed share. ${MARKET} Captured 2026-11-26: black_friday on Beauty listed 151 products in the US, the first Dr. Althea 345 Relief Cream at US$ 18.90 (list price 27, 30% off). ${PAGE_MARKETS} ${TWO} ${SLOW}`,
    {
      deal: z.enum(DEALS).optional()
        .describe(`${DEALS.join(", ")} (default black_friday, while YesStyle runs it).`),
      department: z.union([z.string().max(2000), z.number().int()]).optional()
        .describe("The department: a category id or link (default 15478 Beauty)."),
      ...listing,
      ...categoryFilters,
    },
    post("deals"),
  );

  server.tool(
    "get_yesstyle_product",
    `One product of ${FIRST} by product id or link: requested_product_id, product_id (the option the page prices), parent_product_id, name, option, brand {name, brand_id, url, region}, url, canonical_url, description, about_brand, breadcrumbs, images, videos, price, list_price, discount_percent, currency, price_text, list_price_text, sale_end_date, deal_claimed_percent, deal_claimed_text, badges, availability (In-Stock, Temporarily Out of Stock, Not available for your shipping destination), sellable, child_product_ids, rating, review_count, star_counts, brand_satisfaction, ingredients, ingredient_notes, bestseller_ranks, packs (minis, twin packs and bundles with price), product_information (Cruelty-free, Imported from, Catalog No. ...), shipping {to, free_shipping_offer, delivery_days}, returns_days, no_refund_or_exchange, warning, coupon, market, notes. include_variants adds variants [{product_id, name, availability, sellable, price, price_text, currency, flash_sale}] for every shade / size and variants_status (ok, or unavailable: then that part is not charged). ${MARKET} Captured 2026-11-26: COSRX Advanced Snail 96 Mucin Power Essence 100ml (product_id 1052684694) at GBP 10.96 in the United Kingdom (list price 15.65) and JPY 2,497 in Japan (list price 3,566), the same deal ending 2026-12-01T00:00:00Z ("Deal is 86% claimed"). An unknown product is a charged 404. ${PAGE_MARKETS} ${NOT_AVAILABLE} Costs 2 credits; 3 with include_variants. ${BILL} ${SLOW}`,
    {
      product_id: productId
        .describe("A YesStyle product id (items[].product_id, digits, e.g. 1052684695; every shade and size has its own). Send product_id or url."),
      url: productUrl
        .describe("A product link (https://www.yesstyle.com/<lang>/<name>/info.html/pid.<id>) instead of product_id."),
      country: pageCountry,
      language,
      include_variants: z.boolean().optional()
        .describe("Also return every shade / size: product_id, name, availability, sellable, price (+1 credit: 3 in all)."),
    },
    post("product"),
  );

  server.tool(
    "get_yesstyle_reviews",
    `Customer reviews of one product family on ${FIRST}, 15 reviewers a page, four sorts (relevant, highest rating, newest, helpful) and filters (1-5 stars, positive, negative, photo, video); YesStyle answers up to 67 pages (about 1,000 reviews) per sort and filter. Returns product_id, page, page_size, sort, filter, sort_applied, has_more, count, summary {total_reviews, star_counts, satisfaction_percent} (page 1, or include_summary), reviews [{review_id, product_id, rating (1-5), title, text, date (as YesStyle shows it, in the page language), helpful_count, helpful_text, images [{url, thumbnail}], skin_type, skin_tone, reviewer_country, translatable, reviewer_group}], market, notes. Reviewer names, gender and age are left out. Any of the 153 countries YesStyle ships to; the language sets the labels and date format. Captured 2026-11-26: the COSRX Advanced Snail 96 Mucin Power Essence family had 30,843 reviews, 96.8% satisfaction. ${ONE} ${SLOW}`,
    {
      product_id: productId
        .describe("A product id (any shade or size of the family, e.g. 1052684695). Send product_id or url."),
      url: productUrl.describe("A product link instead of product_id."),
      page: z.number().int().min(1).max(67).optional()
        .describe("Page, 1-based (15 reviewers a page; up to 67 pages per sort and filter)."),
      sort: z.enum(REVIEW_SORTS).optional().describe("relevant (default), highest_rating, newest, helpful."),
      filter: z.union([z.enum(REVIEW_FILTERS), z.number().int().min(1).max(5)]).optional()
        .describe("all (default), 5, 4, 3, 2, 1 (stars), positive, negative, photo, video."),
      include_summary: z.boolean().optional()
        .describe("Also return the summary (total, star counts, satisfaction) on pages after the first. Still 1 credit."),
      country: anyCountry,
      language,
    },
    post("reviews"),
  );

  server.tool(
    "get_yesstyle_suggestions",
    `The search terms and products ${FIRST} suggests for what a shopper has typed, priced for the shipping country (any of the 153 countries YesStyle ships to). Returns query, count, suggestions, products [{${TILE}}], market, notes. ${ONE} ${SLOW}`,
    {
      query: z.string().min(2).max(100).describe("What a shopper has typed (at least 2 characters, e.g. cosrx)."),
      country: anyCountry,
      language,
    },
    post("suggestions"),
  );

  server.tool(
    "get_yesstyle_markets",
    `The shipping countries, currencies and languages of ${FIRST}: count, page_endpoint_countries, countries [{country (ISO-2), name, country_id, currency (the country's default), language, page_endpoints (served by search, category, brand, deals and product), held_back}], currencies [{code, name}], languages [{code, name, lang_id}], notes. 153 countries; ${PAGE_COUNTRIES.length} are served by the ${NAME} page tools. Currency follows the country (choosing another is not offered). ${ONE}`,
    {
      language: z.enum(LANGUAGES).optional()
        .describe(`Names in this language (${LANGUAGES.join(", ")}; default en).`),
    },
    post("markets"),
  );
}
