import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/rightmove.ts field for field (names, enums,
// regexes, min/max; the backend's one-of-number checks are literal unions
// here). Cross-field rules the backend enforces and zod here does not; a
// violation comes back as a 400 with the reason:
//   search:        exactly one of location_id, location or branch_id
//   property:      exactly one of property_id or url
//   sold-property: exactly one of sold_id or url
//   agents:        exactly one of location_id or location
//   agent:         exactly one of url or branch_id
// There is deliberately no keywords field: Rightmove has no keyword filter and
// the backend rejects one with a 400 rather than bill an unfiltered search.
//
// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Defaults are documented in the describe text and
// left for the backend to apply.

const PROPERTY_TYPES = ["detached", "semi_detached", "terraced", "flat", "bungalow", "land", "park_home"] as const;
const TENURES = ["freehold", "leasehold"] as const;

const radius = (description: string) =>
  z.union([
    z.literal(0), z.literal(0.25), z.literal(0.5), z.literal(1), z.literal(3), z.literal(5),
    z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(40),
  ]).optional().describe(description);

const locationId = () =>
  z.string()
    .regex(/^(REGION|OUTCODE|POSTCODE|STATION|BRANCH|STREET)\^\d+$/i, "location_id must be an id from locations such as REGION^904")
    .optional()
    .describe("location_id from get_rightmove_locations, e.g. 'REGION^219' (REGION^, OUTCODE^, POSTCODE^ or STATION^).");

const locationName = () =>
  z.string().min(1).max(100).optional()
    .describe("A UK place name, resolved to its first match (echoed in the response), e.g. 'Bristol'. Alternative to location_id.");

const branchId = () =>
  z.string().regex(/^\d{1,9}$/, "branch_id must be a numeric Rightmove branch id");

export function registerRightmoveTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rightmove/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_rightmove_locations",
    `Look up UK places on Rightmove by town, area, outcode, postcode or station and get the location_id that search_rightmove and search_rightmove_agents take. 1 credit.`,
    {
      query: z.string().min(1).max(100)
        .describe("Town, area, outcode ('SW11'), postcode or station, e.g. 'Bristol'."),
    },
    post("locations"),
  );

  server.tool(
    "search_rightmove",
    `Search UK property for sale or to rent on Rightmove by location_id, place name or agent branch. Filters: price (GBP; monthly on for_rent), beds, baths, property type, must-haves (garden, parking, new home), exclusions (auction, retirement, shared ownership, new home), tenure, added within days, under offer, radius, furnishing and let type. Returns price with qualifier (e.g. Guide Price), address, coordinates, summary, key features, images, tenure, listing dates and agent. 24-25/page, max 42 pages (~1,000 listings) per search: slice by price band, type or area for more. NO keyword filter: match on summary and key_features yourself. 1 credit/page.`,
    {
      location_id: locationId(),
      location: locationName(),
      branch_id: branchId().optional()
        .describe("Only this agent branch's listings (branch_id from search_rightmove_agents). Pass exactly one of location_id, location or branch_id."),
      listing_status: z.enum(["for_sale", "for_rent"]).optional()
        .describe("Default 'for_sale'."),
      min_price: z.number().min(0).optional()
        .describe("Min GBP (monthly rent on for_rent)."),
      max_price: z.number().min(0).optional()
        .describe("Max GBP (monthly rent on for_rent)."),
      beds_min: z.number().int().min(0).max(10).optional()
        .describe("Min bedrooms."),
      beds_max: z.number().int().min(0).max(10).optional()
        .describe("Max bedrooms."),
      baths_min: z.number().int().min(1).max(5).optional()
        .describe("Min bathrooms."),
      property_types: z.array(z.enum(PROPERTY_TYPES)).min(1).max(7).optional()
        .describe("Only these types, e.g. ['detached', 'semi_detached']."),
      must_have: z.array(z.enum(["garden", "parking", "new_home"])).min(1).max(3).optional()
        .describe("Only listings with all of these."),
      exclude: z.array(z.enum(["auction", "retirement", "shared_ownership", "new_home"])).min(1).max(4).optional()
        .describe("Leave these listing kinds out."),
      tenure: z.enum(TENURES).optional()
        .describe("for_sale only."),
      added_within_days: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(14)]).optional()
        .describe("Only listings added in the last 1, 3, 7 or 14 days."),
      include_under_offer: z.boolean().optional()
        .describe("Include under offer / sold STC (for_sale) or let agreed (for_rent)."),
      radius_miles: radius("Widen the area by miles: 0 (default), 0.25, 0.5, 1, 3, 5, 10, 15, 20, 30 or 40."),
      furnishing: z.array(z.enum(["furnished", "part_furnished", "unfurnished"])).min(1).max(3).optional()
        .describe("for_rent only."),
      let_type: z.enum(["long_term", "short_term"]).optional()
        .describe("for_rent only."),
      sort: z.enum(["newest", "oldest", "price_low", "price_high"]).optional()
        .describe("Default 'newest'."),
      page: z.number().int().min(1).max(42).optional()
        .describe("Page 1-42, 24-25/page."),
    },
    post("search"),
  );

  server.tool(
    "get_rightmove_property",
    `Get one Rightmove listing in full by property_id or URL: price and qualifier, description, key features, rooms, images, floorplans, brochures, EPC, tenure and lease years remaining, council tax band, service charge and ground rent, heating, parking, garden, accessibility and flood-risk details, broadband, nearest stations, letting terms and the agent branch with phone. No price history on live listings: use get_rightmove_sold_property for an address's past sales. Removed or unknown listing is a billed 404. 1 credit.`,
    {
      property_id: z.string().regex(/^\d{5,12}$/, "property_id must be a numeric Rightmove listing id").optional()
        .describe("Listing id from search_rightmove. Pass property_id or url."),
      url: z.string().min(1).max(500).optional()
        .describe("A rightmove.co.uk/properties/<id> URL, instead of property_id."),
    },
    post("property"),
  );

  server.tool(
    "get_rightmove_sold",
    `Get UK sold house prices for a town, outcode or postcode in England or Wales: 25 addresses/page, each with its full sale history since 1995 (price, date, tenure, new build), property type, beds, baths and coordinates, plus an area summary with the average price over the last year. Filter by type, tenure, years since sale and radius; sort by date or price. Use for UK comps and price trends. Max 40 pages per search: narrow by type, tenure, years or postcode for more. 1 credit/page.`,
    {
      location: z.string().min(2).max(80)
        .describe("Town, outcode ('SW11') or full postcode ('SW11 1AA') in England or Wales."),
      property_type: z.enum(["flat", "detached", "semi_detached", "terraced", "other"]).optional()
        .describe("Only this property type."),
      tenure: z.enum(TENURES).optional()
        .describe("Only this tenure."),
      sold_within_years: z.union([
        z.literal(1), z.literal(2), z.literal(3), z.literal(5),
        z.literal(10), z.literal(15), z.literal(20), z.literal(30),
      ]).optional()
        .describe("Only addresses sold in the last 1, 2, 3, 5, 10, 15, 20 or 30 years."),
      radius_miles: radius("Widen the area by miles: 0 (default) to 40, same steps as search_rightmove."),
      sort: z.enum(["newest", "price_low", "price_high"]).optional()
        .describe("Default 'newest' (latest sale first)."),
      page: z.number().int().min(1).max(40).optional()
        .describe("Page 1-40, 25 addresses/page."),
    },
    post("sold"),
  );

  server.tool(
    "get_rightmove_sold_property",
    `Get one sold UK address from Rightmove by sold_id or URL: every recorded sale with exact price, date, tenure, new-build flag and percent change since the previous sale, the postcode, and the archived last listing (beds, baths, key features, photos, floorplans, advertised dates) when it was listed on Rightmove. Unknown id is a billed 404. 1 credit.`,
    {
      sold_id: z.string().regex(/^[0-9a-fA-F-]{36}$/, "sold_id must be a sold_id returned by sold").optional()
        .describe("sold_id from get_rightmove_sold. Pass sold_id or url."),
      url: z.string().min(1).max(500).optional()
        .describe("A rightmove.co.uk/house-prices/details/<id> URL, instead of sold_id."),
    },
    post("sold-property"),
  );

  server.tool(
    "search_rightmove_agents",
    `Find UK estate and letting agent branches on Rightmove for a location: name, brand, company and brand ids, sales and lettings phones, address, sales/lettings flags, description, profile URL and logo. 20 branches/page, max 50 pages: use an outcode in a big city. Pass branch_id to get_rightmove_agent or search_rightmove. 1 credit/page.`,
    {
      location_id: locationId(),
      location: z.string().min(1).max(100).optional()
        .describe("A UK place name, resolved to its first match. Pass exactly one of location_id or location."),
      page: z.number().int().min(1).max(50).optional()
        .describe("Page 1-50, 20/page."),
    },
    post("agents"),
  );

  server.tool(
    "get_rightmove_agent",
    `Get one Rightmove agent branch by branch_id or profile URL: address, phones, coordinates, company, sales/lettings/commercial/development flags, descriptions, logo, affiliations, and the count plus a teaser of its listings for sale and to rent. Use search_rightmove with branch_id for every listing. Unknown branch is a billed 404. 1 credit.`,
    {
      branch_id: branchId().optional()
        .describe("branch_id from search_rightmove_agents or a listing's agent. Pass branch_id or url."),
      url: z.string().min(1).max(500).optional()
        .describe("A branch profile URL (profile_url from search_rightmove_agents)."),
    },
    post("agent"),
  );
}
