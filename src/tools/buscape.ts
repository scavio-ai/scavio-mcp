import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/buscape.ts (Buscape and Zoom, buscape.com.br and zoom.com.br, Brazil's price
// comparison sites; one catalog, the same ids; site buscape | zoom; Brazil, BRL). Rules the backend enforces and zod
// here does not: category takes category_id or category; product takes product_id or url; store takes store_id or
// store; filters hold at most 8 facets. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE = "Buscape and Zoom (buscape.com.br and zoom.com.br, Brazil's price comparison sites; one catalog with the same ids), Portuguese text, prices in BRL";
const TAIL =
  "(credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const ONE = `1 credit ${TAIL} Usually 1 to 9 s; allow a client timeout of at least 120 s.`;
const ONE_PAGE = `1 credit ${TAIL} Usually 5 to 30 s, up to about 80 s when busy; allow a client timeout of at least 180 s.`;
const NO_LINKS = "Store links are not returned.";
const ITEM =
  "items [{position, type (product: compared across stores; offer: a single-store listing), product_id (what get_buscape_product and get_buscape_offers take), offer_id, name, url (the product page; null on an offer), image, category {id, name, slug}, price (the lowest cash price), installments {months, amount, total}, has_interest, store_count, stores [{id, name}], best_offer {offer_id, store_id, store_name}, price_drop_percent, competitiveness_index (0 to 1), rating, rating_count, review_count, marketplace, stamps}]";
const GRID = `page, page_size, sort, total (the site caps it at 10000: total_capped), total_pages, has_more, count, ${ITEM}, facets [{key, values [{value, count, selected}]}] (send back in filters), categories [{id, name, count, selected}], price_range {min, max, buckets} and filters_applied. Some pages hold fewer items than page_size, with gaps in position, as on the site.`;
const OFFER =
  "position, offer_id, sku_id, name, image, store {id, name, logo, is_marketplace}, price (the cash price the site labels 'a vista'), installment_total, installments [{months, amount, total}], has_interest, price_drop_percent, competitiveness_index, stock, condition (new, used), cross_border, variants [{name, value}]";

const site = z.enum(["buscape", "zoom"]).optional()
  .describe("buscape (default, www.buscape.com.br) or zoom (www.zoom.com.br). One catalog; site sets the site of the page links returned.");
const id = z.union([z.string().regex(/^\d{1,12}$/), z.number().int().min(1)]);
const productId = z.union([z.string().regex(/^(product)?\d{1,12}$/), z.number().int().min(1)])
  .describe("The product id (items[].product_id of search, category or deals), e.g. '12755140'.");
const categoryIds = z.union([id, z.array(id).max(20)]);
const offerSorts = ["default", "price_asc", "price_desc", "installment_price_asc", "discount_desc", "cashback_price_asc"] as const;
const variantId = id.optional()
  .describe("A variant (variant_filters[].values[].variant_id, e.g. a voltage): offers of that variant only.");

const grid = {
  site,
  sort: z.enum(["relevance", "price_asc", "price_desc", "rating", "price_drop"]).optional()
    .describe("relevance (default, the site's own order), price_asc, price_desc, rating or price_drop."),
  page: z.number().int().min(1).max(1000).optional()
    .describe("Page, 1-based; total_pages reports the last one. Defaults to 1."),
  page_size: z.number().int().min(1).max(100).optional()
    .describe("Items per page, 1 to 100. Defaults to 30."),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])).max(20)])).optional()
    .describe("Facet filters, at most 8, keys and values exactly as facets[].key and facets[].values[].value of an answer list them, e.g. {\"Marca\": \"Samsung\"}."),
  price_min: z.number().min(0).max(10_000_000).optional()
    .describe("Lowest price in BRL."),
  price_max: z.number().min(0).max(10_000_000).optional()
    .describe("Highest price in BRL."),
  marketplace: z.boolean().optional()
    .describe("true: marketplace sellers only; false: the stores' own offers only."),
  store: z.string().min(1).max(80).optional()
    .describe("Products whose best-selling store is this one (a store name as items[].stores[].name gives it), e.g. 'Magazine Luiza'."),
};

export function registerBuscapeTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/buscape/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_buscape",
    `${SITE} keyword search, up to 100 a page, sorted by relevance, price, rating or price drop and filtered by any facet (brand, capacity ...), price range, category, marketplace or best-selling store: query, ${GRID} category_suggestion {id, name, applied} is the category the site narrows the keyword to. ${NO_LINKS} Captured 2026-11-27: geladeira gave 4053 results narrowed to the Geladeira category, the first the Geladeira Brastemp BRM46MB from 2308 BRL across 5 stores. ${ONE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'geladeira'."),
      category_id: categoryIds.optional()
        .describe("Category id(s) to search in (items[].category.id; get_buscape_categories lists them), e.g. '8'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_buscape_category",
    `One ${SITE} category by id or slug, sorted and filtered like search_buscape: category {id, name, slug, type, url}, breadcrumb [{id, name, slug, type}] (branch to category) and ${GRID} An unknown category is a charged not-found. ${NO_LINKS} Captured 2026-11-27: category 8 (Geladeira) sorted by price held 4053 items. ${ONE}`,
    {
      category_id: id.optional()
        .describe("The category id (items[].category.id; categories[].id), e.g. '8'. Send category_id or category."),
      category: z.string().min(1).max(300).optional()
        .describe("Or the category slug or link, e.g. 'geladeira'."),
      query: z.string().min(1).max(200).optional()
        .describe("Optional keywords inside the category."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_buscape_categories",
    `The ${SITE} category tree: branches [{slug, url}] (the site's top-level branches), or with branch the branch {id, name, slug, url} and its categories [{id (what get_buscape_category takes), name, slug, type (product_leaf, offer_leaf), url}]. An unknown branch is a charged not-found. Captured 2026-11-27: the eletrodomesticos branch held 18 categories. ${ONE_PAGE}`,
    {
      site,
      branch: z.string().min(1).max(200).optional()
        .describe("A branch slug (branches[].slug), e.g. 'eletrodomesticos'. Without it: the branches."),
    },
    post("categories"),
  );

  server.tool(
    "get_buscape_product",
    `One ${SITE} product by product id or page link: product_id, name, url, status, rating, review_count, category, breadcrumb, category_rank, stamps, images, specs [{group, items [{name, value}]}], offer_count, store_count, best_offer, priciest_offer and offers [{offer_id, name, image, store {id, name, logo, is_marketplace}, price, installment_total, installments, has_interest, price_drop_percent, competitiveness_index, stock, variants}] as the page shows them, variant_filters, price_history_40_days [{date, price, store_id}], price_tip {label (good_price, regular_price, best_history_price, not_enough_history), price, median_price, start, end} (the site's own price tip, as given), expert {pros, cons, date} (the site editors' pros and cons, as given) and reviews [{rating, title, text, date, positive, likes, dislikes, source}] (up to 10 store reviews as the page shows them, no reviewer names). Every store offer: get_buscape_offers. An unknown product is a charged not-found. ${NO_LINKS} Captured 2026-11-27: product 12755140, the iPhone 16 128GB, rated 4.8 from 6077 reviews, 22 offers from 6 stores, the best 4537.84 BRL, price tip regular_price against a median of 4549 BRL. ${ONE_PAGE}`,
    {
      site,
      product_id: productId.optional(),
      url: z.string().min(5).max(500).optional()
        .describe("Or a product page on www.buscape.com.br or www.zoom.com.br (items[].url of search), or its path. Send product_id or url."),
    },
    post("product"),
  );

  server.tool(
    "get_buscape_offers",
    `Every store offer for one ${SITE} product, sorted by cash price, installment total, discount or cashback price and filtered by variant (e.g. voltage), up to 50 a page: product_id, sort, variant_id, page, page_size, total, store_count, total_pages, has_more, count, offers [{${OFFER}}], best_offer, priciest_offer and variant_filters [{id, label, values [{variant_id, label, selected, count}]}]. A product with no offers (or unknown) is a charged not-found. ${NO_LINKS} Captured 2026-11-27: the Brastemp BRM46MB refrigerator (product 13994006) had 54 offers from 5 stores, the lowest 2308 BRL at Magazine Luiza (2564.40 BRL in 10 installments). ${ONE}`,
    {
      site,
      product_id: productId,
      sort: z.enum(offerSorts).optional()
        .describe("default (the site's order), price_asc (cash price), price_desc, installment_price_asc (installment total), discount_desc or cashback_price_asc."),
      variant_id: variantId,
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Offers per page, 1 to 50. Defaults to 20."),
    },
    post("offers"),
  );

  server.tool(
    "get_buscape_price_history",
    `The price history of one ${SITE} product: the day's lowest price in BRL and its store, for 40 days (period days) or 3 to 12 months (period months): product_id, period, months, count, lowest, highest, latest ({date, price, store_id} each) and points [{date, price, store_id}]. A product without history (or unknown) is a charged not-found. Captured 2026-11-27: product 12755140 over 40 days ran from a high of 5057.99 BRL on 2026-10-28 to a low of 4299 BRL on 2026-11-22. ${ONE}`,
    {
      site,
      product_id: productId,
      period: z.enum(["days", "months"]).optional()
        .describe("days (default: 40 daily points) or months (with months)."),
      months: z.number().int().min(3).max(12).optional()
        .describe("With period months: 3 to 12 months of daily points, e.g. 6."),
    },
    post("price-history"),
  );

  server.tool(
    "get_buscape_lowest_price",
    `The lowest current price of one ${SITE} product: product_id, offer_id, store_id, price, list_price (as given), price_drop_percent, stock, active and updated_at. An unknown product is a charged not-found. Captured 2026-11-27: product 12755140 at 4537.84 BRL from store 1582. ${ONE}`,
    { site, product_id: productId },
    post("lowest-price"),
  );

  server.tool(
    "get_buscape_deals",
    `The ${SITE} deals list, as the site's Ofertas page builds it (products scoring 0.8 or more on its competitiveness index), by category or keyword, sorted and filtered like search_buscape: ${GRID} ${NO_LINKS} Captured 2026-11-27: a deals list held 305 items, the first the Smart TV Mini LED 55" TCL 4K 55C6K from 2919.12 BRL across 3 stores. ${ONE}`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Optional keywords inside the deals, e.g. 'tv'."),
      category_id: categoryIds.optional()
        .describe("Category id(s) to list the deals of, e.g. '3'."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_buscape_deal_landing",
    `One ${SITE} campaign landing (black-friday, oferta-do-dia-buscape, black-friday-zoom ...): slug, title, brand, updated_at, url, count and sections [{kind (featured_offers, search_items, product_highlight), title, subtitle, from, to, count, items}] as the site's editors arrange them; featured offers carry from / to dates as given. An unknown landing is a charged not-found. ${NO_LINKS} Captured 2026-11-27: black-friday held 6 sections. ${ONE_PAGE}`,
    {
      site,
      slug: z.string().min(2).max(200)
        .describe("A campaign landing slug or link, e.g. 'black-friday', 'oferta-do-dia-buscape' (Buscape) or 'black-friday-zoom' (Zoom)."),
    },
    post("deal-landing"),
  );

  server.tool(
    "get_buscape_store",
    `One store on ${SITE} and its coupons: store {id, name, store_ids, logo, cashback_percent, url}, coupon_count and coupons [{coupon_id, store_id, type, discount_type (value, percent), value, code, description, starts_at, expires_at, status, product_id, category_id, devices, brands}] as the store page lists them. The sites publish no store ratings. An unknown store is a charged not-found. Coupon links are not returned. Captured 2026-11-27: store 21 (KaBuM!) listed 100 coupons and 0.5% cashback. ${ONE_PAGE}`,
    {
      site,
      store_id: id.optional()
        .describe("The store id (items[].stores[].id, offers[].store.id), e.g. '21'. Send store_id or store."),
      store: z.string().min(1).max(300).optional()
        .describe("Or the store page path <slug>-<id> or its link, e.g. 'kabum!-21'."),
    },
    post("store"),
  );

  server.tool(
    "get_buscape_suggestions",
    `${SITE} search suggestions as its search box shows them: query, count and suggestions [{query, position, category {id, name}}]. Captured 2026-11-27: geladeira gave 8 suggestions. ${ONE}`,
    {
      site,
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'geladeira'."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Suggestions, 1 to 20. Defaults to 8."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_buscape_shipping",
    `Freight estimates for one ${SITE} product to a Brazilian CEP (postal code), per store offer (up to 50): product_id, cep, state, city, sort, count, offers_with_freight and offers [{position, offer_id, store {id, name}, price, freight [{type, price (BRL), delivery_days, text}], coupons [{code, description, starts_at, ends_at}] (the store's coupon promotions)}], as the product page shows them. Send the CEP's state and city. Stores that publish no estimate have an empty freight list. A product with no offers (or unknown) is a charged not-found. Captured 2026-11-27: product 13994006 to CEP 01310-100 in São Paulo had estimates for 7 of 10 offers. ${ONE}`,
    {
      site,
      product_id: productId,
      cep: z.union([z.string().regex(/^\d{5}-?\d{3}$/), z.number().int().min(1000000).max(99999999)])
        .describe("The Brazilian CEP (postal code, 8 digits) to deliver to, e.g. '01310-100'."),
      state: z.string().regex(/^[A-Za-z]{2}$/)
        .describe("The CEP's state, a two-letter UF, e.g. 'SP'."),
      city: z.string().min(1).max(80)
        .describe("The CEP's city, as written in Portuguese, e.g. 'São Paulo'."),
      sort: z.enum(offerSorts).optional()
        .describe("Which offers to estimate: price_asc (default) or another get_buscape_offers sort."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Offers to estimate, 1 to 50. Defaults to 10."),
      variant_id: variantId,
    },
    post("shipping"),
  );
}
