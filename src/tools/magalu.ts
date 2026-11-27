import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/magalu.ts (Magazine Luiza, magazineluiza.com.br, Magalu, the Brazilian retailer;
// Brazil only, BRL). Rules the backend enforces and zod here does not: product and reviews take product_id or url;
// store takes store_id or url; state is one of the 27 Brazilian UFs. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const SITE = "Magazine Luiza (magazineluiza.com.br, Magalu, the Brazilian retailer), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST = "2 credits (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PAGE_TIME = "Usually 10 to 60 s; deal pages took 127 to 161 s on Black Friday 2026: allow a client timeout of at least 180 s.";
const FAST_TIME = "Usually 3 to 15 s; allow a client timeout of at least 90 s.";
const PRICES =
  "price is the card price, list_price the regular price when a lower one applies, pix_price and pix_discount_percent the price paid by Pix (Brazil's instant payment).";
const CARD =
  "items [{position, product_id (what get_magalu_product and get_magalu_reviews take), title, reference, brand, url, image, available, sponsored, price, list_price, discount_percent, pix_price, pix_discount_percent, installment {count, amount, total, interest, description}, currency, seller {id, name, is_magalu}, rating, review_count, coupon {code, message, discount_type, discount_value, starts_at, ends_at}, deal_starts_at, deal_ends_at (the deal timer, where the site shows one), badges, tags, category_id, subcategory_id, variants [{name, type, current, options [{value, variation_id, available, url}]}]}]";
const GRID = `40 a page (sponsored cards the site mixes in are flagged), pages 1 to 25: page, page_size, total, total_pages, has_more, count, sponsored_count, sort, ${CARD}, facets [{slug, label, param, values [{value, label, count, selected}]}] with the site's counts, price_range, rating_range, filters_applied and notes.`;

const slugs = z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).max(10)]);

const grid = {
  sort: z.enum(["relevance", "fastest_delivery", "price_with_shipping", "price_asc", "price_desc", "best_sellers", "top_rated", "newest"]).optional()
    .describe("The site's 8 sorts: relevance (default), fastest_delivery, price_with_shipping, price_asc, price_desc, best_sellers, top_rated, newest."),
  brand: slugs.optional()
    .describe("Brand slug(s) as the site writes them (facets brand values[].value), e.g. 'brastemp'. A list matches any of them."),
  seller: slugs.optional()
    .describe("magalu (Magalu's own offers) or marketplace seller id(s) (facets seller values[].value)."),
  min_price: z.number().min(0).max(9_999_999).optional()
    .describe("Minimum price in BRL."),
  max_price: z.number().min(0).max(9_999_999).optional()
    .describe("Maximum price in BRL."),
  min_rating: z.number().int().min(1).max(5).optional()
    .describe("Minimum star rating, 1 to 5."),
  black_friday: z.boolean().optional()
    .describe("true: only items in the site's Black Friday promotion (Ofertas Black)."),
  promotion: slugs.optional()
    .describe("Promotion id(s) (facets promotion values[].value, e.g. promocao_sazonal_3 for Ofertas do Dia)."),
  attributes: z.record(z.string(), slugs).optional()
    .describe("Attribute facets: facet slug to value slug(s), e.g. {\"voltagem\": \"220v\", \"cor\": [\"branco\", \"inox\"]} (facets[].slug and values[].value)."),
  page: z.number().int().min(1).max(25).optional()
    .describe("Page, 1 to 25 (40 a page). Defaults to 1."),
};

const productTarget = {
  product_id: z.string().min(1).max(24).optional()
    .describe("Magazine Luiza product id (items[].product_id or variants[].options[].variation_id), e.g. '238058800' or 'ffh7ah372g'. Send product_id or url."),
  url: z.string().min(1).max(800).optional()
    .describe("Or a magazineluiza.com.br product link."),
};

export function registerMagaluTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/magalu/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_magalu",
    `${SITE} keyword search in the site's 8 sorts, filtered by brand, seller (Magalu or a marketplace seller), price range, minimum rating, Black Friday promotion, promotion and attribute facets (voltage, colour, capacity ...): query, term, url and ${GRID} ${PRICES} No results is an empty answer. Captured 2026-11-27: geladeira frost free counted 1000 results over 25 pages (12 sponsored cards on page 1), the first the LG Frost Free Smart Inverse 462L refrigerator at 3893.68 BRL by card or 3699 BRL by Pix, sold by Magalu, rated 4.8 from 1240 reviews. ${COST} ${PAGE_TIME}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords in Portuguese, as a shopper types them, e.g. 'geladeira frost free'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_magalu_category",
    `One ${SITE} category listing (a department or a subcategory) by path or link, sorted and filtered like search_magalu: path, url, category {name, canonical_url, breadcrumbs} and ${GRID} ${PRICES} An unknown category is a charged not-found. Captured 2026-11-27: /geladeira-refrigerador/eletrodomesticos/s/ed/refr/ sorted best_sellers held 616 products, the first the Electrolux Frost Free Duplex 400L IF44 at 2699 BRL by Pix. ${COST} ${PAGE_TIME}`,
    {
      path: z.string().min(1).max(400)
        .describe("A category path or magazineluiza.com.br link: a department (/eletrodomesticos/l/ed/) or a subcategory (/geladeira-refrigerador/eletrodomesticos/s/ed/refr/)."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_magalu_deals",
    `One ${SITE} deal selection: the daily deals (ofertasdodia, default) or a campaign selection (blackfriday2026, blackfriday2026_celulares ...), sorted and filtered like search_magalu; each card carries its own deal timer (deal_starts_at, deal_ends_at) and coupon where the site shows them: selection, url, selection_info {label, description, ends_at} and ${GRID} ${PRICES} An unknown selection is a charged not-found. Captured 2026-11-27: ofertasdodia held 353 deals; one electric shower ran from 2026-11-27T00:00:00-03:00 to 2026-11-30T09:59:59-03:00 at 557.67 BRL by Pix with a 30 BRL coupon. ${COST} ${PAGE_TIME}`,
    {
      selection: z.string().min(1).max(300).optional()
        .describe("A deal selection id or /selecao/ link: ofertasdodia (default, the daily deals), blackfriday2026, blackfriday2026_celulares, blackfriday2026_eletro, blackfriday2026_games, blackfriday2026_info ..."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_magalu_product",
    `One ${SITE} product by id or link: product_id, requested_id, title, reference, brand, entity, url, category, subcategory, breadcrumbs, available (the site's flag; no stock units), price, list_price, discount_percent, pix_price, pix_discount_percent, best_installment, payment_methods [{method (luiza_ouro, a card brand, pix), plans [{count, amount, total, interest, discount_percent}]}], currency, coupons [{code, message, discount_type, discount_value, starts_at, ends_at}], deal_starts_at, deal_ends_at, max_checkout_quantity, minimum_order_quantity, badges, tags, seller {id, name, legal_name, cnpj, is_magalu, seller_since, score, total_sales, delivery_rate, answer_rate, city, state}, rating, review_count, variants [{name, type, current, options [{value, variation_id, available, url}]}] (colour, voltage ...), images, specs [{group, name, value}] and questions {total, count, items [{question_id, question, answer, asked_at, answered_at}]} (no names). ${PRICES} No GTIN or marketing description; shipping by CEP and store pickup are not available. An unknown product is a charged not-found. Captured 2026-11-27: product 238058800, the LG Frost Free Smart Inverse 462L, at 3893.68 BRL in 10 interest-free installments or 3699 BRL by Pix (5% off), sold by Magalu (Magazine Luiza SA), with 27 specs. ${COST} ${PAGE_TIME}`,
    productTarget,
    post("product"),
  );

  server.tool(
    "get_magalu_reviews",
    `Reviews of one ${SITE} product by id or link, in 4 sorts, up to 50 a page: product_id, rating, review_count, comment_count, star_distribution [{stars, count}], aspect_ratings [{id, label, rating}], summary (Magalu's own summary of the reviews, as given), page, page_size, total, total_pages, count, sort and reviews [{review_id, rating, title, text, submitted_at, variant [{label, value}], aspects, sku, images, videos}]. No reviewer names; a star filter is not available; most_negative is the site's order, not strictly by stars. An unknown product is a charged not-found. Captured 2026-11-27: product 238058800 rated 4.8 from 1240 ratings (1132 five-star), 620 written reviews. ${COST} ${FAST_TIME}`,
    {
      ...productTarget,
      sort: z.enum(["most_relevant", "most_recent", "most_positive", "most_negative"]).optional()
        .describe("most_relevant (default), most_recent, most_positive or most_negative."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Reviews per page, 1 to 50. Defaults to 10."),
    },
    post("reviews"),
  );

  server.tool(
    "get_magalu_suggestions",
    `The ${SITE} search suggestions for the start of a search: query, count and suggestions [{position, term}] (up to 10, as the site gives them; it can answer none). ${COST} ${FAST_TIME}`,
    {
      query: z.string().min(1).max(100)
        .describe("The start of a search, as a shopper types it, e.g. 'geladeira'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_magalu_stores",
    `The physical Magazine Luiza stores in one Brazilian state (UF), optionally one city, in the site's order: state, city, state_total, city_count, count and stores [{store_id (what get_magalu_store takes), name, city, neighborhood, state, url}]. Address, CEP (Brazilian postal code) and phone come from get_magalu_store; store hours, coordinates, search by CEP, store pickup and store stock are not published. Captured 2026-11-27: state SP listed 513 stores, 235 of them in Sao Paulo city. ${COST} ${FAST_TIME}`,
    {
      state: z.string().min(2).max(2)
        .describe("Brazilian state code (UF): ac, al, am, ap, ba, ce, df, es, go, ma, mg, ms, mt, pa, pb, pe, pi, pr, rj, rn, ro, rr, rs, sc, se, sp, to."),
      city: z.string().min(1).max(80).optional()
        .describe("Only the stores in this city (accents and case ignored), e.g. 'Sao Paulo'."),
    },
    post("stores"),
  );

  server.tool(
    "get_magalu_store",
    `One Magazine Luiza store by store number or link: store_id, name, street_address, city, state, cep (Brazilian postal code), phone, url and opening_hours (as the store page gives them; null when it gives none). No coordinates. An unknown store is a charged not-found. Captured 2026-11-27: store 1000, Magazine Luiza - Loja Itaberaba/Sao Paulo, CEP 02739000. ${COST} ${FAST_TIME}`,
    {
      store_id: z.union([z.string().min(1).max(8), z.number().int().positive()]).optional()
        .describe("A store number (stores[].store_id from get_magalu_stores), e.g. '1000'. Send store_id or url."),
      url: z.string().min(1).max(300).optional()
        .describe("Or a lojas.magazineluiza.com.br store link."),
    },
    post("store"),
  );
}
