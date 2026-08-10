import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

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
  .describe("UK company number, from search_companies_house. Zero-padded and upper-cased for you, so '445790', '00445790' and 'sc090312' all resolve. Registry prefixes are supported: SC (Scotland), NI (Northern Ireland), OC/SO/NC (LLPs), FC (overseas), BR (UK establishment), CE (charitable incorporated organisation).");

export function registerCompaniesHouseTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_companies_house",
    `START HERE for Companies House, the official UK company register. Search it by company name or number and get back, as JSON, the company_number that every other Companies House tool is keyed by, plus company name, status (active, dissolved, liquidation), incorporation or dissolution date, registered office address and any matched former names. Search matches CURRENT AND FORMER names, so a company that rebranded is still findable under its old one. Paginated with page at 20 results per page and CAPPED AT PAGE 50: the register serves only a 1000-result window per term however many matches it claims (it will report 10,000 for a broad term and then answer page 51 with an HTTP 416), so narrow the query rather than paging further. UK register only - it holds nothing about US or other non-UK companies. Costs 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Company name or number to search for, e.g. 'tesco'. Must not be blank. Matches current AND former names."),
      page: z.number().int().min(1).max(50)
        .optional()
        .describe("Results page, 1-based, 20 per page. Backend default is 1. Hard cap of 50 - the register only serves the first 1000 matches for a term."),
    },
    call("/api/v1/companieshouse/search"),
  );

  server.tool(
    "get_companies_house_company",
    `Get a UK company's full entry on the Companies House register as JSON: status, company type, incorporation and dissolution dates, registered office address, SIC industry codes, previous names, accounts and confirmation-statement due dates with their overdue flags, and whether it has charges, insolvency history, officers or UK establishments. Overseas companies (FC) also return home registry, legal form and governing law; UK establishments (BR) return the parent company; charitable incorporated organisations (CE) return the charity number. Keyed by company_number - call search_companies_house first if you only have a name. Not paginated. Costs 1 credit.`,
    {
      company_number: companyNumber,
    },
    call("/api/v1/companieshouse/company"),
  );

  server.tool(
    "get_companies_house_officers",
    `List a UK company's officers, current and resigned, from the Companies House register as JSON: name, officer role (director, secretary, LLP member), appointment and resignation dates, correspondence address, nationality, country of residence, month-and-year date of birth, and identity-verification status. There is NO server-side active/resigned filter - the register's own is client-side, so filter on each officer's \`status\` in the response. officers_count is every appointment ever made and resignations_count how many ended, so active officers = the difference. Paginated with page at 35 per page with NO upper page bound: past the last page the register returns an ordinary 200 with an empty list, identical to a company that has no officers, so stop when a page comes back empty. Keyed by company_number from search_companies_house. Costs 1 credit.`,
    {
      company_number: companyNumber,
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based, 35 officers per page. Backend default is 1. No upper bound - a page past the end is a 200 with an empty list, not an error."),
    },
    call("/api/v1/companieshouse/officers"),
  );

  server.tool(
    "get_companies_house_filing_history",
    `List a UK company's filings from the Companies House register as JSON, most recent first: filing date, filing type code (AA annual accounts, CS01 confirmation statement, SH03 share buyback), description, register annotations and child documents, and a link to the filed PDF with its page count. A filing the register has not finished processing carries a processing_note instead of a document link. Paginated with page and NO upper page bound: past the last page it is an ordinary 200 with an empty list, so stop when a page comes back empty. Keyed by company_number from search_companies_house. Costs 1 credit.`,
    {
      company_number: companyNumber,
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. Backend default is 1. No upper bound - a page past the end is a 200 with an empty list, not an error."),
    },
    call("/api/v1/companieshouse/filing-history"),
  );
}
