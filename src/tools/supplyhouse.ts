import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/supplyhouse.ts (SupplyHouse.com, supplyhouse.com, the US online plumbing, HVAC and
// electrical supply store; one US storefront in USD, so the route's country input, which only accepts us, is left out).
// 1 credit per call on every tool. Rules the backend enforces and zod here does not: product, reviews and questions take
// product_id or url. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "SupplyHouse.com (supplyhouse.com, the US online plumbing, HVAC and electrical supply store), United States, prices in USD as supplyhouse.com shows them to a visitor who is not signed in";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW = "SupplyHouse pages are slow: usually 20 to 120 s, up to about 240 s; allow a client timeout of at least 250 s.";
const PRICES =
  "unit_price is the price of one piece (each); box_price the price of one box of box_quantity pieces; *_special_price a sale price when SupplyHouse shows one (discount_reason says why); price_tiers [{tier, quantity_break, price, special_price}] SupplyHouse's quantity-break prices as given; price_hidden true when SupplyHouse does not show the price on the page (no price returned).";
const ITEM =
  "position, product_id (SKU), name, brand, brand_path, url, image, unit_price, unit_special_price, box_price, box_special_price, box_quantity, price_tiers, discount_reason, price_hidden, currency, in_stock, inventory_status, total_available (SupplyHouse's Total Available), rating, reviews_count, questions_count, key_specs [{name, values}], discontinued, replacement_product_id, ships_by_freight, call_to_order";
const LIST = `page_type (search, products, subcategories, groups), breadcrumbs, total, page, page_size (48), total_pages, has_more, count, items [{${ITEM}}], subcategories [{id, name, path, url, image, product_count}] (a category page that lists subcategories), groups [{id, name, path, url, product_count, count, has_more, items}] (a category page that shows a few products per sub-type), facets [{name, values [{value, count, selected, category_path}]}] (SupplyHouse's filters with counts) and notes.`;

const page = z.number().int().min(1).max(100).optional().describe("Results page, 1-100 (48 products per page; default 1). total_pages reports the last one.");
const subPage = z.number().int().min(1).max(200).optional().describe("Page, 1-200 (10 per page, newest first; default 1). total_pages reports the last one.");
const productRef = {
  product_id: z.string().min(1).max(64).optional()
    .describe("The SupplyHouse SKU (items[].product_id; the part number on a product page), e.g. 'PXLE038' or '007-F5'. Send product_id or url."),
  url: z.string().max(600).optional().describe("Or a supplyhouse.com product link or path (items[].url)."),
};

export function registerSupplyHouseTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/supplyhouse/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_supplyhouse",
    `Search ${SITE}, by keyword, part number or SKU, 48 per page in SupplyHouse's order. SupplyHouse sends a keyword that names a category to that category page and an exact part number to its product page: redirected_to {type (category, brand, product), product_id, url, category} says where, and the answer is that page's (a product redirect returns that one product as items[0]). Returns query, redirected_to, did_you_mean, ${LIST} ${PRICES} A keyword without products returns total 0. Captured 2026-11-28: hot surface igniter matched 551 products, the first a universal silicon nitride igniter at 21.77 USD with 2,705 available. ${ONE} ${SLOW}`,
    {
      query: z.string().min(1).max(200).describe("Keywords, a part number or a SupplyHouse SKU, e.g. 'hot surface igniter'."),
      page,
    },
    post("search"),
  );

  server.tool(
    "get_supplyhouse_category",
    `One category page of ${SITE}, by link or path. A department or category page lists its subcategories (page_type subcategories); a category of sub-types shows a few products per sub-type (page_type groups); a product category lists its products, 48 per page (page_type products). SupplyHouse serves some category pages either way on the same day: page_type says which. Returns category {id, name, path, url, type}, ${LIST} ${PRICES} An unknown category is a charged 404. Captured 2026-11-28: PEX-Fittings-525000 listed 19 subcategories. ${ONE} ${SLOW}`,
    {
      category: z.string().min(1).max(400)
        .describe("A supplyhouse.com category link or path, e.g. 'PEX-Fittings-525000' (categories[].path of get_supplyhouse_categories, subcategories[].path, groups[].path or a breadcrumb path)."),
      page,
    },
    post("category"),
  );

  server.tool(
    "get_supplyhouse_brand",
    `One brand's products on ${SITE}, by brand path or link, 48 per page in SupplyHouse's order. Returns brand {id, name, path, url}, ${LIST} ${PRICES} An unknown brand is a charged 404. Captured 2026-11-28: PVI listed 20 products. ${ONE} ${SLOW}`,
    {
      brand: z.string().min(1).max(200)
        .describe("A brand as its supplyhouse.com path names it (items[].brand_path), e.g. 'Taco', 'PVI', 'Bluefin', or a brand link."),
      page,
    },
    post("brand"),
  );

  server.tool(
    "get_supplyhouse_product",
    `One product of ${SITE}, by SKU or link: requested, product_id (SKU), name, brand, brand_path, model_number, url, breadcrumbs, unit_price, unit_special_price, box_price, box_special_price, box_quantity, price_tiers, discount_reason, price_hidden, currency, in_stock, inventory_status, total_available, lead_times [{quantity, promise_date, date_from, date_to, message, sources [{source_id, quantity, is_warehouse}]}] (how many ship by when, from which warehouse), out_of_stock_lead_time, temporarily_unavailable, call_to_order, limit_order_quantity, discontinued, discontinuation_reason, sales_discontinuation_date, replacement_product_id, replacement_type, replacement_product, out_of_stock_substitute, variants, alternatives, accessories and replacement_parts [{product_id, name, brand, url, image, unit_price, unit_special_price, price_hidden}], specifications [{name, values}], key_specs, images, videos, documents [{name, file_name, url}] (spec sheets, install instructions, warranty PDFs), shipping {width, height, depth, weight, freight_class, ships_by_freight}, returnable, contains_lead, california_prop65, rating, reviews_count, questions_count and notes. ${PRICES} Delivery dates for a ZIP code are not returned. An unknown SKU is a charged 404. Captured 2026-11-28: PXLE038, a 3/8 in. poly PEX crimp elbow, 0.62 USD each or 27.50 USD a box of 50, 1,919 available, shipping from 4 warehouses. ${ONE} ${SLOW}`,
    productRef,
    post("product"),
  );

  server.tool(
    "get_supplyhouse_reviews",
    `Customer reviews of one product of ${SITE}, by SKU or link, 10 per page, newest first: product_id, name, brand, url, average_rating, rating_count, recommended_ratio, rating_histogram {1-5}, sort, page, page_size, total, total_pages, has_more, count, reviews [{review_id, rating, headline, comments, created_at, verified_buyer, helpful_votes, not_helpful_votes, photos, merchant_response, merchant_response_date}] and notes. No reviewer names or locations. An unknown SKU is a charged 404. Captured 2026-11-28: PXLE038 averaged 4.47 over 17 ratings. ${ONE} ${SLOW}`,
    { ...productRef, page: subPage },
    post("reviews"),
  );

  server.tool(
    "get_supplyhouse_questions",
    `Customer questions and answers of one product of ${SITE}, by SKU or link, 10 per page, newest first: product_id, name, brand, url, sort, page, page_size, total, total_pages, has_more, count, questions [{question_id, question, created_at, answer_count, answers [{answer_id, answer, created_at, is_expert (SupplyHouse staff), verified_buyer, helpful_votes, not_helpful_votes}]}] and notes. No asker or answerer names or locations. An unknown SKU is a charged 404. Captured 2026-11-28: the Taco 007-F5 circulator had 77 questions. ${ONE} ${SLOW}`,
    { ...productRef, page: subPage },
    post("questions"),
  );

  server.tool(
    "get_supplyhouse_categories",
    `The top-level departments of ${SITE}, as the site menu lists them: country, currency, count, total_nodes, categories [{id, name, menu_name, path, url, image, documents, children}] and notes. Send a path to get_supplyhouse_category for a department's subcategories and products. Captured 2026-11-28: 8 departments, from Plumbing Supplies to Electrical Supplies. ${ONE} Usually 5 to 30 s; allow a client timeout of at least 180 s.`,
    {},
    post("categories"),
  );
}
