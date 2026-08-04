import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ScavioClient } from "../lib/client.js";
import { ApiError } from "../lib/errors.js";

// The provider retired the `linkedin/web/*` namespace these tools were built on.
// The nine below run on `web_v2`: every reference is a vanity handle, slug or id
// (a full LinkedIn URL also works anywhere).
//
// Credit costs are NOT uniform, and each description states its own. Profile,
// company and single-post reads are 1; the paginated list tools are 10 per page;
// job detail is 30. A model choosing between these tools should see the cost, so
// keep it in the description rather than only in the docs.
//
// Five tools were removed rather than left registered - person_contact,
// company_people, company_jobs, search_people and search_posts have no upstream
// and can only return 410. Unlike an SDK method, an MCP tool is a menu item for
// a model: one that always fails burns turns and invites retries, so it is
// better absent. The REST API still answers those paths with an explicit 410.

function handleApiError(err: unknown): never | { isError: true; content: { type: "text"; text: string }[] } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { isError: true, content: [{ type: "text", text: "Rate limited. Wait and retry." }] };
    if (err.status === 401) throw new McpError(ErrorCode.InternalError, "Invalid SCAVIO_API_KEY. Check your configuration.");
    return { isError: true, content: [{ type: "text", text: `Scavio API error (${err.status}): ${err.message}` }] };
  }
  throw new McpError(ErrorCode.InternalError, String(err));
}

const personRef = {
  username: z.string().min(1).optional()
    .describe("Public identifier (vanity handle), e.g. 'williamhgates'."),
  url: z.string().url().optional()
    .describe("Full LinkedIn profile URL, as an alternative to username."),
};

const companyRef = {
  company: z.string().min(1).optional()
    .describe("Company universal name (slug), e.g. 'microsoft'."),
  url: z.string().url().optional()
    .describe("Full LinkedIn company URL, as an alternative to company."),
};

const postRef = {
  post_id: z.string().min(1).optional()
    .describe("Post id or activity urn, e.g. '7488618410256523265'."),
  url: z.string().url().optional()
    .describe("Full LinkedIn post URL, as an alternative to post_id."),
};

export function registerLinkedinTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_linkedin_person",
    `Get a LinkedIn member's full profile as JSON: name, headline, about text, location, avatar, banner, follower and connection counts, current company, full work experience (including grouped multi-role entries), education, honours, bio links and similar profiles. Provide a vanity handle or a full profile URL. Costs 1 credit.`,
    personRef,
    call("/api/v1/linkedin/person"),
  );

  server.tool(
    "get_linkedin_person_about",
    `Get the about/overview slice of a LinkedIn member's profile as JSON: about text, headline, work experience, education, honours and bio links. Use this instead of get_linkedin_person when you only need the narrative sections. Provide a vanity handle or a full profile URL. Costs 1 credit.`,
    personRef,
    call("/api/v1/linkedin/person/about"),
  );

  server.tool(
    "get_linkedin_person_posts",
    `Get a LinkedIn member's posts as JSON, each with text, url, timestamps, a full reaction breakdown (likes, appreciations, empathy, interest, praise), comment and repost counts, attached images, article metadata and the author. Set type to also fetch the posts the member commented on or reacted to. Returns 50 per page with next_cursor and has_more; pass next_cursor back to get the following page. Provide a vanity handle or a full profile URL. Costs 10 credits per page.`,
    {
      ...personRef,
      type: z.enum(["posts", "comments", "reactions"]).optional()
        .describe("Which feed: the member's own posts (default), posts they commented on, or posts they reacted to."),
      cursor: z.string().optional().describe("next_cursor from a previous response, to fetch the next page."),
    },
    call("/api/v1/linkedin/person/posts"),
  );

  server.tool(
    "get_linkedin_company",
    `Get a LinkedIn company profile as JSON: name, about, description, website, industries, specialties, company size, employee and follower counts, headquarters, all office locations, logo, a small sample of featured employees, similar and affiliated companies, and recent updates. Provide a company slug or a full company URL. Costs 1 credit.`,
    companyRef,
    call("/api/v1/linkedin/company"),
  );

  server.tool(
    "get_linkedin_company_posts",
    `Get a LinkedIn company's recent posts as JSON, in the same shape as member posts (text, url, reaction breakdown, comment and repost counts, images, author). Returns 50 per page with next_cursor and has_more; pass next_cursor back for the following page. Provide a company slug or a full company URL. Costs 10 credits per page.`,
    {
      ...companyRef,
      cursor: z.string().optional().describe("next_cursor from a previous response, to fetch the next page."),
    },
    call("/api/v1/linkedin/company/posts"),
  );

  server.tool(
    "search_linkedin_jobs",
    `Search LinkedIn job listings by keyword as JSON, returning title, company, company URL and logo, location, posted time, workplace type and salary for each hit. Returns 25 per page with next_cursor. Note the provider rotates its result set, so pages overlap slightly and repeating the same search returns different listings - dedupe by job id and do not treat it as an exhaustive list. Pass a company name as the search term to approximate a per-company job listing. Costs 10 credits per page.`,
    {
      search: z.string().min(1).describe("Search keyword, e.g. 'software engineer'."),
      location: z.string().optional()
        .describe("Geographic filter, e.g. 'United States'. Omit to search everywhere."),
      cursor: z.string().optional().describe("next_cursor from a previous response, to fetch the next page."),
    },
    call("/api/v1/linkedin/search/jobs"),
  );

  server.tool(
    "get_linkedin_job",
    `Get full details for one LinkedIn job listing as JSON: title, full description, location, employment type, experience level, job functions, industries, benefits, skills, remote flag, closed/expiry state, applicant and view counts, salary, plus the hiring company (name, size, follower count and headquarters). Provide a job id or a full job URL. Costs 30 credits - the most expensive LinkedIn tool, so prefer the fields already present in search_linkedin_jobs when they are enough. A listing with no detail record upstream returns an unbilled 404.`,
    {
      job_id: z.string().min(1).optional().describe("Job listing id, e.g. '4415427228'."),
      url: z.string().url().optional().describe("Full LinkedIn job URL, as an alternative to job_id."),
    },
    call("/api/v1/linkedin/job"),
  );

  server.tool(
    "get_linkedin_post",
    `Get full details for one LinkedIn post as JSON: title, headline, body text, url, timestamp, hashtags, embedded links, images, video and document metadata, like and comment counts, tagged companies and people, the top visible comments, and the author with their follower and post counts. Provide a post id, activity urn, or a full post URL. Costs 1 credit.`,
    postRef,
    call("/api/v1/linkedin/post"),
  );

  server.tool(
    "get_linkedin_post_comments",
    `Get the comments on a LinkedIn post as JSON, each with text, permalink, timestamp, pinned flag, the commenter (name, headline, avatar, profile URL) and any nested replies. Paginated via a 1-based page number; page size varies, so keep incrementing page until a page returns no comments. The total is reported on page 1 only. Provide a post id, activity urn, or a full post URL. Costs 10 credits per page.`,
    {
      ...postRef,
      page: z.number().int().positive().optional()
        .describe("1-based page number. Defaults to 1. Page size varies; stop when a page is empty."),
    },
    call("/api/v1/linkedin/post/comments"),
  );
}
