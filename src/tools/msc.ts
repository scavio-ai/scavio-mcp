import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/msc.ts (MSC Industrial Supply, mscdirect.com, the US metalworking and MRO
// distributor; United States, USD). Rules the backend enforces and zod here does not: category takes navid or url;
// product takes msc_number or url. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "MSC Industrial Supply (mscdirect.com, the US metalworking and MRO distributor), United States, prices in USD: the Web Price MSC shows to a visitor who is not signed in (account pricing may differ)";
const BILL =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW = `${BILL} MSC pages are slow: usually 30 to 120 s, up to about 240 s; allow a client timeout of at least 300 s.`;
const QUICK = `${BILL} Usually 5 to 40 s; allow a client timeout of at least 180 s.`;
const ORDER =
  "price (the Web Price as MSC shows it), price_text, price_unit (ea. or per 100), price_per_quantity (the quantity price is for: 1 or 100), unit_price (price / price_per_quantity, computed by Scavio), order_unit (what one order unit is where MSC states it, e.g. (1) 100 Pack), minimum_order_quantity, order_multiple (Enter in multiples of N)";
const ITEM = `position, msc_number (what get_msc_product takes), name, subtitle, brand, mfr_number, url, image, currency, ${ORDER}, minimum_order_price (the order price for minimum_order_quantity units), availability, in_stock, rating, review_count (aggregates), alternative_msc_numbers`;
const LIST =
  `24 products per page, up to page 400. Returns country, currency, page, page_size, sort, total, total_pages, has_more, count, items [{${ITEM}}], categories [{name, navid (what get_msc_category takes), count}], brands [{value, count}] (the 50 with the most items), brand_count, filters {in_stock, made_in_usa, clearance, new_additions, eco_friendly} (item counts), ratings [{stars, count}], attributes [{name, value_count, values [{value, count}]}] (up to 50 values each), note.`;
const NOT_BUILT = "Review text, account pricing, delivery estimates and per-branch stock (MSC does not publish it) are not returned.";

const sort = z.enum(["bestmatch", "price", "price_desc", "itemnumber", "itemnumber_desc", "rating"]).optional()
  .describe("MSC's sort menu: bestmatch (default, Best Match), price (low to high), price_desc (high to low), itemnumber, itemnumber_desc (by MSC#) or rating.");
const page = z.number().int().min(1).max(400).optional()
  .describe("Results page, 1-based, 24 products per page, up to page 400.");

export function registerMscTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/msc/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_msc",
    `Search ${SITE} by keyword, manufacturer part number or MSC#, sorted by best match, price, MSC# or rating. ${LIST} Also query and redirected_to ({type: product, msc_number, url} when MSC answers an MSC# search with the product page; then items holds that product). A keyword with no products returns total 0. Captured 2026-11-28: drill bit matched 132,055 products, the first a Hertel 1/8 inch jobber length drill bit at 1.53 USD each. ${SLOW}`,
    {
      query: z.string().min(1).max(200)
        .describe("Keywords, a manufacturer part number or an MSC#, e.g. 'drill bit' (a search for an MSC# returns that product)."),
      sort,
      page,
    },
    post("search"),
  );

  server.tool(
    "get_msc_category",
    `One category of ${SITE} by navid (categories[].navid of a search, breadcrumbs[].navid of a product) or a category link, sorted by best match, price, MSC# or rating. ${LIST} Also navid, category {name, navid, url} and breadcrumbs [{name, navid, url}] (from the top level down). An unknown navid is a charged not-found. Captured 2026-11-28: navid 2106186 held 51,048 products. ${SLOW}`,
    {
      navid: z.union([z.string().regex(/^\d{4,10}$/), z.number().int().positive()]).optional()
        .describe("An MSC category id (navid): categories[].navid of a search, or breadcrumbs[].navid of a product, e.g. '2106186'. Send navid or url."),
      url: z.string().max(500).optional()
        .describe("Or an mscdirect.com category link carrying navid= (mscdirect.com/browse/...?navid=<navid>)."),
      sort,
      page,
    },
    post("category"),
  );

  server.tool(
    "get_msc_product",
    `One product of ${SITE} by MSC# or link: country, currency, msc_number, requested_msc_number, mfr_number, big_book_page (the item's page in MSC's Big Book catalog), name, subtitle, brand, brand_logo, url, images, ${ORDER}, minimum_order_total (the Total MSC shows for minimum_order_quantity units), availability, in_stock, purchasable, rating, review_count (aggregates), breadcrumbs [{name, navid, url}], category {name, navid}, specifications [{name, value}], country_of_origin, documents [{title, url, format, size}] (manuals, data sheets), compliance {prop65, prop65_warning, notices}, alternative_msc_numbers (the alternates MSC lists), note. ${NOT_BUILT} An unknown MSC# is a charged not-found. Captured 2026-11-28: MSC# 71205678, a Hertel jobber length drill bit, was 1.53 USD each, minimum and multiple of 12 (total 18.36), in stock. ${SLOW}`,
    {
      msc_number: z.string().min(8).max(16).optional()
        .describe("The MSC# (8 digits with its leading zeros: items[].msc_number), e.g. '00647354'. Send msc_number or url."),
      url: z.string().max(500).optional()
        .describe("Or an mscdirect.com product link (mscdirect.com/product/details/<MSC#>)."),
    },
    post("product"),
  );

  server.tool(
    "get_msc_clearance",
    `The Clearance Specials list (list clearance, default) or the Web Specials list (list web_specials) of ${SITE}. Curated lists as MSC publishes them (about 60 items each), not a feed of every discounted item. Returns country, currency, list, name, url, heading, count, items [{position, msc_number, order_number (MSC's order number for the offer), name, label, sale_price, currency, image, url}], note. MSC publishes no end dates on these lists. Captured 2026-11-28: Clearance Specials held 60 items, prices valid for current inventory only. ${QUICK}`,
    {
      list: z.enum(["clearance", "web_specials"]).optional()
        .describe("clearance (default): MSC's Clearance Specials list; web_specials: its Web Specials list."),
    },
    post("clearance"),
  );

  server.tool(
    "get_msc_locations",
    `The locations of MSC Industrial Supply (mscdirect.com): customer fulfillment centers, regional inventory centers, warehouses, customer care and support centers, offices, manufacturing facilities and affiliated companies with their published business phone numbers, narrowed by type, state and location_country. These are MSC's distribution and inventory locations, not pickup stores: MSC has no customer pickup branches by ZIP and publishes no per-branch stock in this data. Returns country, total, type, state, location_country, count, location_types [{type, count}], locations [{name, types, affiliate, address {line1, line2, city, state, zip, country}, phones {toll_free, local, fax, other [{label, number}]}, website}], note. Captured 2026-11-28: 63 locations, 13 of them warehouses and 8 regional inventory centers. ${QUICK}`,
    {
      type: z.string().min(2).max(60).optional()
        .describe("One location type, as MSC names it: Customer Fulfillment Center, Regional Inventory Center, Warehouse, Customer Care Center, Customer Support Center, Shared Services Center, Procurement Office, Manufacturing Facility or Affiliated Company."),
      state: z.string().length(2).optional().describe("One US state (2-letter code), e.g. 'PA'."),
      location_country: z.string().min(2).max(40).optional()
        .describe("One country, as MSC lists it: United States, Canada, Mexico, United Kingdom, Ireland or Asia."),
    },
    post("locations"),
  );
}
