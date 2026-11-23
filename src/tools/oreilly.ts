import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/oreilly.ts (oreillyauto.com every tool; O'Reilly's
// Mexican store directory on stores and store only). Cross-field rules the backend
// enforces and zod here does not: product takes url or line_code + part_number;
// store-stock and stores (near) take zip or latitude + longitude; stores by directory
// takes state (+ city); store takes store_id (us), url, or store_number + state + city
// (mx); vehicles makes need year, models year + make_id, submodels + model_id, engines
// + submodel_id, resolve year + make_id + model_id, vin a 17-character VIN. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_desc", "price_asc", "best_selling", "brand"] as const;
const AVAILABILITY = ["store_pickup", "home_delivery"] as const;
const LEVELS = ["types", "years", "makes", "models", "submodels", "engines", "resolve", "vin"] as const;
const MX_STATES = ["agu", "bcs", "col", "gua", "jal", "mic", "nay", "sin", "son"] as const;

const NAME = "O'Reilly Auto Parts (oreillyauto.com, the US auto parts retailer)";
const CREDITS = "Costs 2 credits. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const CHARGES = "Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Prices are as O'Reilly shows them for the store it assigns to the request: every answer names that store in priced_for {store_id, address, city, state, zip}. O'Reilly prices differ by store and there is no store or ZIP input for prices, so two calls can be priced for different stores; never report a price as national. Availability is as O'Reilly reports it, not a promise.";
const NOT_AVAILABLE =
  "Not available: unit counts in store stock, a chosen store for prices, reviews past the 10 most recent, Q&A, Mexico prices or catalog, Canada, license-plate lookup, the weekly ad, repair guides or trouble codes, O'Reilly Pro / First Call Online commercial pricing, price history (poll and store the answers), checkout.";
const AVAIL =
  "availability {store_pickup, in_store_now, pickup_time (O'Reilly's words, e.g. 8:30 AM today), ship_to_home, two_day, three_day, special_order, free_shipping, ship_to_home_blocked, store_pickup_blocked, store_restricted, air_shipping_restricted}";
const PRICE =
  "price, regular_price, sale_price, on_sale, sale_type, discount_percent (computed by Scavio from regular_price when on sale), clearance, core_charge (the refundable core deposit O'Reilly adds on parts like batteries until the old part is returned; 0 when none), oil_fee, oil_deposit, currency";
const ITEM = `position, product_id, line_code, part_number (line_code + part_number are the inputs of get_oreilly_product, get_oreilly_compatibility and get_oreilly_store_stock), name, brand (from the Brands facet; null when none), url, image, category, ${PRICE}, unit_of_measure, warranty, fit (as O'Reilly gives it: UNKNOWN, UNIVERSAL, ...), fit_notes [{name, description}] (for the requested vehicle), ${AVAIL}, deals [{title, description, ends, terms}], attributes [{name, value}]. List items carry no rating (get_oreilly_product has it)`;
const FACETS = "facets [{name, param (the key to send in filters; Brands -> brand, Availability -> availability), values [{label, value (the value to send), url}]}]";
const LIST = `priced_for, vehicle_requested, vehicle {base_vehicle_id, year, make, model} (as O'Reilly applied it), title, total (as O'Reilly reports it), page, page_size (24), total_pages, max_page (O'Reilly serves at most 20 pages), count, sort, sort_applied, brand, availability, filters, items (${ITEM}), ${FACETS}, notes. A page O'Reilly shows as a landing (no product list) answers items [] with links [{name, url}] to its product lists`;

const page = z.number().int().min(1).max(20).optional()
  .describe("Page (1-20, 24 items a page). O'Reilly serves the first 20 pages of a list; a page above 20 is a 400, not charged.");
const sort = z.enum(SORTS).optional()
  .describe("relevance (default, O'Reilly's order), price_desc, price_asc, best_selling or brand (A-Z).");
const brand = z.string().min(1).max(120).optional()
  .describe("A brand as the Brands facet gives it (facets[].values[].value where facets[].param is Brands, e.g. Wagner_OEX).");
const availability = z.enum(AVAILABILITY).optional()
  .describe("store_pickup (Pick Up in Store) or home_delivery (Ship to Home), as O'Reilly filters them.");
const filters = z.record(z.string(), z.union([z.string().min(1).max(120), z.number()])).optional()
  .describe('Up to 4 attribute facets: { "<facets[].param>": "<facets[].values[].value>" } (e.g. Position or Brake Pad Material).');
const vehicle = z.object({
  base_vehicle_id: z.union([z.number().int().positive(), z.string().min(1).max(10)]),
  slug: z.string().min(1).max(120).optional(),
}).optional()
  .describe("Only parts for this vehicle: { base_vehicle_id } from get_oreilly_vehicles with level resolve (129927 = 2015 Ford F-150). O'Reilly pins year, make and model with it; submodel and engine show in fit_notes.");
const lineCode = z.string().min(1).max(8).describe("O'Reilly line code (items[].line_code, e.g. BB, MOB, WIX).");
const partNumber = z.string().min(1).max(40).describe("Part number as O'Reilly lists it (items[].part_number, e.g. SC1001).");
const zip = z.string().min(5).max(10).optional()
  .describe("A 5-digit US ZIP (looked up on O'Reilly's store finder: 4 credits in all). Send zip or latitude + longitude.");
const latitude = z.number().min(-90).max(90).optional().describe("Latitude (with longitude): 2 credits.");
const longitude = z.number().min(-180).max(180).optional().describe("Longitude (with latitude).");
const usMx = z.enum(["us", "mx"]).optional()
  .describe("us (default) or mx (O'Reilly's Mexican store directory, in Spanish; Mexico shows no prices).");
const listShape = { page, sort, brand, availability, filters, vehicle };

export function registerOreillyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/oreilly/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_oreilly",
    `Search ${NAME} by keywords or an O'Reilly part number, sorted (relevance, price, best selling, brand), filtered (brand, store pickup / ship to home, attribute facets) and optionally only parts for a vehicle: country, language, currency, query, redirected_to (the category O'Reilly sends the search to, if any), ${LIST}. A part-number search is O'Reilly's text match: to map another brand's or an OE part number to O'Reilly's parts use get_oreilly_cross_reference. ${PRICES} ${NOT_AVAILABLE} ${CREDITS}`,
    {
      query: z.string().min(1).max(200)
        .describe("Keywords (brake pads) or an O'Reilly part number (SC1001)."),
      ...listShape,
    },
    post("search"),
  );

  server.tool(
    "get_oreilly_cross_reference",
    `${NAME}'s parts that replace another brand's or an OE part number (O'Reilly's own interchange; e.g. FRAM PH3614): part_number, part_types [{id, name}], part_type_id, manufacturers [{id, name}] (the brands that use this number, in O'Reilly's order), manufacturer, replacing_brands, priced_for, total, page, page_size, total_pages, count, items (the search_oreilly item shape), facets, notes. With part_type_id and manufacturer: 1 call, 2 credits. With one of them, or when several manufacturers use the number and none is sent: 4 credits, and the several-manufacturers case answers the lists with no items (send manufacturer next: their cross-references differ). With neither and one manufacturer matching: 6 credits (the first-listed part type is used and named in notes). No replacement is an empty list (charged). ${PRICES} ${CHARGES}`,
    {
      part_number: z.string().min(1).max(40)
        .describe("Another brand's or an OE part number (e.g. FRAM PH3614, Motorcraft FL820S)."),
      part_type_id: z.string().min(1).max(12).optional()
        .describe("part_types[].id from an earlier answer (e.g. 02269; saves a call)."),
      manufacturer: z.string().min(1).max(80).optional()
        .describe("The brand whose part number this is (manufacturers[].id from an earlier answer, e.g. FRAM). With part_type_id too: 2 credits."),
      page,
    },
    post("cross-reference"),
  );

  server.tool(
    "get_oreilly_product",
    `One ${NAME} product in full by link (2 credits) or by line_code + part_number (found through O'Reilly's search first: 4 credits), optionally checked against a vehicle: country, requested, priced_for, line_code, part_number, name, brand, url, upc, unit_of_measure, category, part_type_id, universal, ${PRICE}, warranty, ${AVAIL}, stock_status, deals [{title, description, ends, terms}], rebates [{heading, title, description}], description, specifications [{name, value}], image, images, documents [{name, url}], breadcrumbs [{name, url}], rating {average, count}, reviews (the 10 most recent O'Reilly shows: [{date, title, text, rating}]; no paging, sort or star filter; no reviewer identity), and with vehicle: vehicle_requested, vehicle, vehicle_fit {fits, universal, notes [{name, description, per_vehicle_quantity}], documents}. fits is true when O'Reilly gives the part's application for that vehicle and null when the page gives no fit details; it is never false, so for "does it fit" use search_oreilly or get_oreilly_category with vehicle, or get_oreilly_compatibility. A product O'Reilly does not list is a charged 404. ${PRICES} ${CHARGES}`,
    {
      url: z.string().min(20).max(600).optional()
        .describe("An O'Reilly product link (items[].url): 2 credits. Send url or line_code + part_number."),
      line_code: lineCode.optional(),
      part_number: partNumber.optional(),
      vehicle,
    },
    post("product"),
  );

  server.tool(
    "get_oreilly_vehicles",
    `${NAME}'s vehicle selector one level at a time: types [{id, name}], years, makes / models / submodels / engines [{id, name}] (with country, level, type_id, year, make_id, model_id, submodel_id, count). Level resolve returns vehicle {base_vehicle_id, vehicle_id, type, subtype, year, make_id, make, model_id, model, submodel_id, submodel, engine_id, engine, slug, path}: send { base_vehicle_id } as vehicle to search_oreilly, get_oreilly_category, get_oreilly_brand and get_oreilly_product. Level vin decodes a 17-character VIN to vehicle {year, make_id, make, model_id, model, submodels [{id, name}], engines [{id, name}]} (an undecodable VIN is a charged 404). ${CREDITS}`,
    {
      level: z.enum(LEVELS).optional()
        .describe("types, years (default), makes (year), models (year + make_id), submodels (+ model_id), engines (+ submodel_id), resolve (year + make_id + model_id, optional submodel_id / engine_id: the base_vehicle_id) or vin (decode a 17-character VIN)."),
      type_id: z.number().int().min(1).max(99).optional()
        .describe("Vehicle type (types[].id): 1 Automotive (default), 2 Motorcycle & Scooter, 3 ATV & UTV, 4 Personal Watercraft, 5 Snowmobile."),
      year: z.number().int().min(1896).max(2100).optional().describe("Model year, e.g. 2015."),
      make_id: z.number().int().positive().optional().describe("makes[].id (23076 = Ford)."),
      model_id: z.number().int().positive().optional().describe("models[].id (31549 = F-150)."),
      submodel_id: z.number().int().positive().optional().describe("submodels[].id."),
      engine_id: z.number().int().positive().optional().describe("engines[].id (resolve only)."),
      vin: z.string().min(17).max(17).optional().describe("A 17-character VIN (level vin)."),
    },
    post("vehicles"),
  );

  server.tool(
    "get_oreilly_compatibility",
    `The vehicles one ${NAME} part fits: without make, makes (the makes it fits); with make, models [{model, engine, years}] as O'Reilly lists them. Returns country, line_code, part_number, make, count. ${CREDITS}`,
    {
      line_code: lineCode,
      part_number: partNumber,
      make: z.string().min(1).max(60).optional()
        .describe("A make from makes (e.g. Ford): the models, engines and years the part fits."),
    },
    post("compatibility"),
  );

  server.tool(
    "get_oreilly_category",
    `One ${NAME} category's products by link or path, sorted, filtered and optionally only parts for a vehicle: country, category, url, ${LIST}. A wrong category hash is a charged 404. ${PRICES} ${CREDITS}`,
    {
      category: z.string().min(10).max(500)
        .describe("A category link or path (get_oreilly_categories categories[].url, or a facet / landing link): /shop/b/<name>/<12-character hash>, e.g. /shop/b/brakes/brake-pads---shoes/brake-pads/a99314144bb6."),
      ...listShape,
    },
    post("category"),
  );

  server.tool(
    "get_oreilly_categories",
    `${NAME}'s category tree (about 34 departments, 1,300 nodes): country, root, count, node_count, categories [{hash, name, url (the input of get_oreilly_category), requires_vehicle, children [...]}], featured [{hash, name, url}]. With root: that branch only (an unknown hash is a charged 404). ${CREDITS}`,
    {
      root: z.string().min(12).max(12).optional()
        .describe("A category hash (categories[].hash): only that branch."),
    },
    post("categories"),
  );

  server.tool(
    "get_oreilly_brand",
    `One brand's products on ${NAME} by brand link or path (2 credits), sorted, filtered and optionally only parts for a vehicle: country, brand_path, url, ${LIST}. Without brand: O'Reilly's brand index (4 credits): count, brands [{name, url}], top_brands and featured_brands [{name, url, image}]. An unknown brand is a charged 404. ${PRICES} ${CHARGES}`,
    {
      brand: z.string().min(10).max(400).optional()
        .describe("A brand link or path (brands[].url: /shop/brands/a/<brand>/<code>, e.g. https://www.oreillyauto.com/shop/brands/a/3m/mmm). Without it: the brand index (4 credits)."),
      page,
      sort,
      availability,
      filters,
      vehicle,
    },
    post("brand"),
  );

  server.tool(
    "get_oreilly_store_stock",
    `Which ${NAME} stores within 50 miles of a ZIP (4 credits) or a point (2 credits) can hand over one part, as O'Reilly reports it: country, line_code, part_number, quantity, zip, latitude, longitude, radius_miles, count, stores [{store_id, address {line1, city, state, zip}, latitude, longitude, distance_miles (computed by Scavio from the requested point), hours_message, closed_all_week, availability {store_pickup, in_store_now, pickup_time (O'Reilly's words), message_hidden}}], notes. O'Reilly shows availability states, not unit counts. Stock is as O'Reilly reports it, not a promise. ${CHARGES}`,
    {
      line_code: lineCode,
      part_number: partNumber,
      zip,
      latitude,
      longitude,
      quantity: z.number().int().min(1).max(99).optional().describe("Quantity to check (default 1)."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_oreilly_stores",
    `${NAME} stores: us near a ZIP (4 credits) or a point (2 credits): the 25 nearest within 50 miles, stores [{store_id (the input of get_oreilly_store), phone, address {line1, line2, city, county, state, zip, zip4, country}, latitude, longitude, distance_miles, open_now, hours_message, closed_all_week, pickup_opens, hours [{day, open, close, closed, adjustment (holiday)}], services {hydraulic_hoses, paint_mixing, machine_shop}}]; or the store directory by state (us or mx, 2 credits): cities [{city, city_slug, store_count, store_number (cities with one store), url}] with total_stores, and by state + city: stores [{store_number, name, address, city_state, phone, services, url (the input of get_oreilly_store)}]. mx lists O'Reilly's Mexican stores in Spanish (states ${MX_STATES.join(", ")}). An unknown state or city is a charged 404. ${CHARGES}`,
    {
      zip,
      latitude,
      longitude,
      state: z.string().min(2).max(10).optional()
        .describe(`The store directory by state: a US state code (mo, tx, pr), or on mx one of ${MX_STATES.join(", ")}.`),
      city: z.string().min(1).max(80).optional()
        .describe("With state: a city (cities[].city_slug or its name, e.g. springfield): that city's stores."),
      country: usMx,
    },
    post("stores"),
  );

  server.tool(
    "get_oreilly_store",
    `One ${NAME} store: us by store_id (country, store_id, phone, address, latitude, longitude, open_now, hours_message, pickup_opens, hours [{day, open, close, closed, adjustment}], services); or by its directory page url (us or mx) or on mx by store_number + state + city: store_number, name, url, phone, address {street, city, region, zip, country}, latitude, longitude, opening_hours, hours [{day, open, close}], services (as the page lists them; Spanish on mx). An unknown store is a charged 404. ${CREDITS}`,
    {
      store_id: z.union([z.string().min(1).max(6), z.number().int().positive()]).optional()
        .describe("us: an O'Reilly store number (stores[].store_id), e.g. 4973."),
      url: z.string().min(30).max(300).optional()
        .describe("A store page link from the directory (stores[].url, https://locations.oreillyauto.com/...): us or mx."),
      store_number: z.union([z.string().min(1).max(6), z.number().int().positive()]).optional()
        .describe("mx: the store number, with state and city."),
      state: z.string().min(2).max(10).optional().describe("mx: the state code (with store_number and city)."),
      city: z.string().min(1).max(80).optional().describe("mx: the city (cities[].city_slug)."),
      country: usMx,
    },
    post("store"),
  );

  server.tool(
    "get_oreilly_suggestions",
    `${NAME}'s search suggestions for typed text: country, query, count, suggestions [{name, type (part_type), url (the category it opens: the input of get_oreilly_category)}]. ${CREDITS}`,
    {
      query: z.string().min(2).max(100).describe("Text a shopper types, e.g. brake."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_oreilly_rebates",
    `${NAME}'s current rebates (the rebate center): country, count, rebates [{title, details, valid_text, valid_from, valid_to (read by Scavio from valid_text), postmark_by, keywords, categories, terms_url, form_url (PDF), redeem_online_url}], as O'Reilly lists them. ${CREDITS}`,
    {},
    post("rebates"),
  );

  server.tool(
    "get_oreilly_deals",
    `${NAME}'s coupons, offers and promotions page plus its deals menu: country, count, offers [{section, title, code (a promo code the offer text names), validity_text, details, url, image, image_text}], highlights [{title, description, url}], by_category [{title, url}]. Titles, details and validity are O'Reilly's free text. Costs 4 credits. Failed upstream calls and refused inputs are not charged.`,
    {},
    post("deals"),
  );
}
