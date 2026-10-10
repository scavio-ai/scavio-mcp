import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/trustpilot.ts field for field (names, enums,
// regexes, min/max). Cross-field rule the backend enforces and zod here does
// not: exactly one of domain or url on business and reviews. A violation comes
// back as a 400 with the reason.
//
// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Defaults are documented in the describe text and
// left for the backend to apply.

const country = () =>
  z.string().regex(/^[A-Za-z]{2}$/, "country must be a 2-letter country code").optional()
    .describe("2-letter country code, e.g. 'US', 'GB', 'DE'. Default 'US'.");

const businessAddress = () => ({
  domain: z.string().min(3).max(253).optional()
    .describe("Business website domain as listed on Trustpilot, e.g. 'www.amazon.com' (domain from search_trustpilot). Pass domain or url."),
  url: z.string().min(1).max(500).optional()
    .describe("A trustpilot.com/review/<domain> URL from any Trustpilot country site, instead of domain."),
});

export function registerTrustpilotTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/trustpilot/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_trustpilot",
    `Search Trustpilot businesses by name or keyword in one country: domain, TrustScore, stars, review count, categories, website, and the email, phone and address the business published (null when it did not). Use to find a business's domain for the other Trustpilot tools, or for lead lists. Up to 100/page. 2 credits/page.`,
    {
      query: z.string().min(1).max(200)
        .describe("Business name, keyword or category, e.g. 'vpn'."),
      country: country(),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Page, 1-based."),
      page_size: z.number().int().min(1).max(100).optional()
        .describe("Businesses/page, max 100. Default 20."),
    },
    post("search"),
  );

  server.tool(
    "get_trustpilot_business",
    `Get a Trustpilot business profile by domain or URL: TrustScore, rating distribution, review count per language, categories, contact details, claimed and verification status, reply rate and average days to reply on negative reviews, consumer alerts, AI review summary and topics (when Trustpilot has them for that language), similar businesses, and the 20 newest reviews. Topic ids feed get_trustpilot_reviews. Unknown domain is a billed 404. 2 credits.`,
    {
      ...businessAddress(),
      language: z.string().regex(/^[a-z]{2}$/, "language must be a 2-letter language code").optional()
        .describe("2-letter language code, default 'en'. Sets the language of the 20 included reviews and of the AI summary/topics. Rating distribution covers every language."),
    },
    post("business"),
  );

  server.tool(
    "get_trustpilot_reviews",
    `Get one page of 20 Trustpilot reviews for a business, filtered by stars, language, date range, topics, text search, verified-only and with-replies, sorted by recency or relevance. Returns total_filtered, so a date_range doubles as review velocity. Max 10 pages = 200 reviews per filter combination; to go further, slice into separate sets (e.g. each stars value x language x date_range). 2 credits/page.`,
    {
      ...businessAddress(),
      page: z.number().int().min(1).max(10).optional()
        .describe("Page 1-10, 20/page. Default 1."),
      stars: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional()
        .describe("Only these star ratings, e.g. [1, 2]."),
      language: z.string().regex(/^(all|[a-z]{2})$/, "language must be all or a 2-letter language code").optional()
        .describe("2-letter review language or 'all'. Default 'all'."),
      date_range: z.enum(["last30days", "last3months", "last6months", "last12months"]).optional()
        .describe("Only reviews published in this window."),
      sort: z.enum(["recency", "relevance"]).optional()
        .describe("Default 'recency' (newest first)."),
      verified_only: z.boolean().optional()
        .describe("Only verified reviews."),
      with_replies: z.boolean().optional()
        .describe("Only reviews the business replied to."),
      topics: z.array(z.string().regex(/^[a-z0-9_]+$/i).max(80)).min(1).max(10).optional()
        .describe("Topic ids from get_trustpilot_business topics, e.g. ['delivery_service']."),
      search: z.string().min(1).max(100).optional()
        .describe("Only reviews containing this text, e.g. 'refund'."),
    },
    post("reviews"),
  );

  server.tool(
    "get_trustpilot_categories",
    `Get the Trustpilot category tree (top-level categories with their subcategories), or categories matching a name. Use to find category_id for get_trustpilot_category. 2 credits.`,
    {
      query: z.string().min(1).max(100).optional()
        .describe("Find categories by name, e.g. 'insurance'. Omit for the full tree."),
      country: country(),
    },
    post("categories"),
  );

  server.tool(
    "get_trustpilot_category",
    `List businesses ranked in a Trustpilot category for one country: TrustScore, review count, location, website, email and phone (when published). Sort by relevance, review count or latest review; filter by minimum TrustScore or claimed profiles only. 20/page. Unknown category is a billed 404. 2 credits/page.`,
    {
      category_id: z.string().regex(/^[a-z0-9_]+$/, "category_id must be a Trustpilot category id such as vpn_service").max(100)
        .describe("Category id from get_trustpilot_categories, e.g. 'vpn_service'."),
      country: country(),
      sort: z.enum(["most_relevant", "reviews_count", "latest_review"]).optional()
        .describe("Default 'most_relevant'."),
      min_trust_score: z.union([z.literal(3), z.literal(4), z.literal(4.5)]).optional()
        .describe("Only businesses with at least this TrustScore: 3, 4 or 4.5."),
      claimed_only: z.boolean().optional()
        .describe("Only businesses that claimed their Trustpilot profile."),
      page: z.number().int().min(1).max(1000).optional()
        .describe("Page, 1-based."),
    },
    post("category"),
  );

  server.tool(
    "get_trustpilot_review",
    `Get one Trustpilot review by id: rating, title, full text, dates, verification, reviewer's public profile summary, the business reply, and the business it is about. Unknown id is a billed 404. 2 credits.`,
    {
      review_id: z.string().regex(/^[a-fA-F0-9]{24}$/, "review_id must be a 24-character Trustpilot review id")
        .describe("24-character review id (review_id from get_trustpilot_business or get_trustpilot_reviews)."),
    },
    post("review"),
  );
}
