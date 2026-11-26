import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/carmax.ts (US only, USD, no country). Rules the backend
// enforces and zod here does not: search and store-inventory need zip; model needs make;
// keyword is not combined with make / model; radius applies to search only (store-inventory
// refuses it); page x page_size must stay within the first 10,000 cars; *_min <= *_max;
// listing and photos take one of stock_number or url; stores takes one of zip, state or city.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["best_match", "distance", "price_asc", "price_desc", "mileage_asc", "mileage_desc", "year_desc", "year_asc"] as const;
const RADII = ["5", "25", "50", "75", "100", "250", "500", "nationwide"] as const;
const REVIEW_SORTS = ["most_helpful", "newest", "oldest", "highest_rating", "lowest_rating"] as const;
const SHIPPING_FEES = [0, 99, 199, 299, 399, 499, 999] as const;
const MAX_YEAR = new Date().getUTCFullYear() + 2;

const FIRST = "CarMax (carmax.com, the largest US used-car retailer, with 263 stores in 42 states and no-haggle prices)";
const NAME = "CarMax";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_VIN = "No VIN is returned.";
const CAR =
  "stock_number (the input of get_carmax_listing and get_carmax_photos), url, year, make, model, trim, body, price (CarMax's no-haggle price, USD), original_price and price_drop (as CarMax gives them), currency, mileage, exterior_color, interior_color, transmission, drivetrain, engine_type, engine_size, cylinders, horsepower, mpg_city, mpg_highway, battery_range_miles, vehicle_size, vehicle_types, features, highlighted_features, packages, feature_score, prior_uses, store {id, name, city, state}, distance_miles (from zip), shipping {fee (USD, to zip), text, type, transferable, arrival, min_days, max_days}, model_rating {average, count} (owner reviews of that model-year), badge, new_arrival, coming_soon, reserved, saleable, made_saleable_at, photo";
const LIST = `total (as CarMax reports it), count, page, page_size, has_more, sort, zip, applied [{category, value, label}] (the filters CarMax applied), nearest_store {id, name, city, state, zip, distance_miles}, cars [{${CAR}}], facets (with include_facets: every filter value with its url_segment and count, makes with their models, and the year / price / mileage ranges with counts), notes`;

const stock = z.union([z.string().regex(/^\d{6,10}$/), z.number().int().positive()]);
const storeId = z.union([z.string().regex(/^\d{3,5}$/), z.number().int().positive()]);
const year = z.number().int().min(1980).max(MAX_YEAR);
const zip = z.string().regex(/^\d{5}(-\d{4})?$/)
  .describe("A 5-digit US ZIP code (e.g. 75201). CarMax prices each car's shipping fee and dates to it, and the radius is measured from it.");

const vehicleNames = {
  make: z.string().min(1).max(60).optional()
    .describe("A make by name or slug (Ford, land-rover; get_carmax_makes lists them)."),
  model: z.string().min(1).max(80).optional()
    .describe("With make: a model by name or slug (F-150 and F150 both work, RAV4, CX-5, Model 3; get_carmax_models lists a make's models)."),
};

const listFilters = {
  body_type: z.string().min(2).max(80).optional()
    .describe("A body type as CarMax writes it (the url_segment of a VehicleType facet value): suvs, sedans, trucks, coupes, hatchbacks, minivans-and-vans, convertibles, wagons."),
  filters: z.array(z.string().min(1).max(80)).max(8).optional()
    .describe("Up to 8 facet values by url_segment (facets[].values[].url_segment with include_facets): drivetrain, colour, engine type, features, packages, cylinders, size, doors (e.g. all-wheel-drive, black)."),
  year_min: year.optional().describe("Earliest model year (e.g. 2021)."),
  year_max: year.optional().describe("Latest model year (e.g. 2023)."),
  price_min: z.number().int().min(0).max(1_000_000).optional().describe("Lowest price, USD."),
  price_max: z.number().int().min(0).max(1_000_000).optional().describe("Highest price, USD (e.g. 30000)."),
  mileage_min: z.number().int().min(0).max(1_000_000).optional().describe("Lowest mileage."),
  mileage_max: z.number().int().min(0).max(1_000_000).optional().describe("Highest mileage (e.g. 60000)."),
  max_shipping_fee: z.union([z.literal(0), z.literal(99), z.literal(199), z.literal(299), z.literal(399), z.literal(499), z.literal(999)]).optional()
    .describe(`CarMax's "Max shipping fee" filter, USD: ${SHIPPING_FEES.join(", ")} (0 = free to home or store). No limit by default.`),
  sort: z.enum(SORTS).optional()
    .describe("best_match (default), distance (nearest first), price_asc, price_desc, mileage_asc, mileage_desc, year_desc (newest), year_asc."),
  page: z.number().int().min(1).max(1000).optional().describe("Page, from 1 (default 1); has_more says whether another page exists."),
  page_size: z.number().int().min(1).max(100).optional()
    .describe("Cars per page, 1 to 100 (default 24). 100 cars can take CarMax 80 seconds."),
  include_facets: z.boolean().optional()
    .describe("Add facets: every filter value with its url_segment and count (makes carry their models), and the year / price / mileage ranges with counts. Default false."),
};

const carShape = {
  stock_number: stock.optional().describe("A CarMax stock number (cars[].stock_number, e.g. 29242747). Send stock_number or url."),
  url: z.string().min(20).max(400).optional().describe("Or the car's link (https://www.carmax.com/car/<stock number>)."),
};

const modelYearShape = {
  make: z.string().min(1).max(60).describe("Required. The make as CarMax names it (makes[].name, e.g. Toyota)."),
  model: z.string().min(1).max(80).describe("Required. The model as CarMax names it (models[].name, e.g. RAV4; F-150 is read as F150)."),
  year: year.describe("Required. The model year (e.g. 2022)."),
};

export function registerCarmaxTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/carmax/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_carmax",
    `Search the used-car inventory of ${FIRST}: by make and model (F-150 and F150 both work), body type, keyword, facet filters, year / price / mileage ranges and max shipping fee, within a radius of a US ZIP (or nationwide), sorted 8 ways, up to 100 cars a page. Returns query (the filters as read), radius, ${LIST}. Captured 2026-11-26: Ford F-150 within 100 miles of 75201 by lowest mileage gave 49 cars, the nearest store Texas Stadium (Irving) at 7 miles, and a 2026 F150 STX at 44998 USD with 1971 miles at the Plano store, shipping fee 49 USD. ${NO_VIN} US only, USD. ${ONE}`,
    {
      ...vehicleNames,
      keyword: z.string().min(1).max(120).optional()
        .describe("Free text CarMax searches across every make (e.g. rav4 hybrid). Not combined with make / model."),
      ...listFilters,
      zip: zip.describe("Required. A 5-digit US ZIP code (e.g. 75201). CarMax prices each car's shipping fee and dates to it, and the radius is measured from it."),
      radius: z.union([z.enum(RADII), z.number().int()]).optional()
        .describe("Miles from zip: 5, 25, 50, 75, 100, 250, 500 or nationwide (default: every CarMax car, with the shipping fee to zip)."),
    },
    post("search"),
  );

  server.tool(
    "get_carmax_listing",
    `One ${NAME} car in full by stock number or link: stock_number, url, status, year, make, model, trim, body, engine, transmission, drivetrain, fuel_type, fuel_capacity_gallons, mpg {city, highway, combined, equivalent}, battery_range_miles, mileage, exterior_color, interior_color, passenger_capacity, vehicle_types, generation, price, currency, price_reduced, previous_price, price_drop_date, price_drop_expires, price_drop_text (as CarMax words it), badge (e.g. Price drop), history {accident_count, owner_count, prior_uses}, car_life [{group, title, subtitle}] (CarMax's callouts as given), highlights, warranties [{type, years, miles}], feature_score, installed_packages, features, oem_standard_features, specifications, reconditioning, store {id, name, state, latitude, longitude, remote_lot, url}, saleable, available_to_transact, transferable, reserved, sold, new_arrival, coming_soon, first_made_saleable_at, last_made_saleable_at, save_count, model_review_summary, pros, cons, new_this_year, notes. Shipping depends on the buyer's ZIP and is not part of this answer: use search_carmax with a zip. Captured 2026-11-26: a 2026 Ford F150 STX at 44998 USD, lowered from 45998 USD on November 20, 2026 (badge Price drop), 1 owner and 0 accidents as CarMax shows them. A stock number CarMax does not have (or a sold car) is a charged 404. ${NO_VIN} ${ONE}`,
    carShape,
    post("listing"),
  );

  server.tool(
    "get_carmax_photos",
    `Every photo of one ${NAME} car by stock number or link: stock_number, count, photos [{type (image or 360-exterior), name, category (Exterior, Interior), shot, thumbnail_url, url (1600x1200), url_16x9}]. Captured 2026-11-26: 27 photos for one F150. ${ONE}`,
    carShape,
    post("photos"),
  );

  server.tool(
    "get_carmax_stores",
    `${NAME} stores near a US ZIP (nearest first, with distance_miles) or in a state or city: count, stores [{id (the input of get_carmax_store and get_carmax_store_inventory), name, url, address {line1, line2, city, market, state, zip}, phone, toll_free_phone, latitude, longitude, distance_miles (ZIP searches only), status, is_microstore, is_car_buying_center, hours [{day, open, close, closed}], service_hours, holiday_hours [{date, open, close, closed}] (from today)}]. Captured 2026-11-26: 75201 gave 5 stores, the nearest Texas Stadium (Irving), store 7115, at 7 miles. ${ONE}`,
    {
      zip: zip.optional().describe("A 5-digit US ZIP code: stores nearest it. Send one of zip, state or city."),
      state: z.string().min(2).max(40).optional().describe("Or a US state (TX or Texas): CarMax's stores in it."),
      city: z.string().min(2).max(60).optional().describe("Or a city name (e.g. Atlanta)."),
      limit: z.number().int().min(1).max(50).optional().describe("Most stores to return, 1-50 (default 25)."),
    },
    post("stores"),
  );

  server.tool(
    "get_carmax_store",
    `One ${NAME} store by id: id, name, url, address, phone, toll_free_phone, latitude, longitude, status, is_microstore, is_car_buying_center, hours, service_hours, holiday_hours, is_open_now, todays_hours_label, alert, fee_disclaimer (CarMax's price and fee terms for that store's state). An unknown id is a charged 404. ${ONE}`,
    {
      store_id: storeId.describe("Required. A CarMax store id (stores[].id, e.g. 7115)."),
    },
    post("store"),
  );

  server.tool(
    "get_carmax_store_inventory",
    `The cars on one ${NAME} store's lot, with the same filters, sorts and paging as search_carmax (no keyword, no radius): store_id, store_name, query, ${LIST}. total is that store's lot count for the filters; zip prices shipping. Captured 2026-11-26: Toyota at store 7115, Texas Stadium (Irving), gave 71 cars, among them a 2022 RAV4 Hybrid LE at 29998 USD with 29067 miles. ${NO_VIN} ${ONE}`,
    {
      store_id: storeId.describe("Required. A CarMax store id (stores[].id, e.g. 7115)."),
      ...vehicleNames,
      ...listFilters,
      zip: zip.describe("Required. A 5-digit US ZIP code (e.g. 75201): CarMax prices each car's shipping fee and dates to it."),
    },
    post("store-inventory"),
  );

  server.tool(
    "get_carmax_reviews",
    `Owner reviews of one model-year on ${NAME} (e.g. 2022 Toyota RAV4), 10 a page, full depth, 5 sorts and an exact star filter: make, model, year, sort, rating, page, page_size, total_reviews, total_matching, total_pages, has_more, average_rating, distribution [{stars, count}], top_likes, top_dislikes, count, reviews [{id, rating, title, recommends, pros [{aspect, comment}], cons [{aspect, comment}], submitted_at, helpful_votes, not_helpful_votes, ratings_only, syndicated, vehicle {year, make, model, mileage, time_owned}}]. Review text is the title plus the pros and cons comments, as CarMax shows them. No reviewer name or any reviewer identity is returned. Captured 2026-11-26: the 2022 Toyota RAV4 had 17 owner reviews, average 4.41. A model-year with no reviews is a charged 404. ${ONE}`,
    {
      ...modelYearShape,
      page: z.number().int().min(1).max(500).optional().describe("Page, 10 reviews a page (default 1); total_pages says how deep they go."),
      sort: z.enum(REVIEW_SORTS).optional().describe("most_helpful (default), newest, oldest, highest_rating or lowest_rating."),
      rating: z.number().int().min(1).max(5).optional().describe("Only reviews with exactly this many stars (1-5)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_carmax_review_summary",
    `The owner-review summary of one model-year on ${NAME}: make, model, year, count, average, rounded_average, top_likes, top_dislikes, distribution [{stars, count}]. Captured 2026-11-26: the 2020 Ford F150 had 37 reviews, rounded average 4.5, top likes Interior Space, Fuel Economy, Ride and Handling. A model-year with no reviews is a charged 404. ${ONE}`,
    modelYearShape,
    post("review-summary"),
  );

  server.tool(
    "get_carmax_suggestions",
    `${NAME}'s make and model suggestions for the start of a name: query, count, suggestions [{name, type (make or model), slug (the make or model input of search_carmax)}], notes. CarMax suggests make and model names only (not trims). ${ONE}`,
    {
      query: z.string().min(2).max(60).describe("Required. The start of a make or model name (e.g. rav)."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_carmax_makes",
    `Every make ${FIRST} lists: count, makes [{name, slug}]. Captured 2026-11-26: 60 makes. ${ONE}`,
    {},
    post("makes"),
  );

  server.tool(
    "get_carmax_models",
    `One make's models on ${NAME}: make, make_slug, count, models [{name, slug (the model input of search_carmax and get_carmax_car_value)}]. Captured 2026-11-26: Toyota had 46 models. An unknown make is a charged 404. ${ONE}`,
    {
      make: z.string().min(1).max(60).describe("Required. A make by name or slug (makes[].slug, e.g. toyota)."),
    },
    post("models"),
  );

  server.tool(
    "get_carmax_car_value",
    `Recent ${NAME} instant offers for one model-year (e.g. 2019 Ford F-150), as CarMax shows them: make, model, year, currency, offer_range {low, high} (CarMax's range across recent offers), headline_range {text, low, high} (the range CarMax's page headline states, which can differ), aggregate {low, high, offer_count}, offers_from, offers_to, count, recent_offers [{mileage, offer, offered_at, trim, trim_code}], trim_ranges [{trim, trim_code, low, high}], median_offer_history [{year, median_offer}], median_offer_change, other_years, url, notes. This is what CarMax offered for cars of that model-year, not an appraisal of any one car. Captured 2026-11-26: the 2019 Ford F150 showed 10 recent offers from 11000 to 20000 USD (October 11 to November 25, 2026), while the page headline stated $16,400-$25,400. An unknown make, model or year is a charged 404. ${ONE}`,
    {
      make: z.string().min(1).max(60).describe("Required. A make by name or slug (e.g. Ford)."),
      model: z.string().min(1).max(80).describe("Required. A model by name or slug (models[].slug; F-150 is read as f150, the slug CarMax uses)."),
      year: z.number().int().min(1980).max(new Date().getUTCFullYear() + 1).describe("Required. The model year (e.g. 2019)."),
    },
    post("car-value"),
  );
}
