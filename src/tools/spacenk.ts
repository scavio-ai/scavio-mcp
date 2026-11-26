import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/spacenk.ts (markets uk, ie, nl, au; us, de and ca are refused with a 400). Rules the
// backend enforces and zod here does not: reviews take the product (master) id starting with M, not a shade / size
// id; stores take postcode or latitude + longitude (not both; latitude and longitude go together) and are UK only;
// offers take uk or ie only; reviews stay within 10,000 positions (page x page_size). Inputs the route marks
// "Not offered (400)" are not exposed: min_price / max_price (the site ignores a price filter), brand on the brand
// endpoint, skin_type on reviews. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const MARKET_CODES = ["uk", "ie", "nl", "au"] as const;
const SORTS = ["relevance", "best_sellers", "new", "our_favourites", "price_high_to_low", "price_low_to_high", "rating", "most_viewed", "discount", "brand"] as const;
const REVIEW_SORTS = ["newest", "most_helpful", "highest_rating", "lowest_rating"] as const;

const FIRST = "Space NK (spacenk.com, the London-based luxury beauty retailer, owned by Ulta Beauty)";
const MARKETS =
  "Markets (market, default uk): uk (United Kingdom, GBP), ie (Ireland, EUR), nl (Netherlands, EUR, Dutch copy), au (Australia, AUD), each in its own currency as Space NK prices it. Not offered (400, not charged): us (Space NK's US path shows UK prices), de, ca.";
const BILL = "Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const ONE = `Costs 1 credit (credits_used is what was charged). ${BILL}`;
const TILE =
  "product_id, sku (the shade / size the tile shows), name, brand, url, image, price, list_price (struck-through price), currency, on_sale, discount_badge (e.g. 25% OFF), promo_badges (e.g. FREE GIFT), badges (e.g. Trending this week, new shade), rating, review_count, in_stock, availability, stock_count (online stock of the shade / size shown)";
const LIST = `market, page, page_size (36), sort, full, total, total_pages, has_more, count, items [{${TILE}}], more_product_ids (the page's other products when full is false), notes`;
const LIST_COST =
  "1 credit with full false (the first 12 products of the 36-product page in full, the other 24 as ids in more_product_ids); full: true fills all 36 at up to 5 credits (one extra call per product filled, billed on what was spent: credits_used).";
const NOT_AVAILABLE =
  "Not available: the US market (Space NK's US path shows UK prices), a price filter (the site ignores it; sort by price instead), store stock counts (stores give Space NK's in-store flag only), price history (poll and store the answers), cart or checkout.";

const market = z.enum(MARKET_CODES).optional()
  .describe("uk (United Kingdom, GBP, default), ie (Ireland, EUR), nl (Netherlands, EUR, Dutch copy) or au (Australia, AUD).");
const brandFilter = z.union([z.string().max(80), z.array(z.string().max(80)).max(10)]).optional()
  .describe("Only these brands, by name as Space NK shows it (items[].brand or brands[].name, e.g. Medik8, Drunk Elephant); one name or a list of up to 10.");
const listing = {
  page: z.number().int().min(1).max(300).optional()
    .describe("Page, 1-based (36 products a page; default 1; at most 300)."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), best_sellers, new, our_favourites, price_high_to_low, price_low_to_high, rating (highly reviewed), most_viewed, discount, brand: Space NK's own sorts."),
  full: z.boolean().optional()
    .describe("Fill all 36 products of the page in full (default false: the first 12 in full, the other 24 as ids in more_product_ids). Up to 5 credits."),
  market,
};
const productId = z.string().max(20)
  .describe("A Space NK product id (items[].product_id, e.g. MUK200057800) or one shade / size (variants[].id, e.g. UK200057805).");

export function registerSpacenkTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/spacenk/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_spacenk",
    `Search the products of ${FIRST} by keywords, with paging (36 a page), Space NK's ten sorts and a brand filter. Returns query, ${LIST}. Captured 2026-11-26: "vitamin c" on uk returned 367 products, led by Augustinus Bader The Vitamin C Serum at 217.5 GBP (list_price 290, 25% OFF); "serum" on nl returned 849 products in EUR with Dutch copy. ${MARKETS} ${LIST_COST} ${BILL} ${NOT_AVAILABLE}`,
    {
      query: z.string().min(1).max(200).describe("Keywords or a brand (e.g. vitamin c serum)."),
      brand: brandFilter,
      ...listing,
    },
    post("search"),
  );

  server.tool(
    "get_spacenk_category",
    `One category of ${FIRST} by category id (black-friday is the Black Friday list), with paging, sorts and the brand filter. Returns category_id, ${LIST}. Captured 2026-11-26: black-friday listed 7,607 products on uk. An unknown category id is a charged 404. ${MARKETS} ${LIST_COST} ${BILL}`,
    {
      category_id: z.string().max(80)
        .describe("A Space NK category id (e.g. black-friday, skincare-treatment-serum, makeup-complexion-foundation)."),
      brand: brandFilter,
      ...listing,
    },
    post("category"),
  );

  server.tool(
    "get_spacenk_brand",
    `One brand's products on ${FIRST} by brand id (brands[].id from get_spacenk_brands), with paging and sorts. Returns brand_id, ${LIST}. Captured 2026-11-26: medik8 listed 71 products on uk. An unknown brand id is a charged 404. ${MARKETS} ${LIST_COST} ${BILL}`,
    {
      brand_id: z.string().max(80)
        .describe("A brand id from get_spacenk_brands (brands[].id, e.g. medik8, Charlotte Tilbury)."),
      ...listing,
    },
    post("brand"),
  );

  server.tool(
    "get_spacenk_brands",
    `Every brand ${FIRST} lists, A-Z: market, letter, total, count, brands [{id (the input of get_spacenk_brand), name (the value of the brand filter), url, letter}], notes. Captured 2026-11-26: 245 brands on uk. ${MARKETS} ${ONE}`,
    {
      letter: z.string().max(1).optional().describe("Only brands under this letter (A-Z or #)."),
      market,
    },
    post("brands"),
  );

  server.tool(
    "get_spacenk_product",
    `One product of ${FIRST} by product id or shade / size id: product_id, master_id, type (master or variant), ean, name, brand, url, price, list_price, currency, price_text, in_stock, availability, availability_message, stock_count (online stock of one shade / size), orderable, button (ADD_TO_BAG or NOTIFY_ME), size {quantity, unit}, short_description, description, key_benefits, how_to_use, kit_contents, ingredients, rating, review_count, images, variant_attribute (color or size), variant_counts, variants [{id, attribute, name, in_stock, availability, in_stock_date, selectable, selected, swatch_colour}], promotions [{id, name, callout, details, type, gift_product_id}], badges {offers, gift, trade}, category_path, skin_suitability, restricted_shipping, hazmat, coming_soon, notes. Captured 2026-11-26: TAKAMI Vitamin B3+ Spot Serum (UK200064992, 30 ML) at 43.5 GBP (list_price 58) with stock_count 57 on uk; Charlotte Tilbury Airbrush Flawless Foundation (MUK200057800) at 59 AUD (list_price 78) on au, 43 shades in stock. An id Space NK does not answer for is an uncharged 502. ${MARKETS} ${ONE}`,
    { product_id: productId, market },
    post("product"),
  );

  server.tool(
    "get_spacenk_reviews",
    `Customer reviews of one product on ${FIRST}: one English review pool shown on every market. Paging up to 100 a page, four sorts, a star filter and text search. Returns product_id, page, page_size, sort, total, total_pages, has_more, count, rating_distribution, reviews [{id, rating, title, text, submitted_at, recommended, syndicated, syndication_source {name, url}, helpful_votes, unhelpful_votes, context {skin_type, skin_tone, best_use, sensitive_skin}, tags}], notes. Reviewer names, locations and photos are not returned. Takes the product (master) id starting with M (items[].product_id or the product's master_id), not a shade / size id. Captured 2026-11-26: Charlotte Tilbury Airbrush Flawless Foundation (MUK200057800) had 269 reviews (184 five-star). A skin-type filter is not offered (each review's context.skin_type says it). ${ONE}`,
    {
      product_id: z.string().max(20)
        .describe("The product id starting with M (items[].product_id or get_spacenk_product's master_id, e.g. MUK200057800): reviews are kept per product, not per shade / size."),
      page: z.number().int().min(1).optional().describe("Page, 1-based (default 1). At most 10,000 positions (page x page_size)."),
      page_size: z.number().int().min(1).max(100).optional().describe("Reviews a page, 1-100 (default 20)."),
      sort: z.enum(REVIEW_SORTS).optional().describe("newest (default), most_helpful, highest_rating, lowest_rating."),
      stars: z.union([z.number().int().min(1).max(5), z.array(z.number().int().min(1).max(5)).max(5)]).optional()
        .describe("Only reviews with these star ratings (one, or a list such as [1, 2])."),
      search: z.string().max(100).optional().describe("Only reviews containing this text (e.g. shade)."),
      market,
    },
    post("reviews"),
  );

  server.tool(
    "get_spacenk_suggestions",
    `What ${FIRST} suggests for what a shopper has typed: brands [{name, url}], categories [{name, url}], articles (ids of editorial articles), products [{${TILE}}]. ${MARKETS} ${ONE}`,
    {
      query: z.string().min(1).max(100).describe("What a shopper has typed (e.g. charlotte)."),
      market,
    },
    post("suggestions"),
  );

  server.tool(
    "get_spacenk_stores",
    `Space NK's UK stores nearest a postcode or point, for one product, from ${FIRST}. Returns product_id, location, count, stores [{store_id, name, address, city, region, postcode, country, latitude, longitude, phone, opening_hours [{day, hours}], distance_miles, in_store_available (Space NK's in-store flag for the product, not a count), click_collect_available, click_collect_label (e.g. Click & Collect from Monday 7th December), express_available}], notes. UK only (market uk): send a full UK postcode, or latitude + longitude, not both. Captured 2026-11-26: 5 stores within 1.3 miles of W1D 1BS for TAKAMI Vitamin B3+ Spot Serum, nearest 0.3 miles away. Store stock counts are not available. ${ONE}`,
    {
      product_id: productId,
      postcode: z.string().max(10).optional().describe("A full UK postcode (e.g. W1D 1BS). Send postcode or latitude + longitude."),
      latitude: z.number().optional().describe("With longitude instead of postcode: a point in the UK (e.g. 51.4545)."),
      longitude: z.number().optional().describe("With latitude (e.g. -2.5879)."),
      limit: z.number().int().min(1).max(20).optional().describe("Stores to return, nearest first, 1-20 (default 10)."),
      market: z.enum(["uk"]).optional().describe("uk only (default): Space NK's stores are in the UK."),
    },
    post("stores"),
  );

  server.tool(
    "get_spacenk_offers",
    `The gifts with purchase on the offers page of ${FIRST}, uk or ie. Returns market, title, validity (the page's own line, e.g. Ends 30th November at 11.45pm (GMT)), terms_url, count, offers [{brand, gift, condition, spend_threshold {amount, currency}, brand_url, image}], notes. Captured 2026-11-26: 70 brand gifts on uk, such as a full-size gift when you spend 40 GBP on a brand. The nl and au offers pages show the UK offers in GBP, so only uk and ie are taken (400 otherwise, not charged). ${ONE}`,
    {
      market: z.enum(["uk", "ie"]).optional().describe("uk (default) or ie: the nl and au offers pages show the UK offers in GBP."),
    },
    post("offers"),
  );
}
