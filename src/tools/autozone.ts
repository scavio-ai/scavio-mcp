import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/autozone.ts (autozone.com every tool; autozone.com.br
// search, product, store-stock, vehicles, stores, store, categories; autozone.com.mx
// vehicles, stores, store, categories). Cross-field rules the backend enforces and zod
// here does not: product, reviews and store-stock take exactly one of id or url; store
// takes one of slug or url; filters take one facet; makes need year, models year +
// make_id, submodels and engines year + make_id + model_id. Lists are page 1 only, so
// these tools take no page. No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const SORTS = ["relevance", "price_asc", "price_desc"] as const;
const REVIEW_SORTS = ["default", "most_recent", "most_helpful"] as const;
const LEVELS = ["years", "makes", "models", "submodels", "engines"] as const;
const ALL_MARKETS = ["us", "br", "mx"] as const;
const BRAND_FACET = "sub_brand_name_display_s";

const NAME = "AutoZone (autozone.com, the US auto parts retailer)";
const CREDITS = "Costs 1 credit. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Prices and stock are as AutoZone shows them for the store it assigns to the request: every answer names that store in priced_for {store_number, address, city, state, zip}. AutoZone prices differ by store (core charges too), so the same item can cost more or less elsewhere and two calls can be priced for different stores; never report a price as national. There is no store or ZIP input on us. Stock is as AutoZone reports it, not a promise.";
const BR =
  "On br (autozone.com.br: Portuguese text, BRL) prices are for AutoZone store 7602 Sao Paulo (Interlagos); br costs 2 credits.";
const NOT_AVAILABLE =
  "Not available: results past the first 24, stores near a ZIP, stock at a chosen US or Mexican store, search suggestions, VIN lookup, engine-level fitment, repair guides, AutoZonePro / commercial pricing, Mexico prices, price history (poll and store the answers), checkout.";
const AVAIL =
  "availability {store_pickup {available, quantity}, ship_to_home {available, quantity, estimated_delivery}, next_day {available, quantity, order_cutoff, estimated_delivery}, same_day {available, quantity}, sister_stores_available, sister_store_count}";
const ITEM = `position, id (the input of get_autozone_product and get_autozone_reviews), part_number, name, brand, sub_brand, part_type, url, image, location (e.g. Front, Rear), fitment {type (UNIVERSAL or VEHICLE_SPECIFIC), vehicle_fit (as AutoZone gives it, e.g. NEEDS_BASE_VEHICLE)}, oem_part_number, oem_brand (the cross-referenced part number and brand), attributes, sponsored, price, was_price (AutoZone's struck-through price, as shown), deal_price, discount_percent (computed by Scavio from was_price), core_charge (the refundable core deposit AutoZone adds until the old part is returned; 0 when none), currency, warranty, clearance, ${AVAIL}. List items carry no rating (get_autozone_product has it)`;
const FACETS = "facets [{facet (the key to send in filters), name, values [{value (the value to send), label, count, selected}]}]";
const LIST = `priced_for, title, total (as AutoZone reports it), count, page_size (24), items (${ITEM}), ${FACETS}, notes. AutoZone's pages list the first 24 results only (no paging): narrow with one facet filter, a price range or sort`;

const sort = z.enum(SORTS).optional().describe("relevance (default, AutoZone's own order), price_asc or price_desc.");
const filters = z.record(z.string(), z.union([z.string().min(1).max(120), z.number()])).optional()
  .describe(`One facet: { "<facets[].facet>": "<facets[].values[].value>" }, e.g. { "position_name_s": "Front" } or { "${BRAND_FACET}": "Duralast Gold" }. AutoZone's pages apply one at a time.`);
const priceRange = {
  min_price: z.number().min(0).max(100_000).optional().describe("Lowest price, in the market's currency (USD; BRL on br)."),
  max_price: z.number().min(0).max(100_000).optional().describe("Highest price, in the market's currency."),
};
const id = z.union([z.string().min(1).max(12), z.number().int().positive()]);
const vehicle = z.object({
  year: z.number().int().min(1900).max(2100),
  make: z.string().min(1).max(60),
  model: z.string().min(1).max(80),
}).optional()
  .describe("Only the parts that fit this year / make / model, e.g. { year: 2018, make: 'Ford', model: 'F-150' } (names as get_autozone_vehicles lists them). An unknown make or model for that year is a charged 404.");
const allMarkets = z.enum(ALL_MARKETS).optional();

export function registerAutozoneTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/autozone/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_autozone",
    `Search ${NAME} by keywords, an AutoZone part number or another brand's part number (cross-reference: an OEM or competitor number such as PH3614 or FL-820S finds the parts AutoZone matches to it): country, language, currency, query, sort, filters, min_price, max_price, ranking_variant (the ranking variant AutoZone served; AutoZone runs ranking tests, so totals and order can differ between two identical calls), part_number_search, match_type, corrected_query, oem_part_number, oem_brand, redirected_to, list_source, ${LIST}. A search AutoZone sends straight to one product page answers redirected_to and redirect_product_id with no items. For the parts that fit one vehicle use get_autozone_category with vehicle. ${PRICES} ${BR} ${NOT_AVAILABLE} ${CREDITS} (2 on br)`,
    {
      query: z.string().min(1).max(200)
        .describe("Keywords (brake pads), an AutoZone part number (DG1210) or another brand's part number (PH3614, FL-820S). Brazil: Portuguese keywords (pastilha de freio)."),
      country: z.enum(["us", "br"]).optional()
        .describe("us (autozone.com, USD, default) or br (autozone.com.br, BRL, 2 credits). Mexico search is not offered (AutoZone Mexico prices only for a Mexican store it does not reliably assign)."),
      sort,
      brand: z.string().min(1).max(80).optional().describe(`A brand as facets lists it (e.g. Duralast Gold): the same as filters.${BRAND_FACET}.`),
      filters,
      ...priceRange,
    },
    post("search"),
  );

  server.tool(
    "get_autozone_product",
    `One ${NAME} product in full by item id or link: country, language, currency, requested_id, priced_for, id, part_number, name, brand, sub_brand, part_type, url, brand_path, description, features, specifications [{name, value}], breadcrumbs [{name, path, page_type}], images, safety_data_sheets (PDF links), fitment {type (UNIVERSAL or VEHICLE_SPECIFIC), vehicle_fit}, location, price, was_price, deal_price, discount_percent (computed by Scavio from was_price), core_charge (refundable core deposit; 0 when none), warranty, clearance, deal {available, price, label (e.g. Bundle and Save), quantity}, ${AVAIL}, rating {average, count, with_text, ratings_only, recommended_percent, distribution [{stars, count, percent}]}. The product page carries no per-vehicle fit list: use get_autozone_category with vehicle for what fits. An id AutoZone does not have is a charged 404. ${PRICES} ${BR} ${CREDITS} (2 on br)`,
    {
      id: id.optional().describe("AutoZone item id (items[].id, the number at the end of the product link), e.g. 1399158. Send one of id or url."),
      url: z.string().min(20).max(600).optional()
        .describe("Or the product link (https://www.autozone.com/p/<name>/<id>, or autozone.com.br); the market comes from the link."),
      country: z.enum(["us", "br"]).optional().describe("With id: us (default) or br (2 credits). Mexico product is not offered."),
    },
    post("product"),
  );

  server.tool(
    "get_autozone_category",
    `One ${NAME} part type's products by path or link, optionally only the parts that fit a vehicle (year, make, model), sorted and filtered (us): country, category, requested_vehicle, filters, min_price, max_price, sort, list_type (products, or group for a page that only groups part types), page_type, vehicle {year, make, model} (as AutoZone applied it), ${LIST}. Vehicle fit is at year / make / model level: items AutoZone ties to an engine read fitment.vehicle_fit NEEDS_BASE_VEHICLE (engine-level fitment is not offered). ${PRICES} ${CREDITS}`,
    {
      category: z.string().min(2).max(400)
        .describe("A part type path (get_autozone_categories children[].path with has_products true, e.g. /brakes-and-traction-control/brake-pads or /batteries-starting-and-charging/battery) or its AutoZone link."),
      vehicle,
      sort,
      filters,
      ...priceRange,
    },
    post("category"),
  );

  server.tool(
    "get_autozone_brand",
    `One brand's products on ${NAME} (a brand page, or the brand within one part type; us): country, brand, category, path, ${LIST}. An unknown brand is a charged 404. ${PRICES} ${CREDITS}`,
    {
      brand: z.string().min(2).max(400)
        .describe("A brand slug (duralast, duralast-gold, mobil-1) or its AutoZone link (/brands/<brand> or <category>/b/brand/<brand>)."),
      category: z.string().min(2).max(400).optional()
        .describe("Optional part type path: that brand's products in that part type (e.g. /brakes-and-traction-control/brake-rotor)."),
    },
    post("brand"),
  );

  server.tool(
    "get_autozone_vehicles",
    `${NAME}'s vehicle selector, one level at a time: years, then makes for a year, models for a make, submodels and engines for a model (us; br and mx: years, makes, models). Returns country, level, year, make_id, model_id, count and years, makes [{make_id, name, popular}], models [{model_id, name, vehicle_type, popular}], submodels [{submodel_id, name, drive_type}] or engines [{engine_id, name, drive_type, region}]. Send the make and model names as vehicle to get_autozone_category. ${CREDITS}`,
    {
      level: z.enum(LEVELS).optional()
        .describe("years (default), makes (needs year), models (year + make_id), submodels and engines (year + make_id + model_id; us only)."),
      year: z.number().int().min(1900).max(2100).optional().describe("Model year, e.g. 2018."),
      make_id: z.number().int().positive().optional().describe("makes[].make_id (54 = Ford on us)."),
      model_id: z.number().int().positive().optional().describe("models[].model_id (666 = F-150 on us)."),
      country: allMarkets.describe("us (autozone.com, default), br (autozone.com.br) or mx (autozone.com.mx): years, makes and models on every market."),
    },
    post("vehicles"),
  );

  server.tool(
    "get_autozone_reviews",
    `Customer reviews of one ${NAME} product, 10 a page, full depth, sorted and filtered by stars (us only: AutoZone's Brazilian and Mexican sites show no reviews): country, id, sort, stars, page, page_size, total_reviews, total_matching (with the star filter), total_pages, has_more, average_rating, rating_distribution [{stars, count, percent}], summary (page 1 without a star filter: AutoZone's review summary {text, features [{name, mentions, positive, negative}]}, or null), count, reviews [{review_id, rating, title, text, recommends, verified_purchase, incentivized, syndicated, syndicated_from, submitted_at, vehicle (the reviewer's vehicle as written), helpful_votes, not_helpful_votes, images [{url, thumbnail_url, caption}]}]. No reviewer name or any reviewer identity is returned. ${CREDITS}`,
    {
      id: id.optional().describe("AutoZone item id (items[].id), e.g. 1399158. Send one of id or url."),
      url: z.string().min(20).max(600).optional().describe("Or the product link."),
      page: z.number().int().min(1).max(1000).optional().describe("Page (10 reviews a page); total_pages says how deep they go."),
      sort: z.enum(REVIEW_SORTS).optional().describe("default (AutoZone's order), most_recent or most_helpful."),
      stars: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional().describe("Only reviews with these star ratings, e.g. [1, 2]."),
    },
    post("reviews"),
  );

  server.tool(
    "get_autozone_stores",
    `${NAME}'s store directory in the US, Brazil or Mexico, one level at a time: no state = states [{state (the input), name, store_count, new_store}] with total_stores; state = cities [{city, city_slug (the input), store_count, new_store}]; state + city = stores [{store_number, name, slug (the input of get_autozone_store), url, address {line1, line2, city, state, postal_code, country_code}, timezone, closed, hours [{day, open, close, closed}], holiday_hours [{date, closed, open, close}]}] with total (a city page lists up to 50 stores). Phone and coordinates come with get_autozone_store. There is no stores-near-a-ZIP search. An unknown state or city is a charged 404. ${CREDITS}`,
    {
      country: allMarkets.describe("us (default), br or mx."),
      state: z.string().min(2).max(40).optional()
        .describe("A state from the states list (states[].state: tx, vt, nuevo-leon, sao-paulo): lists its cities."),
      city: z.string().min(1).max(80).optional().describe("With state: a city slug (cities[].city_slug, e.g. houston): lists its stores."),
    },
    post("stores"),
  );

  server.tool(
    "get_autozone_store",
    `One ${NAME} store by slug or link (us, br, mx): country, store_number, name, label (e.g. Barre #3470), slug, url, address, phone, toll_free_phone, latitude, longitude, timezone, closed, hours [{day, open, close, closed}], holiday_hours [{date, closed, open, close}]. A store number alone is not an input: take the slug from get_autozone_stores. An unknown store is a charged 404. ${CREDITS}`,
    {
      slug: z.string().min(5).max(300).optional().describe("A store slug (stores[].slug), e.g. vt/barre/18-overlook-dr.html. Send one of slug or url."),
      url: z.string().min(20).max(600).optional().describe("Or the store page link; the market comes from the link."),
      country: allMarkets.describe("With slug: us (default), br or mx."),
    },
    post("store"),
  );

  server.tool(
    "get_autozone_categories",
    `${NAME}'s category menu (us, br, mx; about 23 departments): country, count, node_count, categories [{name, path, page_type, child_count, children [{name, path (the input of get_autozone_category), page_type, has_products (true for part types with a product list)}]}], popular [{name, path}]. ${CREDITS}`,
    { country: allMarkets.describe("us (default), br or mx.") },
    post("categories"),
  );

  server.tool(
    "get_autozone_clearance",
    `${NAME}'s clearance list (us): country, path, ${LIST}. ${PRICES} ${CREDITS}`,
    {},
    post("clearance"),
  );

  server.tool(
    "get_autozone_rebates",
    `${NAME}'s current mail-in rebates (us): country, count, rebates [{title, end_date (last purchase day), postmark_date (last day to mail the form), form_url (the rebate form, PDF)}], as AutoZone lists them. ${CREDITS}`,
    {},
    post("rebates"),
  );

  server.tool(
    "get_autozone_store_stock",
    `One AutoZone Brazil product at a store you choose (autozone.com.br, Brazil only: AutoZone keeps a chosen store there; stock at a chosen US or Mexican store is not offered): country, requested_id, store_number, priced_for (the store AutoZone priced for: the one asked), id, part_number, name, brand, url, price, was_price, deal_price, core_charge, in_store {available, quantity}, ${AVAIL}. Portuguese text, BRL. Stock as AutoZone reports it, not a promise. If AutoZone does not apply the store the call fails unbilled. Costs 2 credits. Failed upstream calls and refused inputs are not charged; a not-found is charged.`,
    {
      id: id.optional().describe("AutoZone Brazil item id (items[].id from a br search_autozone), e.g. 100123563. Send one of id or url."),
      url: z.string().min(20).max(600).optional().describe("Or the autozone.com.br product link."),
      store_number: z.union([z.string().min(3).max(6), z.number().int().positive()])
        .describe("A Brazilian store number (stores[].store_number from get_autozone_stores with country br), e.g. 7602."),
    },
    post("store-stock"),
  );
}
