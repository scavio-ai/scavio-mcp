import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/dicks.ts (dickssportinggoods.com, US,
// USD). Cross-field rules the backend enforces and zod here does not: product
// and reviews take product_id or url; category takes path, url or
// category_id; store availability takes zip or lat + lng. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "top_sellers", "savings", "price_low_to_high", "price_high_to_low", "featured", "new_arrivals", "brand_az"] as const;
const DEAL_TYPES = ["clearance", "sale", "weekly_deals"] as const;
const CHAINS = ["dicks", "golf_galaxy", "public_lands"] as const;

const ITEM_FIELDS = "id (for get_dicks_product, get_dicks_products and get_dicks_reviews), sku (the variant the tile shows; null on style-level tiles, which the relevance sort returns), title, brand, URL, image, price and price_max (current), list_price and list_price_max, percent_off, map_price_applies (the lowest price only shows in the cart), rating, review_count, badge (New Color, New Arrival...), sku_count, options (e.g. every color), is_pinned (a merchandised placement), and scheduled_prices: the offer-price windows Dick's has planned for that item (price, starts_at, ends_at; scheduled by the retailer and can change, not a forecast or price history)";
const GRID = `48 items per page by default (up to 144), each with ${ITEM_FIELDS}. Also returns total, page, page_size, total_pages, the sort applied, applied_filters, every facet (id, label, values with value, label, count and selected; any of them works in filters) and categories (id, name, path, count). Pinned items come first on page 1 under the featured sort, so that page can hold a few more than page_size. Prices in USD`;
const GRID_SHORT = "48 items per page by default (up to 144) with the same item fields, facets, categories and totals as search_dicks";
const SLOW = "Usually 20-75 s, up to about 2.5 minutes when a call is retried; failed calls and unknown products are not charged.";

const brandFilter = () =>
  z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).min(1).max(20)]).optional()
    .describe("Only this brand (or any of several), as the Brand facet lists it, e.g. \"Nike\", \"HOKA\", \"YETI\".");
const productId = () => z.string().regex(/^[A-Za-z0-9]{6,30}$/);

const gridFields = {
  page: z.number().int().min(1).max(500).optional()
    .describe("Results page, 1-based. A page past the last one returns an empty items list with the real total. Defaults to 1."),
  page_size: z.number().int().min(1).max(144).optional()
    .describe("Items per page, 1-144. Defaults to 48."),
  sort: z.enum(SORTS).optional()
    .describe("relevance, top_sellers, savings (biggest discount first), price_low_to_high, price_high_to_low, featured (the site's merchandised order: pinned items first), new_arrivals or brand_az. Search and brand default to relevance; category and deals to featured, like the site."),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])).max(20)])).optional()
    .describe("Any facet from a previous response: {facets[].id: facets[].values[].value, or a list of values}. Values of one facet are OR, facets combine (AND). E.g. {\"5495\": \"Men's\"} (gender), {\"3232\": \"Black\"} (color), {\"rating\": \"4+\"}, {\"price\": \"50-100\"}, {\"5004\": \"Sale\"}."),
  min_price: z.number().min(0).max(100000).optional()
    .describe("Approximate lower price bound in USD (the site's price filter is loose: a few items just outside the range can appear)."),
  max_price: z.number().min(0).max(100000).optional()
    .describe("Approximate upper price bound in USD."),
};

export function registerDicksTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/dicks/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  const productTarget = {
    product_id: productId().optional()
      .describe("A Dick's product id: a search result's id, the last part of a product URL (any case), e.g. '23FHQMCLFTN9GTXBLMNS'."),
    url: z.string().min(1).max(800).optional()
      .describe("A dickssportinggoods.com product URL (its product id is used). Alternative to product_id."),
  };

  server.tool(
    "search_dicks",
    `Search dickssportinggoods.com (Dick's Sporting Goods, US) by keyword, filtered by brand, an approximate price range and any facet (gender, size, color, rating, sale...), sorted by relevance, top sellers, savings, price, featured, new arrivals or brand A-Z. ${GRID}. did_you_mean carries Dick's spelling suggestion for a misspelled query. Keywords Dick's sends to a landing page (golf balls, clearance) are followed to that page: redirected_to and category say which. 1 credit.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'running shoes'."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("search"),
  );

  server.tool(
    "get_dicks_product",
    `One Dick's Sporting Goods product by id or URL with every SKU: title, brand, description, features, specs, attributes, product type, category, images, rating, review_count, question and answer counts, the price block (min, max, list_min, list_max, percent_off, map_price_applies), clearance flag, the option axes (color, size, width...) and every variant: sku, UPC, options, color, size, price, list_price, percent_off, map_price_applies (the price only shows in the cart), is_clearance, online_units (units available to ship), buyable, ship_class and lead_time. Prices differ per SKU (one color on clearance at 94.97, the rest at 164.99), so read the variant you need. A variant's sku is what get_dicks_store_availability takes. Review text: get_dicks_reviews. For a quick style-level check of several products use get_dicks_products (1 credit). An unknown id is a 404. ${SLOW} 2 credits.`,
    productTarget,
    post("product"),
  );

  server.tool(
    "get_dicks_products",
    `Up to 5 Dick's Sporting Goods products in one call: the fast, cheap style-level check of title, brand, URL, image, price and list-price ranges, percent_off, map_price_applies, clearance, buyable, option axes, attributes, specs, product type, rating, review_count and description. No per-SKU prices or units: those come from get_dicks_product. Unknown ids are listed in not_found; when none is found it is a 404. 1 credit for up to 5 ids.`,
    {
      product_ids: z.array(productId()).min(1).max(5)
        .describe("1 to 5 Dick's product ids, e.g. ['23FHQMCLFTN9GTXBLMNS', '26UNDMFITN1HRI9WUAETC']."),
    },
    post("products"),
  );

  server.tool(
    "get_dicks_reviews",
    `The 15 newest customer reviews of one Dick's Sporting Goods product by id or URL, with its review statistics: total, average, distribution (1-5 stars), recommended and not-recommended counts, photo count, first and last review dates, question and answer counts, and the average of each secondary rating (fit, comfort, quality, value...). Each review has id, rating, title, text, pros, cons, author nickname, submitted_at, recommended, helpful and unhelpful votes, verified_purchaser and incentivized badges, syndicated_from (the brand site a review came from), secondary ratings, customer photos and the brand's public response. The newest 15 only: no paging, no sort, no star filter; questions and answers are counts only, no Q&A text. Reviewer age, gender and location are never returned. An unknown id is a 404. ${SLOW} 2 credits.`,
    productTarget,
    post("reviews"),
  );

  server.tool(
    "get_dicks_category",
    `Browse one Dick's Sporting Goods category by its page path, URL or id (Men's Running Shoes, Golf Drivers, Kayaks...), in the site's featured order by default, with the same filters and sorts as search_dicks. ${GRID_SHORT}. Also returns the category's id, name, path and URL. An unknown category is a 404. 1 credit.`,
    {
      path: z.string().min(1).max(300).optional()
        .describe("A Dick's category page path (/f/<name> or /c/<name>), as dickssportinggoods.com category links and a response's categories[].path carry it, e.g. '/f/mens-running-shoes'."),
      url: z.string().min(1).max(800).optional()
        .describe("A dickssportinggoods.com category URL (its page is used; filters in the URL are not read, send them in filters)."),
      category_id: z.union([z.string().regex(/^(?:12301_)?\d{3,12}$/), z.number().int().positive()]).optional()
        .describe("A category id: a response's categories[].id or category.id, e.g. '202105'."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("category"),
  );

  server.tool(
    "get_dicks_brand",
    `Every Dick's Sporting Goods product of one brand by name (Nike, YETI, Callaway, Under Armour...), optionally narrowed by a keyword, with the same filters and sorts as search_dicks (except brand). ${GRID_SHORT}. brand echoes the brand as Dick's writes it. An unknown brand is a 404. 1 credit.`,
    {
      brand: z.string().min(1).max(100)
        .describe("A brand name as Dick's lists it in the Brand facet, e.g. 'Nike', 'YETI', 'Callaway', 'Under Armour'; case does not matter."),
      query: z.string().min(1).max(200).optional()
        .describe("Narrow the brand to a keyword, e.g. 'tumbler'."),
      ...gridFields,
    },
    post("brand"),
  );

  server.tool(
    "get_dicks_deals",
    `Dick's Sporting Goods deal listings: Clearance (default), Sale or This Week's Deals, in the site's featured order by default (sort savings for the biggest discounts first), with the same filters and sorts as search_dicks. ${GRID_SHORT}. Clearance is often per size or color: get_dicks_product shows which SKUs carry the clearance price. To track clearance prices over time, poll and store your own: there is no price history. 1 credit.`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("clearance (default), sale or weekly_deals (This Week's Deals)."),
      brand: brandFilter(),
      ...gridFields,
    },
    post("deals"),
  );

  server.tool(
    "get_dicks_store_availability",
    `Store unit counts for 1-20 Dick's Sporting Goods SKUs at up to 100 stores near a US ZIP code or a point (lat + lng), nearest first, within 25 miles by default (up to 250). chain picks DICK'S stores (default, incl. House of Sport and Going, Going, Gone!), Golf Galaxy or Public Lands. Each store has store_id, chain, name, address, shopping_center, city, state, ZIP, phone, lat / lng, distance_miles, status, weekly hours and per SKU: units (the units the store can sell) and in_store_units (the units on hand; higher than units only at stores that do not take orders for that item, where units reads 0). Also returns sku_totals and how many stores have stock. There is no standalone store locator: store details come with a SKU lookup. An unknown SKU reads 0 at every store, so take SKUs from get_dicks_product variants[].sku. 1 credit.`,
    {
      skus: z.array(z.string().regex(/^\d{6,12}$/)).min(1).max(20)
        .describe("1 to 20 SKU ids from get_dicks_product variants[].sku, e.g. ['25535758', '26810079']."),
      zip: z.union([z.string().regex(/^\d{5}(-\d{4})?$/), z.number().int().min(0).max(99999)]).optional()
        .describe("US ZIP code to search around, e.g. '60601'."),
      lat: z.number().min(-90).max(90).optional()
        .describe("Latitude (with lng), instead of zip."),
      lng: z.number().min(-180).max(180).optional()
        .describe("Longitude (with lat)."),
      radius: z.number().int().min(1).max(250).optional()
        .describe("Search radius in miles, 1-250. Defaults to 25. Up to 100 stores are returned."),
      chain: z.enum(CHAINS).optional()
        .describe("dicks (DICK'S Sporting Goods, incl. House of Sport and Going, Going, Gone! stores; default), golf_galaxy or public_lands."),
      in_stock_only: z.boolean().optional()
        .describe("Only the stores that have at least one of the SKUs."),
    },
    post("store-availability"),
  );

  server.tool(
    "get_dicks_suggestions",
    `The dickssportinggoods.com search-box suggestions for a partial query: keyword completions, brands, categories (id, name, path, URL, product_count) and products (id, title, brand, URL, image, color, price and list-price ranges, percent_off). Useful for keyword research and for building queries for search_dicks. 1 credit.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'yeti tum'."),
    },
    post("suggestions"),
  );
}
