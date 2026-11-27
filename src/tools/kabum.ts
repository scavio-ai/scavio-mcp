import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/kabum.ts (KaBuM!, kabum.com.br, the Brazilian computer and electronics retailer,
// part of Magalu; Brazil only, BRL). Rules the backend enforces and zod here does not: product, shipping and reviews
// take product_id or url; filters hold at most 8 facets. No zod `.default()`: the MCP SDK would post a defaulted field
// on every call.

const SITE = "KaBuM! (kabum.com.br, the Brazilian computer and electronics retailer, part of Magalu), Brazil only, Portuguese text, prices in BRL";
const ONE =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 2 to 15 s; allow a client timeout of at least 90 s.";
const PRICES =
  "Prices are as KaBuM! shows them to a visitor who is not signed in, never a Prime-member price: price is the card price, cash_price the Pix (Brazil's instant payment) / boleto price, list_price the regular price when a lower one applies.";
const ITEM =
  "items [{position, product_id (what get_kabum_product takes), name, url, image, brand, category_path, price, cash_price, list_price, cash_discount_percent, installment_text (e.g. 10x de R$ 43,33), offer {offer_id, name, campaign, price, cash_price, discount_percent, starts_at, ends_at, units_left}, currency, available, stock (units), buy_limit, seller {sold_by, is_marketplace, seller_id, company, cnpj, state}, rating, review_count, stamps, free_shipping, open_box, pre_order}]";
const GRID = `page, page_size, sort, total, total_pages, has_more, count, ${ITEM}, facets [{key, label, type (list, boolean, range), values}] (send back in filters) and filters_applied.`;

const productTarget = {
  product_id: z.union([z.string().regex(/^\d{1,10}$/), z.number().int().min(1)]).optional()
    .describe("KaBuM! product code (items[].product_id; the number after /produto/ in a product link), e.g. '311424'. Send product_id or url."),
  url: z.string().min(10).max(500).optional()
    .describe("Or a www.kabum.com.br product link."),
};

const grid = {
  sort: z.enum(["most_searched", "price_asc", "price_desc", "most_reviewed", "newest"]).optional()
    .describe("most_searched (default, KaBuM!'s own order), price_asc, price_desc, most_reviewed or newest."),
  page: z.number().int().min(1).max(500).optional()
    .describe("Page, 1-based; total_pages reports the last one. Defaults to 1."),
  page_size: z.number().int().min(1).max(100).optional()
    .describe("Products per page, 1 to 100. Defaults to 20."),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()).max(20)])).optional()
    .describe("Facet filters, at most 8 keys, exactly as facets[].key and facets[].values of an answer list them, e.g. {\"manufacturer\": \"Husky\", \"has_offer\": true, \"highlighted_stamp\": \"BLACK FRIDAY\"}. Boolean facets (has_offer, kabum_product, has_open_box, has_flash) take true. Prime-member filters are not offered."),
  price_min: z.number().min(0).max(1_000_000).optional()
    .describe("Lowest card price in BRL."),
  price_max: z.number().min(0).max(1_000_000).optional()
    .describe("Highest card price in BRL."),
};

export function registerKabumTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/kabum/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_kabum",
    `${SITE} keyword search, up to 100 a page, sorted by KaBuM!'s order, price, most reviewed or newest and filtered by brand, any facet, running offers, KaBuM!-sold or a price range: query, site_category (the category KaBuM!'s search sends the keyword to), ${GRID} ${PRICES} Marketplace sellers come with their business name, CNPJ and state. A keyword with no products returns total 0. Captured 2026-11-27: cadeira gamer gave 648 results, the first the Cadeira Gamer Husky Storm 100 at 433.32 BRL card / 389.99 BRL Pix (list 588.78), in the OFERTAS KABUM offer with 35 units left and 1981 in stock. ${ONE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'cadeira gamer'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_kabum_category",
    `One ${SITE} category by path, sorted and filtered like search_kabum: category, url, breadcrumb [{id, name, path}] and ${GRID} ${PRICES} An unknown category is a charged not-found. Captured 2026-11-27: hardware/placa-de-video-vga held 459 products over 46 pages of 10. ${ONE}`,
    {
      category: z.string().min(1).max(300)
        .describe("A category path (categories[].path from get_kabum_categories, or a category link's path), e.g. 'tv' or 'hardware/placa-de-video-vga'."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_kabum_categories",
    `The ${SITE} departments: departments [{slug, path, url}] (about 30); with department, that department's category tree: categories [{slug, path (what get_kabum_category takes), url, children [...]}]. An unknown department is a charged not-found. Captured 2026-11-27: the hardware department held 14 top categories. ${ONE}`,
    {
      department: z.string().min(1).max(60).optional()
        .describe("A department slug (departments[].slug), e.g. 'hardware'. Without it: the departments."),
    },
    post("categories"),
  );

  server.tool(
    "get_kabum_product",
    `One ${SITE} product by product code or link: product_id, name, url, brand, categories, images, price, cash_price, list_price, cash_discount_percent, installment_text, offer (with start, end and units left), payment_methods [{category (boleto, pix, cartao, nupay), method, installments [{installments, amount, total, interest, discount_percent, terms, interest_text}]}], available, discontinued, stock (units), buy_limit, pre_order, open_box, free_shipping, weight_grams, warranty, rating, review_count, stamps, seller {type (1P, 2P, 3P), sold_by, is_marketplace, seller_id, company, cnpj, state, score {rating, nps, delivery_rating, orders, period_start, period_end}}, specs [{section, items [{name, value}], lines}], anatel_code and inmetro_code. ${PRICES} A discontinued product returns available false and stock 0. An unknown product is a charged not-found. Captured 2026-11-27: product 311424, the Cadeira Gamer Husky Storm 100, at 389.99 BRL by Pix or boleto (10% off the card price), rated 4.8 from 159 reviews; product 217839, sold by the marketplace seller Digi Mania (seller score 5 over 7424 orders in 30 days). ${ONE}`,
    productTarget,
    post("product"),
  );

  server.tool(
    "get_kabum_shipping",
    `The delivery options for one unit of a ${SITE} product to a Brazilian CEP (postal code), as KaBuM! quotes them: product_id, name, cep, address {state, city, district, street} of the CEP, sold_by, available, count and options [{name, type, price (BRL), max_days, arrival_date, arrival_text, arrives_tomorrow, carrier, flash, seller}]. Marketplace sellers quote their own options. A product KaBuM! does not sell now returns available false and no options. An invalid CEP is refused (not charged); an unknown product is a charged not-found. Captured 2026-11-27: product 311424 to CEP 01310-100 (Avenida Paulista, São Paulo) had 4 options, Entrega Econômica at 34.59 BRL by 2026-12-15. ${ONE}`,
    {
      ...productTarget,
      cep: z.union([z.string().regex(/^\d{5}-?\d{3}$/), z.number().int().min(1000000).max(99999999)])
        .describe("The Brazilian CEP (postal code, 8 digits) to deliver to, e.g. '01310-100'."),
    },
    post("shipping"),
  );

  server.tool(
    "get_kabum_reviews",
    `Customer reviews of one ${SITE} product, newest or oldest first, up to 50 a page, filtered by stars: product_id, sort, rating, page, page_size, average_rating, total_reviews, total (matching), total_pages, has_more, count, summary (KaBuM!'s own summary of the reviews, as given, or null) and reviews [{review_id, rating, title, text, date, likes, media [{type, url}]}]. No reviewer names. Captured 2026-11-27: product 311424 averaged 4.8 from 156 reviews. ${ONE}`,
    {
      ...productTarget,
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars (1 to 5)."),
      sort: z.enum(["newest", "oldest"]).optional()
        .describe("newest (default) or oldest."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Reviews per page, 1 to 50. Defaults to 10."),
    },
    post("reviews"),
  );

  server.tool(
    "get_kabum_offers",
    `The products of one ${SITE} offer campaign: campaign {slug, name, title, starts_at, ends_at, rules_url}, page, page_size, total, total_pages, has_more, count and items [{position, product_id, name, url, image, brand, department, category, price, cash_price, list_price, discount_percent, installment_text, offer_id, offer_units_left, offer_units_sold, stock, starts_at, ends_at, available, seller {sold_by, is_marketplace, seller_id}, stamp, free_shipping, open_box, rating, review_count}], up to 100 a page. ${PRICES} A campaign that is not running is a charged not-found. Captured 2026-11-27: blackfriday (BLACK DAS BLACKS KABUM!, 2026-11-25 to 2026-11-30) held 620 products, the first the Mesa Gamer Husky Snow at 349.99 BRL Pix (29% off) with 28 offer units left and 72 sold. ${ONE}`,
    {
      campaign: z.string().min(2).max(40).optional()
        .describe("A KaBuM! campaign: blackfriday (default, Black Friday 2026) or ofertaskabum (KaBuM!'s standing offers)."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(100).optional()
        .describe("Products per page, 1 to 100. Defaults to 20."),
    },
    post("offers"),
  );
}
