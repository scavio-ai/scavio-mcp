import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/expedia.ts (50 Expedia market-languages, each in its own language and currency).
// Rules the backend enforces and zod here does not: search takes destination or region_id; check_in is not in the
// past and at most 500 days ahead; check_out is after check_in and at most 28 nights later; property and
// price_calendar take exactly one of id or path and are refused in the markets where hotel pages are held (en-gb,
// pt-br, zh-hk, en-hk, zh-hans-hk, en-my, en-ph). No zod `.default()`: the MCP SDK would post a defaulted field on
// every call.

const MARKETS = [
  "us", "es-us", "zh-us", "en-gb", "en-ie", "en-ca", "fr-ca", "en-au", "en-nz", "de-de", "de-at", "de-ch", "fr-ch",
  "fr-fr", "nl-be", "fr-be", "nl-nl", "it-it", "es-es", "da-dk", "sv-se", "no-no", "fi-fi", "es-mx", "pt-br", "es-ar",
  "es-cl", "es-co", "es-pe", "es-cr", "en-eg", "ja-jp", "en-jp", "ko-kr", "en-kr", "zh-tw", "zh-hk", "en-hk",
  "zh-hans-hk", "en-sg", "en-my", "en-ph", "id-id", "en-id", "th-th", "en-th", "vi-vn", "en-in", "en-ae", "ar-ae", "ar-sa",
] as const;
const HELD = ["en-gb", "pt-br", "zh-hk", "en-hk", "zh-hans-hk", "en-my", "en-ph"] as const;
const SORTS = ["recommended", "price_asc", "price_desc", "review"] as const;
const AMENITIES = [
  "POOL", "PETS", "WIFI", "AIR_CONDITIONING", "FREE_AIRPORT_TRANSPORTATION", "HOT_TUB", "SPA_ON_SITE", "WASHER_DRYER",
  "KITCHEN_KITCHENETTE", "ELECTRIC_CAR", "GYM", "CRIB", "FREE_PARKING", "BALCONY_OR_TERRACE", "RESTAURANT_IN_HOTEL",
] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const FIRST = "Expedia (expedia.com, Expedia Group's travel booking site)";
const NAME = "Expedia";
const BILL =
  "Billed on what the request actually cost: credits_used is what was charged (2 credits for most pages, 1 on some New Zealand, Korea and Indonesia pages). Failed upstream calls and another market's page are not charged; refused inputs are not charged; a not-found is charged.";
const HEAD = "market, language, currency";
const SLOW = "Answers can take up to about 4 minutes when Expedia answers slowly: allow a client timeout of at least 250 s.";
const LANG = "Labels and texts are in the market's language, as Expedia writes them; field names are English.";
const PRICE =
  "price {amount, amount_display (the card's large price), lead (nightly or total: which one the large price is; markets differ), nightly, nightly_display, total, total_display, was, was_display (the struck-through price), was_applies_to, fees_text (Expedia's own line, e.g. Total with taxes and fees), stay_text, price_messages, currency} or null";
const CARD = `position, property_id (the input of get_expedia_property and get_expedia_price_calendar), name, path, neighborhood, messages, rating {score, score_display, label, review_count, review_count_text}, ${PRICE}, deal (Expedia's deal badge as shown), scarcity (as shown, e.g. We have 1 left at this price), badges (e.g. VIP Access, Member Price available, Ad), vip_access, member_price, sponsored (Expedia's Ad placements, kept in place), coordinates {latitude, longitude} or null, images`;

const market = () =>
  z.enum(MARKETS).optional()
    .describe(`The Expedia market-language (default us), each answering in its own language and currency: us, es-us, zh-us (USD), en-gb (GBP), en-ie (EUR), en-ca / fr-ca (CAD), en-au (AUD), en-nz (NZD), de-de, de-at, fr-fr, nl-be, fr-be, nl-nl, it-it, es-es, fi-fi (EUR), de-ch / fr-ch (CHF), da-dk (DKK), sv-se (SEK), no-no (NOK), es-mx (MXN), pt-br (BRL), es-ar (ARS), es-cl (CLP), es-co (COP), es-pe (PEN), es-cr (USD), en-eg (EGP), ja-jp / en-jp (JPY), ko-kr / en-kr (KRW), zh-tw (TWD), zh-hk / en-hk / zh-hans-hk (HKD), en-sg (SGD), en-my (MYR), en-ph (PHP), id-id / en-id (IDR), th-th / en-th (THB), vi-vn (VND), en-in (INR), en-ae / ar-ae (AED), ar-sa (SAR). es-cl, es-co, es-pe, es-cr and en-eg are Expedia's Chile, Colombia, Peru, Costa Rica and Egypt sites.`);
const hotelMarket = () =>
  market().describe(`The Expedia market-language (default us; the same codes as search_expedia). Not available in ${HELD.join(", ")}: Expedia answers hotel pages there with another country's site, so those markets are refused (not charged); search and suggestions work there.`);

export function registerExpediaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/expedia/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_expedia",
    `Search hotels and stays on ${FIRST} by place name or region id, dates and adults (one room), with Expedia's sorts and filters (star rating, amenity, guest rating), in 50 market-languages. Returns ${HEAD}, destination, region_id, destination_name, check_in, check_out, nights, adults, rooms, sort, filters, applied (the selections Expedia's page echoed), matched_total (as Expedia reports it), results_heading, count, partial, properties [${CARD}], notes. These are the top results Expedia shows on the first page of its results: Expedia's page carries 3 of them on most requests (partial: true) and up to 10 on some; no further page can be fetched. Prices are exactly as Expedia shows them for the requested dates. ${LANG} Captured 2026-11-26: Las Vegas, NV for 2027-01-20 to 2027-01-23 with 2 adults gave 10 of 24 matched properties (partial: false), the first at 1297 USD for 3 nights (326 USD nightly, was 1932) rated 8.8 from 12182 reviews; London on en-gb gave 3 of 505 (partial: true), the first at 520 GBP for 3 nights (173 GBP per night); Tokyo on ja-jp gave 3 of 497, the first at 14695 JPY a night. ${BILL} ${SLOW}`,
    {
      destination: z.string().min(1).max(200).optional()
        .describe("A place as you would type it on Expedia: city, area, landmark or airport (e.g. Las Vegas, NV). Send destination or region_id."),
      region_id: z.union([z.string().regex(/^\d{1,20}$/), z.number().int().positive()]).optional()
        .describe("Or an Expedia region id: places[].region_id of get_expedia_suggestions (e.g. 2621)."),
      check_in: z.string().regex(ISO_DATE, "check_in must be YYYY-MM-DD")
        .describe("Required. Check-in date, YYYY-MM-DD (not in the past, at most 500 days ahead)."),
      check_out: z.string().regex(ISO_DATE, "check_out must be YYYY-MM-DD")
        .describe("Required. Check-out date, YYYY-MM-DD (after check_in, at most 28 nights later)."),
      adults: z.number().int().min(1).max(14).optional().describe("Adults in the room, 1-14 (default 2). One room."),
      sort: z.enum(SORTS).optional()
        .describe("recommended (default), price_asc, price_desc, review (guest rating): Expedia's own sort options."),
      star: z.number().int().min(1).max(5).optional().describe("Expedia's star rating filter, 1-5 (e.g. 5)."),
      amenity: z.enum(AMENITIES).optional().describe("One of Expedia's popular amenity filters (e.g. POOL, FREE_PARKING)."),
      guest_rating_min: z.number().int().min(7).max(9).optional()
        .describe("Expedia's guest rating filter: 7 (7+), 8 (8+) or 9 (9+)."),
      market: market(),
    },
    post("search"),
  );

  server.tool(
    "get_expedia_property",
    `One ${NAME} property page by id or path, read without dates: ${HEAD}, property_id, requested_id, name, path, stars, featured, address {street, locality, region, postal_code, country}, coordinates {latitude, longitude}, region_id, rating {score, score_display, best, label, review_count, review_count_text} or null, description, about [{heading, texts}], amenities [{group, items}] (every group, incl. parking and breakfast fees as Expedia writes them), guest_liked [{heading, text}] (Expedia's own summary lines), fees (every fee, deposit and resort fee line as Expedia writes it), policies [{kind, heading, texts}] (check-in, check-out, minimum age, pets, children, payment types), important_information [{kind, heading, texts}], neighborhood_text, nearby [{group, places [{name, distance, travel_time}]}], faqs [{question, answer}], photo_count, photos [{url, caption}], notes. Rooms and rates for dates and review texts are not offered: use search_expedia for dated prices. ${LANG} Captured 2026-11-26: property 1443 on us, a Las Vegas resort, with 124 photos, 16 amenity groups and 6 FAQs; property 9619719 on fr-fr, a 2-star hotel in Paris rated 9,4 from 1599 reviews. An unknown property is a charged 404. ${BILL} ${SLOW}`,
    {
      id: z.string().regex(/^\d{2,12}$/).optional()
        .describe("An Expedia property id: properties[].property_id of search_expedia (e.g. 17117062). Send id or path."),
      path: z.string().min(10).max(600).optional()
        .describe("Or properties[].path of search_expedia (e.g. /New-York-Hotels-PUBLIC.h17117062.Hotel-Information), or an Expedia hotel link."),
      market: hotelMarket(),
    },
    post("property"),
  );

  server.tool(
    "get_expedia_price_calendar",
    `${NAME}'s price calendar for one property: the price Expedia shows for each day from today to about 10 months ahead (up to 302 days), labelled by Expedia "Lowest prices in the past 24 hours": ${HEAD}, property_id, name, check_in, check_out, adults, label (Expedia's wording in the market's language), label_en, begin, end, count, days_with_price, days [{date, price, price_display}] (price null on days Expedia shows none), notes. check_in and check_out open the page; the calendar spans Expedia's own window. Send path from search_expedia where you can: some market sites answer a page opened from the id alone without its calendar (retried, then a 502 that is not charged). Captured 2026-11-26: property 17117062 in New York on us gave 241 days from 2026-11-26 to 2027-07-24, 232 of them with a price in USD; a Paris hotel on fr-fr gave 295 days to 2027-09-16 in EUR. An unknown property is a charged 404. ${BILL} ${SLOW}`,
    {
      id: z.string().regex(/^\d{2,12}$/).optional()
        .describe("An Expedia property id: properties[].property_id of search_expedia. Send id or path."),
      path: z.string().min(10).max(600).optional()
        .describe("Or properties[].path of search_expedia (recommended: some market sites answer a page opened from the id alone without its calendar), or an Expedia hotel link."),
      check_in: z.string().regex(ISO_DATE, "check_in must be YYYY-MM-DD")
        .describe("Required. Check-in date, YYYY-MM-DD (opens the page; the calendar spans Expedia's own window)."),
      check_out: z.string().regex(ISO_DATE, "check_out must be YYYY-MM-DD")
        .describe("Required. Check-out date, YYYY-MM-DD (after check_in, at most 28 nights later)."),
      adults: z.number().int().min(1).max(14).optional().describe("Adults, 1-14 (default 2)."),
      market: hotelMarket(),
    },
    post("price-calendar"),
  );

  server.tool(
    "get_expedia_suggestions",
    `${NAME}'s destination suggestions for a partial place name: ${HEAD}, query, count, places [{type (CITY, NEIGHBORHOOD, POI, AIRPORT, METROCODE ...), region_id (the input of search_expedia), name, display_name, full_name, primary_name, secondary_name, latitude, longitude, country, country_code, airport_code}], notes. Hotel names often return no place. Captured 2026-11-26: las veg on us gave 8 places, the first the Las Vegas Strip neighborhood (region_id 800045); 東京 on ja-jp gave 8, the first the city of Tokyo (region_id 3593). ${BILL}`,
    {
      query: z.string().min(2).max(100).describe("Required. What a traveller has typed so far, a place name (e.g. new yo)."),
      limit: z.number().int().min(1).max(8).optional().describe("Most places to return, 1-8 (default 8)."),
      market: market(),
    },
    post("suggestions"),
  );
}
