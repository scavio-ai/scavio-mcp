import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// No zod `.default()` anywhere in this file, on purpose. The MCP SDK applies a
// zod default BEFORE the handler runs, so a defaulted field is posted on every
// single call whether the model set it or not — which is exactly how the
// shipped Walmart tool ended up sending a value the backend enum rejected.
// Upstream defaults are documented in the .describe() text instead and left for
// the backend to apply.

export function registerEbayTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_ebay",
    `Search live or SOLD eBay listings and return them as JSON. Each result carries the item id and URL, title, price and currency, condition, buying format, bid count and time left for auctions, shipping cost and free-shipping flag, seller username with feedback score, image and position, alongside count and total_results.

Set sold=true to search COMPLETED listings that actually sold. That is the price-research view and the reason to reach for eBay rather than a retail catalogue: it shows what buyers really paid, not what sellers are asking. On the sold view eBay publishes no headline count, so total_results is NULL — count still tells you how many rows came back.

Either query or seller is required. Passing seller ALONE with no keyword pages that seller's entire catalogue, and this is the only way to enumerate a seller's inventory — get_ebay_seller is a profile card and cannot list items.

Paginate with page. per_page accepts ONLY 60, 120 or 240; eBay silently falls back to 60 for any other value rather than erroring. category_id must be numeric — an unrecognised id returns the UNFILTERED result set under a 200, so verify the filter took effect. condition 'refurbished' is eBay's parent condition, not one of its three graded tiers. Costs 1 credit per page.`,
    {
      query: z.string().min(1).max(500).optional()
        .describe("Keyword search, e.g. 'nikon d750 body'. Either this or seller is required; omit it and pass seller alone to page a seller's whole catalogue."),
      seller: z.string().min(1).max(64).optional()
        .describe("Scope results to one eBay seller username. Usable with NO query to page that seller's entire inventory. Either this or query is required."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. One page per call, 1 credit each."),
      sort_by: z.enum(["best_match", "ending_soonest", "newly_listed", "price_low", "price_high"]).optional()
        .describe("Sort order. Upstream default is 'best_match'. 'Distance: nearest first' is deliberately unavailable — it would rank against our proxy exit, not your location."),
      min_price: z.number().min(0).optional()
        .describe("Minimum price filter, in the listing currency."),
      max_price: z.number().min(0).optional()
        .describe("Maximum price filter, in the listing currency."),
      condition: z.enum(["new", "open_box", "refurbished", "used", "for_parts"]).optional()
        .describe("Item condition filter. 'refurbished' is eBay's PARENT condition and covers all three graded refurbished tiers; it does not select one of them."),
      buying_format: z.enum(["auction", "buy_it_now", "best_offer"]).optional()
        .describe("Listing format filter: timed auction, fixed price, or accepts-best-offer."),
      free_shipping: z.boolean().optional()
        .describe("Restrict to listings with free shipping."),
      sold: z.boolean().optional()
        .describe("Search COMPLETED listings that sold, instead of live inventory — the price-research view. On this view total_results is NULL because eBay publishes no headline count for it."),
      category_id: z.string().optional()
        .describe("eBay numeric category id (the _sacat value in a browse URL). MUST be numeric — an unrecognised id returns the UNFILTERED set under a 200 rather than an error."),
      per_page: z.union([z.literal(60), z.literal(120), z.literal(240)]).optional()
        .describe("Results per page. ONLY 60, 120 or 240 are accepted; eBay silently downgrades anything else to 60. Upstream default is 60."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/ebay/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_ebay_product",
    `Get one eBay listing in full as JSON: item id and URL, title, price and currency, condition, item specifics (the seller's own spec table), every image, shipping and handling options, the return policy, auction state (bid count, time left, buy-it-now availability, quantity sold and available), and the seller with feedback score and positive-feedback percentage.

Accepts an eBay item number or a full ebay.com/itm/... URL — tracking query params are discarded for you. This is a single-listing lookup with no pagination. Costs 1 credit.`,
    {
      item_id: z.string().min(1)
        .describe("eBay item number, e.g. '335678901234', or a full ebay.com/itm/... URL. Tracking params are stripped."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/ebay/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_ebay_seller",
    `Get an eBay seller's profile card as JSON: store name and username, feedback score, positive-feedback percentage, items sold, follower count, location, member-since date and the categories they sell in.

PROFILE ONLY — this endpoint CANNOT enumerate a catalogue and returns no listings. To read what a seller currently has for sale, call search_ebay with seller set and no query; that path is paginated. Accepts the username exactly as it appears in ebay.com/usr/<name>. No pagination. Costs 1 credit.`,
    {
      seller: z.string().min(1).max(64)
        .describe("eBay seller username as it appears in ebay.com/usr/<name>, e.g. 'musicmagpie'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/ebay/seller", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
