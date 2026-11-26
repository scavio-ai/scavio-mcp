import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/bjs.ts (BJ's Wholesale Club, bjs.com, US only, USD). Rules the backend enforces
// and zod here does not: product and reviews take product_id or url (a bjs.com/product/ link). No zod `.default()`:
// the MCP SDK would post a defaulted field on every call.

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

const SITE = "BJ's Wholesale Club (bjs.com, the US warehouse club), US only, prices in USD";
const ONE = "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const MEMBER =
  "Where BJ's shows \"Member Only Price\" to a visitor, member_only_price is true and the answer carries the list price only: no member price, sale price or sale dates.";
const CLUB_ONLY = "A club-only item (sold in clubs, no online price) has price null and club_only true.";
const NO_CLUB =
  "The club cannot be chosen: there is no price, stock or availability for a club you pick and no club finder by ZIP code.";
const SLOW = "The page takes 15 to 100 s: allow a client timeout of at least 240 s.";
const LISTING = `total (BJ's own count), count, page_size (40), has_more, priced_for {club_id, name, city, state} (the club BJ's assigned to the visit, or null; then prices are online prices), results [product_id (what get_bjs_product and get_bjs_reviews take), item_number, name, url, image_url, currency, price (online), was_price, sale {price, starts_at, ends_at}, club_price, club_was_price, club_sale (for priced_for), member_only_price, club_only, available_online, available_in_club, out_of_stock, in_stock_online, in_stock_club, fulfillment_online and fulfillment_club {same_day_delivery, pickup_in_club, ebt}, ebt_eligible, weighted_item, rating, review_count, coupon, free_shipping, badges {promotional_badge, promotional_event, spec_badge, plp_badge}, max_quantity, bought_last_month, first_available, categories], facets [{name, label, options [{value, label, count}]}], note. Up to 40 results: BJ's ignores its own page parameter, so there is no deeper paging`;

const productId = z.string().regex(/^3\d{18}$/);
const productTarget = {
  product_id: productId.optional()
    .describe("A BJ's product id: the 19-digit number at the end of a bjs.com/product/ link (search results[].product_id), e.g. '3000000000005430255'."),
  url: z.string().min(30).max(400).optional()
    .describe("Or the bjs.com product link. Send product_id or url."),
};
const category = z.string().min(2).max(300);

export function registerBjsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/bjs/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_bjs_product",
    `One ${SITE} product by product id or link: product_id, item_number, name, brand, model, upc, url, currency, price (online; the offer price while an instant saving runs), regular_price, savings, offer {starts_at, ends_at}, map_price, unit_price, unit_of_measure, price_range (variant products), member_only_price, club_only, weighted_item, available_online, available_in_club, in_stock_online, estimated_delivery, free_shipping, rating, review_count, description, summary, specifications, breadcrumbs, images, options, variant_count, variants [item_id, item_number, attributes, price, regular_price, savings, offer, map_price, unit_price, unit_of_measure, available_online, available_in_club, in_stock_online, gtin], fulfillment [{item_number, item_type (CLUB_ONLINE or CLUB_ONLY), ebt_eligible, same_day_delivery, pickup_in_club, ship_from_club, fresh_delivery, ebt_clubs {eligible_club_ids, ineligible_count}}], note. Club prices differ from club to club and are not returned. ${MEMBER} ${CLUB_ONLY} Captured 2026-11-26: Scotch-Brite 420-Sheet Lint Rollers, 4 pk. at 9.99 USD online (regular 12.99, saving 3 to 2026-12-25); a Hamilton Beach iron with member_only_price true carried its 29.99 USD list price. An unknown product id is a charged not-found. ${ONE}`,
    productTarget,
    post("product"),
  );

  server.tool(
    "search_bjs",
    `${SITE} keyword search: query, departments [{category_id, name, count, url}], related_searches, ${LISTING}. ${MEMBER} ${CLUB_ONLY} ${NO_CLUB} Captured 2026-11-26: coffee gave 125 results (40 listed) across 12 departments, the first Folgers Classic Roast Ground Coffee 43.5 oz. at 24.79 USD with 8158 reviews. ${SLOW} ${ONE}`,
    {
      query: z.string().min(2).max(100)
        .describe("Search keywords, e.g. 'coffee'."),
    },
    post("search"),
  );

  server.tool(
    "get_bjs_category",
    `The products of one ${SITE} category (ids from get_bjs_categories), as BJ's lists them: category_id, url, subcategories [{category_id, name, count, url}], ${LISTING}. Departments list too (grocery: 3,000+ products). A category whose page leads to a landing page with no product list is a charged not-found that points to its subcategories. ${MEMBER} ${NO_CLUB} Captured 2026-11-26: TVs held 162 products (40 listed), priced for the Jersey City, NJ club, the first a Samsung 75" 4K TV at 599.99 USD with a 397.99 USD sale to 2026-11-30. ${SLOW} ${ONE}`,
    {
      category: category
        .describe("A BJ's category id from get_bjs_categories (e.g. 'tvs-and-electronics>tvs'), or its bjs.com/category/ path or link."),
    },
    post("category"),
  );

  server.tool(
    "get_bjs_categories",
    `${SITE} full category tree (about 980 categories), or one category's subtree: root, product_count, count, categories [{category_id (what get_bjs_category takes), name, count (products), url, level, hidden (kept out of BJ's menus), children}], note. Captured 2026-11-26: 982 categories over 13503 products. ${ONE}`,
    {
      category: category.optional()
        .describe("Optional: one category id (e.g. 'grocery'); the answer is its subtree."),
    },
    post("categories"),
  );

  server.tool(
    "get_bjs_reviews",
    `Customer reviews of one ${SITE} product, 10 a page in BJ's order (newest to oldest): product_id, item_number, page, page_size, total, total_pages, has_more, count, summary {average_rating, review_count, rating_histogram, recommended_ratio, themes} (page 1), ai_summary {text, generated_at, highlights [{label, type (pro or con), count}]} (BJ's own AI review summary, as given), reviews [review_id, rating, title, text, created_at, would_recommend, item_number, verified_buyer, staff_reviewer, helpful_votes, not_helpful_votes, photos], questions_total, questions [question_id, text, created_at, answer_count, answers [answer_id, text, created_at, author_type, is_expert, helpful_votes]], note. No reviewer, asker or answerer names or locations. Captured 2026-11-26: a paper towel product had 2967 reviews over 297 pages, average 4.81, 97% recommended. ${SLOW} ${ONE}`,
    {
      ...productTarget,
      page: z.number().int().min(1).max(500).optional()
        .describe("Reviews page, 1-based, 10 a page (1 to 500). Defaults to 1."),
    },
    post("reviews"),
  );

  server.tool(
    "get_bjs_coupons",
    `${SITE} guest coupon book: the manufacturer and BJ's coupons a visitor sees on the coupon page (about 570), as the page loads them: total, count (about 240 to 300), has_more, categories, coupons [offer_id, description, brand, manufacturer, summary, value, category, offer_type, min_quantity, redemption_limit, redemption_frequency, source (MFG or BJSSCPN), active_from, expires_at, upcs, gtins, image_url, disclaimer], note. Coupons are clipped to a membership on bjs.com; Scavio never clips one. Captured 2026-11-26: 268 of 567 offers across 12 categories, the first 2.00 USD off Coca-Cola or Sprite mini cans to 2026-11-30. ${SLOW} ${ONE}`,
    {},
    post("coupons"),
  );

  server.tool(
    "get_bjs_clubs",
    `${SITE} club directory (about 280 clubs in 22 states, announced openings included), all or one state: state, state_count, count, states [{state, state_name, count}], clubs [{club_id, name, state, url}], note. A directory by state only: no club finder by ZIP code and no club-level prices or stock. Captured 2026-11-26: New York had 50 clubs. ${ONE}`,
    {
      state: z.enum(STATES).optional()
        .describe("Optional: a US state code (e.g. 'NY'); the answer is that state's clubs."),
    },
    post("clubs"),
  );
}
