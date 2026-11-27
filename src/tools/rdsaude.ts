import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/rdsaude.ts (Drogasil and Droga Raia, drogasil.com.br and drogaraia.com.br, the
// pharmacy chains of RD Saude; site drogasil | drogaraia; Brazil only, BRL). Rules the backend enforces and zod here
// does not: category takes category_id or url; product takes sku or url; store availability takes at most 5 product x
// store checks; facets hold at most 8 filters. No zod `.default()`: the MCP SDK would post a defaulted field on every
// call.

const SITE = "Drogasil and Droga Raia (drogasil.com.br and drogaraia.com.br, the pharmacy chains of RD Saude), Brazil only, Portuguese text";
const PRICES =
  "Prices in BRL are the site's default online price (a reference price, not a per-store price).";
const REG =
  "regulatory {anvisa_registration, tarja, tarja_code, is_controlled, is_antibiotic, is_psychotropic, is_thermolabile} exactly as the site gives them.";
const ONE =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 2 to 15 s; allow a client timeout of at least 120 s.";
const ITEM =
  "items [{position, sku (what get_rdsaude_product takes), ean, name, brand, manufacturer, url, image, type (MEDICATION, PRODUCT), status, in_stock, price, list_price, discount_percent, price_type, quantity_discount {min_quantity, unit_price}, index_price, currency, labels, categories, quantity, active_ingredients, variant_count, variant_attributes, is_kit, sold_by, delivered_by, regulatory}]";
const GRID = `sort, page, page_size, total, total_pages, reachable_pages, has_more, count, ${ITEM}, facets [{name, values [{value, count}]}] (send back in facets) and filters_applied. ${REG}`;

const site = z.enum(["drogasil", "drogaraia"]).optional()
  .describe("drogasil (default, www.drogasil.com.br) or drogaraia (www.drogaraia.com.br). Prices, category ids, stores and reviews differ per banner.");
const sku = z.union([z.string().regex(/^\d{1,10}$/), z.number().int().min(1)]);
const storeId = z.union([z.string().regex(/^\d{1,6}$/), z.number().int().min(1)]);
const categoryId = z.union([z.string().regex(/^\d{1,8}$/), z.number().int().min(1)]);

const grid = {
  sort: z.enum(["relevance", "price_asc", "price_desc"]).optional()
    .describe("relevance (default), price_asc or price_desc. The price sort uses the search index's price (index_price), which can differ from the live price."),
  page: z.number().int().min(1).max(100).optional()
    .describe("Page, 1-based; reachable_pages reports the last page the site's search reaches. Defaults to 1."),
  page_size: z.union([z.literal(24), z.literal(36), z.literal(48)]).optional()
    .describe("24 (default), 36 or 48, the site's own page sizes."),
};
const brand = z.string().min(1).max(80).optional()
  .describe("A brand as facets[name=filters.Marca].values lists it, e.g. 'Neutrogena'.");
const filters = {
  brand,
  seller: z.enum(["own", "partner"]).optional()
    .describe("own (sold by Drogasil / Droga Raia) or partner (marketplace partner stores)."),
  highlight: z.string().min(1).max(80).optional()
    .describe("A highlight as facets[name=filters.Destaques].values lists it: 'Oferta do Dia', '% Especial', 'Black Friday', a coupon such as 'Cupom NIVEABRAND' ..."),
  store_id: storeId.optional()
    .describe("Products offered for pickup at this store (stores[].store_id)."),
  min_price: z.number().min(0).max(100000).optional()
    .describe("Lowest index price in BRL."),
  max_price: z.number().min(0).max(100000).optional()
    .describe("Highest index price in BRL."),
  facets: z.record(z.string(), z.string().max(80)).optional()
    .describe("Other filters, at most 8: {facet name: value} exactly as facets[].name and facets[].values[].value of an answer list them, e.g. {\"filters.Marca\": \"Nivea\"}."),
};

export function registerRdsaudeTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rdsaude/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_rdsaude",
    `${SITE} search by keyword, product code or EAN, sorted by relevance or price and filtered by brand, own or partner store, highlight (Oferta do Dia, % Especial, coupons, Black Friday), category, store pickup, a price range and any facet; 24, 36 or 48 a page: query, ${GRID} ${PRICES} The site's search reaches about 2016 results by relevance and about 1008 sorted by price; the price sort and range use the index price. Captured 2026-11-27: protetor solar on Drogasil gave 5583 results, the first the Protetor Solar Eucerin Oil Control Sérum FPS 75 30ml at 84.99 BRL (list 119.90). ${ONE}`,
    {
      query: z.string().min(1).max(120)
        .describe("Keywords, a product code or an EAN, in Portuguese as shoppers type them, e.g. 'protetor solar'."),
      site,
      ...grid,
      ...filters,
      category_id: categoryId.optional()
        .describe("Products of this category (categories[].id or items[].categories[].id)."),
    },
    post("search"),
  );

  server.tool(
    "get_rdsaude_category",
    `One ${SITE} category by category id or category page link, sorted and filtered like search_rdsaude: category_id, name, url (with a link input) and ${GRID} ${PRICES} An unknown or empty category is a charged not-found. Captured 2026-11-27: a Droga Raia sunscreen category (8222) held 353 products over 15 pages. ${ONE}`,
    {
      category_id: categoryId.optional()
        .describe("A category id (categories[].id from get_rdsaude_categories), e.g. '8222'. Send category_id or url."),
      url: z.string().min(10).max(500).optional()
        .describe("Or a category page link on either site (its host sets site)."),
      site,
      ...grid,
      ...filters,
    },
    post("category"),
  );

  server.tool(
    "get_rdsaude_categories",
    `The ${SITE} menu tree, three levels: department_count, category_count and categories [{id (what get_rdsaude_category takes), name, url, level, children}]. Category ids differ per banner. Usually 10 to 30 s. Captured 2026-11-27: Droga Raia listed 9 departments and 379 categories. ${ONE}`,
    { site },
    post("categories"),
  );

  server.tool(
    "get_rdsaude_product",
    `One ${SITE} product by product code or page link: sku, name, url, ean, brand, manufacturer, breadcrumb, images, labels, in_stock, price, list_price, discount_percent, price_ladder {list_price, offers [{description, price, discount_percent}], quantity_discount {min_quantity, unit_price, discount_percent} (leve mais pague menos), lab_program {program, prices} (as given), payment_discounts, price_hierarchy}, quantity, dosage, active_ingredient, weight_kg, refrigerated, regulatory {anvisa_registration, tarja, tarja_code, controlled_type_code, psychotropic_list_code, therapeutic_class} (as given), seller {is_partner, seller_id, name} (the marketplace business name), variants [{sku, name, url, ean, attributes, price, discount_percent, in_stock}] and kit {products, available_in_kits}. ${PRICES} No descriptions or package-insert text. An unknown product is a charged not-found. Captured 2026-11-27: Drogasil sku 72654, the Kit Nivea Sun Protect & Hidrata Protetor Solar Corporal FPS 50, at 43.99 BRL (list 72.99, 39.73% off); Droga Raia sku 1374440, an Australian Gold sunscreen sold by a marketplace partner at 49.98 BRL with 2 variants. ${ONE}`,
    {
      sku: sku.optional()
        .describe("A product code (items[].sku), e.g. '72654'. Send sku or url."),
      url: z.string().min(10).max(500).optional()
        .describe("Or a product page link on either site (its host sets site)."),
      site,
    },
    post("product"),
  );

  server.tool(
    "get_rdsaude_prices",
    `Current prices of up to 48 ${SITE} products in one call: requested, found and items [{sku, found, name, in_stock, price, list_price, discount_percent, price_type, quantity_discount, variant_count, variant_attributes}]. ${PRICES} Captured 2026-11-27: 3 Drogasil codes, all found, the first the Kit Nivea Sun FPS 50 at 43.99 BRL. ${ONE}`,
    {
      skus: z.array(sku).min(1).max(48)
        .describe("1 to 48 product codes (items[].sku), e.g. ['72654', '38155']."),
      site,
    },
    post("prices"),
  );

  server.tool(
    "get_rdsaude_store_availability",
    `Store pickup availability at ${SITE} for products (codes or EANs) at stores, up to 5 product x store checks per call: sku_count, store_count and skus [{code, code_type, sku, name, stores [{store_id, pickup_available}]}]. A yes / no from the site's own store-pickup filter: no unit counts, and the price is the same at every store. Captured 2026-11-27: Droga Raia sku 38155 (an Episol sunscreen powder) was available for pickup at stores 200 and 210. ${ONE}`,
    {
      skus: z.array(z.union([z.string().regex(/^\d{1,14}$/), z.number().int().min(1)])).min(1).max(5)
        .describe("Product codes or EANs, e.g. ['38155']."),
      store_ids: z.array(storeId).min(1).max(5)
        .describe("Store ids (stores[].store_id from get_rdsaude_stores or search_rdsaude_stores), e.g. ['200', '210']. At most 5 product x store checks per call."),
      site,
    },
    post("store-availability"),
  );

  server.tool(
    "get_rdsaude_stores",
    `The nearest stores (up to 6) of one ${SITE} banner to a Brazilian CEP (postal code): cep, count and stores [{store_id, banner, name, address {street, number, district, city, state, cep}, latitude, longitude, distance_km, phone, open_24h, parking, farmacia_popular, hours {weekdays, saturday, sunday}, active}]. An empty list: no store of that banner near the CEP. Captured 2026-11-27: CEP 01310-100 listed 6 Drogasil stores, the nearest PAULISTA. ${ONE}`,
    {
      cep: z.union([z.string().regex(/^\d{5}-?\d{3}$/), z.number().int().min(1000000).max(99999999)])
        .describe("A Brazilian CEP (postal code, 8 digits), e.g. '01310-100'."),
      site,
    },
    post("stores"),
  );

  server.tool(
    "search_rdsaude_stores",
    `The ${SITE} store locator (about 4,000 stores across the two banners) by state, city, neighborhood or free text, filtered by open 24 hours, parking and Farmacia Popular, up to 50 a page: page, page_size, total, total_pages, has_more, count and stores [{store_id, banner, name, address, latitude, longitude, phone, open_24h, parking, farmacia_popular, hours}]. Usually 10 to 35 s. Captured 2026-11-27: a Droga Raia city search listed 48 stores. ${ONE}`,
    {
      state: z.string().min(2).max(40).optional()
        .describe("A state: UF code (SP, RJ, RS ...) or name, e.g. 'RS'."),
      city: z.string().min(1).max(80).optional()
        .describe("A city (needs state), e.g. 'Porto Alegre'."),
      neighborhood: z.string().min(1).max(80).optional()
        .describe("A neighborhood (needs state and city)."),
      query: z.string().min(1).max(80).optional()
        .describe("The locator's free-text search (fuzzy)."),
      open_24h: z.boolean().optional()
        .describe("Only stores open 24 hours."),
      parking: z.boolean().optional()
        .describe("Only stores with parking."),
      farmacia_popular: z.boolean().optional()
        .describe("Only stores in the Farmacia Popular program."),
      page: z.number().int().min(1).max(300).optional()
        .describe("Page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Stores per page, 1 to 50. Defaults to 20."),
      site,
    },
    post("stores/search"),
  );

  server.tool(
    "get_rdsaude_reviews",
    `Customer reviews of one ${SITE} product, up to 50 a page, filtered by stars: sku, total, average_rating, recommended_by, rating_distribution, summary, top_tags, tags, use_cases (the site's own summary, as given), reviews [{review_id, rating, text, date, verified, incentivized, likely_incentivized, helpful, unhelpful, replies}] and next_cursor. No reviewer names. Each banner has its own reviews; a product without reviews answers an empty list. Captured 2026-11-27: Droga Raia sku 38155 (an Episol sunscreen powder) averaged 4.82 from 164 reviews. ${ONE}`,
    {
      sku: sku
        .describe("A product code (items[].sku), e.g. '38155'."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars (1 to 5)."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Reviews per page, 1 to 50. Defaults to 20."),
      cursor: z.string().min(1).max(2000).optional()
        .describe("next_cursor of the previous page."),
      site,
    },
    post("reviews"),
  );

  server.tool(
    "get_rdsaude_deals",
    `The ${SITE} deals: type oferta_do_dia (Oferta do Dia), especial (% Especial), black_friday, or coupons (the running coupons [{code, label, count}], or with coupon that coupon's products), by brand or category: type, coupon, highlight and ${GRID} ${PRICES} The site gives no start or end dates for deals. Captured 2026-11-27: the Droga Raia coupon NIVEABRAND covered 195 products, the first the Sabonete em Barra Nivea Leite 85g at 3.09 BRL (list 3.83). ${ONE}`,
    {
      type: z.enum(["oferta_do_dia", "especial", "coupons", "black_friday"]).optional()
        .describe("oferta_do_dia (default, Oferta do Dia), especial (% Especial), coupons or black_friday."),
      coupon: z.string().min(1).max(40).optional()
        .describe("With type coupons: a coupon code (coupons[].code), e.g. 'NIVEABRAND'. Without it: the running coupons."),
      brand,
      category_id: categoryId.optional()
        .describe("Deals of this category (categories[].id)."),
      site,
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_rdsaude_suggestions",
    `The ${SITE} search box suggestions for what has been typed: query, count, suggestions, quick_filters [{name, query}] and product_count. Captured 2026-11-27: shamp on Droga Raia gave 8 suggestions and 14108 matching products. ${ONE}`,
    {
      query: z.string().min(1).max(80)
        .describe("What has been typed so far, e.g. 'shamp'."),
      site,
    },
    post("suggestions"),
  );
}
