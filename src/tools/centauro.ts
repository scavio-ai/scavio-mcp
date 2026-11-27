import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/centauro.ts (Centauro, centauro.com.br, the sporting-goods retailer of Grupo SBF;
// Brazil only, BRL). Rules the backend enforces and zod here does not: product takes product_id, model (with color) or
// url. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Centauro (centauro.com.br, the sporting-goods retailer of Grupo SBF), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const LIST_TIME = "Usually 10 to 45 s; allow a client timeout of at least 150 s.";
const FAST_TIME = "Usually 2 to 20 s; allow a client timeout of at least 120 s.";
const CARD =
  "position, product_id (model + colour: what get_centauro_product takes), model, color_code, name, brand, url, image, available, price, list_price, discount_percent, pix_price (the Pix price, where the site shows one; Pix is Brazil's instant payment), installment {count, amount}, has_different_prices (sizes can differ in price or seller), seller {name, is_centauro}, categories, badges (Mega Oferta, Preco Online ...), rating, review_count, color_count, size_count, size_skus (what get_centauro_freight takes) and variants [{product_id, color, url, image, price, list_price, discount_percent, pix_price, installment}] (the other colours)";
const GRID = `36 per page, pages 1 to 278, in the site's 4 sorts (relevance, discount, price_asc, price_desc), filtered by any facet value: brand, size, gender, product type, price band, sport, colour, discount band, promotion, store (loja: the products a physical store carries) and sold-by (vendidopor: Centauro or a marketplace seller). Returns page, page_size, total (the site caps it at 10000: total_capped), total_pages, has_more, count, items [{${CARD}}], facets [{name, key, values [{label, filter, count, selected}]}] with the site's counts, breadcrumbs, sort, filters_applied and notes.`;

const values = z.union([z.string().min(1).max(140), z.array(z.string().min(1).max(140)).max(10)]);
const cep = z.string().min(8).max(12)
  .describe("A Brazilian CEP (postal code, 8 digits), e.g. '01310-100'.");

const grid = {
  sort: z.enum(["relevance", "discount", "price_asc", "price_desc"]).optional()
    .describe("relevance (default), discount, price_asc or price_desc (the site's 4 sorts)."),
  filters: values.optional()
    .describe("Facet value(s) as key:value (facets[].values[].filter), up to 10, e.g. ['marca:nike', 'genero:masculino']. Keys: marca, tamanho, genero, produto, preco, esportes, modalidade, categorias, cor, desconto, idade, linha, promocao, loja, vendidopor."),
  brand: values.optional()
    .describe("Brand facet value(s) (marca), e.g. 'nike' or 'asics'."),
  store: values.optional()
    .describe("Store facet value(s) (loja): the products a physical store carries (stores[].filter from get_centauro_stores, or facets loja values), e.g. 'curitibaprshoppingbariguiloja0050'."),
  seller: values.optional()
    .describe("Sold-by facet value(s) (vendidopor): 'centauro' or a marketplace seller such as 'nikecombr' or 'adidas'."),
  page: z.number().int().min(1).max(278).optional()
    .describe("Results page, 1 to 278 (36 per page; the site caps the total at 10000). Defaults to 1."),
};

export function registerCentauroTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/centauro/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_centauro",
    `${SITE} keyword search: query and ${GRID} No results is an empty, charged answer. Captured 2026-11-27: tenis corrida reached the 10000 cap (278 pages), the first the Tenis Masculino adidas Super U at 389.99 BRL (list 599.99, 35% off) with the Mega Oferta badge, sold by Centauro. ${COST} ${LIST_TIME}`,
    {
      query: z.string().min(1).max(120)
        .describe("Search keywords, in Portuguese as shoppers type them, e.g. 'tenis corrida'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_centauro_category",
    `One ${SITE} category listing by its /nav/ path or link, or one facet value (categorias:calcados), sorted and filtered like search_centauro: path, url, category_filters and ${GRID} An unknown category, or one with no products for the filters, is a charged not-found. Captured 2026-11-27: categorias:calcados sorted by discount reached the 10000 cap, the first a Diadora casual sneaker at 220 BRL (list 1099.99, 82% off). ${COST} ${LIST_TIME}`,
    {
      path: z.string().min(1).max(400)
        .describe("A category as its centauro.com.br /nav/ path or link (key / value pairs, as the site's breadcrumb links write them), e.g. '/nav/categorias/calcados/produto/tenis', or one facet value such as 'categorias:calcados'."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_centauro_deals",
    `A ${SITE} deal list: the Black Friday hotsite (black-friday, default), the outlet or the Mega Oferta promotion, or another hotsite slug, sorted and filtered like search_centauro: deal, url and ${GRID} The site publishes no start or end dates for its deals. An unknown deal list is a charged not-found. Captured 2026-11-27: black-friday held 9257 products over 258 pages, the first a pair of shorts at 31.57 BRL (29.99 BRL by Pix, 57% off). ${COST} ${LIST_TIME}`,
    {
      deal: z.string().min(1).max(300).optional()
        .describe("black-friday (default), outlet or mega-oferta, or another /hotsite/ slug or link of the site."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_centauro_product",
    `One ${SITE} product by product_id (model + colour), model + color or link: product_id, requested_id, model, color {code, name}, name, brand, url, available, in_stock, low_stock, purchase_limit, group, sub_group, category, gender, age_group, collection, category_path, breadcrumbs, currency, price_min, price_max, has_different_prices, sellers, split_sellers (a Centauro offer and a brand seller can split the sizes), installments [{count, amount}], size_count, sizes_in_stock, sizes [{size, size_code, sku (what get_centauro_freight takes), ean, in_stock, available, marketplace, price, list_price, discount_percent, pix_price, pix_discount_percent, installment, seller {name, code, is_centauro, own_delivery}}], colors [{product_id, color_code, name, url, image}], images, badges, specs [{group, name, values}], rating, review_count and reviews [{rating, date, text, highlights}] (up to 3, as the product page carries them; no reviewer names). Stock is a flag per size, not a unit count. No marketing description, no full review list, no Q&A. An unknown product is a charged not-found. Captured 2026-11-27: 9976EA51, the Tenis Masculino adidas Super U in BRANCO/PRETO, from 389.99 to 599.99 BRL by size, sizes split between adidas and Centauro, 11 of 12 sizes in stock, 6 colours. ${COST} ${FAST_TIME}`,
    {
      product_id: z.string().min(1).max(12).optional()
        .describe("The Centauro product id, model + colour (items[].product_id, colors[].product_id), e.g. '9976EA51'. Send product_id, model with color, or url."),
      model: z.string().min(1).max(12).optional()
        .describe("Or the model code, with color, e.g. '9976EA'."),
      color: z.string().min(1).max(8).optional()
        .describe("The colour code (colors[].color_code), with model, e.g. '51'."),
      url: z.string().min(1).max(800).optional()
        .describe("Or a centauro.com.br product link with its ?cor= colour."),
    },
    post("product"),
  );

  server.tool(
    "get_centauro_freight",
    `Delivery and store pickup for one size of a ${SITE} product, by size sku and Brazilian CEP: sku, product_name, cep, destination {city, state, neighborhood, street}, currency, count, delivery_options [{type (pickUpInStore, normal, scheduled, clickUpMarketplace ...), label, cost, free, origin (store, warehouse, marketplace), deadline, estimated_date, estimated_text, same_day}], store_count, stores_with_stock and stores [{store_code, name, distance_km, hours, address {full, street, number, neighborhood, city, state, cep, latitude, longitude}, pickup_available, in_store_stock (the store has the size now: pickup the same day or in 1 business day), pickup_days, transfer_days (otherwise: business days to send it to the store), pickup_text, pickup_cost, estimated_date, same_day, filter}]. Stock flags, not unit counts. An unknown or out-of-stock sku is a charged not-found. Captured 2026-11-27: size sku 9976EA510375 to CEP 01310-100 had free same-day store pickup and free normal delivery in 9 to 10 business days, with 18 stores holding the size. ${COST} ${FAST_TIME}`,
    {
      sku: z.string().min(10).max(20)
        .describe("A size sku (sizes[].sku of get_centauro_product, or items[].size_skus), e.g. '9976EA510375'."),
      cep,
    },
    post("freight"),
  );

  server.tool(
    "get_centauro_stores",
    `The physical ${SITE} stores near a Brazilian CEP, by distance: cep, count and stores [{store_code, name, city, state, label, distance_km, latitude, longitude, filter (send it to search_centauro as store)}]. Hours, street address and per-store stock flags for one product come from get_centauro_freight. Captured 2026-11-27: CEP 20040-002 (Rio de Janeiro) listed 27 stores, the nearest 4.62 km away. ${COST} ${FAST_TIME}`,
    { cep },
    post("stores"),
  );

  server.tool(
    "get_centauro_suggestions",
    `The ${SITE} search suggestions for the start of a search: query, count, suggestions [{position, term}] and top_searches [{position, term}] (the site's most searched terms). Captured 2026-11-27: tenis suggested 5 terms (tenis nike, tenis feminino...) next to 10 top searches. ${COST} ${FAST_TIME}`,
    {
      query: z.string().min(1).max(80)
        .describe("The start of a search, as a shopper types it, e.g. 'tenis'."),
    },
    post("suggestions"),
  );
}
