import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/wholefoods.ts. Cross-field rule the backend
// enforces and zod here does not: product takes asin, url or slug (at least
// one). No zod `.default()`: the MCP SDK would post a defaulted field on every
// call.

const BROWSE_SORTS = ["featured", "popular", "price_asc", "price_desc", "brand_az", "brand_za"] as const;
const DIETS = ["vegan", "gluten-free", "organic", "dairy-free", "vegetarian"] as const;

const PRICE_NOTE =
  "Prices are that store's in-store (shelf) prices in dollars: regular_price, sale_price and prime_price (the Prime member price), with sale start and end dates. A multi-buy is a total: sale_price 10 with sale_quantity 2 means 2 for $10; price_unit lb means per pound.";

const storeId = () =>
  z.string().regex(/^\d{5}$/).optional()
    .describe("5-digit Whole Foods store id from get_whole_foods_stores, e.g. '10160'. Prices are that store's. Default 10145 (Lamar, Austin TX).");

const requiredStoreId = () =>
  z.string().regex(/^\d{5}$/)
    .describe("5-digit Whole Foods store id from get_whole_foods_stores, e.g. '10145'.");

const diet = () =>
  z.enum(DIETS).optional()
    .describe("Only products with this dietary attribute: vegan, gluten-free, organic, dairy-free or vegetarian.");

const limit = () =>
  z.number().int().min(1).max(60).optional()
    .describe("Products per page, 1-60. Default 60.");

const offset = () =>
  z.number().int().min(0).max(10000).optional()
    .describe("Products to skip, for paging (60 = page 2 at the default limit). Default 0.");

const browseSort = () =>
  z.enum(BROWSE_SORTS).optional()
    .describe("featured (default), popular, price_asc, price_desc, brand_az or brand_za.");

const CATEGORY_HELP = "Category slug, e.g. 'dairy-eggs', 'cheese', 'produce'. Slugs are in the category facet of any search.";

export function registerWholeFoodsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/wholefoods/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_whole_foods",
    `Search Whole Foods Market products at one store, up to 60 per page. ${PRICE_NOTE} Each result has asin, slug, name, brand, image, URL, on_sale and is_local flags; the response has total_results and facets (category tree, featured and diet filters, with counts). Sorts are relevance, price_asc and price_desc only. No ratings, reviews, UPCs or per-store unit stock. Use a result's asin with get_whole_foods_product. 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'milk'."),
      store_id: storeId(),
      sort: z.enum(["relevance", "price_asc", "price_desc"]).optional()
        .describe("relevance (default), price_asc or price_desc."),
      on_sale: z.boolean().optional()
        .describe("Only products on sale at the store. Default false."),
      diet: diet(),
      category: z.string().min(1).max(100).optional()
        .describe(`Restrict to one category. ${CATEGORY_HELP}`),
      limit: limit(),
      offset: offset(),
    },
    post("search"),
  );

  server.tool(
    "get_whole_foods_category",
    `Browse one Whole Foods Market category at one store, with sort and filters, up to 60 per page. ${PRICE_NOTE} The response has the category breadcrumb, total_results and facets. An unknown category slug is a 404. 1 credit/call.`,
    {
      category: z.string().min(1).max(100)
        .describe(`${CATEGORY_HELP} 'all-products' lists the whole store.`),
      store_id: storeId(),
      sort: browseSort(),
      on_sale: z.boolean().optional()
        .describe("Only products on sale at the store. Default false."),
      diet: diet(),
      limit: limit(),
      offset: offset(),
    },
    post("category"),
  );

  server.tool(
    "get_whole_foods_deals",
    `Every product on sale at one Whole Foods Market store, store-wide or in one category, up to 60 per page. ${PRICE_NOTE} 1 credit/call.`,
    {
      category: z.string().min(1).max(100).optional()
        .describe(`${CATEGORY_HELP} Default 'all-products' (every sale item at the store).`),
      store_id: storeId(),
      sort: browseSort(),
      diet: diet(),
      limit: limit(),
      offset: offset(),
    },
    post("deals"),
  );

  server.tool(
    "get_whole_foods_product",
    `One Whole Foods Market product by ASIN, URL or slug: name, brand, description, highlights, ingredients, nutrition facts, diets, SNAP EBT eligibility and images. With store_id, two separately labelled price blocks: in_store (the store's shelf regular, sale and Prime price; null when that store does not list the item) and online (that store's delivery/pickup price, list price, savings, Prime price, unit price and availability; null when it has no online offer). Online and in-store prices often differ. An unknown ASIN is a 404. 1 credit.`,
    {
      asin: z.string().regex(/^[A-Za-z0-9]{10}$/).optional()
        .describe("Product ASIN (a search result's asin), e.g. 'B0BCBNG8LS'. Pass this, url or slug."),
      url: z.string().url().max(500).optional()
        .describe("A wholefoodsmarket.com product URL."),
      slug: z.string().min(1).max(200).optional()
        .describe("A product slug (a search result's slug), e.g. 'a2-milk-grassfed-whole-milk-59-fz-b0bcbng8ls'."),
      store_id: z.string().regex(/^\d{5}$/).optional()
        .describe("5-digit Whole Foods store id, e.g. '10145'. Adds that store's in-store (shelf) prices and its online (delivery/pickup) price."),
    },
    post("product"),
  );

  server.tool(
    "get_whole_foods_stores",
    `Whole Foods Market stores near a US ZIP code, nearest first, within 15 miles widening to 50: store_id, name, address, phone, coordinates, distance in miles, time zone, and seven days of in-store and pickup hours (UTC times). No store in range is an empty list, not an error. 1 credit.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/)
        .describe("US ZIP code, e.g. '78703'."),
    },
    post("stores"),
  );

  server.tool(
    "get_whole_foods_store",
    `One Whole Foods Market store by id: name, status, phone, Prime eligibility, opening date, address, coordinates, time zone and its store page and sales flyer URLs. An unknown store id is a 404. 1 credit.`,
    {
      store_id: requiredStoreId(),
    },
    post("store"),
  );

  server.tool(
    "get_whole_foods_sales_flyer",
    `The current weekly sales flyer of one Whole Foods Market store: each promotion's product name, brand, headline, description, terms, regular, sale and Prime price as printed in the flyer (text such as "$3.99/lb" or "44% off"), start and end dates, image, rank and the ASINs it covers. An unknown store id is a 404. 1 credit.`,
    {
      store_id: requiredStoreId(),
    },
    post("sales-flyer"),
  );
}
