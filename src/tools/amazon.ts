import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ScavioClient } from "../lib/client.js";
import { ApiError } from "../lib/errors.js";

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
// All three tools cost 1 credit.

// Kept in one place so search, product and offers cannot drift. `gb` is spelled
// out because `uk` is the mistake a model makes here, and an unknown code
// silently falls back to `us` rather than erroring, which would be invisible.
const COUNTRY_DESCRIPTION =
  "Marketplace country code, ISO 3166-1 alpha-2, lowercase. Defaults to us. Valid: us, ae, au, be, br, ca, cn, de, eg, es, fr, gb, in, it, jp, mx, nl, pl, sa, se, sg, tr. Note the UK is 'gb'. An unrecognised code falls back to us instead of failing, so a typo silently returns US results.";

const countryField = z
  .string()
  .regex(/^[A-Za-z]{2}$/)
  .optional()
  .describe(COUNTRY_DESCRIPTION);

const asinField = z
  .string()
  .length(10)
  .describe("Amazon ASIN - the 10-character product id, e.g. 'B09V3KXJPB'. Extract it from the product URL (/dp/ASIN).");

function handleApiError(err: unknown): never | { isError: true; content: { type: "text"; text: string }[] } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { isError: true, content: [{ type: "text", text: "Rate limited. Wait and retry." }] };
    if (err.status === 401) throw new McpError(ErrorCode.InternalError, "Invalid SCAVIO_API_KEY. Check your configuration.");
    return { isError: true, content: [{ type: "text", text: `Scavio API error (${err.status}): ${err.message}` }] };
  }
  throw new McpError(ErrorCode.InternalError, String(err));
}

export function registerAmazonTools(server: McpServer, getClient: () => ScavioClient) {
  const call = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(path, params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_amazon",
    `Search an Amazon marketplace and return the product grid as JSON: query, page, total_results, count, products, filters and related_searches. Each product has asin, title, url, image, price (number) with currency, rating, reviews_count, is_sponsored, position, badge, sales_volume and delivery { is_free, date, fastest_date }. Use it to find products, compare prices or collect ASINs to pass to get_amazon_product and get_amazon_offers.

There is NO sort option. The marketplace ignores every sort value and always returns its default relevance ranking, so results are unordered with respect to price, rating and date. To answer "the cheapest" or "the best rated", fetch the results and sort them yourself; do not expect the API to do it. There is also no category, merchant or price-range filter - filters[] carries the marketplace's own refinement URLs for reference only, and cannot be sent back as a param.

Two fields to read carefully: reviews_count is derived from Amazon's rounded display value, so anything above 1000 is approximate (a page showing "1.3K" returns 1300); position is Amazon's grid slot index including ad and carousel slots, so it starts above 1 and has gaps. Costs 1 credit per page.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product search query, e.g. 'wireless noise cancelling headphones'."),
      country: countryField,
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. One page per call, 1 credit each; there is no multi-page fetch."),
    },
    call("/api/v1/amazon/search"),
  );

  server.tool(
    "get_amazon_product",
    `Get the full product page for an Amazon ASIN as JSON: title, brand, url, description, features, price, list_price, currency, rating, reviews_count, is_prime, has_buy_box, availability (free text such as "In Stock"), max_quantity, sold_by, other_sellers_count, sales_volume, climate_pledge_friendly, image, images, videos, best_sellers_rank, categories, specifications, variants and shipping { is_prime, zipcode, options }. Use it when you have a specific ASIN or Amazon product URL and need details, pricing or specs.

Caveats worth knowing: price is the current buy-box price and other_sellers_count only counts the rest - call get_amazon_offers for the actual competing sellers and their prices. reviews[] carries review metadata only (id, author, date, verified_purchase); there is no review text and no per-review rating anywhere in the response. availability is marketplace- and language-specific free text, so match on the ASIN's own wording rather than parsing it for stock status. Costs 1 credit.`,
    {
      asin: asinField,
      country: countryField,
    },
    call("/api/v1/amazon/product"),
  );

  server.tool(
    "get_amazon_offers",
    `List every seller currently offering an Amazon ASIN, as JSON: asin, title, image, rating, reviews_count, note, count, total_offers, has_more_pages, page and offers. Each offer has condition (New, Used - Like New, ...), seller_id, seller_name, ships_from, is_fulfilled_by_amazon, is_buy_box_winner, is_prime, is_national_prime, price with currency, list_price, shipping_price, discount_percentage, discount_amount, quantity, delivery { min_hours, max_hours, date, is_free } and prime_delivery { date, order_deadline }. Use it to find the cheapest seller for a known ASIN, to check who holds the buy box, to compare new against used pricing, or to see whether a third-party seller undercuts Amazon.

This returns the first page of the offer list only - has_more_pages may be true, and there is no way to request the next page. An ASIN sold only by Amazon returns an empty offers list plus an explanatory note, which is a normal answer, not an error. Costs 1 credit.`,
    {
      asin: asinField,
      country: countryField,
    },
    call("/api/v1/amazon/offers"),
  );
}
