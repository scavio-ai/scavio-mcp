import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/edmunds.ts (US only, USD, no country). Rules the backend
// enforces and zod here does not: search needs city and state (a US city name and its state) and
// refuses zip with a 400 (Edmunds places a search by its own city pages); make and model go
// together (leave both out to search every make, used only); condition new needs make and model;
// trim needs make and model; *_min <= *_max; model years run 1990 to 2028; make must be one Edmunds
// lists (get_edmunds_makes). listing takes vin with make, model and year, or url; dealer takes
// dealer_id or url. VINs are input only: never returned.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["best_match", "price_asc", "price_desc", "mileage_asc", "newest_listed"] as const;
const REVIEW_SORTS = ["most_helpful", "most_recent", "highest_rated", "lowest_rated"] as const;
const RADII = [10, 25, 50, 75, 100, 200, 500] as const;
const DRIVETRAINS = ["all_wheel_drive", "four_wheel_drive", "front_wheel_drive", "rear_wheel_drive", "awd", "4wd", "fwd", "rwd"] as const;
const COLORS = ["black", "white", "gray", "silver", "blue", "red", "brown", "green", "beige", "gold", "orange", "yellow", "purple"] as const;
const BODY_TYPES = ["suv", "sedan", "pickup", "truck", "hatchback", "coupe", "convertible", "minivan", "wagon"] as const;
const DEAL_RATINGS = ["great", "good", "fair"] as const;

const FIRST = "Edmunds (edmunds.com, the US car research and shopping site owned by CarMax)";
const NAME = "Edmunds";
const TWO = "Costs 2 credits (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRIVATE =
  "VINs are input only and never returned (listing photos are not returned: every Edmunds photo link carries the VIN); no stock numbers; private sellers city and state only; reviewer names are never returned. Dealer business name, address, phone, website, hours and ratings are kept.";
const DEAL =
  "deal_rating {local, national} is Edmunds' own deal rating as Edmunds gives it (Great, Good, Fair, Above_market ...) with Edmunds' list_price_estimate, max_great_price, max_good_price, max_fair_price, savings and savings_percent.";

const year = z.number().int().min(1990).max(2028);
const make = z.string().min(1).max(40)
  .describe("Required. A make Edmunds lists (Toyota, Ford, Land Rover, Mercedes-Benz ...) or its slug (land-rover); get_edmunds_makes lists all 69.");
const model = z.string().min(1).max(60)
  .describe("Required. A model of make: its name (RAV4, F-150, CR-V, Grand Cherokee) or Edmunds' slug (rav4, f-150). An unknown model is a charged 404.");
const modelYear = {
  make,
  model,
  year: year.describe("Required. The model year (e.g. 2022)."),
};
const trim = z.string().min(1).max(60).optional()
  .describe("Only this trim, as Edmunds names it (e.g. XLE). A trim the page does not list is a charged 404 that lists the page's trims.");

export function registerEdmundsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/edmunds/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_edmunds",
    `Search the car listings of ${FIRST}: used (with certified pre-owned) or new cars around a US city (city + state; Edmunds places a search by its own city pages, so a ZIP is not accepted), by make and model or every make (used), with a radius, 5 sorts and filters for year, price, mileage, trim, drivetrain, exterior colour, body type, Edmunds deal rating and no accidents; 21 a page. Returns condition, make, model, location {city, state, zip} (the city Edmunds searched around), radius (the radius Edmunds used), sort, page, page_size, total, total_pages, has_more, filters_applied, count, items [{position, condition (new, used, certified), year, make, model, trim, style, style_id, body_type, mileage, colors, drivetrain, engine, transmission, mpg, seats, features, photo_count, stock_image, price, price_change, msrp, estimated_monthly_payment, deal_rating, days_on_edmunds, estimated_days_to_sell, listed_at, history {owners, accidents, usage, clean_title}, in_transit, seller {type, dealer_id, name, street, city, state, zip, distance_miles, rating, review_count, phone, url}}], market, notes. ${DEAL} Captured 2026-11-26: a used Toyota RAV4 around New York, NY (25 miles) gave 3124 listings (149 pages), among them a 2015 RAV4 Limited at 7995 USD with 157526 miles, rated Great against Edmunds' local estimate of 13201 USD, at a dealer in Carlstadt, NJ, 8.6 miles away. When Edmunds has no listing matching every filter, items is empty. ${PRIVATE} US only, USD. ${TWO}`,
    {
      city: z.string().min(1).max(60).describe("Required. A US city (New York, Los Angeles, Dallas, small towns too): Edmunds searches around its own page for that city. An unknown city is a charged 404."),
      state: z.string().min(2).max(30).describe("Required. The city's state, 2-letter code (NY) or name."),
      condition: z.enum(["used", "new"]).optional().describe("used (default; used and certified pre-owned) or new (needs make and model)."),
      make: z.string().min(1).max(40).optional().describe("A make (with model), e.g. Toyota. Leave make and model out to search every make (used only)."),
      model: z.string().min(1).max(60).optional().describe("A model of make (with make), e.g. RAV4, Civic, F-150."),
      radius: z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(75), z.literal(100), z.literal(200), z.literal(500)]).optional()
        .describe(`Miles around the city: ${RADII.join(", ")} (default 25).`),
      page: z.number().int().min(1).max(500).optional().describe("Page, from 1 (default 1); 21 listings a page."),
      sort: z.enum(SORTS).optional().describe("best_match (default), price_asc, price_desc, mileage_asc, newest_listed."),
      year_min: year.optional().describe("Earliest model year."),
      year_max: year.optional().describe("Latest model year."),
      price_min: z.number().int().min(0).max(5_000_000).optional().describe("Lowest price, whole USD."),
      price_max: z.number().int().min(0).max(5_000_000).optional().describe("Highest price, whole USD."),
      mileage_min: z.number().int().min(0).max(1_000_000).optional().describe("Fewest miles."),
      mileage_max: z.number().int().min(0).max(1_000_000).optional().describe("Most miles."),
      trim: z.string().min(1).max(40).optional().describe("Needs make and model. A trim as Edmunds names it (XLE, LX, Lariat)."),
      drivetrain: z.enum(DRIVETRAINS).optional().describe("all_wheel_drive, four_wheel_drive, front_wheel_drive, rear_wheel_drive (or awd, 4wd, fwd, rwd)."),
      exterior_color: z.enum(COLORS).optional().describe(`Exterior colour: ${COLORS.join(", ")}.`),
      body_type: z.enum(BODY_TYPES).optional().describe("Body type as Edmunds labels it: suv, sedan, pickup (or truck), hatchback, coupe, convertible, minivan, wagon."),
      deal_rating: z.enum(DEAL_RATINGS).optional().describe("Edmunds' deal rating: great, good or fair."),
      no_accidents: z.boolean().optional().describe("Only listings with no reported accidents."),
    },
    post("search"),
  );

  server.tool(
    "get_edmunds_listing",
    `One car listing on ${NAME} by VIN with make, model and year, or by its edmunds.com link (input only: the VIN is never returned): the vehicle (year, make, model, trim, style, mileage, colors, drivetrain, engine, transmission, mpg, seats, options, highlighted_features), price, advertised_price, price_change, msrp, base_msrp, total_msrp, destination_fee, dealer_fees [{name, amount, included_in_price}], estimated_monthly_payment, price_history {total_change, entries [{price, date}]}, deal_rating, days_on_edmunds, estimated_days_to_sell, selling_slowly, listed_at, history (owners, accidents, usage, clean title, salvage, frame damage, lemon and theft flags and the provider, as given), seller_comments, seller (dealer details with hours [{day, open, close, closed}], websites and url), market, notes. ${DEAL} Captured 2026-11-26: a listing at a Dallas dealer at 24128 USD against an MSRP of 26975 USD, rated Great locally (Edmunds' estimate 29801 USD, savings 19 percent). A sold or unknown listing is a charged 404. ${PRIVATE} ${TWO}`,
    {
      vin: z.string().regex(/^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$/).optional()
        .describe("A 17-character VIN (input only; never returned), with make, model and year. Send vin with make, model and year, or url."),
      make: z.string().min(1).max(40).optional().describe("The listing's make (with vin), e.g. Toyota."),
      model: z.string().min(1).max(60).optional().describe("The listing's model (with vin), e.g. RAV4."),
      year: year.optional().describe("The listing's model year (with vin)."),
      url: z.string().min(20).max(2000).optional()
        .describe("Or an edmunds.com listing link (https://www.edmunds.com/<make>/<model>/<year>/vin/...), instead of vin, make, model and year."),
    },
    post("listing"),
  );

  server.tool(
    "get_edmunds_reviews",
    `Owner (consumer) reviews of one model year on ${NAME}, 5 a page, 4 sorts and a star filter: make, model, year, rating, total_reviews, star_counts [{stars, count}], sort, stars, total_matching, page, page_size, total_pages, has_more, pros, cons (the topics Edmunds groups reviews by), styles [{style_id, name, review_count}], count, reviews [{id, rating, title, text, style, style_id, created, updated, helpful_votes, unhelpful_votes, ratings {safety, technology, performance, interior, comfort, reliability, value}}], market, notes. Captured 2026-11-26: the 2022 Honda Civic rated 3.9 from 101 reviews (21 pages). Reviewer names are never returned. An unknown model year is a charged 404. ${TWO}`,
    {
      ...modelYear,
      page: z.number().int().min(1).max(1000).optional().describe("Page, from 1 (default 1); 5 reviews a page."),
      sort: z.enum(REVIEW_SORTS).optional().describe("most_helpful (default), most_recent, highest_rated, lowest_rated."),
      stars: z.number().int().min(1).max(5).optional().describe("Only reviews with this many stars (1-5)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_edmunds_dealer",
    `A car dealer's page on ${NAME} by dealer id or link (search_edmunds and get_edmunds_listing give both): dealer_id, name, parent_group, franchise_make, url, websites, address, latitude, longitude, phones, hours [{day, open, close, closed}], verified, sales_rating and service_rating {average, count, recommended, not_recommended}, inventory {total, new, used, certified, models [{make, model, total, new, used, certified}]}, reviews_total, page, page_size, total_pages, has_more, count, reviews [{id, rating, type (sales or service), title, text, created, updated, recommends_dealer, bought_here, dealer_replies [{text, date}]}], market, notes. 21 reviews a page, newest first; each review appears once across pages. Captured 2026-11-26: Jake Sweeney Mitsubishi in Cincinnati, OH, sales rating 5 from 23 ratings, 157 cars in inventory, 63 reviews. Reviewer names are never returned and are taken out of the dealer's replies. An unknown dealer is a charged 404. ${TWO}`,
    {
      dealer_id: z.string().regex(/^[A-Za-z0-9]+_\d{1,12}$/).optional()
        .describe("An Edmunds dealer id as search and listing give it (seller.dealer_id, e.g. JakeSweeneyMitsubishi_891713). Send dealer_id or url."),
      url: z.string().min(20).max(2000).optional()
        .describe("Or an edmunds.com dealer link (seller.url: https://www.edmunds.com/dealerships/all/<state>/<city>/<dealer id>/)."),
      page: z.number().int().min(1).max(500).optional().describe("Review page, from 1 (default 1); 21 reviews a page, newest first."),
    },
    post("dealer"),
  );

  server.tool(
    "get_edmunds_model",
    `A model year's research page on ${NAME} (default: the current model year): make, model, make_slug, model_slug, year, msrp_range {low, high}, styles [{style_id, name, trim, base_msrp, base_invoice, seats, body_type, sold_as, exterior_colors, specs {group: [{name, value}]}}], editorial_review {title, published, updated, rating, scale, ratings, verdict, summary, pros, cons, recommended_trim} (Edmunds' expert review), consumer_rating {average, count, star_counts}, inventory {near, new, used, certified, total, used_listings} (Edmunds' listing counts near the place Edmunds uses), market, notes. Captured 2026-11-26: the 2025 Toyota RAV4, MSRP 29800 to 39505 USD, Edmunds' expert rating 6.9 out of 10, owners' average 4.1. An unknown model or year is a charged 404. ${TWO}`,
    {
      make,
      model,
      year: year.optional().describe("A model year (default: Edmunds' current model year)."),
    },
    post("model"),
  );

  server.tool(
    "get_edmunds_price",
    `MSRP, invoice price and Edmunds Suggested Price per trim of one model year on ${NAME}: make, model, year, trim, count, trims [{trim, msrp, invoice (null where Edmunds shows N/A), edmunds_suggested, most_popular}], table_note, suggested_price_near {city, state, zip, text} (the place Edmunds computes its suggested price for, as Edmunds states it; read it with the price), sales_through, market, notes. Captured 2026-11-26: the 2025 Toyota RAV4 XLE (most popular) at 32760 USD MSRP, 30725 invoice and an Edmunds Suggested Price of 30140, near Paramus, NJ 07652. Figures as Edmunds gives them. An unknown model year is a charged 404. ${TWO}`,
    { ...modelYear, trim },
    post("price"),
  );

  server.tool(
    "get_edmunds_appraisal",
    `Used-car values of one model year on ${NAME}, per style and condition (outstanding, clean, average, rough) as Edmunds gives them: make, model, year, trim, estimated_mileage (the mileage Edmunds assumes), values_near {city, state} (the place Edmunds computes its values for), count, styles [{style_id, style, base_msrp, base_invoice, values_updated, conditions {outstanding, clean, average, rough: {dealer_retail, private_party, trade_in, auction}}}], market, notes. Captured 2026-11-26: a 2020 Toyota RAV4 LE AWD in clean condition at an assumed 72000 miles, near Paramus, NJ: dealer retail 23946, private party 21638, trade-in 19036 USD. Edmunds' estimates, not an offer. An unknown model year is a charged 404. ${TWO}`,
    { ...modelYear, trim },
    post("appraisal"),
  );

  server.tool(
    "get_edmunds_makes",
    `Every make on ${NAME} (69) and one make's models: make, make_slug, models_count, models [{name, slug (the model input of the other Edmunds tools), latest_year, vehicle_type, new, used, submodels}], makes_count, makes [{name, slug, new, used}], market, notes. Captured 2026-11-26: Toyota had 31 models. ${TWO}`,
    {
      make: z.string().min(1).max(40).describe("Required. A make (e.g. Toyota): its models are returned with every make Edmunds lists."),
    },
    post("makes"),
  );
}
