import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// No zod `.default()` anywhere in this file, on purpose. The MCP SDK applies a
// zod default BEFORE the handler runs, so a defaulted field is posted on every
// single call whether the model set it or not — which is exactly how the
// shipped Walmart tool ended up sending a value the backend enum rejected.
// Upstream defaults are documented in the .describe() text instead and left for
// the backend to apply.

const geoIdField = () =>
  z.string().min(1).max(500).optional()
    .describe("Tripadvisor geo id — the 'g' half of the g/d pair every Tripadvisor URL is keyed by. Accepts '30196', 'g30196', or any tripadvisor.com URL carrying one. Get it from resolve_tripadvisor_location.");

const categoryField = () =>
  z.enum(["restaurants", "hotels", "attractions"]).optional()
    .describe("Which of Tripadvisor's three location families to read. These are separate URL families, not a filter — they are not interchangeable. Upstream default is 'restaurants'.");

export function registerTripadvisorTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "resolve_tripadvisor_location",
    `START HERE for Tripadvisor. Resolves a place or business NAME to the Tripadvisor ids every other Tripadvisor tool is keyed by, as JSON.

Each row is either a GEO (a city, region or other destination — its geo_id is what search_tripadvisor takes) or a BUSINESS (a restaurant, hotel or attraction — its geo_id + location_id PAIR is what get_tripadvisor_location and get_tripadvisor_reviews take). Rows also carry the display name, type, and parent geography so you can pick the right "Springfield".

Call this first whenever you only have a name. Those ids exist nowhere except inside Tripadvisor's own URLs, so there is no other entry point into this platform.

limit only SIZES this response (1-20, upstream default 12) — it is not a page parameter and this lookup has no pagination. Costs 2 credits.`,
    {
      query: z.string().min(1).max(120)
        .describe("A place or business name to resolve, e.g. 'Austin' or 'Franklin Barbecue'."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Rows to return, 1-20. Upstream default is 12. Sizes the response only — NOT a page parameter."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tripadvisor/locations", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_tripadvisor",
    `List the restaurants, hotels or attractions in a Tripadvisor geo, in Tripadvisor's own ranked order, as JSON. Each row carries rating, review count, price band, address, coordinates, phone, opening hours, the Travelers' Choice badge, and the location_id + geo_id pair needed to look the place up in detail.

Either geo_id or url is required. If you only have a place NAME, call resolve_tripadvisor_location first — geo ids exist only inside Tripadvisor's own URLs.

category picks one of three separate URL families (restaurants, hotels, attractions), not a filter over one list; upstream default is restaurants.

Paginate with page: 30 locations per page. A page beyond the last is a 404, NOT an empty result — stop when a page 404s. Costs 2 credits per page.`,
    {
      geo_id: geoIdField(),
      category: categoryField(),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. 30 locations per page. A page past the last is a 404, not an empty list."),
      url: z.string().min(1).max(500).optional()
        .describe("A full tripadvisor.com listing URL, e.g. 'https://www.tripadvisor.com/Restaurants-g30196-Austin_Texas.html', as an alternative to geo_id + category. Country sites (tripadvisor.co.uk, .fr) work. Either this or geo_id is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tripadvisor/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tripadvisor_location",
    `Get one Tripadvisor restaurant, hotel or attraction in full as JSON: rating, the review histogram and per-aspect sub-ratings, its ranking within the city, price band, cuisines, amenities, address, coordinates, contact details, photos — and the FIRST PAGE OF REVIEWS.

Because page 1 of the reviews already rides along here, do NOT call get_tripadvisor_reviews to read it; use that tool only to page PAST the first page.

Either location_id or url is required, and a bare d-id additionally needs geo_id — Tripadvisor will not resolve a location without its geography. Get both from resolve_tripadvisor_location. An unknown location id is answered upstream with a 200 city listing that is BILLED and restated here as a 404, so use resolved ids rather than guesses.

No pagination on this tool. Costs 2 credits.`,
    {
      location_id: z.string().min(1).max(500).optional()
        .describe("Tripadvisor location id — the 'd' half of the pair. Accepts '1899234', 'd1899234', or a full _Review URL. Either this or url is required."),
      geo_id: geoIdField(),
      category: categoryField(),
      url: z.string().min(1).max(500).optional()
        .describe("A full tripadvisor.com _Review URL, e.g. 'https://www.tripadvisor.com/Restaurant_Review-g30196-d1899234-Reviews.html', as an alternative to the id pair. Either this or location_id is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tripadvisor/location", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tripadvisor_reviews",
    `Get a page of Tripadvisor reviews for one location as JSON: review text and rating, trip date and trip type, the reviewer's home town and contribution count, and any management response.

Use this to page PAST page 1 — page 1 is already included in get_tripadvisor_location, so calling this for it spends a second 2-credit call on reviews you already have.

Page size differs by family: 15 per page for restaurants, 10 for hotels and attractions. category must therefore MATCH the location's own type on any page past the first, or the offsets do not line up. A page beyond the last is a 404, not an empty result.

Consecutive pages can REPEAT one review at the boundary — de-duplicate on review_id when concatenating pages. Either location_id or url is required (a bare d-id also needs geo_id). Costs 2 credits per page.`,
    {
      location_id: z.string().min(1).max(500).optional()
        .describe("Tripadvisor location id — '1899234', 'd1899234', or a full _Review URL. Either this or url is required."),
      geo_id: geoIdField(),
      category: categoryField(),
      url: z.string().min(1).max(500).optional()
        .describe("A full tripadvisor.com _Review URL, as an alternative to the id pair. Either this or location_id is required."),
      page: z.number().int().min(1).optional()
        .describe("Reviews page, 1-based. 15 per page for restaurants, 10 for hotels and attractions — set category to match the location's own type. A page past the last is a 404."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tripadvisor/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
