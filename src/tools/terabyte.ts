import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/terabyte.ts (Terabyteshop, terabyteshop.com.br, Brazil's PC-parts store; Brazil,
// BRL). Rules the backend enforces and zod here does not: product and reviews take product_id or url; brand takes brand
// or brand_id; filters hold at most 5 keys. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Terabyteshop (terabyteshop.com.br, Brazil's PC-parts store), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW_TIME = "Usually 5 to 30 s, up to about 90 s; allow a client timeout of at least 180 s.";
const FAST_TIME = "Usually 2 to 6 s; allow a client timeout of at least 60 s.";
const ITEM =
  "position, product_id (what get_terabyte_product takes), name, url, image, brand, category, gtin, mpn, price (the card price), pix_price (the Pix price; Pix is Brazil's instant payment), list_price (the struck-through regular price), discount_percent (Pix vs list), installment {count, amount, interest_free}, currency, available, open_box, free_shipping, free_shipping_states, on_promotion, offer {campaign, ends_at}, units_sold, best_seller_rank {position, category}, rating, review_count, coupon {code, value, discount_type, units_left} and labels";
const GRID = `30 per page, in the site's order or by price, filtered by sub-category and spec attributes. Returns category, url, page, page_size, sort, total, total_pages, has_more, count, items [{${ITEM}}] (listing cards carry the Pix price, list price and installments; price, the card total, is on get_terabyte_product), facets {total, price_range, subcategories [{name, count}], brands [{brand_id, name, count}], attributes [{key, label, unit, numeric, values [{value, count}]}], attribute_category}, filters_applied and notes.`;
const NOT_BUILT =
  "Not available: shipping by CEP (Terabyteshop quotes it in the cart), stores (it has none) and stock unit counts (it publishes availability flags, units sold and a deal's units left).";

const id = (description: string) =>
  z.union([z.string().regex(/^\d{1,9}$/), z.number().int().min(1)]).optional().describe(description);
const productRef = {
  product_id: id("The Terabyteshop product id (items[].product_id; the number after /produto/ in a product link), e.g. '41251'. Send product_id or url."),
  url: z.string().max(500).optional()
    .describe("Or a product link on www.terabyteshop.com.br (items[].url)."),
};
const category = z.string().min(1).max(300)
  .describe("A category path as the site writes it (the path of a category link on www.terabyteshop.com.br), e.g. 'hardware/placas-de-video', 'hardware/processadores', 'monitores', 'perifericos/mouse'.");
const grid = {
  sort: z.enum(["relevance", "price_asc", "price_desc"]).optional()
    .describe("relevance (default, the site's own order), price_asc or price_desc."),
  page: z.number().int().min(1).max(400).optional()
    .describe("Results page, 1-based, 30 products each; total_pages reports the last one."),
  subcategory: z.string().min(1).max(120).optional()
    .describe("A sub-category name exactly as facets.subcategories[].name lists it, e.g. 'Placa de Video'."),
};
const filters = z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string()).max(10)])).optional()
  .describe("Spec filters, at most 5 keys: {key: value or [values]}, keys and values exactly as facets.attributes[].key and .values[].value list them (e.g. modelo, fabricante, vram_gb, conexao), e.g. {\"modelo\": \"RTX 5070\"}. Several values match any of them.");

export function registerTerabyteTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/terabyte/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_terabyte",
    `${SITE} keyword search, up to 100 per page: query, page, page_size, sort, total, total_pages, has_more, count, items [{${ITEM}}] and notes. The site's search ignores sorting, so Scavio sorts the returned page (by Pix price, units sold, rating or review count) and a note says so. A keyword that matches nothing returns total 0 (the unrelated products the site answers with are dropped). When the fast search answer fails, the search page is read instead: up to 300 results, total null, slower. Captured 2026-11-27: rtx 5060 matched 162 products, the first an RTX 5060 Ti card at 4199.99 BRL by Pix (4941.16 by card, list 6565.65). ${COST} ${SLOW_TIME}`,
    {
      query: z.string().min(1).max(120)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'rtx 5060'."),
      page: z.number().int().min(1).max(100).optional().describe("Results page, 1-based."),
      page_size: z.number().int().min(1).max(100).optional().describe("Products per page, 1 to 100 (default 24)."),
      sort: z.enum(["relevance", "price_asc", "price_desc", "best_sellers", "top_rated", "most_reviewed"]).optional()
        .describe("relevance (default, the site's order), price_asc, price_desc (by Pix price), best_sellers (units sold), top_rated or most_reviewed. Applied by Scavio to the returned page."),
    },
    post("search"),
  );

  server.tool(
    "get_terabyte_product",
    `One ${SITE} product by product_id or link: product_id, requested_id, name, url, brand, category, gtin (EAN), mpn, part_number, images, price (card total), pix_price, list_price, discount_percent, pix_discount_percent, installment {count, amount, interest_free}, installments [{count, amount, discount_percent, interest}] (every card plan), currency, available, availability, condition (Novo, Open Box), open_box, warranty, warranty_months, sold_by, best_seller_rank {position, category, category_url}, offer {campaign, ends_at (Brasilia time), units_sold, units_left, stock_label} (a running deal), price_valid_until, coupon, free_shipping, free_shipping_states, rating, review_count, return_days, key_specs [{name, value}], specs [{name, value}] and reviews [{rating, date, text}] (the 5 newest; no reviewer names). ${NOT_BUILT} An unknown product is a charged not-found. Captured 2026-11-27: 41251, a Gigabyte GS24F14 23.8-inch monitor, at 549.99 BRL by Pix (647.05 by card, 12 interest-free installments of 53.92), in a Black Friday offer ending 2026-11-30 with 6 units left. ${COST} ${SLOW_TIME}`,
    productRef,
    post("product"),
  );

  server.tool(
    "get_terabyte_reviews",
    `Customer reviews of one ${SITE} product, newest to oldest, 5 per page: product_id, url, page, page_size, has_more, count and reviews [{rating, date, verified_buyer, text}]; sent with product_id alone it also returns average_rating, total_reviews and total_pages. No reviewer names or places. With url it is fastest. Captured 2026-11-27: product 20782, a Ryzen 5 processor, had 367 reviews over 74 pages, average 5. ${COST} ${FAST_TIME}`,
    {
      ...productRef,
      page: z.number().int().min(1).max(400).optional().describe("Page, 1-based, 5 reviews each."),
    },
    post("reviews"),
  );

  server.tool(
    "get_terabyte_category",
    `One ${SITE} category by path. ${GRID} An unknown category is a charged not-found. Captured 2026-11-27: hardware/placas-de-video held 878 products over 30 pages, the first an RTX 3050 card at 1679.99 BRL by Pix (list 2809.90). ${COST} ${SLOW_TIME}`,
    { category, ...grid, filters },
    post("category"),
  );

  server.tool(
    "get_terabyte_brand",
    `One brand's products in one ${SITE} category, by category path and brand name or brand_id (facets.brands of a category answer): brand {brand_id, name, count} and the listing. ${GRID} A brand with no products in the category is a charged not-found listing the brands there. Captured 2026-11-27: Logitech (brand_id 39) had 91 products in perifericos/mouse. ${COST} ${SLOW_TIME}`,
    {
      category,
      brand: z.string().min(1).max(80).optional()
        .describe("A brand name as facets.brands[].name lists it (case and accents ignored), e.g. 'Logitech'. Send brand or brand_id."),
      brand_id: id("Or a brand id (facets.brands[].brand_id), e.g. '39'."),
      ...grid,
      filters,
    },
    post("brand"),
  );

  server.tool(
    "get_terabyte_deals",
    `The ${SITE} deal listings: black_friday (the promotions page, Black Friday 2026), open_box or free_shipping, sorted, by sub-category or brand. ${GRID} Also deal. items[].offer.ends_at is each deal's end; get_terabyte_product adds its units left. Captured 2026-11-27: black_friday listed 6767 products over 226 pages. ${COST} ${SLOW_TIME}`,
    {
      deal: z.enum(["black_friday", "open_box", "free_shipping"]).optional()
        .describe("black_friday (default: the site's promotions page), open_box (open-box products) or free_shipping (free-shipping products)."),
      brand_id: id("One brand (facets.brands[].brand_id), e.g. '39'."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_terabyte_coupons",
    `The active ${SITE} coupons: all of them, one category's, or one code with the products it covers: coupons [{code, discount, discount_type (percent, amount), discount_value, scope, units_left, valid_until, minimum_order, free_shipping, conditions, product_count, url}] and coupon_categories [{slug, name, coupon_count}]; with code, coupon {... used_percent} and products [{product_id, name, url, image, brand, product_type}]. An unknown code or category is a charged not-found. Captured 2026-11-27: 11 active coupons in 4 coupon categories, e.g. BLACKDT3, 5% off selected chairs, 70 left, valid until 2026-11-30. ${COST} ${FAST_TIME}`,
    {
      code: z.string().min(2).max(40).optional()
        .describe("One coupon code (coupons[].code), e.g. 'BLACKDT3': the coupon and the products it covers."),
      category: z.string().min(1).max(60).optional()
        .describe("A coupon category slug (coupon_categories[].slug), e.g. 'placa-mae', 'memoria-ram': its coupons. Without code or category, every active coupon."),
    },
    post("coupons"),
  );

  server.tool(
    "get_terabyte_trending_searches",
    `The top ${SITE} search terms, as the site ranks them: count and terms [{position, term, search_count, top_product {product_id, name, url, image, brand, category, price, pix_price, currency, available}}], up to 48. Captured 2026-11-27: 48 terms, the first placa de video, searched 60900 times. ${COST} ${FAST_TIME}`,
    {
      limit: z.number().int().min(1).max(48).optional().describe("How many terms, 1 to 48 (default: all the site lists)."),
    },
    post("trending-searches"),
  );

  server.tool(
    "get_terabyte_pc_builder",
    `The Full Custom PC builder of ${SITE}: without inputs, platforms [{platform_id, name, url}]; with platform_id, its component groups [{group_id, name, optional, max_items, min_items, option_count, note}]; with platform_id and group_id, that group's options [{product_id, name, url, image, brand, price (card), pix_price, pix_discount_percent, installment, on_offer, new_release, selected_by_default, assembly_available, available, availability_by_distribution_center [{distribution_center (SC, ES), available}]}]. Builder prices are the builder's own and can differ from the product page. Nothing is added to a cart or saved. An unknown platform is a charged not-found. Captured 2026-11-27: platform 18613, group 21065 listed 5 processor options, the first a Ryzen 5 3400G at 382.49 BRL by Pix. ${COST} ${FAST_TIME}`,
    {
      platform_id: id("A builder platform (platforms[].platform_id), e.g. '18613': its component groups. Without it, the platforms."),
      group_id: id("A component group of that platform (groups[].group_id), e.g. '21065': its options."),
    },
    post("pc-builder"),
  );
}
