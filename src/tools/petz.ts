import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/petz.ts (Petz, petz.com.br, the Brazilian pet store of Grupo Petz Cobasi; Brazil,
// BRL). Rules the backend enforces and zod here does not: product takes product_id or url; store takes slug or url.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Petz (petz.com.br, the Brazilian pet store of Grupo Petz Cobasi), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const LIST_TIME = "Listing pages are slow at the source: usually 50 to 150 s, up to about 245 s; allow a client timeout of at least 300 s.";
const PAGE_TIME = "Usually 30 to 95 s; allow a client timeout of at least 300 s.";
const ITEM =
  "position, product_id (what get_petz_product takes), sku, ean, name, url, image, brand, sub_brand, categories, price, list_price (the regular price when a deal price applies), discount_percent, subscription_price (the Assinatura Petz repeat-delivery price, rounded to cents), subscription_discount_percent, clubz {price, tiers} (the price Petz shows for Clubz loyalty members), currency, available, availability, stock_units (capped at 100), stock_capped (true means 100 or more), has_variations, variations [{product_id, sku, ean, name, url, price, list_price, discount_percent, subscription_price, available, selected}]";
const GRID = `20 products per page, pages 1 to 50; a search counts at most 1,000 products (total_capped). Returns page, page_size, sort, total, total_capped, total_pages, has_more, count and items [{${ITEM}}].`;
const NOT_BUILT = "Per-store stock and prices, prices by CEP, the full review history, Pix prices, installments and shipping are not returned.";
const HOURS = "hours [{days, opens, closes, closed, open_24h}] (HH:MM, the store's local time)";

const sort = z.enum(["relevance", "price_asc", "price_desc", "newest"]).optional()
  .describe("relevance (default), price_asc, price_desc or newest.");
const page = z.number().int().min(1).max(50).optional()
  .describe("Results page, 1-based, 20 products per page, up to page 50.");

export function registerPetzTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/petz/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_petz",
    `Search ${SITE} by keyword, sorted by relevance, price or newest. ${GRID} Also query and note. A keyword with no products returns total 0. Search suggestions are not offered. Captured 2026-11-27: ração golden matched 72 products, the first a Golden Special adult dog food at 159.99 BRL, 143.99 by Assinatura Petz. ${COST} ${LIST_TIME}`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, in Portuguese as shoppers type them, e.g. 'ração golden'."),
      sort,
      page,
    },
    post("search"),
  );

  server.tool(
    "get_petz_category",
    `One category of ${SITE} by category path (a pet, or a pet and a department), sorted by relevance, price or newest: category {path, name, url, redirected_from} (when Petz redirects a category link to another listing, path is the listing answered and redirected_from the path asked). ${GRID} An unknown category is a charged not-found. Captured 2026-11-27: cachorro/racao held 978 products. ${COST} ${LIST_TIME}`,
    {
      category: z.string().min(1).max(300)
        .describe("A category path: a pet and a department, e.g. 'cachorro', 'cachorro/racao' or 'gato/areia-e-banheiros' (a product's categories[].path), or its petz.com.br link."),
      sort,
      page,
    },
    post("category"),
  );

  server.tool(
    "get_petz_brand",
    `The products of one brand at ${SITE}, by brand slug, sorted by relevance, price or newest: brand {slug, name, url, redirected_from}. ${GRID} An unknown brand is a charged not-found. Captured 2026-11-27: royal-canin held 166 products. ${COST} ${LIST_TIME}`,
    {
      brand: z.string().min(1).max(200)
        .describe("A brand slug as Petz writes it (get_petz_product brand.slug), e.g. 'royal-canin' or 'premierpet', or its petz.com.br link."),
      sort,
      page,
    },
    post("brand"),
  );

  server.tool(
    "get_petz_deals",
    `The deals page (Promoções) of ${SITE}, or one of its collections (themed deals lists): products with the deal price next to the regular price (list_price) and discount_percent, sorted by relevance, price or newest; deals {collection, name, url}. Petz publishes no validity dates for these deals. ${GRID} An unknown collection is a charged not-found. Captured 2026-11-27: the PF-racoes collection (pet food up to 35% off) held 411 products, the first a Royal Canin kitten food at 210.99 BRL (list 341.99). ${COST} ${LIST_TIME}`,
    {
      collection: z.string().min(1).max(120).optional()
        .describe("A Petz collection by its slug as its link shows it (www.petz.com.br/colecao/<slug>), e.g. 'pf-petz-friday', or that link. Leave out for the main deals page (Promoções)."),
      sort,
      page,
    },
    post("deals"),
  );

  server.tool(
    "get_petz_product",
    `One product of ${SITE} by product_id or link: product_id, sku, ean, name, url, brand {name, slug}, sub_brand, category, categories [{name, path}], images, price, list_price, discount_percent, subscription_price (Assinatura Petz, rounded to cents), available, availability, stock_units (capped at 100), stock_capped, published, specs [{name, value}], rating {average, count, stars} (the count per star), latest_reviews [{date, rating, text}] (the 3 latest reviews, no reviewer names), has_variations and variations [{product_id, sku, name, description, price, list_price, discount_percent, subscription_price, available, availability, stock_units, stock_capped, on_promotion, is_combo, current, image}], each size or variant with its own prices and stock. ${NOT_BUILT} An unknown product is a charged not-found. Captured 2026-11-27: 191628, a Selections For Pet small-breed dog food, 3 kg, was 46.39 BRL (list 57.99) with 100 or more units, in 3 sizes, rated 4.9 from 32 reviews. ${COST} ${PAGE_TIME}`,
    {
      product_id: z.union([z.string().regex(/^\d{3,9}$/), z.number().int().min(100)]).optional()
        .describe("The Petz product id (items[].product_id or variations[].product_id; the number at the end of a product link), e.g. '191628'. Send product_id or url."),
      url: z.string().max(500).optional()
        .describe("Or a Petz product link (www.petz.com.br/produto/..., ending in -<product id>)."),
    },
    post("product"),
  );

  server.tool(
    "get_petz_stores",
    `The store directory of ${SITE}: every Petz store, narrowed by state and city: total (all stores), state, city, count and stores [{store_id, slug (what get_petz_store takes), name, url, image, address {street, neighborhood, city, state, cep}, phone (the store's business number), ${HOURS}, pickup (online orders can be picked up there), service_codes, pet_codes}] (service_codes and pet_codes are Petz's own codes; the site does not name them). Captured 2026-11-27: 269 stores, 128 of them in SP. ${COST} ${PAGE_TIME}`,
    {
      state: z.string().length(2).optional().describe("A Brazilian state code (UF), e.g. 'SP' or 'RJ'."),
      city: z.string().min(1).max(80).optional().describe("A city name; accents and case are ignored, e.g. 'São Paulo'."),
    },
    post("stores"),
  );

  server.tool(
    "get_petz_store",
    `One store of ${SITE} by slug or link: store_id, slug, name, url, image, google_place_id, address {street, neighborhood, city, state, cep}, phone (the store's business number), ${HOURS}, service_codes and pet_codes. Store stock and store prices are not returned. An unknown store is a charged not-found. Captured 2026-11-27: petz-aclimacao in São Paulo opens every day from 09:00 to 22:00. ${COST} ${PAGE_TIME}`,
    {
      slug: z.string().min(2).max(100).optional().describe("The store slug (stores[].slug of get_petz_stores), e.g. 'petz-aclimacao'. Send slug or url."),
      url: z.string().max(300).optional().describe("Or a Petz store link (www.petz.com.br/loja/<slug>)."),
    },
    post("store"),
  );
}
