import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

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

const personRef = {
  username: z.string().min(1).optional()
    .describe("Vanity handle, e.g. 'williamhgates'."),
  url: z.string().url().optional()
    .describe("Profile URL (alternative to username)."),
};

const companyRef = {
  company: z.string().min(1).optional()
    .describe("Company slug, e.g. 'microsoft'."),
  url: z.string().url().optional()
    .describe("Company URL (alternative to company)."),
};

const postRef = {
  post_id: z.string().min(1).optional()
    .describe("Post ID or activity URN."),
  url: z.string().url().optional()
    .describe("Post URL (alternative to post_id)."),
};

export function registerLinkedinTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_linkedin_person",
    `Get a LinkedIn member's full profile. 1 credit.`,
    personRef,
    call("/api/v1/linkedin/person"),
  );

  server.tool(
    "get_linkedin_person_about",
    `Get the about/overview slice of a LinkedIn profile. Lighter than get_linkedin_person. 1 credit.`,
    personRef,
    call("/api/v1/linkedin/person/about"),
  );

  server.tool(
    "get_linkedin_person_posts",
    `Get a LinkedIn member's posts. Paginate with next_cursor/has_more. 10 credits/page.`,
    {
      ...personRef,
      type: z.enum(["posts", "comments", "reactions"]).optional()
        .describe("'posts' (default), 'comments', or 'reactions'."),
      cursor: z.string().optional().describe("next_cursor from previous response."),
    },
    call("/api/v1/linkedin/person/posts"),
  );

  server.tool(
    "get_linkedin_company",
    `Get a LinkedIn company profile. 1 credit.`,
    companyRef,
    call("/api/v1/linkedin/company"),
  );

  server.tool(
    "get_linkedin_company_posts",
    `Get a LinkedIn company's posts. Paginate with next_cursor/has_more. 10 credits/page.`,
    {
      ...companyRef,
      cursor: z.string().optional().describe("next_cursor from previous response."),
    },
    call("/api/v1/linkedin/company/posts"),
  );

  server.tool(
    "search_linkedin_jobs",
    `Search LinkedIn jobs. Results rotate; dedupe by job_id. Paginate with next_cursor. 10 credits/page.`,
    {
      search: z.string().min(1).describe("Keyword, e.g. 'software engineer'."),
      location: z.string().optional()
        .describe("e.g. 'United States'. Omit for worldwide."),
      cursor: z.string().optional().describe("next_cursor from previous response."),
    },
    call("/api/v1/linkedin/search/jobs"),
  );

  server.tool(
    "get_linkedin_job",
    `Get full LinkedIn job details. 30 credits (most expensive LinkedIn tool; prefer search_linkedin_jobs fields when sufficient). 404 = no detail upstream, not billed.`,
    {
      job_id: z.string().min(1).optional().describe("Job listing ID."),
      url: z.string().url().optional().describe("Job URL (alternative to job_id)."),
    },
    call("/api/v1/linkedin/job"),
  );

  server.tool(
    "get_linkedin_post",
    `Get a single LinkedIn post's full details. 1 credit.`,
    postRef,
    call("/api/v1/linkedin/post"),
  );

  server.tool(
    "get_linkedin_post_comments",
    `Get comments on a LinkedIn post. Page-number pagination; stop when page is empty. 10 credits/page.`,
    {
      ...postRef,
      page: z.number().int().positive().optional()
        .describe("1-based page number. Stop when page returns empty."),
    },
    call("/api/v1/linkedin/post/comments"),
  );
}
