import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/realtor.ts field for field (names, enums,
// regexes, min/max). Cross-field rules the backend enforces and zod here does
// not; a violation comes back as a 400 with the reason:
//   search:   location, latitude + longitude + radius_miles, or agent_id;
//             page x page_size <= 10,000
//   property: exactly one of property_id or url
//   agents:   exactly one of location, postal_code or name
//
// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Defaults are documented in the describe text and
// left for the backend to apply.

const NON_DISCLOSURE =
  "Sold prices are null in US non-disclosure states (Texas, Utah, Wyoming and about nine others); sold dates still come back.";

const LISTING_STATUSES = ["for_sale", "pending", "for_rent", "sold"] as const;
const PROPERTY_TYPES = ["single_family", "condos", "townhomes", "multi_family", "land", "mobile", "farm"] as const;
const SORTS = [
  "relevance", "newest", "price_low", "price_high", "sold_newest",
  "sqft_high", "lot_size_high", "year_built_new", "recently_updated", "recently_reduced",
] as const;

const agentId = () =>
  z.string().regex(/^\d{1,12}$/, "agent_id must be a numeric Realtor.com agent id");

const count = (description: string) => z.number().int().min(0).optional().describe(description);
const days = (description: string) => z.number().int().min(1).max(3650).optional().describe(description);

export function registerRealtorTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/realtor/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_realtor",
    `Search Realtor.com US listings for sale, pending, for rent or sold, by location, lat/lng radius or agent. Filters: price, beds, baths, sqft, lot size, year built, garage, HOA, property type, listed/sold/price-cut within N days, keywords in the listing text, new construction, foreclosure, open house. Up to 200 listings/call with price, sold price and date, lot size, address with coordinates, MLS id and listing agent. Use for listing watches across many areas and sold comps (e.g. sold land by lot size). First 10,000 results per search: slice by price band, type or area for more. ${NON_DISCLOSURE} 1 credit/page.`,
    {
      location: z.string().min(1).max(200).optional()
        .describe("City ('Austin, TX'), county ('Travis County, TX'), ZIP, state or neighborhood. Pass location, latitude+longitude+radius_miles, or agent_id."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Center latitude for a radius search (with longitude and radius_miles)."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Center longitude for a radius search."),
      radius_miles: z.number().min(0.1).max(50).optional()
        .describe("Radius around latitude/longitude, 0.1-50 miles."),
      agent_id: agentId().optional()
        .describe("Only this agent's listings (agent_id from search rows or search_realtor_agents)."),
      listing_status: z.enum(LISTING_STATUSES).optional()
        .describe("Default 'for_sale' (includes pending/contingent, as on the site). 'pending' = only pending/contingent."),
      exclude_pending: z.boolean().optional()
        .describe("for_sale only: leave out pending and contingent listings."),
      min_price: z.number().min(0).optional()
        .describe("Min USD: list price, sold price on sold, monthly rent on for_rent."),
      max_price: z.number().min(0).optional()
        .describe("Max USD, same meaning as min_price."),
      beds_min: count("Min bedrooms."),
      beds_max: count("Max bedrooms."),
      baths_min: z.number().min(0).optional()
        .describe("Min bathrooms."),
      baths_max: z.number().min(0).optional()
        .describe("Max bathrooms."),
      sqft_min: count("Min interior sqft."),
      sqft_max: count("Max interior sqft."),
      lot_sqft_min: count("Min lot sqft (1 acre = 43,560)."),
      lot_sqft_max: count("Max lot sqft."),
      year_built_min: z.number().int().min(1700).max(2100).optional()
        .describe("Built in or after this year."),
      year_built_max: z.number().int().min(1700).max(2100).optional()
        .describe("Built in or before this year."),
      garage_min: count("Min garage spaces."),
      max_hoa: z.number().min(0).optional()
        .describe("Max monthly HOA fee USD (listings without an HOA fee are kept)."),
      property_types: z.array(z.enum(PROPERTY_TYPES)).min(1).max(7).optional()
        .describe("Only these property types, e.g. ['land']."),
      listed_within_days: days("Only listings listed in the last N days (1-3650)."),
      sold_within_days: days("sold only: only sales in the last N days (1-3650)."),
      price_reduced_within_days: days("Only listings with a price cut in the last N days (1-3650)."),
      keywords: z.array(z.string().min(1).max(60)).min(1).max(10).optional()
        .describe("Only listings whose listing text matches ALL of these (AND, not OR), e.g. ['workshop', 'garage']. Run separate searches for either-or."),
      new_construction: z.boolean().optional()
        .describe("Only new construction."),
      foreclosure: z.boolean().optional()
        .describe("Only foreclosures."),
      has_open_house: z.boolean().optional()
        .describe("Only listings with an open house in the next 7 days."),
      sort: z.enum(SORTS).optional()
        .describe("Default 'relevance'. price_high = sold price on sold; sold_newest is sold only."),
      page: z.number().int().min(1).max(10000).optional()
        .describe("Page, 1-based. page x page_size <= 10,000."),
      page_size: z.number().int().min(1).max(200).optional()
        .describe("Listings/page, 1-200. Default 50."),
    },
    post("search"),
  );

  server.tool(
    "get_realtor_property",
    `Get one Realtor.com property by property_id or URL: description and details, price history, tax history with assessed and market values, three home value estimates with ranges, history and forecast, schools with ratings, flood/wildfire/noise risk, popularity, the listing agent and office with contact details, mortgage estimate and photos. Estimates, schools and risk can be null for land or new construction. ${NON_DISCLOSURE} Unknown id is a billed 404. 1 credit.`,
    {
      property_id: z.string().regex(/^\d{6,12}$/, "property_id must be a numeric Realtor.com property id").optional()
        .describe("Property id from search_realtor or get_realtor_locations. Pass property_id or url."),
      url: z.string().min(1).max(500).optional()
        .describe("A realtor.com property or rental URL, instead of property_id."),
    },
    post("property"),
  );

  server.tool(
    "get_realtor_locations",
    `Autocomplete a partial US place name on Realtor.com: cities, counties, ZIPs, neighborhoods, schools and addresses, each with its slug_id (for get_realtor_market) and, for an address, the property_id (for get_realtor_property). 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("City, county, ZIP, neighborhood, school or street address, e.g. 'Austin'."),
    },
    post("locations"),
  );

  server.tool(
    "get_realtor_market",
    `Get Realtor.com housing market stats for a US city, county or ZIP: median listing, sold and rent price, price per sqft, days on market, lot size, listing and rental counts, year-over-year and month-over-month change, and a breakdown by property type. Some medians are null at some geography levels. 1 credit.`,
    {
      location: z.string().min(1).max(200)
        .describe("A slug_id from get_realtor_locations (e.g. 'Austin_TX', 'Travis-County_TX') or 'City, ST'."),
    },
    post("market"),
  );

  server.tool(
    "search_realtor_agents",
    `Find US real estate agents on Realtor.com by city, ZIP or name: rating, review and recommendation counts, active listing count and price range, homes sold last year, broker, office, first year in business and services. Pass agent_id to get_realtor_agent for the full profile. 1 credit/page.`,
    {
      location: z.string().min(1).max(200).optional()
        .describe("City as 'City, ST'. Pass exactly one of location, postal_code or name."),
      postal_code: z.string().regex(/^\d{5}$/, "postal_code must be a 5-digit ZIP code").optional()
        .describe("5-digit ZIP code."),
      name: z.string().min(2).max(100).optional()
        .describe("Agent name."),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Page, 1-based."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Agents/page, 1-50. Default 20."),
    },
    post("agents"),
  );

  server.tool(
    "get_realtor_agent",
    `Get one Realtor.com agent's profile with every review: bio, phones, website, license number and state, MLS memberships, languages, specializations, served areas, designations, office, social links, listing and sales stats, and each review with responsiveness, market expertise, negotiation and professionalism sub-ratings and the agent's reply. Unknown id is a billed 404. 1 credit.`,
    {
      agent_id: agentId()
        .describe("Agent id from search_realtor rows (agent.agent_id) or search_realtor_agents."),
    },
    post("agent"),
  );
}
