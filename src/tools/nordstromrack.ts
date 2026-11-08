import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/nordstromrack.ts. Nordstrom Rack is its own
// platform (nordstromrack.com), separate from nordstrom.ts: own category paths
// (/shop, /clearance, flash events), brand paths without an id, Rack stores
// only and Rack's own review pool. Cross-field rules the backend enforces and
// zod here does not: product, availability and reviews take url OR style_id;
// stores takes exactly one of zip, latitude+longitude or store_numbers; reviews
// rejects sort together with search. No zod `.default()`: the MCP SDK would
// post a defaulted field on every call.

const SORTS = ["relevance", "rating", "price_high", "price_low", "newest", "percent_off"] as const;
const REVIEW_SORTS = ["most_helpful", "most_recent", "highest_rated", "lowest_rated"] as const;

const PRICE_FIELDS = "current price and price range in dollars, the compare-at price range Rack strikes through, percent off and on-sale flag, the clearance price range, and any promotion on top (promotion_price_range, and promotion_percent_off: the extra percent off the clearance price during Clear the Rack, otherwise off Rack's regular price)";

const LISTING_FIELDS = `Each product has the same fields as a search_nordstromrack result: style id, URL, name, brand, image, ${PRICE_FIELDS}, rating, review count, badges, a low-inventory flag, marketplace seller and every color. Also returns the total result count, page count, and the filter sidebar: each filter group (Product Type, Size, Color, Brand, Price...) with its options and product counts (price buckets carry no count on the site, so theirs are null; groups with more than 100 options, such as Brand, list the 100 with the most products and give the full option_count).`;

const page = () => z.number().int().min(1).max(100).optional()
  .describe("Results page, 1-based. Defaults to 1. 24 products per page.");
const sort = () => z.enum(SORTS).optional()
  .describe("relevance (default), rating, price_high, price_low, newest or percent_off.");
const url = () => z.string().min(1).max(500).optional()
  .describe("nordstromrack.com product URL (the `url` of a search, category or brand result).");
const styleId = () => z.string().regex(/^\d{4,10}$/).optional()
  .describe("Nordstrom Rack style id, the number at the end of a product URL (a result's `style_id`). Used when url is not given.");

export function registerNordstromRackTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/nordstromrack/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_nordstromrack",
    `Search nordstromrack.com (US) products, 24 per page, sorted by relevance, rating, price, newest or percent off. Each result has style id, URL, name, brand, image, ${PRICE_FIELDS}, rating, review count (Rack's own reviews), badges such as new_markdown or final_sale, a low-inventory flag, whether it is sold by a marketplace seller (and the seller's name), and every color with its color family and image. Also returns the total result count and page count. Use a result's url or style_id with get_nordstromrack_product, get_nordstromrack_reviews or get_nordstromrack_availability. For nordstrom.com use search_nordstrom. 5 credits/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords."),
      page: page(),
      sort: sort(),
    },
    post("search"),
  );

  server.tool(
    "get_nordstromrack_product",
    `One nordstromrack.com (US) product by URL or style id: name, brand, brand page URL, description, feature bullets, fit notes, final-sale flag, current, compare-at and clearance price ranges, percent off, any promotion on top (promotion_price_range and promotion_percent_off, e.g. Clear the Rack's extra 25% off clearance), rating, review count, the star histogram, the size-fit distribution (too small to too big), the AI review summary when the site shows one, the most mentioned praised and criticized features with a quote each, breadcrumbs and images. Every color lists its images and every size as a sku with sku id, size, size type, UPC, price, compare-at price, percent off, price type (regular, clearance, promotion), in_stock and the quantity available to ship. in_stock is true when the sku can be shipped or picked up in a Rack store, so a sku held only in a store reads in stock with quantity 0 (get_nordstromrack_availability lists its pickup stores). Includes the reviews shown on the product page (up to about 13), with the total review count; each review has title, text, rating, size rating, author, date, helpful votes and verified-purchase flag (get_nordstromrack_reviews pages the full review history). Ratings and reviews are Rack's own, separate from nordstrom.com's. An unknown style id is a 404. 5 credits.`,
    {
      url: url(),
      style_id: styleId(),
    },
    post("product"),
  );

  server.tool(
    "get_nordstromrack_category",
    `Browse a nordstromrack.com (US) category page, 24 products per page, sorted by relevance, rating, price, newest or percent off. Works on every /shop and /clearance listing: departments (/shop/women), deals (/shop/deals/black-friday), new arrivals (/shop/new-arrivals), Clear the Rack (/clearance, /clearance/women/clothing) and flash events: /shop/flash lists the live events as subcategories (it has no products of its own), and each event (/shop/flash/event-7) is a listing whose first page shows the event's featured products first, then the rest, with positions running on. Returns the category's name, page title, path, URL, breadcrumbs and subcategories (name and path, for drilling down). ${LISTING_FIELDS} An unknown category is a 404. 5 credits.`,
    {
      category: z.string().min(1).max(500)
        .describe("A nordstromrack.com category: the /shop or /clearance path or full URL of a category page, e.g. /shop/women/clothing/dresses, /shop/deals/black-friday, /shop/new-arrivals, /clearance, /clearance/women/clothing, /shop/flash or a flash event such as /shop/flash/event-7. A path without a prefix (women/clothing/dresses) is read as /shop/... . Query parameters in a URL (filters) are ignored. Each result's category.subcategories lists child paths."),
      page: page(),
      sort: sort(),
    },
    post("category"),
  );

  server.tool(
    "get_nordstromrack_brand",
    `List a brand's products on nordstromrack.com (US) from its brand page (/brands/adidas), 24 per page, sorted by relevance, rating, price, newest or percent off. Returns the brand's name, path, URL and breadcrumbs. ${LISTING_FIELDS} An unknown brand is a 404. 5 credits.`,
    {
      brand: z.string().min(1).max(500)
        .describe("A nordstromrack.com brand: the /brands path or full URL of a brand page, e.g. /brands/adidas, /brands/sam-edelman or https://www.nordstromrack.com/brands/ugg (a product's brand_url works). The /brands prefix is optional. Rack brand pages carry no brand id: the nordstrom.com form /brands/<name>--<id> is a 404 here."),
      page: page(),
      sort: sort(),
    },
    post("brand"),
  );

  server.tool(
    "get_nordstromrack_stores",
    `Find Nordstrom Rack stores near a US ZIP code or latitude/longitude within up to 100 miles, nearest first, or look Rack stores up by store number. Pass exactly one of zip, latitude and longitude, or store_numbers. Each store has store number, name, type (rack), address, city, state, ZIP, country, phone, weekly hours, holiday hours when posted, open and close times for the next 8 days, time zone, distance in miles, latitude and longitude, whether it offers buy-online pickup and curbside pickup, its amenities and its store page URL. A ZIP with no store in range returns an empty list. 5 credits.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US ZIP code to search around, e.g. '10001'. Pass exactly one of zip, latitude and longitude, or store_numbers."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude to search around (with longitude)."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude to search around (with latitude)."),
      store_numbers: z.array(z.string().regex(/^\d{1,5}$/)).min(1).max(100).optional()
        .describe("Look up Rack stores by number instead of location, up to 100 (a get_nordstromrack_availability result's pickup_stores[].store_number), e.g. ['229', '242']. Numbers of Nordstrom full-line stores are left out."),
      distance_miles: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles around zip or latitude/longitude, 1-100 (the site's maximum). Defaults to 100."),
    },
    post("stores"),
  );

  server.tool(
    "get_nordstromrack_availability",
    `Online and Rack store-pickup availability for every size and color of one nordstromrack.com (US) product, by URL or style id, optionally one sku. Each sku has sku id, size, color, UPC, in_stock, whether it ships and the quantity available to ship, the quantity available for pickup, and the Rack stores where it can be picked up (store number, name, address, city, state, ZIP, phone). Quantities are chain-wide: per store the site only says whether pickup is available, not how many. in_stock is true when the sku can be shipped or picked up, so a sku with ship_quantity 0 can still be in stock for pickup. An unknown style id or sku id is a 404. 10 credits (the product page plus the store lookup).`,
    {
      url: url(),
      style_id: styleId(),
      sku_id: z.string().regex(/^[A-Za-z0-9]{4,20}$/).optional()
        .describe("Only this sku (a product's colors[].skus[].sku_id), e.g. 'A5819201'. An id that is not a sku of the product is a 404."),
    },
    post("availability"),
  );

  server.tool(
    "get_nordstromrack_suggestions",
    `The search-box autocomplete of nordstromrack.com: the queries Nordstrom Rack suggests for a partial search term, most likely first (e.g. "dre" -> dresses for women, dress, barefoot dreams, sweater dress). Useful for keyword research and for building queries for search_nordstromrack. 5 credits.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'dre'."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Suggestions to return, 1-20. Defaults to 8. The site may return fewer."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_nordstromrack_reviews",
    `Customer reviews of one nordstromrack.com (US) product by URL or style id, up to 200 per call (default 60), sorted most helpful (default), most recent, highest rated or lowest rated, optionally filtered to star ratings, verified purchases, reviews with photos, or a text search. Rack has its own review pool, separate from nordstrom.com's (get_nordstrom_reviews). Returns the product's review summary (average rating, total reviews, star histogram, size rating 1 runs small to 5 runs big, width rating where the site has one, the most mentioned praised and criticized features with a quote each, and the count of rating-only reviews), the AI review summary when the site shows one, the number of reviews matching the filters (total_results), returned and has_more. Each review has id, title, text, star rating, size rating, author, date, helpful votes, verified-purchase flag, reviewer badges, size and color purchased, the reviewer's height, weight, body type and usual sizes when given, secondary ratings, the site it was syndicated from (e.g. a brand's own site) and photos with thumbnails. Rating-only reviews are included without title or text. Takes 15-60s, up to about 100s at max_reviews 200: use a smaller max_reviews when a quick answer is enough. A product with no reviews returns an empty list; an unknown style id is a 404. 10 credits.`,
    {
      url: url(),
      style_id: styleId(),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_helpful (default), most_recent, highest_rated or lowest_rated. Cannot be combined with search: Nordstrom Rack returns review search results in its own order."),
      stars: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional()
        .describe("Only reviews with these star ratings, e.g. [1, 2] for the critical ones."),
      verified_only: z.boolean().optional()
        .describe("Only reviews from verified purchasers."),
      with_photos: z.boolean().optional()
        .describe("Only reviews that include customer photos."),
      search: z.string().min(1).max(100).optional()
        .describe("Only reviews mentioning this text (the review search box), 1-100 characters. Results come in the site's search order, so sort cannot be set with it."),
      max_reviews: z.number().int().min(1).max(200).optional()
        .describe("Reviews to return, 1-200. Defaults to 60. Larger values take longer (about 50-100s for 200)."),
    },
    post("reviews"),
  );
}
