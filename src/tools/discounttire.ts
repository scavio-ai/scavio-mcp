import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/discounttire.ts (www.discounttire.com, US only, USD; one
// catalog for Discount Tire and America's Tire stores). Rules the backend enforces and zod here
// does not: search, get_discounttire_vehicle_tires, product, model, wheels and browse need store
// or zip (not both); search takes size or width + aspect_ratio + diameter; vehicle steps go
// year -> make -> vehicle_id -> trim_id -> assembly_id (assembly_id with trim_id and vehicle_id);
// store stock needs item_number or item_numbers and zip; stores takes one of zip, city or
// latitude + longitude; browse takes one of category, brand or q. No zod `.default()`: the MCP
// SDK would post a defaulted field on every call.

const SORTS = ["best_seller", "price_low", "price_high", "rating"] as const;
const VEHICLE_SORTS = ["best_seller", "price_low", "price_high", "rating", "treadwell"] as const;
const WHEEL_SORTS = ["best_seller", "price_low", "price_high"] as const;
const BROWSE_SORTS = ["best_seller", "price_low", "price_high", "rating", "relevance"] as const;
const REVIEW_SORTS = ["newest", "highest", "lowest", "most_helpful"] as const;
const STOCK_SORTS = ["distance", "availability"] as const;
const POSITIONS = ["set", "front", "rear"] as const;
const PRODUCT_TYPES = ["tires", "wheels"] as const;

const NAME =
  "Discount Tire (discounttire.com, the US tire and wheel retailer, America's Tire in parts of CA, PA, NJ and NY)";
const ONE =
  "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PER_STORE =
  "Prices, stock and promotions are per store: send store (a store code) or zip (the nearest store is used), not both; the store used is echoed in store {store_code, brand (Discount Tire or America's Tire), name, location_name, address, city, state, zip, phone, distance_miles, chosen_by}. Price can differ between stores and is not different at every store: measured 2026-11-25, Michelin Defender 2 225/65R17 (item 108547) was $206 a tire at 9 stores in 8 states and $205 at an America's Tire store in New Jersey.";
const NO_SET =
  "price is per tire or wheel: Discount Tire publishes no set-of-four price (4 x price is arithmetic, not a Discount Tire price). Promotions are Discount Tire's own title and text with its end date (ends, ISO 8601 UTC, and ends_text as given); no start date.";
const NOT_AVAILABLE =
  "Not available: the deals page text, road hazard and certificate prices, financing, installation and fee amounts, the Treadwell chat, fleet accounts, Tire Rack, price history (poll and store the answers), checkout and booking.";
const ITEM =
  "position, item_number (the input of get_discounttire_product, get_discounttire_store_stock and get_discounttire_reviews), type (tire, wheel, or model: a tire or wheel model with price_range), model_id (the input of get_discounttire_model), brand, model, name, description, size, price (per tire or wheel), price_text, price_range, markdown, map_price, map_display_rule (as given), promotions [{title, text, description, ends, ends_text, group, condition, url}], rating, review_count, recommend_count, stock {store_code, units (exact), message, available_date, days_out}, gtin, manufacturer_part_number, mileage_warranty, tier (Good / Better / Best), categories, original_equipment, image, url, category_ratings";
const LIST = `market, store, page, page_size, total, total_pages, count, sort, filters_applied, resolved_filters [{input, requested, label, filter}], items (${ITEM}), facets [{key, name, values [{label, count, filter, selected}]}] (send filter back in filters), notes`;

const usOnly = z.enum(["us"]).optional()
  .describe("us only (default: www.discounttire.com, USD). Discount Tire and America's Tire sell in the United States only.");
const storeCode = z.union([z.string().min(3).max(8), z.number().int().positive()]);
const zipCode = z.union([z.string().min(5).max(10), z.number().int().positive()]);
const itemNumber = z.union([z.string().min(3).max(12), z.number().int().positive()])
  .describe("A Discount Tire item number (items[].item_number, the number after /p/ in a discounttire.com product link; e.g. \"108547\").");
const labels = z.union([z.string().min(1).max(200), z.array(z.string().min(1).max(60)).min(1).max(5)]);
const storeOrZip = {
  store: storeCode.optional()
    .describe("A Discount Tire / America's Tire store code (stores[].store_code of get_discounttire_stores, e.g. \"1009\"). Prices, stock and promotions are this store's. Send store or zip."),
  zip: zipCode.optional()
    .describe("A US ZIP code instead of store: the nearest store in Discount Tire's store search is used (echoed in store)."),
};
const vehicleIds = {
  vehicle_id: z.union([z.string().min(1).max(12), z.number().int().positive()]).optional()
    .describe("options[].vehicle_id of get_discounttire_vehicle's models step (e.g. \"17361\", a 2022 Ford F-150)."),
  trim_id: z.union([z.string().min(1).max(12), z.number().int().positive()]).optional()
    .describe("options[].trim_id of the trims step (e.g. \"52455\", XLT Crew Cab 2WD)."),
  assembly_id: z.string().min(4).max(16).optional()
    .describe("options[].assembly_id of the assemblies step: the tire size option (e.g. \"0000E28B\", 245/70R17)."),
};
const listShape = {
  page: z.number().int().min(1).max(500).optional().describe("Page (1-500)."),
  page_size: z.number().int().min(1).max(100).optional().describe("Items per page (1-100, default 20)."),
  filters: z.array(z.string().min(3).max(80)).min(1).max(10).optional()
    .describe("Up to 10 filter tokens exactly as an earlier answer gives them in facets[].values[].filter (brand, category, speed rating, load range, sidewall, Good / Better / Best, ...; e.g. \"brands:brand-MCH\"); several are combined."),
  brand: labels.optional()
    .describe("Brand name(s) as Discount Tire writes them (its Brands facet, e.g. Michelin); resolved against the listing's own facet (resolved_filters)."),
  min_price: z.number().min(0).optional().describe("Lowest price per tire or wheel (USD) at the store."),
  max_price: z.number().min(0).optional().describe("Highest price per tire or wheel (USD) at the store."),
  instant_savings: z.boolean().optional().describe("Only items with an instant saving (Discount Tire's Instant Savings filter)."),
  in_stock: z.boolean().optional().describe("Only items in stock at the store (Discount Tire's In Stock filter)."),
};
const tireFilters = {
  sort: z.enum(SORTS).optional()
    .describe("best_seller (default), price_low, price_high or rating: Discount Tire's sort menu."),
  category: labels.optional()
    .describe("Tire category as Discount Tire writes it (its Tire Category facet, e.g. All-Season Tires, Snow/Winter Tires; or its code, e.g. winterTires)."),
  speed_rating: labels.optional().describe("Speed rating letter(s) (e.g. H, V), matched to Discount Tire's Speed Rating facet."),
  mileage_warranty: labels.optional().describe("A Mileage Warranty facet label as Discount Tire writes it (e.g. 60,000-70,000)."),
  load_range: z.string().min(1).max(4).optional().describe("Load range (SL, XL, C, D, E, ...)."),
  three_peak: z.boolean().optional().describe("Only tires with the Three-Peak Mountain Snowflake mark."),
  run_flat: z.boolean().optional().describe("Only run-flat tires."),
  rebates: z.boolean().optional().describe("Only tires with a rebate (Discount Tire's Rebates filter)."),
};
const reviewFilters = {
  sort: z.enum(REVIEW_SORTS).optional().describe("newest (default), highest, lowest or most_helpful."),
  rating: z.number().int().min(1).max(5).optional().describe("Only reviews with this star rating (1-5)."),
};

export function registerDiscountTireTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/discounttire/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_discounttire",
    `Tires in one size at one ${NAME} store: size (225/65R17, LT265/70R17, 35x12.50R20) or width + aspect_ratio + diameter, optional rear_size for staggered front / rear pairs, sorted (best_seller, price_low, price_high, rating), filtered (brand, category, speed rating, load range, Three-Peak snowflake, run flat, rebates, instant savings, in stock, price, mileage warranty, any facet) and paged (20 a page by default, up to 100). Returns size, rear_size, ${LIST}. ${PER_STORE} ${NO_SET} ${NOT_AVAILABLE} ${ONE}`,
    {
      size: z.string().min(5).max(30).optional()
        .describe("Tire size (225/65R17, LT265/70R17, 35x12.50R20), or width + aspect_ratio + diameter."),
      width: z.union([z.string(), z.number()]).optional().describe("Section width (e.g. 225), with aspect_ratio and diameter."),
      aspect_ratio: z.union([z.string(), z.number()]).optional().describe("Aspect ratio (e.g. 65)."),
      diameter: z.union([z.string(), z.number()]).optional().describe("Rim diameter in inches (e.g. 17)."),
      rear_size: z.string().min(5).max(30).optional()
        .describe("Rear size for a staggered pair (front size + rear size, e.g. 305/30R20): items become front / rear pairs."),
      ...storeOrZip,
      ...listShape,
      ...tireFilters,
      country: usOnly,
    },
    post("search"),
  );

  server.tool(
    "get_discounttire_vehicle",
    `${NAME}'s vehicle selector, one step per call: market, step, count, options, next (what to send next). No input -> years (options [{year}]); year -> makes ([{make}]); year + make -> models ([{vehicle_id, model}]); vehicle_id -> trims ([{trim_id, trim}]); vehicle_id + trim_id -> assemblies, the tire size options ([{assembly_id, description, staggered, front_size, rear_size}]); vehicle_id + trim_id + assembly_id -> fitment {vehicle {vehicle_id, year, make, model, type, image}, trim {trim_id, name, category}, assembly_id, front_size, rear_size, staggered, front_wheel_diameter, rear_wheel_diameter, ride_height, drive, lug_torque (as given, no unit), optional_sizes [{wheel_diameter, axle, sizes [{size, fit (match, oversize or undersize)}]}], optional_staggered_sets}, notes. Captured 2026-11-25: 2022 Ford F-150 (vehicle_id 17361) XLT Crew Cab 2WD (trim_id 52455) had 3 size options; assembly 0000E28B is 245/70R17 front and rear on 17-inch wheels. get_discounttire_vehicle_tires and get_discounttire_wheels take the same three ids. ${ONE}`,
    {
      year: z.union([z.number().int(), z.string().min(4).max(4)]).optional().describe("Model year (e.g. 2022): its makes (with make: its models)."),
      make: z.string().min(1).max(60).optional().describe("A make as Discount Tire writes it (options[].make of the makes step, e.g. Ford), with year."),
      ...vehicleIds,
      country: usOnly,
    },
    post("vehicle"),
  );

  server.tool(
    "get_discounttire_vehicle_tires",
    `The tires ${NAME} lists for one vehicle fitment (vehicle_id + trim_id + assembly_id from get_discounttire_vehicle) at one store, sorted, filtered and paged like search_discounttire, with the vehicle maker's original-equipment tire flagged (original_equipment). Staggered vehicles (different front and rear sizes): position set (default) returns front / rear pairs [{position, pair, front, rear, url, price_note}], each tire with its own per-tire price (a staggered set is 2 front + 2 rear); front or rear lists one axle. ranking treadwell adds treadwell {rank, mileage {min, median, max, warranty}, miles_per_dollar, tire_life, ride_ratings, stopping, winter}: Discount Tire's Treadwell ranking fields as given, Discount Tire's own estimates, not measurements (sort treadwell is its default there). Returns vehicle, staggered, position, ranking, ${LIST}. Captured 2026-11-25: 157 tires for the 2022 F-150 XLT (245/70R17) at store 1009; 93 front / rear sets for a 2022 Corvette Stingray (245/35R19 front, 305/30R20 rear). ${PER_STORE} ${NO_SET} ${ONE}`,
    {
      ...vehicleIds,
      position: z.enum(POSITIONS).optional()
        .describe("Staggered vehicles only: set (default: front / rear pairs), front or rear."),
      ranking: z.enum(["all", "treadwell"]).optional()
        .describe("all (default) or treadwell: Discount Tire's Treadwell ranking with its own mileage, ride and stopping estimates."),
      ...storeOrZip,
      ...listShape,
      ...tireFilters,
      sort: z.enum(VEHICLE_SORTS).optional()
        .describe("best_seller (default), price_low, price_high, rating; with ranking treadwell also treadwell (its default: Treadwell rank)."),
      country: usOnly,
    },
    post("vehicle-tires"),
  );

  server.tool(
    "get_discounttire_product",
    `One ${NAME} tire or wheel by item number at one store: everything in search_discounttire's items plus tire {load_index, load_index_speed, speed_rating, load_range, utqg {treadwear, traction, temperature}, tread_depth, max_pressure, overall_diameter, section_width, aspect_ratio, rim_diameter, rim_width_range, sidewall, run_flat} or wheel {diameter, width, bolt_pattern, bolts, offset, hub_bore, finish, color, load_capacity}, weight, faqs, long_description, images, nearby_store_stock, no_longer_available, notes (tire and wheel fields as given; several carry no unit). Captured 2026-11-25: item 108547, Michelin Defender 2 225/65R17 102H, $206.00 a tire at store 1009 (Scottsdale, AZ), 25 units there, GTIN 086699082183, promotion "$110 OFF a set of 4!" ending 2026-12-04T07:59:00Z. ${PER_STORE} ${NO_SET} An unknown item is a charged 404. ${ONE}`,
    {
      item_number: itemNumber,
      nearby_stores: z.array(storeCode).min(1).max(10).optional()
        .describe("Optional store codes Discount Tire checks for a nearby store with stock (nearby_store_stock)."),
      ...storeOrZip,
      country: usOnly,
    },
    post("product"),
  );

  server.tool(
    "get_discounttire_model",
    `Every size of one ${NAME} tire or wheel model at one store: market, store, requested_model_id, product_type, model_id, brand, model, name, type, rating, review_count, price_range {min, max}, promotions, tier, categories, item_count, items [{item_number, price}], size_options [{key, options}], spec_ranges, default_item, long_description, image, url, notes. Captured 2026-11-25: michelin-defender-2 had 60 sizes at store 1009, $180 to $327 a tire. ${PER_STORE} ${NO_SET} An unknown model is a charged 404. ${ONE}`,
    {
      model_id: z.string().min(2).max(300)
        .describe("A model id (items[].model_id, e.g. michelin-defender-2) or a discounttire.com /buy-tires/ or /buy-wheels/ link."),
      type: z.enum(PRODUCT_TYPES).optional().describe("tires or wheels (default: from the link, else tires then wheels)."),
      ...storeOrZip,
      country: usOnly,
    },
    post("model"),
  );

  server.tool(
    "get_discounttire_store_stock",
    `Exact units of 1-4 ${NAME} items at the stores near a US ZIP (radius 10, 25 (default), 50, 75 or 150 miles, sorted by distance or availability, 5 stores per page): market, item_numbers, quantity, zip, radius_miles, sort, page, page_size, total, total_pages, count, my_store, stores [{store_code, brand, name, address, phone, latitude, longitude, distance_miles, stock [{item_number, units, message}]}], notes. units is the exact count Discount Tire reports; message is its availability text as given for the quantity asked, and a store with 0 units can still say "Available as soon as <date>". Captured 2026-11-25: item 108547 near ZIP 85251 had 47 stores within 25 miles; store 1022 (Scottsdale, 3.81 miles) had 38 units. ${ONE}`,
    {
      item_number: itemNumber.optional(),
      item_numbers: z.array(z.union([z.string().min(3).max(12), z.number().int().positive()])).min(1).max(4).optional()
        .describe("Up to 4 item numbers checked together (e.g. a staggered front and rear). Send item_number or item_numbers."),
      zip: zipCode.describe("US ZIP code (e.g. \"85251\"): the stores near it. Required."),
      radius: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(75), z.literal(150)]).optional()
        .describe("Miles: 10, 25 (default), 50, 75 or 150."),
      sort: z.enum(STOCK_SORTS).optional().describe("distance (default) or availability."),
      page: z.number().int().min(1).max(100).optional().describe("Page (5 stores per page)."),
      quantity: z.number().int().min(1).max(8).optional()
        .describe("How many of each item (1-8, default 4): Discount Tire's availability text is written for this quantity."),
      store: storeCode.optional().describe("Optional: your store; its units come back in my_store."),
      country: usOnly,
    },
    post("store-stock"),
  );

  server.tool(
    "get_discounttire_stores",
    `${NAME} stores near a US ZIP, city or point (10 per page, nearest first): market, location, radius_miles, page, page_size, total, total_pages, count, stores [{position, store_code (the store input of the price tools), brand (Discount Tire or America's Tire), name, location_name, legacy_code, address {line1, line2, city, state, zip, country}, phone, latitude, longitude, distance_miles, rating, review_count, services}], notes. Send one of zip, city or latitude + longitude. ${ONE}`,
    {
      zip: zipCode.optional().describe("A US ZIP code (e.g. \"85251\")."),
      city: z.string().min(2).max(80).optional().describe('A US city, e.g. "Phoenix, AZ".'),
      latitude: z.number().optional().describe("Latitude, with longitude: a point in the United States."),
      longitude: z.number().optional().describe("Longitude, with latitude."),
      radius: z.number().int().min(1).max(150).optional().describe("Miles (Discount Tire's default when omitted)."),
      page: z.number().int().min(1).max(50).optional().describe("Page (10 stores per page)."),
      country: usOnly,
    },
    post("stores"),
  );

  server.tool(
    "get_discounttire_store",
    `One ${NAME} store by store code: market, store_code, brand, name, location_name, legacy_code, address, phone, latitude, longitude, rating, review_count, services, cleanliness_rating, knowledge_rating, recommended_count, recommended_percent, rating_breakdown, hours [{date, open, close, closed, note, holiday}] (the coming week, dated), store_services, features, images, nearby_stores, current_time, notes. No staff names. An unknown store is a charged 404. ${ONE}`,
    {
      store_code: storeCode.describe("A store code (stores[].store_code, e.g. \"1009\")."),
      country: usOnly,
    },
    post("store"),
  );

  server.tool(
    "get_discounttire_reviews",
    `${NAME}'s own reviews of a tire: the whole model (scope model, default) or this size (scope size), sorted (newest, highest, lowest, most_helpful), one star rating, paged (10 a page by default, up to 100): market, item_number, scope, sort, rating_filter, rating, review_count, recommend_count, rating_breakdown, page, page_size, total, total_pages, count, reviews [{id, rating, text, date, recommended, helpful_votes, unhelpful_votes, category_ratings {tread_life, wet_traction, dry_traction, cornering_steering, ride_noise, ride_comfort, winter_weather}, pros, cons, state, vehicle}], notes. No reviewer names or cities. Captured 2026-11-25: item 108547 (Michelin Defender 2), 4.8 stars, 11,578 reviews of the model. ${ONE}`,
    {
      item_number: itemNumber,
      scope: z.enum(["model", "size"]).optional()
        .describe("model (default: every size of the tire model) or size (this item only)."),
      ...reviewFilters,
      page: z.number().int().min(1).max(5000).optional().describe("Page (1-5000)."),
      page_size: z.number().int().min(1).max(100).optional().describe("Reviews per page (1-100, default 10)."),
      country: usOnly,
    },
    post("reviews"),
  );

  server.tool(
    "get_discounttire_store_reviews",
    `${NAME}'s own reviews of one store (5 per page), sorted (newest, highest, lowest, most_helpful), one star rating: market, store_code, sort, rating_filter, rating_breakdown, page, page_size, total, total_pages, count, reviews [{id, rating, text, date, recommended, helpful_votes, unhelpful_votes, category_ratings {overall, cleanliness, knowledge}}], notes. No reviewer names. An unknown store is a charged 404. ${ONE}`,
    {
      store_code: storeCode.describe("A store code (stores[].store_code, e.g. \"1009\")."),
      ...reviewFilters,
      page: z.number().int().min(1).max(2000).optional().describe("Page (5 reviews per page)."),
      country: usOnly,
    },
    post("store-reviews"),
  );

  server.tool(
    "get_discounttire_wheels",
    `${NAME} wheels by size (diameter + width + bolt_pattern) or that fit a vehicle (vehicle_id + trim_id + assembly_id from get_discounttire_vehicle), at one store, sorted (best_seller, price_low, price_high), filtered (brand, category, color, special offers, instant savings, in stock, price, any facet) and paged. Returns diameter, width, bolt_pattern, ${LIST}. Items can be wheel models with a price_range at the store. ${PER_STORE} ${ONE}`,
    {
      diameter: z.union([z.string(), z.number()]).optional()
        .describe("Wheel diameter in inches (e.g. 20; with width for wheels by size; with a vehicle: another diameter than the vehicle's)."),
      width: z.union([z.string(), z.number()]).optional().describe("Wheel width in inches (e.g. 9)."),
      bolt_pattern: z.string().min(3).max(12).optional()
        .describe("Bolt pattern (required with diameter + width): lugs and bolt circle in mm (6-135, 6x139.7) or inches (5x4.5)."),
      ...vehicleIds,
      sort: z.enum(WHEEL_SORTS).optional().describe("best_seller (default), price_low or price_high."),
      category: labels.optional().describe("Wheel category as Discount Tire writes it (its Wheel Category facet, e.g. Chrome Wheels)."),
      color: labels.optional().describe("Wheel color as Discount Tire writes it (its Wheel Color facet, e.g. Black)."),
      special_offers: z.boolean().optional().describe("Only wheels with a special offer."),
      ...storeOrZip,
      ...listShape,
      country: usOnly,
    },
    post("wheels"),
  );

  server.tool(
    "get_discounttire_browse",
    `${NAME} tire models in one category (categories[].slug of get_discounttire_categories), of one tire brand, or matching keywords (q), at one store: market, store, category, brand, q, product_type, page, page_size, total, total_pages, count, sort, items (model level: model_id, brand, model, price_range at the store, rating, promotions), facets, notes. Send one of category, brand or q. Captured 2026-11-25: all-season-tires had 617 models at store 1009. ${PER_STORE} An unknown category or brand is a charged 404. ${ONE}`,
    {
      category: z.string().min(2).max(80).optional().describe("A category slug from get_discounttire_categories (categories[].slug, e.g. all-season-tires)."),
      brand: z.string().min(1).max(60).optional().describe("A tire brand (e.g. Michelin): its models."),
      q: z.string().min(2).max(100).optional().describe("Keywords (e.g. michelin defender)."),
      type: z.enum(["tires"]).optional().describe("tires (default and only: for wheels use get_discounttire_wheels)."),
      sort: z.enum(BROWSE_SORTS).optional()
        .describe("best_seller (default; relevance with q), price_low, price_high, rating or relevance."),
      page: listShape.page,
      page_size: listShape.page_size,
      ...storeOrZip,
      country: usOnly,
    },
    post("browse"),
  );

  server.tool(
    "get_discounttire_categories",
    `${NAME}'s tire or wheel types: market, type, count, categories [{code, name (the category filter of search_discounttire, get_discounttire_vehicle_tires and get_discounttire_wheels), slug (the category input of get_discounttire_browse, tires), description, groups, url, image}], notes. ${ONE}`,
    {
      type: z.enum(PRODUCT_TYPES).optional().describe("tires (default) or wheels."),
      country: usOnly,
    },
    post("categories"),
  );

  server.tool(
    "get_discounttire_suggestions",
    `What ${NAME}'s search box suggests for a few letters: market, q, products [{model_id, item_number, brand, model, description, type, url, image}], categories [{code, name, count}], notes. No prices. ${ONE}`,
    {
      q: z.string().min(3).max(80).describe("What a shopper types (3 characters or more, e.g. michelin)."),
      country: usOnly,
    },
    post("suggestions"),
  );

  server.tool(
    "get_discounttire_appointments",
    `The service-appointment calendar of one ${NAME} store as Discount Tire's appointment page shows it, read only (Scavio never books): market, store_code, month, count, days [{date, day_of_week, bookable, message, holiday, opens, closes, slot_count, slots [{start, end}] (the store's local time, YYYY-MM-DDTHH:MM, no time zone)}], notes; opens and closes are the store's hours as given. ${ONE}`,
    {
      store_code: storeCode.describe("A store code (stores[].store_code, e.g. \"1009\")."),
      month: z.number().int().min(1).max(12).optional().describe("Month number (default: the current month)."),
      country: usOnly,
    },
    post("appointments"),
  );
}
