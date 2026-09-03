import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// No zod `.default()` anywhere in this file, on purpose. The MCP SDK applies a
// zod default BEFORE the handler runs, so a defaulted field is posted on every
// single call whether the model set it or not — which is exactly how the
// shipped Walmart tool ended up sending a value the backend enum rejected.
// Upstream defaults are documented in the .describe() text instead and left for
// the backend to apply.

const geoIdField = () =>
  z.string().min(1).max(500).optional()
    .describe("Geo id, e.g. '30196' or 'g30196'. Get from resolve_tripadvisor_location.");

const categoryField = () =>
  z.enum(["restaurants", "hotels", "attractions"]).optional()
    .describe("Location family (default 'restaurants'). Separate URL families, not a filter.");

export function registerTripadvisorTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "resolve_tripadvisor_location",
    `Resolve a place or business name to Tripadvisor ids (geo_id, location_id). Start here before other Tripadvisor tools. 2 credits.`,
    {
      query: z.string().min(1).max(120)
        .describe("Place or business name."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Rows (default 12). Not paginated."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tripadvisor/locations", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_tripadvisor",
    `List restaurants/hotels/attractions in a Tripadvisor geo. 30/page, page past last = 404. geo_id or url required. 2 credits/page.`,
    {
      geo_id: geoIdField(),
      category: categoryField(),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. Page past last = 404."),
      url: z.string().min(1).max(500).optional()
        .describe("Tripadvisor listing URL, alternative to geo_id."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tripadvisor/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tripadvisor_location",
    `Get full Tripadvisor location detail with first page of reviews included. Use get_tripadvisor_reviews only to page past page 1. location_id or url required (bare id needs geo_id too). 2 credits.`,
    {
      location_id: z.string().min(1).max(500).optional()
        .describe("Location id, e.g. '1899234'. Either this or url required."),
      geo_id: geoIdField(),
      category: categoryField(),
      url: z.string().min(1).max(500).optional()
        .describe("Tripadvisor _Review URL, alternative to id pair."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tripadvisor/location", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tripadvisor_reviews",
    `Page past the reviews already in get_tripadvisor_location. 15/page restaurants, 10/page hotels+attractions. Page past last = 404. De-dup on review_id at boundaries. 2 credits/page.`,
    {
      location_id: z.string().min(1).max(500).optional()
        .describe("Location id. Either this or url required."),
      geo_id: geoIdField(),
      category: categoryField(),
      url: z.string().min(1).max(500).optional()
        .describe("Tripadvisor _Review URL, alternative to id pair."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. Match category to location type."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tripadvisor/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
