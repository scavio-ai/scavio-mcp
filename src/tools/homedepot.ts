import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. That matters more here than elsewhere: Home Depot
// does NOT fall back on an unknown sort — it answers 200 with an empty page
// that scrape.do still bills — so a bad value costs credits and returns
// nothing. Upstream defaults are documented in the describe text instead.

export function registerHomeDepotTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_home_depot",
    `Search Home Depot and return the product grid as JSON. Each row carries the item id and URL, title, brand and model number, price with any promotion or was-price, rating and review count, badges, image, and per-store pickup and delivery availability.

PAGE SIZE IS FIXED AT 12 products and cannot be changed — there is no per_page param. Paging is the only way to read further, so budget for it: 100 products is 9 calls, and at 2 credits each that is 18 credits.

sort_by is a CLOSED enum. Home Depot does not fall back on an unrecognised sort — it answers 200 with an EMPTY page that is still billed — so only send one of the listed values. 'Newest' (arrivaldate) is deliberately absent because Home Depot accepts it on category pages and rejects it on keyword search.

Out-of-range pages come back as billed 200 shells that we restate as 404. Costs 2 credits per page.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product search query, e.g. 'cordless drill 20v'."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. 12 products per page, FIXED — paging is the only way to read further. One page per call, 2 credits each."),
      sort_by: z.enum(["best_match", "top_sellers", "top_rated", "price_low", "price_high"]).optional()
        .describe("Sort order. CLOSED enum — an unrecognised value returns a billed, EMPTY page rather than an error, so never send anything outside this list. Upstream default is 'best_match'. 'Newest' is unavailable on keyword search."),
      min_price: z.number().min(0).optional()
        .describe("Minimum price filter in USD."),
      max_price: z.number().min(0).optional()
        .describe("Maximum price filter in USD."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/homedepot/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_home_depot_product",
    `Get one Home Depot item in full as JSON: title, item id and URL, brand and model number, pricing and promotions, images and videos, the specification table, dimensions, feature bullets, attached documents (manuals, spec sheets, warranties) and the return policy.

This carries only a 10-REVIEW PREVIEW. Do not treat it as the review source — call get_home_depot_reviews, which is the paginated surface with the full bodies and the rating distribution.

Accepts an item id or a full homedepot.com/p/... URL; tracking params are discarded for you. An unknown item id arrives from Home Depot as a billed 200 shell and is restated as a 404. No pagination. Costs 2 credits.`,
    {
      item_id: z.string().min(1)
        .describe("Home Depot item id, e.g. '206566893', or a full homedepot.com/p/... URL. Tracking params are stripped."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/homedepot/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_home_depot_reviews",
    `Get one page of Home Depot reviews for an item as JSON: the full review bodies with author, date, rating, title, text, verified-purchase and recommend flags, plus the overall rating distribution, per-attribute ratings, customer photos and any seller or manufacturer responses.

30 reviews per page — use page to walk them. total_pages is the LAST page that exists: asking past it is a 404, so stop there rather than probing for more. This is the paginated review surface; get_home_depot_product only carries a 10-review preview.

Costs 2 credits per page.`,
    {
      item_id: z.string().min(1)
        .describe("Home Depot item id, e.g. '206566893', or a full homedepot.com/p/... URL."),
      page: z.number().int().min(1).optional()
        .describe("Review page, 1-based. 30 reviews per page. Requesting past total_pages returns a 404. One page per call, 2 credits each."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/homedepot/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
