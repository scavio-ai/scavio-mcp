import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

const businessIdField = z.string().min(1).max(500).optional()
  .describe("Business alias, encid, or yelp.com/biz URL.");

export function registerYelpTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_yelp",
    `Search Yelp local businesses. 10 per page. Always pass location or results vary by proxy. 2 credits/page.`,
    {
      term: z.string().min(1).max(200).optional()
        .describe("Category, dish, or business name."),
      location: z.string().min(1).max(200).optional()
        .describe("City/state, address, or ZIP. Required unless url given."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      sort: z.enum(["recommended", "rating", "review_count"]).optional()
        .describe("Sort order."),
      price: z.array(z.number().int().min(1).max(4)).min(1).max(4).optional()
        .describe("Price bands, 1($)-4($$$$)."),
      open_now: z.boolean().optional()
        .describe("Open now only."),
      attributes: z.array(z.string().min(1).max(100)).max(20).optional()
        .describe("Yelp filter aliases, e.g. ['RestaurantsDelivery','GoodForKids']."),
      url: z.string().min(1).max(1000).optional()
        .describe("yelp.com/search URL instead of term+location."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/yelp/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_yelp_business",
    `Get full Yelp business details plus first page of reviews (skip get_yelp_reviews page 1). 2 credits.`,
    {
      business_id: businessIdField,
      url: z.string().min(1).max(1000).optional()
        .describe("yelp.com/biz URL instead of business_id."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/yelp/business", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_yelp_reviews",
    `Get Yelp reviews for a business. 10 per page. Start at page 2 if you already called get_yelp_business. 2 credits/page.`,
    {
      business_id: businessIdField,
      url: z.string().min(1).max(1000).optional()
        .describe("yelp.com/biz URL instead of business_id."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. Start at 2 after get_yelp_business."),
      sort: z.enum(["relevance", "newest", "oldest", "rating_high", "rating_low", "elites"]).optional()
        .describe("Sort order."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Filter to this star rating."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/yelp/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
