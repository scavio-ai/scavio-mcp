import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// Every description opens "Target.com, the US retailer" on purpose: read out of
// context, a tool called get_target_* is easily taken for "the target of the
// operation". The brand has to be established in the first clause, before the
// model has decided what the tool is for.
//
// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Upstream defaults are documented in the describe
// text and left for the backend to apply.

const SORT_DESCRIPTION =
  "Sort order. Upstream default is 'relevance'.";

const storeIdField = z.string().optional()
  .describe("Numeric Target store id. Unlike Walmart, this IS a real request param — it selects the store whose prices, promotions and availability you get back. Upstream default is '3991'.");

export function registerTargetTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_target_products",
    `Target.com, the US retailer — search its catalogue by keyword and return the product grid as JSON. Each row carries the tcin (Target's product id), title, brand, URL, current price and list price, rating and review count, badges and promotions, image, and seller_id / seller_name.

seller_id and seller_name are NULL for first-party stock, which is most of Target. NULL means "sold by Target", not missing data — only Target Plus marketplace rows name a third-party vendor.

Paginate with page. count sets the page size and is capped at 28: Target rejects anything above that outright (upstream default 24). store_id picks the store whose prices and availability you see.

LATENCY, not price, is the thing to plan around: Target refuses proxy pools and is reached through a headless browser, so a search takes roughly 9 seconds and can hold a concurrency slot much longer under retry. Do not put it in a tight loop. Costs 1 credit per page.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Product search keyword, e.g. 'office chair'."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. One page per call, 1 credit each."),
      count: z.number().int().min(1).max(28).optional()
        .describe("Products per page, 1-28. Target rejects anything above 28 outright. Upstream default is 24."),
      sort: z.enum(["relevance", "featured", "price_low", "price_high", "rating_high", "best_seller", "newest"]).optional()
        .describe(SORT_DESCRIPTION),
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/target/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_target_category",
    `Target.com, the US retailer — list the products inside one Target category as JSON. Same shape as search_target_products plus the category breadcrumb: tcin, title, brand, URL, price and list price, rating and review count, badges and promotions, image, and seller_id / seller_name.

seller_id and seller_name are NULL for first-party stock, which is most of Target — NULL means "sold by Target", not missing data.

category_id is the segment after \`N-\` in a target.com /c/ URL. Paginate with page; count is capped at 28 (upstream default 24). store_id picks the store whose prices and availability you see.

This is the SLOWEST Target endpoint at roughly 37 seconds per call, with 502-then-retry cases observed near 100 seconds. Use it for catalogue sweeps you can wait on, not for interactive lookups. Costs 1 credit per page.`,
    {
      category_id: z.string().min(1)
        .describe("Target category id — the segment after `N-` in a target.com /c/ URL, e.g. '5xtg6' from /c/office-chairs/-/N-5xtg6."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. One page per call, 1 credit each."),
      count: z.number().int().min(1).max(28).optional()
        .describe("Products per page, 1-28. Target rejects anything above 28 outright. Upstream default is 24."),
      sort: z.enum(["relevance", "featured", "price_low", "price_high", "rating_high", "best_seller", "newest"]).optional()
        .describe(SORT_DESCRIPTION),
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/target/category", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_target_product",
    `Target.com, the US retailer — get one product's full detail by TCIN as JSON: title, brand, current price and list price, rating and review count, images, the specification table and feature bullets, variants, the return policy, and fulfillment for the chosen store (ship, order pickup, drive up, same-day delivery).

Pass a child TCIN and Target answers with its variation PARENT, with the child present in variants — that is the normal response, not a wrong match.

seller_id / seller_name are NULL for first-party stock, which is most of Target; NULL means "sold by Target". Unlike Walmart, store_id IS a real request param here — prices and availability are your choice.

Fastest Target endpoint at roughly 4 seconds. Single-product lookup, no pagination. For review bodies call get_target_reviews. Costs 1 credit.`,
    {
      tcin: z.string().min(1)
        .describe("Target TCIN, the numeric product id from a target.com /p/ URL, e.g. '54551690'. A child TCIN is answered by its variation parent, with the child listed under variants."),
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/target/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_target_reviews",
    `Target.com, the US retailer — get a product's reviews by TCIN as JSON: the overall rating with its star distribution, per-attribute averages (quality, value, and so on), the recommendation percentage, guest photos, and the review bodies with author, date, rating, title and text.

HARD CAP: 8 REVIEW BODIES MAXIMUM, no matter how large review_count is. Target publishes no more than that anonymously. There is NO page and NO offset param — \`limit\` only TRIMS the 8 you would already receive, it cannot fetch more. If you need a deep review corpus, this endpoint cannot supply it and no amount of extra calls will change that.

Roughly 40 seconds per call. Costs 1 credit.`,
    {
      tcin: z.string().min(1)
        .describe("Target TCIN, the numeric product id from a target.com /p/ URL, e.g. '54551690'."),
      limit: z.number().int().min(1).optional()
        .describe("TRIMS the returned review bodies only. The ceiling is 8 regardless — Target publishes 8 anonymously and offers no paging, so a limit above 8 changes nothing."),
      store_id: storeIdField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/target/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
