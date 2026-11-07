import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/nordstrom.ts. Cross-field rules the backend
// enforces and zod here does not: product, availability and reviews take url
// OR style_id; stores takes exactly one of zip, latitude+longitude or
// store_numbers; reviews rejects sort together with search. No zod `.default()`: the MCP SDK would post a defaulted field
// on every call.

const SORTS = ["relevance", "rating", "price_high", "price_low", "newest", "percent_off"] as const;
const REVIEW_SORTS = ["most_helpful", "most_recent", "highest_rated", "lowest_rated"] as const;

const LISTING_FIELDS = `Each product has the same fields as a search_nordstrom result: style id, URL, name, brand, image, current price and price range in dollars, original price range, percent off and on-sale flag, rating, review count, badges, a low-inventory flag, marketplace seller and every color. Also returns the total result count, page count, and the filter sidebar: each filter group (Product Type > Clothing, Size > Women's Clothing, Color, Brand, Discount...) with its options and product counts (price buckets carry no count on the site, so theirs are null; groups with more than 100 options, such as Brand, list the 100 with the most products and give the full option_count).`;

const page = () => z.number().int().min(1).max(100).optional()
  .describe("Results page, 1-based. Defaults to 1. 24 products per page.");
const sort = () => z.enum(SORTS).optional()
  .describe("relevance (default), rating, price_high, price_low, newest or percent_off.");

export function registerNordstromTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/nordstrom/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_nordstrom",
    `Search nordstrom.com (US) products, 24 per page, sorted by relevance, rating, price, newest or percent off. Each result has style id, URL, name, brand, image, current price and price range in dollars, original price range, percent off and on-sale flag, rating, review count, badges such as new or new_markdown, a low-inventory flag, whether it is sold by a marketplace seller (and the seller's name), and every color with its color family and image. Also returns the total result count and page count. Use a result's url or style_id with get_nordstrom_product, get_nordstrom_reviews or get_nordstrom_availability. 5 credits/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Results page, 1-based. Defaults to 1. 24 products per page."),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), rating, price_high, price_low, newest or percent_off."),
    },
    post("search"),
  );

  server.tool(
    "get_nordstrom_product",
    `One nordstrom.com (US) product by URL or style id: name, brand, description, feature bullets, fit notes, final-sale flag, current, original and clearance price ranges, percent off, rating, review count, the star histogram, the size-fit distribution (too small to too big), the AI review summary when the site shows one, the most mentioned praised and criticized features with a quote each, breadcrumbs and images. Every color lists its images and every size as a sku with sku id, size, size type, UPC, price, original price, percent off, price type (regular, clearance, promotion), in_stock and the quantity available to ship. in_stock is true when the sku can be shipped or picked up in a store, so a sku held only in a store reads in stock with quantity 0 (get_nordstrom_availability lists its pickup stores). Includes the reviews shown on the product page (up to about 13), with the total review count; each review has title, text, rating, size rating, author, date, helpful votes and verified-purchase flag (get_nordstrom_reviews pages the full review history). An unknown style id is a 404. 5 credits.`,
    {
      url: z.string().min(1).max(500).optional()
        .describe("nordstrom.com product URL (the `url` of a search result)."),
      style_id: z.string().regex(/^\d{4,10}$/).optional()
        .describe("Nordstrom style id, the number at the end of a product URL (the `style_id` of a search result). Used when url is not given."),
    },
    post("product"),
  );

  server.tool(
    "get_nordstrom_category",
    `Browse a nordstrom.com (US) category page, 24 products per page, sorted by relevance, rating, price, newest or percent off. Works on any /browse category, including sale (sale/women), new arrivals (/browse/new) and top-level departments (/browse/women). Returns the category's name, page title, path, URL, breadcrumbs and subcategories (name and path, for drilling down). ${LISTING_FIELDS} An unknown category is a 404. 5 credits.`,
    {
      category: z.string().min(1).max(500)
        .describe("A nordstrom.com category: the /browse path or full URL of a category page, e.g. /browse/women/clothing/dresses, sale/women, /browse/new or https://www.nordstrom.com/browse/men/shoes. The /browse prefix is optional. Query parameters in a URL (filters) are ignored. Each result's category.subcategories lists child paths."),
      page: page(),
      sort: sort(),
    },
    post("category"),
  );

  server.tool(
    "get_nordstrom_brand",
    `List a brand's products on nordstrom.com (US) from its brand page, 24 per page, sorted by relevance, rating, price, newest or percent off. Returns the brand's name, path, URL, breadcrumbs and sub-pages (Women, Men, Kids...). ${LISTING_FIELDS} An unknown brand is a 404. 5 credits.`,
    {
      brand: z.string().min(1).max(500)
        .describe("A nordstrom.com brand: the /brands path or full URL of a brand page, usually ending in the brand id, e.g. /brands/astr-the-label--53360 (a product's brand_url works). A brand name without its id is a 404 except where it is the brand page's own path (/brands/ugg-australia). Sub-pages such as /brands/astr-the-label--53360/women work too."),
      page: page(),
      sort: sort(),
    },
    post("brand"),
  );

  server.tool(
    "get_nordstrom_stores",
    `Find Nordstrom stores (full-line stores and Nordstrom Local) near a US ZIP code or latitude/longitude within up to 100 miles, nearest first, or look stores up by store number. Pass exactly one of zip, latitude and longitude, or store_numbers. Each store has store number, name, type (full_line or local), address, city, state, ZIP, country, phone, weekly hours, holiday hours when posted, open and close times for the next 8 days, time zone, distance in miles, latitude and longitude, whether it offers buy-online pickup and curbside pickup, its amenities (restaurants and services, with phone and hours) and its store page URL. A ZIP with no store in range returns an empty list. 5 credits.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US ZIP code to search around, e.g. '10001'. Pass exactly one of zip, latitude and longitude, or store_numbers."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude to search around (with longitude)."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude to search around (with latitude)."),
      store_numbers: z.array(z.string().regex(/^\d{1,5}$/)).min(1).max(100).optional()
        .describe("Look up stores by number instead of location, up to 100 (a get_nordstrom_availability result's pickup_stores[].store_number), e.g. ['210', '220']."),
      distance_miles: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles around zip or latitude/longitude, 1-100 (the site's maximum). Defaults to 100."),
    },
    post("stores"),
  );

  server.tool(
    "get_nordstrom_availability",
    `Online and store-pickup availability for every size and color of one nordstrom.com (US) product, by URL or style id, optionally one sku. Each sku has sku id, size, color, UPC, in_stock, whether it ships and the quantity available to ship, the quantity available for pickup, and the stores where it can be picked up (store number, name, address, city, state, ZIP, phone). Quantities are chain-wide: per store Nordstrom only says whether pickup is available, not how many. in_stock is true when the sku can be shipped or picked up, so a sku with ship_quantity 0 can still be in stock for pickup. An unknown style id or sku id is a 404. 10 credits (the product page plus the store lookup).`,
    {
      url: z.string().min(1).max(500).optional()
        .describe("nordstrom.com product URL (the `url` of a search, category or brand result)."),
      style_id: z.string().regex(/^\d{4,10}$/).optional()
        .describe("Nordstrom style id, used when url is not given."),
      sku_id: z.string().regex(/^[A-Za-z0-9]{4,20}$/).optional()
        .describe("Only this sku (a product's colors[].skus[].sku_id), e.g. 'A7578713'. An id that is not a sku of the product is a 404."),
    },
    post("availability"),
  );

  server.tool(
    "get_nordstrom_suggestions",
    `The search-box autocomplete of nordstrom.com: the queries Nordstrom suggests for a partial search term, most likely first (e.g. "dre" -> women's dresses, dresses, cocktail dresses for women). Useful for keyword research and for building queries for search_nordstrom. 5 credits.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'nike air'."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Suggestions to return, 1-20. Defaults to 8. The site may return fewer."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_nordstrom_reviews",
    `Customer reviews of one nordstrom.com (US) product by URL or style id, up to 200 per call (default 60), sorted most helpful (default), most recent, highest rated or lowest rated, optionally filtered to star ratings, verified purchases, reviews with photos, or a text search. Returns the product's review summary (average rating, total reviews, star histogram, size rating 1 runs small to 5 runs big, width rating where the site has one, the most mentioned praised and criticized features with a quote each, and the count of rating-only reviews), the AI review summary when the site shows one, the number of reviews matching the filters (total_results), returned and has_more. Each review has id, title, text, star rating, size rating, author, date, helpful votes, verified-purchase flag, reviewer badges (verified_purchaser, top_250, top_1000), size and color purchased, the reviewer's height, weight, body type and usual sizes when given, secondary ratings (Size, with its scale), the site it was syndicated from (e.g. nordstromrack.com) and photos with thumbnails. Rating-only reviews are included without title or text. Takes 20-60s, up to about 100s at max_reviews 200: use a smaller max_reviews when a quick answer is enough. A product with no reviews returns an empty list; an unknown style id is a 404. 10 credits.`,
    {
      url: z.string().min(1).max(500).optional()
        .describe("nordstrom.com product URL (the `url` of a search, category or brand result)."),
      style_id: z.string().regex(/^\d{4,10}$/).optional()
        .describe("Nordstrom style id, used when url is not given."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_helpful (default), most_recent, highest_rated or lowest_rated. Cannot be combined with search: Nordstrom returns review search results in its own order."),
      stars: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional()
        .describe("Only reviews with these star ratings, e.g. [1, 2] for the critical ones."),
      verified_only: z.boolean().optional()
        .describe("Only reviews from verified purchasers."),
      with_photos: z.boolean().optional()
        .describe("Only reviews that include customer photos."),
      search: z.string().min(1).max(100).optional()
        .describe("Only reviews mentioning this text (the review search box), 1-100 characters. Results come in Nordstrom's search order, so sort cannot be set with it."),
      max_reviews: z.number().int().min(1).max(200).optional()
        .describe("Reviews to return, 1-200. Defaults to 60. Larger values take longer (45-100s for 200)."),
    },
    post("reviews"),
  );
}
