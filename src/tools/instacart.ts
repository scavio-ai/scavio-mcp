import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/instacart.ts (instacart.com every tool; instacart.ca
// every tool except cross-search and reviews). Rules the backend enforces and zod here
// does not: zip must be a US ZIP for us and a Canadian postal code for ca; language fr
// needs country ca and is refused on suggestions; product needs retailer unless the
// product link names the store. No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const SERVICE_TYPES = ["delivery", "pickup", "instore"] as const;
const SORTS = ["best_match", "price_asc", "price_desc"] as const;

const NAME = "Instacart (instacart.com, the US and Canada grocery delivery and pickup marketplace)";
const CREDITS = "Costs 1 credit. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const MARKET = "country, language, currency, zip, place (Instacart's name for the ZIP)";
const PRICED_FOR =
  "priced_for {retailer_id, retailer_slug, retailer_name, service_type, shop_id, retailer_location_id, zip, pricing_label (the retailer's pricing statement as Instacart shows it, e.g. Prices are higher than your local warehouse.)}";
const PRICES =
  "Every price is Instacart's price for that store, ZIP and service type (priced_for). Retailers set their Instacart prices, which can be above their in-store prices: never report an Instacart delivery price as the store's shelf price; service_type instore returns Instacart's in-store prices where it shows them, so a delivery and an in-store price for the same product, store and day can be compared. Stock is as Instacart reports it.";
const NOT_AVAILABLE =
  "Not available: delivery and service fees or order minimums as numbers (Instacart shows them at checkout), coupons, Instacart+ member prices, account, order or cart data, price history (poll and store the answers).";
const ITEM =
  "product_id (the input of get_instacart_product, get_instacart_price_compare and get_instacart_reviews; the same at every store), item_id, name, brand, brand_id, size, price, price_text, currency, was_price (the regular price Instacart shows next to a sale price), discount_percent (computed by Scavio from was_price), deal (Instacart's offer badge, e.g. Buy 2, get 3 free), promotions, unit_price (e.g. $0.25/oz), loyalty_price and loyalty_label (a loyalty-card price, as Instacart shows it), in_stock, stock_level, stock_label, dietary, image, url, max_quantity";
const LIST = `${MARKET}, ${PRICED_FOR}, total, total_pages, has_more, count, items [{${ITEM}}], note`;
const NO_ZONE = "A ZIP where Instacart has no service area answers 200 with an empty list and a note.";

const zip = z.union([z.string().min(5).max(10), z.number().int().min(0).max(99999)])
  .describe("The delivery ZIP: a US ZIP (10001) or, with country ca, a Canadian postal code (M5V 2T6 or M5V2T6). Prices, stores and availability are for this location.");
const retailer = z.union([z.string().min(1).max(80), z.number().int().positive()])
  .describe("A retailer slug or id from get_instacart_retailers (retailers[].slug or retailer_id, e.g. costco, jewel-osco, wegmans). It must serve the ZIP.");
const country = z.enum(["us", "ca"]).optional()
  .describe("us (instacart.com, USD, default) or ca (instacart.ca, CAD).");
const usOnly = z.enum(["us"]).optional()
  .describe("us only (default): Instacart Canada does not offer this.");
const language = z.enum(["en", "fr"]).optional()
  .describe("en (default) or fr (country ca only: French names, aisles and price text as Instacart shows them in Quebec).");
const serviceType = z.enum(SERVICE_TYPES).optional()
  .describe("Which Instacart price: delivery (default), pickup, or instore (Instacart's in-store prices for that store, where it shows them).");
const productId = z.union([z.string().min(1).max(600), z.number().int().positive()])
  .describe("An Instacart product id (items[].product_id, the same at every store, e.g. 16408559), an item id (items_2683-16408559) or an Instacart product link.");
const page = z.number().int().min(1).max(100).optional().describe("Page, from 1 (total_pages says how deep the list goes).");
const limit = z.number().int().min(1).max(60).optional().describe("Products per page, 1 to 60 (default 30).");

export function registerInstacartTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/instacart/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_instacart_retailers",
    `Every store on ${NAME} serving a ZIP or Canadian postal code. Start here: the slug is the retailer input of the other tools. Returns ${MARKET}, count, no_markups_count, retailers [{retailer_id, slug, name, retailer_type, categories, logo, services, delivery_available, pickup_available, instore_available, delivery_eta and pickup_eta (Instacart's text, e.g. Delivery by 10:45pm), no_markups (Instacart's 'No markups' label: in-store prices online), accepts_ebt, store_labels, alcohol_allowed, delivery_shop_id, pickup_shop_id, retailer_location_id, url}], note. Delivery fees and order minimums are not part of the answer. ${NO_ZONE} A ZIP Instacart does not recognise is a charged 404. ${CREDITS}`,
    { zip, country, language },
    post("retailers"),
  );

  server.tool(
    "search_instacart",
    `Search one store on ${NAME} at a ZIP: sort by price, filter to sale items or a brand, page through every match, for delivery, pickup or in-store prices. Returns query, sort, on_sale, brand_id, page, limit, ${LIST}, brand_filters [{brand_id, name}]. A retailer that does not serve the ZIP (or not in that service type) is a charged 404. ${PRICES} ${NOT_AVAILABLE} Costs 3 credits (2 when the page fits in Instacart's first answer). Failed upstream calls and refused inputs are not charged.`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. yogurt (French keywords with language fr, e.g. lait)."),
      retailer,
      zip,
      country,
      language,
      service_type: serviceType,
      sort: z.enum(SORTS).optional().describe("best_match (default, Instacart's order), price_asc or price_desc."),
      on_sale: z.boolean().optional().describe("true: only the products Instacart marks on sale at this store."),
      brand_id: z.union([z.string().min(1).max(10), z.number().int().positive()]).optional()
        .describe("A brand id from brand_filters[].brand_id of an earlier search (e.g. 18514)."),
      page,
      limit,
    },
    post("search"),
  );

  server.tool(
    "get_instacart_cross_search",
    `One query across up to 10 stores delivering to a US ZIP on ${NAME}, each store's first matching products priced for delivery from that store (us only). Returns ${MARKET}, query, service_type, max_retailers, items_per_retailer, retailers_matched (stores Instacart found matches at, up to 50), count, groups [{retailer_id, retailer_slug, retailer_name, shop_id, retailer_location_id, no_markups, matches, count, items [{${ITEM}}]}], note. Stores come in Instacart's order. ${PRICES} Costs 3 credits for up to 5 stores, 4 for 6 to 10. Failed upstream calls and refused inputs are not charged.`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. milk."),
      zip,
      country: usOnly,
      max_retailers: z.number().int().min(1).max(10).optional().describe("Stores to price, 1 to 10 (default 5). 3 credits up to 5 stores, 4 above."),
      items_per_retailer: z.number().int().min(1).max(20).optional().describe("Products per store, 1 to 20 (default 5)."),
    },
    post("cross-search"),
  );

  server.tool(
    "get_instacart_product",
    `One product at one store on ${NAME}: detail plus that store's price block for the ZIP and service type. Returns ${MARKET}, product_id, ${PRICED_FOR}, available_at_store, name, size, brand, description, ingredients, directions, warnings (allergens as given, e.g. Contains: milk.), sections [{title, text}], key_nutrients [{name, value, unit}] (the nutrients Instacart lists, not a full nutrition panel), images, item {${ITEM}} (null when the store shows no price), rating {average_rating, ratings_count, distribution [{stars, count, percent}]}, url, note. An id Instacart does not know is a charged 404. ${PRICES} ${CREDITS}`,
    {
      product_id: productId,
      retailer: retailer.optional().describe("A retailer slug or id from get_instacart_retailers (required unless the product link names the store)."),
      zip,
      country,
      language,
      service_type: serviceType,
    },
    post("product"),
  );

  server.tool(
    "get_instacart_price_compare",
    `The same product priced at every store delivering to a ZIP on ${NAME}, as Instacart shows it for delivery, sorted low to high. Returns ${MARKET}, product_id, service_type, stores_checked, count, prices [{retailer_id, retailer_slug, retailer_name, shop_id, retailer_location_id, price, price_text, currency, was_price, discount_percent (computed by Scavio from was_price), price_reduction, on_sale, no_markups, url}], note. Unit prices and stock are not in this answer (get_instacart_product gives them per store). A product priced nowhere at the ZIP answers 200 with an empty list and a note. These are Instacart delivery prices, not shelf prices. ${CREDITS}`,
    { product_id: productId, zip, country, language },
    post("price-compare"),
  );

  server.tool(
    "get_instacart_categories",
    `The department and aisle tree of one store on ${NAME}. Returns ${MARKET}, retailer_id, retailer_slug, retailer_name, count, aisle_count, categories [{id, name, slug (the input of get_instacart_category), type (department or collection), image, aisles [{id, name, slug}]}]. ${CREDITS}`,
    { retailer, zip, country, language },
    post("categories"),
  );

  server.tool(
    "get_instacart_category",
    `The products of one department, aisle or collection of a store on ${NAME}, paged. Returns category, title, page, limit, ${LIST}. A slug the store does not have is a charged 404. ${PRICES} ${CREDITS}`,
    {
      category: z.string().min(1).max(200)
        .describe("A department or aisle slug from get_instacart_categories (categories[].slug or categories[].aisles[].slug, e.g. produce, fresh-fruits)."),
      retailer,
      zip,
      country,
      language,
      service_type: serviceType,
      page,
      limit,
    },
    post("category"),
  );

  server.tool(
    "get_instacart_deals",
    `The sale items of one store on ${NAME} (its Sales collection: sale prices with the regular price, multi-buy offers such as Buy 2, get 3 free), paged. Returns category, title, page, limit, ${LIST}. Coupons are not included. ${PRICES} ${CREDITS}`,
    { retailer, zip, country, language, service_type: serviceType, page, limit },
    post("deals"),
  );

  server.tool(
    "get_instacart_stores",
    `The pickup locations of one retailer near a ZIP on ${NAME}, nearest first. Returns ${MARKET}, retailer, retailer_id, retailer_name, retailer_slug, total, count, stores [{retailer_location_id, name, address {street, line2, postal_code}, latitude, longitude, distance, distance_text, phone, hours [{date, hours}] (the next 7 days as Instacart shows them, for the 5 nearest; null for the rest)}], note. A retailer with no pickup near the ZIP answers 200 with an empty list and a note. ${CREDITS}`,
    {
      retailer,
      zip,
      country,
      language,
      limit: z.number().int().min(1).max(50).optional().describe("Stores to return, 1 to 50 (default 10)."),
    },
    post("stores"),
  );

  server.tool(
    "get_instacart_suggestions",
    `Instacart's search suggestions for a partial query on ${NAME}, for one store or across every store serving the ZIP. Returns ${MARKET}, query, scope (retailer or all_retailers), retailer_id, retailer_slug, retailer_name, count, suggestions [{type (search_term, collection or retailer), text, search_term, category, retailer, image}]. English only (language fr is a 400, not charged). ${CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. eg."),
      zip,
      retailer: retailer.optional().describe("A retailer slug or id: that store's suggestions. Without it, suggestions across every store serving the ZIP."),
      country,
    },
    post("suggestions"),
  );

  server.tool(
    "get_instacart_reviews",
    `Customer reviews of one product on ${NAME}, 15 a page (us only). Returns country, product_id, page, page_size, order, has_more, rating {average_rating, ratings_count, distribution} (page 1), count, reviews [{review_id, rating (1 to 5), title, text, reviewed_on, date, source (the brand or site Instacart names for the review), incentivized (Instacart notes the review was written as part of a promotion)}], note. No reviewer name or identity is returned. ${CREDITS}`,
    {
      product_id: productId,
      country: usOnly,
      page: z.number().int().min(1).max(100).optional().describe("Page, from 1 (15 reviews a page)."),
    },
    post("reviews"),
  );
}
