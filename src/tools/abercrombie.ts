import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/abercrombie.ts (Abercrombie & Fitch Co.: abercrombie.com and hollisterco.com, brand
// anf | hol, 16 storefronts). Rules the backend enforces and zod here does not: country on a storefront must be one of
// that storefront's ship-to countries (franchise-partner countries MX, SA, QA, ID and TW are refused); stores and store
// stock take zip (US only), or latitude and longitude together; stores takes no skus; reviews work on us, ca, uk, eu
// and eu_de only, and url must be a product link of the chosen brand. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const SITE =
  "Abercrombie & Fitch Co. (abercrombie.com: Abercrombie & Fitch, abercrombie kids, YPB; hollisterco.com: Hollister, Gilly Hicks), chosen with brand";
const ONE = "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICE =
  "price {text, current, original, was, discount_text, flag} as the storefront shows it, member_price {text, value, label} (the member price the site shows to every visitor, with the site's own label, e.g. Black Friday Price; null when none is shown)";
const WD =
  "On wd and wd_es, prices are the site's own conversion from USD into the ship-to country's currency (converted_currency true) and usd_price carries the same item in USD.";
const CARD = `product_id, collection_id (what get_abercrombie_product takes to save a lookup), name, department, gender, url, online_available, descriptors, badges, ${PRICE}, promo_message, image, colors [{name, product_id}]`;
const MARKET = "brand, brand_name, storefront, country, language";

const brand = z.enum(["anf", "hol"]).optional()
  .describe("anf (abercrombie.com: Abercrombie & Fitch, abercrombie kids, YPB; default) or hol (hollisterco.com: Hollister, Gilly Hicks).");
const storefront = z
  .enum(["us", "us_es", "ca", "ca_fr", "uk", "eu", "eu_de", "eu_fr", "eu_es", "eu_it", "eu_nl", "am", "am_zh", "am_ja", "wd", "wd_es"])
  .optional()
  .describe(
    "The storefront (default us): us (USD), us_es (US in Spanish), ca (CAD), ca_fr, uk (GBP), eu (English, EUR), eu_de, eu_fr, eu_es, eu_it, eu_nl, am (Hong Kong, HKD), am_zh (Hong Kong, Traditional Chinese), am_ja (Japan, JPY), wd (worldwide, prices converted from USD), wd_es (worldwide in Spanish).",
  );
const country = z.string().regex(/^[A-Za-z]{2}$/).optional()
  .describe("Ship-to country on the eu and eu_ storefronts and on wd / wd_es (two letters, e.g. DE, SE, AU, IL); it picks the currency on wd. Other storefronts ship to one country. Mexico, Saudi Arabia, Qatar, Indonesia and Taiwan are served by franchise partners' own sites and are refused.");
const market = { brand, storefront, country };
const sort = z.enum(["best_match", "newest", "price_asc", "price_desc", "rating", "best_selling"]).optional()
  .describe("best_match (default), newest, price_asc, price_desc, rating (customer ratings) or best_selling.");
const facets = z.array(z.string().min(3).max(120)).max(20).optional()
  .describe("Filters as <facet id>:<value>, taken from facets[].values[].filter in an answer, e.g. [\"gender:Men's\", \"colorFamily:Black\", \"sizes:M\"]. At most 20.");
const page = z.number().int().min(1).max(200).optional().describe("Page, from 1 (at most 200).");
const productId = z.string().regex(/^\d{5,12}$/)
  .describe("A product id (products[].product_id in search answers, colors[].product_id, or the number at the end of a product link), e.g. '59359439'.");
const storeCountry = z.string().regex(/^[A-Za-z]{2}$/).optional()
  .describe("Store country (default US): US, CA, GB, the eu countries (IE, AT, BE, BG, HR, CY, CZ, DK, EE, FI, FR, DE, GR, HU, IT, LV, LT, LU, MT, MC, NL, NO, PL, PT, RO, SK, SI, ES, SE, CH), JP, HK, MO, CN or AE.");
const place = {
  brand,
  country: storeCountry,
  zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
    .describe("A US ZIP code (US stores), e.g. '10001'. Send zip, or latitude and longitude (outside the US, latitude and longitude)."),
  latitude: z.number().min(-90).max(90).optional().describe("Latitude (with longitude), e.g. 40.7128."),
  longitude: z.number().min(-180).max(180).optional().describe("Longitude (with latitude), e.g. -74.006."),
  radius: z.number().int().min(1).max(250).optional().describe("Search radius, 1 to 250 (default 50)."),
  unit: z.enum(["mi", "km"]).optional().describe("mi (default in the US) or km (default elsewhere)."),
  limit: z.number().int().min(1).max(25).optional().describe("Stores, 1 to 25 (default 10), nearest first."),
};
const STORE =
  "store_number (what get_abercrombie_store takes), name, brand, brand_name, address {street, city, state, postal_code, country}, distance, distance_unit, phone, latitude, longitude, hours [{day, open, close, closed}] (this week as the store locator shows it, holiday hours included), messages";

export function registerAbercrombieTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/abercrombie/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_abercrombie",
    `${SITE} keyword search on one of 16 storefronts, 48 products a page with the site's 6 sorts and facet filters: ${MARKET}, query, sort, facets_applied, currency, converted_currency, page, page_size (48), total, total_pages, count, has_more, sort_options [{id, name}], facets [{id, name, values [{name, count, selected, filter}]}], products [${CARD}, usd_price on wd], notes. ${WD} Captured 2026-11-27: baggy jeans on the US Abercrombie & Fitch storefront gave 1219 results over 26 pages, the first the Baggy Jean at 90 USD with a 67.50 USD member price labeled Black Friday Price; hoodie on Hollister worldwide shipped to Australia gave 559 results in AUD (a graphic hoodie at AU$93.09, 59.95 USD). Usually 2 to 10 s. ${ONE}`,
    {
      ...market,
      query: z.string().min(1).max(100).describe("Keywords, e.g. 'baggy jeans'."),
      sort,
      facets,
      page,
    },
    post("search"),
  );

  server.tool(
    "get_abercrombie_product",
    `One ${SITE} product by product id, with every color and every size (and length) SKU: ${MARKET}, currency, converted_currency, product_id, collection_id, is_sold_out, size_headings {primary, secondary}, sizes {primary, secondary}, breadcrumbs [{name, category_id, url}], reviews_summary {average, count, distribution [{rating, count}], fit}, color_count, sku_count, colors [{product_id, name, color, color_family, department, gender, item_numbers {kic, store, web}, short_description, fabric, care, measurements, final_sale, max_purchase_qty, badges, ${PRICE}, url, images, sku_count, in_stock_skus, skus [{sku (what get_abercrombie_store_stock takes), size, size_primary, size_secondary, online_units (the exact units the site shows online), status (available or unavailable), preorder, price, member_price}]}], notes. No UPC or EAN is published. A sold-out or unpublished product answers is_sold_out true with no colors; an unknown product id is a charged not-found. ${WD} Captured 2026-11-27: product 59359439, the Baggy Jean, came in 15 colors and 480 SKUs at 90 USD (member price 67.50 USD, Black Friday Price), rated 4.8 from 3822 reviews, fit true to size; size 31 x 32 showed 3 units online. Usually 2 to 10 s. ${ONE}`,
    {
      ...market,
      product_id: productId,
      collection_id: z.string().regex(/^\d{3,12}$/).optional()
        .describe("The product's collection id (products[].collection_id in search answers), e.g. '607722'; saves a lookup."),
    },
    post("product"),
  );

  server.tool(
    "get_abercrombie_store_stock",
    `Store stock for 1 to 10 SKUs at the ${SITE} stores near a US ZIP code or a point, nearest first: brand, brand_name, country, zip, latitude, longitude, radius, unit, skus, total, count, stores [${STORE}, stock [{sku, units (the exact units the store shows), status (available, backorderable or unavailable), available_date, available_label}]], notes. Prices are national (online), not per store: get_abercrombie_product. Captured 2026-11-27: two Baggy Jean SKUs near ZIP 10001 were in stock at 10 Abercrombie & Fitch stores, the nearest Flatiron at 0.83 miles with 4 and 3 units; Soho held 9 of the first. Usually 2 to 10 s. ${ONE}`,
    {
      ...place,
      skus: z.array(z.string().regex(/^\d{6,12}$/)).min(1).max(10)
        .describe("1 to 10 SKUs (colors[].skus[].sku in product answers), e.g. ['662258406']."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_abercrombie_stores",
    `The ${SITE} stores near a US ZIP code or a point, nearest first (anf: Abercrombie & Fitch and abercrombie kids; hol: Hollister and Gilly Hicks): brand, brand_name, country, zip, latitude, longitude, radius, unit, total, count, stores [${STORE}], notes. Dated hours for one store: get_abercrombie_store. Captured 2026-11-27: ZIP 43215 had 3 Hollister stores within 50 miles, the nearest Easton Town Center at 7.71 miles. Usually 2 to 10 s. ${ONE}`,
    { ...place },
    post("stores"),
  );

  server.tool(
    "get_abercrombie_store",
    `One ${SITE} store by store number: country, store_number, brand, brand_name, name, address {street, city, state, postal_code, country}, phone, latitude, longitude, hours [{date, label, open, close, closed}] (the next 7 days as the store shows them, holiday hours included), notes. An unknown store is a charged not-found. Captured 2026-11-27: store 11958, Northpark Center in Dallas, TX, open 10am to 9pm on 2026-11-27. Usually 2 to 10 s. ${ONE}`,
    {
      brand,
      country: storeCountry,
      store_number: z.string().regex(/^\d{3,8}$/).describe("A store number (stores[].store_number), e.g. '11958'."),
    },
    post("store"),
  );

  server.tool(
    "get_abercrombie_category",
    `One ${SITE} category's products on one storefront, 1 to 90 a page with the site's 6 sorts and facet filters: ${MARKET}, category_id, name, title, breadcrumbs [{name, category_id}], sort, facets_applied, currency, converted_currency, page, page_size, total, total_pages, count, has_more, sort_options, facets, products [${CARD}, social_proof (the site's own message as given, e.g. 567 people purchased), usd_price on wd], notes. Category ids are per region: get_abercrombie_categories lists them for each storefront. Sale and Black Friday landing categories list no products (use a department's clearance category). An unknown category on the storefront is a charged not-found. ${WD} Captured 2026-11-27: category 12236 (Men's Jeans) on the US storefront held 86 products, 24 a page, the first the Relaxed Jean at 80 USD. Usually 2 to 10 s. ${ONE}`,
    {
      ...market,
      category_id: z.string().regex(/^\d{3,12}$/)
        .describe("A category id from get_abercrombie_categories (ids are per region), e.g. '12236'."),
      sort,
      facets,
      page,
      page_size: z.number().int().min(1).max(90).optional().describe("Products per page, 1 to 90 (default 90)."),
    },
    post("category"),
  );

  server.tool(
    "get_abercrombie_categories",
    `The category tree of one ${SITE} storefront: ${MARKET}, root_category_id, count, categories [{category_id (what get_abercrombie_category takes on this storefront), name, url, type (regular, clearance or featured), children [...]}], notes. Departments, then their categories, then sub-categories; type clearance marks each department's clearance category. Captured 2026-11-27: the Abercrombie & Fitch UK storefront listed 71 categories under New, Women's, Men's, Jeans, Gifts, Sale and About Us. Usually 2 to 10 s. ${ONE}`,
    { ...market },
    post("categories"),
  );

  server.tool(
    "get_abercrombie_promotions",
    `The banner offers one ${SITE} storefront shows now, in its own language: ${MARKET}, count, offers [{text, markers, valid_from, valid_to, terms}], terms [{marker, text, dates, valid_from, valid_to}] (the footnotes as given; dates read from the text where it states full dates), notes. Sale prices themselves show on products as price.discount_text and price.flag, member prices as member_price. Captured 2026-11-27: the US Abercrombie & Fitch storefront showed 2 offers, a Black Friday 25-50% off everything A&F valid 2026-11-23 to 2026-11-30 and free standard shipping on orders over 99 USD. Usually 2 to 10 s. ${ONE}`,
    { ...market },
    post("promotions"),
  );

  server.tool(
    "get_abercrombie_reviews",
    `The 8 newest reviews of one ${SITE} product as its product page shows them (us, ca, uk, eu and eu_de storefronts): ${MARKET}, product_id, sort (newest), total, count, summary {average, count, distribution, recommended_count, not_recommended_count, fit_average}, reviews [{id, rating, title, text, submitted_at, recommended, incentivized, syndicated, language, fit_rating, ratings, helpful_yes, helpful_no, brand_responses}], notes. No reviewer names. Deeper pages, other sorts and star filters are not offered; the same rating summary comes with get_abercrombie_product as reviews_summary. Captured 2026-11-27: the Baggy Jean had 3676 reviews averaging 4.81, 2602 recommending it, fit average 3.09. Takes 15 to 60 s: allow a client timeout of at least 120 s. 1 credit with url, 2 credits without it (one extra lookup); credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged.`,
    {
      ...market,
      product_id: productId,
      url: z.string().min(20).max(400).optional()
        .describe("The product link (url in search or product answers) on the chosen brand's site; saves a lookup and a credit."),
    },
    post("reviews"),
  );

  server.tool(
    "get_abercrombie_suggestions",
    `The search suggestions one ${SITE} storefront gives for a few letters: ${MARKET}, query, count, suggestions (terms). Captured 2026-11-27: hoo on the US Abercrombie & Fitch storefront gave 10 suggestions, from hoodie to sunday popover hoodie. Usually 1 to 5 s. ${ONE}`,
    {
      ...market,
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'hoo'."),
    },
    post("suggestions"),
  );
}
