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

const companyField = () =>
  z.string().min(1).max(200)
    .describe("Company slug from indeed.com/cmp/<slug>, or full URL. Use company_slug from search results.");

export function registerIndeedTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_indeed_jobs",
    `Search Indeed job postings. Either query or location required; location alone lists all jobs in a metro. radius only 0/5/10/15/25/35/50/100; max_age_days only 1/3/7/14. 2 credits/page.`,
    {
      query: z.string().min(1).max(500).optional()
        .describe("Job keywords, e.g. 'software engineer'."),
      location: z.string().min(1).max(200).optional()
        .describe("City/state, ZIP, or 'Remote'."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. 10 per page."),
      radius: z.union([
        z.literal(0), z.literal(5), z.literal(10), z.literal(15),
        z.literal(25), z.literal(35), z.literal(50), z.literal(100),
      ]).optional()
        .describe("Miles from location. Default 50."),
      max_age_days: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(14)]).optional()
        .describe("Posted within N days."),
      job_type: z.enum(["full_time", "part_time", "contract", "temporary", "internship"]).optional()
        .describe("Employment type."),
      min_salary: z.number().min(0).optional()
        .describe("Min annual salary (Indeed's estimate)."),
      remote: z.boolean().optional()
        .describe("Remote only."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/indeed/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_indeed_job",
    `Get full Indeed job details: description, salary, benefits, employer info. Unknown job key is a billed 404. 2 credits.`,
    {
      job_id: z.string().min(1)
        .describe("Job key or indeed.com URL with jk= param."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/indeed/job", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_indeed_company",
    `Get Indeed employer profile: ratings, salaries, company info. No reviews; use get_indeed_company_reviews. Unknown slug is billed 404. 2 credits.`,
    {
      company: companyField(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/indeed/company", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_indeed_company_reviews",
    `Get Indeed employee reviews for a company. 20 per page. Unknown slug is billed 404. 2 credits/page.`,
    {
      company: companyField(),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/indeed/company/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
