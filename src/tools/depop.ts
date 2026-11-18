import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/depop.ts (depop.com buyer markets us, gb,
// au, ie, ca, nz, de, fr, it; country defaults to us). Markets per tool follow
// DEPOP_ENDPOINT_COUNTRIES: search, product, category, brand, explore and
// suggestions on all 9; similar us only; shop, shop-products, shop-sold,
// shop-reviews, shops-search, categories and brands are global (no country).
// Cross-field rules the backend enforces and zod here does not: product takes
// exactly one of slug, url or product_id; the shop tools one of shop_id or
// username; brands one of letter or slug; a market a tool does not serve
// answers 400 before anything is charged. No zod `.default()`: the MCP SDK
// would post a defaulted field on every call.

const MARKETS = ["us", "gb", "uk", "au", "ie", "ca", "nz", "de", "fr", "it"] as const;
const SORTS = ["relevance", "price_asc", "price_desc"] as const;
const CONDITIONS = ["brand_new", "used_like_new", "used_excellent", "used_good", "used_fair"] as const;
const COLORS = [
  "black", "blue", "brown", "burgundy", "cream", "gold", "green", "grey", "khaki", "multi",
  "navy", "orange", "pink", "purple", "red", "silver", "tan", "white", "yellow",
] as const;
const GENDERS = ["male", "female", "unisex"] as const;
const LANGUAGES = ["en", "en-US", "de", "fr", "it"] as const;
const ROLES = ["seller", "buyer"] as const;

const charge = (n: string) => `Costs ${n}. Failed upstream calls are not charged; a not-found is charged.`;
const LIST_CREDITS = charge("1 credit on us, gb, au, ie, ca, de, fr, it and 5 on nz");
const FIRST_24 =
  "Only the first 24 results per query: Depop serves no next page, so narrow with filters, sort or a price range to reach more listings. price_asc / price_desc return Depop's first 24 for that order, in strict listing-price order (listings priced in another currency than the market's come last).";
const PRICES =
  "Prices are numbers as Depop shows them to a buyer in the market: price (the listing price), original_price (the seller's own original price before a markdown; seller-set, it can be far above price), buyer_fee, tax (tax_type, e.g. UK_IMPORT_VAT), shipping (the shipping the buyer pays; shipping_boundary national / international, as Depop rates the listing's country against the market), total (computed by Scavio: price + buyer_fee + tax + shipping) and headline_price (the price Depop itself headlines in that market: on us it leaves out shipping, on gb it includes the fee and shipping). The same listing shows a different total in each market. price.currency is the listing's currency, usually the market's (a few sellers list in another one, e.g. USD or GBP on ca, ie, de, fr, it). On us Depop returns a buyer fee on some calls and not on others for the same listing: report what it returns.";
const MARKET_PRICE =
  "buyer_market_price is true when the listing is priced in the market's currency. false: the listing is priced in another currency (often a seller in the market who lists in USD or GBP) and Depop shows it unconverted, with the listing's own price block; get_depop_product returns the same block, so no price in the market's currency exists for it. List items carry no seller country: get_depop_product has seller.country.";
const TEXT =
  "Depop's interface is English on every market; titles and descriptions are what sellers wrote (often the local language on de, fr, it).";
const ITEM =
  "product_id, slug, url, title, description, brand (id, name, slug), category, group, product_type, status, pictures (first 3) and picture_count, sizes, condition, colors, gender, kids, like_count, boosted, discounted, discount_percentage, price";
const MARKET_ITEM = `${ITEM}, buyer_market_price`;
const LIST_OUT = `items (${MARKET_ITEM}; status on_sale), count, total_count (Depop's approximate count of matches), country, currency, sort, filters`;
const NOT_AVAILABLE =
  "Not available: results past the first 24, keyword search of sold listings (Depop has none: sold prices come per shop from get_depop_shop_sold), trending searches, views, join date, Top Seller badge, offers / bundles, price history.";

const market = (markets: readonly string[] = MARKETS) =>
  z.enum(markets as [string, ...string[]]).optional().describe(
    markets.length === 1
      ? "Buyer market: us only (USD; the default). Any other value answers 400 before anything is charged."
      : "Buyer market (default us): us (USD), gb (GBP; uk accepted), au (AUD), ie (EUR), ca (CAD), nz (NZD), de (EUR), fr (EUR), it (EUR). Results and prices are what a buyer in that country sees. Any other country answers 400 before anything is charged.",
  );

const numId = (description: string) =>
  z.union([z.number().int().positive(), z.string().regex(/^\d{1,12}$/)]).describe(description);
const strList = (description: string) =>
  z.union([z.string().min(1).max(300), z.array(z.string().min(1).max(60)).min(1).max(20)]).optional().describe(description);

const filters = {
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price_asc, price_desc. Newest and most popular orders are not available."),
  brand_ids: z.union([z.string().min(1).max(200), z.array(z.union([z.string(), z.number()])).min(1).max(20)]).optional()
    .describe("Brand ids (brands[].id of get_depop_brands, items[].brand.id), up to 20, e.g. [1673] Carhartt."),
  conditions: strList(`Conditions: ${CONDITIONS.join(", ")}.`),
  colors: strList(`Colours: ${COLORS.join(", ")}.`),
  price_min: z.number().min(0).optional().describe("Lowest listing price, in the market's currency."),
  price_max: z.number().min(0).optional().describe("Highest listing price, in the market's currency."),
  on_sale: z.boolean().optional().describe("Only listings the seller marked down (items[].discounted)."),
  gender: z.enum(GENDERS).optional().describe(`${GENDERS.join(", ")}.`),
  size: strList("Size filter values (size_set_id.size_id, from get_depop_categories with include_sizes), e.g. '4.15'. Depop honours it only partly."),
};
const groupFilters = {
  group: z.string().min(2).max(60).optional()
    .describe("Group id from get_depop_categories (tops, bottoms, footwear ...)."),
  product_type: strList("Product type ids from get_depop_categories (jeans, hoodies ...)."),
  kids: z.boolean().optional().describe("Only kids' listings (true) or none (false)."),
};

const shopRef = {
  shop_id: numId("Shop id (shop_id of get_depop_shop, seller.id of get_depop_product).").optional(),
  username: z.string().min(1).max(64).optional().describe("Shop username (depop.com/<username>/), e.g. 'flomem'."),
};
const shopPaging = {
  cursor: z.string().min(1).max(300).optional().describe("next_cursor of the previous page."),
  limit: z.number().int().min(1).max(24).optional().describe("Listings per page, 1 to 24 (default 24)."),
};

export function registerDepopTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/depop/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_depop",
    `Search Depop listings for sale in one buyer market: ${LIST_OUT}, facets (counts per department / group / product type, brand, colour, condition, size). Sorts relevance, price_asc, price_desc. Filters: brand_ids, conditions, colors, price_min / price_max, on_sale (marked down), gender, group / product_type (ids from get_depop_categories), kids, size. Listing ids are global; search shows that market's sellers. ${FIRST_24} ${PRICES} ${MARKET_PRICE} ${TEXT} ${NOT_AVAILABLE} ${LIST_CREDITS}.`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. 'levis 501'."),
      country: market(),
      ...filters,
      ...groupFilters,
    },
    post("search"),
  );

  server.tool(
    "get_depop_product",
    `One Depop listing by slug, link or product_id, priced for a buyer in the market: product_id, slug, url, status (on_sale, sold), title, description, hashtags, brand, category (group, product type, breadcrumbs with the category path), condition, colors, sizes, gender, kids, pictures, like_count, boosted, quantity, shipping (method, parcel_size, payer, free_shipping, national_cost: the seller's domestic shipping rate, which can differ from price.shipping, the shipping the buyer pays), discounted, discount_percentage, price (buyer market), listing_price (the seller's own currency and price), seller (id, username, url, verified, country: the seller account's country, reviews_rating, reviews_total, items_sold, last_seen, average_shipping_days). Listing ids and slugs are global: the same listing priced from another market shows that buyer's fee, tax and shipping, in the listing's own currency. No seller names or city, no views or listing date (get_depop_shop_products has created_at / updated_at). ${PRICES} ${TEXT} ${charge("1 credit on us, 2 on gb, au, ie, ca, de, fr, it and 6 on nz")}`,
    {
      slug: z.string().min(3).max(200).optional()
        .describe("Listing slug (items[].slug), e.g. 'f0omem-levis-550-38x36-blue-jeans-662f'."),
      url: z.string().min(20).max(400).optional()
        .describe("A depop.com product link (https://www.depop.com/products/<slug>/); the market is country, not the link."),
      product_id: numId("Product id (items[].product_id), e.g. 1002884801.").optional(),
      country: market(),
    },
    post("product"),
  );

  server.tool(
    "get_depop_category",
    `The first 24 listings of one Depop category (path from get_depop_categories, e.g. mens/bottoms/jeans) in a buyer market: ${LIST_OUT}, category. Sorts relevance, price_asc, price_desc. Filters: brand_ids, conditions, colors, price_min / price_max, on_sale, size; gender on kids. ${FIRST_24} ${PRICES} ${MARKET_PRICE} ${TEXT} ${LIST_CREDITS}.`,
    {
      category: z.union([z.string().min(3).max(120), z.array(z.string().min(1).max(60)).min(1).max(3)])
        .describe("Category path department[/group[/product_type]] (mens, womens, kids, everything-else), e.g. 'mens/bottoms/jeans', 'womens/tops', 'kids'."),
      country: market(),
      ...filters,
      ...groupFilters,
    },
    post("category"),
  );

  server.tool(
    "get_depop_brand",
    `The first 24 listings of one Depop brand (slug from get_depop_brands) in a buyer market: brand (id, name, slug), ${LIST_OUT}. An unknown brand is a charged 404. Sorts relevance, price_asc, price_desc; filters as search_depop (no brand_ids). ${FIRST_24} ${PRICES} ${MARKET_PRICE} ${TEXT} ${LIST_CREDITS}.`,
    {
      slug: z.string().min(1).max(120).describe("Brand slug (brands[].slug, items[].brand.slug), e.g. 'carhartt', 'levi-s', 'nike'."),
      country: market(),
      ...filters,
      ...groupFilters,
    },
    post("brand"),
  );

  server.tool(
    "get_depop_explore",
    `One of Depop's curated explore pages (slug, e.g. 90s-menswear) in a buyer market: title, search_query (the search the page runs), the first 24 listings (${MARKET_ITEM}; status on_sale), count, total_count, and more_slugs (the market's other explore pages). An unknown page is a charged 404. ${FIRST_24} ${PRICES} ${MARKET_PRICE} ${TEXT} ${LIST_CREDITS}.`,
    {
      slug: z.string().min(1).max(120)
        .describe("Explore page slug (depop.com/explore/<slug>/), e.g. '90s-menswear', '90s-womenswear'. Every answer lists the market's other pages in more_slugs."),
      country: market(),
    },
    post("explore"),
  );

  server.tool(
    "get_depop_suggestions",
    `Depop search suggestions for a partial query, ranked for a buyer market: suggestions (text, group, gender, filter_label such as "in Men's Footwear"), count. ${charge("1 credit on every market")}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'carh'."),
      country: market(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_depop_shop",
    `A Depop shop (seller) by username or shop_id: shop_id, username, url, bio, verified, followers, following, reviews_rating, reviews_total, seller_ratings, buyer_ratings, items_sold, last_seen, category_counts (listings per department and category). Shop data is global (no country). No real names or avatars; Depop shows no join date or Top Seller badge here. An unknown shop is a charged 404. ${charge("1 credit")}`,
    { ...shopRef },
    post("shop"),
  );

  server.tool(
    "get_depop_shop_products",
    `A Depop shop's listings for sale, paged by cursor (up to 24 per page): shop (shop_id, username), items (${ITEM}, created_at, updated_at; status on_sale), count, has_more, next_cursor. Prices are in the seller's listing currency; shop lists carry no buyer_market_price. Global (no country). ${charge("1 credit per page")}`,
    { ...shopRef, ...shopPaging },
    post("shop-products"),
  );

  server.tool(
    "get_depop_shop_sold",
    `A Depop shop's sold listings with the price they sold at (price, original_price, discounted, discount_percentage), paged by cursor (up to 24 per page): shop, items (${ITEM}, created_at, updated_at; status sold = sold on Depop, marked_as_sold = the seller marked it sold, which may be outside Depop, so its price may not be a Depop sale), count, has_more, next_cursor. updated_at is the listing's last update: Depop shows no sale date. Prices are in the seller's listing currency. This is Depop's only sold data: sold prices come per shop, there is no keyword search of sold listings. Global (no country). ${charge("1 credit per page")}`,
    { ...shopRef, ...shopPaging },
    post("shop-sold"),
  );

  server.tool(
    "get_depop_shop_reviews",
    `Reviews a Depop shop received as a seller (role seller, default) or as a buyer (role buyer), 24 per page: shop, role, page, reviews (date, rating, text, product with product_id and image), count, has_more. Reviewer names are not returned. Global (no country). ${charge("1 credit per page")}`,
    {
      ...shopRef,
      role: z.enum(ROLES).optional()
        .describe("seller (default: reviews the shop got from buyers) or buyer (reviews it got from sellers)."),
      page: z.number().int().min(1).max(200).optional().describe("Page, 1-based, 24 reviews each."),
    },
    post("shop-reviews"),
  );

  server.tool(
    "search_depop_shops",
    `Depop shops whose username matches a query: shops (shop_id, username, url), count. Use get_depop_shop for a shop's ratings and items sold. Global (no country). ${charge("1 credit")}`,
    {
      query: z.string().min(1).max(100).describe("Part of a shop username, e.g. 'y2k'."),
    },
    post("shops-search"),
  );

  server.tool(
    "get_depop_categories",
    `Depop's category tree: departments (id, name, path) > groups (id, name, path) > product_types (id, name, path), count. path is the input of get_depop_category; group and product type ids are search filters. Group and product type names in en, en-US, de, fr or it; department names in English. include_sizes adds size_sets (size systems per department with size filter values). Global (no country). ${charge("1 credit")}`,
    {
      language: z.enum(LANGUAGES).optional().describe("Names of groups and product types: en (default), en-US, de, fr, it."),
      include_sizes: z.boolean().optional().describe("Add size_sets (size systems and their size filter values). Larger answer."),
    },
    post("categories"),
  );

  server.tool(
    "get_depop_brands",
    `Depop brands by first letter (a-z, 0-9): letter, brands (id, name, slug), count; or one brand by slug with its description. slug is the input of get_depop_brand, id the brand_ids filter. An unknown slug is a charged 404. Global (no country). ${charge("1 credit")}`,
    {
      letter: z.string().min(1).max(3).optional()
        .describe("First letter a-z, or 0-9 for brands starting with a digit or symbol, e.g. 'c'."),
      slug: z.string().min(1).max(120).optional().describe("One brand by slug (with its description)."),
    },
    post("brands"),
  );

  server.tool(
    "get_depop_similar",
    `Listings Depop shows as similar to one listing, for a US buyer: product_id, items (${MARKET_ITEM}, created_at, updated_at), count. Market: us only. ${PRICES} ${MARKET_PRICE} ${charge("1 credit")}`,
    {
      product_id: numId("Product id (items[].product_id), e.g. 1002884801."),
      country: market(["us"]),
    },
    post("similar"),
  );
}
