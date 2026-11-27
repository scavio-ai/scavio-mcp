import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/llbean.ts (L.L.Bean: llbean.com, llbean.ca and global.llbean.com). Rules the
// backend enforces and zod here does not: country is required with market intl and refused otherwise; filters hold at
// most 8 keys; min_discount is one of 20, 30, 40, 50, 60, 70 and is not sent together with filters.discount;
// store-stock takes store_ids or all_stores (one of them, not both); stores takes exactly one of zip, latitude +
// longitude, city + state, store_ids or all_stores. No zod `.default()`: the MCP SDK would post a defaulted field on
// every call.

const SITE = "L.L.Bean (llbean.com, the US outdoor apparel and gear retailer)";
const ONE = "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW = "Usually 2 to 15 s; allow a client timeout of at least 120 s.";
const PRICES =
  "Prices are as L.L.Bean shows them to a visitor who is not signed in; member and card prices (L.L.Bean Rewards, L.L.Bean Mastercard) are never returned. Prices are national: the same in every store and online.";
const US_ITEM =
  "position, product_id, name, url, image, item_id (for get_llbean_store_stock and get_llbean_delivery_estimate), price (current lowest), full_price, full_price_max, sale_price and sale_price_max (set when below the full price), on_sale, rating, review_count, stock (in_stock or backorder), stock_text (a backorder date as given), new_arrival, features, colors";
const SF_ITEM =
  "position, product_id, name, url, image, price, price_max (when a range), list_price (the was price, when higher), currency, price_text, on_sale, promotion (the storefront's offer text as given), rating, review_count, colors";
const GRID = `market, country, currency, page, page_size (48), total, total_pages, has_more, count, items (us: [{${US_ITEM}}]; ca and intl: [{${SF_ITEM}}]), facets [{key, label, values [{value, count}]}] (send to filters), filters_applied, notes. ${PRICES}`;

const COUNTRIES = ["gb", "de", "fr", "nl", "au", "mx", "ch", "se", "cn", "br", "in", "sg"] as const;
const scope = {
  market: z.enum(["us", "ca", "intl"]).optional()
    .describe("us (www.llbean.com, USD; the default), ca (www.llbean.ca, CAD, English) or intl (global.llbean.com, the country's own currency; needs country)."),
  country: z.enum(COUNTRIES).optional()
    .describe("With market intl only: gb (GBP), de, fr, nl (EUR), au (AUD), mx (MXN), ch (CHF), se (SEK), cn (CNY), br (BRL), in (INR) or sg (SGD)."),
};
const usOnly = {
  market: z.literal("us").optional()
    .describe("us (the default); this tool serves the US storefront (www.llbean.com, USD) only."),
};
const id = z.union([z.string().min(1).max(14), z.number().int().min(1)]);
const zip = z.union([z.string().regex(/^\d{5}(-\d{4})?$/), z.number().int().min(0).max(99999)]);
const storeIds = z.array(z.union([z.string(), z.number()])).max(20);
const grid = {
  page: z.number().int().min(1).max(200).optional()
    .describe("Results page, 1-based, 48 per page (up to 200). total_pages reports the last one."),
  sort: z.enum(["relevance", "price_asc", "price_desc", "best_selling", "newest", "top_rated"]).optional()
    .describe("relevance (default), price_asc, price_desc, best_selling, newest or top_rated."),
  filters: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()).max(10)]))
    .optional()
    .describe("Facet filters, at most 8 keys: {key: value or [values]} (values of one key are OR-ed). Keys: color, size, brand, gender, and on us also sale, price, discount, width, department, category, material, shoe_size, features, new; or any facets[].key of an answer with values exactly as facets[].values[].value, e.g. {\"price\": \"0 TO 30\"} on us, {\"color\": \"Black\"} on ca and intl."),
};

export function registerLlbeanTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/llbean/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_llbean",
    `${SITE} keyword search on the US, Canadian or international storefront, sorted (relevance, price, best selling, newest, top rated), 48 a page, filtered by any facet: query, redirected_to (a keyword the site sends to a category, e.g. boots, comes back with the category id and the sort, page and filters applied), ${GRID} Captured 2026-11-27: fleece jacket gave 24 results on us, the first Kids' Mountain Classic Fleece Anorak at 59.95 USD; 73 results on ca and on intl gb, the first Men's Fleece-Lined Flannel Shirt at 159 CAD and 110 GBP. ${SLOW} ${ONE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'fleece jacket'."),
      ...scope,
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_llbean_category",
    `One ${SITE} category by id on the US, Canadian or international storefront, sorted and filtered like search: category_id, url, sort, ${GRID} An unknown category is a charged not-found. Captured 2026-11-27: category 474 (US Footwear) sorted price_asc counted 439 products, the first at 12.95 USD. ${SLOW} ${ONE}`,
    {
      category_id: id
        .describe("A category id: categories[].category_id from get_llbean_categories (US) or the number after /llb/shop/ in a storefront category link, e.g. '474' (US Footwear). 32 is Sale on every storefront (see get_llbean_deals)."),
      ...scope,
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_llbean_categories",
    `The department menu of ${SITE}, US storefront: category_id, count, categories [{category_id, name, slug, url, children}] (11 departments, about 570 nodes), notes; or one department or category with its children when category_id is sent. Captured 2026-11-27: category 474 (Footwear) held 50 nodes. ${SLOW} ${ONE}`,
    {
      ...usOnly,
      category_id: id.optional()
        .describe("Optional: return this one department or category with its children, e.g. '474'."),
    },
    post("categories"),
  );

  server.tool(
    "get_llbean_product",
    `One ${SITE} product by id. On us: product_id, name, url, rating, review_count, specs [{component, specs}], materials, size_fit, items [{item_id, name (Regular, Tall, a size range), colors [{color, price, full_price, sale_price, percent_saved, sold_out}], sku_count}], sku_count, in_stock_count, backorder_count, out_of_stock_count, skus [{sku, item_id, item, color, size, width, stock (in_stock, backorder, out_of_stock), status (as given: In Stock, Limited Quantities, Sold Out or a backorder date), backorder_date, price, full_price, sale_price, percent_saved}]. On ca and intl: product_id, name, brand, url, image, currency, price, list_price, price_text, availability, promotions (offer text as given), colors [{id, name, selectable, price, price_text}], items [{id, name, selectable}] and attributes (sizes, widths) for the variant shown; no unit counts, store stock, reviews or delivery dates there. ${PRICES} An unknown product is a charged not-found. Captured 2026-11-27: the Boat and Tote, Zip-Top was rated 4.8 from 9735 reviews, with 4 items and 97 SKUs (41 in stock, 32 on backorder, 24 sold out) from 34.99 to 69.95 USD; the Men's L.L.Bean Sweater Fleece Full-Zip Jacket was 145 EUR on the international storefront for Germany. ${SLOW} ${ONE}`,
    {
      product_id: id
        .describe("The product id (items[].product_id; the number after /llb/shop/ in a product link), e.g. '37037'."),
      ...scope,
    },
    post("product"),
  );

  server.tool(
    "get_llbean_store_stock",
    `Exact store units of one ${SITE} item (one fit or size range of a product), US stores, for up to 20 stores or every store: item_id, product_id, store_ids, sku_count, store_count, stores [{store_id, units, skus_in_stock}], skus [{sku, status, units, stores [{store_id, units, status}]}], unlisted_sku_count, notes. units is the site's exact available quantity per SKU per store; a store that does not carry a SKU is not listed for it. With product_id each SKU also carries item, color, size, width and its national price, and SKUs the product page no longer offers are left out. An unknown item is a charged not-found. Captured 2026-11-27: item 112644 (Boat and Tote Medium) held 506 units at store 0040, 32 at 1350 and 74 at 2140. ${SLOW} ${ONE}`,
    {
      ...usOnly,
      item_id: id
        .describe("An item id: items[].item_id of get_llbean_product (not the product id), e.g. '112644'."),
      product_id: id.optional()
        .describe("Optional, the item's product id: labels each SKU with its color, size and price (same 1 credit)."),
      store_ids: storeIds.optional()
        .describe("Up to 20 store ids (stores[].store_id of get_llbean_stores), e.g. ['0040', '1350']. Send store_ids or all_stores."),
      all_stores: z.boolean().optional()
        .describe("true: every L.L.Bean store, instead of store_ids."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_llbean_stores",
    `The ${SITE} stores, US: near a ZIP code, a point (with radius) or a city and state, by store ids, or all of them: location, count, stores [{store_id, name, shopping_center, type (Retail, Outlet), address {line1, line2, city, state, postal_code}, phone, latitude, longitude, distance_miles, time_zone, opened, open, inventory_online, store_pickup, curbside_pickup, url, hours [{date, day, open, close}] (7 dated days, local store time)}], notes. Ordered by distance when a place is given. Captured 2026-11-27: ZIP 04032 gave 5 stores, the nearest the Freeport Outlet Store at 0.13 miles. ${SLOW} ${ONE}`,
    {
      ...usOnly,
      zip: zip.optional()
        .describe("A US ZIP code, e.g. '04032': stores ordered by distance. Send one of zip, latitude + longitude, city + state, store_ids or all_stores."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude (with longitude)."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude (with latitude)."),
      radius: z.number().int().min(1).max(500).optional()
        .describe("Miles around latitude + longitude, 1 to 500. Defaults to 100."),
      city: z.string().min(1).max(60).optional()
        .describe("A US city (with state), e.g. 'Denver'."),
      state: z.string().regex(/^[A-Za-z]{2}$/).optional()
        .describe("2-letter state code (with city), e.g. 'CO'."),
      store_ids: storeIds.optional()
        .describe("Store ids, e.g. ['0040']."),
      all_stores: z.boolean().optional()
        .describe("true: every L.L.Bean store."),
      limit: z.number().int().min(1).max(75).optional()
        .describe("Stores to return, 1 to 75. Defaults to 10 near a place."),
    },
    post("stores"),
  );

  server.tool(
    "get_llbean_reviews",
    `Written reviews of one ${SITE} product, US storefront, in 4 sorts, up to 100 a page, filtered by stars, reviewer height or weight band, or words: product_id, sort, filters_applied, page, page_size, total, total_pages, has_more, count, reviews [{review_id, rating, title, text, submitted_at, recommended, verified_purchaser, syndicated, helpful_votes, unhelpful_votes, item_id, fit [{label, value, value_label}], size_purchased, size_range, height, weight, used_for, brand_responses}], stats {average_rating, total_reviews, ratings_only_count, recommended_count, not_recommended_count, rating_distribution, fit (fit slider averages), context (size purchased, height and weight histograms)}, upcs [{item_id, upcs}], notes. No reviewer names, nicknames, locations or ids: a title that carries the reviewer's name is left out (null). Captured 2026-11-27: the Men's L.L.Bean Sweater Fleece Full-Zip Jacket had 1400 written reviews (4402 ratings, average 4.67), a fit average of 3.07 between Too Small and Too Large. ${SLOW} ${ONE}`,
    {
      ...usOnly,
      product_id: id
        .describe("The product id, e.g. '120785'."),
      sort: z.enum(["newest", "helpful", "rating_desc", "rating_asc"]).optional()
        .describe("newest (default), helpful, rating_desc or rating_asc."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based."),
      limit: z.number().int().min(1).max(100).optional()
        .describe("Reviews per page, 1 to 100. Defaults to 20."),
      filters: z
        .object({
          rating: z.number().int().min(1).max(5).optional()
            .describe("Star rating 1 to 5."),
          height: z.string().max(30).optional()
            .describe("Reviewer height band, a value from stats.context (Height), e.g. '5ft10in'."),
          weight: z.string().max(30).optional()
            .describe("Reviewer weight band, a value from stats.context (Weight), e.g. '170180Lbs'."),
          text: z.string().max(100).optional()
            .describe("Words in the review, e.g. 'warm'."),
        })
        .strict()
        .optional()
        .describe("Optional review filters: rating, height, weight, text."),
    },
    post("reviews"),
  );

  server.tool(
    "get_llbean_review_summary",
    `L.L.Bean's own summary of the reviews of one ${SITE} product, US storefront, as the site gives it: product_id, summary, disclaimer, created_at, notes. A product without one is a charged not-found. ${SLOW} ${ONE}`,
    {
      ...usOnly,
      product_id: id
        .describe("The product id, e.g. '37037'."),
    },
    post("review-summary"),
  );

  server.tool(
    "get_llbean_delivery_estimate",
    `The standard delivery date of one ${SITE} item to a US ZIP code, US storefront: item_id, zip, standard_delivery_date (as given, no year in the text), notes. An invalid ZIP is an unbilled refusal; an unknown item a charged not-found. Captured 2026-11-27: item 112644 to ZIP 10001 was Sat, November 28. ${SLOW} ${ONE}`,
    {
      ...usOnly,
      item_id: id
        .describe("An item id (items[].item_id of get_llbean_product), e.g. '112644'."),
      zip: zip
        .describe("A US ZIP code, e.g. '10001'."),
    },
    post("delivery-estimate"),
  );

  server.tool(
    "get_llbean_suggestions",
    `The search-box suggestions of ${SITE} for a partial query: query, count, suggestions, popular_searches, products [{product_id, name}], categories [{category_id, name, parent}], notes. On us: up to 10 keyword suggestions. On ca: the storefront's suggested terms, its popular searches, products (use with get_llbean_product, market ca) and categories. Captured 2026-11-27: fle gave 10 suggestions on us, from fleece to fleece lined. ${SLOW} ${ONE}`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'fle'."),
      market: z.enum(["us", "ca"]).optional()
        .describe("us (default) or ca."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_llbean_deals",
    `The Sale category of ${SITE} on the US, Canadian or international storefront, sorted and filtered like search; on us also by % Off (min_discount): category_id (32), url, min_discount, sort, ${GRID} The site gives no end dates for sale items. Captured 2026-11-27: Sale at 40% and up on us counted 204 products, the first at 19.99 USD against a full price of 34.95. ${SLOW} ${ONE}`,
    {
      ...scope,
      ...grid,
      min_discount: z.number().int().optional()
        .describe("On us: the Sale page's % Off filter, one of 20, 30, 40, 50, 60, 70 (N% and up)."),
    },
    post("deals"),
  );
}
