import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Companies House - the official UK company register. Four tools, 1 credit
// each, flat.
//
// LOOKUP FIRST: search_companies_house is the only entry point that takes a
// name; everything else is keyed by company_number. company_number is
// deliberately loose - the transport zero-pads and upper-cases, because the
// register 404s on /company/445790 and /company/sc090312 for companies that
// plainly exist.
//
// Paging is NOT uniform and the differences are billable. Search is capped at
// page 50 (the register serves a 1000-result window per term whatever hit count
// it prints, then answers page 51 with an HTTP 416). Officers and filing
// history have NO upper bound: past the last page the register returns an
// ordinary 200 with an empty list, which is byte-identical to a company that
// has no officers at all - so an empty page is not proof of a bad page number.
//
// No zod `.default()` anywhere in this file, deliberately: the MCP SDK applies
// a zod default BEFORE the handler runs, so a declared default is posted on
// every call. The backend applies its own defaults when a field is absent;
// they are documented in the .describe() text instead.

const companyNumber = z.string().min(1).max(20)
  .describe("UK company number, e.g. '00445790'. Auto zero-padded/upper-cased.");

export function registerCompaniesHouseTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_companies_house",
    `Search UK Companies House by name or number. Returns company_number needed by other Companies House tools. UK only, max page 50. 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Company name or number, e.g. 'tesco'."),
      page: z.number().int().min(1).max(50)
        .optional()
        .describe("Page, 1-based, 20/page. Max 50."),
    },
    call("/api/v1/companieshouse/search"),
  );

  server.tool(
    "get_companies_house_company",
    `Get a UK company's full Companies House record: status, type, dates, address, SIC codes, previous names, accounts. 1 credit.`,
    {
      company_number: companyNumber,
    },
    call("/api/v1/companieshouse/company"),
  );

  server.tool(
    "get_companies_house_officers",
    `List a UK company's officers (current and resigned). No server-side active filter; check status in response. 35/page, stop on empty page. 1 credit.`,
    {
      company_number: companyNumber,
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based, 35/page. Empty page = no more."),
    },
    call("/api/v1/companieshouse/officers"),
  );

  server.tool(
    "get_companies_house_filing_history",
    `List a UK company's filing history (most recent first) with PDF links. Stop on empty page. 1 credit.`,
    {
      company_number: companyNumber,
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. Empty page = no more."),
    },
    call("/api/v1/companieshouse/filing-history"),
  );
}
