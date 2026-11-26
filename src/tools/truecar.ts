import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/truecar.ts (US only, USD, no country). Rules the backend
// enforces and zod here does not: model needs make, trim needs make and model; *_min <= *_max;
// model years run 1981 to next year + 1; drivetrains / colors / fuel_types take at most 10 values
// each from TrueCar's lists; zip is a 5-digit ZIP; listing takes one of vin or url (a 17-character
// VIN, letters except I, O and Q); dealer and dealer-inventory take one of dealer_id or url;
// suggestions need at least 2 characters. Keyword search, mileage_min, seller_type and a review
// sort are refused with a 400 (not charged). The VIN is input only: it is never returned.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = [
  "best_match",
  "best_deal",
  "lowest_price",
  "highest_price",
  "nearest",
  "lowest_mileage",
  "highest_mileage",
  "oldest_year",
  "newest_year",
  "newest_listed",
] as const;
const BODY_STYLES = ["convertible", "coupe", "hatchback", "sedan", "suv", "truck", "van", "wagon"] as const;
const DRIVETRAINS = ["4wd", "awd", "fwd", "rwd"] as const;
const COLORS = ["beige", "black", "blue", "brown", "gold", "gray", "green", "orange", "purple", "red", "silver", "white", "yellow"] as const;
const FUEL_TYPES = ["gas", "hybrid", "electric", "diesel", "plug_in_hybrid"] as const;
const MAX_YEAR = new Date().getUTCFullYear() + 2;

const FIRST = "TrueCar (truecar.com, the US car-buying marketplace)";
const NAME = "TrueCar";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_VIN = "No VIN, stock number, listing link or dealer photo is returned (TrueCar's listing links and photos carry the VIN), so search results cannot be passed to get_truecar_listing.";
const TILE =
  "year, make, model, trim, style, condition, certified_pre_owned, price, msrp, base_msrp, price_label, price_rating (TrueCar's own label as given), no_extra_dealer_fees, mileage, exterior_color, exterior_color_generic, interior_color, drivetrain, engine, fuel_type, transmission, body_style, mpg {city, highway, combined}, electric_range, key_features, history {accident_count, owner_count, clean_title}, listed_at, days_on_market, distance_miles, nationwide_delivery, dealer {id, name, group, address, city, state, zip}, currency";

const make = z.string().min(1).max(60)
  .describe("A make name or slug as TrueCar writes it (get_truecar_makes lists them): Toyota, Ford, Mercedes-Benz, land-rover.");
const model = z.string().min(1).max(60)
  .describe("A model name or slug as TrueCar writes it (get_truecar_models lists a make's models): RAV4, F-150, CR-V.");
const year = z.number().int().min(1981).max(MAX_YEAR);
const condition = z.enum(["used", "new"]).optional().describe("used (default) or new.");
const list = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.array(z.enum(values)).min(1).max(10).optional().describe(`Up to 10 ${label}: ${values.join(", ")}.`);

const dealerShape = {
  dealer_id: z.union([z.string().regex(/^\d{1,9}$/), z.number().int().positive()]).optional()
    .describe("A TrueCar dealer id (items[].dealer.id from search_truecar, e.g. 414984; the number at the end of a truecar.com dealership link). Send dealer_id or url."),
  url: z.string().min(20).max(400).optional()
    .describe("Or a truecar.com dealership link (https://www.truecar.com/dealership/<name>-<id>/...)."),
};

export function registerTruecarTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/truecar/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_truecar",
    `Search the new or used dealer inventory of ${FIRST} around a US ZIP, by make and model (names or slugs), 30 vehicles a page, with TrueCar's ten sorts and its filters: radius, model year, price, maximum mileage, trim, body style, drivetrains, colors, fuel types, accident-free and certified pre-owned. Returns condition, zip, make, model, sort, sort_applied, page, page_size, total (TrueCar's count caps at 10,000: total_capped), total_pages, has_more, count, is_fallback, filters_applied (TrueCar's own echo), items [{${TILE}}], national (TrueCar's national price range, per-trim average listed price and counts by year for the make and model), market, notes. TrueCar also lists vehicles from dealers far outside the radius (offered with delivery): read distance_miles. Captured 2026-11-26: a used Toyota RAV4 around 10001 gave 2440 vehicles (82 pages), the first a 2017 RAV4 Hybrid XLE at 16485 USD with 125334 miles, 5.8 miles away; a new Ford F-150 around 75201 by lowest price gave 1705, the first a 2026 F-150 XL at 39063 USD (MSRP 40085). ${NO_VIN} An unknown make or model is a charged 404. No keyword search (use make / model or get_truecar_suggestions), no mileage minimum, no private sellers. US only, USD. ${ONE}`,
    {
      zip: z.string().regex(/^\d{5}$/).describe("Required. A 5-digit US ZIP code (e.g. 10001): TrueCar searches dealers around it."),
      condition,
      make: make.optional(),
      model: model.optional().describe("Needs make. A model name or slug as TrueCar writes it: RAV4, F-150, CR-V."),
      trim: z.string().min(1).max(60).optional().describe("Needs make and model. One trim name or slug (national.trims lists them, e.g. XLE)."),
      body_style: z.enum(BODY_STYLES).optional().describe(`One of ${BODY_STYLES.join(", ")}.`),
      radius: z.number().int().min(1).max(500).optional()
        .describe("Miles around the ZIP, 1-500 (TrueCar's default: 75 used, 150 new)."),
      year_min: year.optional().describe("Model year from (e.g. 2020)."),
      year_max: year.optional().describe("Model year to."),
      price_min: z.number().int().min(0).max(5_000_000).optional().describe("Price from, USD."),
      price_max: z.number().int().min(1).max(5_000_000).optional().describe("Price to, USD (e.g. 30000)."),
      mileage_max: z.number().int().min(0).max(1_000_000).optional().describe("Mileage up to (e.g. 40000). TrueCar takes a maximum only."),
      drivetrains: list(DRIVETRAINS, "drivetrains"),
      colors: list(COLORS, "exterior colors"),
      fuel_types: list(FUEL_TYPES, "fuel types"),
      accident_free: z.boolean().optional().describe("Only vehicles with no reported accident."),
      certified_pre_owned: z.boolean().optional().describe("Only certified pre-owned vehicles."),
      sort: z.enum(SORTS).optional().describe(`TrueCar's sorts: ${SORTS.join(", ")} (default best_match).`),
      page: z.number().int().min(1).max(334).optional().describe("Page, from 1 (default 1); 30 vehicles a page, up to page 334."),
    },
    post("search"),
  );

  server.tool(
    "get_truecar_listing",
    `One listing of ${NAME} by VIN or truecar.com listing link (input only: the VIN is never returned). search_truecar returns no VIN or link, so this takes a VIN or link you already have. Returns year, make, model, trim, style, condition, price, msrp, price_label, price_rating (TrueCar's label as given; TrueCar shows no basis), price_summary {advertised_price, msrp, discount, dealer_fees [{label, text, amount}], dealer_asking_price, taxes_and_fees, advertised_price_disclaimer}, mileage, colors, drivetrain, engine, fuel_type, transmission, body_style, mpg, key_features, highlights {technology, safety, comfort, appearance}, specs and features [{group, items [{name, value, units}]}], warranties, cpo_program, history (the history flags TrueCar shows: accidents, owners, fleet, rental, lemon, salvage, theft recovered, report date), seller_notes, listed_at, days_on_market, photo_count, stock_image, dealer {id, name, address, city, state, zip, type, phone, timezone, hours}, market, notes. Captured 2026-11-26: a used 2007 Honda Civic LX at 9990 USD with 45236 miles, TrueCar rating GREAT, at a dealer in Santa Ana, CA. No delivery quote, payment estimate, stock number, listing link or photo link. A VIN TrueCar does not list is a charged 404. ${ONE}`,
    {
      vin: z.string().regex(/^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$/).optional()
        .describe("A 17-character VIN of a vehicle listed on TrueCar (letters except I, O and Q, and digits). Input only: it is never returned. Send vin or url."),
      url: z.string().min(20).max(400).optional()
        .describe("Or a truecar.com listing link (https://www.truecar.com/used-cars-for-sale/listing/...)."),
    },
    post("listing"),
  );

  server.tool(
    "get_truecar_model",
    `${NAME}'s overview of one model (optionally one model year): make, model, make_slug, model_slug, year, generation, overview, pros, cons, whats_new, rating {value, count, stars {5..1}}, sub_ratings, trims [{trim, slug, starting_msrp, starting_market_average (TrueCar's "Starting Market Average" as labelled)}], body_styles, engine_types, transmissions, horsepower, combined_mpg, electric_range, seating, cargo_cubic_feet, max_towing_lbs, warranty, segment_ranking, has_new_inventory, has_used_inventory, model_years, national_new, national_used, image, market, notes. Captured 2026-11-26: the 2026 Toyota RAV4 rated 4.38 from 5069 owner ratings, LE trim from 33495 USD MSRP with a starting market average of 32766.12 USD, 4th on TrueCar's Best Compact SUVs list. An unknown make, model or year is a charged 404. ${ONE}`,
    {
      make: make.describe("Required. A make name or slug as TrueCar writes it (e.g. Toyota)."),
      model: model.describe("Required. A model name or slug as TrueCar writes it (e.g. RAV4)."),
      year: year.optional().describe("A model year (model_years lists them). Default: TrueCar's current model year."),
    },
    post("model"),
  );

  server.tool(
    "get_truecar_reviews",
    `Owner reviews of one model on ${NAME}, grouped by generation as TrueCar groups them (pass year for an earlier one). Filter by overall stars and by words in the text, up to 100 a page, in TrueCar's own order (no sort). Returns make, model, name, model_year, year, rating {value, count, stars}, stars, search, page, page_size, total, total_pages, has_more, count, reviews [{rating, sub_ratings [{name, value}], pros, cons, other_text, date, purchase_date, vehicle}], market, notes. Captured 2026-11-26: the Honda Civic rated 4.32 from 6185 owner ratings, 95 written reviews (5 pages of 20). No reviewer names, initials or states. An unknown make or model is a charged 404. ${ONE}`,
    {
      make: make.describe("Required. A make name or slug as TrueCar writes it (e.g. Honda)."),
      model: model.describe("Required. A model name or slug as TrueCar writes it (e.g. Civic)."),
      year: year.optional().describe("A model year: the reviews of that year's generation. Default: the current generation."),
      stars: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional().describe("Overall owner ratings to keep, 1-5 (e.g. [5])."),
      search: z.string().min(1).max(80).optional().describe("Words to match in the review text (e.g. mileage)."),
      page: z.number().int().min(1).max(500).optional().describe("Page, from 1 (default 1)."),
      page_size: z.number().int().min(1).max(100).optional().describe("Reviews a page, 1-100 (default 20)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_truecar_dealer",
    `One dealer's profile on ${NAME} by dealer id or dealership link: id, name, group, address, city, state, zip, phone, hours {monday..sunday: {open, close, closed}}, description, links [{type, url}] (website, social, inventory, service), services, online_dealer, hybrid_dealer, dealer_group, images, market, notes. Captured 2026-11-26: dealer 414984, Castle Volkswagen Downers Grove, 2020 Ogden Avenue, Downers Grove, IL. No employees. TrueCar shows no dealer reviews. An unknown dealer is a charged 404. ${ONE}`,
    dealerShape,
    post("dealer"),
  );

  server.tool(
    "get_truecar_dealer_inventory",
    `One dealer's new or used vehicles on ${NAME}, 30 a page: dealer {id, name, group, address, city, state, zip, phone}, condition, page, page_size, total, total_pages, has_more, count, items [{${TILE}}], market, notes. Captured 2026-11-26: dealer 414984 had 73 used vehicles (3 pages), among them a certified 2024 Volkswagen ID.4 Standard at 18133 USD with 35315 miles. ${NO_VIN} An unknown dealer is a charged 404. ${ONE}`,
    {
      ...dealerShape,
      condition,
      page: z.number().int().min(1).max(334).optional().describe("Page, from 1 (default 1); 30 vehicles a page."),
    },
    post("dealer-inventory"),
  );

  server.tool(
    "get_truecar_suggestions",
    `${NAME}'s own search suggestions for a text: query, did_you_mean, hint, count, suggestions [{type (make, model, trim, body_style), make, make_slug, model, model_slug, trim, trim_slug, body_style, body_style_slug, year, pages}], market, notes. The slugs are the make, model and trim inputs of search_truecar. ${ONE}`,
    {
      query: z.string().min(2).max(80).describe("Required. Text to complete (at least 2 characters): a make, model, trim or body style (e.g. rav4)."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_truecar_makes",
    `Every make with used inventory on ${FIRST}: count, makes [{make, slug}], national_new_count, national_used_count, market, notes. Captured 2026-11-26: 63 makes, 1099640 new and 743848 used vehicles nationally. ${ONE}`,
    {},
    post("makes"),
  );

  server.tool(
    "get_truecar_models",
    `One make's models on ${NAME}: make, make_slug, count, models [{model, slug, year, body_styles, engine_types, new_inventory, used_inventory, image}], market, notes. Captured 2026-11-26: Toyota had 47 models. An unknown make is a charged 404. ${ONE}`,
    {
      make: make.describe("Required. A make name or slug as TrueCar writes it (makes[].slug, e.g. toyota)."),
    },
    post("models"),
  );
}
