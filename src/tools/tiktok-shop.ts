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

const REGIONS_FULL = ["US", "GB", "SG", "MY", "PH", "TH", "VN", "ID"] as const;
const REGIONS_LISTING = ["US", "GB"] as const;

export function registerTiktokShopTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_tiktok_shop",
    `Search TikTok Shop products by keyword as JSON (US catalog only). Returns up to 30 products per page, each with the product ID, title, product URL, image, exact price (current, original, discount, savings, min/max across variants), rating, sold count, variant count, brand and shop. This is one of the endpoints that carries exact prices; get_tiktok_shop_product does not. Use data.next_cursor as the next cursor while has_more is true, and dedupe by product_id across pages. Product IDs returned here are not guaranteed to resolve on get_tiktok_shop_product: only about 44% do, because upstream has no detail data for the rest. Treat search as a standalone source of product and price data, not as the first step of a reliable search-to-detail pipeline. Costs 1 credit.`,
    {
      search: z.string().min(1).max(200)
        .describe("Keyword to search the TikTok Shop catalog, e.g. 'phone case'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_search_suggestions",
    `Get TikTok Shop keyword autocomplete and expansion for a partial query as JSON, in any of 8 marketplace regions. Returns a plain list of suggestion strings (20 to 50). Suggestions are not guaranteed prefix matches: a misspelling returns typo corrections, and results can include brand and shop names. Costs 1 credit.`,
    {
      search: z.string().min(1).max(100)
        .describe("Partial keyword to expand, e.g. 'wireless'."),
      region: z.enum(REGIONS_FULL).optional()
        .describe("Marketplace region: US (default), GB, SG, MY, PH, TH, VN, or ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/search/suggestions", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_product",
    `Get full TikTok Shop product detail as JSON: title, plain-text description, images, variants with stock and dimensions, shipping, full shop profile (followers, shop rating, sold count), category path, breadcrumbs and top reviews. Two hard limits you must plan for. First, this endpoint does NOT return a price: TikTok masks prices on the product page upstream, so read exact prices from search_tiktok_shop, get_tiktok_shop_shop_products or get_tiktok_shop_category_products instead. Second, only about 44% of the product IDs returned by search_tiktok_shop resolve here (11 of 25 measured), because upstream has no detail data for the rest. That miss is identified by the HTTP 404 status, never by a field in the body. A 404 is a NORMAL outcome, not an error and not a transient failure: this tool returns it as a plain (non-error) result with status "no_detail_data", so do not retry it, do not treat it as a broken tool, and do not switch region hoping to recover it; skip that product and move on. Search to product is not a reliable pipeline. When you still need data about an unresolvable product, try get_tiktok_shop_product_reviews: in a measured sample of 8 IDs that this endpoint could not resolve, all 8 returned HTTP 200 on reviews and 7 of 8 returned at least one review. Costs 1 credit (a 404 is billed, since the lookup still ran).`,
    {
      product_id: z.string().regex(/^\d{6,25}$/)
        .describe("TikTok Shop product ID, e.g. '1732293553906094315'."),
      region: z.enum(REGIONS_FULL).optional()
        .describe("Marketplace region: US (default), GB, SG, MY, PH, TH, VN, or ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        // A 404 means upstream carries no detail data for this product id. It is the
        // expected outcome for roughly 56% of ids that search returns, so it must NOT be
        // surfaced as isError: clients read isError as a tool failure and retry, which is
        // exactly what this endpoint must not do. Genuine failures still go to handleApiError.
        if (err instanceof ApiError && err.status === 404) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                status: "no_detail_data",
                http_status: 404,
                product_id: params.product_id,
                region: params.region ?? "US",
                message: "No detail data exists upstream for this product id. This is a normal outcome for about 56% of ids returned by search_tiktok_shop, not a failure.",
                retryable: false,
                next_step: "Skip this product. Do not retry and do not change region. For an unresolvable id, get_tiktok_shop_product_reviews often still returns data; exact prices come from search_tiktok_shop, get_tiktok_shop_shop_products or get_tiktok_shop_category_products.",
              }, null, 2),
            }],
          };
        }
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_product_reviews",
    `Get paginated TikTok Shop product reviews as JSON, up to 200 per call. Each review includes the review ID, star rating, text, ISO timestamp, masked reviewer name, images, verified-purchase and incentivized flags, variant and country. Also returns the star distribution and total_reviews. total_reviews drifts between calls and must not be used to compute a page count: page with has_more instead. Reviews often work for products that get_tiktok_shop_product cannot resolve, which makes this a useful fallback detail source: in a measured sample of 8 product IDs that failed on get_tiktok_shop_product, 8 of 8 returned HTTP 200 here and 7 of 8 returned at least one review (counts 15, 0, 2, 20, 4, 6, 20, 11). That is a small sample, not a guarantee. Costs 1 credit.`,
    {
      product_id: z.string().regex(/^\d{6,25}$/)
        .describe("TikTok Shop product ID, e.g. '1732293553906094315'."),
      page: z.number().int().min(1).max(500).optional()
        .describe("1-based page number (default 1)."),
      page_size: z.number().int().min(1).max(200).optional()
        .describe("Reviews per page, 1-200 (default 20)."),
      sort: z.enum(["relevant", "recent"]).optional()
        .describe("'relevant' (default) returns text-complete, image-heavy reviews; 'recent' is fresher but far more text-sparse."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this star rating (1-5)."),
      has_media: z.boolean().optional()
        .describe("Only reviews with a photo or video (default false). Wins over verified_only if both are set."),
      verified_only: z.boolean().optional()
        .describe("Only verified purchases (default false)."),
      region: z.enum(REGIONS_FULL).optional()
        .describe("Marketplace region: US (default), GB, SG, MY, PH, TH, VN, or ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/product/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_categories",
    `Get the global TikTok Shop category tree as JSON: 28 top-level categories, 240 nodes, exactly two levels deep. Each node has a category ID, English name, slug, level, parent ID and image. Category IDs are identical in every region and names are always English. Takes no parameters. Use the returned IDs with get_tiktok_shop_category_products. Costs 1 credit.`,
    {},
    async () => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/categories", {});
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_category_products",
    `List TikTok Shop products under a category ID from get_tiktok_shop_categories as JSON, with exact prices (this is one of the endpoints that carries real prices, unlike get_tiktok_shop_product). Level 1 and level 2 category IDs both work. Page size is inconsistent upstream (15 to 20 per page), so always paginate with data.next_cursor rather than assuming a fixed page size. Category listings are shallow: after a few pages the source stops returning new products and has_more turns false, which is the end of the listing rather than an error. Costs 1 credit.`,
    {
      category_id: z.string().regex(/^\d{4,20}$/)
        .describe("Category ID from get_tiktok_shop_categories, e.g. '601450'. Level 1 or 2 both work."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
      region: z.enum(REGIONS_LISTING).optional()
        .describe("Marketplace region: US (default) or GB only. GB coverage is intermittent upstream and answers 502 when unavailable."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/category/products", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_shop_products",
    `List a TikTok Shop seller's product catalog as JSON, 30 per page, with exact prices (this is one of the endpoints that carries real prices, unlike get_tiktok_shop_product). Accepts a shop ID (also called seller ID elsewhere on TikTok). Use data.next_cursor as the next cursor while has_more is true. Shop follower count, location and shop-level rating are not available here; call get_tiktok_shop_product for the full shop profile. Costs 1 credit.`,
    {
      shop_id: z.string().regex(/^\d{6,25}$/)
        .describe("TikTok Shop seller ID, e.g. '7495514739648989419'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
      region: z.enum(REGIONS_FULL).optional()
        .describe("Marketplace region: US (default), GB, SG, MY, PH, TH, VN, or ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/shop/products", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "resolve_tiktok_shop_url",
    `Resolve any TikTok Shop URL or share link to a product_id or shop_id as JSON, ready to pass to the other TikTok Shop tools. Accepts shop.tiktok.com product and store pages, tiktok.com/view/product and /view/shop links, affiliate-*.tiktok.com share links, and vt.tiktok.com or tiktok.com/t short links. Returns the type ('product' or 'shop'), the ID, a canonical shop.tiktok.com URL, and how it was resolved. Note that a product_id resolved from a link is not guaranteed to resolve on get_tiktok_shop_product either; prices always come from the listing tools. Costs 1 credit.`,
    {
      url: z.string().url().max(2000)
        .describe("A TikTok Shop URL or share link, e.g. 'https://vt.tiktok.com/ZT2AHoGsE/'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/resolve", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
