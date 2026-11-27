import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/casasbahia.ts (Casas Bahia, casasbahia.com.br, the Brazilian retailer of Grupo
// Casas Bahia, with its Extra and Ponto stores; Brazil only, BRL). Rules the backend enforces and zod here does not:
// product takes sku or url. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Casas Bahia (casasbahia.com.br, the Brazilian retailer of Grupo Casas Bahia, with its Extra and Ponto stores), Brazil only, Portuguese text, prices in BRL";
const TWO =
  "2 credits (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 10 to 60 s; allow a client timeout of at least 120 s.";
const NO_PRICES =
  "List items carry no prices: read get_casasbahia_product with an item's sku for its price, Pix price, installments and sellers.";
const FILTERS =
  "Sorted by the storefront's 5 sorts (relevance, popularity, price_asc, price_desc, best_selling) and filtered by any facet value (brand, price band, discount band, rating, seller, features), own_store and a price range.";
const ITEM =
  "items [{position, product_id, sku (what get_casasbahia_product takes), title, brand, brand_id, rating, review_count, image, url, path, status, seller_type, category {id, name, subcategories}}]";
const GRID = `20 items a page: total, total_is_capped (the storefront counts up to 10,000), total_pages, page, page_size, sort, count, ${ITEM}, sponsored_count and sponsored (the storefront's sponsored placements, "Patrocinado", kept apart from items, same fields plus seller_id and their position on the page), facets [{id, name, type, values [{label, count, filter (what filters takes), selected, min, max, children}]}] and notes.`;

const site = z.enum(["casasbahia", "extra", "pontofrio"]).optional()
  .describe("casasbahia (default, casasbahia.com.br), extra (extra.com.br) or pontofrio (pontofrio.com.br, the Ponto store). One catalog; each storefront's own-store price and review counts can differ.");

const grid = {
  site,
  page: z.number().int().min(1).max(500).optional()
    .describe("Page, 1 to 500 (20 items a page; the storefront counts up to 10,000 results). Defaults to 1."),
  sort: z.enum(["relevance", "popularity", "price_asc", "price_desc", "best_selling"]).optional()
    .describe("relevance (default), popularity, price_asc, price_desc or best_selling."),
  filters: z.union([z.string().min(2).max(151), z.array(z.string().min(2).max(151)).max(10)]).optional()
    .describe("Up to 10 filter values from a previous answer's facets[].values[].filter, e.g. ['marca-m19', 'avaliacao-r5'] (brand, rating; also discount bands such as desconto-10to19, sellers such as lojistas-l15, features). Values combine."),
  own_store: z.boolean().optional()
    .describe("Only items sold and delivered by the storefront itself (Casas Bahia, Extra or Pontofrio), not by marketplace sellers."),
  min_price: z.number().int().min(0).max(1_000_000).optional()
    .describe("Minimum price in whole reais (BRL)."),
  max_price: z.number().int().min(0).max(1_000_000).optional()
    .describe("Maximum price in whole reais (BRL)."),
};

export function registerCasasbahiaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/casasbahia/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_casasbahia",
    `${SITE} keyword search on Casas Bahia, Extra or Ponto (site). ${FILTERS} Returns site, store, query, filters, page_type and ${GRID} ${NO_PRICES} Captured 2026-11-27: geladeira frost free on casasbahia gave 1170 results over 59 pages plus 8 sponsored placements, the first the Geladeira Frost Free Duplex Branca Consul - CRM40MB, rated 4.83 from 105 reviews. ${TWO}`,
    {
      query: z.string().min(1).max(120)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'geladeira frost free'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_casasbahia_category",
    `One ${SITE} category, a deal collection (/c?Filtro=D<id>, such as the coupon and campaign lists) or a seller's list (/c?filtro=L<seller id>), by path or link. ${FILTERS} Returns category {path, category_ids, collection_id, collection_name, seller_id} and ${GRID} Collections carry no start or end dates. ${NO_PRICES} An unknown category is a charged not-found. Captured 2026-11-27: /c/eletroportateis?filtro=categoria-c73 sorted best_selling counted 10,000+ products (total_is_capped), the first the Fritadeira Air Fryer Oven Mondial AFON-12L-FG, rated 4.85 from 220 reviews. ${TWO}`,
    {
      path: z.string().min(2).max(600)
        .describe("A category path (categories[].path from get_casasbahia_categories, e.g. '/c/eletroportateis?filtro=categoria-c73'), a deal collection ('/c?Filtro=D69331') or such a link on one of the three storefronts."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_casasbahia_product",
    `One product on Casas Bahia, Extra or Ponto by sku or link, with every seller: requested, sku, product_id, name, brand, url, ean, categories, price (regular price, card in one payment), list_price (the "De" price when shown), pix_price and pix_discount_percent (when the storefront offers a Pix discount; Pix is Brazil's instant payment), discount_percent, currency, price_seller_id, price_sold_by_store, payment {pix, boleto}, installment_plans [{type, plans [{parcels, parcel_value, total, monthly_interest_percent, interest_free, text}]}], best_installments, store_card (the store card plan), offer_count, offer_price_range, sellers [{seller_id, name (business name), buy_box, price, list_price, buy_button_enabled, is_store, pickup_available}], availability {status, buy_button_enabled, pickup_available} (flags, no unit counts), highlights, specs [{group, name, value}], dimensions, images, selection_fields, variants [{sku, label, attributes, active, selected, image}] (each variant is its own sku: read it for its price and sellers), reviews {rating, count, recommend_percent, stars, site_summary (the storefront's own summary of its reviews, as given), items (the 3 reviews on the page, no reviewer names)} and questions {total, items (the 3 questions on the page with their answers, answered_by store / customer / other, no names)}. An out-of-stock product answers availability out_of_stock with no price or sellers. Not available: reviews past the page's 3, freight by CEP, store lists. An unknown sku can take about 80 s and answers an uncharged error that says to check the sku (a charged not-found when the storefront answers with its not-found page). Captured 2026-11-27: sku 55066339, the Smart TV 55" TCL 55P755 (EAN 7899968301570), rated 4.9 from 759 reviews with 99% recommending it and 135 questions. ${TWO}`,
    {
      site,
      sku: z.union([z.string().regex(/^\d{1,15}$/), z.number().int().positive()]).optional()
        .describe("The SKU id (items[].sku, or the number after /p/ in a product link), e.g. '55066339'. Send sku or url."),
      url: z.string().min(10).max(600).optional()
        .describe("Or a product link on any of the three storefronts (the link's storefront is the site)."),
    },
    post("product"),
  );

  server.tool(
    "get_casasbahia_categories",
    `The ${SITE} category menu of one storefront (site), as its header lists it: group_count, count, groups [{name, categories [{name, path (what get_casasbahia_category takes; null for a landing page that is not a product list), url, category_id, collection_id, seller_id}]}], featured (the department shortcuts) and menu (the top bar links, a deal collection included). Captured 2026-11-27: casasbahia listed 8 groups and 39 categories, from Tecnologia e Eletrônicos to Livros e Papelaria. ${TWO}`,
    { site },
    post("categories"),
  );
}
