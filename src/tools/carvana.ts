import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/carvana.ts (US only, no market input). Rules the backend
// enforces and zod here does not: model needs make, trims needs make and model; city works only
// with make, model and page (a filter or a non-default sort with city is a 400); *_min <= *_max;
// model years 1980 to two years ahead; the list filters take the values named in each description
// (up to 10); vehicle takes vehicle_id or url. The route's "not offered" inputs (zip, postal_code,
// query, mileage_min, offering) are 400s and are not exposed here. No zod `.default()`: the MCP SDK
// would post a defaulted field on every call.

const SORTS = ["most_popular", "lowest_price", "highest_price", "lowest_mileage", "newest_year", "newest_listed"] as const;
const COLORS = "beige, black, blue, brown, gold, gray, green, orange, pink, purple, red, silver, white, yellow";
const TAGS = "great_deal, new_price, no_reported_accidents, single_owner, recently_added, low_miles_per_year";

const FIRST = "Carvana (carvana.com, the US online used-car retailer)";
const NAME = "Carvana";
const ONE =
  "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const MARKET = "US only, prices in USD, before taxes, title, registration and fees.";
const TILE =
  "vehicle_id (the input of get_carvana_vehicle), stock_number, url, year, make, model, model_variant, trim, kbb_trim, exterior_color, interior_color, body_style, mileage, mpg, fuel_type, seats, horsepower, price, kbb_value (the Kelley Blue Book value Carvana shows next to the price), msrp, market_adjustment, previous_price, price_updated_at, shipping_cost (0 = free), tags (Carvana's labels such as Great Deal and New Price), purchase_pending, purchase_type, offering, remaining_warranty_months, remaining_warranty_miles, image, currency";
const LOCATION =
  "Inventory is national; the location changes shipping costs and delivery flags, not which vehicles exist. There is no ZIP targeting: pass city (one of Carvana's own city pages), else the location is the one Carvana sets for the visit (location.source says which).";
const NOT_AVAILABLE =
  "Not available: ZIP targeting, keyword search, a minimum-mileage filter, new vehicles (Carvana lists used vehicles), delivery or shipping quotes for an address, monthly payments, taxes and fees, VINs, search suggestions, dealers (Carvana is the seller) and price trends.";

const make = (description: string) =>
  z.string().min(1).max(60).describe(`${description}A make as Carvana writes it (get_carvana_makes lists them; case ignored): Toyota, Ford, Mercedes-Benz.`);
const model = (description: string) =>
  z.string().min(1).max(60).describe(`${description}A model as Carvana writes it (get_carvana_make lists them; case ignored, hyphens count): RAV4, F-150, CR-V.`);
const list = (values: string) =>
  z.union([z.array(z.string().max(40)).max(10), z.string().max(400)]).optional()
    .describe(`Any of: ${values} (a list or comma-separated, up to 10).`);
const year = (description: string) => z.number().int().min(1980).max(2028).optional().describe(description);

export function registerCarvanaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/carvana/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_carvana",
    `Search the used-car inventory of ${FIRST} by make and model (names as Carvana writes them), 24 vehicles a page, with six sorts (most popular, lowest and highest price, lowest mileage, newest model year, newest listed) and Carvana's filters: model year, price, maximum mileage, trims, drive types, colors, body styles, fuel types, Carvana's tags (Great Deal, New Price, No Reported Accidents, Single Owner, Recently Added, Low Miles Per Year) and free shipping. Returns make, model, city, sort, page, page_size, total, total_pages, has_more, count, filters_applied, items [{${TILE}}], location {source, city, state, zip, delivery_available, pickup_available, out_of_market, miles_to_pickup, earliest_delivery_date, pickup_city, pickup_state}, facets (include_facets), market, notes. ${LOCATION} Captured 2026-11-26: Ford F-150 from 2019 tagged great_deal, lowest price first: 578 vehicles; a 2019 F-150 XLT at 21990 USD (previously 22590) with 93232 miles next to a KBB value of 23600. Toyota RAV4 on the new-york-ny city page: 1101 vehicles, delivery available. An unknown make or model is a charged 404 that lists Carvana's names. ${NOT_AVAILABLE} ${MARKET} ${ONE}`,
    {
      make: make("").optional(),
      model: model("Needs make. ").optional(),
      city: z.string().max(80).optional()
        .describe('One of Carvana\'s city pages (new-york-ny, los-angeles-ca, or "New York, NY"): the location shipping and delivery are shown for. Only with make, model and page: a filter or a sort with city is a 400 (Carvana uses the visit\'s own location on filtered pages).'),
      page: z.number().int().min(1).max(5000).optional().describe("Page, 1-based (default 1); 24 vehicles a page."),
      sort: z.enum(SORTS).optional()
        .describe("most_popular (Carvana's default; recomputed per visit, not stable between pages: page with a fixed sort), lowest_price, highest_price, lowest_mileage, newest_year, newest_listed."),
      year_min: year("Model year from (1980-2028)."),
      year_max: year("Model year to (1980-2028)."),
      price_min: z.number().int().min(0).max(2_000_000).optional().describe("Price from, USD."),
      price_max: z.number().int().min(0).max(2_000_000).optional().describe("Price to, USD."),
      mileage_max: z.number().int().min(0).max(1_000_000).optional().describe("Mileage up to (Carvana's mileage filter takes a maximum only)."),
      trims: z.union([z.array(z.string().max(60)).max(10), z.string().max(400)]).optional()
        .describe("Needs make and model. Trim names as Carvana writes them (include_facets lists them under facets.models[].trims), e.g. XLE; a list or comma-separated, up to 10."),
      drive_types: list("4wd, awd, fwd, rwd"),
      colors: list(COLORS),
      body_styles: list("suv, sedan, truck, coupe, minivan, convertible, wagon, hatchback"),
      fuel_types: list("gas, diesel, electric, hybrid, plug_in_hybrid"),
      tags: list(`${TAGS} (Carvana's own labels)`),
      free_shipping: z.boolean().optional().describe("Only vehicles Carvana ships free to the location the page uses."),
      include_facets: z.boolean().optional()
        .describe("Also return facets: counts per filter value, the makes, and the make's models with their trims."),
    },
    post("search"),
  );

  server.tool(
    "get_carvana_vehicle",
    `One vehicle of ${FIRST} by vehicle id or link: vehicle_id, stock_number, url, year, make, model, model_variant, trim, body_type, doors, colors, mileage, seats, price, previous_price, price_updated_at, kbb_value, fair_market_value, msrp, market_adjustment, powertrain {engine, transmission, drivetrain, fuel, horsepower, mpg}, dimensions, warranty (factory terms and what remains), in_service_date, in_service_miles, keys, prior_use, recalls, autocheck_accident_reported, highlights [{key, name, description}] (Carvana's labels with their CARFAX / AutoCheck basis text as given), inspection {inspected_on, categories [{name, points [{name, status}]}]}, imperfections [{title, description, zone, location, image}], features, packages, options, ai_summary (Carvana's AI-written text, labelled), hub {city, state, zip}, sale_status, purchase_type, image, images, market, notes. Captured 2026-11-26: a 2019 Ford F-150 XLT SuperCab at 21990 USD (previously 22590), KBB value 23600, 93232 miles, prior use Lease, held at a hub in Heath, OH. Monthly payments, shipping, taxes, fees and delivery dates are not included. No VIN. An unknown or sold vehicle is a charged 404. ${ONE}`,
    {
      vehicle_id: z.union([z.string().max(12), z.number().int()]).optional()
        .describe("A Carvana vehicle id (items[].vehicle_id from search_carvana; the number in a vehicle link; 4-10 digits, e.g. 4850967). Send vehicle_id or url."),
      url: z.string().max(400).optional().describe("A carvana.com vehicle link instead of vehicle_id."),
    },
    post("vehicle"),
  );

  server.tool(
    "get_carvana_model_guide",
    `Carvana's research page for one model year, from ${FIRST}: year, make, model, name, url, summary, generation, in_stock, rating, rating_count, star_counts {5..1}, changes [{area, text}] (what changed that year), engine_by_trim, transmission_by_trim, drivetrain_by_trim [{trim, values}], other_specs, trims_in_stock [{trim, in_stock}], owner_reviews [{text, rating, date, vehicle}] (the reviews the page shows; no names), next_year, faq [{question, answer}], sources, market, notes. ${NAME} says its owner ratings come from Strategic Vision owner surveys. Captured 2026-11-26: the 2021 Toyota RAV4 rated 4.3 from 1404 ratings, 149 in stock. An unknown year, make or model is a charged 404. ${ONE}`,
    {
      year: z.number().int().min(1980).max(2028).describe("Required. Model year (e.g. 2021)."),
      make: make("Required. "),
      model: model("Required. "),
    },
    post("model-guide"),
  );

  server.tool(
    "get_carvana_trims",
    `Carvana's trim guide for one model, from ${FIRST}: make, model, name, url, summary, count, groups [{group, name, trims, description, best_for, highlights, attributes [{name, value}], in_stock, image}], faq [{question, answer}], sources, market, notes. Captured 2026-11-26: Toyota RAV4 in 7 trim groups. An unknown make or model is a charged 404. ${ONE}`,
    {
      make: make("Required. "),
      model: model("Required. "),
    },
    post("trims"),
  );

  server.tool(
    "get_carvana_make",
    `One make's model lineup on ${FIRST}: make, name, url, summary, count, models [{model (the name search_carvana takes), make, slug, url, tagline, in_stock, body_types, image}], market, notes. Captured 2026-11-26: Toyota with 27 models, the 4Runner with 334 in stock. An unknown make is a charged 404. ${ONE}`,
    {
      make: make("Required. "),
    },
    post("make"),
  );

  server.tool(
    "get_carvana_makes",
    `Every make in the inventory of ${FIRST} with its in-stock count: count, total_in_stock, makes [{make (the name search_carvana takes), in_stock}], location, market, notes. Captured 2026-11-26: 40 makes, 90664 vehicles in stock. ${ONE}`,
    {},
    post("makes"),
  );
}
