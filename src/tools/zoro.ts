import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/zoro.ts (Zoro, zoro.com, the US online industrial and business supply store, part
// of Grainger; United States, USD). Rules the backend enforces and zod here does not: category takes category or
// slug + code; product, availability and reviews take zoro_no or url. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const SITE =
  "Zoro (zoro.com, the US online industrial and business supply store, part of Grainger), United States only, English, prices in USD as zoro.com lists them to a visitor who is not signed in";
const BILL =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const QUICK = `${BILL} Usually 5 to 60 s; allow a client timeout of at least 180 s.`;
const SLOW = `${BILL} Usually 60 to 120 s, up to about 230 s when Zoro is slow; allow a client timeout of at least 240 s. A failed call is not charged and can be retried.`;
const PRICES =
  "unit_price is the price of one selling unit (price_unit EA each, PK pack, PR pair ...; package_qty pieces in it); order_multiple is the number of selling units Zoro sells the item in multiples of, order_multiple_price the price of one such multiple (order_multiple_price_source: page, as the product page gives it, or computed, unit_price x order_multiple).";
const ITEM =
  "position, zoro_no (what get_zoro_product takes), name, brand, mfr_no, url, image, categories [{code, name}], unit_price, price_unit, price_unit_name, package_qty, order_multiple, order_multiple_price, order_multiple_price_source (computed), was_price, currency, key_specs [{name, value}], variant_attributes, lead_time, drop_ship_direct, ltl_freight, freight_cost, restricted_states, commercial_shipping_restriction, discontinued, marked_out_of_stock";
const LIST = `total, page, page_size (36), total_pages, has_more, count, items [{${ITEM}}]. Zoro's filters are not returned (facets []).`;

const page = z.number().int().min(1).max(100).optional()
  .describe("Results page, 1-100 (36 products per page, as Zoro lists them). total_pages reports the last one.");
const productRef = {
  zoro_no: z.string().regex(/^[Gg]\d{4,12}$/).optional()
    .describe("The Zoro number (items[].zoro_no; the Zoro # on a product page, G followed by digits), e.g. 'G2426514'. Send zoro_no or url."),
  url: z.string().max(600).optional().describe("Or a zoro.com product link (.../i/<Zoro number>/)."),
};

export function registerZoroTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/zoro/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_zoro",
    `Search ${SITE} by keyword, part number or Zoro number, 36 per page in Zoro's order. Zoro sends some keywords to a category or brand page and some part numbers to a product page: redirected_to {type (category, brand, product, page), zoro_no, url, category {code, slug, name}, brand} says where, and the list is that page's (page 2+ pages it); a product redirect returns no items, ask get_zoro_product. Returns query, redirected_to, did_you_mean, ${LIST} ${PRICES} A keyword without products returns total 0. Search suggestions are not offered. Captured 2026-11-28: 3m n95 respirator matched 145 products, the first a 3M N95 respirator pack of 20 at 23.99 USD per pack. ${QUICK}`,
    {
      query: z.string().min(1).max(200).describe("Keywords, a part number or a Zoro number, e.g. '3m n95 respirator'."),
      page,
    },
    post("search"),
  );

  server.tool(
    "get_zoro_category",
    `One category of ${SITE} by category link, path or slug + code, 36 per page in Zoro's order. Returns category {code, slug, name, url}, ${LIST} ${PRICES} An unknown category is a charged not-found. Captured 2026-11-28: safety-glasses/c/6214 held 3,325 products. ${QUICK}`,
    {
      category: z.string().min(3).max(400).optional()
        .describe("A zoro.com category link or path, e.g. 'safety-glasses/c/6214' (redirected_to.url of a search works). Or send slug + code."),
      slug: z.string().min(1).max(200).optional().describe("The category's slug, with code, e.g. 'safety-glasses'."),
      code: z.string().min(1).max(12).optional().describe("The category's code (categories[].code of an item, e.g. '6214' or 'z1'), with slug."),
      page,
    },
    post("category"),
  );

  server.tool(
    "get_zoro_brand",
    `One brand's products on ${SITE} by brand name or brand link, 36 per page in Zoro's order. Returns brand, url, ${LIST} ${PRICES} A brand without products is a charged not-found. Captured 2026-11-28: Mcr Safety listed 2,901 products. ${QUICK}`,
    {
      brand: z.string().min(1).max(200)
        .describe("A brand as Zoro names it (items[].brand), e.g. '3M', 'Mcr Safety' or 'Zoro Select', or a zoro.com brand link (zoro.com/b/<brand>/)."),
      page,
    },
    post("brand"),
  );

  server.tool(
    "get_zoro_product",
    `One product of ${SITE} by Zoro number or link: requested_zoro_no, zoro_no, name, brand, mfr_no (manufacturer part number), upc, url, categories [{code, name, slug, url}], unit_price, price_unit, price_unit_name, package_qty, order_multiple, order_multiple_price (order_multiple_price_source page: as the product page gives it), was_price, currency, availability (in_stock, out_of_stock, ...), images, documents [{name, url}] (technical guides and other PDFs), specifications [{name, value}] (every attribute, with Country of Origin), variant_attributes and variants [{zoro_no, name, mfr_no, url, unit_price, price_unit, order_multiple, order_multiple_price, was_price, attributes, marked_out_of_stock}], lead_time, drop_ship_direct, ltl_freight, freight_cost, restricted_states (states Zoro does not ship the item to), commercial_shipping_restriction, discontinued, marked_out_of_stock, hazmat, expeditable. ${PRICES} An unknown Zoro number is a charged not-found. Captured 2026-11-28: G2426514, MCR Safety BearKat safety glasses, was 1.39 USD each, sold in multiples of 12 (16.68 USD). ${QUICK}`,
    productRef,
    post("product"),
  );

  server.tool(
    "get_zoro_availability",
    `The availability of one product of ${SITE} as its product page shows it: zoro_no, name, brand, mfr_no, url, status (e.g. In Stock), status_type, delivery_estimate (Zoro's delivery-time text), can_back_order, orderable, min_order_qty, inventory_units (Zoro does not show unit counts: always null), price {unit_price, price_unit, package_qty, order_multiple, order_multiple_price, currency}. An unknown Zoro number is a charged not-found. Captured 2026-11-28: G4152951, a 3M N95 respirator pack of 10, In Stock at 16.99 USD per pack, standard delivery 3-5 business days. ${SLOW}`,
    productRef,
    post("availability"),
  );

  server.tool(
    "get_zoro_reviews",
    `Customer reviews of one product of ${SITE}: the rating summary and the first 5 reviews the product page shows (newest first): zoro_no, name, average_rating, rating_count, review_count, recommended_ratio, rating_histogram {1-5}, properties [{name (Pros, Cons, Best Uses), values [{label, count}]}], answered_questions, page, page_size, total, total_pages, has_more, count, reviews [{review_id, rating, headline, comments, bottom_line, created_at, updated_at, verified_buyer, verified_reviewer, staff_reviewer, disclosure, helpful_votes, not_helpful_votes, media_count}]. Deeper pages are not offered. No reviewer names or locations. Captured 2026-11-28: G2426514 averaged 4.86 from 50 ratings and 45 reviews, 98% recommended. ${SLOW}`,
    productRef,
    post("reviews"),
  );
}
