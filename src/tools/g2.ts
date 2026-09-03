import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerG2Tools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_g2_software",
    `Search G2 B2B software products. 5 credits/call (most expensive platform). Query or url required.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Search term, e.g. 'project management'."),
      url: z.string().min(1).max(1000).optional()
        .describe("g2.com search URL instead of query."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Per page, 1-100. Default 20."),
      sort: z.enum(["relevance", "popular", "alphabetical", "rating"]).optional()
        .describe("Sort order."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Min star rating."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/g2/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_g2_product",
    `Get G2 product profile: ratings, pricing, features, alternatives. No review text; use get_g2_reviews. 5 credits.`,
    {
      product_id: z.string().min(1).max(200).optional()
        .describe("Product slug ('notion') or numeric id ('82623')."),
      url: z.string().min(1).max(1000).optional()
        .describe("g2.com product URL instead of product_id."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/g2/product", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_g2_reviews",
    `Get G2 review text for a product. 10 per page. rating filter is half-star-inclusive. 5 credits/page.`,
    {
      product_id: z.string().min(1).max(200).optional()
        .describe("Product slug or numeric id."),
      url: z.string().min(1).max(1000).optional()
        .describe("g2.com reviews URL instead of product_id."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. 10 per page."),
      sort: z.enum(["relevance", "newest", "most_helpful", "rating_high", "rating_low"]).optional()
        .describe("Sort order."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Star bucket. Half-star-inclusive: 1 includes 0-1 stars."),
      company_size: z.enum(["small_business", "mid_market", "enterprise"]).optional()
        .describe("small_business <=50, mid_market 51-1000, enterprise >1000."),
      role: z.enum(["user", "administrator", "executive_sponsor", "internal_consultant", "consultant", "agency", "industry_analyst"]).optional()
        .describe("Reviewer role."),
      region: z.enum(["north_america", "europe", "asia", "latin_america", "anz", "middle_east", "africa"]).optional()
        .describe("Reviewer region."),
      query: z.string().min(1).max(200).optional()
        .describe("Text search within reviews."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/g2/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
