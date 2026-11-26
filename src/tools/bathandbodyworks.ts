import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/bathandbodyworks.ts (bathandbodyworks.com,
// US, USD; country ca reads bathandbodyworks.ca in English, CAD). Cross-field
// rules the backend enforces and zod here does not: product, promotions,
// store availability and reviews summary take product_id or url; a link's site
// sets country (a different country is refused). No zod `.default()`: the MCP
// SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_low", "price_high", "top_rated", "new_arrivals"] as const;

const CARD = "id (for get_bathandbodyworks_product; every size is its own id), name, brand, product_type, form, size, currency, price, list_price, promotional_price (where the site states one), promotions (id, callout, promotional_price), rating, review_count, badge, fragrance_name, fragrance_family, online_orderable, in_store_pickup, member_exclusive, launch_date, image, url_path and us_product_id (ca: the matching US product id)";
const LISTING = `Returns total (the site's own count), count (at most 48: the site shows 48 results and has no page 2, so narrow with sort and filters), has_more, selected_filters, products (${CARD}) and facets (filter, label, values with value and count; any value works in the matching filter)`;
const SLOW = "Usually 10-40 s: allow a client timeout of at least 90 s.";
const CREDITS = "Failed calls and refused inputs are not charged; a not-found is charged. 1 credit.";

const values = (d: string) =>
  z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).max(10)]).optional().describe(d);

const country = () =>
  z.string().max(20).optional()
    .describe("us (default): bathandbodyworks.com in USD; ca: bathandbodyworks.ca in English, CAD. Spanish and French pages are not offered (the site serves the same English data there).");
const productId = () =>
  z.string().regex(/^\d{9}$/).optional()
    .describe("A Bath & Body Works product id (9 digits: products[].id), e.g. '028029548'. Every size is its own id.");
const productUrl = () =>
  z.string().min(20).max(500).optional()
    .describe("Or the bathandbodyworks.com / bathandbodyworks.ca product link (the link's site sets country). Alternative to product_id.");
const storeId = () =>
  z.string().min(1).max(12)
    .describe("A Bath & Body Works store id (BBW + 5 digits: get_bathandbodyworks_stores stores[].store_id), e.g. 'BBW00010'.");

const listing = {
  country: country(),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price_low, price_high, top_rated or new_arrivals: the site's own sorts."),
  fragrance_name: values("Products of these fragrances, as the site names them (facets fragrance_name, e.g. 'Champagne Toast'). One value or a list."),
  fragrance_family: values("Products of these fragrance families: Warm & Woodsy, Treats & Sweets, Fruity & Bright, Fresh & Clean, Botanicals & Blooms (facets fragrance_family). One value or a list."),
  product_type: values("Products of these product types, as the site names them (facets product_type, e.g. '3-Wick Candle', 'Body Lotion'). One value or a list."),
};

export function registerBathandbodyworksTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/bathandbodyworks/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  const productTarget = { product_id: productId(), url: productUrl(), country: country() };

  server.tool(
    "search_bathandbodyworks",
    `Keyword search on Bath & Body Works (bathandbodyworks.com, the US body care and home fragrance retailer; country ca for bathandbodyworks.ca in English, CAD): a product, a fragrance or a collection, sorted by relevance, price, top rated or new arrivals and filtered by fragrance name, fragrance family and product type. ${LISTING}. Also country, currency, query, sort, filters, redirect_path (where the site sends a search instead of listing results) and notes. A search with no results answers count 0. ${CREDITS}`,
    {
      query: z.string().min(1).max(120)
        .describe("A keyword: a product, a fragrance or a collection, e.g. 'candle'."),
      ...listing,
    },
    post("search"),
  );

  server.tool(
    "get_bathandbodyworks_category",
    `The products of one Bath & Body Works category page by path (get_bathandbodyworks_categories categories[].path: /c/..., /g/..., /t/..., including deal pages such as /g/top-offers and /t/black-friday) or its link, with the same sorts and filters as search_bathandbodyworks. ${LISTING}. Also path, category (id, name, page_title, description, breadcrumbs), country, currency, sort and filters. An unknown path is a charged not-found. ${CREDITS}`,
    {
      path: z.string().min(2).max(300)
        .describe("A category path from get_bathandbodyworks_categories (categories[].path), e.g. '/c/all-candles/3-wick-candles', '/g/top-offers', '/t/black-friday', or its link."),
      ...listing,
    },
    post("category"),
  );

  server.tool(
    "get_bathandbodyworks_categories",
    `The Bath & Body Works category tree as the site's navigation menu lists it: country, count, categories (id, name, path: the input of get_bathandbodyworks_category, null for a menu group; children) and notes. ${CREDITS}`,
    { country: country() },
    post("categories"),
  );

  server.tool(
    "get_bathandbodyworks_product",
    `One Bath & Body Works product in full by id or link: id, name, brand, product_type, form, size, currency, price, list_price, promotional_price, promotions (id, callout, promotional_price), rating, review_count, badge, fragrance_name, fragrance_family, fragrance_classification, fragrance_description, fragrance_notes (top, heart, base), description, short_description, highlights, ingredients, UPC, member_exclusive, launch_date, collection, online (orderable, purchase_limit, low_stock), in_store_pickup, images, breadcrumbs, url_path and us_product_id (ca). Every size is its own product id. The site publishes no stock counts. Promotion dates and terms: get_bathandbodyworks_promotions. An unknown id is a charged not-found. ${CREDITS}`,
    productTarget,
    post("product"),
  );

  server.tool(
    "get_bathandbodyworks_promotions",
    `The promotions attached to one Bath & Body Works product with their start and end times (ISO, UTC) and terms as given: country, product_id, name, currency, price, count, promotions (id, name, callout, promotional_price, start_date, end_date, terms) and notes. ${SLOW} An unknown id is a charged not-found. ${CREDITS}`,
    productTarget,
    post("promotions"),
  );

  server.tool(
    "get_bathandbodyworks_offers",
    `The current Bath & Body Works offers: the home page's offer cards and the Top Offers tiles. Returns country, currency, count, promotions (id, placement: banner, menu or home; title, headline, form_headline, details, urgency, romance_copy, percent_off, percent_off_copy, price_point (dollars, cents), promo_code, promo_code_instructions, validity as given, terms, link_path, published_at), top_offers_count, top_offers (id, label, offer, applies_to, detail, urgency, link_path) and notes. ${CREDITS}`,
    { country: country() },
    post("offers"),
  );

  server.tool(
    "get_bathandbodyworks_store_availability",
    `Whether one Bath & Body Works store takes a pickup order for one product: country, product_id, store_id, store (name, city, state), name, size, currency, price (national: the same at every store), store_orderable, pickup_purchase_limit (the most the store lets you reserve for pickup, 0-24; a purchase limit, not a count of what the store holds: the site publishes none), online_orderable, online_purchase_limit, low_stock (the site's own flag) and notes. ${SLOW} An unknown product id or store id is a charged not-found. ${CREDITS}`,
    { product_id: productId(), url: productUrl(), store_id: storeId(), country: country() },
    post("store-availability"),
  );

  server.tool(
    "get_bathandbodyworks_store",
    `One Bath & Body Works store's public page by store id: country, store_id, name, address (line1, city, state, postal_code, country), phone, latitude, longitude, hours (day, hours), services, store_types (BBW, BBWO outlet, WBC White Barn), url_path, nearby_stores (where the page lists them) and notes. An unknown store id is a charged not-found. ${CREDITS}`,
    { store_id: storeId(), country: country() },
    post("store"),
  );

  server.tool(
    "get_bathandbodyworks_stores",
    `Every store id in the Bath & Body Works store directory of one market (about 1,800 US, 114 Canada): country, count, stores (store_id, url_path) and notes. The directory lists store ids only (get_bathandbodyworks_store reads a store's address and hours); there is no search by ZIP or city. ${CREDITS}`,
    { country: country() },
    post("stores"),
  );

  server.tool(
    "get_bathandbodyworks_reviews_summary",
    `One Bath & Body Works product's rating, review count and up to 4 newest reviews: country, product_id, rating, review_count, best_rating, count, reviews (id, rating, title, text, date_created, date_published, verified_purchaser) and notes. No reviewer name is returned; full review paging is not offered. A product without a review summary answers rating null and no reviews. ${CREDITS}`,
    productTarget,
    post("reviews-summary"),
  );
}
