import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

export function registerCapterraTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_capterra_software",
    `Capterra, the B2B software review site. Search it for business software and get 20 ranked products back as JSON: name, vendor description, star rating, review count, logo and a paid-placement flag. Every row carries the product_id and slug that get_capterra_product and get_capterra_reviews take, so this is the entry point when you only have a product name or a category. THIS SEARCH DOES NOT PAGINATE AND CANNOT RETURN MORE THAN 20 PRODUCTS: Capterra fixes the result set at 20 and serves identical rows for ?page=2, so there is deliberately no page parameter - narrow the query instead of trying to page. A query (or a url that carries one) is REQUIRED: a term-less Capterra search serves a fixed popular-products list that has nothing to do with what you asked for. Costs 2 credits.`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Software search term, e.g. 'help desk' or 'notion'. Either this or url is required - without one, Capterra serves an unrelated popular-products list."),
      url: z.string().min(1).max(1000).optional()
        .describe("Full Capterra search URL to run verbatim (capterra.com, capterra.co.uk and capterra.com.br are accepted). Either this or query is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/capterra/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_capterra_product",
    `Capterra, the B2B software review site. Get one software product's full Capterra profile as JSON: overall rating with the per-star histogram and the four scored criteria, likelihood to recommend, review sentiment and topics, the complete pricing table with every plan and its features, every rated feature, every integration, AI-derived pros and cons with the review each was quoted from, FAQs, screenshots, badges and awards, competitor comparisons and alternatives, and the buyer profile broken down by company size, industry and job function. THE 25 MOST RECENT REVIEWS RIDE ALONG AT NO EXTRA COST - only call get_capterra_reviews when you need to page past them. The vendor field IS ALWAYS NULL here: Capterra does not publish it as structured data on the product page (the individual reviews name the vendor instead). product_id MUST BE A STRING - a JSON number is rejected - and it is the number in a /p/186596/Notion/ URL. The slug parameter is cosmetic on this endpoint. No pagination. Pass product_id or url - at least one is required. Costs 2 credits.`,
    {
      product_id: z.string().min(1).max(50).optional()
        .describe("Capterra product id as a STRING - the number in /p/186596/Notion/, so '186596'. A JSON number is rejected. Either this or url is required."),
      slug: z.string().min(1).max(200).optional()
        .describe("Product slug. COSMETIC on this endpoint - /p/186596/Zzzjunk/ returns the same profile byte-for-byte. It is load-bearing on get_capterra_reviews."),
      url: z.string().min(1).max(1000).optional()
        .describe("Full Capterra product URL, e.g. 'https://www.capterra.com/p/186596/Notion/'. Either this or product_id is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/capterra/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_capterra_reviews",
    `Capterra, the B2B software review site. Get one page of written reviews for a software product as JSON: the overall score plus five per-criterion scores, title, pros, cons, advice to others, how long the reviewer used it, the incentivized flag, alternatives they considered and what they switched from, reviewer job title, industry and company size, and the vendor's response. It also carries a richer competitor list than the profile page does, each alternative with its own rating histogram and starting price. USE THIS ONLY TO PAGE PAST THE FIRST 25 REVIEWS - get_capterra_product already returns the 25 most recent at no extra cost. 25 reviews per page, HARD-CAPPED AT PAGE 100 no matter how many reviews the product has; past page 100 Capterra answers with page one. The slug parameter is LOAD-BEARING here, unlike on the product endpoint: it is case-sensitive upstream and a wrong one silently serves PAGE ONE under a billed success, so pass back the slug or reviews_url you got from search_capterra_software or get_capterra_product. Pass product_id or url - at least one is required. Costs 2 credits per page.`,
    {
      product_id: z.string().min(1).max(50).optional()
        .describe("Capterra product id as a STRING, e.g. '186596'. Either this or url is required."),
      slug: z.string().min(1).max(200).optional()
        .describe("Product slug. LOAD-BEARING here: case-sensitive upstream, and a wrong one silently serves page one under a billed success. Pass back the slug from search_capterra_software or get_capterra_product."),
      url: z.string().min(1).max(1000).optional()
        .describe("Full Capterra reviews URL. Passing back reviews_url from get_capterra_product is the most reliable way to page. Either this or product_id is required."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page number, 1-100. 25 reviews per page. 100 is a hard cap whatever the review count says - past it Capterra serves page one again."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/capterra/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
