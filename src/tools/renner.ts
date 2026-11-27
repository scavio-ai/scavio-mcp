import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/renner.ts (Lojas Renner, lojasrenner.com.br, the Brazilian fashion retailer; Brazil,
// BRL). Rules the backend enforces and zod here does not: product and sku-price take product_id or url. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Lojas Renner (lojasrenner.com.br, the Brazilian fashion retailer), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const LIST_TIME = "Listings are slow at the source: usually 30 to 200 s; allow a client timeout of at least 300 s.";
const FAST_TIME = "Usually 5 to 30 s; allow a client timeout of at least 180 s.";
const CARD =
  "position, product_id (what get_renner_product takes), name, brand, url, image, color {id, name, hex}, default_sku, price, list_price, discount_percent, on_sale, installment {count, amount}, stock_level (the unit count the site lists for the product), stock_status (in_stock, in_omni_stock), sold_last_15_days (as the site lists it), marketplace, seller (Lojas Renner or a partner store), gender, categories, colors [{id, name, hex, sku}] and sizes";
const GRID = `48 per page, pages 1 to 200, in the site's sorts, filtered by refinement ids: category, sold by (Lojas Renner or its partner stores), brand, size, colour, gender and the states with stock. Returns page, page_size, total, total_pages, has_more, count, items [{${CARD}}], refinements [{name, label, multi_select, values [{label, count, filter}]}] with the site's counts, applied (the refinements in force), search_terms, sort, filters_applied and notes.`;
const INSTALLMENTS =
  "installments {store_card {count, amount, interest_free} (the Cartão Renner plan), credit_card {count, amount} (other cards)}";
const FLAGS = "available, purchasable, out_of_stock, omni_stock, back_order, pre_order, pre_launch, discontinued, max_quantity";

const grid = {
  sort: z.enum(["relevance", "newest", "best_selling", "discount", "price_asc", "price_desc", "name_asc", "name_desc"]).optional()
    .describe("relevance (default), newest, best_selling, discount, price_asc, price_desc, name_asc or name_desc (the site's sorts)."),
  filters: z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).max(10)]).optional()
    .describe("Refinement id(s) from a listing (refinements[].values[].filter), up to 10, combined freely: category, sold by, brand, size, colour, gender or region, e.g. ['xv9uau']."),
  page: z.number().int().min(1).max(200).optional().describe("Results page, 1 to 200 (48 per page)."),
};
const productRef = {
  product_id: z.string().min(6).max(20).optional()
    .describe("The Lojas Renner product id (items[].product_id), e.g. '931758127'. Send product_id or url."),
  url: z.string().min(1).max(800).optional().describe("Or a lojasrenner.com.br product link (items[].url)."),
};

export function registerRennerTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/renner/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_renner",
    `Search ${SITE} by keyword. ${GRID} Also query. No results is an empty answer (charged). Search suggestions are not offered. Captured 2026-11-27: camiseta matched 9468 products, the first a seamless t-shirt at 69.90 BRL (list 79.90) with 17 units listed and 163 sold in the last 15 days. ${COST} ${LIST_TIME}`,
    {
      query: z.string().min(1).max(120).describe("Search keywords, in Portuguese as a shopper types them, e.g. 'camiseta'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_renner_category",
    `One category listing of ${SITE}, by navigation id (4zo6za is Feminino; breadcrumbs[].url and the refinements' category filters carry them) or a /c/ link, sorted and filtered like search_renner. ${GRID} Also category. An unknown category is a charged not-found. Captured 2026-11-27: 4zo6za (Feminino) held 82688 products. ${COST} ${LIST_TIME}`,
    {
      category: z.string().min(1).max(600)
        .describe("A category by its navigation id, e.g. '4zo6za' (Feminino), or a lojasrenner.com.br /c/ link or path ending in /-/N-<id>."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_renner_deals",
    `A product list of ${SITE}: the list of every discounted product (default) or another list by navigation id or /lista/ link, sorted and filtered like search_renner. The site publishes no start or end dates for its deals. ${GRID} Also list. An unknown list is a charged not-found. Captured 2026-11-27: the discounted-products list held 106896 products. ${COST} ${LIST_TIME}`,
    {
      list: z.string().min(1).max(600).optional()
        .describe("A list by its navigation id or a lojasrenner.com.br /lista/ link; without it, '1l95pyv', the site's list of every discounted product."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_renner_product",
    `One product of ${SITE} by product_id or link, optionally a sku to pick the colour and size: product_id, requested_sku, sku, sku_matched, name, brand, url, color {id, name, hex}, size, currency, price (the price now), list_price, on_sale, discount_percent, ${INSTALLMENTS}, rating, review_count, ${FLAGS}, marketplace, seller, gender, categories, breadcrumbs, composition, details, images, colors [{id, name, hex, sku, sizes [{size, sku}]}], size_count, sizes_available and sizes [{size, sku, available, purchasable, out_of_stock, omni_stock, pre_order, discontinued}] (the sizes of the colour shown, with the site's availability flags: flags, not unit counts). rating is the aggregate (average and count) only. Not available: review texts, shipping quotes by CEP, the marketing description. An unknown product is a charged not-found. Captured 2026-11-27: 931758127, a pair of trousers, was 199.90 BRL (list 219.90), 6 interest-free Cartao Renner installments of 33.32 or 4 of 49.98 on other cards, rated 4.4 from 21 reviews, all 6 sizes available. ${COST} ${FAST_TIME}`,
    {
      ...productRef,
      sku: z.string().min(6).max(20).optional()
        .describe("Optional sku to show (colors[].sku or colors[].sizes[].sku): picks the colour and size, as the site's ?sku= does."),
    },
    post("product"),
  );

  server.tool(
    "get_renner_sku_price",
    `Price and stock flags for one size of ${SITE}, by product_id (or link) and sku: product_id, sku, name, color {name, code, hex}, size, currency, price, list_price, on_sale, discount_percent, ${INSTALLMENTS}, ${FLAGS} and image (flags, not unit counts). An unknown sku, or a sku of another product, is a charged not-found. Captured 2026-11-27: size 36 (sku 931758135) of product 931758127 was 199.90 BRL, available, order limit 100. ${COST} ${FAST_TIME}`,
    {
      ...productRef,
      sku: z.string().min(6).max(20).describe("The size sku (sizes[].sku or colors[].sizes[].sku of get_renner_product), e.g. '931758135'."),
    },
    post("sku-price"),
  );

  server.tool(
    "get_renner_stores",
    `The physical stores of ${SITE}: the store locator's list for a CEP's city or region: cep, cep_state, count, stores [{store_number, name, address {street, number, complement, city, state}, phone (the chain's shared number: dial it and enter the store_number), hours}], excluded_count and notes. Stores outside the CEP's state that the site returns are left out and reported in a note. In the site's order; no coordinates or distances. Captured 2026-11-27: CEP 01310-100 (SP) listed 5 stores. ${COST} ${FAST_TIME}`,
    {
      cep: z.string().min(8).max(12).describe("A Brazilian CEP (postal code, 8 digits), e.g. '01310-100'."),
    },
    post("stores"),
  );
}
