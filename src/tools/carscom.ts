import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/carscom.ts (US only, no country). Rules the backend enforces
// and zod here does not: radius, mileage_max, page_size and min_rating take Cars.com's steps only;
// year_min <= year_max and price_min <= price_max; years 1900-2028; model needs make, trims need
// make and model; list filters take at most trims 10, drivetrain 4, exterior_color 12,
// deal_rating 3, body_style 10 values; listing takes listing_id or url, the dealer tools
// dealer_id or url (one of each, naming the same item); research level model / model_year /
// trims needs model, model_year and trims need year. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const STOCK_TYPES = ["all", "new", "used", "cpo", "new_cpo"] as const;
const SORTS = ["best_match", "price_low", "price_high", "mileage_low", "mileage_high", "distance", "best_deal", "year_newest", "year_oldest", "listed_newest", "listed_oldest"] as const;
const RADII = [10, 20, 30, 40, 50, 75, 100, 150, 200, 250, 500, 750, 1000];
const MILEAGES = [10_000, 20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000, 100_000, 150_000, 200_000, 250_000];
const REVIEW_SORTS = ["most_recent", "lowest_rated", "most_helpful", "highest_rated"] as const;
const DEALER_REVIEW_PAGE_SIZES = [10, 20, 30, 40];
const MODEL_REVIEW_PAGE_SIZES = [10, 20, 30, 50, 100, 200];
const DEALER_SORTS = ["rating", "name", "distance"] as const;
const DEALER_RADII = [10, 20, 30, 40, 50, 75, 100, 150, 200, 250, 500];
const RESEARCH_LEVELS = ["make", "model", "model_year", "trims"] as const;

const FIRST = "Cars.com (cars.com, the US car marketplace run by Cars Commerce)";
const NAME = "Cars.com";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRIVATE =
  "No VINs, stock numbers, private-seller names or contact details, reviewer names or towns, or dealer employee names are returned; the dealer's business name, address, phone, website and hours are kept. US only, prices in USD (asking prices as the seller lists them).";

const list = (description: string) =>
  z.union([z.string().max(400), z.array(z.string().max(80)).max(12)]).optional().describe(description);
const zip = z.union([z.string().min(5).max(10), z.number().int()])
  .describe("Required. A 5-digit US ZIP code (e.g. 10001): Cars.com searches around it. An unknown ZIP is a 400, not charged.");
const make = z.string().max(40)
  .describe("A make as Cars.com lists it (Toyota, Ford, Land Rover, Mercedes-Benz ...) or its slug (land_rover).");
const model = z.string().max(60)
  .describe("A model of make: the name (RAV4, F-150, CR-V) or Cars.com's slug (rav4, f_150, cr_v; toyota-rav4 also accepted). Needs make.");
const year = z.number().int().min(1900).max(2028);
const page = (max: number, size: string) => z.number().int().min(1).max(max).optional().describe(`Page (default 1, at most ${max}); ${size}.`);
const dealerId = {
  dealer_id: z.union([z.string().min(1).max(2000), z.number().int().positive()]).optional()
    .describe("A Cars.com dealer id (digits, e.g. 97701: a listing's dealer.dealer_id or get_carscom_dealers items[].dealer_id) or a cars.com/dealers/<id>/ link. Send dealer_id or url."),
  url: z.string().max(2000).optional().describe("A cars.com/dealers/<id>/ link instead of dealer_id."),
};
const reviewSort = z.enum(REVIEW_SORTS).optional().describe("most_recent (default), lowest_rated, most_helpful, highest_rated.");

export function registerCarscomTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/carscom/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_carscom",
    `Search the car listings of ${FIRST}: new, used and certified cars around a US ZIP with a radius, by make and model, sorted (Cars.com's 11 sorts) and filtered by year, price, mileage, trims, drivetrain, color, Cars.com deal rating, body style, seller type and keyword; 24 a page, up to page 417. Returns search_title, location, stock_type, sort, page, total (Cars.com's count, capped at 10,000: total_capped), total_pages, has_more, filters_applied, filters_not_applied (values Cars.com ignored, e.g. a model it does not list; also said in notes), count, items [{listing_id (the input of get_carscom_listing), url, title, year, make, model, trim, stock_type, certified, dealer_verified_condition, price, msrp (new only), mileage, body_style, drivetrain, exterior_color, fuel_type, price_stack, price_drop (as the card shows it), photo_count, image, badges [{label, description}] (Cars.com's deal and demand labels with its explanation), delivery, seller {seller_type, name (dealers only), city, state, zip, rating, distance_miles}, sponsored (a paid placement), placement, position}], facets (include_facets), market, notes. Captured 2026-11-26: used Toyota RAV4 around 10001 (New York, 50 miles) gave 700 listings; Ford F-150 around 75201 (Dallas) sorted price_low gave 4401 listings, the first a 2005 F-150 XL at 3900 USD. ${PRIVATE} ${ONE}`,
    {
      zip,
      stock_type: z.enum(STOCK_TYPES).optional()
        .describe("all (default: new, used and certified), new, used, cpo (certified pre-owned), new_cpo (new and certified)."),
      make: make.optional(),
      model: model.optional(),
      radius: z.number().int().optional().describe(`Miles around the ZIP: one of ${RADII.join(", ")} (default 50).`),
      page: page(417, "24 listings a page"),
      sort: z.enum(SORTS).optional()
        .describe("best_match (default), price_low, price_high, mileage_low, mileage_high, distance, best_deal, year_newest, year_oldest, listed_newest, listed_oldest."),
      year_min: year.optional().describe("Earliest model year (1900-2028)."),
      year_max: year.optional().describe("Latest model year (1900-2028)."),
      price_min: z.number().int().min(0).optional().describe("Lowest list price, whole USD."),
      price_max: z.number().int().min(0).optional().describe("Highest list price, whole USD."),
      mileage_max: z.number().int().optional().describe(`Most miles, one of Cars.com's steps: ${MILEAGES.join(", ")}.`),
      trims: list("Trims of make + model (names or slugs; one, a list, or comma-separated; at most 10), e.g. XLE, XLE Premium. Needs make and model."),
      drivetrain: list("all_wheel_drive, four_wheel_drive, front_wheel_drive, rear_wheel_drive (or awd, 4wd, fwd, rwd); one or a list."),
      exterior_color: list("Exterior colors (black, white, gray, silver, blue, red ...); one or a list, at most 12."),
      deal_rating: list("Cars.com deal ratings: great, good, fair; one or a list."),
      body_style: list("Body styles (suv, sedan, truck, coupe, hatchback, minivan, wagon, convertible ...); one or a list, at most 10."),
      seller_type: z.enum(["dealership", "private"]).optional().describe("dealership or private (private sellers)."),
      keyword: z.string().max(100).optional().describe("Cars.com's keyword filter: words in the listing (e.g. tow package)."),
      include_facets: z.boolean().optional().describe("true also returns facets: the site's filter options with result counts for this search. Default false."),
    },
    post("search"),
  );

  server.tool(
    "get_carscom_listing",
    `One car listing on ${FIRST} by listing id or link: listing_id, url, title, year, make, model, trim, stock_type, certified, price, msrp (new only), mileage, body_style, category, colors, fuel_type, drivetrain, engine, transmission, mpg, photo_count, badges [{label, description}], price_stack, price_breakdown {disclosed, vehicle_price, fees [{label, amount}], all_in_price}, deal {rating, summary, good_deal_range_low, good_deal_range_high, market_position} (Cars.com's price analysis as stated), price_history {summary, entries [{date, change (listed, drop, increase), change_amount, price}]}, features [{group, items}], history {source, title, accidents, owners, prior_use, recalls and flags} (used), cpo {package, program, certified_by, terms}, seller_notes, seller_type (dealership or private), dealer {dealer_id, name, rating, review_count, address, website, hours, url} (dealers only), market, notes. Captured 2026-11-26: a used 2018 Toyota RAV4 XLE at 21799 USD with 48538 miles, rated a good deal (good deal range 20394-22683 USD), listed at 22399 and dropped twice. A listing that is no longer available is a charged 404. ${PRIVATE} ${ONE}`,
    {
      listing_id: z.string().max(2000).optional()
        .describe("A Cars.com listing id (search_carscom items[].listing_id, e.g. 90e3df05-5f5e-4f4d-a474-79eb2077c99a) or a cars.com/vehicledetail/<id>/ link. Send listing_id or url."),
      url: z.string().max(2000).optional().describe("A cars.com/vehicledetail/<id>/ link instead of listing_id."),
    },
    post("listing"),
  );

  server.tool(
    "get_carscom_dealer",
    `A car dealer's public profile on ${FIRST} by dealer id: dealer_id, name, url, rating, review_count, phone, website, address, latitude, longitude, description, opening_hours, hours [{day, sales, service}], service {name, phone, opening_hours}, inventory_count, awards, award_count, on_cars_com_since, image, market, notes. Captured 2026-11-26: dealer 97701 (Queens Auto Mall of Jamaica, Richmond Hill, NY) rated 3.6 from 2145 reviews. An unknown id is a charged 404. ${PRIVATE} ${ONE}`,
    dealerId,
    post("dealer"),
  );

  server.tool(
    "get_carscom_dealer_inventory",
    `A dealer's vehicles for sale on ${FIRST}, 24 a page in the order the dealer page lists them: dealer {dealer_id, name, url, rating, review_count}, page, total, total_pages, has_more, count, items [{listing_id, url, year, make, model, trim, stock_type, certified, price, msrp (new only), mileage, body_style, drivetrain, colors, fuel_type, photo_count, deal_badge (Great, Good or Fair Deal as the card shows it), cpo_package, sponsored}], market, notes. Captured 2026-11-26: dealer 97701 listed 150 vehicles on 7 pages. An unknown id is a charged 404. ${ONE}`,
    { ...dealerId, page: page(500, "24 vehicles a page") },
    post("dealer-inventory"),
  );

  server.tool(
    "get_carscom_dealer_reviews",
    `A dealer's customer reviews on ${FIRST}, paged (10-40 a page) and sorted most_recent, lowest_rated, most_helpful or highest_rated: dealer, rating, total, sort, page, page_size, total_pages, has_more, count, reviews [{rating, title, date, text, category_ratings, recommends, shopped_for, made_purchase, helpful_votes, total_votes}], market, notes. No star filter exists on the site. Reviewer names and towns and "worked with" employees are not returned. Captured 2026-11-26: dealer 97701 had 2145 reviews, 215 pages of 10. An unknown id is a charged 404. ${ONE}`,
    {
      ...dealerId,
      page: page(1000, "page_size reviews a page"),
      page_size: z.number().int().optional().describe(`Reviews a page: ${DEALER_REVIEW_PAGE_SIZES.join(", ")} (default 20).`),
      sort: reviewSort,
    },
    post("dealer-reviews"),
  );

  server.tool(
    "get_carscom_model_reviews",
    `Owner (consumer) reviews of one model year on ${FIRST}, by make, model and year, paged (10-200 a page) and sorted most_recent, lowest_rated, most_helpful or highest_rated: vehicle, msrp_range, rating, total, recommend_percent, category_ratings, model_slug, sort, page, page_size, total_pages, has_more, count, reviews [{rating, title, date, text, category_ratings, recommends, owns_this_car, purchased, used_for, helpful_votes, total_votes}], market, notes. No star filter exists on the site. Reviewer names and towns are not returned. Captured 2026-11-26: the 2019 Toyota RAV4 rated 4.4 from 458 reviews, 82 percent recommend. An unknown model year is a charged 404. ${ONE}`,
    {
      make: make.describe("Required. A make as Cars.com lists it (e.g. Toyota) or its slug."),
      model: model.describe("Required. A model of make: the name (RAV4) or Cars.com's slug (rav4)."),
      year: year.describe("Required. The model year (e.g. 2019)."),
      page: page(1000, "page_size reviews a page"),
      page_size: z.number().int().optional().describe(`Reviews a page: ${MODEL_REVIEW_PAGE_SIZES.join(", ")} (default 20).`),
      sort: reviewSort,
    },
    post("model-reviews"),
  );

  server.tool(
    "get_carscom_dealers",
    `Find car dealers on ${FIRST} around a US ZIP with a radius, by make, minimum rating and dealer name, sorted by rating (default), name or distance: location, filters, sort, page, total, has_more, count, items [{dealer_id (the input of the dealer tools), name, url, rating, review_count, address, distance_miles, inventory_count, phones [{label, number}]}], market, notes. About 20 dealers a page. Captured 2026-11-26: 734 dealers within 30 miles of 90012 (Los Angeles). ${ONE}`,
    {
      zip,
      radius: z.number().int().optional().describe(`Miles around the ZIP: one of ${DEALER_RADII.join(", ")} (default 30).`),
      make: make.optional().describe("Only dealers that sell this make (Cars.com's make filter)."),
      min_rating: z.number().int().optional().describe("Lowest dealer rating: 1, 2, 3 or 4 (& up)."),
      sort: z.enum(DEALER_SORTS).optional().describe("rating (default), name, distance."),
      dealer_name: z.string().max(80).optional().describe("Words in the dealer's name (e.g. toyota)."),
      page: page(500, "about 20 dealers a page"),
    },
    post("dealers"),
  );

  server.tool(
    "get_carscom_research",
    `Car research pages on ${FIRST}, as Cars.com publishes them: level make (description, lineup, models), model (generations, competitors, model years with price range and rating), model_year (average listing price on used years or starting price on new ones, MPG, ratings, NHTSA score, notable features, the good and the bad, warranty, trims with price) or trims (starting MSRP, combined MPG, engine, drivetrain, transmission, seating). Returns level, slug and the level's fields, market, notes. Captured 2026-11-26: the 2022 Toyota RAV4 had an average listing price of 26697 USD, 27 city / 35 highway MPG and an NHTSA score of 5. An unknown make, model or year is a charged 404. ${NAME} research is US only. ${ONE}`,
    {
      make: make.describe("Required. A make as Cars.com lists it (e.g. Toyota) or its slug."),
      model: model.optional(),
      year: year.optional().describe("A model year (with model), e.g. 2022."),
      level: z.enum(RESEARCH_LEVELS).optional()
        .describe("make, model, model_year or trims. Default: make without model, model without year, model_year with year. model, model_year and trims need model; model_year and trims need year."),
    },
    post("research"),
  );
}
