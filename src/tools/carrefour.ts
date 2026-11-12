import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/carrefour.ts (carrefour.fr, plus Argentina,
// Romania and Belgium for search and product). Cross-field rules the backend
// enforces and zod here does not: product takes ean or url (url only on ro and
// be); category takes url or path; stores takes postal_code or lat + lng;
// store takes slug or url; language only applies to be; store, the filters
// and the unit-price / top_rated sorts are fr only; ar and ro sort by
// relevance or price, be by relevance only. No zod `.default()`: the MCP SDK
// would post a defaulted field on every call.

const COUNTRIES = ["fr", "ar", "ro", "be"] as const;
const SORTS = [
  "relevance",
  "price_low_to_high",
  "price_high_to_low",
  "unit_price_low_to_high",
  "unit_price_high_to_low",
  "top_rated",
] as const;
const REVIEW_SORTS = ["most_recent", "oldest", "highest_rated", "lowest_rated"] as const;
const PROMOTION_TYPES = ["all", "catalogue", "immediate", "loyalty", "festive"] as const;
const SERVICES = [
  "drive",
  "lad",
  "Retrait2h-drive",
  "station_service",
  "banque_assurance",
  "spectacles",
  "voyages",
  "location_vehicule",
  "traiteur",
  "Parapharmacie",
  "pro",
] as const;

const MARKETS = "fr (carrefour.fr, EUR, every tool, default), ar (Argentina, ARS, Spanish), ro (Romania, RON, Romanian) or be (Belgium, EUR, language fr or nl; 2 credits)";
const ITEM_FIELDS = "ean (for get_carrefour_product, get_carrefour_reviews and get_carrefour_store_availability), title, brand, url, image, type (product or marketplace), sponsored, price (regular price), unit_price with unit and unit_price_label (price per kg / L), packaging, format, nutriscore (A-E), ecoscore, rating, review_count, available, low_stock, promotion (type, label, loyalty_only: the price needs the Carrefour loyalty card, seen_in_catalogue, discounted_price, initial_price, discount_amount, quantity, starts_at, ends_at; on multi-buy deals such as 'Le 2ème à -50%' initial_price and discounted_price cover quantity items, and discounted_price is null when the site does not price the deal), seller (marketplace items: id, name, rating, shipping days, free shipping), flags (organic...) and category";
const GRID = `Items with ${ITEM_FIELDS}. Also total, total_pages, page, page_size (30 on fr), every facet (id, label, values with label, count and selected; the price facet's bands in EUR), store, price_scope, country, language and currency`;
const GRID_SHORT = "The same item fields, totals and facets as search_carrefour";
const SCOPE = "Prices: without store, carrefour.fr's national online price; with store, that store's shelf price and assortment (they differ by store: Nutella 400 g was 3.99 national, 3.69 at two stores and 4.61 at another). The response says which (store, price_scope).";
const FRENCH = "Titles, labels and descriptions come in French, as the site writes them.";
const CHARGE = "Failed upstream calls are not charged (they are retried automatically); a not-found is charged.";
const C1 = `${CHARGE} 1 credit.`;
const CM = `${CHARGE} 1 credit (2 on be).`;

const country = () => z.enum(COUNTRIES).optional()
  .describe(`The national site: ${MARKETS}. Defaults to fr. Titles come in the market's language, prices in its currency.`);
const frOnly = () => z.enum(["fr"]).optional()
  .describe("fr only (carrefour.fr).");
const language = () => z.enum(["fr", "nl"]).optional()
  .describe("be only: fr (default) or nl.");
const store = () => z.union([z.string().regex(/^\d{1,8}$/), z.number().int().min(0)]).optional()
  .describe("fr only: price and assortment at one store. A store_ref or pickup_refs[].ref from find_carrefour_stores, or stores[].store.ref from get_carrefour_store_availability, e.g. '840093'. Without it prices are the national online price.");
const ean = (example: string) => z.string().regex(/^\d{8,14}$/)
  .describe(`The product barcode (EAN / GTIN): items[].ean of a search, e.g. '${example}'.`);

const page = () => z.number().int().min(1).max(500).optional()
  .describe("Results page, 1-based. Defaults to 1. 30 items per page on fr (ar and ro 24, be 36).");
const sort = () => z.enum(SORTS).optional()
  .describe("relevance (default), price_low_to_high, price_high_to_low, unit_price_low_to_high, unit_price_high_to_low or top_rated. ar and ro: relevance and the two price sorts; be: relevance.");

const filterFields = {
  brand: z.string().min(1).max(80).optional()
    .describe("fr: one brand as the Marque facet lists it (facets[id=facet_marque].values[].label, e.g. NUTELLA, CARREFOUR BIO). Another casing is matched to the facet's own."),
  nutriscore: z.enum(["A", "B", "C", "D", "E"]).optional()
    .describe("fr: only this Nutri-Score."),
  organic: z.boolean().optional()
    .describe("fr: only organic products."),
  carrefour_brands: z.boolean().optional()
    .describe("fr: only Carrefour's own brands."),
  min_price: z.number().min(0).max(100000).optional()
    .describe("fr: lowest price in EUR."),
  max_price: z.number().min(0).max(100000).optional()
    .describe("fr: highest price in EUR."),
};
const promotionFilter = {
  promotion: z.string().min(1).max(80).optional()
    .describe("fr: one value of the Promotions facet (facets[id=facet_promotions]): Toutes les promotions, Remises immédiates, Vu en catalogue, Avantage Fidélité..."),
};

export function registerCarrefourTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/carrefour/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_carrefour",
    `Search Carrefour grocery and household products by keyword: carrefour.fr (France) with every filter (brand, promotion, Nutri-Score, organic, Carrefour brands, price range), sorts by price, unit price or rating, and store-scoped prices; also the Argentina (ARS), Romania (RON) and Belgium (EUR, French or Dutch) sites, which return the fields their site carries (no facets or store scope). Misspellings come back corrected (corrected_query); when nothing matches the site returns loosely related items and results_type is "fallback". ${GRID}. ${SCOPE} ${FRENCH} Markets: ${MARKETS}. ${CM}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'nutella' or 'lait'. Misspellings are corrected by the site on fr (corrected_query)."),
      country: country(),
      language: language(),
      store: store(),
      page: page(),
      sort: sort(),
      ...filterFields,
      ...promotionFilter,
    },
    post("search"),
  );

  server.tool(
    "get_carrefour_product",
    `One Carrefour product by EAN or URL. On fr: title, brand, description, key features, breadcrumb, categories, images, packaging, format, origin, Nutri-Score, Eco-Score, regulated name, ingredients, allergens (as written in capitals in the ingredients), nutrition per 100 g / ml and per portion (with daily value %), storage and advice, characteristics (non-food), weights, the price block (price, unit price, tax note, promotion with loyalty_only), availability, the marketplace seller and every offer, and the rating (average, count, distribution). ${SCOPE} ${FRENCH} ar (by EAN or URL), ro and be (by URL only) return title, brand, price, list price, promotion, unit price, availability, description, images and categories as their site gives them. ${CM}`,
    {
      ean: ean("3017620422003").optional(),
      url: z.string().min(1).max(800).optional()
        .describe("A product URL (items[].url of a search). Alternative to ean on fr and ar; required on ro and be."),
      country: country(),
      language: language(),
      store: store(),
      seller: z.union([z.string().regex(/^\d{1,10}$/), z.number().int().min(0)]).optional()
        .describe("fr: a marketplace seller id (items[].seller.id) to read that seller's offer."),
    },
    post("product"),
  );

  server.tool(
    "get_carrefour_reviews",
    `Verified-purchase customer reviews of one carrefour.fr product by EAN, 1-50 per call (default 10), sorted most recent (default), oldest, highest or lowest rated, optionally only one star rating, with offset paging: total, has_more and per review author (public first name and last initial, as published), rating, title, text, reviewed_at, purchased_at and source (the verified-review provider). Review text is in French. fr only. ${C1}`,
    {
      ean: ean("8006530256179"),
      country: frOnly(),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_recent (default), oldest, highest_rated or lowest_rated."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this many stars (1-5)."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Reviews to return, 1-50. Defaults to 10."),
      offset: z.number().int().min(0).max(10000).optional()
        .describe("Reviews to skip (paging). Defaults to 0."),
    },
    post("reviews"),
  );

  server.tool(
    "get_carrefour_category",
    `A carrefour.fr category (aisle) grid by URL or path (/r/cremerie, /r/epicerie-sucree/petit-dejeuner), with the same filters and sorts as search_carrefour and the category's label, path, url and breadcrumb. A product's breadcrumb[].url is a valid path. ${GRID_SHORT}. ${SCOPE} fr only. ${C1}`,
    {
      url: z.string().min(1).max(800).optional()
        .describe("A carrefour.fr category page URL (/r/...), e.g. 'https://www.carrefour.fr/r/cremerie'. Alternative to path."),
      path: z.string().min(1).max(400).optional()
        .describe("The category path ('/r/cremerie', '/r/epicerie-sucree/petit-dejeuner') or its slug ('cremerie'): a breadcrumb[].url of a product. Alternative to url."),
      country: frOnly(),
      store: store(),
      page: page(),
      sort: sort(),
      ...filterFields,
      ...promotionFilter,
    },
    post("category"),
  );

  server.tool(
    "get_carrefour_promotions",
    `carrefour.fr items on promotion: all (default), catalogue (seen in the printed catalogue, Vu en catalogue), immediate (Remises immédiates), loyalty (Avantage Fidélité: loyalty-card offers, i.e. member prices) or festive (the site's seasonal Sélection festive), optionally for one aisle, with the search filters and sorts. Each promotion carries type, label, loyalty_only, discounted_price and initial_price (discounted_price is null when the site does not price the deal, as on some multi-buy offers), and its start and end dates. ${GRID_SHORT}. ${SCOPE} Not the printed leaflet itself and no price history: to track promotions over time, poll and store your own. fr only. ${C1}`,
    {
      type: z.enum(PROMOTION_TYPES).optional()
        .describe("all (default), catalogue, immediate, loyalty or festive."),
      category: z.string().min(1).max(80).optional()
        .describe("Only one aisle: a value of the Rayons facet (facets[id=product.categories.name].values[].label), e.g. 'Boissons'."),
      country: frOnly(),
      store: store(),
      page: page(),
      sort: sort(),
      ...filterFields,
    },
    post("promotions"),
  );

  server.tool(
    "get_carrefour_suggestions",
    `carrefour.fr search box suggestions for a partial query: suggestions (text, url) and category suggestions (category, text, url), in French. fr only. ${C1}`,
    {
      query: z.string().min(1).max(200)
        .describe("What a shopper has typed so far, e.g. 'nutel'."),
      country: frOnly(),
    },
    post("suggestions"),
  );

  server.tool(
    "find_carrefour_stores",
    `Carrefour stores in France near a postal code or a point, nearest first (up to 20 per page), optionally only those with one service (drive, home delivery, fuel station...). Each store has id, store_ref and pickup_refs (pass either as store on search_carrefour, get_carrefour_product, get_carrefour_category or get_carrefour_promotions for that store's prices), name, banner, format, distance_km, address, lat, lng, open_today and today's opening hours, slug (for get_carrefour_store) and store_url. fr only. ${C1}`,
    {
      postal_code: z.string().regex(/^\d{5}$/).optional()
        .describe("A French postal code, e.g. '69003'. Alternative to lat + lng."),
      lat: z.number().min(41).max(51.5).optional()
        .describe("Latitude (metropolitan France), with lng."),
      lng: z.number().min(-5.5).max(10).optional()
        .describe("Longitude, with lat."),
      page: z.number().int().min(1).max(50).optional()
        .describe("Page of stores, 1-based."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Stores per page, 1-20. Defaults to 10."),
      service: z.enum(SERVICES).optional()
        .describe("Only stores with this service: drive, lad (home delivery), Retrait2h-drive, station_service (fuel station), banque_assurance, spectacles, voyages, location_vehicule, traiteur, Parapharmacie or pro."),
      country: frOnly(),
    },
    post("stores"),
  );

  server.tool(
    "get_carrefour_store_availability",
    `Whether the Carrefour stores around a French postal code carry one product (EAN): count, available_count and per store available yes / no, distance_km and the store (id, ref, pickup_refs, name, banner, format, address, lat, lng, phone, weekly opening hours and drive hours, slug, store_url). Availability only, no price and no unit count: for a store's price call search_carrefour or get_carrefour_product with store set to stores[].store.ref. fr only. ${C1}`,
    {
      ean: ean("3017620422003"),
      postal_code: z.string().regex(/^\d{5}$/)
        .describe("A French postal code, e.g. '69003': stores around it are checked."),
      country: frOnly(),
    },
    post("store-availability"),
  );

  server.tool(
    "get_carrefour_store",
    `One Carrefour store in France by slug or URL: name, banner, format, type, status, address, lat, lng, phone, services, weekly opening hours and drive hours, the next pickup slots as shown, delivery and express delivery flags, nearby stores and, at stores with a fuel station, fuel prices per litre (Gazole, SP95, SP95-E10, SP98, E85, GPLc) with their update times (fuel is null elsewhere). No delivery-slot booking. fr only. ${C1}`,
    {
      slug: z.string().min(1).max(120).optional()
        .describe("A store page slug: stores[].slug from find_carrefour_stores, e.g. 'venissieux' or 'lyon-part-dieu'. Alternative to url."),
      url: z.string().min(1).max(400).optional()
        .describe("A carrefour.fr/magasin/... store page URL, e.g. 'https://www.carrefour.fr/magasin/venissieux'. Alternative to slug."),
      country: frOnly(),
    },
    post("store"),
  );
}
