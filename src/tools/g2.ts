import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

export function registerG2Tools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_g2_software",
    `G2, the B2B software review site. Search it for business software products and get ranked rows back as JSON: product name, star rating, review count, vendor, categories, seller description and logo. Every row carries the product_id and slug that get_g2_product and get_g2_reviews take, so this is the entry point when you only have a product name or a category ("CRM", "project management"). Also returns total_results - G2's Products-tab headline, capped at 10000 - and total_by_type, which breaks the same query across products, sellers, categories and discussions. Paginate with the page parameter; limit is capped at 100 results per request. Pass query or url - at least one is required. COSTS 5 CREDITS PER CALL: G2 is the most expensive platform Scavio serves, so search once with a good query rather than probing. A G2 bot wall comes back as an error that was still billed upstream, so retry sparingly.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Software search term, e.g. 'project management' or 'notion'. Either this or url is required."),
      url: z.string().min(1).max(1000).optional()
        .describe("Full g2.com search URL to run verbatim, e.g. 'https://www.g2.com/search?query=crm'. Either this or query is required."),
      page: z.number().int().min(1).optional()
        .describe("Page number (1-indexed). 20 results per page unless limit says otherwise."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Results per page, 1-100 (default 20). 100 is our hard cap so a single request cannot ask for a multi-megabyte page; G2 itself keeps paginating at any size, so use page to go deeper."),
      sort: z.enum(["relevance", "popular", "alphabetical", "rating"]).optional()
        .describe("Sort order (default 'relevance'). Closed enum on purpose: G2 silently accepts an unknown sort and answers 200 in some unstated order, so an invalid value would look like it worked."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only products at or above this star rating (1-5)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/g2/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_g2_product",
    `G2, the B2B software review site. Get one software product's full G2 profile as JSON: overall rating with the per-star histogram, review count, vendor, description and seller website, pricing editions with parsed amounts, feature groups, categories and breadcrumbs, supported languages, integrations, alternatives, head-to-head comparisons, media, community discussions, and G2's AI-derived pros and cons. THIS ENDPOINT CARRIES NO REVIEW TEXT AT ALL - G2 loads review bodies in a separate frame, so call get_g2_reviews for the actual written reviews. No pagination: one call returns the whole profile. product_id accepts either the slug ('notion') or the numeric G2 id ('82623') as a string; both resolve. Pass product_id or url - at least one is required. COSTS 5 CREDITS PER CALL, the most expensive platform Scavio serves. A G2 bot wall comes back as an error that was still billed upstream, so retry sparingly.`,
    {
      product_id: z.string().min(1).max(200).optional()
        .describe("G2 product slug ('notion') or numeric G2 id as a string ('82623') - both resolve on the same upstream path. Either this or url is required."),
      url: z.string().min(1).max(1000).optional()
        .describe("Full g2.com product URL, e.g. 'https://www.g2.com/products/notion/reviews'. Either this or product_id is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/g2/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_g2_reviews",
    `G2, the B2B software review site. Get one page of written reviews for a software product as JSON: star rating, title, what the reviewer likes and dislikes, problems solved, reviewer job title, industry and company size, and validated/incentivized flags. This is the ONLY G2 tool that returns review text - get_g2_product deliberately has none. It also carries what the profile page has no form of: exact per-star review counts, pros and cons with per-theme counts, and company_size / role / industry / region / category facets with counts. Reviews are FIXED AT 10 PER PAGE and paginate well past the 10 pages G2's own widget links to, so walk page upward. The rating filter is HALF-STAR-INCLUSIVE: rating=1 returns 0, 0.5 and 1-star reviews. Every filter is a closed enum because an unrecognised filter value MATCHES NOTHING upstream and returns "Reviews (0)", which reads like the product genuinely has no such reviews. Pass product_id or url - at least one is required. COSTS 5 CREDITS PER PAGE, the most expensive platform Scavio serves, so filter down rather than paging blindly.`,
    {
      product_id: z.string().min(1).max(200).optional()
        .describe("G2 product slug ('notion') or numeric G2 id as a string ('82623'). Either this or url is required."),
      url: z.string().min(1).max(1000).optional()
        .describe("Full g2.com reviews URL. Either this or product_id is required."),
      page: z.number().int().min(1).optional()
        .describe("Page number (1-indexed). Fixed at 10 reviews per page; pages continue well past the 10 G2's own widget links to."),
      sort: z.enum(["relevance", "newest", "most_helpful", "rating_high", "rating_low"]).optional()
        .describe("Review sort order (default 'relevance'). Closed enum: G2 silently accepts an unknown sort and returns a full result set in some unstated order."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Star bucket, 1-5. HALF-STAR-INCLUSIVE: 1 returns 0, 0.5 and 1-star reviews."),
      company_size: z.enum(["small_business", "mid_market", "enterprise"]).optional()
        .describe("Reviewer company size: small_business (<=50 employees), mid_market (51-1000), enterprise (>1000). An unrecognised value would silently match nothing, hence the closed enum."),
      role: z.enum(["user", "administrator", "executive_sponsor", "internal_consultant", "consultant", "agency", "industry_analyst"]).optional()
        .describe("Reviewer's relationship to the product."),
      region: z.enum(["north_america", "europe", "asia", "latin_america", "anz", "middle_east", "africa"]).optional()
        .describe("Reviewer region."),
      query: z.string().min(1).max(200).optional()
        .describe("Full-text search within this product's reviews. Narrows the review list AND every facet count."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/g2/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
