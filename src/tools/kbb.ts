import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/kbb.ts (US only, USD; the optional country input only takes us, so it is left out).
// Rules the backend enforces and zod here does not: car value with zip needs mileage and is refused for buy_new; a
// trim name several trims share is a 400 listing them; search model and model_code need make and are not combined;
// *_min <= *_max; listing takes one of listing_id or url, dealer one of dealer_id or url; review sort most_helpful is
// not offered. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const INTENTS = ["buy_used", "buy_new", "trade_in_sell"] as const;
const CONDITIONS = ["fair", "good", "very_good", "excellent"] as const;
const LISTING_TYPES = ["all", "used", "new"] as const;
const SORTS = ["relevance", "price_asc", "mileage_asc", "year_desc"] as const;
const REVIEW_SORTS = ["recent", "rating_desc", "rating_asc"] as const;
const RADII = [10, 25, 50, 75, 100, 200, 300, 400, 500, 0] as const;
const DEALER_RADII = [10, 25, 50, 75, 100, 200, 300, 500, 0] as const;
const MIN_YEAR = 1981;
const MAX_YEAR = 2028;

const FIRST = "Kelley Blue Book (kbb.com, Cox Automotive's car value and research site)";
const NAME = "Kelley Blue Book";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW = "Answers can take up to 4 minutes: allow a client timeout of at least 240 s.";
const PRIVATE =
  "Private sellers: seller is {type: private, city, state, distance_miles} only (no name, phone or street address). No VIN or stock number is returned; phone numbers, emails, stock numbers and VIN-like codes inside descriptions read [removed].";
const DEAL =
  "deal_label is Kelley Blue Book's deal rating (Great, Good ...) as KBB gives it, based on the Kelley Blue Book Fair Purchase Price range: kbb_fair_purchase_price {amount, low, high, delta (that price minus the listing price; negative = above it)}.";
const TILE =
  "listing_id (the input of get_kbb_listing), url, title, year, make, make_code, model, model_code, trim, trim_code, listing_type, mileage, exterior_color, interior_color, body_style, drivetrain, engine, fuel, transmission, mpg_city, mpg_highway, doors, days_on_site, newly_listed, reduced_price, price (USD; null when the dealer asks you to call: price_label), display_price, msrp, price_label, deal_label, kbb_fair_purchase_price, dealer_fees {total, items [{name, amount}]}, price_history [{date, price, current}], history_preview (history flags as given, e.g. NO_ACCIDENTS_REPORTED, ONE_OWNER), warranties, image, sponsored, seller ({type: dealer, dealer_id, name, rating, rating_count, city, state, distance_miles, url} or a private seller)";

const year = z.number().int().min(MIN_YEAR).max(MAX_YEAR);
const zip = z.union([z.string().min(5).max(10), z.number().int()]);
const modelYearShape = {
  make: z.string().min(1).max(40).describe("Required. A make by name or KBB slug (Toyota, Mercedes-Benz, land-rover; 68 makes, get_kbb_makes_models lists them)."),
  model: z.string().min(1).max(80).describe("Required. KBB's model slug as get_kbb_makes_models gives it (rav4, civic, f150-supercrew-cab, 3-series). A model KBB has no page for is a charged 404."),
  year: year.describe("Required. The model year (e.g. 2021)."),
};
const radius = (values: readonly number[], zeroMeans: string) =>
  z.union(values.map((v) => z.literal(v)) as unknown as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]).optional()
    .describe(`Miles around the ZIP: ${values.join(", ")} (0 = ${zeroMeans}). KBB's default otherwise.`);

export function registerKbbTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/kbb/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_kbb_car_value",
    `A car's ${FIRST} values by make, model, year and trim (KBB slugs; get_kbb_model lists the trims), intent, condition and mileage, optionally for a US ZIP code (the values KBB's own ZIP form gives for it): vehicle {make, make_slug, model, model_slug, year, trim, trim_slug, vehicle_id, body_style}, intent, condition, mileage, typical_mileage, location {zip, chosen_zip, valid_text (Valid for ZIP Code N through date, as KBB gives it), valid_through}, valuation_date, headline (the values for the intent and condition), prices (every KBB price type the page gives; 17 for a used car: [{type_id, type (Lending Value, Typical Listing Price, Trade-In Value Fair ... Excellent, Private Party Value Fair ... Excellent, Auction Value Fair ... Excellent, Typical Listing Price (CPO), Fair Purchase Price, Fair Purchase Price (CPO); a new car: MSRP, Invoice, Fair Purchase Price), category, condition, value, base_value, region_adjustment, mileage_adjustment, option_adjustment, range_low, range_high}]), url, market, notes. Values are exactly as KBB gives them; without zip they are for KBB's default location (location.zip says which). Captured 2026-11-26: a 2021 Toyota RAV4 LE Sport Utility 4D at 40000 miles in good condition had a Fair Purchase Price of 25950 USD (range 23750 to 28150) and a Private Party Value Good of 24350 USD at KBB's default ZIP 92620, and a Fair Purchase Price of 25410 USD at ZIP 10001. Credits: 1; with zip 2 (up to 6 when KBB's ZIP form needs a second, costlier attempt; credits_used says which). A car KBB has no page for is charged; failed upstream calls and refused inputs are not. ${SLOW}`,
    {
      ...modelYearShape,
      trim: z.string().min(1).max(120)
        .describe("Required. The trim: its trim_slug (get_kbb_model trims[].trim_slug, e.g. le-sport-utility-4d), its vehicle_id, or a name that starts exactly one trim (LE). A name several trims share is a 400 listing them."),
      intent: z.enum(INTENTS).optional()
        .describe("buy_used (default), buy_new (a new model year) or trade_in_sell. Every KBB price type the value page gives comes back; intent picks the headline values."),
      condition: z.enum(CONDITIONS).optional()
        .describe("Condition for the headline trade-in, private party and auction values: fair, good (default), very_good, excellent."),
      mileage: z.number().int().min(0).max(999999).optional()
        .describe("Odometer miles (e.g. 40000). Without it KBB values the mileage it assumes. Required with zip."),
      zip: zip.optional()
        .describe("Optional US ZIP code the values are for (buy_used and trade_in_sell only; needs mileage). Without it the values are for KBB's default location. With it: 2 credits (up to 6)."),
    },
    post("car-value"),
  );

  server.tool(
    "get_kbb_model",
    `One model year on ${FIRST} by make, model and year: make, model, year, zip (KBB's default location for the prices), categories, trims [{vehicle_id, name, trim_slug (the trim input of get_kbb_car_value), model, model_slug, body_style, fair_purchase_price, trade_in_value, private_party_value, combined_mpg, epa_city, epa_highway, epa_combined, mpge_combined, horsepower, torque, engine, drivetrain, seating, curb_weight_lbs, towing_capacity_lbs, cargo_capacity_cu_ft, ev_range_miles, is_ev, url}], new_car_pricing [{trim, trim_id, msrp, fair_purchase_price, fair_market_range {low, high}, epa_city, epa_highway}] and new_car_summary for a new model year, depreciation {three_year_depreciation, current_resale_value, current_trade_in_value, history [{year, resale_value, trade_in_value, annual_depreciation}], forecast}, specs {fuel_economy, fuel_type, horsepower, max_seating, cargo_space, maximum_towing, basic_warranty, additional [{category, specs [{name, value}]}]}, rankings [{metric, value, top}], best_cars {list, rank, winner, url}, years, other_models, image, url, market, notes. Captured 2026-11-26: the 2021 Toyota RAV4 had 13 trims; the LE Sport Utility 4D showed a Fair Purchase Price of 22900 USD and a trade-in value of 16850 USD at KBB's default ZIP 92620. ${ONE} ${SLOW}`,
    modelYearShape,
    post("model"),
  );

  server.tool(
    "search_kbb",
    `Search the cars for sale on ${FIRST} around a US ZIP code with a radius: used, new or all, by make and model (validated: never widened to the whole make), sorted by relevance, price, mileage or model year, filtered by model year, price, mileage, drivetrain, exterior colour and dealer or private seller; 25 or 100 a page. Returns search, location {zip, place, radius_miles}, filters_applied, filters_not_applied, sort, page, page_size, total, total_pages, has_more, count, listings [{${TILE}}], spotlights (paid placements, sponsored: true), stats {price, mileage, year: {min, avg, max}}, market, notes. ${DEAL} ${PRIVATE} Captured 2026-11-26: used Toyota RAV4 around ZIP 10001 (New York, NY, 25 miles) gave 574 listings; the first, a 2020 RAV4 LE with 4709 miles at 27665 USD, was rated a Great deal against a Fair Purchase Price of 31443 USD. ${ONE} ${SLOW}`,
    {
      zip: zip.describe("Required. A 5-digit US ZIP code (e.g. 10001): cars for sale around it (an unknown ZIP is a 400, not charged)."),
      listing_type: z.enum(LISTING_TYPES).optional().describe("all (default), used or new cars for sale."),
      make: z.string().min(1).max(40).optional().describe("A make by name or code (Toyota, Ford, Mercedes-Benz, or TOYOTA, MB ...)."),
      model: z.string().min(1).max(60).optional()
        .describe("A model as the listings name it (RAV4, Civic, F150) or a spelling of it (F-150 is matched to F150). Needs make. A model KBB does not list for the make is a charged 404 that lists the make's models."),
      model_code: z.string().min(1).max(40).optional()
        .describe("Or a model code as listings[].model_code gives it (e.g. F150PICKUP). Needs make; not combined with model."),
      radius: radius(RADII, "nationwide"),
      page: z.number().int().min(1).max(100).optional().describe("Page, from 1 (default 1, at most 100); has_more says whether another page exists."),
      page_size: z.union([z.literal(25), z.literal(100)]).optional().describe("Listings a page: 25 (default) or 100."),
      sort: z.enum(SORTS).optional().describe("relevance (default), price_asc, mileage_asc, year_desc (newest model year)."),
      year_min: year.optional().describe("Earliest model year."),
      year_max: year.optional().describe("Latest model year."),
      price_min: z.number().int().min(0).optional().describe("Lowest price, whole USD."),
      price_max: z.number().int().min(1).optional().describe("Highest price, whole USD."),
      mileage_min: z.number().int().min(0).optional().describe("Fewest miles."),
      mileage_max: z.number().int().min(1).optional().describe("Most miles."),
      drivetrain: z.string().min(1).max(40).optional().describe("Drivetrain: AWD4WD (AWD/4WD), FWD (Front Wheel Drive), RWD (Rear Wheel Drive)."),
      exterior_color: z.string().min(1).max(40).optional()
        .describe("Exterior colour: BEIGE, BLACK, BLUE, BROWN, BURGUNDY, CHARCOAL, GOLD, GRAY, GREEN, OFFWHITE, ORANGE, PINK, PURPLE, RED, SILVER, TAN, TURQUOISE, WHITE, YELLOW."),
      seller_type: z.enum(["dealer", "private"]).optional().describe("dealer or private (private sellers)."),
    },
    post("search"),
  );

  server.tool(
    "get_kbb_listing",
    `One car for sale on ${NAME} by listing id or link: the search tile fields plus description, images, features {group: [...]}, ranked_features, specifications, warranties [{group, type, label, details, years, miles, unlimited_miles, remaining_years, remaining_miles}], recall_count and recall_note (open safety recalls as KBB shows them), kbb_vehicle_id, kbb_consumer_rating, kbb_consumer_review_count, price_history, price_valid_until, deal_label and deal_basis, dealer {dealer_id, name, rating, rating_count, address, phone, website, hours [{day, open, close}], home_services, is_open, url} (null for a private seller), zip, market, notes. ${DEAL} ${PRIVATE} A sold or removed listing is a charged 404. ${ONE} ${SLOW}`,
    {
      listing_id: z.union([z.string().min(1).max(20), z.number().int().positive()]).optional()
        .describe("A KBB listing id (search_kbb listings[].listing_id, get_kbb_dealer inventory[].listing_id, e.g. 796688649). Send listing_id or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("Or a KBB listing link (https://www.kbb.com/cars-for-sale/vehicle/<id>)."),
      zip: zip.optional().describe("Optional US ZIP code: seller.distance_miles is measured from it; without it distance_miles is null."),
    },
    post("listing"),
  );

  server.tool(
    "get_kbb_reviews",
    `Owner reviews of a model year on ${NAME} by make, model and year, a page of 8 (pages 1 to 10), sorted most recent, highest or lowest rated, optionally only one star rating: vehicle, sort, stars, page, per_page, total, total_pages, has_more, count, reviews [{review_id, title, text, rating, ratings {value, reliability, performance, styling, comfort, quality}, recommend, date, ownership, year, make, model, pros, cons, helpful_yes, helpful_no, photos, staff, incentivized}], ratings (KBB's averages: rating, review_count, value, reliability, performance, styling, comfort, quality, recommendation, distribution {five ... one}), most_helpful {positive, negative} (page 1), url, market, notes. No reviewer name, nickname or location is returned. Captured 2026-11-26: the 2021 Toyota RAV4 had 398 reviews, average 3.6 (styling 4.3, reliability 3.9). Credits: 1; a page beyond 1, another sort or a star filter costs 1 or 5 (credits_used says which). Failed upstream calls and refused inputs are not charged; a not-found is charged. ${SLOW}`,
    {
      ...modelYearShape,
      page: z.number().int().min(1).max(10).optional().describe("Page of 8 reviews (default 1, at most 10)."),
      sort: z.enum(REVIEW_SORTS).optional().describe("recent (default, most recent first), rating_desc (highest rated first) or rating_asc (lowest rated first)."),
      stars: z.number().int().min(1).max(5).optional().describe("Only reviews with this overall star rating (1-5)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_kbb_dealers",
    `Car dealers near a US ZIP code on ${FIRST}, optionally of one make and within a radius: search, location {zip, place, radius_miles}, count, dealers [{dealer_id (the input of get_kbb_dealer), name, franchise_name, make, rating, rating_count, distance_miles, address {street, street2, city, state, zip}, phone, website, url}] (at most 50, nearest first as KBB orders them; the dealer finder does not page, so narrow with radius or make), market, notes. Dealer details are the dealer's public business details. Captured 2026-11-26: ZIP 10001 (New York, NY, 25 miles) gave 50 dealers. ${ONE} ${SLOW}`,
    {
      zip: zip.describe("Required. A 5-digit US ZIP code (e.g. 10001): dealers near it."),
      make: z.string().min(1).max(40).optional().describe("Only dealers of this make (by name or code, e.g. Toyota)."),
      radius: radius(DEALER_RADII, "any"),
    },
    post("dealers"),
  );

  server.tool(
    "get_kbb_dealer",
    `One dealer on ${NAME} by dealer id or link: dealer_id, name, rating, rating_count, address, phone, website, hours, home_services {buy_online, test_drive, vehicle_delivery, virtual_tour}, is_open, url, inventory_count (the dealer's listings on KBB), price_stats {min, avg, max}, makes [{make, make_code, count}], inventory_sort, inventory [the search tile fields] (the first page as the dealer page shows it; each listing_id opens with get_kbb_listing), market, notes. Dealer reviews are not included (rating and rating_count only). Captured 2026-11-26: dealer 87788 in Irving, TX had 496 listings on KBB, priced from 13054 to 216535 USD. An unknown id is a charged 404. ${ONE} ${SLOW}`,
    {
      dealer_id: z.union([z.string().min(1).max(20), z.number().int().positive()]).optional()
        .describe("A KBB dealer id (get_kbb_dealers dealers[].dealer_id, listings[].seller.dealer_id, e.g. 68613). Send dealer_id or url."),
      url: z.string().min(10).max(2000).optional()
        .describe("Or a KBB dealer link (https://www.kbb.com/dealers/<city-st>/<id>/<name>/)."),
    },
    post("dealer"),
  );

  server.tool(
    "get_kbb_makes_models",
    `${NAME}'s make and model directory, used (every model year KBB values) or new: vehicle_class, make, make_count, count, makes [{make, make_slug, model_count}], models [{make, make_slug, model, model_slug, years}] (the slugs get_kbb_car_value, get_kbb_model and get_kbb_reviews take), market, notes. Optionally one make. Captured 2026-11-26: used gave 68 makes and 1519 models. ${ONE} ${SLOW}`,
    {
      vehicle_class: z.enum(["used", "new"]).optional().describe("used (default: every model year KBB values) or new (models sold new)."),
      make: z.string().min(1).max(40).optional().describe("Only this make's models (e.g. Toyota)."),
    },
    post("makes-models"),
  );
}
