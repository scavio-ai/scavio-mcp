import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/netshoes.ts (Netshoes, netshoes.com.br, Brazil's sporting-goods store, part of
// Magalu; Brazil, BRL). Rules the backend enforces and zod here does not: product, reviews and questions take
// product_id or url. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Netshoes (netshoes.com.br, Brazil's sporting-goods store, part of Magalu), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const LIST_TIME = "Usually 2 to 30 s (slower when the site is busy); allow a client timeout of at least 180 s.";
const FAST_TIME = "Usually 2 to 10 s; allow a client timeout of at least 120 s.";
const CARD =
  "position, product_id (the colour: what get_netshoes_product takes), product_code, name, brand, department, product_type, url, image, available, price, list_price, discount_percent, installment_count, rating, review_count, badges, colors, flavors, sizes and other_colors [{product_id, image}]";
const GRID = (size: number, pages: number) =>
  `${size} per page, pages 1 to ${pages}, in the site's 7 sorts, filtered by any facet of the listing (brand, size, gender, product type, colour, department, promotion, sold-by and the rest, plus a BRL price range). Returns page, page_size, total (the site caps it at 10000: total_capped), total_pages, has_more, count, title, items [{${CARD}}], facets [{key, name, values [{value, label, count}], min, max}], quick_filters, sort, filters_applied and notes.`;
const BUYBOX =
  "price here is the size's buy-box price and can differ by a few reais from the price get_netshoes_product shows.";

const value = z.string().min(1).max(140);
const values = z.union([value, z.array(value).max(12)]);
const grid = (maxPage: number, perPage: number) => ({
  sort: z.enum(["relevance", "best_sellers", "new_releases", "offers", "price_asc", "price_desc", "top_rated"]).optional()
    .describe("relevance (default), best_sellers, new_releases, offers, price_asc, price_desc or top_rated: the site's 7 sorts."),
  filters: z.record(z.string(), values).optional()
    .describe("Facet filters: {key: value or [values]} with facets[].key and facets[].values[].value of an answer (marca, tamanho, genero, tipo-de-produto, cor-principal, departamento, promocoes, vendido-por, pisada and more, as the listing offers them), e.g. {\"marca\": \"nike\", \"genero\": [\"masculino\"]}. Up to 12 values."),
  brand: values.optional().describe("Brand facet value(s) (marca), e.g. 'nike' or 'adidas'."),
  gender: values.optional().describe("Gender facet value(s) (genero): masculino, feminino, unissex, menino, menina ..."),
  size: values.optional().describe("Size facet value(s) (tamanho), e.g. '42' or 'm'."),
  seller: values.optional().describe("Sold-by facet value(s) (vendido-por): 'netshoes-netshoes' or a marketplace seller's value."),
  price_min: z.number().min(0).max(100000).optional().describe("Lowest price in BRL."),
  price_max: z.number().min(0).max(100000).optional().describe("Highest price in BRL."),
  page: z.number().int().min(1).max(maxPage).optional().describe(`Results page, 1 to ${maxPage} (${perPage} per page).`),
});
const productUrl = z.string().min(1).max(800).optional()
  .describe("Or a netshoes.com.br product link (https://www.netshoes.com.br/p/<name>-<product id>).");
const sku = z.string().min(10).max(24)
  .describe("A size sku (sizes[].sku of get_netshoes_product), e.g. 'FBA-82XQ-006-38'.");
const sellerId = (description: string) =>
  z.union([z.string().min(1).max(12), z.number().int().min(0)]).optional().describe(description);

export function registerNetshoesTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/netshoes/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_netshoes",
    `${SITE} keyword search. ${GRID(100, 100)} Also query and landing_page (a keyword the site sends to a landing page returns that page's products, and says so). No results is an empty, charged answer. Captured 2026-11-27: tenis corrida filtered to nike matched 214 products, the first a Nike Air Max Alpha Trainer 6 at 399.99 BRL (list 799.99, 50% off). ${COST} ${LIST_TIME}`,
    {
      query: z.string().min(1).max(120)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'tenis corrida'."),
      ...grid(100, 100),
    },
    post("search"),
  );

  server.tool(
    "get_netshoes_list",
    `A ${SITE} list page by its slug or /lst/ link (tenis-black-friday, the Black Friday sneakers, is the default), sorted and filtered like search_netshoes. ${GRID(45, 250)} Also slug and url. An unknown list is a charged not-found. Captured 2026-11-27: tenis-black-friday held 736 products, the first at 69.99 BRL (list 99.99). ${COST} ${LIST_TIME}`,
    {
      slug: z.string().min(1).max(300).optional()
        .describe("A list slug or its netshoes.com.br/lst/ link, e.g. 'tenis-black-friday' (the default)."),
      ...grid(250, 45),
    },
    post("list"),
  );

  server.tool(
    "get_netshoes_product",
    `One ${SITE} product by product_id (the colour code), a size sku or a link: product_id, requested_id, product_code, name, brand, department, product_type, genders, url, available, listing_type, color, currency, price_min, price_max, sellers, size_count, sizes_available, sizes [{sku, size, ean, available, price, pix_price, list_price, seller, offer_count, offers [{seller {id, name, is_store}, available, price, pix_price, pix_promotion {percent, amount, name}, list_price, discount_percent, installment, free_shipping}], weight_grams, release_date}], colors [{product_id, name, available, url}], images, badges, breadcrumbs, specs [{name, value}], ncm, rating, review_count, percent_recommended and question_count. price is the card price; pix_price the Pix price (Pix is Brazil's instant payment) where a Pix promotion applies. No marketing description. An unknown product is a charged not-found. Captured 2026-11-27: FBA-82XQ-006, an Adidas Racer TR23 men's sneaker in black, at 249.99 BRL (list 499.99) in 8 sizes, rated 4.83 from 780 reviews. ${COST} ${FAST_TIME}`,
    {
      product_id: z.string().min(8).max(24).optional()
        .describe("The Netshoes product id: the colour code (items[].product_id, colors[].product_id), e.g. 'FBA-82XQ-006'. A size sku works too. Send product_id or url."),
      url: productUrl,
    },
    post("product"),
  );

  server.tool(
    "get_netshoes_offers",
    `Every seller's offer for one size of ${SITE}, by size sku: sku, product_id, product_code, name, size, ean, color, available, url, offer_count and offers [{seller {id, name, is_store, international}, available, price, pix_price, pix_promotion, list_price, discount_percent, installment, installments [{count, amount, total, interest_free}], free_shipping}]. An unknown sku is a charged not-found. ${COST} ${FAST_TIME}`,
    { sku },
    post("offers"),
  );

  server.tool(
    "get_netshoes_inventory",
    `The online stock count for one size of ${SITE}, by size sku and, optionally, seller: sku, seller {id, name, is_store}, quantity (as the site gives it; it may be capped) and in_stock. Without seller_id the size's buy-box seller is used. Not a store count. Captured 2026-11-27: size 38 of FBA-82XQ-006 had 549 units online from Netshoes. ${COST} ${FAST_TIME}`,
    {
      sku,
      seller_id: sellerId("The seller (sizes[].offers[].seller.id; 0 is Netshoes), e.g. '13644'. Default: the size's buy-box seller."),
    },
    post("inventory"),
  );

  server.tool(
    "get_netshoes_shipping",
    `Delivery options for one size of ${SITE}, by size sku and CEP (Brazilian postal code): sku, cep, seller, price, pix_price, currency, count, options [{type (NORMAL, COLLECT_MAGALU pickup ...), service, seller_id, cost, free, min_days, max_days, min_date, max_date}], lowest_cost, fastest and free_shipping_threshold {min_order, missing, reached}. ${BUYBOX} Captured 2026-11-27: size 38 of FBA-82XQ-006 shipped free to CEP 01310-100 in 3 days. ${COST} ${FAST_TIME}`,
    {
      sku,
      cep: z.string().min(8).max(12).describe("A Brazilian CEP (8 digits), e.g. '01310-100'."),
      seller_id: sellerId("Quote this seller's offer (sizes[].offers[].seller.id). Default: the buy-box seller."),
    },
    post("shipping"),
  );

  server.tool(
    "get_netshoes_reviews",
    `Product reviews of ${SITE}, by product code (or a colour id, sku or link), 13 per page, filtered by stars (positive, negative or star values) and photos: product_code, page, page_size, total_pages, has_more, rating_filter, with_photos, total_reviews, total_filtered, count and reviews [{review_id, rating, text, date, recommends, photo_count}]. Reviews are shared by every colour of the product. No reviewer names. Captured 2026-11-27: FBA-82XQ had 780 reviews. ${COST} ${FAST_TIME}`,
    {
      product_id: z.string().min(8).max(24).optional()
        .describe("The product code shared by every colour (product_code), e.g. 'FBA-82XQ', or a colour product id or size sku. Send product_id or url."),
      url: productUrl,
      page: z.number().int().min(1).max(1000).optional().describe("Page, 1-based (13 per page)."),
      rating: z.union([z.enum(["positive", "negative"]), z.number().int().min(1).max(5), z.array(z.number().int().min(1).max(5)).max(5)]).optional()
        .describe("positive (5 and 4 stars), negative (2 and 1 star), or star values, e.g. [3]."),
      with_photos: z.boolean().optional().describe("Only reviews with photos."),
    },
    post("reviews"),
  );

  server.tool(
    "get_netshoes_questions",
    `Shoppers' questions on a ${SITE} product, by product code (or a colour id, sku or link), 10 per page: product_code, page, page_size, total_pages, has_more, total_questions, count and questions [{question, asked_at, answer, answered_at, answered_by (the seller, or the site's AI assistant), answered_by_ai}]. No asker names or emails. Captured 2026-11-27: I0Y-0011 had 86 questions. ${COST} ${FAST_TIME}`,
    {
      product_id: z.string().min(8).max(24).optional()
        .describe("The product code (product_code), e.g. 'I0Y-0011', or a colour product id or size sku. Send product_id or url."),
      url: productUrl,
      page: z.number().int().min(1).max(1000).optional().describe("Page, 1-based (10 per page)."),
    },
    post("questions"),
  );

  server.tool(
    "get_netshoes_daily_deal",
    `The ${SITE} daily offer (Barato do Dia): title, starts_at, ends_at (Brasilia time), count and items [{position, product_id, name, url, image, available, seller_ids}]. The answer carries no prices: send a product_id to get_netshoes_product. Captured 2026-11-27: 10 products, from 00:00 to 23:59. ${COST} ${FAST_TIME}`,
    {},
    post("daily-deal"),
  );

  server.tool(
    "get_netshoes_seller",
    `A ${SITE} marketplace seller by seller id: seller_id, name, name_slug, official_store, active, member_since, company_name, cnpj, address (the company's business address as the seller page shows it), products_sold, logo, url, rating, review_count, reviews_with_comment, percent_recommended, product_quality_stamp, histogram, likert and the newest reviews [{rating, text, date, recommends}] without reviewer names. Contacts are not returned. An unknown seller is a charged not-found. Captured 2026-11-27: seller 21072 had sold 163603 products, rated 4.53 from 2978 reviews, 94% recommended. ${COST} Usually 5 to 15 s; allow a client timeout of at least 120 s.`,
    {
      seller_id: z.union([z.string().min(1).max(12), z.number().int().min(1)])
        .describe("A marketplace seller id (sizes[].offers[].seller.id, items[].seller_ids of get_netshoes_daily_deal), e.g. '13644'."),
      name: z.string().max(80).optional().describe("The seller's name slug (name_slug), optional, e.g. 'nike'."),
    },
    post("seller"),
  );

  server.tool(
    "get_netshoes_popular_searches",
    `The ${SITE} popular searches, as the site's search box lists them: count and searches [{position, term}]. Captured 2026-11-27: 4 terms, the first tenis masculino. ${COST} ${FAST_TIME}`,
    {},
    post("popular-searches"),
  );
}
