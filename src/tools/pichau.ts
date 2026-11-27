import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/pichau.ts (Pichau, pichau.com.br, Brazil's PC-parts store; Brazil, BRL). Rules the
// backend enforces and zod here does not: product and product-live take url_key or url; installments takes url_key or
// url, or product_id with price (not both); deals takes deal or campaign (not both); filters hold at most 5 keys. No
// zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Pichau (pichau.com.br, Brazil's PC-parts store), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const FAST_TIME = "Usually 2 to 8 s; allow a client timeout of at least 60 s.";
const PAGE_TIME = "Usually 5 to 60 s; allow a client timeout of at least 240 s.";
const LIST_TIME = "Listing pages took 5 to 170 s in Black Friday week (2026-11-27); allow a client timeout of at least 240 s.";
const LIVE_TIME = "Usually 30 to 160 s; allow a client timeout of at least 240 s.";
const ITEM =
  "position, product_id, sku, url_key (what get_pichau_product takes), url, name, brand, brand_slug, category, category_path, image, price (the card price), pix_price (the Pix price; Pix is Brazil's instant payment), list_price (the struck-through regular price), discount_percent (Pix vs list), pix_discount_percent, installment {count, amount}, currency, available, stock_status, only_x_left, on_promotion, offer {campaign, campaign_path, ends_at, promo_price, discount_percent, units_left, units_sold}, open_box, open_box_state, pre_order, free_shipping, labels, ean, warranty, product_type (simple, bundle), rating (0-5), rating_percent (0-100), review_count";
const GRID = `36 per page, in the site's order, by price or by name, filtered by the listing's own facets. Returns url, page, page_size, sort, total, total_pages, has_more, count, items [{${ITEM}}], facets [{key, label, values [{value, label, count}]}] and filters_applied.`;
const NOT_BUILT =
  "Not available: shipping by CEP (Pichau quotes it in the cart), stores (one physical store, no per-store data), stock unit counts (not published; a running promotion's units left are) and the PC builder.";

const grid = {
  sort: z.enum(["relevance", "price_asc", "price_desc", "name_asc", "name_desc"]).optional()
    .describe("relevance (default, the site's own order), price_asc, price_desc, name_asc or name_desc."),
  page: z.number().int().min(1).max(200).optional()
    .describe("Results page, 1-based, 36 products each; total_pages reports the last one."),
  filters: z.record(z.string(), z.union([z.string(), z.number()])).optional()
    .describe("Filters, at most 5 keys: {key: value}, exactly as facets[].key and facets[].values[].value of an answer list them (e.g. marcas (brand), price (a range such as 0_1000), rgpu, socket), e.g. {\"marcas\": \"34\"}. One value per key."),
};
const productRef = {
  url_key: z.string().min(1).max(300).optional()
    .describe("The product's url_key (items[].url_key; the part after www.pichau.com.br/ in a product link), e.g. 'placa-de-video-inno3d-geforce-rtx-5060-twin-x2-8gb-gddr7-128-bit-n50602-08d7-195071n-nac'. Send url_key or url."),
  url: z.string().max(500).optional().describe("Or a product link on www.pichau.com.br (items[].url)."),
};
const productId = (description: string) => z.union([z.string().regex(/^\d{1,9}$/), z.number().int().min(1)]).describe(description);

export function registerPichauTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/pichau/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_pichau",
    `Search ${SITE} by keyword. ${GRID} Also query and redirected_to: some keywords are sent by the site to one of its categories (e.g. cadeira gamer to cadeiras/gamer), and the answer is then that category's grid, as the site shows it, with redirected_to {category, url} (null otherwise). Captured 2026-11-27: rtx 5060 matched 1385 products, the first a Gainward RTX 5060 card at 3179.99 BRL by Pix (3741.17 by card, list 4117.64). ${COST} ${LIST_TIME}`,
    {
      query: z.string().min(1).max(120).describe("Search keywords, in Portuguese as shoppers type them, e.g. 'rtx 5060'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_pichau_category",
    `One category of ${SITE} by category path. ${GRID} Adds category and category_info {category_id, name, path, product_count, breadcrumbs}. An unknown category is a charged not-found. Captured 2026-11-27: hardware/placa-de-video held 948 products; filtered to marcas 34 and sorted price_asc, 93. ${COST} ${LIST_TIME}`,
    {
      category: z.string().min(1).max(300)
        .describe("A category path as the site writes it (categories[].path of get_pichau_categories, or the path of a category link), e.g. 'hardware/placa-de-video', 'monitores', 'perifericos/teclado', 'cadeiras/gamer'."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_pichau_brand",
    `One brand's products on ${SITE} by brand slug. ${GRID} Adds brand and brand_info {brand_id, name, slug}. An unknown brand is a charged not-found. Captured 2026-11-27: corsair held 875 products. ${COST} ${LIST_TIME}`,
    {
      brand: z.string().min(1).max(120)
        .describe("A brand slug (items[].brand_slug, or the part after /marca/ in a brand link), e.g. 'corsair', 'asus', 'redragon'."),
      ...grid,
    },
    post("brand"),
  );

  server.tool(
    "get_pichau_deals",
    `The deal listings of ${SITE}: black_friday (the Black Friday 2026 campaign page), open_box (open-box products) or another campaign by slug. ${GRID} Adds deal, campaign and campaign_info {campaign_id, slug, title, state, starts_at, ends_at} on a campaign; items[].offer is each product's countdown (ends_at, units_left, units_sold). An unknown campaign is a charged not-found. Captured 2026-11-27: black_friday (running 2026-11-01 to 2026-11-30) held 1467 products, the first a Ryzen 7 9800X3D processor at 2149.99 BRL by Pix with 85 units left and 1330 sold. ${COST} ${LIST_TIME}`,
    {
      deal: z.enum(["black_friday", "open_box"]).optional()
        .describe("black_friday (default: the site's Black Friday 2026 campaign page) or open_box (open-box products)."),
      campaign: z.string().min(1).max(80).optional()
        .describe("Another campaign by slug (items[].offer.campaign_path without promocao/), e.g. 'blackfriday', instead of deal."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_pichau_product",
    `One product of ${SITE} by url_key or link: product_id (what get_pichau_reviews and get_pichau_installments take), requested_url_key, sku, mpn, ean, ncm, name, url, brand, brand_slug, brand_id, category, category_path, categories [{name, path}], product_set, images, price (card), pix_price, pix_discount_percent, list_price, discount_percent, installment {count, amount}, currency, available, stock_status, only_x_left, on_promotion, offer {campaign, campaign_path, ends_at (Brasilia time), promo_price, discount_percent, units_left, units_sold}, open_box, open_box_state, open_box_condition, pre_order, free_shipping, labels, warranty, distribution_center, club_exclusive, product_type (simple, bundle), rating (0-5), rating_percent, review_count and specs [{name, value}]. A bundle (a prebuilt PC or kit) has its parts and benchmarks on get_pichau_product_live. ${NOT_BUILT} An unknown product is a charged not-found. Captured 2026-11-27: 61004, an INNO3D RTX 5060 Twin X2 card, was 3159.99 BRL by Pix (3717.64 by card, list 3835.28) in a Black Friday offer ending 2026-11-30 with 2 units left and 117 sold. ${COST} ${PAGE_TIME}`,
    productRef,
    post("product"),
  );

  server.tool(
    "get_pichau_product_live",
    `One product page of ${SITE} as a visitor sees it, by url_key or link: product_id, sku, name, product_type, available, stock_status, only_x_left, price, pix_price, list_price, installment, on_promotion, offer {campaign, ends_at, promo_price, units_left, units_sold} (live), benchmark {overall_score, cpu_score, gpu_score, games [{title, full_hd_fps, ultra_1080p_fps, quad_hd_fps, medium_4k_fps, ultra_4k_fps}]} (the UL benchmark FPS the site shows on PCs; an FPS of 0 is the site's 'under 20 FPS'), components [{group, required, selected, choice_count, choices [{product_id, sku, name, url_key, url, quantity, is_default, available, image}]}] (a prebuilt PC's or kit's parts per group), rating and review_count. Slower than get_pichau_product: use it for live promotion units, benchmarks and component lists. An unknown product is a charged not-found. Captured 2026-11-27: a Pichau prebuilt PC (Ryzen 5 5500, RTX 5060) listed 22 component groups and FPS for 14 games, with 48 Black Friday units left and 102 sold. ${COST} ${LIVE_TIME}`,
    productRef,
    post("product-live"),
  );

  server.tool(
    "get_pichau_reviews",
    `Customer reviews of one ${SITE} product by product_id, newest first, 10 per page, filtered by stars or media: product_id, page, page_size, rating_filter, with_media, average_rating (0-5), rating_percent (0-100), total_reviews, breakdown {5, 4, 3, 2, 1}, total_pages, has_more, count and reviews [{title, text, rating, date, verified_purchase, media [{type, url}]}]. No reviewer names. Captured 2026-11-27: product 31201, a processor, had 57 reviews, average 5. ${COST} ${FAST_TIME}`,
    {
      product_id: productId("The Pichau product id (items[].product_id, or get_pichau_product's product_id), e.g. '31201'."),
      page: z.number().int().min(1).max(500).optional().describe("Page, 1-based, 10 reviews each (newest first)."),
      rating: z.number().int().min(1).max(5).optional().describe("Only reviews with this many stars (1 to 5)."),
      with_media: z.boolean().optional().describe("Only reviews with photos or videos."),
    },
    post("reviews"),
  );

  server.tool(
    "get_pichau_installments",
    `Every card plan of one ${SITE} product, by product_id and price (fast) or by url_key / link (the product page is read first for its id and price): product_id, price, count, installments [{count, amount, total, discount_percent, discount_value, interest_free, label}] (Pichau discounts short card plans too) and product. Pix is priced separately (the product's pix_price). Captured 2026-11-27: product 61004 at 3717.64 BRL had 12 plans, from 1 payment of 3345.88 (10% off) to 12 interest-free installments of 309.80. ${COST} ${FAST_TIME} By url_key: ${PAGE_TIME}`,
    {
      ...productRef,
      product_id: productId("The Pichau product id (items[].product_id), with price: the fastest form, e.g. '61004'. Send url_key or url, or product_id with price.").optional(),
      price: z.number().positive().max(1_000_000).optional()
        .describe("With product_id: the product's card price in BRL (items[].price), e.g. 3717.64."),
    },
    post("installments"),
  );

  server.tool(
    "get_pichau_coupons",
    `The coupons of ${SITE}, as the coupons page lists them: url, count, coupons [{code, percent, kind (the site's own type: OUTRO, CATEGORIA, RASGADA), applies_to (product, category), valid_until (null when the site shows no end), status, image}], upcoming_count and upcoming (announced, not active yet). The page does not say which products a coupon covers. Captured 2026-11-27: 18 active coupons, none upcoming. ${COST} ${PAGE_TIME}`,
    {},
    post("coupons"),
  );

  server.tool(
    "get_pichau_categories",
    `The category menu of ${SITE}: count, departments and categories [{category_id, name, path, level, children}] as the site's menu shows them (all true: every node, including campaign and partner pages the site keeps out of its menu). Send a path to get_pichau_category. Captured 2026-11-27: 18 departments, 119 categories. ${COST} ${PAGE_TIME}`,
    {
      all: z.boolean().optional().describe("Every node of the menu, including campaign and partner pages the site keeps out of its menu (default false)."),
    },
    post("categories"),
  );

  server.tool(
    "get_pichau_suggestions",
    `What the search box of ${SITE} suggests for what a shopper typed: query, term_count, terms [{term, count}] (how many products match), categories [{name, path, url}] (send path to get_pichau_category), count and products [{name, url_key, url, image, price, available, pre_order}] (up to 10, as the box lists them; the price as the box shows it, get_pichau_product has the card, Pix and list prices). Captured 2026-11-27: rtx 5070 suggested 10 products, the first at 5999.99 BRL. ${COST} ${LIVE_TIME}`,
    {
      query: z.string().min(2).max(60).describe("What a shopper has typed into the search box (2 or more characters), e.g. 'rtx 5070'."),
    },
    post("suggestions"),
  );
}
