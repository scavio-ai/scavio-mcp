import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Here that would be actively harmful: a bare ZIP in
// `location` works alone but silently resolves to a DIFFERENT city as soon as
// any filter or sort rides along, and a defaulted listing_status or sort would
// attach one to every call. Upstream defaults are documented in describe text.

export function registerZillowTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_zillow",
    `Search Zillow for US real-estate listings in a region and return them as JSON. Each row carries the zpid, address, price, beds, baths, living area, lot size, home type, listing status, Zestimate and rent Zestimate, latitude and longitude, images, days on Zillow and broker attribution.

TRAP WORTH READING BEFORE YOU CALL: a bare ZIP code in \`location\` works ALONE, but it must NOT be combined with any filter or sort. On that request shape Zillow resolves the region by geolocating the request instead of reading the ZIP, and answers about a completely different city under a 200. Whenever you filter or sort, pass the city name ("Austin, TX") or a Zillow slug, never the ZIP.

Second trap: on listing_status=for_rent, min_price and max_price mean MONTHLY RENT, not sale price — Zillow files rent under its payment filter. days_on_zillow is a closed enum; an unrecognised value returns the UNFILTERED set under a 200 rather than an error, so confirm the filter took. Sorts that rank against a signed-in Zillow profile (saved, featured, personalised) are deliberately unavailable because we are never signed in. A region Zillow cannot resolve comes back as a 404, not an empty result set.

Paginate with page. Costs 1 credit per page.`,
    {
      location: z.string().min(1).max(200)
        .describe("Region to search: a Zillow slug ('austin-tx'), a human 'City, ST', a bare ZIP, or a pasted zillow.com search URL. A bare ZIP is only safe with NO filter and NO sort — with either one Zillow geolocates the request and returns another city. Use the city name when filtering or sorting."),
      listing_status: z.enum(["for_sale", "for_rent", "sold"]).optional()
        .describe("Which market to search. Upstream default is 'for_sale'. On 'for_rent', min_price/max_price switch meaning to MONTHLY RENT."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. One page per call, 1 credit each."),
      sort: z.enum([
        "relevance", "recommended", "newest", "price_low", "price_high",
        "payment_low", "payment_high", "beds", "baths", "sqft", "lot_size",
        "zestimate_low", "zestimate_high", "recent_change",
      ]).optional()
        .describe("Sort order. Sending any sort makes a bare-ZIP location unsafe — use a city name instead. Sorts that rank against a signed-in profile (saved / featured / personalised) are unavailable."),
      min_price: z.number().min(0).optional()
        .describe("Minimum price in USD. On listing_status=for_rent this is MONTHLY RENT, not sale price."),
      max_price: z.number().min(0).optional()
        .describe("Maximum price in USD. On listing_status=for_rent this is MONTHLY RENT, not sale price."),
      beds_min: z.number().int().min(0).optional()
        .describe("Minimum bedrooms."),
      beds_max: z.number().int().min(0).optional()
        .describe("Maximum bedrooms."),
      baths_min: z.number().min(0).optional()
        .describe("Minimum bathrooms. Half-baths allowed, e.g. 1.5."),
      baths_max: z.number().min(0).optional()
        .describe("Maximum bathrooms. Half-baths allowed, e.g. 2.5."),
      sqft_min: z.number().int().min(0).optional()
        .describe("Minimum living area in square feet."),
      sqft_max: z.number().int().min(0).optional()
        .describe("Maximum living area in square feet."),
      lot_size_min: z.number().int().min(0).optional()
        .describe("Minimum lot size in square feet."),
      lot_size_max: z.number().int().min(0).optional()
        .describe("Maximum lot size in square feet."),
      year_built_min: z.number().int().min(0).optional()
        .describe("Earliest year built, e.g. 1990."),
      year_built_max: z.number().int().min(0).optional()
        .describe("Latest year built, e.g. 2024."),
      max_hoa: z.number().min(0).optional()
        .describe("Maximum monthly HOA fee in USD."),
      home_type: z.enum(["houses", "townhomes", "multi_family", "condos", "apartments", "manufactured", "lots_land"]).optional()
        .describe("Property type filter."),
      days_on_zillow: z.enum(["1", "7", "14", "30", "90", "6m", "12m", "24m", "36m"]).optional()
        .describe("Maximum days on Zillow. CLOSED enum — an unrecognised value returns the UNFILTERED set under a 200 rather than an error."),
      keywords: z.string().min(1).max(200).optional()
        .describe("Free-text keywords matched against the listing description, e.g. 'casita' or 'solar'."),
      has_pool: z.boolean().optional()
        .describe("Restrict to listings with a pool."),
      has_garage: z.boolean().optional()
        .describe("Restrict to listings with a garage."),
      has_air_conditioning: z.boolean().optional()
        .describe("Restrict to listings with air conditioning."),
      is_waterfront: z.boolean().optional()
        .describe("Restrict to waterfront listings."),
      has_basement: z.boolean().optional()
        .describe("Restrict to listings with a basement."),
      is_new_construction: z.boolean().optional()
        .describe("Restrict to new construction."),
      has_open_house: z.boolean().optional()
        .describe("Restrict to listings with a scheduled open house."),
      price_reduced: z.boolean().optional()
        .describe("Restrict to listings whose price was recently reduced."),
      is_3d_tour: z.boolean().optional()
        .describe("Restrict to listings with a 3D tour."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/zillow/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_zillow_property",
    `Get one Zillow listing in full as JSON: address, current price and the complete price history, Zestimate and rent Zestimate, tax history, the listing description, RESO facts, room-by-room detail, assigned schools, scheduled open houses, photos and broker attribution.

Rental BUILDINGS answer differently — floor plans, amenities and unit counts instead of a single home's facts. They also have NO caller-visible zpid: search_zillow returns coordinates in the zpid slot for them, so pass the zillow.com/apartments/ building URL rather than trying to use that value as an id.

Single-listing lookup, no pagination. For a real-estate agent's profile and reviews use get_zillow_agent_reviews instead. Costs 1 credit.`,
    {
      zpid: z.string().min(1)
        .describe("A Zillow zpid (e.g. '20485700'), a zillow.com/homedetails/ URL, or a zillow.com/apartments/ building URL. Rental buildings have no caller-visible zpid — search_zillow puts coordinates in that slot — so pass the /apartments/ URL for those."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/zillow/property", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_zillow_agent_reviews",
    `Get a Zillow real-estate AGENT's profile and their reviews as JSON. This addresses an AGENT by profile screen name — it is NOT a property endpoint and returns nothing about a home. For a home, use get_zillow_property.

Returns the agent's name, photo, brokerage, overall rating, total review count, specialties, languages, licences, service areas and sales counts, plus the review bodies with author, date, rating, text and sub-ratings (local knowledge, responsiveness, negotiation skill).

Zillow server-renders only the FIRST FIVE reviews: \`count\` is how many bodies came back, \`total_review_count\` is how many the agent actually has. There is no page or cursor param and no way to reach the rest — treat the five as the whole available sample.

Costs 1 credit.`,
    {
      screen_name: z.string().min(1).max(200)
        .describe("Agent profile screen name — the <name> in zillow.com/profile/<name>/ — or the full profile URL. May contain spaces."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/zillow/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
