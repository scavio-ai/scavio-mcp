import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ScavioClient } from "../lib/client.js";
import { ApiError } from "../lib/errors.js";

function handleApiError(err: unknown): never | { isError: true; content: { type: "text"; text: string }[] } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { isError: true, content: [{ type: "text", text: "Rate limited. Wait and retry." }] };
    if (err.status === 401) throw new McpError(ErrorCode.InternalError, "Invalid SCAVIO_API_KEY. Check your configuration.");
    return { isError: true, content: [{ type: "text", text: `Scavio API error (${err.status}): ${err.message}` }] };
  }
  throw new McpError(ErrorCode.InternalError, String(err));
}

export function registerLinkedinTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_linkedin_person",
    `Get a LinkedIn member's full profile as JSON. Returns the member urn, public identifier, name, headline, location, premium/open-to-work/hiring flags, avatar, about, experiences, educations, skills, and follower/connection counts. Accepts the public identifier (vanity handle). Costs 4 credits.`,
    {
      username: z.string().min(1)
        .describe("Public identifier (vanity handle), e.g. 'williamhgates'."),
      include_experiences: z.boolean().optional()
        .describe("Include the work experience section (default true)."),
      include_educations: z.boolean().optional()
        .describe("Include the education section (default true)."),
      include_skills: z.boolean().optional()
        .describe("Include the skills section (default true)."),
      include_certifications: z.boolean().optional()
        .describe("Include the certifications section (default true)."),
      include_follower_and_connection: z.boolean().optional()
        .describe("Include follower and connection counts (default true)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/person", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_person_about",
    `Get about/overview metadata for a LinkedIn member as JSON, including join date, contact information, and profile photo. Provide the member urn, or a username that will be resolved to a urn. Costs 4 credits.`,
    {
      urn: z.string().min(1).optional()
        .describe("Member urn, e.g. 'ACoAAA8BYqEBCGLg_vT_ca6mMEqkpp9nVffJ3hc'."),
      username: z.string().min(1).optional()
        .describe("Public identifier; resolved to a urn if urn is omitted, e.g. 'williamhgates'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/person/about", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_person_posts",
    `List a LinkedIn member's recent posts as JSON. Each post includes its ID, type, text, content (images, video, article, poll), and activity counts (likes, comments, shares). Provide the member urn or a username. Use data.next_cursor as the next cursor while has_more is true. Costs 4 credits.`,
    {
      urn: z.string().min(1).optional()
        .describe("Member urn, e.g. 'ACoAAA8BYqEBCGLg_vT_ca6mMEqkpp9nVffJ3hc'."),
      username: z.string().min(1).optional()
        .describe("Public identifier; resolved if urn is omitted, e.g. 'williamhgates'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/person/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_person_contact",
    `Get a LinkedIn member's public contact information as JSON. Accepts the public identifier (vanity handle). Costs 4 credits.`,
    {
      username: z.string().min(1)
        .describe("Public identifier (vanity handle), e.g. 'williamhgates'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/person/contact", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_company",
    `Get a LinkedIn company's profile as JSON. Accepts the company universal name (slug) or a LinkedIn company URL. Costs 1 credit.`,
    {
      company: z.string().min(1)
        .describe("Company universal name (slug) or LinkedIn company URL, e.g. 'microsoft'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/company", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_company_posts",
    `List a LinkedIn company's recent posts as JSON. Accepts the company slug or URL. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      company: z.string().min(1)
        .describe("Company universal name (slug) or LinkedIn company URL, e.g. 'microsoft'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
      count: z.number().int().positive().max(100).optional()
        .describe("Number of posts to return per page (max 100)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/company/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_company_people",
    `List people who work at a LinkedIn company as JSON. Provide the numeric company_id, or a company slug/url that will be resolved to a company_id. Use data.next_cursor as the next cursor while has_more is true. Costs 4 credits.`,
    {
      company_id: z.string().min(1).optional()
        .describe("Numeric company id, e.g. '1035'."),
      company: z.string().min(1).optional()
        .describe("Company slug/url; resolved to a company_id if company_id is omitted, e.g. 'microsoft'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/company/people", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_company_jobs",
    `List a LinkedIn company's open job listings as JSON. Provide the numeric company_id, or a company slug/url that will be resolved to a company_id. Use data.next_cursor as the next cursor while has_more is true. Costs 4 credits.`,
    {
      company_id: z.string().min(1).optional()
        .describe("Numeric company id, e.g. '1035'."),
      company: z.string().min(1).optional()
        .describe("Company slug/url; resolved to a company_id if company_id is omitted, e.g. 'microsoft'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/company/jobs", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_linkedin_people",
    `Search LinkedIn for people as JSON. Filter by name, title, company, or school, and optionally location. Each result includes the member urn, profile URL, public identifier, name, title, location, and verified/premium/open-to-work/hiring flags. Provide at least one of search, title, company, or school. Use data.next_cursor as the next cursor while has_more is true. Costs 4 credits.`,
    {
      search: z.string().min(1).optional()
        .describe("Name to search for, e.g. 'john'."),
      title: z.string().optional()
        .describe("Job title filter, e.g. 'engineer'."),
      company: z.string().optional()
        .describe("Company filter."),
      school: z.string().optional()
        .describe("School filter."),
      location: z.string().optional()
        .describe("A geo name or id to filter by."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/search/people", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_linkedin_jobs",
    `Search LinkedIn for jobs by keyword as JSON, with optional filters for date posted, location, experience level, remote, and job type. Use data.next_cursor as the next cursor while has_more is true. Costs 4 credits.`,
    {
      search: z.string().min(1)
        .describe("Job search keyword, e.g. 'software engineer'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
      date_posted: z.string().optional()
        .describe("Date-posted filter."),
      geocode: z.string().optional()
        .describe("Location geocode filter."),
      experience_level: z.string().optional()
        .describe("Experience-level filter."),
      remote: z.string().optional()
        .describe("Remote filter."),
      job_type: z.string().optional()
        .describe("Job-type filter."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/search/jobs", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_linkedin_posts",
    `Search LinkedIn for posts by keyword as JSON. Each result includes the post ID, URL, title, activity counts (likes, comments, shares), timestamp, and author details. Use data.next_cursor as the next cursor while has_more is true. Costs 4 credits.`,
    {
      search: z.string().min(1)
        .describe("Post search keyword, e.g. 'AI agents'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
      date_posted: z.string().optional()
        .describe("Date-posted filter."),
      sort_by: z.string().optional()
        .describe("Sort order filter."),
      content_type: z.string().optional()
        .describe("Content-type filter."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/search/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_job",
    `Get full details for a single LinkedIn job listing as JSON. Accepts a job ID. Costs 4 credits.`,
    {
      job_id: z.string().min(1)
        .describe("Job ID, e.g. '3900000000'."),
      include_skills: z.boolean().optional()
        .describe("Include the required-skills section."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/job", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_post",
    `Get full details for a single LinkedIn post as JSON. Accepts a post ID or activity urn. Costs 4 credits.`,
    {
      post_id: z.string().min(1)
        .describe("Post id or activity urn, e.g. '7486820977411145728'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/post", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_linkedin_post_comments",
    `Get comments on a LinkedIn post as JSON. Accepts a post ID or activity urn. Use data.next_cursor as the next cursor while has_more is true. Costs 4 credits.`,
    {
      post_id: z.string().min(1)
        .describe("Post id or activity urn, e.g. '7486820977411145728'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
      sort_order: z.enum(["relevance", "recent"]).optional()
        .describe("'relevance' or 'recent'."),
      post_type: z.enum(["activity", "ugc"]).optional()
        .describe("Post type: 'activity' or 'ugc'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/linkedin/post/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
