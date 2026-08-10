import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// SEC EDGAR - US Securities and Exchange Commission regulatory filings. Six
// tools, 1 credit each, flat: the SEC publishes this data itself and even
// include_history, the one call that can buy up to 10 upstream fetches, is
// deliberately still one credit.
//
// LOOKUP FIRST. Callers hold a ticker (AAPL); the API is keyed by CIK
// (0000320193). resolve_sec_company exists to bridge that, and both `cik` and
// `ticker` accept either spelling, which softens the problem without removing
// it - a company NAME still has to be resolved before anything else runs.
//
// No zod `.default()` anywhere in this file, deliberately: the MCP SDK applies
// a zod default BEFORE the handler runs, so a declared default is posted on
// every single call whether the model asked for it or not. Defaults belong to
// the backend, which applies them when a field is absent; they are documented
// in the .describe() text instead.

/** Both spellings are accepted by both fields; one of the two is required. */
const filerRef = {
  cik: z.string().min(1).max(20).optional()
    .describe("Filer CIK in any spelling EDGAR uses: '320193', '0000320193' or 'CIK0000320193'. A ticker is accepted here too. Either this or ticker is required."),
  ticker: z.string().min(1).max(20).optional()
    .describe("Ticker symbol, dotted or dashed ('BRK.B' and 'BRK-B' both resolve). Wins over cik when both are given. Either this or cik is required."),
};

const formItem = z.string().min(1).max(50);
const locationCode = z.string().regex(/^[A-Za-z0-9]{2}$/, "must be a 2-character EDGAR location code");

export function registerSecTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "resolve_sec_company",
    `START HERE for SEC EDGAR, the US Securities and Exchange Commission's public filing system. Resolves a ticker ('AAPL') or a company name to the CIK ('0000320193') that every other SEC tool is keyed by. Returns matching filers as JSON: company name, CIK, ticker symbol, listing exchange, and ready-made submissions, company-facts and EDGAR URLs, tiered by how unambiguous the match is (exact symbol, then exact name, then prefix, then substring) with each row carrying its tier as \`match\`. Not paginated - \`limit\` only sizes the response (1-100, default 10). Costs 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("A ticker ('AAPL', 'BRK.B'), a company name, or a fragment of one."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Rows to return, 1-100. Backend default is 10. Sizes the response; this is NOT a page param."),
      exchange: z.enum(["NASDAQ", "NYSE", "OTC", "CBOE"]).optional()
        .describe("Restrict to one listing venue. Closed set, matched case-insensitively. Filers the SEC lists with no exchange at all are excluded by ANY value, so omit this to see them."),
    },
    call("/api/v1/sec/lookup"),
  );

  server.tool(
    "get_sec_company",
    `Get a US SEC EDGAR filer's profile as JSON: legal and former names, SIC industry, filer category, EIN, LEI, state of incorporation, fiscal year end, business and mailing addresses, every ticker with its exchange, which forms it files and how often, plus a preview of its 10 most recent filings. Requires cik or ticker - if you only have a company name, call resolve_sec_company first. Not paginated. Costs 1 credit.`,
    { ...filerRef },
    call("/api/v1/sec/company"),
  );

  server.tool(
    "get_sec_filings",
    `List one US SEC EDGAR filer's filings as JSON: accession number, form and root form, filing and period dates, 8-K item codes, and direct links to the primary document, the filing index and the attachment directory. Paginated with page + limit (1-500 per page, backend default 50). \`form\` matches the form AND its root form here, so '10-K' also returns the 10-K/A amendments - ask for '10-K/A' to get only amendments. EDGAR's "recent" block is not a fixed window (about a decade for a quiet filer, about a year for a prolific one); include_history reaches further back through up to 10 archived shards and is still 1 credit, with \`history_truncated\` set when the filer had more. Requires cik or ticker. Costs 1 credit.`,
    {
      ...filerRef,
      form: z.union([formItem, z.array(formItem).min(1).max(25)]).optional()
        .describe("Form types to keep: '10-K', ['10-K','10-Q'] or '10-K,8-K'. Matched against the form AND its root form, so '10-K' also returns 10-K/A."),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").optional()
        .describe("Earliest filing date, inclusive, as YYYY-MM-DD."),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").optional()
        .describe("Latest filing date, inclusive, as YYYY-MM-DD."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based."),
      limit: z.number().int().min(1).max(500).optional()
        .describe("Filings per page, 1-500. Backend default is 50."),
      include_history: z.boolean().optional()
        .describe("Also fetch the archived filing history beyond EDGAR's recent block - up to 10 shards, still 1 credit. Off by default. Check history_truncated in the response to see whether the filer had more."),
    },
    call("/api/v1/sec/filings"),
  );

  server.tool(
    "get_sec_concept",
    `Get every value a US SEC EDGAR filer reported for one XBRL financial concept as JSON, newest period first, with the form and filing each number came from. XBRL tags are CASE-SENSITIVE: 'netincomeloss' is a 404 upstream, not a match - call get_sec_facts first to list the tags a filer actually reports. Restatements are KEPT, not collapsed, and each row carries the SEC's \`latest\` comparability flag that tells a quarter apart from its year-to-date twin. Here \`form\` is an EXACT match, so '10-K' EXCLUDES 10-K/A - the opposite of get_sec_filings. Not paginated - \`limit\` only sizes the response (1-2000, default 250). Requires cik or ticker. Costs 1 credit.`,
    {
      ...filerRef,
      concept: z.string().min(1).max(120).regex(/^[A-Za-z][A-Za-z0-9]*$/, "must be an XBRL tag name, e.g. NetIncomeLoss")
        .describe("The XBRL tag to pull, CASE-SENSITIVE: 'NetIncomeLoss', 'Revenues', 'Assets'. Use get_sec_facts to discover valid tags for this filer."),
      taxonomy: z.string().min(1).max(40).regex(/^[A-Za-z][A-Za-z0-9-]*$/, "must be an XBRL taxonomy, e.g. us-gaap").optional()
        .describe("XBRL taxonomy: 'us-gaap' (backend default), 'dei', 'ifrs-full' or 'srt'."),
      unit: z.string().min(1).max(40).optional()
        .describe("Keep only facts reported in this unit. A concept can be reported in more than one - per-share figures are 'USD/shares' while the same statement's totals are 'USD'."),
      form: formItem.optional()
        .describe("Keep only facts sourced from this form type. EXACT match here, so '10-K' excludes 10-K/A."),
      limit: z.number().int().min(1).max(2000).optional()
        .describe("Facts to return, 1-2000, newest period first. Backend default is 250. Sizes the response; there is no paging."),
    },
    call("/api/v1/sec/concept"),
  );

  server.tool(
    "get_sec_facts",
    `Get the index of every XBRL concept a US SEC EDGAR filer reports as JSON - tag, label, description, units and most recent value - across us-gaap, dei and any other taxonomy it uses. This is the discovery step: find the tag here, then pull its full history with get_sec_concept. Not paginated - \`limit\` only sizes the response (1-2000, default 250). Requires cik or ticker. Costs 1 credit.`,
    {
      ...filerRef,
      taxonomy: z.string().min(1).max(40).optional()
        .describe("Restrict to one XBRL taxonomy, e.g. 'us-gaap' or 'dei'. Omit to see every taxonomy the filer uses."),
      query: z.string().min(1).max(200).optional()
        .describe("Case-insensitive substring match against the tag name and its label, e.g. 'revenue'."),
      limit: z.number().int().min(1).max(2000).optional()
        .describe("Concepts to return, 1-2000. Backend default is 250. Sizes the response; there is no paging."),
    },
    call("/api/v1/sec/facts"),
  );

  server.tool(
    "search_sec_filings",
    `Full-text search across US SEC EDGAR filing DOCUMENTS. Coverage STARTS IN 2001 - nothing filed earlier is in this index. Each hit comes back as JSON with the document URL, form, filing date and filer identity, plus facets breaking the whole result set down by company, form, industry and state. Accepts NO query at all: a cik, ticker, form or date filter on its own is a valid search. Paginated with page at 100 documents per page and CAPPED AT PAGE 100, because the index refuses a result window past 10,000. Use get_sec_filings instead when you want one known filer's complete filing list rather than a text match. Costs 1 credit.`,
    {
      query: z.string().min(1).max(500).optional()
        .describe("Full-text query over filing documents. A quoted phrase ('\"climate risk\"') is matched exactly; bare words are matched as a bag of terms. Optional - filters alone are a valid search."),
      cik: z.union([z.string().min(1).max(20), z.array(z.string().min(1).max(20)).min(1).max(25)]).optional()
        .describe("Restrict to one or more filers by CIK, as a string or an array of up to 25. Tickers are accepted here too."),
      ticker: z.union([z.string().min(1).max(20), z.array(z.string().min(1).max(20)).min(1).max(25)]).optional()
        .describe("Restrict to one or more filers by ticker symbol, as a string or an array of up to 25."),
      form: z.union([formItem, z.array(formItem).min(1).max(25)]).optional()
        .describe("Form types to keep: '8-K', ['10-K','10-Q'] or '10-K,10-Q'."),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").optional()
        .describe("Earliest filing date, inclusive, as YYYY-MM-DD. Full-text coverage starts in 2001."),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").optional()
        .describe("Latest filing date, inclusive, as YYYY-MM-DD."),
      location: z.union([locationCode, z.array(locationCode).min(1).max(25)]).optional()
        .describe("Filer business-address locations as EDGAR's own 2-character codes ('CA', 'NY', and its alphanumeric codes for foreign jurisdictions), as a string or an array of up to 25."),
      sort: z.enum(["relevance", "newest", "oldest"]).optional()
        .describe("Result ordering. Backend default is the index's own relevance ranking."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Results page, 1-based, 100 documents per page. Page 100 is the last page for ANY query - the index refuses a result window past 10,000."),
    },
    call("/api/v1/sec/search"),
  );
}
