import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

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
    .describe("CIK, e.g. '0000320193'. Ticker also accepted. Either this or ticker required."),
  ticker: z.string().min(1).max(20).optional()
    .describe("Ticker, e.g. 'AAPL' or 'BRK.B'. Either this or cik required."),
};

const formItem = z.string().min(1).max(50);
const locationCode = z.string().regex(/^[A-Za-z0-9]{2}$/, "must be a 2-character EDGAR location code");

export function registerSecTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "resolve_sec_company",
    `Resolve a ticker or company name to a SEC EDGAR CIK. Start here before other SEC tools. 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Ticker, company name, or fragment."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Rows to return (default 10). Not paginated."),
      exchange: z.enum(["NASDAQ", "NYSE", "OTC", "CBOE"]).optional()
        .describe("Filter by exchange. Omit to include filers with no exchange."),
    },
    call("/api/v1/sec/lookup"),
  );

  server.tool(
    "get_sec_company",
    `Get a SEC EDGAR filer profile: names, industry, addresses, tickers, recent filings. Requires cik or ticker. 1 credit.`,
    { ...filerRef },
    call("/api/v1/sec/company"),
  );

  server.tool(
    "get_sec_filings",
    `List a SEC EDGAR filer's filings. 'form' matches root too ('10-K' includes 10-K/A). Paginated. include_history reaches archived shards. 1 credit.`,
    {
      ...filerRef,
      form: z.union([formItem, z.array(formItem).min(1).max(25)]).optional()
        .describe("e.g. '10-K', ['10-K','10-Q']. Matches root form too."),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").optional()
        .describe("Earliest filing date, YYYY-MM-DD."),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").optional()
        .describe("Latest filing date, YYYY-MM-DD."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      limit: z.number().int().min(1).max(500).optional()
        .describe("Per page (default 50)."),
      include_history: z.boolean().optional()
        .describe("Fetch archived history beyond the recent block."),
    },
    call("/api/v1/sec/filings"),
  );

  server.tool(
    "get_sec_concept",
    `Get all reported values for one XBRL concept. Tags are CASE-SENSITIVE (use get_sec_facts to discover them). 'form' is EXACT here ('10-K' excludes 10-K/A). 1 credit.`,
    {
      ...filerRef,
      concept: z.string().min(1).max(120).regex(/^[A-Za-z][A-Za-z0-9]*$/, "must be an XBRL tag name, e.g. NetIncomeLoss")
        .describe("XBRL tag, CASE-SENSITIVE, e.g. 'NetIncomeLoss'."),
      taxonomy: z.string().min(1).max(40).regex(/^[A-Za-z][A-Za-z0-9-]*$/, "must be an XBRL taxonomy, e.g. us-gaap").optional()
        .describe("e.g. 'us-gaap' (default), 'dei', 'ifrs-full'."),
      unit: z.string().min(1).max(40).optional()
        .describe("Filter by unit, e.g. 'USD' or 'USD/shares'."),
      form: formItem.optional()
        .describe("Exact form match ('10-K' excludes 10-K/A)."),
      limit: z.number().int().min(1).max(2000).optional()
        .describe("Facts to return (default 250). Not paginated."),
    },
    call("/api/v1/sec/concept"),
  );

  server.tool(
    "get_sec_facts",
    `List all XBRL concepts a filer reports. Discovery step: find tags here, then pull history with get_sec_concept. 1 credit.`,
    {
      ...filerRef,
      taxonomy: z.string().min(1).max(40).optional()
        .describe("e.g. 'us-gaap', 'dei'. Omit for all."),
      query: z.string().min(1).max(200).optional()
        .describe("Substring match on tag name/label, e.g. 'revenue'."),
      limit: z.number().int().min(1).max(2000).optional()
        .describe("Rows to return (default 250). Not paginated."),
    },
    call("/api/v1/sec/facts"),
  );

  server.tool(
    "search_sec_filings",
    `Full-text search across SEC EDGAR filing documents. Coverage starts 2001. Capped at page 100 (10k docs). Use get_sec_filings for a single filer's list instead. 1 credit.`,
    {
      query: z.string().min(1).max(500).optional()
        .describe("Full-text query. Quoted phrases matched exactly. Optional if filters set."),
      cik: z.union([z.string().min(1).max(20), z.array(z.string().min(1).max(20)).min(1).max(25)]).optional()
        .describe("CIK(s) or ticker(s), string or array up to 25."),
      ticker: z.union([z.string().min(1).max(20), z.array(z.string().min(1).max(20)).min(1).max(25)]).optional()
        .describe("Ticker(s), string or array up to 25."),
      form: z.union([formItem, z.array(formItem).min(1).max(25)]).optional()
        .describe("e.g. '8-K' or ['10-K','10-Q']."),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").optional()
        .describe("Earliest filing date, YYYY-MM-DD."),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD").optional()
        .describe("Latest filing date, YYYY-MM-DD."),
      location: z.union([locationCode, z.array(locationCode).min(1).max(25)]).optional()
        .describe("EDGAR 2-char location codes, e.g. 'CA', 'NY'."),
      sort: z.enum(["relevance", "newest", "oldest"]).optional()
        .describe("Default: relevance."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-100. 100 docs/page. Max page 100."),
    },
    call("/api/v1/sec/search"),
  );
}
