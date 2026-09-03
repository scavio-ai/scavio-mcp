import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Amazon moved to a new upstream provider and now returns a normalized shape
// instead of the old raw passthrough. Two consequences for these tool schemas:
//
// 1. Eleven params were removed because the current upstream has no equivalent:
//    sort_by, pages, category_id, merchant_id, language, currency, device,
//    zip_code, autoselect_variant, and the domain/start_page aliases. sort_by is
//    the one worth calling out - the marketplace accepts every sort value and
//    returns the identical unordered result set, so it was a filter that did
//    nothing. Leaving it in a tool schema would be worse than removing it: a
//    model reads the schema as a promise and would plan "get the cheapest" as a
//    single call. The API still accepts `domain` and `start_page` as deprecated
//    aliases; they are absent here because there is no reason to offer a model
//    two spellings of one param.
//
// 2. Locale is now a single `country` param carrying a TWO-LETTER country code
//    (us, gb, de), not an Amazon domain suffix (com, co.uk) and not a ZIP.
//
// The three data tools cost 1 credit each. get_amazon_options is a free lookup:
// it is the only Amazon path that is a GET, takes no params, needs no auth and
// is not billed.

// Kept in one place so search, product and offers cannot drift. `gb` is spelled
// out because `uk` is the mistake a model makes here, and an unknown code
// silently falls back to `us` rather than erroring, which would be invisible.
const COUNTRY_DESCRIPTION =
  "Country, e.g. 'us'. UK is 'gb'. Unknown codes silently fall back to us.";

const countryField = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .optional()
  .describe(COUNTRY_DESCRIPTION);

const asinField = z
  .string()
  .length(10)
  .describe("ASIN, e.g. 'B09V3KXJPB'.");

export function registerAmazonTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_amazon",
    `Search Amazon products. No sort option (always relevance). No category/price filter. 1 credit/page.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product query."),
      country: countryField,
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
    },
    call("/api/v1/amazon/search"),
  );

  server.tool(
    "get_amazon_product",
    `Full Amazon product page for an ASIN. Price is buy-box price; use get_amazon_offers for competing sellers. 1 credit.`,
    {
      asin: asinField,
      country: countryField,
    },
    call("/api/v1/amazon/product"),
  );

  server.tool(
    "get_amazon_offers",
    `All sellers for an Amazon ASIN with prices and conditions. First page only, no pagination. 1 credit.`,
    {
      asin: asinField,
      country: countryField,
    },
    call("/api/v1/amazon/offers"),
  );

  server.tool(
    "get_amazon_options",
    `List supported Amazon marketplaces and country codes. Free, no args.`,
    {},
    async () => {
      try {
        const data = await getClient().get("/api/v1/amazon/options");
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
