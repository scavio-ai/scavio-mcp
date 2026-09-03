import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
// ApiError is imported here (and nowhere else in tools/) because get_tiktok_shop_product
// has to special-case a 404 before falling through to the shared handler.
import { ApiError } from "../lib/errors.js";
import { trimResponse } from "../lib/trim-response.js";

const REGIONS_FULL = ["US", "GB", "SG", "MY", "PH", "TH", "VN", "ID"] as const;
const REGIONS_LISTING = ["US", "GB"] as const;

export function registerTiktokShopTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_tiktok_shop",
    `Search TikTok Shop products (US only). Has exact prices. ~44% of IDs resolve on get_tiktok_shop_product. Paginate with next_cursor/has_more. 1 credit.`,
    {
      search: z.string().min(1).max(200)
        .describe("Product keyword, e.g. 'phone case'."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_search_suggestions",
    `TikTok Shop keyword autocomplete. 1 credit.`,
    {
      search: z.string().min(1).max(100)
        .describe("Partial keyword, e.g. 'wireless'."),
      region: z.enum(REGIONS_FULL).optional()
        .describe("Region: US (default), GB, SG, MY, PH, TH, VN, ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/search/suggestions", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_product",
    `Get TikTok Shop product detail (no price - use search/category/shop tools for prices). ~44% of search IDs resolve; 404 is normal, don't retry. 1 credit (billed even on 404).`,
    {
      product_id: z.string().regex(/^\d{6,25}$/)
        .describe("Product ID, e.g. '1732293553906094315'."),
      region: z.enum(REGIONS_FULL).optional()
        .describe("Region: US (default), GB, SG, MY, PH, TH, VN, ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/product", params);
        return trimResponse(data);
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
    `Get TikTok Shop product reviews. Works for most IDs even when get_tiktok_shop_product returns 404. Paginate with has_more. 1 credit.`,
    {
      product_id: z.string().regex(/^\d{6,25}$/)
        .describe("Product ID."),
      page: z.number().int().min(1).max(500).optional()
        .describe("1-based page number."),
      page_size: z.number().int().min(1).max(200).optional()
        .describe("Reviews per page (default 20)."),
      sort: z.enum(["relevant", "recent"]).optional()
        .describe("'relevant' (default) or 'recent'."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Filter by star rating."),
      has_media: z.boolean().optional()
        .describe("Only reviews with media."),
      verified_only: z.boolean().optional()
        .describe("Only verified purchases."),
      region: z.enum(REGIONS_FULL).optional()
        .describe("Region: US (default), GB, SG, MY, PH, TH, VN, ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/product/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_categories",
    `Get the TikTok Shop category tree. Use IDs with get_tiktok_shop_category_products. 1 credit.`,
    {},
    async () => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/categories", {});
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_category_products",
    `List TikTok Shop products by category with exact prices. Paginate with next_cursor/has_more. 1 credit.`,
    {
      category_id: z.string().regex(/^\d{4,20}$/)
        .describe("Category ID from get_tiktok_shop_categories."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
      region: z.enum(REGIONS_LISTING).optional()
        .describe("US (default) or GB only."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/category/products", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tiktok_shop_shop_products",
    `List a TikTok Shop seller's products with exact prices. Paginate with next_cursor/has_more. 1 credit.`,
    {
      shop_id: z.string().regex(/^\d{6,25}$/)
        .describe("Shop/seller ID."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
      region: z.enum(REGIONS_FULL).optional()
        .describe("Region: US (default), GB, SG, MY, PH, TH, VN, ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/shop/products", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "resolve_tiktok_shop_url",
    `Resolve a TikTok Shop URL or share link to product_id or shop_id. 1 credit.`,
    {
      url: z.string().url().max(2000)
        .describe("TikTok Shop URL or share link."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/tiktok-shop/resolve", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
