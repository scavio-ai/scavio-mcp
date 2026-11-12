import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Mirrors backend/src/routes/company.ts. One of url / place_id is required;
// the backend enforces it (400, not billed), so neither is required here and
// the describe text says so.
//
// The call reads several pages of the company's site, so it takes 10-45s and a
// place_id call can pass 60s. The client sets no fetch deadline of its own.

export function registerCompanyTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "company_enrich",
    "Find a company's contact details and its owner from its website or a Google Maps place_id: published emails, phone numbers, social profiles (facebook, instagram, linkedin, x, tiktok, youtube, pinterest) and the contact page, plus the owner or founder's name and title with source_url, the page that names them. " +
      "Use it after google_maps_search: pass each local result's place_id to turn a list of local businesses into leads. " +
      "Returns data.company {name, website, domain, emails[], phones[], socials, contact_page, address, place_id}, data.owner {name, title, source_url, email, email_status} or null when no page names one, and data.pages_read[]. " +
      "Provide url or place_id. 10 credits from a url, 20 from a place_id (1 when the listing has no readable website); a site that cannot be reached is free. Takes 10-45s.",
    {
      url: z.string().min(3).max(2048).optional()
        .describe("The company's own website; a bare domain works. Not a social profile (that is a 400). Provide this or place_id."),
      place_id: z.string().min(10).max(300).optional()
        .describe("A Google Maps place_id from google_maps_search. The listing is looked up first, then its website is read. 20 credits instead of 10."),
    },
    async (params) => {
      try {
        return trimResponse(await getClient().post("/api/v1/company/enrich", params));
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
