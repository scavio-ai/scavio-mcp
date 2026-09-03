import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Here that would be actively harmful: a bare ZIP in
// `location` works alone but silently resolves to a DIFFERENT city as soon as
// any filter or sort rides along, and a defaulted listing_status or sort would
// attach one to every call. Upstream defaults are documented in describe text.

export function registerZillowTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_zillow",
    `Search Zillow US real-estate listings. TRAP: bare ZIP + any filter/sort returns wrong city; use city name when filtering. On for_rent, prices mean monthly rent. 1 credit/page.`,
    {
      location: z.string().min(1).max(200)
        .describe("Zillow slug ('austin-tx'), 'City, ST', ZIP, or zillow.com URL. Bare ZIP unsafe with filters."),
      listing_status: z.enum(["for_sale", "for_rent", "sold"]).optional()
        .describe("Default 'for_sale'. On 'for_rent' prices mean monthly rent."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      sort: z.enum([
        "relevance", "recommended", "newest", "price_low", "price_high",
        "payment_low", "payment_high", "beds", "baths", "sqft", "lot_size",
        "zestimate_low", "zestimate_high", "recent_change",
      ]).optional()
        .describe("Sort order. Any sort makes bare-ZIP unsafe."),
      min_price: z.number().min(0).optional()
        .describe("Min price USD. Monthly rent if for_rent."),
      max_price: z.number().min(0).optional()
        .describe("Max price USD. Monthly rent if for_rent."),
      beds_min: z.number().int().min(0).optional()
        .describe("Min bedrooms."),
      beds_max: z.number().int().min(0).optional()
        .describe("Max bedrooms."),
      baths_min: z.number().min(0).optional()
        .describe("Min baths (half allowed, e.g. 1.5)."),
      baths_max: z.number().min(0).optional()
        .describe("Max baths."),
      sqft_min: z.number().int().min(0).optional()
        .describe("Min sqft."),
      sqft_max: z.number().int().min(0).optional()
        .describe("Max sqft."),
      lot_size_min: z.number().int().min(0).optional()
        .describe("Min lot sqft."),
      lot_size_max: z.number().int().min(0).optional()
        .describe("Max lot sqft."),
      year_built_min: z.number().int().min(0).optional()
        .describe("Earliest year built."),
      year_built_max: z.number().int().min(0).optional()
        .describe("Latest year built."),
      max_hoa: z.number().min(0).optional()
        .describe("Max monthly HOA USD."),
      home_type: z.enum(["houses", "townhomes", "multi_family", "condos", "apartments", "manufactured", "lots_land"]).optional()
        .describe("Property type."),
      days_on_zillow: z.enum(["1", "7", "14", "30", "90", "6m", "12m", "24m", "36m"]).optional()
        .describe("Max days on Zillow. Closed enum."),
      keywords: z.string().min(1).max(200).optional()
        .describe("Text search in listing description."),
      has_pool: z.boolean().optional()
        .describe("Pool filter."),
      has_garage: z.boolean().optional()
        .describe("Garage filter."),
      has_air_conditioning: z.boolean().optional()
        .describe("AC filter."),
      is_waterfront: z.boolean().optional()
        .describe("Waterfront filter."),
      has_basement: z.boolean().optional()
        .describe("Basement filter."),
      is_new_construction: z.boolean().optional()
        .describe("New construction filter."),
      has_open_house: z.boolean().optional()
        .describe("Open house filter."),
      price_reduced: z.boolean().optional()
        .describe("Price reduced filter."),
      is_3d_tour: z.boolean().optional()
        .describe("3D tour filter."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/zillow/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_zillow_property",
    `Get full Zillow listing details. Rental buildings have no zpid; pass their /apartments/ URL instead. 1 credit.`,
    {
      zpid: z.string().min(1)
        .describe("Zpid, /homedetails/ URL, or /apartments/ URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/zillow/property", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_zillow_agent_reviews",
    `Get a Zillow real-estate agent's profile and reviews (max 5 returned). NOT a property endpoint. 1 credit.`,
    {
      screen_name: z.string().min(1).max(200)
        .describe("Agent screen name from zillow.com/profile/<name>/, or full URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/zillow/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
