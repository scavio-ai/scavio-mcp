import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/cobasi.ts (Cobasi, cobasi.com.br, the Brazilian pet store of Grupo Petz Cobasi;
// Brazil, BRL). Rules the backend enforces and zod here does not: product, reviews and questions take product_id or
// url; store takes slug or url. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Cobasi (cobasi.com.br, the Brazilian pet store of Grupo Petz Cobasi), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW_TIME = "Pages take 10 to 90 s; allow a client timeout of at least 240 s.";
const FAST_TIME = "Usually 2 to 6 s; allow a client timeout of at least 60 s.";
const ITEM =
  "position, product_id (what get_cobasi_product takes), name, url, image, brand, price, list_price (the regular price when a lower price applies), discount_percent, currency, available, rating, skus [{sku_id (what get_cobasi_availability takes), name, price, list_price, discount_percent, available, best_choice}]";
const GRID = `20 products per page; Cobasi stops paging at page 50 (1,000 products). Returns page, page_size, sort, total, total_pages, has_more, count, items [{${ITEM}}] and note.`;
const NOT_BUILT = "Pix prices, per-store prices or units and marketplace sellers are not returned.";

const productRef = {
  product_id: z.union([z.string().regex(/^\d{5,10}$/), z.number().int().min(10000)]).optional()
    .describe("The Cobasi product id (items[].product_id; the number before /p in a product link), e.g. '3934097'. Send product_id or url."),
  url: z.string().max(500).optional()
    .describe("Or a Cobasi product link (www.cobasi.com.br, ending in -<product id>/p)."),
};
const page = z.number().int().min(1).max(50).optional()
  .describe("Results page, 1-based, 20 products per page. Cobasi stops paging at page 50.");
const searchSort = z.enum(["relevance", "price_asc", "price_desc", "discount_desc"]).optional()
  .describe("relevance (default), price_asc, price_desc or discount_desc (largest discount at the top).");
const listingSort = z.enum(["top_selling", "price_asc", "price_desc"]).optional()
  .describe("top_selling (default, ordered by Cobasi's sales), price_asc or price_desc.");
const reviewPage = z.number().int().min(1).max(500).optional()
  .describe("Page, 1-based, 4 per page. total_pages reports the last one.");

export function registerCobasiTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/cobasi/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_cobasi",
    `${SITE} keyword search, sorted by relevance, price or discount and narrowed by any facet (brand, department, pet size, age, flavour and more). ${GRID} Also query, facets [{key, label, values [{value, label, count, selected}]}] (send values to filters) and filters_applied. A keyword with no products returns total 0. Subscription prices are on get_cobasi_product. Captured 2026-11-27: racao golden matched 237 products, the first a Golden Special adult dog food at 159.99 BRL. ${COST} ${SLOW_TIME}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'ração golden'."),
      sort: searchSort,
      page,
      filters: z.array(z.string().min(3).max(150)).max(10).optional()
        .describe("Facet filters, at most 10: values exactly as facets[].values[].value lists them, e.g. ['brand/golden'], 'porte/racas-pequenas' or 'category-1/cachorro'. Values of one facet widen the match; different facets narrow it."),
    },
    post("search"),
  );

  server.tool(
    "get_cobasi_category",
    `One ${SITE} category by path, sorted by best sellers or price: category {category_id, name, path, has_children}, url, subcategories [{category_id, name, path, has_children}] and facets with counts. ${GRID} total is null when the category page does not count its products. An unknown category is a charged not-found. Captured 2026-11-27: cachorro/racao had 4 subcategories, the first product a GranPlus Gourmet wet dog food at 3.49 BRL. ${COST} ${SLOW_TIME}`,
    {
      category: z.string().min(1).max(300)
        .describe("A category path (a product's categories[].path, a category's subcategories[].path, or the path after /c/ in a category link), e.g. 'cachorro', 'cachorro/racao' or 'cachorro/racao/racao-seca'."),
      sort: listingSort,
      page,
    },
    post("category"),
  );

  server.tool(
    "get_cobasi_brand",
    `The products of one brand at ${SITE}, by brand slug, sorted by best sellers or price: brand {slug, name, url}. ${GRID} An unknown brand is a charged not-found. Captured 2026-11-27: golden had 67 products over 4 pages. ${COST} ${SLOW_TIME}`,
    {
      brand: z.string().min(1).max(200)
        .describe("A brand as its Cobasi link shows it (the part after /m/), e.g. 'golden', 'premier' or 'gran-plus'."),
      sort: listingSort,
      page,
    },
    post("brand"),
  );

  server.tool(
    "get_cobasi_deals",
    `The ${SITE} deals page (Promocoes): products on promotion with the deal price next to the regular price (list_price) and discount_percent, sorted by relevance, price or discount. ${GRID} Cobasi publishes no validity dates for these deals. Captured 2026-11-27: 1293 products on promotion, the first a Royal Canin cat food at 38.99 BRL (list 43.99, 11% off). ${COST} ${SLOW_TIME}`,
    { sort: searchSort, page },
    post("deals"),
  );

  server.tool(
    "get_cobasi_product",
    `One ${SITE} product by product_id or link: product_id, name, url, brand, brand_id, categories [{name, path}], images, available, sold_by, main_sku_id, skus [{sku_id, name (size), ean, available, price, list_price, discount_percent, subscription_price (Compra Programada, the subscription price; null unless can_subscribe), can_subscribe, installments {count, amount}, price_per_measure {unit, price} (e.g. price per kg), best_value, is_kit, price_valid_until}], subscription {frequencies} (only when the product can be bought on subscription), specs [{name, values}], dimensions {height_cm, width_cm, length_cm, weight_g}, rating {average, total, stars, recommend_percent} and latest_reviews (4 recent reviews, without reviewer names). available is a flag, not a unit count. ${NOT_BUILT} An unknown product is a charged not-found. Captured 2026-11-27: 3934097, a Formula Natural Fresh Meat adult dog food, 1 kg at 59.99 BRL (list 74.99, 20% off), rated 4.9 from 669 reviews. ${COST} ${SLOW_TIME}`,
    productRef,
    post("product"),
  );

  server.tool(
    "get_cobasi_reviews",
    `Customer reviews of one ${SITE} product, in Cobasi's own recent-review order, 4 per page: product_id, page, page_size, total, total_pages, has_more, average_rating, stars {1-5 counts}, recommend_percent, count and reviews [{date, purchase_date, rating, recommends, text}]. No reviewer names. Captured 2026-11-27: product 3767590 had 1742 reviews, average 4.8. ${COST} ${FAST_TIME}`,
    { ...productRef, page: reviewPage },
    post("reviews"),
  );

  server.tool(
    "get_cobasi_questions",
    `Shopper questions about one ${SITE} product with Cobasi's answers, 4 per page: product_id, page, page_size, total, total_pages, has_more, count and questions [{question_id, question, answer, answered_at}]. The answer's opening greeting, which names the asker, is removed; no asker names. Captured 2026-11-27: product 3767590 had 133 questions. ${COST} ${FAST_TIME}`,
    { ...productRef, page: reviewPage },
    post("questions"),
  );

  server.tool(
    "get_cobasi_availability",
    `Pickup and delivery for one ${SITE} SKU at a Brazilian CEP (postal code), for the quantity asked: sku_id, cep, quantity, pickup {available, ready_in, store_count, stores [{store_code, name, ready_in, price, address, latitude, longitude}]} (the stores near the CEP that can hand the SKU over, usually in 45 minutes), delivery_available and delivery [{option_id, name, price (BRL), free, estimate}] (e.g. Economica, Cobasi Ja). Flags, not unit counts: Cobasi publishes no per-store stock or per-store prices. No options for the CEP returns empty lists. Captured 2026-11-27: SKU 934097 at CEP 01310-100 could be picked up at 11 stores, ready in 45 minutes, or delivered for 7.90 BRL in 2 business days. ${COST} ${FAST_TIME}`,
    {
      sku_id: z.union([z.string().regex(/^\d{3,10}$/), z.number().int().min(100)])
        .describe("The Cobasi SKU id (skus[].sku_id of a product or a listing item; one size or variant), e.g. '934097'."),
      cep: z.union([z.string().regex(/^\d{5}-?\d{3}$/), z.number().int().min(1000000).max(99999999)])
        .describe("The Brazilian CEP to pick up near or deliver to (8 digits), e.g. '01310-100'."),
      quantity: z.number().int().min(1).max(10).optional().describe("Units, 1 to 10. Defaults to 1."),
    },
    post("availability"),
  );

  server.tool(
    "get_cobasi_suggestions",
    `The ${SITE} search suggestions for the start of a search: query, misspelled (Cobasi corrected the spelling, e.g. racao for ração), count and suggestions (up to 5 terms). ${COST} ${FAST_TIME}`,
    {
      query: z.string().min(1).max(100)
        .describe("The start of a search, as a shopper types it, e.g. 'areia gato'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_cobasi_stores",
    `The ${SITE} store directory: total, state, city, count and stores [{store_id, slug (what get_cobasi_store takes), name, url, address {street, number, neighborhood, city, state, cep}, latitude, longitude, services (e.g. pickup in 45 minutes, vet pharmacy, grooming)}], narrowed by state and city. Captured 2026-11-27: 253 stores, 149 of them in SP. ${COST} ${SLOW_TIME}`,
    {
      state: z.string().length(2).optional().describe("A Brazilian state code (UF), e.g. 'SP' or 'RJ'."),
      city: z.string().min(1).max(80).optional().describe("A city name; accents and case are ignored, e.g. 'São Paulo'."),
    },
    post("stores"),
  );

  server.tool(
    "get_cobasi_store",
    `One ${SITE} store by slug or link: slug, name, url, address, latitude, longitude, phone, whatsapp (the store's WhatsApp link), hours [{day, opens, closes}] per weekday, holiday_hours, grooming_hours and vet_hours where offered, services, pet_services and online_scheduling. An unknown store is a charged not-found. Captured 2026-11-27: cobasi-americana opened 08:00 to 21:45 on Mondays and listed 13 services. ${COST} ${SLOW_TIME}`,
    {
      slug: z.string().min(2).max(100).optional()
        .describe("The store slug (stores[].slug), e.g. 'cobasi-americana'. Send slug or url."),
      url: z.string().max(300).optional()
        .describe("Or a Cobasi store link (www.cobasi.com.br/lojas/<slug>)."),
    },
    post("store"),
  );
}
