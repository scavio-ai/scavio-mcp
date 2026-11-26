import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// PC Express: 7 tools on /api/v1/pcexpress (search, category, collection, product, stores, store,
// suggestions), Canada only, prices in CAD. Shapes mirror backend/src/routes/pcexpress.ts.
// Rules the backend enforces and zod here does not: language fr only on provigo (French only) and
// maxi; a store_id on a priced tool is a 400 (prices are the banner's default store's); product takes
// code or url; latitude and longitude go together; at most 10 filter values in all. Store ids are
// strings (leading zeros count). No zod `.default()`: the MCP SDK would post a defaulted field on every
// call.

const BANNERS = [
  "superstore",
  "nofrills",
  "loblaw",
  "zehrs",
  "fortinos",
  "valumart",
  "independent",
  "wholesaleclub",
  "provigo",
  "maxi",
] as const;
const SORTS = ["relevance", "price_low_to_high", "price_high_to_low", "name_a_to_z", "newest"] as const;
const DEALS = ["price_reduction", "pc_points", "multi_buy", "member_only_price", "dollar_deals"] as const;

const FIRST =
  "PC Express (Loblaw's online grocery for Real Canadian Superstore, No Frills, Loblaws, Zehrs, Fortinos, Valu-mart, Your Independent Grocer, Wholesale Club, Provigo and Maxi; Loblaw operates 2,504 stores per its 2025 annual report)";
const SLOW = "Answers can take up to about a minute.";
const SLOWER = "Answers can take longer than a minute: allow up to 2 minutes.";
const BILL = "Failed upstream calls and refused inputs are not charged; a not-found is charged (credits_used is what was charged).";
const STORE =
  "Prices are for the banner's default online store; choosing a store is not offered (a store_id is a 400). store {store_id, banner, requested false} says which store priced the answer. The same product code is priced per banner: captured 2026-11-26, No Name Large Size Eggs 12 Pack (20812144001_EA) was 3.93 CAD at Real Canadian Superstore's default store 1033 and 4.17 at Maxi's default store 8976.";
const DEAL =
  "deal {type (sale, limit, multi), name, text, deal_price, points, expiry_date} is as PC Express shows it: an end date, no start date. pc_optimum_points is the PC Optimum offer as shown. member_only_price is the member price PC Express shows publicly on the item, not a price behind a login.";
const TILE =
  "code (e.g. 20812144001_EA, the input of get_pcexpress_product), article_number, unit_of_measure, name, brand, size, unit_price, package_sizing, url, image, price, was_price, price_text, member_only_price, tax_note, sold_by, weighted, min_quantity, max_quantity, deal, pc_optimum_points, badges, stock_status, stock_text, rating, review_count, sponsored, section";
const LIST = `banner {id, name}, language, page, page_size, sort, sort_applied, filters_applied, total, total_pages, has_more, count, sponsored_count, items [{${TILE}}], sections, store, facets and sorts (include_facets), market {country, currency, language}, notes`;
const NOT_AVAILABLE =
  "Not available: choosing a store, review text (rating and count only), the printed flyer, Shoppers Drug Mart, Atlantic Superstore, City Market and T&T, cart or checkout, PC Optimum prices behind a login, price history (poll and store the answers). For national brands at Walmart.ca use the Walmart tools with domain ca.";

const banner = z.enum(BANNERS).optional()
  .describe("superstore (Real Canadian Superstore, default), nofrills (No Frills), loblaw (Loblaws), zehrs, fortinos, valumart (Valu-mart), independent (Your Independent Grocer), wholesaleclub (Real Canadian Wholesale Club), provigo, maxi. The same product codes on every banner; prices differ by banner.");
const language = z.enum(["en", "fr"]).optional()
  .describe("en, or fr on provigo (French only) and maxi (French by default, English too). Other banners serve English only: fr there is a 400.");
const strOrList = (max: number) => z.union([z.string().max(max), z.array(z.string().max(max))]);

const listing = {
  page: z.number().int().min(1).optional().describe("Page, 1-based (48 products a page; default 1)."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), price_low_to_high, price_high_to_low, name_a_to_z, newest."),
  brand: strOrList(10).optional()
    .describe("Brand codes from facets (productBrand), e.g. N No Name, P President's Choice, PO PC Organics, PCB PC Blue Menu."),
  deals: z.union([z.enum(DEALS), z.array(z.enum(DEALS))]).optional()
    .describe("price_reduction, pc_points (PC Optimum points offers), multi_buy, member_only_price, dollar_deals ($1-$5)."),
  price_range: strOrList(40).optional().describe("Price bands from facets (e.g. \"$5-$10\")."),
  prepared_in_canada: z.boolean().optional().describe("Only products marked Prepared in Canada."),
  dietary: strOrList(40).optional()
    .describe("Dietary codes from facets (e.g. gluten_free, organic, vegan, lactose_free)."),
  aisle: strOrList(8).optional().describe("Aisle (category) ids from facets."),
  filters: z.array(z.object({ facet: z.string().max(40), value: strOrList(60) })).optional()
    .describe("Any other facet: {facet, value} from facets[].facet and facets[].values[].value. At most 10 filter values in all."),
  include_facets: z.boolean().optional()
    .describe("Also return facets [{facet, name, multi_select, values [{value, name, count, selected}]}] and sorts."),
  banner,
  language,
};

export function registerPcexpressTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/pcexpress/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_pcexpress",
    `Search the products of ${FIRST} on one banner, by keywords or an article number, with paging (48 a page), five sorts and the site's filters (brand incl. the store brands No Name and President's Choice; deals: price reduction, PC Optimum points, multi-buy, member-only price, $1-$5; price band, Prepared in Canada, dietary, aisle). A term PC Express sends to a collection or category is answered from that page (redirected_to says which). Returns query, corrected_query, redirected_to, ${LIST}. ${STORE} ${DEAL} Captured 2026-11-26: "eggs" on superstore listed 125 products (3 pages). ${NOT_AVAILABLE} Costs 1 credit. ${BILL} ${SLOW}`,
    {
      query: z.string().min(1).max(200).describe("Keywords or an article number (required, e.g. eggs)."),
      ...listing,
    },
    post("search"),
  );

  server.tool(
    "get_pcexpress_category",
    `Browse one category of ${FIRST} by category id or link, with paging, sorts and filters on a product list; a department (top-level category) page lists its products in carousels (sections, no paging) and its sub-categories in category.children. Returns category {category_id, name, type (list or department), url, breadcrumbs, children}, ${LIST}. ${STORE} ${DEAL} Captured 2026-11-26: category 28224 (Milk & Cream) on superstore listed 227 products. An unknown category is a charged 404. Costs 1 credit. ${BILL} ${SLOW}`,
    {
      category: z.union([z.string().max(600), z.number().int()])
        .describe("Required. A category id (e.g. 28224 Milk & Cream, from category.children, breadcrumbs or a link's /c/<id>) or a category link or path."),
      ...listing,
    },
    post("category"),
  );

  server.tool(
    "get_pcexpress_collection",
    `One collection page of ${FIRST}: the deals and themed pages the site links (deals-centre, black-friday, no-name, pc-value, new-arrivals ...), their products with prices and deals, in sections, and a paged list when the page has one. Returns collection {name, title, url}, ${LIST}. ${STORE} ${DEAL} Captured 2026-11-26: deals-centre on nofrills listed 329 products; President's Choice The Decadent Milk Chocolate Chips 270 g at 5.00 CAD, was 5.50, deal "SAVE $0.50" with expiry_date 2026-12-02. An unknown collection is a charged 404. Costs 1 credit. ${BILL} ${SLOW}`,
    {
      collection: z.string().max(600)
        .describe("Required. A collection name from the site's links (deals-centre, black-friday, no-name, pc-value, new-arrivals ...) or a collection link."),
      ...listing,
    },
    post("collection"),
  );

  server.tool(
    "get_pcexpress_product",
    `One product of ${FIRST} by code or link: source (page or search), code, article_number, unit_of_measure, gtin, name, brand, description, size, url, images, breadcrumbs, price, price_unit, was_price, member_only_price, comparison_prices, unit_price, price_type, price_expiry_date, deal_price, deal, promotions, deposit, stock_status, shoppable, sold_by, weighted, min_quantity, max_quantity, badges, ingredients, nutrition {serving_size, nutrients, micronutrients}, variants, store, market, notes. ${STORE} ${DEAL} Stock status is as PC Express gives it. When the product page does not answer, the item is answered from the search listing for its article number (source search: price, deal, unit price, badges; no gtin, ingredients or nutrition) at 1 credit. Captured 2026-11-26: 20812144001_EA on superstore, Large Size Eggs 12 Pack, gtin 00060383664145, 3.93 CAD, unit price $0.33/1ea, stock_status ok. No review text. An unknown code is a charged 404. Costs 5 credits (1 with source search). ${BILL} ${SLOWER}`,
    {
      code: z.string().max(40).optional()
        .describe("A product code (items[].code: article number and unit, e.g. 20812144001_EA). Send code or url."),
      url: z.string().max(2000).optional()
        .describe("A product link on any of the ten banner sites instead of code (its site sets the banner)."),
      banner,
      language,
    },
    post("product"),
  );

  server.tool(
    "get_pcexpress_stores",
    `The pickup stores one banner of ${FIRST} lists, filtered by city, postal code start or province, or nearest a latitude and longitude. Returns banner, language, location, filters_applied, total, matched, count, stores [{store_id, name, banner, banner_name, location_type, pickup_type, shoppable, address, city, province, postal_code, latitude, longitude, phone, time_zone, today {date, hours, open_now}, minimum_order, departments, url, distance_km}], market, notes. store_id is the input of get_pcexpress_store (store ids do not change prices: priced tools use the banner's default store). Owner names some franchised stores carry are left out. Captured 2026-11-26: superstore in Winnipeg, 8 of 120 stores. Costs 1 credit. ${BILL} ${SLOWER}`,
    {
      banner,
      city: z.string().max(80).optional().describe("Stores whose city contains this (accents and case ignored), e.g. Winnipeg."),
      postal_code: z.string().max(10).optional().describe("Stores whose postal code starts with this (T5, M5V, M5V 3L9)."),
      province: z.string().max(40).optional().describe("A province code or name (e.g. BC)."),
      latitude: z.number().optional().describe("With longitude: stores nearest this point, with distance_km."),
      longitude: z.number().optional().describe("With latitude."),
      shoppable_only: z.boolean().optional().describe("Only stores that take PC Express orders."),
      limit: z.number().int().min(1).max(400).optional()
        .describe("Stores to return, 1-400 (default 20 near a point, else all)."),
      language,
    },
    post("stores"),
  );

  server.tool(
    "get_pcexpress_store",
    `One store of ${FIRST} by store id: every get_pcexpress_stores field plus store_phone, pharmacy_phone, store_hours, pharmacy_hours, medical_clinic_hours, optical_hours, holiday_hours (7 dated days each, as PC Express lists them; clinic hours by weekday) and services [{name, phone}]. Owner and manager names are left out. Captured 2026-11-26: store 1517, Real Canadian Superstore Marine Drive, Vancouver BC. An unknown store is a charged 404. Costs 5 credits. ${BILL} ${SLOWER}`,
    {
      store_id: z.union([z.string().max(10), z.number().int()])
        .describe("Required. A store id from get_pcexpress_stores, sent as a string: leading zeros count (e.g. \"1517\", \"0559\")."),
      banner,
      language,
    },
    post("store"),
  );

  server.tool(
    "get_pcexpress_suggestions",
    `The search terms ${FIRST} suggests for what a shopper has typed, in its order. Returns banner, language, query, count, suggestions, market, notes. Captured 2026-11-26: "egg" on superstore: Eggs, Egg Noodles, Egg Whites, Eggo, Egg Nog, Eggplant. Costs 1 credit. ${BILL} ${SLOWER}`,
    {
      query: z.string().min(1).max(100).describe("What a shopper has typed (required, e.g. egg)."),
      banner,
      language,
    },
    post("suggestions"),
  );
}
