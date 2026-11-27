import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/natura.ts (Natura, the Brazilian beauty brand of Natura &Co, on its own storefronts
// in Brazil, Argentina, Chile, Colombia, Mexico and Peru; country br | ar | cl | co | mx | pe). Rules the backend
// enforces and zod here does not: product takes product_id or url; filters hold at most 5 attributes; not every market
// offers every sort. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Natura (the Brazilian beauty brand of Natura &Co) on its own storefronts in Brazil, Argentina, Chile, Colombia, Mexico and Peru (country), text in the market's language, prices in its currency";
const ONE =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 2 to 30 s, up to a minute for pages of 100; allow a client timeout of at least 120 s.";
const PRICES =
  "Prices are as Natura shows them to a visitor who is not signed in: no consultant prices, no regional prices by CEP / postal code.";
const CARD =
  "position, product_id (what get_natura_product takes), name, url, image, price and price_display (the sale price, or the lowest shade price when price_range is true), price_max and price_max_display, price_range, list_price and list_price_display (the struck-through price), discount_percent (computed from the two), rating, currency";
const GRID = `country, host, currency, language, page, page_size, total (the site's result count), total_pages, has_more, count, sort, filters_applied, items [{${CARD}}], facets [{attribute, label, values [{value, label} or {min_price, max_price, label}]}] (send attribute and value back in filters), sort_options [{sort, label, selected}] and notes. A card carries no review count, stock flag or promotion text (read the product).`;

const country = z.enum(["br", "ar", "cl", "co", "mx", "pe"]).optional()
  .describe("The storefront: br (www.natura.com.br, BRL; default), ar (www.naturacosmeticos.com.ar, ARS), cl (www.natura.cl, CLP), co (www.natura.com.co, COP), mx (www.natura.com.mx, MXN) or pe (www.natura.com.pe, PEN).");

const grid = {
  sort: z.enum(["best_sellers", "relevance", "price_asc", "price_desc", "name_asc", "name_desc", "discount", "brand", "most_popular"]).optional()
    .describe("The market's own sorts; not every market offers every sort: br best_sellers, relevance, name_asc, name_desc, price_asc, price_desc, discount; ar adds brand and most_popular; cl best_sellers, discount, price_asc, price_desc; co best_sellers, name_asc, name_desc, price_asc, price_desc, discount; mx best_sellers, price_asc, price_desc, relevance, name_asc, name_desc, brand, most_popular (no discount); pe best_sellers, discount, name_asc, name_desc, price_asc, price_desc. Default: the site's order."),
  filters: z.record(z.string(), z.union([z.string().min(1).max(100), z.array(z.string().min(1).max(100)).max(10)])).optional()
    .describe("Refinements as the site names them, up to 5 attributes: attribute -> value(s), from facets[].attribute and facets[].values[].value, e.g. {\"brand\": \"Kaiak\", \"natg_gender\": \"masculino\"}."),
  min_price: z.number().int().min(0).max(100_000_000).optional()
    .describe("Minimum price, whole units of the market's currency."),
  max_price: z.number().int().min(1).max(100_000_000).optional()
    .describe("Maximum price, whole units of the market's currency."),
  page: z.number().int().min(1).max(200).optional()
    .describe("Results page, 1 to 200. Defaults to 1."),
  page_size: z.number().int().min(1).max(100).optional()
    .describe("Products per page, 1 to 100. Defaults to 24; pages of 100 can take up to a minute."),
};

export function registerNaturaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/natura/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_natura",
    `${SITE} keyword search, sorted by the market's own sorts and filtered by the site's refinements (brand, product type, gender, fragrance family, skin type...) and a price range: query, ${GRID} ${PRICES} No results is an empty answer. Captured 2026-11-27: perfume on br gave 522 results, the first the Deo Parfum Ilia Flor de Laranjeira 50 ml at 99.95 BRL (list 199.90, 50% off), rated 4.5. ${ONE}`,
    {
      country,
      query: z.string().min(1).max(100)
        .describe("Search keywords, in the market's language, e.g. 'perfume'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_natura_category",
    `One ${SITE} category listing by category id or /c/ link, sorted and filtered like search_natura: category_id, category_name, url and ${GRID} ${PRICES} An unknown category is a charged not-found; in ar the top-level departments (maquillaje, perfumeria, cabello...) have no listing page and answer that not-found too: use a subcategory. Captured 2026-11-27: maquiagem on br held 964 products over 41 pages of 24, sorted best_sellers. ${ONE}`,
    {
      country,
      category_id: z.string().min(1).max(300)
        .describe("A category id (categories[].category_id from get_natura_categories, e.g. maquiagem, perfumaria, refis) or the market's /c/<id> link."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_natura_categories",
    `The ${SITE} category menu: count, node_count and categories [{category_id (what get_natura_category takes), name, menu_count, url, subcategories [...]}]. menu_count is the menu's own count and can differ from a listing's total. Captured 2026-11-27: br listed 14 top categories (perfumaria, corpo-e-banho, cabelos, maquiagem, rosto, refis and more) and 206 nodes. ${ONE}`,
    { country },
    post("categories"),
  );

  server.tool(
    "get_natura_product",
    `One ${SITE} product by id or link: product_id, requested_id, name, brand, url, category {category_id, name}, in_stock, max_quantity, low_stock and low_stock_badge (the site's "ultimas unidades" badge), price, list_price, discount_percent, discount_amount (each with a *_display string in the market's format), price_min and price_max (shade masters), currency, installments {max_count, min_amount}, tags (e.g. oferta relampago), stamps [{label, date}], promotional_tag, is_kit, kit_contents [{product_id, quantity}], shade_count, shades [{product_id, shade, shade_code, swatch_image, image, price, list_price, discount_percent, in_stock, orderable, max_quantity, low_stock, low_stock_badge}], ingredients (the list as written), images, rating, review_count and latest_reviews [{rating, text, date}] (the 3 latest the page carries, no names). ${PRICES} No marketing description. Stock is a flag, not a unit count; refills are their own products with no link to the product they refill. An unknown product is a charged not-found. Captured 2026-11-27: NATBRA-194225, the Deo Parfum Ilia Secreto 25 ml, at 66.48 BRL (list 110.80, 40% off) with the ultimas unidades badge, rated 4.7 from 109 reviews. ${ONE}`,
    {
      country,
      product_id: z.string().min(1).max(40).optional()
        .describe("A product id (items[].product_id, shades[].product_id), e.g. 'NATBRA-194225' or a shade master 'NATBRA-PAI3379'; the bare number (194225) takes the market's prefix. Send product_id or url."),
      url: z.string().min(1).max(600).optional()
        .describe("Or a Natura product link (/p/<name>/<id>) on one of the six storefronts; it sets the market."),
    },
    post("product"),
  );

  server.tool(
    "get_natura_suggestions",
    `The ${SITE} search suggestions for the start of a search, as the site's suggestion box shows them: query, count, did_you_mean, products [{product_id, name, image, url}] (up to 3), brands, popular_searches and categories. Nothing to suggest is an empty answer. Captured 2026-11-27: kaiak on br suggested 3 products and the brand Kaiak. ${ONE}`,
    {
      country,
      query: z.string().min(1).max(100)
        .describe("The start of a search, e.g. 'kaiak'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_natura_stores",
    `The physical Natura stores in Brazil (the natura.com.br store list), filtered by state, city, CEP prefix and store type: total_listed, total, page, page_size, total_pages, has_more, count, filters_applied and stores [{store_code, name, type (own, franchise, athena, kiosk), site_type, address, neighborhood, city, state, cep, phone, email (the store's @natura.net mailbox, null otherwise), delivery}]. Brazil only. No coordinates, no opening hours, no store stock. Captured 2026-11-27: the list held 1,093 stores, 102 of them in the city of Sao Paulo (state sp). ${ONE}`,
    {
      country: z.enum(["br"]).optional()
        .describe("br (the store list is published on natura.com.br only)."),
      state: z.string().length(2).optional()
        .describe("A Brazilian state code (UF), e.g. 'sp': ac, al, am, ap, ba, ce, df, es, go, ma, mg, ms, mt, pa, pb, pe, pi, pr, rj, rn, ro, rr, rs, sc, se, sp, to."),
      city: z.string().min(1).max(80).optional()
        .describe("A city, accents and case ignored, e.g. 'Sao Paulo'."),
      cep: z.string().min(1).max(9).optional()
        .describe("A CEP (Brazilian postal code) or its leading digits, e.g. '01310'."),
      type: z.enum(["own", "franchise", "athena", "kiosk"]).optional()
        .describe("own (aurora), franchise (franquia), athena or kiosk (quiosque), as the site labels them."),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Page, 1-based. Defaults to 1."),
      page_size: z.number().int().min(1).max(200).optional()
        .describe("Stores per page, 1 to 200. Defaults to 50."),
    },
    post("stores"),
  );

  server.tool(
    "get_natura_deals",
    `The ${SITE} Black Friday campaign listing: the market's campaign category (natura-friday in br, ar, cl, co; promociones in mx and pe), sorted by discount where the market offers that sort (mx does not), filtered like search_natura: category_id, category_name, url, campaign_dates (the sentences of the campaign page that state its dates, as written; [] when the page states none, null when it could not be read) and ${GRID} ${PRICES} An unknown category is a charged not-found. Captured 2026-11-27: natura-friday on br held 4248 products sorted by discount, the first a body lotion refill at 29.90 BRL (list 99.90, 70% off); campaign_dates said the campaign runs 16 to 27 November 2026, with discounts extended to 30/11. ${ONE}`,
    {
      country,
      category_id: z.string().min(1).max(300).optional()
        .describe("Another campaign category instead of the market's Black Friday category (natura-friday in br, ar, cl, co; promociones in mx and pe)."),
      ...grid,
    },
    post("deals"),
  );
}
