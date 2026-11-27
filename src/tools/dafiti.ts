import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/dafiti.ts (Dafiti, dafiti.com.br, the Brazilian fashion marketplace; Brazil, BRL).
// Rules the backend enforces and zod here does not: product takes exactly one of product_id, sku or url. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Dafiti (dafiti.com.br, the Brazilian fashion marketplace), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const LIST_TIME = "Listing pages are slow at the source: usually 15 to 160 s; allow a client timeout of at least 240 s.";
const PRODUCT_TIME = "Usually 6 to 35 s; allow a client timeout of at least 240 s.";
const FAST_TIME = "Usually 2 to 15 s; allow a client timeout of at least 120 s.";
const CARD =
  "position, sku (what get_dafiti_sizes and get_dafiti_product take), product_id, name, brand, color, url, image, price (the Pix price where pix_price is set), list_price, discount_percent, pix_price (where the site shows a Pix price; Pix is Brazil's instant payment), card_price, max_installments, categories, sponsored and marketplace (a partner store sells it; the store name comes from get_dafiti_product or get_dafiti_sizes)";
const GRID = `48 results per page plus the site's sponsored slots (a sponsored product that is also a result is listed once), in the site's 5 sorts. Returns title, page, page_size, total, total_pages, has_more, count, sponsored_count, sort, items [{${CARD}}] and notes.`;
const SIZES =
  "sizes [{size, sku, in_stock, units (exact from 0 to 10), more_than_10 (true, units null, when the site gives more than 10 rather than a count), stock_message, delivery_type (proprio: Dafiti's own stock, fulfillment: a partner store's stock delivered by Dafiti, drop_shipping: sent by the partner store), sold_by_dafiti, delivered_by_dafiti, store_name (the store that sells the size)}]";

const grid = {
  sort: z.enum(["popularity", "newest", "price_asc", "price_desc", "discount"]).optional()
    .describe("popularity (default), newest, price_asc, price_desc or discount (the site's 5 sorts)."),
  page: z.number().int().min(1).max(2000).optional()
    .describe("Results page (48 results per page plus the sponsored slots); total_pages reports the last one."),
};
const sku = z.string().min(8).max(40);

export function registerDafitiTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/dafiti/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_dafiti",
    `Search ${SITE} by keyword. ${GRID} Also query. The site matches loosely, so a search with no close match can still list related products. Captured 2026-11-27: vestido matched 19233 products; page 1 carried 54 items, 12 of them sponsored. ${COST} ${LIST_TIME}`,
    {
      query: z.string().min(1).max(100).describe("Search keywords, in Portuguese as a shopper types them, e.g. 'tenis'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_dafiti_category",
    `One department or category listing of ${SITE}, by its path or link, sorted like search_dafiti. ${GRID} Also category, url and breadcrumbs. An unknown category is a charged not-found. Captured 2026-11-27: calcados-femininos/tenis held 13098 products. ${COST} ${LIST_TIME}`,
    {
      category: z.string().min(1).max(300)
        .describe("A department or category path of 1 to 3 levels as the site writes it (breadcrumbs[].url), e.g. 'calcados-femininos', 'calcados-femininos/tenis', or its dafiti.com.br link."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_dafiti_brand",
    `One brand's listing of ${SITE}, by the brand as the site writes it in its link, sorted like search_dafiti. ${GRID} Also brand, url and breadcrumbs. An unknown brand is a charged not-found. Captured 2026-11-27: asics held 1575 products. ${COST} ${LIST_TIME}`,
    {
      brand: z.string().min(1).max(120)
        .describe("A brand as the site writes it in its link, e.g. 'asics', 'nike', 'farm-rio', or its dafiti.com.br link."),
      ...grid,
    },
    post("brand"),
  );

  server.tool(
    "get_dafiti_deals",
    `The outlet of ${SITE}: the site's own selection of discounted products, sorted like search_dafiti (discount puts the deepest discounts at the top). The site publishes no start or end dates for it. ${GRID} Also deal and url. Captured 2026-11-27: the outlet sorted by discount held 199 products, the first a children's sneaker at 30.99 BRL (list 99.90, 69% off). ${COST} ${LIST_TIME}`,
    grid,
    post("deals"),
  );

  server.tool(
    "get_dafiti_product",
    `One product of ${SITE} by product_id, sku or link (exactly one): requested, sku, product_id, name, brand, color, url, availability (in_stock, limited, out_of_stock), price (the Pix price where pix_price is set), list_price, discount_percent, pix_price, card_price, max_installments, installment {count, amount}, rating, review_count, seller {store_name, sold_by_dafiti, delivered_by_dafiti}, store_names, size_count, sizes_in_stock, ${SIZES}, colors [{sku, product_id, name, color, url, image, price, list_price}] (the other colours), categories, campaigns, breadcrumbs, specs [{name, value}], details [{name, value}] (the short facts at the start of the description: composition, measures) and images. Marketplace sellers appear by store name only. Not available: marketing description, review texts, shipping quotes, search suggestions, price history; Dafiti Colombia is not covered. An unknown product is a charged not-found. Captured 2026-11-27: 15221282, an Asics Gel 1130 sneaker, was 389.99 BRL by Pix (410.52 by card, list 699.99), 4 of 11 sizes in stock, sold and delivered by Dafiti. ${COST} ${PRODUCT_TIME}`,
    {
      product_id: z.string().min(4).max(14).optional()
        .describe("The number at the end of a Dafiti product link (items[].product_id), e.g. '15221282'. Send one of product_id, sku or url."),
      sku: sku.optional().describe("The Dafiti sku (items[].sku), or one size of it (sizes[].sku), e.g. 'AS296SCU17ARY'."),
      url: z.string().min(1).max(800).optional().describe("A dafiti.com.br product link (items[].url)."),
    },
    post("product"),
  );

  server.tool(
    "get_dafiti_sizes",
    `Every size of one ${SITE} product by sku, with its stock: requested, requested_size (when a size sku is sent), sku, product_id, name, brand, color, url, price, list_price, discount_percent, installment {count, amount} (the plan the size data quotes; the product page's card price can differ), store_names, size_count, sizes_in_stock, ${SIZES}, colors, categories and campaigns. Faster than get_dafiti_product, for a stock check. An unknown sku is a charged not-found. Captured 2026-11-27: AS296SCU17ARY had 5 units of sizes 41 and 42, 2 of size 43, 1 of size 44, the other 7 sizes sold out. ${COST} ${FAST_TIME}`,
    {
      sku: sku.describe("The Dafiti sku (items[].sku), or one size of it (sizes[].sku), e.g. 'AS296SCU17ARY'."),
    },
    post("sizes"),
  );
}
