import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/autotrader.ts (US only, no market input). Rules the backend
// enforces and zod here does not: search radius takes 10, 25, 50, 75, 100, 200, 300, 400, 500 or 0,
// the dealer finder radius the same without 400; page_size is 25 or 100; model needs make and
// trim_code needs make and model; *_min <= *_max; the code filters take the code or the label
// listed in each description; listing takes listing_id or url, dealer takes dealer_id or url; an
// unknown ZIP is a 400. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_asc", "mileage_asc", "year_desc", "distance_asc"] as const;
const RADII = [10, 25, 50, 75, 100, 200, 300, 400, 500, 0];
const DEALER_RADII = [10, 25, 50, 75, 100, 200, 300, 500, 0];

const FIRST = "Autotrader (autotrader.com, the US car marketplace run by Cox Automotive)";
const NAME = "Autotrader";
const TWO =
  "Costs 2 credits on every endpoint (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Answers can take up to 4 minutes: allow a client timeout of at least 240 s.";
const MARKET = "US only, prices in USD (market {country: us, currency: USD}).";
const DEAL =
  "deal_label is Autotrader's own label (Great, Good) as Autotrader gives it, based on the Kelley Blue Book Fair Purchase Price range: kbb_fair_purchase_price {amount, low, high, delta (that price minus the listing price; negative = above it)}, as given.";
const PRIVATE =
  'Private sellers: seller is {type: private, city, state, distance_miles} only (no name, phone or street address). VINs and stock numbers are never returned; phone numbers, emails, stock numbers and VIN-like codes inside descriptions read "[removed]".';
const TILE =
  "listing_id (the input of get_autotrader_listing), url, title, year, make, make_code, model, model_code, trim, trim_code, listing_type (new, used, certified, third_party_certified), mileage, exterior_color, interior_color, body_style, drivetrain, engine, fuel, transmission, mpg_city, mpg_highway, doors, days_on_site, newly_listed, reduced_price, price (USD; null when the dealer asks you to call: price_label), display_price, msrp, price_label, deal_label, kbb_fair_purchase_price, dealer_fees {total, items [{name, amount}]}, price_history [{date, price, current}], history_preview (Autotrader's history flags as given, e.g. NO_ACCIDENTS_REPORTED, ONE_OWNER), warranties, image, sponsored, seller ({type: dealer, dealer_id, name, rating, rating_count, city, state, distance_miles, url} or a private seller)";
const NOT_AVAILABLE =
  "Not available: VINs, stock numbers, private sellers' names or contact details, dealer reviews (rating and rating_count only), autotrader.co.uk or autotrader.ca (separate sites), more than 100 pages of a search, and price history beyond the listing's own price_history (poll and store the answers).";

const zip = (description: string) =>
  z.union([z.string().min(5).max(10), z.number().int()]).describe(description);
const ZIP = "A 5-digit US ZIP code (e.g. 90012): Autotrader lists cars around it. An unknown ZIP is a 400, not charged.";
const make = (description: string) =>
  z.string().max(40)
    .describe(`${description} By name or Autotrader code (Toyota, Ford, Mercedes-Benz, Land Rover, or MB, ROV ...; 72 makes).`);
const year = (description: string) => z.number().int().min(1900).max(2028).optional().describe(description);
const code = (description: string) => z.string().max(60).optional().describe(description);

export function registerAutotraderTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/autotrader/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_autotrader",
    `Search the cars for sale on ${FIRST} around a US ZIP code with a radius, by make, model and trim, sorted by relevance, price, mileage, model year or distance, filtered by model year, price, mileage, body style, drivetrain, colours, dealer or private seller, new / used / certified, fuel, transmission, vehicle history, Good or Great deal, a feature, doors and seats; 25 or 100 a page, up to page 100. Returns search, location {zip, place, radius_miles}, filters_applied (as Autotrader applied them), filters_not_applied, sort, page, page_size, total, total_pages, has_more, count, listings [{${TILE}}], spotlights (Autotrader's paid Spotlight placements, sponsored: true), stats {price, mileage, year: {min, avg, max}} for the whole result set, market {country, currency}, notes. ${DEAL} Captured 2026-11-26: Honda Civic around 90012 resolved to Los Angeles, CA (25 miles) with 1882 listings; a used 2018 Honda Civic LX at 18881 USD with 46077 miles was labelled Great against a KBB Fair Purchase Price of 19440 (range 18690-20140). ${PRIVATE} ${MARKET} ${TWO}`,
    {
      zip: zip(`Required. ${ZIP}`),
      make: make("A make.").optional(),
      model: z.string().max(60).optional()
        .describe("A model as Autotrader names it (Civic, F150, RAV4, C-Class) or its model code (listings[].model_code, get_autotrader_makes models[].code). Needs make. A different spelling (F-150) is matched to Autotrader's name; a model Autotrader does not list for the make is a charged 404 that lists the make's models."),
      trim_code: z.string().max(80).optional()
        .describe("A trim as listings[].trim_code gives it (MODEL|Trim, e.g. CIVIC|LX). Needs make and model."),
      radius: z.number().int().optional()
        .describe(`Miles around the ZIP: ${RADII.join(", ")} (0 = nationwide). Autotrader's default otherwise (location.radius_miles says which).`),
      page: z.number().int().min(1).max(100).optional().describe("Page (default 1, at most 100)."),
      page_size: z.number().int().optional().describe("Listings a page: 25 (default) or 100."),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), price_asc, mileage_asc, year_desc (newest model year), distance_asc."),
      year_min: year("Earliest model year (1900-2028)."),
      year_max: year("Latest model year (1900-2028)."),
      price_min: z.number().int().min(0).optional().describe("Lowest price, whole USD."),
      price_max: z.number().int().min(1).optional().describe("Highest price, whole USD."),
      mileage_min: z.number().int().min(0).optional().describe("Fewest miles."),
      mileage_max: z.number().int().min(1).optional().describe("Most miles."),
      body_style: code("Body style, code or label: CONVERT (Convertible), COUPE (Coupe), HATCH (Hatchback), SEDAN (Sedan), SUVCROSS (SUV / Crossover), TRUCKS (Truck), VANMV (Van / Minivan), WAGON (Wagon)."),
      drivetrain: code("Drivetrain: AWD4WD (AWD/4WD), FWD (Front Wheel Drive), RWD (Rear Wheel Drive)."),
      exterior_color: code("Exterior colour, code or label: BEIGE, BLACK, BLUE, BROWN, BURGUNDY, CHARCOAL, GOLD, GRAY, GREEN, OFFWHITE (Off White), ORANGE, PINK, PURPLE, RED, SILVER, TAN, TURQUOISE, WHITE, YELLOW."),
      interior_color: code("Interior colour (same values as exterior_color)."),
      seller_type: z.enum(["dealer", "private"]).optional().describe("dealer or private (private sellers)."),
      listing_type: z.enum(["new", "used", "certified", "third_party_certified"]).optional()
        .describe("new, used, certified (manufacturer certified pre-owned) or third_party_certified."),
      fuel: code("Fuel type: GSL (Gasoline), DSL (Diesel), HYB (Hybrid), ELE (Electric), HYD (Hydrogen), PIH (Plug-in Hybrid)."),
      transmission: code("Transmission: AUT (Automatic), MAN (Manual)."),
      history: code("Vehicle history as Autotrader filters it: NO_ACCIDENTS (No Accidents), ONE_OWNER (Single Owner), CLEAN_TITLE (Clean Title), NO_FRAME_DAMAGE (No Frame Damage), FREE_REPORT (Free Report)."),
      deal: z.enum(["good", "great"]).optional()
        .describe("Only listings Autotrader labels a Good Price or Great Price deal (based on the Kelley Blue Book Fair Purchase Price range)."),
      feature: code("One feature, code or label: 1062 (Keyless Entry), 1317 (Premium Wheels), 1172 (Roof Rack), 1199 (Trailer Hitch), AT0001 (Dual Rear Wheels), 1318 (Disability Equipped), 1327 (Android Auto), 1326 (Apple CarPlay), 1211 (Bluetooth, Hands-Free), 1033 (Cruise Control), 1297 (DVD Player), 1066 (Navigation), 1230 (Portable Audio Connection), 1136 (Premium Audio), 1149 (Satellite Radio), 1161 (Steering Wheel Controls), 1221 (Remote Engine Start), 1313 (Adaptive Cruise Control), 1298 (Heads Up Display), 1160 (Rain Sensing Wipers), 1229 (Keyless Start), 1180 (Parking Assist), 1331 (WiFi Hotspot), 1306 (3rd Row Seats), 1319 (Heated Seats), 1078 (Leather Seats), 1132 (Sunroof), 1224 (Backup Camera), 1142 (Night Vision), 1310 (Lane Departure Warning), 1309 (Blind Spot Monitor), 1330 (Cross Traffic Alert), 1228 (Brake Assist), 1013 (Security System)."),
      doors: code("Doors: 2 (Two Door), 3 (Three Door), 4 (Four Door), 5 (Five Door)."),
      seating: code("Seats: 2, 3, 4, 5, 6, 7, 8+."),
    },
    post("search"),
  );

  server.tool(
    "get_autotrader_listing",
    `One car listing on ${FIRST} by listing id or link: the search tile fields plus description, images, features {group: [...]}, ranked_features, specifications {name: value}, warranties [{group, type, label, details, years, miles, unlimited_miles, remaining_years, remaining_miles}], kbb_consumer_rating, kbb_consumer_review_count (Kelley Blue Book owner ratings for the model), price_history, deal_label + deal_basis, dealer {dealer_id, name, rating, rating_count, address {street, street2, city, state, zip}, phone, website, hours [{day, open, close}], home_services, is_open, url} (null for a private seller), zip, market, notes. ${DEAL} Captured 2026-11-26: a used 2016 Ford F150 XLT at 22175 USD with 76887 miles from a Mesquite, TX dealer, labelled Great against a KBB Fair Purchase Price of 23600 (range 22600-24650), with a 225 USD dealer doc fee. ${PRIVATE} A sold or removed listing is a charged 404. ${TWO}`,
    {
      listing_id: z.union([z.string().max(20), z.number().int()]).optional()
        .describe("An Autotrader listing id (listings[].listing_id, digits, e.g. 795241382). Send listing_id or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("An Autotrader listing link (https://www.autotrader.com/cars-for-sale/vehicle/<id>) instead of listing_id."),
      zip: zip("Optional: the distance (seller.distance_miles) is measured from this US ZIP code; without it distance_miles is null.").optional(),
    },
    post("listing"),
  );

  server.tool(
    "get_autotrader_dealers",
    `Car dealers near a US ZIP code on ${FIRST}, optionally of one make, within a radius, and with cars in a price or model-year range: search, location {zip, place, radius_miles}, count, dealers [{dealer_id (the input of get_autotrader_dealer), name, franchise_name, make, rating, rating_count, distance_miles, address {street, street2, city, state, zip}, phone, website, url}] (the first 50, nearest first as Autotrader orders them; the dealer finder does not page, so narrow with radius or make), market, notes. Dealer details are the dealer's public business details. Captured 2026-11-26: Ford dealers around 75201 resolved to Dallas, TX (50 miles), 50 dealers. ${MARKET} ${TWO}`,
    {
      zip: zip(`Required. ${ZIP}`),
      make: make("Only dealers of this make (Autotrader's franchise filter).").optional(),
      radius: z.number().int().optional()
        .describe(`Miles around the ZIP: ${DEALER_RADII.join(", ")} (0 = any). Autotrader's default otherwise.`),
      price_min: z.number().int().min(0).optional().describe("Dealers with cars from this price, whole USD."),
      price_max: z.number().int().min(1).optional().describe("Dealers with cars up to this price, whole USD."),
      year_min: year("Dealers with cars from this model year (1900-2028)."),
      year_max: year("Dealers with cars up to this model year (1900-2028)."),
    },
    post("dealers"),
  );

  server.tool(
    "get_autotrader_dealer",
    `One dealer on ${FIRST} by dealer id or link: dealer_id, name, rating, rating_count, address, phone, website, hours, home_services {buy_online, test_drive, vehicle_delivery, virtual_tour}, is_open, url, inventory_count (the dealer's listings on ${NAME}), makes [{make, make_code, count}], inventory_sort, inventory [{the search tile fields}] (the first page as the dealer page shows it, lowest price first), market, notes. Dealer reviews are not included (rating and rating_count only). Captured 2026-11-26: dealer 87788, an Irving, TX Ford dealer rated 4.6 from 5621 ratings, with 496 listings. An unknown id is a charged 404. ${TWO}`,
    {
      dealer_id: z.union([z.string().max(20), z.number().int()]).optional()
        .describe("An Autotrader dealer id (dealers[].dealer_id, listings[].seller.dealer_id; digits, e.g. 87788). Send dealer_id or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("An Autotrader dealer link (https://www.autotrader.com/car-dealers/<city-st>/<id>/<name>) instead of dealer_id."),
    },
    post("dealer"),
  );

  server.tool(
    "get_autotrader_makes",
    `One make's models on ${FIRST}: make {code, name}, years, popular_models (model codes), count, models [{code, name, years, price_by_year {year: price range label as the page gives it}, mpg_by_year {year: {city, highway}}, body_style, image, search_model (the model name to pass to search_autotrader)}], market, notes. Captured 2026-11-26: Toyota with 46 models and model years 1989-2027; the 2026 4Runner's price label read "$42,270 - $68,600". ${NOT_AVAILABLE} ${TWO}`,
    {
      make: make("Required. A make."),
    },
    post("makes"),
  );
}
