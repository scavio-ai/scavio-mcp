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

const companyField = () =>
  z.string().min(1).max(200)
    .describe("Indeed company slug as it appears in indeed.com/cmp/<slug>, e.g. 'Infosys', or a full profile URL. Slugs are untidy in the wild ('Tata-Consultancy-Services-(tcs)'). This is what company_slug on a job response returns — prefer that over guessing, since an unknown slug is a real 404 that is BILLED.");

export function registerIndeedTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_indeed_jobs",
    `Search Indeed job postings as JSON. Each posting carries its job key, title, employer name and employer rating, location, salary range, job type, benefits, posting age, apply route, and the company_slug that get_indeed_company takes.

Either query or location is required, and a LOCATION-ONLY search is valid — pass location with no query to list every posting in a metro.

Two parameters are closed sets because Indeed silently ignores anything else and returns the UNFILTERED set, which means you get billed for a much wider search than you asked for: radius accepts only 0, 5, 10, 15, 25, 35, 50 or 100 miles (Indeed's own default is 50), and max_age_days accepts only 1, 3, 7 or 14.

min_salary filters on INDEED'S OWN SALARY ESTIMATE for the role, not on a posted figure, so postings that publish no salary at all still match it.

Paginate with page: 10 postings per page. Costs 2 credits per page.`,
    {
      query: z.string().min(1).max(500).optional()
        .describe("Job keyword search, e.g. 'software engineer'. Either this or location is required."),
      location: z.string().min(1).max(200).optional()
        .describe("City and state ('Austin, TX'), postal code, state, country, or 'Remote'. Valid on its own with NO query — that lists every posting in the location. Either this or query is required."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. 10 postings per page, 2 credits per page."),
      radius: z.union([
        z.literal(0), z.literal(5), z.literal(10), z.literal(15),
        z.literal(25), z.literal(35), z.literal(50), z.literal(100),
      ]).optional()
        .describe("Miles from location. ONLY 0, 5, 10, 15, 25, 35, 50 or 100 — Indeed accepts no other value and silently ignores it, returning the unfiltered set. Indeed's own default is 50."),
      max_age_days: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(14)]).optional()
        .describe("Only postings from the last 1, 3, 7 or 14 days. ONLY those four values — anything else is silently ignored upstream."),
      job_type: z.enum(["full_time", "part_time", "contract", "temporary", "internship"]).optional()
        .describe("Employment type filter."),
      min_salary: z.number().min(0).optional()
        .describe("Minimum annual salary. Filters on INDEED'S OWN ESTIMATE for the role, not on a posted figure — postings that publish no salary still match."),
      remote: z.boolean().optional()
        .describe("Only remote postings."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/indeed/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_indeed_job",
    `Get one Indeed job posting in full as JSON: the complete description as both text and HTML, structured salary, employment types, benefits, geocoded address, employer name and rating, applicant count, and the link to the original ATS posting.

Accepts the 16-hex Indeed job key, or any indeed.com URL carrying jk= (/viewjob, /rc/clk and /pagead/clk all work) — tracking parameters are discarded for you. Job keys come from search_indeed_jobs.

An unknown job key is a real 404 upstream that is still BILLED, so do not probe with guessed keys. Single-posting lookup, no pagination. Costs 2 credits.`,
    {
      job_id: z.string().min(1)
        .describe("Indeed job key (16 hex characters), e.g. 'db268b11ac6ba55b', or any indeed.com URL carrying jk=. Tracking params are stripped."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/indeed/job", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_indeed_company",
    `Get an Indeed employer profile as JSON: description, industry, headquarters, company size, revenue, CEO approval, the overall rating plus per-category ratings (work/life balance, pay and benefits, job security, management, culture), reported salaries by role, open roles, and office locations.

Accepts the indeed.com/cmp/<slug> slug or a full profile URL. Take the slug from company_slug on a search_indeed_jobs result — an unknown slug is a real 404 upstream that is still BILLED.

Profile only, no reviews and no pagination: call get_indeed_company_reviews for the review bodies. Costs 2 credits.`,
    {
      company: companyField(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/indeed/company", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_indeed_company_reviews",
    `Get Indeed EMPLOYEE reviews for a company as JSON: review text with per-category ratings, pros and cons, and the reviewer's job title and location, plus aggregated sentiment and the topic, location and job-title breakdowns.

These are reviews of the employer written by staff — use them for employer-brand and workplace research, not for product reviews.

Accepts the indeed.com/cmp/<slug> slug or a full profile URL; an unknown slug is a real 404 upstream that is still BILLED. Paginate with page: 20 reviews per page. Costs 2 credits per page.`,
    {
      company: companyField(),
      page: z.number().int().min(1).optional()
        .describe("Reviews page, 1-based. 20 reviews per page, 2 credits per page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/indeed/company/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
