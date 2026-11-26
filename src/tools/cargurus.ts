import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/cargurus.ts (markets us, us-es, ca, ca-fr, uk; not every
// endpoint serves every market). Rules the backend enforces and zod here does not: zip must match
// the market (a 5-digit US ZIP for us / us-es, a Canadian postal code for ca / ca-fr, a UK
// postcode for uk); distance takes the market's radii (us / uk 10, 25, 50, 75, 100, 150, 200, 500
// miles; ca 25, 50, 75, 100, 250, 500 km) or "nationwide", and on models needs zip; model needs
// make, trim needs model; *_min <= *_max; year 1900 to two years ahead; the list filters take the
// values named in each description (up to 20); filters takes at most 12 of the listed keys; dealer
// takes dealer_id or url (not both), research takes research_id or url, or year with make and
// model; a dealer link's site must match market. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const ALL_MARKETS = ["us", "us-es", "ca", "ca-fr", "uk"] as const;
const SORTS = [
  "best_match",
  "best_deal",
  "price_low",
  "price_high",
  "mileage_low",
  "mileage_high",
  "closest",
  "year_newest",
  "year_oldest",
  "listed_newest",
  "listed_oldest",
] as const;
const EXTRA_FILTER_KEYS = [
  "daysOnMarketMin",
  "daysOnMarketMax",
  "minMpg",
  "maxMpg",
  "hideWithoutPhotos",
  "hideFrameDamaged",
  "hideTheft",
  "interiorColors",
  "hideFleet",
  "hideLemon",
  "hideSalvage",
  "doors",
  "installedOptionIds",
  "safetyRatings",
  "averageDealerRatings",
  "minEVBatteryChargingTime",
  "maxEVBatteryChargingTime",
  "minEVBatteryRange",
  "maxEVBatteryRange",
];

const FIRST = "CarGurus (cargurus.com, the car marketplace run by CarGurus, Inc., in the US, Canada and the UK)";
const NAME = "CarGurus";
const ONE =
  "Costs 1 credit per request, also when a make or model name is resolved with a first page (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const MARKETS =
  "Markets (market, default us): us = cargurus.com (USD, miles), us-es = its Spanish pages, ca = cargurus.ca (CAD, km), ca-fr = its French pages, uk = cargurus.co.uk (GBP, miles). Data comes in the market's language and currency; every answer carries market {market, country, language, currency, distance_unit}.";
const DEAL =
  "deal_rating (GREAT_PRICE, GOOD_PRICE, FAIR_PRICE, POOR_PRICE, OVERPRICED, OUTLIER, NA) with deal_rating_label and deal_score, and expected_price with expected_price_difference (expected minus asking), are CarGurus' own price analysis as CarGurus labels it.";
const PRIVATE =
  "No VINs, stock numbers or private-seller details are returned; dealer names, addresses, phones and ratings are CarGurus' public dealer details. Reviews carry no reviewer names.";
const NO_DETAIL =
  "There is no listing detail endpoint: each listing already carries the price, expected price, deal rating, mileage, options and specs; url is the listing's CarGurus page for people.";
const TILE =
  "listing_id, title, name, year, make, make_id, model, model_id, trim, trim_id, body_type, condition, price (null when the listing shows no price), price_text, currency, original_price, msrp (new cars), price_with_fees, fee_disclosure, expected_price, expected_price_difference, deal_rating, deal_rating_label, deal_score, price_drop {previous_price, amount, dropped_at}, days_on_market, mileage, mileage_unit, exterior_color, interior_color, transmission, drivetrain, engine, fuel_type, mpg {city, highway, combined, unit}, ev, doors, options, highlights (e.g. No accidents, 1 owner), safety_rating, ulez_compliant (uk), photo, photo_count, placement, sponsored, buying_option, distance, seller_type, dealer {dealer_id, name, city, region, postal_code, phone, franchise_dealer, franchise_make, rating, url}, url";
const NOT_AVAILABLE =
  "Not available: a listing detail page, VINs, private sellers, dealer review paging, sort or star filter (the reviews the dealer page embeds), finance and delivery filters, and price history per listing beyond price_drop (get_cargurus_price_trends has CarGurus' daily market averages).";

const market = (allowed: readonly [string, ...string[]], extra = "") =>
  z.enum(allowed).optional()
    .describe(`${allowed.join(", ")} (default us). us = cargurus.com (USD, miles), us-es = its Spanish pages, ca = cargurus.ca (CAD, km), ca-fr = its French pages, uk = cargurus.co.uk (GBP, miles).${extra}`);
const zip = z.union([z.string().min(3).max(10), z.number().int()])
  .describe("Required. Where to search around: a 5-digit US ZIP code (us, us-es, e.g. 10001), a Canadian postal code (ca, ca-fr, e.g. M5V 2T6) or a UK postcode (uk, e.g. M1 1AE). A malformed code is a 400, not charged.");
const distance = z.union([z.number().int(), z.string().max(12)]).optional()
  .describe('Radius around zip, as the site offers it: us / uk 10, 25, 50 (default), 75, 100, 150, 200, 500 miles; ca 25, 50, 75, 100, 250, 500 km; or "nationwide".');
const make = (description = "") =>
  z.string().max(60).optional()
    .describe(`${description}A make as CarGurus names it (Toyota, Ford, Mercedes-Benz ...) or its make_id (m7; from get_cargurus_makes). Ids differ per site (Ford is m2 on the US and Canadian sites, m273 on the UK site): names resolve to the market's id.`);
const model = (description = "") =>
  z.string().max(80).optional()
    .describe(`${description}A model as CarGurus names it (RAV4, F-150) or its model_id (d306; from get_cargurus_models). Needs make. A model name is resolved from the make's models on a first CarGurus page (same 1 credit; send model_id to save that step).`);
const strOrList = (description: string) =>
  z.union([z.string().max(400), z.array(z.string().max(60)).max(20)]).optional()
    .describe(`${description} One value, a list (up to 20) or comma-separated.`);

const listingShape = {
  make: make(),
  model: model(),
  trim: z.string().max(80).optional()
    .describe("A trim as CarGurus names it (search's trims list, e.g. XLE, XLT SuperCrew 4WD). Needs model."),
  page: z.number().int().min(1).max(500).optional().describe("Page (default 1, at most 500); 24 tiles a page."),
  sort: z.enum(SORTS).optional()
    .describe(`${SORTS.join(", ")} (CarGurus' 11 sorts; default best_match). best_deal is CarGurus' "Best deals first" (used cars).`),
  year_min: z.number().int().optional().describe("Earliest model year."),
  year_max: z.number().int().optional().describe("Latest model year."),
  price_min: z.number().int().min(0).optional().describe("Lowest price, whole units of the market's currency."),
  price_max: z.number().int().min(0).optional().describe("Highest price."),
  mileage_min: z.number().int().min(0).optional().describe("Lowest mileage (miles; km in ca / ca-fr)."),
  mileage_max: z.number().int().min(0).optional().describe("Highest mileage."),
  drivetrain: strOrList("awd, 4wd, fwd, rwd, 4x2."),
  color: strOrList("Exterior colour group(s): black, blue, brown, gold, gray (grey), green, orange, pink, purple, red, silver, teal, white, yellow."),
  body_type: strOrList("coupe, convertible, hatchback, minivan (mpv), pickup, sedan (saloon), suv, van, wagon (estate)."),
  condition: strOrList("us / ca: used, certified (manufacturer certified), third_party_certified; uk: approved_used."),
  seller_type: strOrList("franchise_dealer or cargurus_partner (CarGurus Partners)."),
  deal_rating: strOrList("CarGurus deal rating(s) by name: great, good, fair, high, overpriced, uncertain, no_analysis (or CarGurus' own names GREAT_PRICE, GOOD_PRICE, FAIR_PRICE, POOR_PRICE, OVERPRICED, OUTLIER, NA)."),
  fuel_type: strOrList("gasoline (petrol), diesel, electric, hybrid, flex_fuel, cng, biodiesel, hydrogen, dual_fuel."),
  transmission: strOrList("automatic or manual."),
  single_owner: z.boolean().optional().describe("Only cars CarGurus reports as single-owner."),
  no_accidents: z.boolean().optional().describe("Only cars with no accidents reported."),
  price_drops_only: z.boolean().optional().describe("Only listings with a recent price drop."),
  filters: z.record(z.string(), z.unknown()).optional()
    .describe(`Other CarGurus filters by the site's own key (facets[].key from include_facets) to a value or list (up to 12 keys): ${EXTRA_FILTER_KEYS.join(", ")}.`),
};
const FILTERS =
  "sorted by any of CarGurus' 11 sorts, filtered by year, price, mileage, drivetrain, colour, body type, condition, seller type, CarGurus deal rating, fuel, transmission, single owner, no accidents and recent price drops";

export function registerCargurusTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/cargurus/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_cargurus",
    `Search the car listings of ${FIRST} around a ZIP / postal code / postcode with a radius, by make, model and trim (names or ids), ${FILTERS}; 24 tiles a page, up to page 500. Returns market, location {zip, resolved, distance, distance_unit, nationwide}, make, model, trim, make_model_trim_path, sort, applied_filters (as CarGurus applied them), total, page, page_count, has_more, count, listings [{${TILE}}], trims (with a model), facets [{facet, label, key, min_key, max_key, values [{name, value, label, count}], range}] (include_facets), notes. Sponsored placements (priority, featured) are inserted by CarGurus out of the requested order and flagged. ${DEAL} Captured 2026-11-26: Toyota RAV4 around 10001 resolved to New York, NY (50 miles) with 1107 listings; a 2024 RAV4 LE AWD at 27000 USD against an expected 27763 was rated Good Deal. On ca-fr around H2X 1Y4 (Montreal, 100 km) labels read in French (Bonne affaire) with CAD prices and km. ${PRIVATE} ${NO_DETAIL} ${MARKETS} ${ONE}`,
    {
      market: market(ALL_MARKETS),
      zip,
      distance,
      ...listingShape,
      include_facets: z.boolean().optional()
        .describe("Also return facets: CarGurus' filters with counts for this search (a filters entry takes key with the value; deal ratings go by name through deal_rating)."),
    },
    post("search"),
  );

  server.tool(
    "get_cargurus_dealer",
    `One dealer on ${FIRST} by dealer id or link: dealer {dealer_id, name, address {street, city, region, postal_code}, sales_phone, service_phone, website, maps_url, location, logo, hours [{day, open, close, is_open}] (7 days), current_day, rating, review_count, social, url}, reviews [{review_id, rating, date, content, purchase_status, delivery, helpful, dealer_response {text, date}}] (every review CarGurus embeds in the page; CarGurus has no review paging, sort or star filter, so filter them on your side; no reviewer names), inventory {total, page, page_count, has_more, count, listings} (the dealer's listings, paged, sorted and filtered like search_cargurus), nearby_dealers, notes. Captured 2026-11-26: dealer 316651 in Rockville Centre, NY with 410 listings (page 2 of 18 sorted price_low). An unknown dealer is a charged 404. ${DEAL} ${MARKETS} ${ONE}`,
    {
      dealer_id: z.union([z.string().max(20), z.number().int()]).optional()
        .describe("A CarGurus dealer id (listings[].dealer.dealer_id, dealers[].dealer_id; digits, e.g. 440818, or sp440818). Send dealer_id or url, not both."),
      url: z.string().min(10).max(2000).optional()
        .describe("A CarGurus dealer link (https://www.cargurus.com/Cars/m-<dealer name>-sp<id>, or the .ca / .co.uk site) instead of dealer_id; its site sets the market."),
      market: market(ALL_MARKETS),
      ...listingShape,
    },
    post("dealer"),
  );

  server.tool(
    "get_cargurus_dealers",
    `The dealers with listings around a US ZIP code on ${FIRST} (optionally for one make / model): count, total_listings, dealers [{dealer_id (the input of get_cargurus_dealer), name, rating, distance, city, region, listing_count, url}] (up to 150, as CarGurus' own dealer filter lists them), location, market, notes. US site only (us, us-es): the Canadian and UK search pages carry no dealer list. Captured 2026-11-26: around 10001 (New York, NY, 25 miles) 150 dealers listed with 50252 listings in all. ${ONE}`,
    {
      market: market(["us", "us-es"], " The Canadian and UK search pages carry no dealer list."),
      zip,
      distance,
      make: make(),
      model: model(),
    },
    post("dealers"),
  );

  server.tool(
    "get_cargurus_price_trends",
    `CarGurus' used-car price trends on ${FIRST}, for the market (the CarGurus Index, makes, body styles, market movers), a make or a model: scope, make, model, currency, groups {index, makes, models, model_years, body_styles: [{id, name, parent, average_price, average_price_with_fees, history [{days_ago (30, 90, 365), average_price, average_price_with_fees, change_to_today_pct, change_with_fees_to_today_pct}], research_id (model_years)}]}, series [{id, name, points [{date, price, price_with_fees}]}] (CarGurus' daily averages), market_movers {decrease, increase}, faqs (CarGurus' text), date_range, listings_url, notes. Markets us, ca, uk. Captured 2026-11-26: the US CarGurus Index stood at 28289 USD (28732 with fees), -1.21% against 30 days earlier; the series runs from 2013-01-01. ${ONE}`,
    {
      market: market(["us", "ca", "uk"]),
      make: make("Optional: a make (name or make_id): its price trends and its models. Without make: the market's CarGurus Index, makes and body styles. "),
      model: model("Optional, with make: a model (name or model_id): its price trends and each model year (groups.model_years, with research_id). "),
    },
    post("price-trends"),
  );

  server.tool(
    "get_cargurus_research",
    `A model-year research page on ${FIRST} (US site), by research_id / link, or by year with make and model: research_id, name, make, model, year, currency, trims [{trim_id, name, msrp, engine, horsepower, drivetrain, fuel_economy_city, fuel_economy_highway, seating_capacity, cargo_space}], pricing {original_msrp_min/max, price_range_min/max, average_listing_price, today_price, one_month_ago_price, one_year_ago_price, average_listing_change_pct, cargurus_index_average_price, cargurus_index_change_pct, price_trends_url}, price_series, test_drive_review {title, blurb, summary, scores, pros, cons, author: CarGurus editors, published, updated, url}, owner_reviews {average_rating, total_ratings, count_by_rating, ai_summary (CarGurus' own summary, as given), count, reviews [{review_id, rating, title, content, date}]} (no reviewer names), listings_url, url, notes. Captured 2026-11-26: the 2022 Toyota 4Runner (c31935), original MSRP 38105-52420 USD, average listing 38579 USD today against 40019 a year earlier. An unknown id is a charged 404. ${ONE}`,
    {
      research_id: z.string().max(20).optional()
        .describe("A CarGurus model-year id (c<digits>, e.g. c31935; get_cargurus_expert_reviews reviews[].research_id, get_cargurus_price_trends groups.model_years[].research_id)."),
      url: z.string().min(10).max(2000).optional()
        .describe("A CarGurus research link (https://www.cargurus.com/research/<year>-<make>-<model>-c<id>) instead of research_id."),
      year: z.number().int().optional()
        .describe("With make and model instead of research_id: the model year, found through CarGurus' price trends (same 1 credit)."),
      make: make("With year and model. "),
      model: model("With year and make. "),
      market: market(["us"], " Research pages are read on the US site."),
    },
    post("research"),
  );

  server.tool(
    "get_cargurus_expert_reviews",
    `CarGurus' expert (editorial) car reviews on ${FIRST}, 24 a page: page, page_size, total, page_count, has_more, count, reviews [{title, vehicle, rating, updated_at, summary, image, author: CarGurus editors, research_id (the input of get_cargurus_research), url}], market, notes. Markets us, ca, uk. Captured 2026-11-26: 1683 reviews on the US site, 995 on the Canadian, 781 on the UK. ${ONE}`,
    {
      market: market(["us", "ca", "uk"]),
      page: z.number().int().min(1).max(200).optional().describe("Page (default 1); 24 reviews a page."),
    },
    post("expert-reviews"),
  );

  server.tool(
    "get_cargurus_makes",
    `Every make the market's site of ${FIRST} lists in its search: count, makes [{make_id, name, popular}], market, notes. Ids are per site (the UK site's differ). Captured 2026-11-26: 119 makes on the US site, 67 on the Canadian, 101 on the UK. ${NOT_AVAILABLE} ${ONE}`,
    {
      market: market(ALL_MARKETS),
    },
    post("makes"),
  );

  server.tool(
    "get_cargurus_models",
    `The models of one make on ${FIRST} with ${NAME}' listing counts nationwide (or around a zip): make {id, name}, location, count, models [{model_id, name, count, popular}], market, notes. Captured 2026-11-26: Toyota (m7) with 73 models on the US site. An unknown make id is a charged 404. ${ONE}`,
    {
      market: market(ALL_MARKETS),
      make: z.string().min(1).max(60)
        .describe("Required. A make (name as CarGurus shows it, e.g. Toyota, or make_id from get_cargurus_makes)."),
      zip: zip.optional().describe("Optional: count listings around this place instead of nationwide (a ZIP / postal code / postcode matching the market)."),
      distance: distance.describe('Radius around zip (needs zip): us / uk 10, 25, 50 (default), 75, 100, 150, 200, 500 miles; ca 25, 50, 75, 100, 250, 500 km; or "nationwide".'),
    },
    post("models"),
  );
}
