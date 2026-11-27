import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/leroymerlin.ts (Leroy Merlin, the home improvement retailer of the ADEO group:
// Brazil with regional prices, and Italy, Spain, Portugal, Poland, Romania and France). Rules the backend enforces and
// zod here does not: country must be a served market; region is required for Brazil prices; France has no search and
// needs a product url; search, stores, reviews and suggestions are not offered in every market; filters hold at most 8
// codes. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE = "Leroy Merlin (the home improvement retailer of the ADEO group)";
const MARKETS =
  "Markets: br (Brazil, pt-BR, BRL, prices per region), it (Italy, EUR), es (Spain, EUR), pt (Portugal, EUR), pl (Poland, PLN), ro (Romania, RON), fr (France, EUR). Data comes in the market's language and currency.";
const BILL =
  "Billed on what the request spent in its market (credits_used is what was charged): Brazil 1; Italy 1 (product and category pages 2); Romania 1; Spain, Portugal and Poland 2; France 5. Refused inputs and upstream failures are not charged; a not-found is charged.";
const TIMEOUT = "Allow a client timeout of at least 120 s (240 s for Brazil search and category).";
const BR_ONE = "Brazil only, 1 credit (credits_used is what was charged). Refused inputs and upstream failures are not charged. Allow a client timeout of at least 120 s.";
const EU_ITEM =
  "position, id (what get_leroymerlin_product takes), name, brand, url, image, price, price_excluding_vat, original_price, discount_percent, currency, unit_price (as the page gives it, e.g. 3,56 EUR / Litro), price_validity (the page's promotion dates line), promotion, rating, review_count, seller {name, type (leroy_merlin or marketplace)}, offer_count, marketing_tags, sponsored, delivery";
const BR_ITEM =
  "position, id, name, short_name, brand, url, image, unit (cada, m2, rolo ...), price, original_price, currency (BRL), discount_type, payment_discount, promotion_start, promotion_end, offer {label, percent}, black_friday, free_shipping, express_shipping, in_stock, available, sellers, eans";
const EU_LIST = `page, page_size (48), total, total_pages, count, products_on_page, products [{${EU_ITEM}}], other_products [{position, id, sponsored}] (Leroy Merlin's page carries full details for the first products of each page only: 18 of 48 in most markets, all 48 in Romania; the others come as ids for get_leroymerlin_product), sorts, applied_filters, filters_available [{code, label, type, values [{value, count, applied}]}] and notes`;
const BR_LIST = `region, sort, page, page_size (36), total, total_pages, count, products [{${BR_ITEM}}] and notes; every price is the region's`;

const country = z.enum(["br", "it", "es", "pt", "pl", "ro", "fr"])
  .describe("Market: br (Brazil), it (Italy), es (Spain), pt (Portugal), pl (Poland), ro (Romania) or fr (France).");
const brCountry = z.literal("br").optional()
  .describe("br (the default and the only market for this tool).");
const REGIONS = [
  "acre", "alagoas", "bahia", "baixada_santista", "bauru", "belo_horizonte", "brasilia", "campinas", "ceara", "curitiba",
  "espirito_santo", "goiania", "grande_porto_alegre", "grande_sao_paulo", "joinville", "londrina", "mato_grosso",
  "mato_grosso_do_sul", "outros", "rib_preto", "rio_de_janeiro", "rio_grande_do_norte", "rondonia", "santa_catarina",
  "sao_jose_do_rio_preto", "sorocaba", "uberlandia", "vale_do_paraiba",
] as const;
const region = z.string().min(2).max(40).optional()
  .describe(`Brazil only, and required there: the price region (Leroy Merlin Brasil prices per region), e.g. 'grande_sao_paulo'. One of ${REGIONS.join(", ")}; get_leroymerlin_regions lists them with names.`);
const brRegion = z.string().min(2).max(40)
  .describe("Required: the Brazil price region, e.g. 'grande_sao_paulo' (get_leroymerlin_regions lists them).");
const productId = z.union([z.string().min(5).max(20), z.number().int().positive()]).optional()
  .describe("The product reference number (products[].id), e.g. '92450351'. France needs url instead. Send id or url.");
const productUrl = z.string().min(10).max(600).optional()
  .describe("Or a product link on the market's site (products[].url).");
const page = z.number().int().min(1).max(500).optional()
  .describe("Page, 1-based. Search reaches up to 10 pages in Europe (48 a page) and 28 in Brazil (36 a page). Defaults to 1.");
const sort = z.enum(["relevance", "price_asc", "price_desc"]).optional()
  .describe("relevance (default), price_asc or price_desc. Brazil: category only (keyword search keeps the site's order).");
const filters = z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional()
  .describe("Europe only: {code: value or [values]} from an earlier answer's filters_available (code, values[].value), e.g. {\"attribute-06575\": \"BOSCH\"}.");
const cep = z.string().min(8).max(9)
  .describe("A Brazilian CEP (postal code, 8 digits), e.g. '01310-100'.");

export function registerLeroymerlinTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/leroymerlin/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_leroymerlin",
    `${SITE} keyword search in Brazil (region required, priced for the region, with promotion dates and Black Friday flags) and Italy, Spain, Portugal, Poland and Romania (sorted, filtered, paged). Not available for France. ${MARKETS} Returns site, country, language, currency, query, redirected_to {type (category or product), url} (Europe sends some queries to a category or product page), and in Brazil ${BR_LIST}; in Europe ${EU_LIST}. Captured 2026-11-27: furadeira in grande_sao_paulo gave 401 results, the first the Furadeira Parafusadeira Philco a Bateria 21V at 199.90 BRL (original 212.66). ${BILL} ${TIMEOUT}`,
    {
      country,
      query: z.string().min(2).max(120)
        .describe("Keywords or a reference number, in the market's language, e.g. 'furadeira' (br) or 'trapano' (it). Europe sends a reference number to its product page (redirected_to)."),
      region,
      page,
      sort,
      filters,
    },
    post("search"),
  );

  server.tool(
    "get_leroymerlin_category",
    `One ${SITE} category's products by slug, path or link, sorted and paged, in any of the seven markets. ${MARKETS} Returns site, country, language, currency, category, url, and in Brazil ${BR_LIST}; in Europe listing, ${EU_LIST} and subcategories [{name, url, path}] (a landing page without a product list answers its subcategories). A wrong path is a charged not-found. Captured 2026-11-27: the Italian impact drivers category (avvitatori-a-impulsi) held 358 products over 8 pages, full details for 10 of the first 48, the first the DEWALT DCF887N at 98.90 EUR (81.07 before VAT). ${BILL} ${TIMEOUT}`,
    {
      country,
      category: z.string().min(1).max(600)
        .describe("Brazil: a category slug or link (get_leroymerlin_categories lists them, e.g. 'furadeiras'). Europe: a category path or link, e.g. '/prodotti/utensileria/elettroutensili/trapani-e-avvitatori/'."),
      region,
      page,
      sort,
      filters,
    },
    post("category"),
  );

  server.tool(
    "get_leroymerlin_offers",
    `Leroy Merlin Italia's offers page (offerte) as a product list, sorted, filtered and paged: site, country, language, currency, category, url and ${EU_LIST}. Captured 2026-11-27: the offers page held 923 products over 20 pages, full details for 18 of the first 48, with price validity lines such as "Prezzi validi dal 11 novembre al 29 novembre". 1 credit (credits_used is what was charged). Refused inputs and upstream failures are not charged. Allow a client timeout of at least 120 s.`,
    {
      country: z.literal("it")
        .describe("it (the market whose offers page is a product list)."),
      page,
      sort,
      filters,
    },
    post("offers"),
  );

  server.tool(
    "get_leroymerlin_product",
    `One ${SITE} product by reference number or link. ${MARKETS} Brazil (region required): id, name, short_name, brand, ean, url, region, priced_for_region, price, original_price, unit (the unit the price is for: cada, m2 ...), package {quantity, unit, label, price} (a box sold by the m2), discount {percent, type, condition}, installments {count, value, total}, tag (e.g. Black Friday), sold_out, available_online, seller, pickup_in_store, category_path, images, specifications [{name, value}], store_stock {unit, count, in_stock_count, stores [{store_id, name, units, in_stock, aisle, pickup_in_store, address}]} and marketplace_offers [{seller, price, original_price, discount, installments, free_shipping}]. Europe: id, name, brand, gtin, url, price, price_excluding_vat, original_price, discount_percent, sold_by_unit, unit_price (as given), price_validity (the promotion dates line), availability, rating, review_count, seller {name, type}, deliveries [{type, price, stock_status, lead_time}], marketplace_offer_count, marketplace_offers [{seller, price, original_price, discount_percent, deliveries}], marketing_tags, breadcrumbs, images and specifications. An unknown product is a charged not-found. Captured 2026-11-27: Brazil product 92450351, the Furadeira e Parafusadeira Wap WF 12K3.2 a Bateria 12V, at 129.90 BRL (original 149.90) in grande_sao_paulo, in stock at 12 of the region's 16 stores. ${BILL} ${TIMEOUT}`,
    {
      country,
      id: productId,
      url: productUrl,
      region,
    },
    post("product"),
  );

  server.tool(
    "get_leroymerlin_store_stock",
    `Units in store as Leroy Merlin Brasil reports them, for every store of a price region (or one store): exact units, the aisle and pickup. Returns site, country, language, currency, product_id, region, unit, count, in_stock_count, total_units and stores [{store_id, store_code, name, units, in_stock, message, aisle, pickup_in_store, address, pickup_hours}]. Prices are set per region, not per store. Stock as reported; Scavio makes no promise of its accuracy. Captured 2026-11-27: product 85277934 (sold by the rolo) in rio_de_janeiro was in stock at all 4 stores, 469 units in total, 218 at Rio Barra in the Eletricidade aisle. ${BR_ONE}`,
    {
      country: z.literal("br")
        .describe("br (store stock is available for Brazil only)."),
      id: productId,
      url: productUrl,
      region: brRegion,
      store: z.string().min(2).max(40).optional()
        .describe("Optional: one store of the region (stores[].store_id), e.g. 'raposo_tav'. Without it: every store of the region."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_leroymerlin_stores",
    `${SITE} stores. Brazil: the store list, optionally the stores of a region's state or a state, or sorted by distance from latitude / longitude: count and stores [{position, store_id, name, hours_text, address, state, cep, latitude, longitude, distance_km}]. Italy, Portugal, Poland, Romania and France (not Spain): the stores nearest a place (city or postcode) or a point, as the store chooser lists them (up to 10): place, matched_place, latitude, longitude, count and stores [{position, store_id, name, city, distance_km, open_now_text, hours_text, address_lines, url (what get_leroymerlin_store takes)}]. Captured 2026-11-27: Milano in Italy listed 10 stores, the nearest Rozzano (MI) at 9.4 km. ${BILL}`,
    {
      country,
      place: z.string().min(2).max(100).optional()
        .describe("Europe: a city or postcode, e.g. 'Milano' (the nearest stores to the first place the site matches)."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude of a point (with longitude)."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude of a point (with latitude)."),
      region: region
        .describe("Brazil only: the stores in the state of this price region."),
      state: z.string().min(2).max(2).optional()
        .describe("Brazil only: a state code (SP, RJ, RS ...)."),
    },
    post("stores"),
  );

  server.tool(
    "get_leroymerlin_store",
    `One ${SITE} store. Brazil by store id: store_id, name, hours_text, address, state, cep, latitude, longitude. Europe by store page link: store_id, name, url, address {street, postal_code, city, country}, phone, latitude, longitude, hours [{day, open, close}] and special_hours [{from, to, open, close}]. An unknown store is a charged not-found. Captured 2026-11-27: the Italian store Rozzano (MI), store 19, on Via Sandro Pertini. ${BILL}`,
    {
      country,
      store: z.string().min(2).max(40).optional()
        .describe("Brazil: the store id (stores[].store_id), e.g. 'raposo_tav'."),
      url: z.string().min(10).max(400).optional()
        .describe("Europe: the store page link (stores[].url), e.g. 'https://www.leroymerlin.it/negozi/rozzano-mi.html'."),
    },
    post("store"),
  );

  server.tool(
    "get_leroymerlin_reviews",
    `One page of a ${SITE} product's reviews and its rating summary. Brazil (6 a page, most helpful first): product_id, average_rating, total_reviews, rating_distribution, page, total_pages, count and reviews [{id, rating, title, text, date, recommended, helpful_count, not_helpful_count, photos}]. Italy, Portugal, Poland and Romania (8 a page, 4 sorts, a star filter; not available for Spain and France): product_id, sort, rating, average_rating, total_reviews, rating_distribution, page, total_pages, count and reviews [{id, rating, title, text, translated_title, translated_text, date_text, recommended, verified_purchase, badge, experience, usage, helpful_count, not_helpful_count, syndicated, source_site}]. Reviewer names are never returned. Captured 2026-11-27: Italian product 83085630 averaged 4.6 from 295 reviews over 37 pages, some syndicated from leroymerlin.pt. ${BILL}`,
    {
      country,
      id: productId,
      url: productUrl,
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based. Defaults to 1."),
      sort: z.enum(["newest", "oldest", "highest_rating", "lowest_rating", "most_helpful"]).optional()
        .describe("Europe: newest, oldest, highest_rating or lowest_rating (default: the site's order). Brazil: most_helpful only (the default)."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Europe only: only reviews with this many stars (1 to 5)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_leroymerlin_shipping",
    `A delivery quote for one Leroy Merlin Brasil product to a CEP (postal code) in a price region: product_id, cep, region, address {cep, street, district, city, state}, currency, standard / scheduled / express {cost, deadline_days} and pickup_in_store {cost, ready_in_hours, store_id}. Captured 2026-11-27: product 92450351 to CEP 01310-100 (Avenida Paulista, São Paulo): standard 9.90 BRL in 1 day, express 39.90 BRL the same day, free pickup ready in 2 hours. ${BR_ONE}`,
    {
      country: brCountry,
      id: productId,
      url: productUrl,
      region: brRegion,
      cep,
    },
    post("shipping"),
  );

  server.tool(
    "get_leroymerlin_cep",
    `The address Leroy Merlin Brasil holds for a CEP (postal code): cep, street, district, city, state and ibge_code. Captured 2026-11-27: 01310-100 is Avenida Paulista, Bela Vista, São Paulo SP. ${BR_ONE}`,
    { country: brCountry, cep },
    post("cep"),
  );

  server.tool(
    "get_leroymerlin_regions",
    `Leroy Merlin Brasil's 28 price regions (the region input of every priced Brazil tool): count and regions [{region, name, state}]. ${BR_ONE}`,
    { country: brCountry },
    post("regions"),
  );

  server.tool(
    "get_leroymerlin_categories",
    `Leroy Merlin Brasil's department tree, or one category's subtree: root, depth, count and categories [{name, url, category (what get_leroymerlin_category takes), child_count, children}]. Captured 2026-11-27: 26 departments at depth 2, the first Ar e Ventilação with 24 children. ${BR_ONE}`,
    {
      country: brCountry,
      category: z.string().min(1).max(300).optional()
        .describe("A category slug or link: its subtree. Without it: every department."),
      depth: z.number().int().min(1).max(4).optional()
        .describe("Levels returned, 1 to 4. Defaults to 2."),
    },
    post("categories"),
  );

  server.tool(
    "get_leroymerlin_suggestions",
    `Search suggestions as ${SITE}'s search box gives them, in Italy, Spain, Portugal and Poland: query, count and suggestions [{type (category, standard ...), type_label, label, url}]. Captured 2026-11-27: trapano in Italy gave 14 suggestions, the first the category Frese per trapano. ${BILL}`,
    {
      country: z.enum(["it", "es", "pt", "pl"])
        .describe("it, es, pt or pl."),
      query: z.string().min(2).max(80)
        .describe("What has been typed so far, e.g. 'trapano'."),
    },
    post("suggestions"),
  );
}
