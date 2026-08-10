import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// employer_id / company / url repeat on three of the four endpoints. `company`
// is cosmetic on all of them and does NOT satisfy the identifier requirement —
// the backend refine takes employer_id or url only.
const employerIdField = z.string().min(1).max(50).optional()
  .describe("Glassdoor employer id as a STRING, in any form Glassdoor writes it: '1699', 'E1699' or 'IE1699'. A JSON number is rejected. Get one from resolve_glassdoor_company. Either this or url is required.");

const companyField = z.string().min(1).max(200).optional()
  .describe("Employer name as it appears in a Glassdoor slug, e.g. 'NIKE'. COSMETIC ONLY - the profile resolves on employer_id alone, and this is ignored entirely when url is set. It does NOT satisfy the employer_id-or-url requirement.");

export function registerGlassdoorTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "resolve_glassdoor_company",
    `START HERE for Glassdoor. Search Glassdoor for a company by name and resolve it to the employer_id that every other Glassdoor tool requires. Returns data with ranked, de-duplicated employer matches, each carrying its employer_id, name and profile URL. The employer_id lives only inside Glassdoor's /Overview/ URLs, so call this first unless you already hold one. No pagination - one ranked set per query. Glassdoor is slow and flaky: expect seconds to tens of seconds, and an occasional 502 after as long as ~3 minutes; retry once before giving up. Costs 1 credit.`,
    {
      query: z.string().min(1).max(120)
        .describe("Company name to resolve, e.g. 'Nike'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/glassdoor/companies", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_glassdoor_company",
    `Get a Glassdoor employer profile as JSON: description, mission, industry, sector, HQ, size band, revenue band, stock symbol, year founded, overall and per-category ratings, star distribution, CEO approval, awards, FAQ, the five server-rendered reviews, plus reviews_url and salaries_url. THE CHAINING STEP: pass reviews_url or salaries_url back as the url parameter of get_glassdoor_reviews / get_glassdoor_salaries to halve the upstream work those calls do. Requires employer_id or url - company alone is NOT an address and is rejected. Use resolve_glassdoor_company to turn a name into an employer_id. No pagination. Slow (roughly 3-47 seconds) and occasionally 502s; retry once. Costs 1 credit.`,
    {
      employer_id: employerIdField,
      company: companyField,
      url: z.string().min(1).max(500).optional()
        .describe("Any glassdoor.com employer URL - /Overview/, /Reviews/ or /Salary/, e.g. 'https://www.glassdoor.com/Overview/Working-at-NIKE-EI_IE1699.11,15.htm'. A non-glassdoor.com host is rejected. Either this or employer_id is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/glassdoor/company", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_glassdoor_reviews",
    `Get Glassdoor employee reviews for one employer as JSON: up to THREE full reviews with per-axis scores, pros, cons, advice to management, job title, location, employment status and employer response - plus complete rating statistics, star distribution, aggregate pro/con highlight terms and per-job-title review counts. HARD CAP OF THREE REVIEWS per call (Glassdoor's login wall) and there is deliberately NO page parameter, so do not attempt to paginate. Move the window with category and employment_status instead, and read filtered_review_count on the response to see how many reviews match. Requires employer_id or url - company alone is NOT an address. Passing the reviews_url from get_glassdoor_company as url skips a fetch. Slow (~75 seconds); retry once on a 502. Costs 1 credit.`,
    {
      employer_id: employerIdField,
      company: companyField,
      url: z.string().min(1).max(500).optional()
        .describe("Any glassdoor.com employer URL. Preferably the reviews_url returned by get_glassdoor_company, which skips the resolve fetch. A non-glassdoor.com host is rejected. Either this or employer_id is required."),
      category: z.enum(["career_development", "compensation", "culture", "diversity_and_inclusion", "management", "work_life_balance"]).optional()
        .describe("Restrict to reviews Glassdoor files under one topic. Closed set: Glassdoor silently IGNORES an unknown value and serves the unfiltered set under a 200."),
      employment_status: z.enum(["full_time", "part_time", "contract", "intern"]).optional()
        .describe("Restrict to one kind of employment. Closed set: Glassdoor silently IGNORES an unknown value and serves the unfiltered set under a 200."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/glassdoor/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_glassdoor_salaries",
    `Get Glassdoor salary data for one employer as JSON, broken down by job title: base-pay and total-pay percentiles P10-P90 with medians called out, sample counts, currency, pay period and last-reported date. These are Glassdoor's ESTIMATES for each job title, not individual reported salaries. Ten job titles per page - pass page for the next ten and read page_count on the response for how many pages exist. Requires employer_id or url - company alone is NOT an address. Passing the salaries_url from get_glassdoor_company as url skips a fetch. Slow (~41 seconds); retry once on a 502. Costs 1 credit per page.`,
    {
      employer_id: employerIdField,
      company: companyField,
      url: z.string().min(1).max(500).optional()
        .describe("Any glassdoor.com employer URL. Preferably the salaries_url returned by get_glassdoor_company, which skips the resolve fetch. A non-glassdoor.com host is rejected. Either this or employer_id is required."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. Ten job titles per page; page_count on the response is how many pages there are. Defaults to 1."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/glassdoor/salaries", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
