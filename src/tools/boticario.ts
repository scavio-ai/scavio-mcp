import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/boticario.ts (O Boticario and Eudora, boticario.com.br and eudora.com.br, the beauty
// brands of Grupo Boticario; brand boticario | eudora; Brazil only, BRL). Rules the backend enforces and zod here does
// not: product and pickup take slug, url or sku. No zod `.default()`: the MCP SDK would post a defaulted field on
// every call.

const SITE =
  "O Boticario or Eudora (boticario.com.br, eudora.com.br, the beauty brands of Grupo Boticario; brand picks the storefront), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const PAGE =
  "1 credit, 2 when the page needs a second route (credits_used is what was charged). Pages come from the site's own cache: prices can be up to about 15 minutes old. Failed upstream calls and refused inputs are not charged; a not-found is charged. The site's pages are slow: usually 10 to 130 s; allow a client timeout of at least 240 s.";
const ONE =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 2 to 25 s; allow a client timeout of at least 90 s.";
const ITEM =
  "items [{position, sku (what get_boticario_product, get_boticario_prices and get_boticario_pickup take), name, product_brand, url, slug, image, price (card price), pix_price (the Pix price; Pix is Brazil's instant payment), was_price, discount_percent, installments {count, amount}, badges (deal text as given), available, free_shipping, deal_ends_at (the item's countdown end), rating, review_count}]";
const GRID = `36 per page in 7 sorts, filtered by product brand, line, category, rating, price and any other facet the listing offers: page, page_size, total, total_pages, has_more, count, sort, title, redirected_to, ${ITEM}, facets [{key, name, values [{name, value, count, selected}]}], price_ranges [{range, count}], filters_applied and notes.`;

const brand = z.enum(["boticario", "eudora"]).optional()
  .describe("boticario (O Boticario, www.boticario.com.br; default) or eudora (Eudora, www.eudora.com.br).");
const slugValues = z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).max(10)]);
const cep = z.union([z.string().min(8).max(12), z.number().int().min(1000000).max(99999999)])
  .describe("A Brazilian CEP (postal code, 8 digits), e.g. '01310-100'.");

const grid = {
  sort: z.enum(["relevance", "price_asc", "price_desc", "discount", "rating", "best_sellers", "newest"]).optional()
    .describe("relevance (default), price_asc, price_desc, discount, rating, best_sellers or newest."),
  product_brand: slugValues.optional()
    .describe("Product brand slug(s) as the site writes them (facets key marca), e.g. 'egeo', 'floratta', 'lily'."),
  line: slugValues.optional()
    .describe("Product line slug(s) (facets key linha)."),
  category: slugValues.optional()
    .describe("Category slug(s) (facets key categoria)."),
  min_rating: z.number().int().min(1).max(5).optional()
    .describe("1 to 4: that many stars or more; 5: 5 stars."),
  min_price: z.number().int().min(0).max(100000).optional()
    .describe("Minimum price in BRL."),
  max_price: z.number().int().min(1).max(100000).optional()
    .describe("Maximum price in BRL."),
  facets: z.record(z.string(), slugValues).optional()
    .describe("Any other facet the listing offers, by facets[].key: {\"<key>\": value or [values]} (values from facets[].values[].value), e.g. {\"familia-olfativa\": \"amadeirado\"}."),
  page: z.number().int().min(1).max(100).optional()
    .describe("Results page, 1 to 100 (36 per page). Defaults to 1."),
};

const productRef = {
  brand,
  slug: z.string().min(1).max(200).optional()
    .describe("The product slug (items[].slug), e.g. 'base-liquida-cor-330-make-b-mate-salicylic-30g'. Send slug, url or sku."),
  url: z.string().min(1).max(600).optional()
    .describe("Or a boticario.com.br or eudora.com.br product link (it names the brand too)."),
  sku: z.string().min(1).max(24).optional()
    .describe("Or a product SKU (items[].sku), e.g. 'B01863', resolved through the site's SKU lookup."),
};

export function registerBoticarioTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/boticario/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_boticario",
    `${SITE} keyword search. ${GRID} A keyword the site sends to a category landing (Eudora does this for broad terms) is followed as the site does it (redirected_to), with the sort, filters and page applied there. Captured 2026-11-27: perfume on O Boticario gave 1823 results over 51 pages, the first the Combo Lily Le Parfum (perfume 30ml + body oil 150ml) at 434.80 BRL by card or 391.32 BRL by Pix with the coupon badge CUPOM: MAIS10, rated 4.98 from 43 reviews. ${PAGE}`,
    {
      brand,
      query: z.string().min(1).max(200)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'perfume'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_boticario_category",
    `One ${SITE} listing: a department, category or product-brand page by path or link, sorted and filtered like search_boticario. Also path and url. ${GRID} An unknown path is a charged not-found. Captured 2026-11-27: /perfumaria/ on O Boticario held 911 products over 26 pages, sorted best_sellers, the first the Egeo Spicy Vibe Desodorante Colonia 90ml at 122.90 BRL (was 164.90, 25% off). ${PAGE}`,
    {
      brand,
      path: z.string().min(1).max(600)
        .describe("A listing path or link: a department ('/perfumaria/'), a category ('/maquiagem/boca/batom/'), a product brand ('/egeo/') or a get_boticario_categories path."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_boticario_categories",
    `The ${SITE} category menu: departments [{name, path, groups [{name, path, links [{name, path}]}]}]; every path works in get_boticario_category. Captured 2026-11-27: O Boticario listed 30 departments, from Beauty Week and Perfumaria to Maquiagem. ${PAGE}`,
    { brand },
    post("categories"),
  );

  server.tool(
    "get_boticario_deals",
    `The ${SITE} deal listings: type beauty_week (the site's Black Friday event, Beauty Week) or promotions (the promotions hub), optionally one section, sorted and filtered like search_boticario; each item carries its own countdown end (deal_ends_at) and its deal badges. Also type, section, path and url. ${GRID} Captured 2026-11-27: Beauty Week on O Boticario held 1216 items over 34 pages, the first a lipstick at 7.50 BRL (was 37.90, 80% off) with a countdown to 2026-11-28 10:00 Brasilia time. ${PAGE}`,
    {
      brand,
      type: z.enum(["beauty_week", "promotions"]).optional()
        .describe("beauty_week (default: the site's Black Friday event, /beauty-week/) or promotions (the promotions hub, /promocao/)."),
      section: z.string().min(1).max(80).optional()
        .describe("Optional sub-page as the site's links write it: a department (perfumaria, maquiagem, cabelos) or a promotion (menor-preco-do-mes, leve-x-pague-y, desconto-progressivo, cashback)."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_boticario_promotions",
    `The promotions conditions page of ${SITE}: url, valid_from, valid_to and campaigns [{name, section, valid_from, valid_to, coupons}], each campaign's validity dates and coupon codes as written on the page. Captured 2026-11-27: O Boticario listed 19 campaigns from 2026-11-03, one an app first-purchase coupon valid to 2026-11-30. ${PAGE}`,
    { brand },
    post("promotions"),
  );

  server.tool(
    "get_boticario_product",
    `One ${SITE} product by slug, link or SKU: sku, requested, name, product_brand, url, slug, gtin, image, price (card price), pix_price, pix_discount_percent, was_price, discount_percent, installments {count, amount}, price_text (the site's price sentence), availability (in_stock / out_of_stock), stock_units (the site's online stock count, as given), seller {id, name}, categories, breadcrumbs, specs [{name, values}] (the datasheet), product_group_id (what get_boticario_reviews takes for every shade together), varies_by, variants [{sku, name, color, size, url, image, price, availability, selected}] (every shade / size), kit_components [{sku, name, slug, url, quantity_in_kit, price, was_price, discount_percent, installments, stock_units}], kits_containing and review_summary {average_rating, count, histogram, recommend_percent, ai_summary (the site's own AI summary, as given)}. Per-store stock and loyalty prices are not published. An unknown product is a charged not-found. Captured 2026-11-27: B01863, the Base Liquida Cor 330 Make B. Mate Salicylic 30g, at 59.90 BRL (was 99.90, 40% off) with 440 units in online stock and 9 shade variants, rated 4.88 from 3860 reviews, 97% recommending it. ${PAGE}`,
    productRef,
    post("product"),
  );

  server.tool(
    "get_boticario_prices",
    `Current prices of up to 10 SKUs on ${SITE}, one SKU lookup per SKU: requested, count, found and items [{sku, found, name, slug, url, product_brand, department, price, was_price, discount_percent, pix_price, installments, shade, presentation, image, seller}]. Unknown SKUs come back found false; if none is found, a charged not-found. Costs 1 credit per 5 SKUs (ceil(skus / 5); credits_used is what was charged). Failed upstream calls and refused inputs are not charged. Captured 2026-11-27: B01863, B48734 and B2022081233 all found, the first at 59.90 BRL (was 99.90), for 1 credit. Usually 2 to 25 s; allow a client timeout of at least 90 s.`,
    {
      brand,
      skus: z.union([z.array(z.string().min(1).max(24)).min(1).max(10), z.string().min(1).max(300)])
        .describe("1 to 10 SKUs, an array or comma-separated, e.g. ['B01863', 'B48734', 'B2022081233']."),
    },
    post("prices"),
  );

  server.tool(
    "get_boticario_reviews",
    `Reviews of one ${SITE} product, by SKU (that shade's reviews) or by the product's product_group_id (every shade together: the count the product page shows): product_id, sort, stars, page, page_size, total, total_pages, has_more, count and reviews [{review_id, rating, text, created_at, modified_at, most_useful, upvotes, downvotes, reviewer_state, reviewer_type, sku, product_name, variant, photo_count}]. Up to 50 per page, sorted most_recent, most_useful or oldest, filtered by stars. No reviewer names, cities or gender. Captured 2026-11-27: B2022081233 had 43 reviews over 3 pages of 20. ${ONE}`,
    {
      brand,
      product_id: z.string().min(1).max(2000)
        .describe("A SKU, e.g. 'B2022081233', or get_boticario_product's product_group_id."),
      sort: z.enum(["most_recent", "most_useful", "oldest"]).optional()
        .describe("most_recent, most_useful or oldest. Default: the site's order."),
      stars: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars (1 to 5)."),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Reviews per page, 1 to 50. Defaults to 20."),
    },
    post("reviews"),
  );

  server.tool(
    "get_boticario_stores",
    `The ${SITE} stores that offer pickup of online orders near a Brazilian CEP, nearest first: cep, radius_km, page, page_size, total, total_pages, has_more, count and stores [{store_id, name, pickup_time, distance_m, distance_km, hours {weekday, weekend}, address {street, number, district, postal_code, city, state}}]. Store stock and prices are not published. Captured 2026-11-27: CEP 01310-100 had 348 O Boticario pickup stores, the nearest 55 m away with pickup in up to 3 hours. ${ONE}`,
    {
      brand,
      cep,
      radius_km: z.number().int().min(1).max(100).optional()
        .describe("Optional radius around the CEP in km, 1 to 100."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Stores per page, 1 to 50. Defaults to 20."),
    },
    post("stores"),
  );

  server.tool(
    "get_boticario_pickup",
    `Delivery and pickup for one ${SITE} product at a Brazilian CEP: available, seller_id, delivery [{type, description, expected_days, shipping_cost}] (the delivery time as the site words it) and click_and_collect (whether the site offers pickup at a store near the CEP: true / false). Which store and per-store stock are not published. By SKU it is a lookup and the quote (2 calls, still 1 credit). Captured 2026-11-27: B2022081233 to CEP 01310-100 had free normal delivery in 1 business day and store pickup offered. ${ONE}`,
    { ...productRef, cep },
    post("pickup"),
  );

  server.tool(
    "get_boticario_suggestions",
    `The ${SITE} search suggestions: query, count, terms [{term, departments}] and up to 5 products [{sku, name, slug, url, product_brand, department, price, was_price, discount_percent, pix_price, installments, shade, presentation, image, seller}]. A SKU works as the query too. Captured 2026-11-27: perfume on O Boticario suggested 5 terms (perfumaria, perfumado, egeo perfumaria...) and 5 products. ${ONE}`,
    {
      brand,
      query: z.string().min(1).max(100)
        .describe("What a shopper types (a SKU works too), e.g. 'perfume'."),
    },
    post("suggestions"),
  );
}
