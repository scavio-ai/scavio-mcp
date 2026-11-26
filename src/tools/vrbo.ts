import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/vrbo.ts (20 vrbo.com market-languages, each in its own language and currency).
// Rules the backend enforces and zod here does not: search takes destination or region_id; check_in is not in the
// past and at most 500 days ahead; check_out is after check_in and at most 90 nights later; property takes exactly
// one of id or url. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const MARKETS = [
  "us", "en-gb", "en-ca", "fr-ca", "es-mx", "pt-br", "es-es", "it-it", "pt-pt", "nl-nl",
  "de-at", "el-gr", "fi-fi", "da-dk", "sv-se", "no-no", "ja-jp", "en-sg", "en-au", "en-nz",
] as const;
const SORTS = ["recommended", "price_low", "price_high", "review", "review_count"] as const;
const PROPERTY_TYPES = ["house", "apartment_or_condo", "cottage", "cabin", "estate", "resort", "villa", "hotel", "houseboat", "guest_house", "boat", "chalet", "RV"] as const;
const AMENITIES = [
  "pool", "private_pool", "heated_pool", "hot_tub", "balcony", "king_sized_bed", "parking", "internet_available",
  "fireplace", "washer", "clothes_dryer", "electric_vehicle_charging_station", "air_conditioning", "television",
  "outdoor_grill", "patio_or_deck", "garden_or_backyard", "bed_linens_provided", "crib", "stove", "microwave", "oven",
  "dishwasher", "kids_high_chair", "iron_and_board",
] as const;
const HOUSE_RULES = ["pets_allowed", "pet_free", "children_allowed", "events_allowed", "smoking_allowed"] as const;
const LOCATIONS = ["oceanfront", "waterfront", "downtown_location", "lake_location", "mountains_location", "rural_location", "golf_course", "village_location", "skiin_skiout"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const FIRST = "Vrbo (vrbo.com, Expedia Group's vacation rental site)";
const NAME = "Vrbo";
const BILL = "credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const HEAD = "market, language, currency";
const PRICE =
  "price {nightly, nightly_display, total, total_display, was, was_display, was_applies_to, lead (nightly or total: which one is the card's large price; markets differ), stay_text, fees_text (Vrbo's own line, e.g. All fees included), price_messages, currency}";
const CARD = `position, property_id (the input of get_vrbo_property), expedia_property_id, url, path, title, details (the type / bedrooms / beds line, split as shown), messages (as shown, incl. the refund deadline), location_messages, rating {score, score_display, label, review_count, review_count_text, external_reviews}, ${PRICE}, deal, badges (e.g. Premier Host, Loved by Guests, Ad), sponsored (Vrbo's paid placements, kept in place), coordinates {latitude, longitude}, images`;
const SLOW = "Answers can take up to about 3 minutes: allow up to 4 minutes.";

const market = () =>
  z.enum(MARKETS).optional()
    .describe("The vrbo.com market-language (default us): us (USD), en-gb (GBP), en-ca / fr-ca (CAD), es-mx (MXN), pt-br (BRL), es-es, it-it, pt-pt, nl-nl, de-at, el-gr, fi-fi (EUR), da-dk (DKK), sv-se (SEK), no-no (NOK), ja-jp (JPY), en-sg (SGD), en-au (AUD), en-nz (NZD). Each answers in its own language and currency. abritel.fr, fewo-direkt.de, stayz.com.au and bookabach.co.nz are separate sites and are not covered.");

export function registerVrboTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/vrbo/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_vrbo",
    `Search vacation rentals on ${FIRST} by place name or region id, dates and guests, with Vrbo's sorts and filters (property type, amenity, house rule incl. pets, location type, Premier Host, minimum bedrooms). Returns ${HEAD}, destination, region_id, destination_name, check_in, check_out, nights, adults, children, sort, filters, applied (the selections Vrbo's page echoed), applied_guests, matched_total (as Vrbo reports it), page_label, count, partial, attempts, properties [${CARD}], notes. The first 50 results only: Vrbo's results pages carry no further page, so narrow with sort and filters. Prices are exactly as Vrbo shows them for the requested dates. Vrbo sometimes answers with a 3-result page; Scavio asks again (up to 4 attempts in all) and, if 3 is all Vrbo gives, returns those 3 with partial: true. Captured 2026-11-26: Destin, Florida for 2027-01-15 to 2027-01-18 with 2 adults gave 50 of 394 matched properties, the first a 1-bedroom place at 264 USD a night (792 USD for 3 nights, all fees included) rated 9.6 from 89 reviews; Cornwall, England on en-gb answered 3 properties with partial: true after 4 attempts, the first at 112 GBP a night (337 GBP for 3 nights). Credits: 2 per attempt (2 to 8, usually 2 to 6). ${BILL} ${SLOW}`,
    {
      destination: z.string().min(1).max(200).optional()
        .describe("A place as you would type it on Vrbo: city, region, area or landmark (e.g. Destin, Florida). Send destination or region_id."),
      region_id: z.union([z.string().regex(/^\d{1,20}$/), z.number().int().positive()]).optional()
        .describe("Or a Vrbo region id: places[].region_id of get_vrbo_suggestions (e.g. 6906), exact, no guessing."),
      check_in: z.string().regex(ISO_DATE, "check_in must be YYYY-MM-DD")
        .describe("Required. Check-in date, YYYY-MM-DD (not in the past, at most 500 days ahead)."),
      check_out: z.string().regex(ISO_DATE, "check_out must be YYYY-MM-DD")
        .describe("Required. Check-out date, YYYY-MM-DD (after check_in, at most 90 nights later)."),
      adults: z.number().int().min(1).max(30).optional().describe("Adults, 1-30 (default 2)."),
      children: z.array(z.number().int().min(0).max(17)).max(10).optional()
        .describe("Children's ages, one per child (0-17), at most 10 (e.g. [5])."),
      sort: z.enum(SORTS).optional()
        .describe("recommended (default), price_low, price_high, review (guest rating), review_count: Vrbo's own sort options."),
      property_type: z.enum(PROPERTY_TYPES).optional().describe("Vrbo's property type filter (e.g. house)."),
      amenity: z.enum(AMENITIES).optional().describe("One of Vrbo's amenity filters (e.g. pool, hot_tub)."),
      house_rule: z.enum(HOUSE_RULES).optional().describe("One of Vrbo's house-rule filters."),
      pets_allowed: z.boolean().optional().describe("Pet-friendly places only (the same as house_rule pets_allowed)."),
      location_type: z.enum(LOCATIONS).optional().describe("One of Vrbo's location filters (e.g. oceanfront)."),
      premier_host: z.boolean().optional().describe("Places run by Premier Hosts only."),
      bedrooms_min: z.number().int().min(1).max(10).optional()
        .describe("Vrbo's bedrooms filter: this many bedrooms or more, 1-10 (Vrbo may still mix in sponsored places)."),
      market: market(),
    },
    post("search"),
  );

  server.tool(
    "get_vrbo_property",
    `One ${NAME} property in full by id or link, read without dates: ${HEAD}, requested_id, property_id, expedia_property_id, url, title, property_type, location {locality, region, country, address_lines, latitude, longitude, region_id}, rating {score, score_display, best, label, review_count, review_count_text}, highlights [{title, text}], space {bedrooms, bathrooms, sleeps, texts}, amenities [{group, items}] (every group), house_rules [{kind, heading, texts}] (check-in / check-out, minimum age, children, pets, events, smoking), important_information [{kind, heading, texts}], special_features, description, damage_and_incidentals, host {premier_host, premier_host_label, premier_host_text, languages} (no host name, biography or photo), photo_count, photos [{url, caption}], nearby [{group, places [{name, distance, travel_time}]}], default_price {label, price, price_display, qualifier, messages, site_note, currency} (the site's own default stay, not a quote; null when the page shows none), breadcrumbs, notes. Reviews, the availability calendar and prices for chosen dates are not offered: use search_vrbo for dated prices. Captured 2026-11-26: property 1046285, a 1-bedroom beachfront condo in Destin, FL, rated 9.8 from 221 reviews, with 85 photos and 15 amenity groups; its default_price was 176 USD avg per night for the site's own 2-night stay. An unknown property is a charged 404. Costs 2 credits. ${BILL} ${SLOW}`,
    {
      id: z.string().min(3).max(40).optional()
        .describe("A Vrbo property id: properties[].property_id of search_vrbo (e.g. 1046285, 12245744ha or pdp/lo/30792130). Send id or url."),
      url: z.string().min(10).max(600).optional()
        .describe("Or a vrbo.com property link (any market; the link's market is used unless market is sent)."),
      market: market(),
    },
    post("property"),
  );

  server.tool(
    "get_vrbo_suggestions",
    `${NAME}'s destination suggestions for a partial place name: ${HEAD}, query, count, places [{type (CITY, NEIGHBORHOOD, POI, AIRPORT ...), region_id (the input of search_vrbo), name, display_name, full_name, primary_name, secondary_name, latitude, longitude, country, country_code}], notes. Captured 2026-11-26: destin gave 8 places, the first the city of Destin, Florida (region_id 6906). Costs 2 credits. ${BILL}`,
    {
      query: z.string().min(2).max(100).describe("Required. What a traveller has typed so far (e.g. destin)."),
      limit: z.number().int().min(1).max(8).optional().describe("Most places to return, 1-8 (default 8)."),
      market: market(),
    },
    post("suggestions"),
  );
}
