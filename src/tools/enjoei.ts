import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/enjoei.ts (Enjoei, enjoei.com.br, Brazil's second-hand fashion marketplace; Brazil,
// BRL). Rules the backend enforces and zod here does not: product takes product_id or url; shop reviews take handle or
// shop_id; a subcategory needs its category, and a category slug outside its department is refused. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Enjoei (enjoei.com.br, Brazil's second-hand fashion marketplace), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW_TIME = "Usually 10 to 40 s, up to about two minutes; allow a client timeout of at least 180 s.";
const FAST_TIME = "Usually 2 to 10 s; allow a client timeout of at least 60 s.";
const PRIVACY = "Seller names, avatars and cities are never returned: the seller is its @handle.";
const ITEM =
  "id (what get_enjoei_product takes), url, title, brand, price, original_price (before the seller's discount), discount_percent, currency, condition (new, used), size, sizes, shipping {free, type (e.g. charge_by_weight, hand_deliver)}, department, category, subcategory (slugs), image, tags (the card's badges, e.g. 20%, barateou), bundle_allowed, seller_handle (what the shop tools take)";
const LIST = `page, total (Enjoei's count stops at 10000: total_capped), total_capped, count, has_more, next_cursor (send it back as cursor for the next page; pages are reached one after another), items [{${ITEM}}], page_size (30), facets (best-effort, null when the page did not show them: brands [{slug, name, count}] (top 50), departments, subcategories, sizes {clothes, waist, shoes} and store_kinds, each [{slug, name}]) and notes`;
const FILTERS =
  "Sorts: relevance (default), price_asc, price_desc, discount. Filters: brand, clothing / waist / shoe sizes (slugs from facets), a price range in BRL, condition (new, used), listed within 24h, 7d, 14d or 30d, store kind (pro, celebrity) and a discount range in percent. Listings cover sellers who ship to all of Brazil. There is no colour filter: put the colour in the query.";

const slugs = (example: string) =>
  z.union([z.string().min(1).max(400), z.array(z.string().min(1).max(100)).min(1).max(10)]).optional()
    .describe(`One slug or up to 10, as facets list them, e.g. '${example}'.`);
const cursor = z.string().min(4).max(320).optional()
  .describe("next_cursor of the previous page. Omit for page 1.");
const handle = z.string().min(1).max(200)
  .describe("The shop handle (enjoei.com.br/@<handle>, items[].seller_handle), with or without the @, or the shop link, e.g. 'utstore'.");

const grid = {
  sort: z.enum(["relevance", "price_asc", "price_desc", "discount"]).optional()
    .describe("relevance (default), price_asc, price_desc or discount (largest discount at the top)."),
  brand: slugs("farm").describe("Brand slug(s) as Enjoei writes them (facets.brands[].slug), e.g. 'farm', 'zara', 'le-lis-blanc'; up to 10."),
  size_clothes: slugs("m").describe("Clothing size slug(s) (facets.sizes.clothes[].slug: pp, p, m, g, gg, xgg, 36, 38 ...)."),
  size_waist: slugs("38").describe("Waist size slug(s) (facets.sizes.waist[].slug)."),
  size_shoes: slugs("37").describe("Shoe size slug(s) (facets.sizes.shoes[].slug)."),
  price_min: z.number().min(0).max(1_000_000).optional().describe("Lowest price, BRL."),
  price_max: z.number().min(0).max(1_000_000).optional().describe("Highest price, BRL."),
  condition: z.enum(["new", "used"]).optional().describe("new (never used) or used."),
  listed_within: z.enum(["24h", "7d", "14d", "30d"]).optional().describe("Listed in the last 24h, 7d, 14d or 30d."),
  store_kind: z.enum(["pro", "celebrity"]).optional().describe("pro (Enjoei Pro stores) or celebrity (Enjoei's celebrity closets)."),
  discount_min: z.number().int().min(0).max(100).optional().describe("Smallest discount, percent."),
  discount_max: z.number().int().min(0).max(100).optional().describe("Largest discount, percent."),
  cursor,
};

export function registerEnjoeiTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/enjoei/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_enjoei",
    `${SITE} listing search: market, currency, query, sort, filters, ${LIST}. ${FILTERS} No results is an empty, charged answer. ${PRIVACY} Captured 2026-11-27: vestido farm reached the 10000 cap, the first a used FARM linen midi dress in size M at 199 BRL, shipped by weight. ${COST} ${SLOW_TIME}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'vestido farm'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_enjoei_category",
    `One ${SITE} department, category or subcategory by the slugs get_enjoei_categories lists (departments[].params), optionally with keywords, sorted and filtered like search_enjoei: department, category, subcategory, query, sort, filters, ${LIST}. A category slug outside its department is refused before anything is charged. ${PRIVACY} Captured 2026-11-27: feminino / feminino-roupas / feminino-roupas-vestidos reached the 10000 cap, the first a used dress at 39 BRL (was 53, 26% off). ${COST} ${SLOW_TIME}`,
    {
      department: z.string().min(1).max(100)
        .describe("Department slug (departments[].params.department of get_enjoei_categories), e.g. 'feminino', 'masculino', 'infantil', 'casa-e-decor'."),
      category: z.string().min(1).max(100).optional()
        .describe("Category slug in that department (params.category), e.g. 'feminino-roupas'."),
      subcategory: z.string().min(1).max(100).optional()
        .describe("Subcategory slug in that category (params.subcategory), e.g. 'feminino-roupas-vestidos'. Needs category."),
      query: z.string().min(1).max(200).optional()
        .describe("Optional keywords inside the category."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_enjoei_categories",
    `The ${SITE} category tree: count (top-level nodes), node_count and departments [{name, slug, url, params {department, category, subcategory} (what get_enjoei_category takes; null on navigation nodes without a listing of their own), children [...]}], three levels deep. Captured 2026-11-27: 5 departments and 190 nodes. ${COST} ${FAST_TIME}`,
    {},
    post("categories"),
  );

  server.tool(
    "get_enjoei_product",
    `One ${SITE} listing by product id or link: id, url, title, description, status (published, sold ...), available, price (the sale price), list_price, discount_percent, currency, installments_text, promo_text (a new-buyer coupon line when shown), offer {accepts_offers, min_price, max_price} (the make-an-offer range the seller accepts), bundle_allowed, size, sizes [{name, slug, available}], brand {name, slug, verified}, condition (new, used), weight_kg, hand_delivery, single_piece, photos, category_slug, breadcrumb [{title, url}], seller {id, handle}, price_detail (full, or basic when the pricing details could not be read) and notes. Shipping cost and type are shown to signed-in buyers only (listing cards carry shipping.free and shipping.type). ${PRIVACY} Not available: shipping quotes by CEP, product comments, a site-wide sold search, coupons and Black Friday dates. An unknown product is a charged not-found. Captured 2026-11-27: 153252795, a used FARM one-shoulder dress in size M, at 75 BRL (list 90, 17% off), offers accepted from 45 to 74 BRL. ${COST} ${FAST_TIME}`,
    {
      product_id: z.string().regex(/^\d{1,12}$/).optional()
        .describe("The Enjoei product id (items[].id), e.g. '153252795'. Send product_id or url."),
      url: z.string().min(20).max(600).optional()
        .describe("Or a product link (https://www.enjoei.com.br/p/<name>-<id>)."),
    },
    post("product"),
  );

  server.tool(
    "get_enjoei_shop",
    `A seller's shop on ${SITE} by handle: handle, seller_id, url, joined_at, on_vacation, business (an Enjoei business seller), badge (e.g. loja em destaque, null when none), counters {listings, sold, likes, followers, following}, rating (0 to 5), review_count, recent_deliveries (the on-time history of the latest sales: on_time, delayed, cancelled), average_shipping_time (shown after 5 sales) and notes. Names, avatars, header images, cities and the shop's own description are never returned. An unknown handle is a charged not-found. Captured 2026-11-27: utstore, joined 2014-01-25, 706 listings, 2008 sold, rated 4.7 from 809 reviews, shipping in 1 day on average. ${COST} ${FAST_TIME}`,
    { handle },
    post("shop"),
  );

  server.tool(
    "get_enjoei_shop_listings",
    `A shop's listings on sale on ${SITE} by handle, in the order the shop page shows them: handle, seller_id, ${LIST.replace(", page_size (30)", "")} (20 on page 1, 30 on later pages). An unknown handle is a charged not-found. ${PRIVACY} Captured 2026-11-27: utstore had 706 listings on sale. ${COST} ${SLOW_TIME}`,
    { handle, cursor },
    post("shop-listings"),
  );

  server.tool(
    "get_enjoei_shop_sold",
    `A shop's sold listings on ${SITE} by handle and page: handle, page, page_size (40), total, total_pages, has_more, count, items [{id, url, title, price (the listed price), currency, image, status}] and notes. Enjoei shows no sold date, and at most 50 pages (2,000 sold listings) per shop. An unknown handle is a charged not-found. Captured 2026-11-27: utstore showed 1998 sold listings over 50 pages. ${COST} ${FAST_TIME}`,
    {
      handle,
      page: z.number().int().min(1).max(50).optional()
        .describe("Page, 1 to 50, 40 sold listings each. Defaults to 1."),
    },
    post("shop-sold"),
  );

  server.tool(
    "get_enjoei_shop_reviews",
    `Buyer reviews of a shop on ${SITE} by handle or shop_id, all, positive or negative (Enjoei's own filters), 20 a page by cursor: handle, seller_id, filter, page_size, count, has_more, next_cursor, items [{score (1 to 5), date, text, feedback_tags (e.g. envio rapido, otima embalagem)}], summary {score, total, stars [{stars, total}], feedbacks [{label, total}]} and notes. Reviewer names and photos are never returned. An unknown handle is a charged not-found. Captured 2026-11-27: utstore scored 4.7 from 809 reviews, 719 of them 5 stars. ${COST} ${FAST_TIME}`,
    {
      handle: handle.optional(),
      shop_id: z.string().regex(/^\d{1,12}$/).optional()
        .describe("Or the seller id (seller_id of get_enjoei_shop, seller.id of get_enjoei_product), e.g. '351787'. Send handle or shop_id."),
      filter: z.enum(["all", "positive", "negative"]).optional()
        .describe("all (default), positive or negative."),
      cursor: z.string().min(4).max(300).optional()
        .describe("next_cursor of the previous page. Omit for page 1."),
    },
    post("shop-reviews"),
  );

  server.tool(
    "get_enjoei_suggestions",
    `The ${SITE} search suggestions for what a shopper has typed: query, count and suggestions [{text, query, department (the department slug a suggestion narrows to, null for all of Enjoei)}]. Captured 2026-11-27: vestido gave 10 suggestions (vestido farm, vestido longo, then vestido in each department). ${COST} ${SLOW_TIME}`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'vestido'."),
    },
    post("suggestions"),
  );
}
