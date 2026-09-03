import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// employer_id / company / url repeat on three of the four endpoints. `company`
// is cosmetic on all of them and does NOT satisfy the identifier requirement —
// the backend refine takes employer_id or url only.
const employerIdField = z.string().min(1).max(50).optional()
  .describe("Employer id as string, e.g. '1699' or 'E1699'. Not a number. Either this or url required.");

const companyField = z.string().min(1).max(200).optional()
  .describe("Employer slug name, e.g. 'NIKE'. Cosmetic only.");

export function registerGlassdoorTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "resolve_glassdoor_company",
    `Resolve a company name to a Glassdoor employer_id. Start here. Slow (seconds-minutes), retry on 502. 1 credit.`,
    {
      query: z.string().min(1).max(120)
        .describe("Company name, e.g. 'Nike'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/glassdoor/companies", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_glassdoor_company",
    `Get Glassdoor employer profile with ratings, reviews, and reviews_url/salaries_url for chaining. employer_id or url required. Slow; retry on 502. 1 credit.`,
    {
      employer_id: employerIdField,
      company: companyField,
      url: z.string().min(1).max(500).optional()
        .describe("Glassdoor employer URL. Either this or employer_id required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/glassdoor/company", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_glassdoor_reviews",
    `Get Glassdoor reviews (max 3 per call, login wall). No pagination. Use category/employment_status to shift window. Pass reviews_url from get_glassdoor_company as url to skip a fetch. Slow (~75s). 1 credit.`,
    {
      employer_id: employerIdField,
      company: companyField,
      url: z.string().min(1).max(500).optional()
        .describe("Glassdoor URL. Prefer reviews_url from get_glassdoor_company. Either this or employer_id."),
      category: z.enum(["career_development", "compensation", "culture", "diversity_and_inclusion", "management", "work_life_balance"]).optional()
        .describe("Review topic filter."),
      employment_status: z.enum(["full_time", "part_time", "contract", "intern"]).optional()
        .describe("Employment type filter."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/glassdoor/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_glassdoor_salaries",
    `Get Glassdoor salary estimates by job title (P10-P90 percentiles). 10 titles/page. Pass salaries_url from get_glassdoor_company to skip a fetch. Slow (~41s). 1 credit/page.`,
    {
      employer_id: employerIdField,
      company: companyField,
      url: z.string().min(1).max(500).optional()
        .describe("Glassdoor URL. Prefer salaries_url from get_glassdoor_company. Either this or employer_id."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. 10 titles/page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/glassdoor/salaries", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
