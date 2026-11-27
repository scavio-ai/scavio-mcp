import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/carrefourbr.ts (Carrefour Brasil: carrefour.com.br and its grocery site
// mercado.carrefour.com.br; site mercado | www; Brazil only, BRL). Separate from Carrefour France (carrefour.ts). Rules
// the backend enforces and zod here does not: product takes item_id or url; filters hold at most 10 values. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Carrefour Brasil (carrefour.com.br: the Mercado grocery site and the www marketplace), Brazil only, Portuguese text, prices in BRL";
const REGION =
  "On mercado, cep or store (a store_id from get_carrefourbr_stores) gives that region's prices and assortment (region, price_scope regional); without them the site's default prices (price_scope national). www prices are national.";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 2 to 25 s on mercado, up to about 50 s on www; allow a client timeout of at least 120 s.";
const ITEM =
  "items [{position, product_id, item_id (what get_carrefourbr_product takes), name, brand, product_reference, url, categories, measurement_unit (kg: priced per kg), price, list_price, spot_price (the single-payment price), discount_percent, available (a flag, no unit counts), seller {seller_id, name}, seller_count, variant_count, stamps [{text, type, image}], image, sponsored, international}]";
const GRID = `15 items a page: total, page, page_size, total_pages (up to 50), sort, count, ${ITEM}, sponsored_count and sponsored [the site's sponsored placements, kept apart from items: same fields plus placement], facets [{key, name, type, values [{name, value, count, selected, filter (what filters takes)}] or ranges [{from, to, count}] for price}], region, price_scope and notes.`;
const FILTERS =
  "Sorted by the site's sorts and filtered by any facet value (department, category, brand, seller and the product attributes the site lists) and a price range.";

const site = z.enum(["mercado", "www"]).optional()
  .describe("mercado (default; mercado.carrefour.com.br, the grocery site) or www (www.carrefour.com.br: non-food and the marketplace).");
const cep = z.string().min(8).max(9).optional()
  .describe("On mercado: a Brazilian CEP (postal code, 8 digits, dash optional) for that region's prices and assortment, e.g. '01310-100'. On www prices are national; the CEP changes shipping only (get_carrefourbr_delivery).");
const store = z.string().min(8).max(9).optional()
  .describe("On mercado, instead of cep: a pickup store's store_id from get_carrefourbr_stores, e.g. '01405002', for that store's prices and assortment.");
const itemId = z.union([z.string().regex(/^\d{1,12}$/), z.number().int().positive()]);

const grid = {
  site,
  cep,
  store,
  page: z.number().int().min(1).max(50).optional()
    .describe("Page, 1 to 50 (15 items a page). Defaults to 1."),
  sort: z.enum(["relevance", "orders_desc", "price_asc", "price_desc", "release_desc", "discount_desc", "name_asc", "name_desc"]).optional()
    .describe("relevance (default), orders_desc (best selling), price_asc, price_desc, release_desc (newest), discount_desc, name_asc or name_desc."),
  filters: z.union([z.record(z.string(), z.union([z.string(), z.array(z.string())])), z.array(z.string())]).optional()
    .describe("Facet filters from a previous answer's facets[].values[].filter, e.g. {\"brand\": \"camil\"} or {\"category-2\": [\"arroz\"]}, or 'key=value' strings. Up to 10 values; values of one key combine as any of them."),
  min_price: z.number().int().min(0).max(1_000_000).optional()
    .describe("Minimum price in whole reais (BRL)."),
  max_price: z.number().int().min(0).max(1_000_000).optional()
    .describe("Maximum price in whole reais (BRL)."),
};

export function registerCarrefourBrTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/carrefourbr/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_carrefourbr",
    `${SITE} search by keywords or an EAN barcode. ${FILTERS} ${REGION} Returns site, store, query, suggestions (the site's related terms) and ${GRID} No results is an empty, charged answer. Captured 2026-11-27: arroz on mercado at CEP 01310-100 (regional prices) matched 43 items, the first a Seara frozen rice dish at 12.49 BRL (list 24.99, 50% off), sold by Carrefour. ${COST}`,
    {
      query: z.string().min(1).max(120)
        .describe("Search keywords in Portuguese, or an EAN barcode, e.g. 'arroz'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_carrefourbr_category",
    `One ${SITE} category by path or link. ${FILTERS} ${REGION} Returns category {path, category_id, name, title, page_type, breadcrumbs} and ${GRID} An unknown category is a charged not-found. Captured 2026-11-27: /categoria/mercearia/alimentos-basicos/arroz on mercado, best selling first, held 100 items, the first the Arroz Branco Camil Tipo 1 5kg at 23.99 BRL (default prices). ${COST}`,
    {
      path: z.string().min(1).max(600)
        .describe("A category path from get_carrefourbr_categories or a list's breadcrumbs (departments[].path), or such a link, e.g. '/categoria/mercearia/alimentos-basicos/arroz'."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_carrefourbr_collection",
    `One ${SITE} collection (a themed or deal list: the lists the site's banners, coupons and menu link to) by id or link. ${FILTERS} ${REGION} Returns collection {collection_id, name (the site's own internal name, as given)} and ${GRID} An unknown or empty collection is a charged not-found. Captured 2026-11-27: collection 29861 on mercado held 94 items. ${COST}`,
    {
      collection_id: z.union([z.string().min(1).max(600), z.number().int().positive()])
        .describe("A collection id (the number in a /colecao/<id> link, coupons[].collection_id, or a menu entry's collection_id) or such a link, e.g. '29861'."),
      ...grid,
    },
    post("collection"),
  );

  server.tool(
    "get_carrefourbr_product",
    `One ${SITE} product by item id or link. ${REGION} Returns requested, item_id, product_id, name, brand, ean, product_reference, url, categories, breadcrumbs, measurement_unit, unit_multiplier, price, list_price, spot_price, discount_percent, price_valid_until, seller, sellers [{seller_id, name (the seller's business name), default, price, list_price, spot_price, available, price_valid_until, payment_offers, promotions}], payment_offers [{name, payment_method_id, discount_percent, price (computed by Scavio from the site's percentage)}] (the site's prices for one payment method, such as the Carrefour card or Pix, Brazil's instant payment), promotions (other site offers, e.g. quantity offers, with their conditions and effects as given), stamps [{text, type, image}], dual_price, weight (items sold by weight: unit_multiplier, price_per_kg, item_price computed by Scavio), availability {available (a flag: the site publishes no unit counts), unavailable_product}, description, specs [{group, name, value}], variants [{attribute, values [{name, item_id, selected, image}]}] (each variant is its own item id), images and international. No reviews or questions (the site has none). An unknown item, or one the chosen region does not sell, is a charged not-found. Captured 2026-11-27: item 1972 on mercado, the Arroz Branco Longo-fino Tipo 1 Tio Joao 1 Kg, at 6.59 BRL, with a Carrefour card offer of 30% off (4.61 BRL). ${COST}`,
    {
      site,
      item_id: itemId.optional()
        .describe("The item id (items[].item_id, or the number at the end of a /produto/ link), e.g. '1972'. Send item_id or url."),
      url: z.string().min(5).max(600).optional()
        .describe("Or a product link on either site (/produto/<name>-<item id>, or an older /<name>/p link)."),
      cep,
      store,
    },
    post("product"),
  );

  server.tool(
    "get_carrefourbr_delivery",
    `Delivery and pickup options for one ${SITE} item from one seller to a CEP, on either site: cep, address, can_deliver, message (the site's own text, e.g. when it cannot deliver to the CEP), out_of_stock_for_region, minimum_order_value, option_count, options [{group, name, channel (delivery or pickup-in-point), price, list_price, estimate (e.g. 2h, 8bd), estimate_date, earliest_date {day_of_week, day, month, month_name}, scheduled, pickup_store}] and pickup_stores [{name, pickup_point_id, distance_km, opening_hours, address}] (the pickup stores near the CEP, with their hours). The answer is the site's quote for one unit; it does not reserve stock. Captured 2026-11-27: item 1972 to CEP 01310-100 had normal delivery at 10.90 BRL in 2h and free store pickup at a hypermarket 1.15 km away. ${COST}`,
    {
      site,
      item_id: itemId.describe("The item id, e.g. '1972'."),
      seller_id: z.string().min(1).max(40).optional()
        .describe("The seller (sellers[].seller_id of get_carrefourbr_product). Defaults to 1, Carrefour itself; marketplace items on www need their seller's id."),
      cep: z.string().min(8).max(9)
        .describe("The delivery CEP (Brazilian postal code), e.g. '01310-100'."),
    },
    post("delivery"),
  );

  server.tool(
    "get_carrefourbr_stores",
    `The Carrefour Brasil pickup stores (Retire na Loja), filtered by state and city: total (every pickup store), count (the ones that match) and stores [{store_id (what store takes on mercado), name, street, neighborhood, city, state, cep}]. No opening hours here: get_carrefourbr_delivery lists the pickup stores near a CEP with their hours. Captured 2026-11-27: SP listed 68 of the 135 stores. ${COST}`,
    {
      state: z.string().length(2).optional()
        .describe("Stores in this state (UF), e.g. 'SP'."),
      city: z.string().min(2).max(80).optional()
        .describe("Stores in this city, e.g. 'Porto Alegre'."),
    },
    post("stores"),
  );

  server.tool(
    "get_carrefourbr_suggestions",
    `The ${SITE} search suggestions for what a shopper has typed: terms [{term, attributes [{key, label, value, value_label}]}], products (the suggested products, with the list item fields) and top_searches [{term, count}] (the site's most searched terms with their counts; alone when query is omitted). Captured 2026-11-27: arroz on mercado gave 5 terms and 24 products, next to 10 top searches. ${COST}`,
    {
      site,
      query: z.string().min(1).max(80).optional()
        .describe("What a shopper has typed, e.g. 'arroz'. Omit for the top searches alone."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_carrefourbr_coupons",
    `The ${SITE} coupon page: title, count, coupons [{code, value, name, category, active, expires (as given), expiration_date, link, collection_id (the list a coupon applies to, what get_carrefourbr_collection takes), rules}], categories and terms, as published. Captured 2026-11-27: mercado listed 4 coupons, among them 10% off orders above 499 BRL, expiring 2026-11-27. ${COST}`,
    { site },
    post("coupons"),
  );

  server.tool(
    "get_carrefourbr_categories",
    `The ${SITE} department menu as the site's header lists it, 3 levels: count, node_count and departments [{name, url, site, path (what get_carrefourbr_category takes), filters (the facet filters the link applies), collection_id (what get_carrefourbr_collection takes), children [...]}]. Captured 2026-11-27: mercado listed 15 departments and 673 nodes. ${COST}`,
    { site },
    post("categories"),
  );
}
