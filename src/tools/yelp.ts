import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

const businessIdField = z.string().min(1).max(500).optional()
  .describe("A Yelp business alias ('desnudo-coffee-austin-2'), its opaque encid ('p88l_DLOIB-yL3Ka8GbGDw'), or any yelp.com/biz URL carrying one. search_yelp returns both id forms on every row. Either this or url is required.");

export function registerYelpTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_yelp",
    `Search Yelp for local businesses and return them in Yelp's own ranked order as JSON. Each row carries business_id AND alias, rating, review count, price band, categories, address, phone/website rails, hours, photos and a review snippet; count is the size of the 10-row page and total_results is Yelp's headline count. Yelp fixes the page size at 10 - use page to go further. location is effectively REQUIRED: Yelp geolocates a location-less search off the proxy exit, so the same request answers about a different metro run to run. Pass term AND location, or a full yelp.com/search URL. sort is a closed set because Yelp silently IGNORES an unrecognised value and serves default ranking under a billed 200. Costs 2 credits per page.`,
    {
      term: z.string().min(1).max(200).optional()
        .describe("What to look for: a category ('plumbers'), a dish, or a business name. Required together with location unless url is given."),
      location: z.string().min(1).max(200).optional()
        .describe("Where to look: a city and region ('Austin, TX'), a full address, or a postcode. Effectively required - without it Yelp answers about whatever metro the proxy exits from. Required together with term unless url is given."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. Yelp fixes the page size at 10. Defaults to 1."),
      sort: z.enum(["recommended", "rating", "review_count"]).optional()
        .describe("Result ordering. Closed set - an unrecognised value is silently ignored by Yelp and you pay for default ranking. Defaults to 'recommended' (Yelp's own ranking)."),
      price: z.array(z.number().int().min(1).max(4)).min(1).max(4).optional()
        .describe("Price bands to include, 1 ($) to 4 ($$$$). Combine freely: [1, 2] means $ or $$."),
      open_now: z.boolean().optional()
        .describe("Only businesses open at the moment of the request."),
      attributes: z.array(z.string().min(1).max(100)).max(20).optional()
        .describe("Raw Yelp filter aliases sent through as 'attrs', e.g. ['RestaurantsDelivery', 'GoodForKids', 'WheelchairAccessible']. PASSTHROUGH, not an enum - Yelp's vocabulary runs to ~117 values per vertical, and an alias Yelp does not know is ignored upstream so results come back unfiltered."),
      url: z.string().min(1).max(1000).optional()
        .describe("A full yelp.com/search URL as an alternative to term + location, e.g. 'https://www.yelp.com/search?find_desc=coffee&find_loc=Austin%2C+TX'. Query, offset and sort are read out of it."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/yelp/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_yelp_business",
    `Get one Yelp business in full as JSON: rating and per-star histogram, review count, price band, categories, address and coordinates, phone, website and menu links, hours and holidays, amenities, photos and videos, popular items, health inspections, Q&A, licences and claim status - PLUS the first page of reviews at no extra cost, so do NOT follow this with get_yelp_reviews page 1. Yelp's recommendation software hides some reviews entirely; those are never returned and are counted in not_recommended_review_count. popular_items rows can arrive as stub shells with every field null but identifier - those rows are dropped and popular_items_omitted flags it. Requires business_id or url. No pagination. Costs 2 credits.`,
    {
      business_id: businessIdField,
      url: z.string().min(1).max(1000).optional()
        .describe("A full yelp.com/biz URL as an alternative to business_id, e.g. 'https://www.yelp.com/biz/desnudo-coffee-austin-2'. Either this or business_id is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/yelp/business", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_yelp_reviews",
    `Get a page of Yelp reviews for one business as JSON: rating, full text, language, author profile and expertise counts, attached photos, reaction counts and owner response. PAGE 1 IS REDUNDANT - it re-fetches the same document get_yelp_business already returned and costs another 2 credits, so start at page 2 whenever you have already called get_yelp_business. Yelp fixes the page size at 10, and a page past the last review is a 404, not an empty result. The rating filter changes filtered_review_count, not review_count. sort is a closed set because Yelp silently IGNORES an unrecognised value and serves default ranking under a billed 200. Reviews Yelp's recommendation software hides are never returned here. Requires business_id or url. Costs 2 credits per page.`,
    {
      business_id: businessIdField,
      url: z.string().min(1).max(1000).optional()
        .describe("A full yelp.com/biz URL as an alternative to business_id. Either this or business_id is required."),
      page: z.number().int().min(1).optional()
        .describe("Reviews page, 1-based, 10 per page. START AT 2 if you already called get_yelp_business - page 1 returns the same reviews it already gave you and costs another 2 credits. A page past the last review is a 404. Defaults to 1."),
      sort: z.enum(["relevance", "newest", "oldest", "rating_high", "rating_low", "elites"]).optional()
        .describe("Review ordering. Closed set - an unrecognised value is silently ignored by Yelp and you pay for default ranking. Defaults to 'relevance'."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews at this star rating, 1-5. Changes filtered_review_count on the response, not review_count."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/yelp/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
