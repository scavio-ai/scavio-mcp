import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/trendyol.ts (trendyol.com and its
// international storefronts: 35 markets). Cross-field rules the backend
// enforces and zod here does not: language must be one the market serves
// (listed in MARKETS); product, reviews, questions, coupons and delivery take
// content_id or url; category takes category_id or url; brand takes brand_id
// or url; seller takes seller_id or url; deals and coupons are tr only;
// city_id / district_id are tr only and district_id needs city_id;
// min_rating and lowest_price_days take the listed values only. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const COUNTRIES = [
  "tr", "de", "at", "fr", "be", "hr", "dk", "ee", "fi", "it", "lv", "lt", "nl", "pt", "si", "es", "se", "lu",
  "bg", "gr", "cz", "hu", "pl", "ro", "sk", "rs", "ua", "md", "ae", "sa", "qa", "kw", "om", "bh", "az",
] as const;
const TR_ONLY = ["tr"] as const;
// The 15 English-language EU storefronts have no ranking lists (400 there).
const RANKINGS_COUNTRIES = [
  "tr", "de", "at", "bg", "gr", "cz", "hu", "pl", "ro", "sk", "rs", "ua", "md", "ae", "sa", "qa", "kw", "om", "bh", "az",
] as const;
const LANGUAGES = ["tr", "en", "ar", "de", "bg", "el", "cs", "hu", "pl", "ro", "sk", "sr", "uk"] as const;
const SORTS = ["recommended", "price_asc", "price_desc", "newest", "best_seller", "most_favourited", "most_rated"] as const;
const SELLER_TYPES = ["official", "authorized", "successful"] as const;
const REVIEW_SORTS = ["recommended", "newest", "oldest", "rating_desc", "rating_asc"] as const;
const RANKINGS = ["best_seller", "most_favourited", "most_rated", "top_viewed"] as const;
const DEAL_TYPES = ["flash", "super_discounts"] as const;

const CHARGE = "Costs 1 credit. Failed upstream calls are not charged; a not-found is charged.";
const MARKET_LIST =
  "tr (TRY; tr, en or ar), de and at (EUR; de), fr, be, hr, dk, ee, fi, it, lv, lt, nl, pt, si, es, se, lu (EUR; en), bg (EUR; bg or en), gr (EUR; el or en), cz (CZK; cs or en), hu (HUF; hu or en), pl (PLN; pl or en), ro (RON; ro or en), sk (EUR; sk or en), rs (RSD; sr Latin or en), ua (UAH; uk or en), md (MDL; ro or en), ae (AED; en or ar), sa (SAR; ar or en), qa, kw, om, bh (QAR, KWD, OMR, BHD; ar or en), az (AZN; tr)";
const MARKETS = `Markets (country, default tr; language, default the market's first): ${MARKET_LIST}. ge, kz, kg and iq are served as the Turkish storefront and ie, mt, gb, ru, us, ca, jo and lb are not sold to: 400 before anything is charged. Every answer carries country, language and currency.`;
const PRICES =
  "Prices are numbers in the market's currency. Each international storefront has its own price list (mostly sold by Trendyol itself and shipped cross-border), not a currency conversion of the Turkish price. price is what one unit costs at checkout (basket discounts applied); original_price is the higher price it is shown against (the previous price, the price before the basket discount, or the recommended retail price) and discount_percent is computed from the two; rrp is the recommended retail price where shown; plus_price is the Trendyol Plus member price. lowest_price_badge is the site's 'lowest price of the last N days' badge (days, text): a day count only. Trendyol publishes no numeric 30-day lowest price and no price history: poll to track changes.";
const ITEM =
  "position, content_id, group_id, listing_id, item_number, name, brand (id, name), category (name), url, image, images, price, original_price, discount_percent, rrp, plus_price, currency, lowest_price_badge (days, text), badges (free_shipping, rush_delivery, next_day_delivery, same_day_shipping, flash_sale, coupon, best_seller, fast_seller, official_seller, lowest_price), best_seller_rank, labels (the site's own badge texts), promotions, rating, review_count, favourites and orders (the site's rounded counts, e.g. 21K, 200+), seller (id), color, variant and sponsored";
const GRID = `36 items per page with ${ITEM}. Sponsored items (sponsored true: ads placed among the results, repeating on every page) are flagged and kept; count is the organic items, sponsored_count the ads. Also total (exact below 100000; the site stops counting at 100000: total_capped), page, page_size (36), total_pages (at most 138), sort, requested_filters, notes and, with include_facets, facets (param, key, name, type, options with value, label and count: what filters takes).`;

const country = (markets: readonly string[] = COUNTRIES) =>
  z.enum(markets as unknown as [string, ...string[]]).optional()
    .describe(markets.length === 1 ? "Trendyol market: tr only (the Turkish storefront; every other market answers 400)." : markets.length === COUNTRIES.length ? "Trendyol market (default tr): any of the 35 listed in the tool description." : `Trendyol market (default tr): ${markets.join(", ")}.`);
const language = () => z.enum(LANGUAGES).optional()
  .describe("Language of the market (default its first; the languages each market serves are listed under Markets in the tool description). Titles, categories and reviews come back in it; a language the market does not serve answers 400.");

const id = (description: string) => z.union([z.string(), z.number()]).optional().describe(description);
const ids = (description: string) =>
  z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])).max(10)]).optional().describe(description);

const gridFields = {
  page: z.number().int().min(1).max(138).optional()
    .describe("Results page, 1-based, 36 per page. The site lists at most 138 pages (page 139 and up: 400); a page past the last returns no items and a note."),
  sort: z.enum(SORTS).optional()
    .describe("recommended (default), price_asc, price_desc, newest, best_seller, most_favourited or most_rated."),
  price_min: z.number().min(0).optional().describe("Lowest price, in the market's currency."),
  price_max: z.number().min(0).optional().describe("Highest price, in the market's currency."),
  brand_id: ids("1 to 10 brand ids (items[].brand.id, e.g. 794 Samsung)."),
  category_id: ids("1 to 10 category ids (product category.id / category.tree[].id, or the wc facet)."),
  seller_id: id("Only one seller's items (items[].seller.id), e.g. 4473."),
  min_rating: z.number().optional().describe("Product rating and up: 1, 2, 3, 4 or 4.5."),
  free_shipping: z.boolean().optional().describe("Only items with free shipping."),
  fast_delivery: z.boolean().optional().describe("Only items with rush delivery."),
  min_discount: z.number().int().min(1).max(90).optional().describe("Only items at least this many percent off."),
  lowest_price_days: z.number().int().optional()
    .describe("Only items carrying the site's lowest-price badge for the last N days: 7, 10, 14, 30 or 90 (tr shows 10 / 14 / 30 / 90, international storefronts 7 / 14 / 30)."),
  seller_type: z.enum(SELLER_TYPES).optional()
    .describe("official (the brand's official seller), authorized or successful sellers only."),
  flash_sale: z.boolean().optional().describe("Only flash-sale items."),
  has_coupon: z.boolean().optional().describe("Only items with a collectable coupon."),
  filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional()
    .describe("Any other facet, keyed by facets[].param with facets[].options[].value values (send include_facets once to read them): {\"attr\": [\"348|1\"]} is a color, {\"wg\": \"1\"} a gender."),
  include_facets: z.boolean().optional()
    .describe("Also return facets (filter groups with option values and counts). Still 1 credit."),
};

const { category_id: _c, ...gridNoCategory } = gridFields;
const { brand_id: _b, ...gridNoBrand } = gridFields;
const { seller_id: _s, ...gridNoSeller } = gridFields;

const productRef = {
  content_id: id("A product's content id (items[].content_id, the number after -p- in a product link), e.g. 975557855. Alternative to url."),
  url: z.string().min(10).max(1000).optional()
    .describe("A product link of any Trendyol storefront (alternative to content_id; a language-only path like /en/... needs country)."),
};

export function registerTrendyolTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/trendyol/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_trendyol",
    `Search Trendyol (Turkey's largest online marketplace, plus its international storefronts) by keyword, sorted by recommended, price, newest, best seller, most favourited or most rated, and filtered by price, brand, category, seller, rating, free shipping, rush delivery, discount, lowest-price badge, seller type, flash sale, coupon or any facet. ${GRID} ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, in the market's language, e.g. 'telefon' (tr), 'kleid' (de)."),
      country: country(),
      language: language(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_trendyol_product",
    `One Trendyol product by content id or link, with the buy-box seller and every other seller's offer: content_id, product_group_id, product_code, name, brand (id, name, url), category (id, name, path, tree), url, price, original_price, discount_percent, rrp, currency, lowest_price_badge (days and the site's text), in_stock, running_out, max_per_order, color, options, variants (attribute such as size, value, item_number, in_stock, price, barcode, selected), attributes (name, value, starred), images, rating, rating_count, review_count, favourite_count, category_rankings, buy_box (seller id, name, score out of 10, badges such as fast_seller, city, country, cash_on_delivery, corporate_invoice; listing_id, item_number, prices, free_shipping, rush_delivery_hours, flash_sale, has_coupon), other_sellers (every other seller's offer: seller id, name, score, badges; listing_id, item_number, prices, currency, free_shipping, rush_delivery, lowest_price_badge, promotions), other_seller_count, promotions (cargo thresholds, multi-buy deals), returnable, max_installments, vat_percent, has_description and, with include_description, description (text and HTML). Trendyol's developer FAQ says the buy box is chosen by algorithm metrics, not price alone, so another seller can be cheaper: compare other_sellers. The seller's legal disclosure (registered e-mail, tax number, address) is not returned. A product unknown, or not sold on that storefront, is a charged 404 (international storefronts list a part of the Turkish catalog). Reviews: get_trendyol_reviews; coupons: get_trendyol_coupons; delivery: get_trendyol_delivery. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      ...productRef,
      country: country(),
      language: language(),
      include_description: z.boolean().optional()
        .describe("Also return the seller's description (text and HTML). Still 1 credit."),
    },
    post("product"),
  );

  server.tool(
    "get_trendyol_category",
    `One Trendyol category's products by category id or link (send one), with the search sorts and filters. Category ids are the same on every market. ${GRID} Also category (id, name in the request language, url). An unknown category is a charged 404. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      category_id: id("A category id (103498 phones, 56 dresses; the same id on every market)."),
      url: z.string().min(10).max(1000).optional()
        .describe("A category link (<name>-x-c<id>), alternative to category_id."),
      country: country(),
      language: language(),
      ...gridNoCategory,
    },
    post("category"),
  );

  server.tool(
    "get_trendyol_brand",
    `One brand's products on Trendyol by brand id or link (send one), with the search sorts and filters. ${GRID} Also brand (id, name, url). An unknown brand is a charged 404. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      brand_id: id("A brand id (items[].brand.id, e.g. 794 Samsung)."),
      url: z.string().min(10).max(1000).optional()
        .describe("A brand link (<brand>-x-b<id>), alternative to brand_id."),
      country: country(),
      language: language(),
      ...gridNoBrand,
    },
    post("brand"),
  );

  server.tool(
    "get_trendyol_reviews",
    `A Trendyol product's reviews: content_id, rating, rating_count, review_count, photo_review_count, rating_histogram (5 to 1), topics (what reviews talk about, e.g. delivery time, packaging, price, with positive / negative counts and positive_percent), sizes (sizes bought), review_summary (Trendyol's own summary of the reviews, labelled with its source) and reviews (id, rating, text, date, updated_at, likes, author as the site shows it, already masked, verified_buyer, elite, influencer, seller, size, fit, variant, language, photos), count, page, page_size (up to 50), total_pages. Sorted recommended, newest, oldest, rating_desc or rating_asc; filtered by star rating or photos. Reviewer height and weight are never returned. International storefronts list the reviews written in their language. ${MARKETS} ${CHARGE}`,
    {
      ...productRef,
      country: country(),
      language: language(),
      page: z.number().int().min(1).max(500).optional().describe("Page, 1-based."),
      page_size: z.number().int().min(1).max(50).optional().describe("Reviews per page, 1 to 50 (default 20)."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("recommended (default, the site's order), newest, oldest, rating_desc or rating_asc."),
      rating: z.number().int().min(1).max(5).optional().describe("Only reviews with this many stars."),
      with_media: z.boolean().optional().describe("Only reviews with photos."),
    },
    post("reviews"),
  );

  server.tool(
    "get_trendyol_questions",
    `A Trendyol product's answered seller questions ("Saticiya Sor"): questions (id, text, date, verified_buyer, answer with text, answered_in as the site words it and seller id and name; original_text when Trendyol translated it), topics, total, total_asked, count, page, page_size (up to 20), total_pages. Askers are not named. ${MARKETS} ${CHARGE}`,
    {
      ...productRef,
      country: country(),
      language: language(),
      page: z.number().int().min(1).max(500).optional().describe("Page, 1-based."),
      page_size: z.number().int().min(1).max(20).optional().describe("Questions per page, 1 to 20 (default 20)."),
    },
    post("questions"),
  );

  server.tool(
    "get_trendyol_seller",
    `A Trendyol seller's store profile by seller id or store link (send one): seller (id, name, score with score_scale 10, product_count, follower_count, followers_text, follower_coupon, badges, ranking, city, on_trendyol_for, average_shipping_time, question_response_time, average_product_rating, average_seller_rating, corporate_invoice, metrics as the site words them, logo, store_url) and, with include_products, the seller's products as a grid (${ITEM}; search sorts and filters, query). No e-mail, tax number, address or legal name. An unknown seller is a charged 404. ${MARKETS} ${CHARGE}`,
    {
      seller_id: id("A seller id (items[].seller.id, buy_box.seller.id, other_sellers[].seller.id), e.g. 4473."),
      url: z.string().min(10).max(1000).optional()
        .describe("A seller store link (/magaza/<name>-m-<id>, or /store/<name>-m-<id> on international storefronts), alternative to seller_id."),
      country: country(),
      language: language(),
      include_products: z.boolean().optional()
        .describe("Also return the seller's products as a grid (page, sort, query and the search filters apply). Still 1 credit."),
      query: z.string().min(1).max(200).optional()
        .describe("Search within the seller's products (with include_products)."),
      ...gridNoSeller,
    },
    post("seller"),
  );

  server.tool(
    "get_trendyol_deals",
    `Trendyol's flash deals or super discounts as a grid. type flash: slots (tag, status active or upcoming, date, start, end; tags are dated) and the active slot's items, or a chosen slot's (an upcoming slot lists no items until it opens); type super_discounts: Super Firsatlar, campaign items at a 10 / 14 / 30-day low and at least 30% off. Search sorts and filters apply. ${GRID} ${PRICES} Turkish storefront only (international storefronts run no flash or super-discount pages: 400). ${CHARGE}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("flash (default: Trendyol's flash deals, the live slot unless slot is sent) or super_discounts (Super Firsatlar)."),
      slot: z.string().min(10).max(200).optional()
        .describe("A flash slot tag from slots[].tag of a previous answer (slot tags are dated), e.g. 'fs_15_11_2026_21_24'."),
      country: country(TR_ONLY),
      language: language(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_trendyol_coupons",
    `The collectable coupons for one Trendyol product's listing (the buy box, or seller_id's listing): coupons (id, discount, discount_type amount or percent, discount_amount, discount_percent, max_discount, min_basket, currency, valid_until (Turkey time), issued_by, seller_id, link, mega_coupon, plus_members_only, messages such as days or coupons left, collectable), count and product (name, seller, price, currency). Coupons belong to each seller's listing: the buy box often has none while another seller has some, so pass other_sellers[].seller.id of get_trendyol_product as seller_id. Turkish storefront only (international storefronts answered no coupons: 400). ${CHARGE}`,
    {
      ...productRef,
      seller_id: id("Which seller's listing to read coupons for (default the buy box; another seller from other_sellers[].seller.id), e.g. 1188867."),
      country: country(TR_ONLY),
      language: language(),
    },
    post("coupons"),
  );

  server.tool(
    "get_trendyol_rankings",
    `A Trendyol category's top-100 list (En Cok Satanlar): best_seller, most_favourited, most_rated or top_viewed, 20 per page (5 pages): ranking, category (id, name), items (rank, content_id, listing_id, name, brand, url, image, images, price, original_price, discount_percent, currency, lowest_price_badge, badges, promotions, rating, review_count, in_stock, running_out, seller), count, total, page, page_size, total_pages. category_id is required. Not on the English-language EU storefronts (fr, be, hr, dk, ee, fi, it, lv, lt, nl, pt, si, es, se, lu), which have no ranking lists: 400 there. ${PRICES} ${MARKETS} ${CHARGE}`,
    {
      category_id: z.union([z.string(), z.number()])
        .describe("A category id (required): 56 dresses, 103498 phones, 1156 lipsticks."),
      ranking: z.enum(RANKINGS).optional()
        .describe("best_seller (default), most_favourited, most_rated or top_viewed."),
      page: z.number().int().min(1).max(5).optional().describe("Page of 20, 1 to 5 (the top 100)."),
      country: country(RANKINGS_COUNTRIES),
      language: language(),
    },
    post("rankings"),
  );

  server.tool(
    "get_trendyol_suggestions",
    `Trendyol's search-box suggestions for a partial query: query, suggestions (text, type keyword / category / brand / store / other, site_type as the site labels it, url, category_ids, seller_id, brand_id, image), count. ${MARKETS} ${CHARGE}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'iph'."),
      country: country(),
      language: language(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_trendyol_delivery",
    `Delivery estimate for one Trendyol product variant from every seller listing it: content_id, item_number, city_id, district_id, time_zone (dates are local), listings (listing_id, seller, buy_box, delivery start and end, ships_by, ships_in_days, fast_options, tomorrow_shipping_cutoff, same_day_shipping_cutoff, rush_delivery_hours, agreed_delivery_days, local_delivery, carriers), count. On the Turkish storefront city_id and district_id narrow the estimate to an address (Istanbul 133, Sisli 54; there is no city list endpoint). Without item_number and listing_id the product is read first for the buy box (still 1 credit). No pickup points. ${MARKETS} ${CHARGE}`,
    {
      ...productRef,
      item_number: id("The variant (variants[].item_number or buy_box.item_number); default the buy box's."),
      listing_id: z.string().length(32).optional()
        .describe("The listing the site treats as the default (buy_box.listing_id); default the buy box's. With item_number the product is not read first."),
      city_id: id("A Turkish city id (tr only; Istanbul is 133)."),
      district_id: id("A district id of that city (tr only, needs city_id; Istanbul's Sisli is 54)."),
      country: country(),
      language: language(),
    },
    post("delivery"),
  );
}
