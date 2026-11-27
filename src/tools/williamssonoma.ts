import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/williamssonoma.ts (Williams-Sonoma, Inc. brands, US in USD; Canada in CAD on
// product). Rules the backend enforces and zod here does not: product-style tools take product or url (not both),
// brand is required unless a product link gives it (and must agree with the link), stores and floor samples take zip
// or latitude + longitude (not both). Each tool's brand list is the set the backend serves on that endpoint; anything
// else answers 400 before anything is charged. No zod `.default()`: the MCP SDK would post a defaulted field on every
// call.

const ALL_BRANDS = [
  "williams_sonoma", "pottery_barn", "pottery_barn_kids", "pottery_barn_teen", "west_elm", "rejuvenation", "mark_and_graham",
] as const;
const STORE_BRANDS = ["williams_sonoma", "pottery_barn", "pottery_barn_kids", "pottery_barn_teen", "west_elm", "rejuvenation"] as const;

const SITE =
  "the Williams-Sonoma, Inc. brands (Williams Sonoma, Pottery Barn, Pottery Barn Kids, Pottery Barn Teen, West Elm, Rejuvenation, Mark and Graham)";
const WHERE = "Every answer carries brand, brand_name, market, currency, language and host, plus notes.";
const NATIONAL = "Prices are the brand's online prices in the market's currency, the same at every ZIP code and store.";
const ONE =
  "1 credit (credits_used is what was charged). A not-found is charged; failed upstream calls and refused inputs are not. Usually 1 to 20 s (product pages up to 50 s): allow a client timeout of at least 150 s.";
const FIVE =
  "5 credits (credits_used is what was charged). A not-found is charged; failed upstream calls and refused inputs are not. Usually 15 to 60 s: allow a client timeout of at least 150 s.";
const REVIEW_COST =
  "1 credit (credits_used is what was charged). A not-found is charged; failed upstream calls and refused inputs are not. Usually 25 to 60 s: allow a client timeout of at least 150 s.";
const LISTING =
  "page (1), page_size, total, count, items [position, product_id (what get_williamssonoma_product takes), name, url, leader_sku, image, price_min, price_max, regular_price_min, regular_price_max, sale_price_min, sale_price_max, price_type (regular, limited_time_offer or set_savings), max_discount_percent, flags, more_swatches], facets [{name, label, type, options [{value, label, count}], min / max on a price range}], sort_options, related_searches. Page 1 (20 products) as the site lists it, prices as numbers in the market's currency";

const usOnly = z.enum(["us"]).optional()
  .describe("us (the default). Canada is not served on this tool.");
const productId = z.string().min(2).max(150);
const productUrl = z.string().min(10).max(800);
const sku = z.string().regex(/^\d{3,10}$/);
const skuList = z.array(sku).min(1).max(20);
const zip = z.string().regex(/^\d{5}(-\d{4})?$/);
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const radius = z.number().int().min(1).max(200);

const productTarget = (example: string) => ({
  product: productId.optional()
    .describe(`The product id: the part after /products/ in a product link (items[].product_id from search or category), e.g. '${example}'.`),
  url: productUrl.optional()
    .describe("Or a product link on the brand site (brand and market are read from it; an explicit brand must agree). Send product or url."),
});

export function registerWilliamssonomaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/williamssonoma/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_williamssonoma_product",
    `One product of ${SITE}, by brand + product id or a product link, us or ca (Williams Sonoma, Pottery Barn and West Elm in Canada, in CAD): requested_product_id, product_id, name, url, page_type (simple, complex, configured, guided), available, category_id, breadcrumbs, price {min, max, regular_min, regular_max, discount_type (sale or special)}, on_sale, rating and review_count (Williams Sonoma; the other brands show no ratings, so both are null), flags, messages (promotion messages valid today, as given), dimensions [{section, lines}] (the dimension lines as given), materials, configurator_base_skus (made-to-order pieces: what get_williamssonoma_configurator takes), sku_count, skus_returned and skus [sku, name, options (size, color, ...), price, regular_price, on_sale, discount_type, personalization_price, surcharge, stock (on_hand, back_ordered or not_available), back_ordered_date, ship_mode, delivery_services (standard, rush, white_glove, doorstep, room_of_choice), white_glove, pickup_services, furniture, direct_ship, special_order, materials, width_in, height_in, depth_in] (up to 500, in the page's order). No UPC. ${NATIONAL} ${WHERE} Captured 2026-11-27: the Williams Sonoma W\u00dcSTHOF Classic Chef's Knife had 19 SKUs from 99 to 200 USD (regular 135 to 200), rated 4.81 from 564 reviews; the Pottery Barn Gabrielle Bergere Sofa (63") was 2319 USD (regular 2899), a configured page with one configurator base SKU; a West Elm rug on westelm.ca ran 524 to 1274 CAD over 11 SKUs. An unknown product is a charged not-found. ${ONE}`,
    {
      brand: z.enum(ALL_BRANDS).optional()
        .describe("The brand: williams_sonoma, pottery_barn, pottery_barn_kids, pottery_barn_teen, west_elm, rejuvenation or mark_and_graham. Required unless url is given. ca serves williams_sonoma, pottery_barn and west_elm."),
      market: z.enum(["us", "ca"]).optional()
        .describe("us (the default, USD) or ca (the brand's Canadian site, English, CAD; Williams Sonoma, Pottery Barn and West Elm)."),
      ...productTarget("gabrielle-upholstered-sofa"),
    },
    post("product"),
  );

  server.tool(
    "get_williamssonoma_configurator",
    `The fabric configurator of a made-to-order Pottery Barn piece (US), from ${SITE}: by base SKU (get_williamssonoma_product configurator_base_skus), product id or product link: requested_base_sku, product_id, base_sku, name, price {min, max, regular_min, regular_max, discount_percent_max, discount_type, currency} (the range across fabrics and options; the exact price per fabric is set in the cart), production_lead_time {min, max} as given, dimensions_in {width, depth, height}, fabric_count and fabrics [id, name, color, fabric, features, content (fiber content), rub_count, price_tier (the brand's fabric price tier letter)]. ${NATIONAL} ${WHERE} Captured 2026-11-27: the Gabrielle Sofa (base SKU 4889446) offered 50 fabrics from 1999 to 2899 USD, up to 20% off, with a production lead time of 27 to 51 as given. A product with no configurator is a charged not-found. ${ONE}`,
    {
      brand: z.enum(["pottery_barn"]).optional()
        .describe("pottery_barn (the brand served on this tool). Required unless url is given."),
      market: usOnly,
      base_sku: sku.optional()
        .describe("A configurator base SKU (get_williamssonoma_product configurator_base_skus), e.g. '4889446'. Send base_sku, product or url."),
      ...productTarget("gabrielle-upholstered-sofa"),
    },
    post("configurator"),
  );

  server.tool(
    "get_williamssonoma_delivery_estimate",
    `Standard-delivery dates to a US ZIP code for every SKU of one product, or for up to 20 SKUs, of ${SITE} (US): zip, product_id, requested_skus, count and skus [sku, ship_mode, availability (in_stock_ready_to_ship, special_order, coming_soon, ...), special_order, service_level, earliest_date, latest_date, min_days, max_days, message, holiday {name, order_cutoff, delivery_dates} when the brand publishes a holiday order cutoff]. Dates are the brand's own estimate (YYYY-MM-DD), as given. ${WHERE} Captured 2026-11-27: the Pottery Barn Gabrielle sofa to ZIP 94103 was a special order, delivered 2027-02-26 to 2027-03-12 (92 to 106 days). ${ONE}`,
    {
      brand: z.enum(ALL_BRANDS).optional()
        .describe("The brand (any of the 7). Required unless url is given."),
      market: usOnly,
      zip: zip.describe("The US ZIP code to deliver to, e.g. '94103'."),
      ...productTarget("gabrielle-upholstered-sofa"),
      skus: skuList.optional()
        .describe("Or up to 20 SKU ids (get_williamssonoma_product skus[].sku), e.g. ['1468824']. Send product, url or skus."),
    },
    post("delivery-estimate"),
  );

  server.tool(
    "get_williamssonoma_stock",
    `Online stock ranges per SKU of one product of ${SITE} (US): product_id, zip, regions, count and skus [sku, available_now (a unit range as given, e.g. 1-10 or 401+), available_now_min, available_now_max (null on an open range such as 401+), within_2_weeks, regional (in_stock, quick_ship or not_available for the ZIP's delivery region)]. The unit ranges are national, the same for every region; a SKU missing from every list has no online stock reported. ${WHERE} Captured 2026-11-27: the W\u00dcSTHOF Classic Chef's Knife listed 18 SKUs, the first with 1-10 units available now and 71-80 within 2 weeks. ${ONE}`,
    {
      brand: z.enum(ALL_BRANDS).optional()
        .describe("The brand (any of the 7). Required unless url is given."),
      market: usOnly,
      ...productTarget("wusthof-classic-chefs-knife"),
      skus: skuList.optional()
        .describe("Optional: limits the answer to these SKU ids of the product (up to 20)."),
      zip: zip.optional()
        .describe("Optional US ZIP code for the regional in-stock lists (default 10001)."),
    },
    post("stock"),
  );

  server.tool(
    "get_williamssonoma_store_pickup",
    `Store pickup per SKU per store, for ${SITE} (US; every brand with stores, so not Mark and Graham): up to 20 SKUs at up to 10 stores (store codes from get_williamssonoma_stores): requested_skus, requested_stores, count, skus [sku, ship_mode, stores [pickup_location_code, available_for_pickup (true or false, no unit counts), ship_to_store {earliest_date, latest_date, min_days, max_days} (the dated window to send the SKU to that store for pickup)]]. ${NATIONAL} ${WHERE} Captured 2026-11-27: SKU 1468824 was not available for pickup at stores ST:0859 and ST:6016, with ship to store 2026-12-01 to 2026-12-08. ${ONE}`,
    {
      brand: z.enum(STORE_BRANDS)
        .describe("The brand: williams_sonoma, pottery_barn, pottery_barn_kids, pottery_barn_teen, west_elm or rejuvenation."),
      market: usOnly,
      skus: skuList.describe("Up to 20 SKU ids (get_williamssonoma_product skus[].sku), e.g. ['1468824', '2600435']."),
      stores: z.array(z.string().regex(/^(ST:)?\d{1,5}$/i)).min(1).max(10)
        .describe("Up to 10 store codes (get_williamssonoma_stores stores[].pickup_location_code), e.g. ['ST:0859', 'ST:6016']."),
    },
    post("store-pickup"),
  );

  server.tool(
    "get_williamssonoma_stores",
    `The US stores of ${SITE}, near a ZIP code or a point, every brand with stores in one call (or the brands asked for), by distance: brands, zip, latitude, longitude, radius_miles, include_outlets, count and stores [store_number, pickup_location_code (what get_williamssonoma_store_pickup takes), name, brand, store_type, address, latitude, longitude, phone, distance_miles, pickup, ship_to_store, hours (this week's hours per day; holiday closures show as Closed)]. A ZIP is placed at its US Census centroid. Mark and Graham has no stores. Answers carry market, currency, language and host. Captured 2026-11-27: ZIP 60611 gave 10 stores across 6 brands within 25 miles, the nearest the Williams Sonoma Lincoln Park store in Chicago at 2.16 miles. ${ONE}`,
    {
      brands: z.array(z.enum(STORE_BRANDS)).min(1).max(6).optional()
        .describe("Brands to list (default every brand with stores), e.g. ['williams_sonoma', 'pottery_barn']."),
      zip: zip.optional()
        .describe("A US ZIP code, e.g. '60611'. Send zip or latitude + longitude, not both."),
      latitude: latitude.optional().describe("Latitude (with longitude), instead of zip."),
      longitude: longitude.optional().describe("Longitude (with latitude)."),
      radius: radius.optional().describe("Radius in miles, 1 to 200 (default 25)."),
      include_outlets: z.boolean().optional().describe("Include outlet stores (default false)."),
    },
    post("stores"),
  );

  server.tool(
    "get_williamssonoma_floor_samples",
    `The US stores showing one furniture piece on their floor, for ${SITE} (every brand with stores): by product, product link or SKU near a ZIP code or a point, by distance as the brand lists them: product, zip, latitude, longitude, radius_miles, radius_extended (the brand widened the radius to find one) and count, stores [store_number, brand, name, address, phone, latitude, longitude, distance_miles, hours]. ${WHERE} Captured 2026-11-27: the Pottery Barn Gabrielle sofa near ZIP 94103 was on the floor at 9 stores, the radius extended to 200 miles, the nearest in Corte Madera, CA at 12.24 miles. ${ONE}`,
    {
      brand: z.enum(STORE_BRANDS).optional()
        .describe("The brand: williams_sonoma, pottery_barn, pottery_barn_kids, pottery_barn_teen, west_elm or rejuvenation. Required unless url is given."),
      market: usOnly,
      ...productTarget("gabrielle-upholstered-sofa"),
      sku: sku.optional().describe("Or a SKU id (get_williamssonoma_product skus[].sku). Send product, url or sku."),
      zip: zip.optional().describe("A US ZIP code, e.g. '94103'. Send zip or latitude + longitude, not both."),
      latitude: latitude.optional().describe("Latitude (with longitude), instead of zip."),
      longitude: longitude.optional().describe("Longitude (with latitude)."),
      radius: radius.optional().describe("Radius in miles, 1 to 200 (default 50)."),
    },
    post("floor-samples"),
  );

  server.tool(
    "get_williamssonoma_categories",
    `The category tree of one brand of ${SITE} (US), the Sale and Black Friday listings included. Without category: the top-level categories [id, name, type, path, child_count]; with category (an id): category {id, name, type, path}, count and children [id, name, type (supercat, topcat, subcat, header, linkcat or linksubcat), path (without /shop/, what get_williamssonoma_category takes), children]. ${WHERE} Captured 2026-11-27: Pottery Barn had 24 top-level categories, the first New with 154 children. ${ONE}`,
    {
      brand: z.enum(ALL_BRANDS).describe("The brand (any of the 7)."),
      market: usOnly,
      category: z.string().min(1).max(120).optional()
        .describe("Optional: a top-level category id (categories[].id), e.g. 'furniture'; the answer is its full subtree."),
    },
    post("categories"),
  );

  server.tool(
    "get_williamssonoma_category",
    `One Pottery Barn category listing (US), from ${SITE}: by path or category link, in the site's sorts: path, sort, ${LISTING}. Sale and Black Friday listings are category paths (get_williamssonoma_categories). ${NATIONAL} ${WHERE} An unknown category is a charged not-found (5 credits). ${FIVE}`,
    {
      brand: z.enum(["pottery_barn"]).describe("pottery_barn (the brand served on this tool)."),
      market: usOnly,
      path: z.string().min(1).max(200).optional()
        .describe("A category path under /shop/ (get_williamssonoma_categories path), e.g. 'furniture/sofas' or a sale path. Send path or url."),
      url: z.string().min(10).max(800).optional()
        .describe("Or a category link on potterybarn.com."),
      sort: z.enum(["featured", "price_asc", "price_desc", "newest", "best_selling"]).optional()
        .describe("featured (default), price_asc, price_desc, newest or best_selling."),
    },
    post("category"),
  );

  server.tool(
    "search_williamssonoma",
    `Keyword search on Williams Sonoma or Pottery Barn (US), from ${SITE}: query, ${LISTING}. Results come in the site's relevance order (no sort). West Elm search is not served. ${NATIONAL} ${WHERE} ${FIVE}`,
    {
      brand: z.enum(["williams_sonoma", "pottery_barn"])
        .describe("williams_sonoma or pottery_barn (the brands served on this tool)."),
      market: usOnly,
      query: z.string().min(1).max(100).describe("Search keywords, e.g. 'chef knife'."),
    },
    post("search"),
  );

  server.tool(
    "get_williamssonoma_popular_searches",
    `The day's most searched terms on one brand of ${SITE} (US), the list the brand's own search box shows: date (the day of the list, Pacific time), count and terms [rank, term, count] (counts as given). The newest published list is returned. ${WHERE} ${ONE}`,
    {
      brand: z.enum(ALL_BRANDS).describe("The brand (any of the 7)."),
      market: usOnly,
    },
    post("popular-searches"),
  );

  server.tool(
    "get_williamssonoma_reviews",
    `Customer reviews of one Williams Sonoma product (US; the other brands show no reviews), newest to oldest: product_id, page, offset, page_size, total (written reviews listed), total_pages, has_more, count, statistics {average_rating, review_count (also counts ratings with no text), recommended_count, not_recommended_count, rating_distribution} and reviews [review_id, rating, title, text, submitted_at, recommended, verified_purchaser, badges, syndicated, syndication_source (the site a syndicated review was written on), helpful_votes, unhelpful_votes, secondary_ratings, product_name]. Page 1 holds 8 reviews, pages 2 to 5 hold 30 each; no sort or star filter. No reviewer names, locations or photos. ${WHERE} ${REVIEW_COST}`,
    {
      brand: z.enum(["williams_sonoma"]).optional()
        .describe("williams_sonoma (the brand served on this tool). Required unless url is given."),
      market: usOnly,
      ...productTarget("shun-classic-chefs-knife"),
      page: z.number().int().min(1).max(5).optional()
        .describe("Page, 1 to 5 (default 1): page 1 holds 8 reviews, every later page 30."),
    },
    post("reviews"),
  );
}
