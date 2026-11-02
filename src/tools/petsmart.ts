import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/petsmart.ts. Cross-field rule the backend
// enforces and zod here does not: product takes exactly one of web_style_id,
// sku or url. No zod `.default()`: the MCP SDK would post a defaulted field on
// every call.

const SORTS = ["relevance", "best_sellers", "price_low", "price_high", "top_rated", "new_arrivals"] as const;
const PETS = ["dog", "cat", "fish", "small_pet", "reptile", "bird"] as const;

const STORE_HELP = "Find store numbers with get_petsmart_stores.";

const storeId = () => z.string().regex(/^\d{1,5}$/);
const sku = () => z.string().regex(/^\d{4,9}$/);

const listingFields = () => ({
  page: z.number().int().min(1).max(100).optional()
    .describe("Page, 1-based."),
  limit: z.number().int().min(1).max(40).optional()
    .describe("Results per page, 1-40. Default 40."),
  store_id: storeId().optional()
    .describe(`PetSmart store number, e.g. '1658'. Lists only products in stock at that store, each with in_stock_at_store. ${STORE_HELP}`),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), best_sellers, price_low, price_high, top_rated or new_arrivals."),
});

export function registerPetsmartTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/petsmart/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_petsmart",
    `Search PetSmart products, up to 40 per page. Each result has SKU, web_style_id, name, brand, UPC, price, original price, sale price, price range across sizes, rating, review count, image, size, variation summary, category, pets, promotions, stores_in_stock (how many stores stock it), pickup and Autoship eligibility, and product URL. Prices are national, in dollars. Pass store_id to list only products in stock at that store. Use web_style_id or sku with get_petsmart_product. 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'dog food'."),
      ...listingFields(),
    },
    post("search"),
  );

  server.tool(
    "get_petsmart_product",
    `One PetSmart product by web_style_id, SKU or URL, with every variant (size/flavor): SKU, UPC, price, original price, sale price and end date, Autoship discount with first-order and recurring price, ship-to-home stock, pickup and same-day purchase options, images and promotions. Also brand, rating, review count, categories, description and option lists. Prices are national, in dollars. For store stock use get_petsmart_store_stock. An unknown id is a 404. 1 credit.`,
    {
      web_style_id: z.string().regex(/^\d{1,8}$/).optional()
        .describe("Product id: the number at the end of a product URL (...-570.html), a search result's web_style_id, e.g. '570'. One id covers every size and flavor. Pass exactly one of web_style_id, sku or url."),
      sku: sku().optional()
        .describe("A SKU (one size/flavor), a search result's sku, e.g. '5154856'. Returns the whole product it belongs to."),
      url: z.string().max(500).optional()
        .describe("A petsmart.com product page URL."),
    },
    post("product"),
  );

  server.tool(
    "get_petsmart_stores",
    `The 12 PetSmart stores nearest a US ZIP code: store number (store_id), name, address, phone, coordinates, distance in miles, time zone, the next 7 days of opening hours and services (grooming, PetsHotel, veterinary, adoptions...). Pass a sku and each store also carries quantity and in_stock for that SKU. An unknown ZIP returns no stores. 1 credit.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/)
        .describe("US ZIP code, e.g. '60601'."),
      radius: z.number().int().min(1).max(100).optional()
        .describe("Search radius in miles. Default 30."),
      sku: sku().optional()
        .describe("A SKU, e.g. '5154856'. Every store then also carries its unit count of that SKU."),
    },
    post("stores"),
  );

  server.tool(
    "get_petsmart_store_stock",
    `Stock of up to 20 SKUs at one PetSmart store in one call: units available for in-store pickup at that store, units available to ship to home, and an alternate nearby store with its count when the store has none. Includes the store's name, address, phone, page URL and pickup options. An unknown store number is a 404; an unknown SKU reads 0. 1 credit.`,
    {
      store_id: storeId()
        .describe(`PetSmart store number, e.g. '1658'. ${STORE_HELP}`),
      skus: z.array(sku()).min(1).max(20)
        .describe("Up to 20 SKUs, e.g. every variant of a product: ['5154856', '5154855']."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_petsmart_availability",
    `Unit counts for up to 20 PetSmart store and SKU pairs in one call, mixing stores and SKUs freely. Each result has quantity and in_stock. Unknown stores or SKUs read 0. 1 credit.`,
    {
      pairs: z.array(z.object({
        store_id: storeId().describe("PetSmart store number, e.g. '1658'."),
        sku: sku().describe("SKU, e.g. '5252900'."),
      })).min(1).max(20)
        .describe("Up to 20 store and SKU pairs, e.g. [{store_id: '1658', sku: '5252900'}, {store_id: '2528', sku: '5252900'}]."),
    },
    post("availability"),
  );

  server.tool(
    "get_petsmart_deals",
    `Products in PetSmart's Sale section, up to 40 per page, in the same shape as search_petsmart, plus the current sale events with approximate product counts. Filter by pet, by one sale event, by keywords, or to products in stock at a store. The Sale section also lists points and Autoship promotions, so on_sale marks the rows whose price is actually reduced. 1 credit/call.`,
    {
      pet: z.enum(PETS).optional()
        .describe("Only deals for this pet: dog, cat, fish, small_pet, reptile or bird."),
      event: z.string().max(200).optional()
        .describe("Only one sale event, by its exact name from the events list of a previous deals answer, e.g. 'Sale > November > Dog Sale'. Events change with the season."),
      query: z.string().max(200).optional()
        .describe("Keywords to search within the sale."),
      ...listingFields(),
    },
    post("deals"),
  );
}
