import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/sallybeauty.ts (Sally Beauty, sallybeauty.com and sallybeauty.ca, and its
// licensed-professional arm CosmoProf, cosmoprofbeauty.com and cosmoprofbeauty.ca, chosen by site; limits in
// the backend provider's SALLY_* constants). Rules the backend enforces and zod here does not: product, store stock and reviews
// take product_id or url; stores and store stock take postal_code or latitude + longitude; store stock and reviews
// refuse CosmoProf sites. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Sally Beauty (sallybeauty.com, the US and Canadian beauty supply chain) or CosmoProf (its professional beauty distributor), chosen by site";
const PRICES =
  "Sally Beauty prices in USD (sally-us) or CAD (sally-ca) as shown to a visitor who is not signed in; CosmoProf sells to licensed professionals, so its prices and stock are null.";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const QUICK = `${ONE} Usually 3 to 20 s; allow a client timeout of at least 180 s.`;
const ITEM =
  "position, product_id (what get_sallybeauty_product takes), master_product_id (CosmoProf), name, brand, category, url, image, price, list_price (the regular price when a lower price applies), price_min / price_max (a range across sizes), currency, on_sale, clearance, promotions, rating, review_count, variation_count, variation_type, sizes (CosmoProf), pickup_eligible, same_day_delivery_eligible (CosmoProf)";
const GRID = `Returns page, page_size, sort, total, total_pages, has_more, count, items [{${ITEM}}], facets [{name, attribute_id, values [{value, count, selected}]}] (send to filters), price_ranges [{label, min, max, count}] and filters_applied.`;

const site = z.enum(["sally-us", "sally-ca", "cosmoprof-us", "cosmoprof-ca"]).optional()
  .describe("sally-us (sallybeauty.com, USD, the default), sally-ca (sallybeauty.ca, CAD), cosmoprof-us (cosmoprofbeauty.com) or cosmoprof-ca (cosmoprofbeauty.ca). CosmoProf sells to licensed professionals: no prices or stock.");
const sallySite = z.enum(["sally-us", "sally-ca"]).optional()
  .describe("sally-us (default) or sally-ca. CosmoProf sites are refused here (not charged): CosmoProf shows store stock to signed-in professionals, and its product pages do not load reviews in time.");
const grid = {
  sort: z.enum(["best_match", "price_asc", "price_desc", "top_rated", "brand", "newest"]).optional()
    .describe("best_match (the default, the site's Top Sellers), price_asc, price_desc; top_rated on Sally Beauty; brand and newest on CosmoProf."),
  page: z.number().int().min(1).max(200).optional().describe("Results page, 1-based (24 products a page). total_pages reports the last one."),
  page_size: z.number().int().min(1).max(24).optional().describe("Products per page, 1-24 (default 24)."),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string()).max(20)])).optional()
    .describe("Facet filters, at most 6: {attribute_id: value or [values]}, exactly as facets[].attribute_id and facets[].values[].value list them, e.g. {\"ValueBrand\": \"ion\"} on Sally Beauty or {\"brandcustom\": \"Redken\"} on CosmoProf."),
  price_min: z.number().min(0).max(100000).optional().describe("Lowest price, in the site's currency (Sally Beauty sites)."),
  price_max: z.number().min(0).max(100000).optional().describe("Highest price (Sally Beauty sites)."),
};
const productRef = {
  product_id: z.string().min(2).max(41).optional()
    .describe("A product id as items[].product_id lists it, or a size's variations[].values[].sku, e.g. 'SBS-302313'. Send product_id or url."),
  url: z.string().max(500).optional().describe("Or a product link on the site (ending in /<product id>.html); it also sets site."),
};
const location = {
  postal_code: z.union([z.string().max(10), z.number().int()]).optional()
    .describe("A 5-digit ZIP code (US sites) or a Canadian postal code (Canadian sites), e.g. '75201'. Or send latitude + longitude."),
  latitude: z.number().min(-90).max(90).optional().describe("Latitude of the point to search around, with longitude."),
  longitude: z.number().min(-180).max(180).optional().describe("Longitude of the point to search around, with latitude."),
  radius: z.number().int().optional().describe("Miles: 15, 30, 50 or 100 (the site's own choices). Defaults to 15."),
};

export function registerSallyBeautyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/sallybeauty/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_sallybeauty",
    `Search ${SITE}, by keyword, 24 per page, sorted and filtered by any facet (brand, product type, benefits, color, rating, clearance) or a price range. ${GRID} When the site sends a keyword to one of its categories or straight to a product, redirected_to {type, category or product_id, url} says so. ${PRICES} Captured 2026-11-28: purple shampoo matched 107 products on sally-us; shampoo on cosmoprof-us opened the shampoo category, 589 products. ${QUICK}`,
    { site, query: z.string().min(1).max(200).describe("Search keywords, e.g. 'purple shampoo'."), ...grid },
    post("search"),
  );

  server.tool(
    "get_sallybeauty_category",
    `One category of ${SITE}, by category id, sorted and filtered like search_sallybeauty, with category_name. ${GRID} An unknown category id is a charged not-found. ${PRICES} Captured 2026-11-28: hair-color held 2,126 products; sorted price_asc the first was a hair color accelerator at 0.99 USD. ${QUICK}`,
    {
      site,
      category: z.string().min(1).max(81)
        .describe("A category id as the site's menu names it, e.g. 'hair-color', 'shampoo', 'nails-clearance' (Sally Beauty) or 'shampoo' (CosmoProf)."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_sallybeauty_clearance",
    `The clearance products of ${SITE}: Sally Beauty by department (hair_care, hair_color, nails, tools, beauty), CosmoProf in one list, sorted and filtered like search_sallybeauty. On clearance items price is the clearance price and list_price the regular price. ${GRID} ${PRICES} Captured 2026-11-28: the nails clearance on sally-us listed 219 products. ${QUICK}`,
    {
      site,
      department: z.enum(["hair_care", "hair_color", "nails", "tools", "beauty"]).optional()
        .describe("Sally Beauty sites: hair_care (the default), hair_color, nails, tools or beauty. CosmoProf has one clearance category: leave it out."),
      ...grid,
    },
    post("clearance"),
  );

  server.tool(
    "get_sallybeauty_product",
    `One product of ${SITE}, by product id or link. Sally Beauty: product_id, master_product_id, type (master, variant, standard), name, brand, short_description, url, breadcrumb, images, price, list_price, price_range {min, max} (a product with sizes), on_sale, clearance {is_clearance, original_price}, availability {in_stock, message, out_of_stock_label, online_units (the site's exact count of units it can sell online), in_stock_date}, min_order_quantity, max_order_quantity, unit, promotions [{id, name, callout, details, type}], manufacturer_sku, manufacturer_name, rating, review_count, variations [{attribute, values [{sku, label, selectable, selected}]}], specs [{group, name, values}], pickup_eligible, same_day_delivery_eligible, ship_to_home and no_ship_states. Send a size's sku for that size's price and units. CosmoProf: the catalogue facts (name, brand_url, upc, manufacturer, rating, variations with each size's sku and upc, ingredients, prop65_warning, badges) with price and availability null. An unknown product is a charged not-found. Captured 2026-11-28: SBS-302313, ion Color Defense Sulfate Free Shampoo 10.5 oz, 9.59 USD (regular 11.99), 77,098 units online. ${QUICK}`,
    { site, ...productRef },
    post("product"),
  );

  server.tool(
    "get_sallybeauty_stores",
    `The stores of ${SITE} near a ZIP / postal code or a point, within 15, 30, 50 or 100 miles, ordered by distance: center, radius_miles, count and stores [{store_id, name, address {line1, line2, city, state, postal_code, country}, latitude, longitude, distance_miles, phone, hours [{day, hours}], pickup_eligible, url}]. Captured 2026-11-28: 20 Sally Beauty stores within 15 miles of 75201, the nearest 2.2 miles away. ${QUICK}`,
    { site, ...location },
    post("stores"),
  );

  server.tool(
    "get_sallybeauty_store_stock",
    `In-store stock of one product at the Sally Beauty stores (sally-us, sally-ca) near a ZIP / postal code or a point: product {product_id, name, brand, url, price, currency, online_units}, center, radius_miles, count, in_stock_count and stores [{store_id, name, address, distance_miles, phone, hours, pickup_eligible, url, stock {units (the store's exact count), in_stock, status}}], ordered by distance. A product with sizes is stocked per size: send a size's sku (a product with sizes is an unbilled refusal listing them). CosmoProf sites are refused: their store stock is for signed-in professionals. Captured 2026-11-28: SBS-302313 near 90012 was in stock at 29 of 30 stores, 8 units at the nearest. ${QUICK}`,
    { site: sallySite, ...productRef, ...location },
    post("store-stock"),
  );

  server.tool(
    "get_sallybeauty_suggestions",
    `The search box suggestions of ${SITE} for what a shopper has typed: phrases, products [{product_id, name, brand, category, url, image, price, currency, rating, review_count, in_stock}], brands and popular_searches. Captured 2026-11-28: wahl suggested Wahl Clippers, Wahl and Wahl Trimmer. ${QUICK}`,
    { site, query: z.string().min(1).max(100).describe("What a shopper has typed so far, e.g. 'wahl'.") },
    post("suggestions"),
  );

  server.tool(
    "get_sallybeauty_brands",
    `The brand directory of ${SITE}: brands [{name, slug, url}] (about 370 on Sally Beauty, 140 on CosmoProf). List a brand's products with the filters of search_sallybeauty (ValueBrand on Sally Beauty, brandcustom on CosmoProf). Captured 2026-11-28: 371 brands on sally-us. ${QUICK}`,
    { site },
    post("brands"),
  );

  server.tool(
    "get_sallybeauty_reviews",
    `Customer reviews and questions of one Sally Beauty product (sally-us, sally-ca; CosmoProf sites are refused), page 1 as the product page shows it: average_rating, total_reviews, rating_distribution {1-5}, recommended {yes, no}, total, count, reviews [{review_id, rating, title, text, submitted_at, recommended, helpful_votes, unhelpful_votes, verified_purchaser, incentivized, syndicated, syndication_source, photos, secondary_ratings, brand_response}] (8), total_questions, total_answers and questions [{question_id, question, details, submitted_at, answer_count, answers [{answer_id, text, submitted_at, by_brand, best_answer, helpful_votes, unhelpful_votes}]}] (up to 10). No further pages. No reviewer or answerer names, locations or personal details. An unknown product is a charged not-found. Captured 2026-11-28: SBS-345331 averaged 3.97 from 113 reviews, with 10 questions. ${ONE} Usually 30 to 120 s; allow a client timeout of at least 240 s.`,
    { site: sallySite, ...productRef },
    post("reviews"),
  );
}
