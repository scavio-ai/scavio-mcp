import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/atacadao.ts (Atacadao, atacadao.com.br, the cash-and-carry wholesale chain of
// Grupo Carrefour Brasil; Brazil only, BRL). Rules the backend enforces and zod here does not: category takes category
// or category_id; product takes sku, ean, product_id, slug or url; stores_near takes cep or latitude + longitude;
// filters hold at most 5 keys. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Atacadao (atacadao.com.br, the Brazilian cash-and-carry wholesale chain of Grupo Carrefour Brasil), Brazil only, Portuguese text, prices in BRL";
const STORE_NOTE =
  "Prices are the online prices of the store you choose with store_id; without one, the site's default store (atacadaobr60, Vila Maria, Sao Paulo).";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 2 to 20 s; allow a client timeout of at least 90 s.";
const CARD =
  "position, sku (what get_atacadao_product takes), product_id, name, brand, url, image, measurement_unit, unit_multiplier, units_per_box (the case size), reference_code, price (the unit price for 1 unit), price_tiers [{min_quantity, unit_price}] (every quantity tier the store gives, ascending; the unit price drops at larger quantities, e.g. from 6 or 10 units), bulk_unit_price (the unit price at the largest tier), online_exclusive_price, priced_store_id, categories [{name, path}] and collections [{id, name}]";
const GRID = `Returns store_id, priced_store_id, page, page_size, total (the store's matching items), total_pages, has_more, count, sort, filters_applied, items [{${CARD}}] and notes. Items the chosen store does not sell are left out. There is no was-price: the quantity tiers are the deal. The price sorts follow the site's own order, which does not always follow the chosen store's price.`;

const values = z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).max(10)]);
const storeId = z.union([z.string().min(1).max(20), z.number().int().min(1)]).optional()
  .describe("The store to price at: its store id ('atacadaobr340') or store number (340), from get_atacadao_stores_near or get_atacadao_stores (stores[].store_id). Default: the site's default store (atacadaobr60, Vila Maria, Sao Paulo).");
const category = z.string().min(1).max(300)
  .describe("A category path of 1 to 3 levels (categories[].path of get_atacadao_categories), e.g. 'mercearia', 'mercearia/graos', 'mercearia/graos/arroz-branco', or its atacadao.com.br link.");

const grid = {
  store_id: storeId,
  sort: z.enum(["relevance", "price_asc", "price_desc", "best_sellers", "name_asc", "name_desc", "newest", "discount"]).optional()
    .describe("The site's sorts: relevance (default), price_asc, price_desc, best_sellers (most ordered), name_asc, name_desc, newest (release date) or discount."),
  brand: values.optional()
    .describe("Brand value(s) from get_atacadao_facets (key brand), e.g. 'camil'."),
  collection: z.string().min(1).max(12).optional()
    .describe("A collection id (items[].collections[].id), e.g. '382' (Black November)."),
  min_price: z.number().min(0).max(100_000).optional().describe("Minimum price in BRL."),
  max_price: z.number().min(0.01).max(100_000).optional().describe("Maximum price in BRL."),
  filters: z.record(z.string(), values).optional()
    .describe("Any other facet by the site's own key (get_atacadao_facets facets[].key): {\"<key>\": value or [values]}. Up to 5 keys."),
  page: z.number().int().min(1).max(50).optional().describe("Results page, 1 to 50. Defaults to 1."),
  page_size: z.number().int().min(1).max(100).optional().describe("Items per page, 1 to 100 (default 20)."),
};
const storeRef = z.union([z.string().min(1).max(120), z.number().int().min(1)])
  .describe("A store number (340), store id ('atacadaobr340') or store slug ('tatuape'), from get_atacadao_stores or get_atacadao_stores_near.");

export function registerAtacadaoTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/atacadao/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_atacadao",
    `${SITE} keyword search at one store, sorted by the site's sorts and filtered by category (1 to 3 levels), brand, price range, collection (e.g. Black November) and any other facet. ${STORE_NOTE} ${GRID} Also query. No results is an empty, charged answer. Captured 2026-11-27: arroz at store atacadaobr340 (Tatuape, Sao Paulo) matched 52 items, the first the Arroz Branco Camil Tipo 1 5kg at 20.29 BRL, sold in cases of 6. ${COST}`,
    {
      query: z.string().min(1).max(100)
        .describe("Search keywords, in Portuguese, e.g. 'arroz'."),
      category: category.optional(),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_atacadao_category",
    `One ${SITE} category listing by category path or category_id, at one store, sorted and filtered like search_atacadao. ${STORE_NOTE} ${GRID} Also category, category_id and url. An unknown category_id is a charged not-found; an unknown path is an empty answer. Captured 2026-11-27: mercearia/graos at atacadaobr340 held 76 items. ${COST}`,
    {
      category: category.optional(),
      category_id: z.number().int().min(1).optional()
        .describe("Or a category id (categories[].category_id), e.g. 24. Send category or category_id."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_atacadao_product",
    `One ${SITE} product by sku, EAN, product id, slug or link, priced at one store: sku, product_id, name, complement_name, brand, ean (EAN-13), reference_code, url, images, categories, measurement_unit, unit_multiplier, units_per_box, specifications, available_at_store, price, price_tiers [{min_quantity, unit_price}], bulk_unit_price, online_exclusive_price, priced_store_id and collections. ${STORE_NOTE} No marketing description, stock units, reviews or price history. An unknown product is a charged not-found; a product the store does not sell is an answer with available_at_store false and no price. Captured 2026-11-27: EAN 7896079431158, the Arroz Branco Namorado Tipo 1 5kg at atacadaobr340, was 21.89 BRL for 1 unit and 21.39 BRL each from 6 units, in cases of 6. ${COST}`,
    {
      sku: z.string().min(1).max(12).optional()
        .describe("The sku id (items[].sku), e.g. '14443'. Send one of sku, ean, product_id, slug or url."),
      ean: z.string().min(8).max(14).optional()
        .describe("Or the EAN / GTIN barcode (EAN-13), e.g. '7896079431158'."),
      product_id: z.string().min(1).max(12).optional()
        .describe("Or the product id (items[].product_id)."),
      slug: z.string().min(1).max(300).optional()
        .describe("Or the product slug, e.g. 'arroz-branco-namorado-tipo-1-5619-14443'."),
      url: z.string().min(1).max(600).optional()
        .describe("Or a product link (https://www.atacadao.com.br/<slug>/p)."),
      store_id: storeId,
    },
    post("product"),
  );

  server.tool(
    "get_atacadao_stores_near",
    `The Atacadao pickup stores near a Brazilian CEP (postal code) or a point, nearest first: total, count and stores [{store_id, store_number, pickup_point_id, name, distance_km, address {street, number, neighborhood, city, state, cep}, latitude, longitude, hours [{day, opens, closes}]}]; for a CEP also serving_stores [{store_id, store_number, name}] (the stores the site offers for that CEP). Use store_id for store prices in the other tools. Captured 2026-11-27: CEP 01310-100 listed 33 pickup stores, the nearest 4.9 km away, and 17 serving stores. ${COST}`,
    {
      cep: z.string().min(1).max(9).optional()
        .describe("A Brazilian CEP (8 digits), e.g. '01310-100'. Send cep, or latitude with longitude."),
      latitude: z.number().min(-34).max(6).optional()
        .describe("Latitude of a point in Brazil, with longitude."),
      longitude: z.number().min(-74).max(-28).optional()
        .describe("Longitude of a point in Brazil."),
    },
    post("stores-near"),
  );

  server.tool(
    "get_atacadao_stores",
    `The Atacadao store directory for a Brazilian state and, optionally, a city: total, page, page_size, total_pages, has_more, count and stores [{store_number, store_id (the online catalog id, null when the store does not sell online), sells_online, name, slug, url, format, address, phone, latitude, longitude, hours [{day, opens, closes}], holiday_hours [{date, description, hours}], online_services, flyer_count}]. A city with no store is a charged not-found that lists the state's cities. Captured 2026-11-27: SP / Sao Paulo listed 21 stores. ${COST}`,
    {
      state: z.string().min(2).max(2)
        .describe("Brazilian state code (UF), e.g. 'SP', 'RJ', 'PR'."),
      city: z.string().min(1).max(80).optional()
        .describe("A city of that state (accents and case ignored), e.g. 'Curitiba'."),
      page: z.number().int().min(1).max(1000).optional().describe("Page. Defaults to 1."),
      page_size: z.number().int().min(1).max(50).optional().describe("Stores per page, 1 to 50 (default 24)."),
    },
    post("stores"),
  );

  server.tool(
    "get_atacadao_store",
    `One Atacadao store in full: the directory fields of get_atacadao_stores plus services (bakery, butcher, cafe, fuel station ...), recycling_points, payment_methods, credit_cards, meal_vouchers and flyers [{flyer_id, name, valid_from, valid_to, pdf_url, thumbnail_url, priority}]. An unknown store is a charged not-found. Captured 2026-11-27: store 340, Tatuape 24hrs in Sao Paulo, open around the clock, with 8 services and 6 flyers. ${COST}`,
    { store_id: storeRef },
    post("store"),
  );

  server.tool(
    "get_atacadao_flyers",
    `The current flyers (folhetos) of one Atacadao store: store_number, store_id, name, slug, url, count and flyers [{flyer_id, name, valid_from, valid_to (as the store gives them), pdf_url (the flyer document, PDF, as the store page links it), thumbnail_url, priority}]. The flyer is returned as a link and is not opened. An unknown store is a charged not-found. Captured 2026-11-27: store 340 listed 6 Black Friday flyers. ${COST}`,
    { store_id: storeRef },
    post("flyers"),
  );

  server.tool(
    "get_atacadao_facets",
    `The filter values of ${SITE} for a query and / or category, brand or collection at one store: total and facets [{key, label, param, values [{value, label, count, selected}] or min / max}] with the store's own counts; param names the field each one goes back into (category, brand, collection, min_price / max_price, or filters). Captured 2026-11-27: arroz at atacadaobr340 gave 52 items and 5 facets (3 category levels, price and brand). ${COST}`,
    {
      query: z.string().min(1).max(100).optional()
        .describe("Search keywords, e.g. 'arroz' (or give a category, brand or collection)."),
      category: category.optional(),
      ...grid,
    },
    post("facets"),
  );

  server.tool(
    "get_atacadao_suggestions",
    `The ${SITE} search box for the start of a search: suggestions [{term, count, attributes}] (completions with their search counts and, for some, the department they point to) and top_searches [{term, count}]; without query, the top searches alone. Captured 2026-11-27: arroz gave 5 completions, the first arroz branco 5kg (2246 searches), next to 10 top searches. ${COST}`,
    {
      query: z.string().min(1).max(100).optional()
        .describe("The start of a search, e.g. 'arro'. Omit for the top searches alone."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_atacadao_categories",
    `The ${SITE} department tree: count, node_count and categories [{category_id, name, path, url, children [...]}]; use path as category, or category_id, in get_atacadao_category. Captured 2026-11-27: 20 departments and 644 nodes. ${COST}`,
    {},
    post("categories"),
  );
}
