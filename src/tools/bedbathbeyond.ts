import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/bedbathbeyond.ts (Bed Bath & Beyond, bedbathandbeyond.com, the US online home goods
// store; US only, USD). Rules the backend enforces and zod here does not: search takes query or facet_url (one of
// them; price filter links are refused); category takes url, or slug and category_id together; price_min and price_max
// go together (max above min); attributes holds at most 8 facets of 1 to 10 value ids; product, reviews and questions
// take product_id or url (one of them); stores takes one of zip, state, or latitude and longitude, and radius only with
// a zip or a point; sort, page and include_out_of_stock on deals go with a deal list type, not with type page. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE = "Bed Bath & Beyond (bedbathandbeyond.com, the US online home goods store), US only, prices in USD";
const BILL =
  "credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 2 to 25 s; allow a client timeout of at least 90 s.";
const WHERE = "Every answer carries market (us), host, language (en-US) and currency (USD).";
const NO_STORE = "Bed Bath & Beyond publishes online stock only: no store stock and no store prices.";
const LIST =
  "total, page, total_pages, has_more, sort_applied (the sort the page shows), count, items (organic) and sponsored_items (the site's sponsored tiles, kept apart) [{position, product_id (what get_bedbathbeyond_product takes), name, url, image, price, price_max (a range across options), price_text (when the site hides the price), price_type (sale, standard), base_price, compare_price, compare_type (msrp, was, compare_at), discount_percent, discount_amount, on_sale, sale_ends (as the site gives it), promo (the promo badge the page shows, e.g. a code), label (e.g. Best Seller), rating, review_count, option_count, fast_delivery, club_o_rewards, sponsored}], sponsored_count, facets [{id, name, multi_select, values [{name, id, count, selected, url}]}], related_searches, notes. Page size varies (about 48 to 81 products); the site serves at most 84 pages of any list.";

const idish = z.union([z.string().min(3).max(12), z.number().int().positive()]);
const productTarget = {
  product_id: idish.optional()
    .describe("A Bed Bath & Beyond product id: the digits before /product.html in a product link (items[].product_id), e.g. '5296998'. Send product_id or url."),
  url: z.string().min(30).max(600).optional()
    .describe("Or a bedbathandbeyond.com product link."),
};
const page = z.union([z.number().int().min(1).max(84), z.string().max(3)]).optional()
  .describe("Page, 1 to 84 (default 1). The site serves at most 84 pages of any list.");
const flag = (description: string) => z.union([z.boolean(), z.enum(["true", "false"])]).optional().describe(description);
const listSort = z.enum(["best_match", "on_sale", "best_selling", "price_asc", "price_desc", "rating", "newest"]);
const words = z.union([z.string().max(80), z.array(z.string().max(80)).max(10)]);
const zip = z.union([z.string().min(5).max(10), z.number().int().min(0).max(99999)]);

export function registerBedbathbeyondTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/bedbathbeyond/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_bedbathbeyond",
    `${SITE} keyword search by query (or a facet link from an earlier answer), in the site's sorts, with or without out-of-stock products: query, sort, include_out_of_stock, ${LIST} Also matching_categories [{id, name, count, slug, url}] and redirected_to: a keyword the site sends to a category answers that category's list (redirected_to {type category, category_id, slug, name, url}); one it sends to a product page answers redirected_to {type product, product_id, url}. The price filter is left out of keyword facets: use get_bedbathbeyond_category with price_min and price_max. ${WHERE} Captured 2026-11-27: bath towels gave 7835 results over 84 pages (48 organic and 17 sponsored on page 1), the first the Superior Egyptian Cotton 6 Piece Towel Set from 63.98 to 74.25 USD against an MSRP of 157.50, 59% off, with a 30% Off Code CYBER30 badge; table lamp sorted price_asc gave 12501 results, the first at 7.99 USD. 2 credits. ${BILL}`,
    {
      query: z.string().min(1).max(150).optional()
        .describe("Search keywords, e.g. 'bath towels'. Send query or facet_url."),
      facet_url: z.string().min(30).max(800).optional()
        .describe("Instead of query: a facets[].values[].url from a search answer (a filtered keyword list, e.g. On Sale, a color or a brand). Price filter links are refused (use get_bedbathbeyond_category price_min / price_max)."),
      sort: listSort.optional()
        .describe("best_match (default), on_sale, best_selling, price_asc, price_desc, rating or newest."),
      include_out_of_stock: flag("Include out-of-stock products (default false)."),
      page,
    },
    post("search"),
  );

  server.tool(
    "get_bedbathbeyond_category",
    `One ${SITE} category's product list by slug + category_id (or a /c/ link), in the site's category sorts with attribute, price range, rating, brand, promotion, fast delivery, expedited shipping and out-of-stock filters: category {id, slug, name, url}, sort, requested_filters, selected_facets [{group, name, id, remove_url}] (what the site applied), breadcrumbs [{id, name, slug, url}], child_categories [{id, name, count, slug, url}], ${LIST} ${WHERE} Captured 2026-11-27: bedding/bedding-sets (276) sorted price_asc counted 4548 products over 76 pages, the first a 3 Piece Solid Duvet Cover & Sham Covers Set at 16.71 USD, with 4 child categories (Comforters and Sets: 2647). An unknown category is a charged not-found. 2 credits. ${BILL}`,
    {
      slug: z.string().min(1).max(150).optional()
        .describe("The category path after /c/ (get_bedbathbeyond_categories links[].slug, child_categories[].slug), with category_id, e.g. 'bedding/bedding-sets'. Send slug + category_id, or url."),
      category_id: idish.optional()
        .describe("The category id (the t= value of its link; categories links[].category_id), e.g. '276'."),
      url: z.string().min(30).max(800).optional()
        .describe("Instead of slug + category_id: a bedbathandbeyond.com /c/ link (categories, breadcrumbs, child_categories, a facet value url). Its filters are kept."),
      sort: z.string().max(20).optional()
        .describe("best_selling (default), on_sale, price_asc, price_desc, rating or newest. The site's own keys (bestselling, onsale, pricelowhigh, pricehighlow, customerrating, newarrivals) are accepted too."),
      page,
      attributes: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])).max(10)])).optional()
        .describe("Attribute filters: facet id -> value id(s) (facets[].id and facets[].values[].id), e.g. {\"2415\": [\"2913\"]} for one color. At most 8 facets."),
      price_min: z.number().min(0).optional()
        .describe("Price range low end in USD (with price_max)."),
      price_max: z.number().min(0).optional()
        .describe("Price range high end in USD (with price_min; above it)."),
      rating: z.number().int().min(1).max(4).optional()
        .describe("Customer rating: this many stars and up (1 to 4)."),
      brand: words.optional()
        .describe("Brand name(s) as the Brand facet lists them, up to 10."),
      promotion: words.optional()
        .describe("Sales and Promotions value(s) as the facet lists them: on sale, top rated, best selling, new products."),
      include_out_of_stock: flag("Include out-of-stock products (default false)."),
      fast_delivery: flag("Limit the list to Fast Delivery products."),
      expedited: flag("Limit the list to Expedited Shipping Available products."),
    },
    post("category"),
  );

  server.tool(
    "get_bedbathbeyond_categories",
    `The ${SITE} department menu: count, link_count, departments [{name, url, category_id, slug, filtered, groups [{name, url, category_id, slug, filtered, links [{name, url, category_id, slug, filtered}]}]}], notes. slug and category_id go into get_bedbathbeyond_category; filtered marks a link with a filter on top of its category (e.g. Best Sellers). ${WHERE} Captured 2026-11-27: 13 departments (Furniture, Rugs, Outdoor, Bedding, Bath ... Sales & Deals) with 541 links. 1 credit. ${BILL}`,
    {},
    post("categories"),
  );

  server.tool(
    "get_bedbathbeyond_product",
    `One ${SITE} product by product id or link: requested_id, product_id, name, brand, brand_id, mpn, sku, url, in_stock, online, discontinued, status_code, price and price_label (the site's lead price, e.g. Sale Starts at), compare_price and compare_label (MSRP or Was), savings, savings_percent, price_min, price_max, on_sale, rating, review_count, rating_histogram, free_shipping, freight (ships by truck), international_shippable, country_of_origin, first_onsite_date, label, breadcrumbs, taxonomy {store, department, category, subcategory}, specs [{group, name, values}], images, option_count, original_option_count, options [{option_id (what get_bedbathbeyond_delivery_estimate takes), description, attributes (Size, Color ...), price, compare_price, compare_type (was, msrp, none), savings, savings_percent, on_sale, sale_start, sale_end, qty_on_hand (exact online stock), max_quantity, in_stock, backorder, sub_sku, image}], notes. The site leaves out-of-stock options out (original_option_count counts them all). A product no longer sold answers in_stock false with no options, not a not-found. No UPC or GTIN. ${NO_STORE} ${WHERE} Captured 2026-11-27: product 5296998, the Superior Egyptian Cotton 6 Piece Towel Set, Sale Starts at 63.98 USD against an MSRP of 157.50 (59% off), rated 4.5 from 5165 reviews, 26 of 49 options listed; the Ash Grey 6-Piece Set was 74.25 USD (was 93.99) on sale to 2026-12-07 with 97 units in online stock. 1 credit, occasionally 2. ${BILL}`,
    productTarget,
    post("product"),
  );

  server.tool(
    "get_bedbathbeyond_delivery_estimate",
    `The delivery date and shipping charge of one ${SITE} product option, for a quantity, to a US ZIP code: requested_option_id, requested_quantity, option_id, product_id, zip, quantity (as the site answers it), in_stock, can_ship, ship_charge_total, ground_days, one_day, two_day, holiday, pre_release, options [{level, name, charge, charge_text, estimated_date, estimate_type, estimate_text, freight}], errors [{type, message}] (e.g. an address the item cannot ship to, as the site gives it), notes. ${WHERE} Captured 2026-11-27: option 94445783 (the Ash Grey towel set) to ZIP 10001 shipped Standard, FREE, on 2026-11-30, in 3 ground days. 1 credit. ${BILL}`,
    {
      option_id: idish
        .describe("The product's options[].option_id from get_bedbathbeyond_product, e.g. '94445783'."),
      quantity: z.number().int().min(1).max(99).optional()
        .describe("Quantity, 1 to 99 (default 1)."),
      zip: zip
        .describe("The US ZIP code to deliver to, e.g. '10001'."),
    },
    post("delivery-estimate"),
  );

  server.tool(
    "get_bedbathbeyond_reviews",
    `Customer reviews of one ${SITE} product, sorted newest, most_helpful, highest or lowest, with a star filter and a text search: product_id, sort, rating_filter, search, page, page_size, total_pages, total, total_matching, average_rating, rating_count, media_count, rating_histogram, has_more, count, reviews [{review_id, rating, title, text, submitted_at, helpful_votes, unhelpful_votes, verified_purchase, rewards_received, recommended, locale, variation_id, media [{type, url, thumbnail}]}], notes. No reviewer names or locations. ${WHERE} Captured 2026-11-27: product 5296998 had 5165 reviews averaging 4.5 (3842 five-star) and 57 with media, 517 pages of 10. 1 credit. ${BILL}`,
    {
      ...productTarget,
      sort: z.enum(["newest", "most_helpful", "highest", "lowest"]).optional()
        .describe("newest (default), most_helpful, highest or lowest."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Reviews with exactly this many stars (1 to 5)."),
      search: z.string().min(1).max(100).optional()
        .describe("Reviews containing this text."),
      page: z.number().int().min(1).max(100000).optional()
        .describe("Page, from 1 (default 1)."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Reviews per page, 1 to 50 (default 10)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_bedbathbeyond_questions",
    `Customer questions and answers of one ${SITE} product, 20 questions per page: product_id, page, page_size, total_pages, total_questions, total_answers, has_more, count, questions [{question_id, text, asked_at, type, answer_count, answers [{answer_id, text, answered_at}]}], notes. No screen names. ${WHERE} Captured 2026-11-27: product 10216253 (a rug runner) had 159 questions with 693 answers over 8 pages. 1 credit. ${BILL}`,
    {
      ...productTarget,
      page: z.number().int().min(1).max(10000).optional()
        .describe("Page, from 1 (default 1); 20 questions per page."),
    },
    post("questions"),
  );

  server.tool(
    "get_bedbathbeyond_stores",
    `The stores of the Bed Bath & Beyond family (Bed Bath & Beyond / The Container Store co-branded stores, Kirkland's and The Container Store) near a US ZIP code or a point (nearest first, within radius), in a state, or all of them, filtered by banner: zip, state, latitude, longitude, radius_miles, banner, total_stores, count, stores [{name, banner, brands, address {street, city, state, zip, full}, phone, latitude, longitude, time_zone, hours {monday_thursday, friday, saturday, sunday}, services, service_callout, distance_miles}], notes. Distances are straight-line miles from the ZIP code's center. ${NO_STORE} ${WHERE} Captured 2026-11-27: 333 stores in all; ZIP 75201 had 16 within 50 miles, the nearest a co-branded Bed Bath & Beyond / The Container Store in Dallas at 5.5 miles, open 10am-8pm Monday to Saturday. 1 credit. ${BILL}`,
    {
      zip: zip.optional()
        .describe("A US ZIP code: stores within radius of its center, nearest first, e.g. '75201'. Send one of zip, state, or latitude and longitude (or none for every store)."),
      state: z.string().length(2).optional()
        .describe("A 2-letter US state code: every store in the state, e.g. 'TX'."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("With longitude: stores within radius of a point."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude (with latitude)."),
      radius: z.number().int().min(1).max(500).optional()
        .describe("Radius in miles, 1 to 500 (default 50), with zip or latitude / longitude."),
      banner: z.enum(["bed_bath_beyond", "kirklands", "container_store"]).optional()
        .describe("bed_bath_beyond (the co-branded Bed Bath & Beyond / The Container Store stores), kirklands, or container_store (every store carrying The Container Store, co-branded included)."),
    },
    post("stores"),
  );

  server.tool(
    "get_bedbathbeyond_deals",
    `The ${SITE} deals. type page (default, 1 credit): type, event {text, ends_at} (the sale countdown), count, sections [{name (e.g. DOORBUSTERS), items [{position, product_id, option_id, name, url, image, price, compare_price, compare_type, savings, savings_percent, on_sale, sale_end, qty_on_hand, option_count, rating, review_count}]}], deal_lists [{type, name}], notes. A deal list (black_friday, on_sale, doorbusters, holiday_brand_deals; 2 credits) answers like search: type, name, sort, include_out_of_stock, ${LIST} deal_lists. ${WHERE} Captured 2026-11-27: the deals page counted down to a Black Friday Sale ending 2026-11-30T05:00:00Z with 12 doorbusters, the first at 131.47 USD against 259; the Doorbusters list held 1133 products over 19 pages, the first the Shark Navigator Lift Away Deluxe Upright Vacuum at 124.99 USD. ${BILL}`,
    {
      type: z.enum(["page", "black_friday", "on_sale", "doorbusters", "holiday_brand_deals"]).optional()
        .describe("page (default: the deals page, its sale countdown and doorbuster grid), or a deal list: black_friday, on_sale, doorbusters, holiday_brand_deals."),
      sort: listSort.optional()
        .describe("For a deal list only: best_match, on_sale, best_selling, price_asc, price_desc, rating or newest (default: the list's own order)."),
      page,
      include_out_of_stock: flag("For a deal list only: include out-of-stock products."),
    },
    post("deals"),
  );
}
