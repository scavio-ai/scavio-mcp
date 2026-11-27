import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/riachuelo.ts (Riachuelo, riachuelo.com.br, the Brazilian fashion retailer; Brazil,
// BRL). Rules the backend enforces and zod here does not: product takes url or sku (not both); deals takes department
// or campaign (not both); filter ids must be a listing's filters[].id and at most 10 values in all. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Riachuelo (riachuelo.com.br, the Brazilian fashion retailer), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SEARCH_TIME = "Keyword searches are slow at the source: usually 5 to 90 s; allow a client timeout of at least 300 s.";
const PAGE_TIME = "Usually 3 to 35 s; allow a client timeout of at least 180 s.";
const CARD =
  "position, sku (what get_riachuelo_product takes), name, brand, url, image, currency, price, list_price, discount_percent, on_sale, price_varies, promo_tag {label, campaign} (the coupon or campaign banner the listing shows; campaign works in get_riachuelo_deals), seller {id, name}, colors [{name, hex}], categories, sold_out, sizes_in_stock and variations [{color, size, sku, sold_out, units}] (the listing's sold-out flag and the units it lists per size)";
const GRID = `24 per page, pages 1 to 500, in the site's sorts, filtered by the listing's own filters (size, colour, gender, subcategory, brand, category group). Returns page, page_size, total (sold-out products included), total_pages, has_more, count, items [{${CARD}}], filters [{id, label, multi_select, options [{label, value, count}]}] with the site's counts, price_range {min, max}, sort, filters_applied and notes.`;

const filterValue = z.string().min(1).max(80);
const grid = {
  sort: z.enum(["relevance", "newest", "best_selling", "discount", "price_asc", "price_desc"]).optional()
    .describe("relevance (default), newest, best_selling, discount, price_asc or price_desc (the site's sorts)."),
  filters: z.record(z.string(), z.union([filterValue, z.array(filterValue).max(10)])).optional()
    .describe("Filter id -> value or values, from a listing's filters[].id (filter_size, filter_color, gender, catalog_class, brand, gg) and filters[].options[].value, up to 10 values, e.g. {\"filter_size\": [\"P\", \"M\"]}. Several values of one filter match any of them; several filters must all match. A price range is not taken: sort by price instead."),
  page: z.number().int().min(1).max(500).optional().describe("Results page, 1 to 500 (24 per page)."),
};

export function registerRiachueloTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/riachuelo/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_riachuelo",
    `Search ${SITE} by keyword, across the whole site. ${GRID} Also query. No results is an empty answer (charged). Search suggestions are not offered. Captured 2026-11-27: vestido matched 1204 products (sold-out ones included), the first a midi dress at 179.99 BRL (list 199.99) with 5 sizes in stock, 1 to 40 units listed per size. ${COST} ${SEARCH_TIME}`,
    {
      query: z.string().min(1).max(120).describe("Search keywords, in Portuguese as a shopper types them, e.g. 'vestido'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_riachuelo_category",
    `One category listing of ${SITE}, by category path or link, sorted and filtered like search_riachuelo. ${GRID} Also category, title and breadcrumbs. An unknown category is a charged not-found. Captured 2026-11-27: feminino held 9006 products. ${COST} ${PAGE_TIME}`,
    {
      category: z.string().min(1).max(600)
        .describe("A category path as the site writes it (breadcrumbs[].path and items[].categories carry them), e.g. 'feminino', 'masculino', 'infantil' or 'feminino/colecao-feminino/vestido', or a riachuelo.com.br link to one."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_riachuelo_deals",
    `A campaign page of ${SITE}: by default the Black Friday page of a department (feminino unless another is given), or another campaign page by path (items[].promo_tag.campaign), sorted and filtered like search_riachuelo. Campaign pages are seasonal and carry no start or end dates; an unknown or ended campaign is a charged not-found. ${GRID} Also campaign, department, title and breadcrumbs. Captured 2026-11-27 (Black Friday week): the masculino Black Friday page held 627 products, the first a linen shirt at 85.99 BRL (list 159.99). ${COST} ${PAGE_TIME}`,
    {
      department: z.string().min(1).max(60).optional()
        .describe("The department whose Black Friday page to read: feminino (default), masculino or infantil. Send department or campaign, not both."),
      campaign: z.string().min(1).max(600).optional()
        .describe("Another campaign page by its path (campanha/..., as items[].promo_tag.campaign returns it), e.g. 'campanha/r/promo/oferta-especial', or a riachuelo.com.br link, instead of department."),
      ...grid,
    },
    post("deals"),
  );

  server.tool(
    "get_riachuelo_product",
    `One product of ${SITE} by link or sku (one of them): requested, sku, sku_group, name, brand, color, url, currency, price (the price now), list_price, on_sale, discount_percent, sold_out (the site's flag for the whole product), availability, gender, department, subcategory, collection, composition, breadcrumbs, attributes [{id, label, value, shown_on_page}], images, rating {average, count, histogram} (the site's summary), reviews [{rating, title, text, size, color, date, sku}] (the reviews the product page itself shows, without reviewer names), reviews_has_more and notes. The product page lists no stock per size: the variations of a listing card carry the per-size sold-out flag and units. Not available: more review pages, shipping quotes by CEP, store stock, search suggestions, the marketing description, price history. An unknown product is a charged not-found. Captured 2026-11-27: 16519710, a pair of wide-leg trousers, was 79.99 BRL (list 159.99, 50% off), rated 5 from 11 ratings. ${COST} ${PAGE_TIME}`,
    {
      url: z.string().min(1).max(800).optional().describe("A riachuelo.com.br product link or path (items[].url). Send url or sku."),
      sku: z.string().min(6).max(20).optional()
        .describe("The product sku (items[].sku: digits, or KIT<digits> for a kit), e.g. '16426657', instead of url."),
    },
    post("product"),
  );
}
