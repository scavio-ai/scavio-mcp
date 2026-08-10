import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

/**
 * Walmart marketplace. This is the price-bearing parameter: com and ca bill 1
 * credit, com.mx bills 2. Only search and category accept it — walmart.ca
 * product pages cannot be fetched, so the id-keyed endpoints are US-only.
 *
 * Never given a zod default: the MCP SDK applies defaults BEFORE the handler
 * runs, so a default is posted on every call whether the caller meant it or not.
 */
const domainField = z.enum(["com", "ca", "com.mx"]).optional()
  .describe("Walmart marketplace: 'com' (US, default, 1 credit), 'ca' (Canada, 1 credit), 'com.mx' (Mexico, 2 credits). Prices and product URLs come back in that marketplace's currency and domain. Omit for US.");

/**
 * The backend enum is CLOSED to today|tomorrow. '2_days' leaks items 3-4 days
 * out and 'anytime' is a no-op, so both were retired upstream — and a zod
 * default here would post the retired value on every call and 400 the request.
 * There is deliberately no default.
 */
const fulfillmentSpeedField = z.enum(["today", "tomorrow"]).optional()
  .describe("Only items deliverable today, or by tomorrow. For 'anytime', omit this parameter entirely — there is no 'anytime' value.");

const sortByField = z.enum(["best_match", "price_low", "price_high", "best_seller", "rating_high", "new"]).optional()
  .describe("Result sort order. Defaults to 'best_match' when omitted.");

export function registerWalmartTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_walmart",
    `Search Walmart.com and return structured product rows as JSON. Returns data.products, each with id (usItemId), title, url, image, price, currency, rating, rating_count, brand, seller_name, seller_catalog_id, sponsored, out_of_stock, availability_status, fulfillment and variants — plus products_count, page, max_page, has_more_pages, total_results (Walmart's own headline count, larger than what is returned), location, breadcrumb and related_searches. Page through results with the page parameter while data.has_more_pages is true. Costs 1 credit on walmart.com (default) and walmart.ca, and 2 credits on walmart.com.mx — the domain parameter sets the price. Results are always returned against Walmart's default store: delivery ZIP, store id and device emulation are not supported, and the store actually used is reported in data.location.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product search query, e.g. 'air fryer 6 quart'."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. Defaults to page 1."),
      sort_by: sortByField,
      min_price: z.number().optional()
        .describe("Minimum price filter, in the marketplace's currency."),
      max_price: z.number().optional()
        .describe("Maximum price filter, in the marketplace's currency."),
      fulfillment_speed: fulfillmentSpeedField,
      fulfillment_type: z.enum(["in_store"]).optional()
        .describe("Set to 'in_store' to return only items available for in-store pickup. Omit for all items."),
      domain: domainField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_product",
    `Get the full detail page for one Walmart product as JSON. Returns id/sku, title, url, image and images, price, price_strikethrough, currency, rating, rating_count, brand, model, gtin, product_type, short_description, long_description, specifications, variants, availability_status, out_of_stock, fulfillment, category_path, offer_count, location, and the seller (seller_name, seller_id as a GUID, and seller_catalog_id — the NUMERIC id that get_walmart_seller and get_walmart_seller_products require). Does NOT include review text (call get_walmart_reviews) or the seller offer list (call get_walmart_offers). Not paginated. walmart.com (US) only — there is no domain parameter, because walmart.ca product pages cannot be fetched. Costs 1 credit.`,
    {
      product_id: z.string().min(1)
        .describe("Walmart item id (usItemId) — the numeric string at the end of a product URL /ip/<name>/<PRODUCT_ID>, e.g. '13544111159'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_reviews",
    `Get customer reviews for a Walmart product as JSON. Returns data.reviews (review_id, rating, title, text, author, author_location, submitted_at, verified_purchase, helpful_count, unhelpful_count, photos), plus average_rating, total_review_count, reviews_with_text_count, recommended_percentage, rating_breakdown (the 1-5 star histogram), and top_positive_review / top_negative_review. Returns 10 reviews per page — page through with the page parameter, using total_review_count to know how many pages exist. Costs 1 credit per page.`,
    {
      product_id: z.string().min(1)
        .describe("Walmart item id (usItemId), e.g. '13544111159'."),
      page: z.number().int().min(1).optional()
        .describe("Reviews page, 1-based. 10 reviews per page. Defaults to page 1."),
      sort: z.enum(["relevancy", "submission-desc", "submission-asc", "rating-desc", "rating-asc", "helpful-desc"]).optional()
        .describe("Review sort order: 'relevancy', 'submission-desc' (newest first), 'submission-asc' (oldest), 'rating-desc' (highest rated), 'rating-asc' (lowest rated), 'helpful-desc' (most helpful)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_category",
    `Browse the products inside a Walmart category as JSON, without a search query. Returns exactly the same shape as search_walmart: data.products (id, title, url, image, price, rating, brand, seller_catalog_id, sponsored, fulfillment, variants), products_count, page, max_page, has_more_pages, location and breadcrumb. Page through with the page parameter while data.has_more_pages is true. The limit parameter trims the returned list after Walmart has been fetched — it does NOT reduce the cost of the call. Costs 1 credit on walmart.com (default) and walmart.ca, and 2 credits on walmart.com.mx — the domain parameter sets the price.`,
    {
      category_id: z.string().min(1)
        .describe("Walmart category id: either a leaf id ('1095191') or the full underscore-joined path ('3944_133251_1095191'). Both are accepted. Category ids appear in the breadcrumb and category_path fields of search and product responses."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. Defaults to page 1."),
      limit: z.number().int().min(1).optional()
        .describe("Trim the returned products to at most this many. Applied after fetching — it does not reduce the credit cost."),
      sort_by: sortByField,
      min_price: z.number().optional()
        .describe("Minimum price filter, in the marketplace's currency."),
      max_price: z.number().optional()
        .describe("Maximum price filter, in the marketplace's currency."),
      fulfillment_speed: fulfillmentSpeedField,
      domain: domainField,
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/category", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_offers",
    `Get the BUY-BOX offer for a Walmart product as JSON — which seller currently wins the listing, at what price. Returns product_id, title, url, count, total_offer_count (Walmart's own tally of purchasable offers, which is usually larger) and data.offers, each with offer_id, seller_name, seller_id, seller_catalog_id, seller_rating, seller_review_count, price, list_price, currency, condition, availability_status, shipping_price, fulfillment, wfs and is_buy_box_winner. This is NOT the full competing-offer list: Walmart server-renders only the buy-box winner, so expect one offer even when total_offer_count is higher. Not paginated. Costs 1 credit.`,
    {
      product_id: z.string().min(1)
        .describe("Walmart item id (usItemId), e.g. '2979510112'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/offers", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_seller",
    `Get a Walmart marketplace seller's storefront as JSON. Returns seller_id (numeric) and seller_guid, name, display_name, about, logo_url, url, seller_type (EXTERNAL is a marketplace seller, INTERNAL is Walmart itself), is_marketplace_seller, has_pro_seller_badge, is_active, is_alcohol_seller, rating, review_count, reviews_with_text_count, rating_breakdown and a sample of reviews. Business contact fields (email, phone, address) come back only for sellers whose details Walmart publishes; they are null for every seller Walmart marks as exempt. IMPORTANT: seller_id must be the NUMERIC catalog seller id, which is the seller_catalog_id field on a product, search or offers response — passing the GUID seller_id from those same responses returns 404. Not paginated. Costs 1 credit.`,
    {
      seller_id: z.string().min(1)
        .describe("Numeric Walmart catalog seller id, e.g. '101480084'. Take it from the seller_catalog_id field of a product, search or offers response. The GUID-form seller_id is NOT accepted here — it 404s."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/seller", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_walmart_seller_products",
    `List the products a Walmart marketplace seller sells, as JSON. Returns seller_id, seller_name, seller_display_name, count, products_count, total_count and data.products in the same shape as search_walmart (id, title, url, image, price, rating, brand, fulfillment, variants). HARD CAP: Walmart server-renders only roughly the FIRST 40 items and paginates the rest client-side, so this returns about 40 products no matter how large the catalog is, and there is no page or cursor parameter. Read total_count to see the seller's real catalog size and to know you are looking at a slice. IMPORTANT: seller_id must be the NUMERIC catalog seller id (the seller_catalog_id field on a product, search or offers response); the GUID form 404s. Costs 1 credit.`,
    {
      seller_id: z.string().min(1)
        .describe("Numeric Walmart catalog seller id, e.g. '101480084', from the seller_catalog_id field of a product, search or offers response. The GUID-form seller_id 404s."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/walmart/seller-products", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
