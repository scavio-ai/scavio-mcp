import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/rscomponents.ts (RS Components, rs-online.com, RS Group's electronic and industrial
// component distributor; uk GBP, de EUR, au AUD). 2 credits per call on every tool. Rules the backend enforces and
// zod here does not: product takes stock_number or url (not both); a link picks its own market. RS Americas
// (us.rs-online.com) is not covered. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "RS Components (rs-online.com, RS Group's electronic and industrial component distributor), markets uk (uk.rs-online.com, GBP, default), de (de.rs-online.com, EUR, German text) and au (au.rs-online.com, AUD); prices exclude VAT, as shown to a visitor who is not signed in; stock is the market's own (it differs per market), as the page shows it when fetched. RS Americas (us.rs-online.com) is a different site and is not covered";
const BILL = "Costs 2 credits; credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW = "Usually 15 to 120 s; allow a client timeout of at least 240 s.";
const CARD =
  "position, stock_number (the input of get_rscomponents_product), title, mpn, brand, url, image, category, currency, unit_price (one base_unit), price_display, pack_price (one sales_unit), pack_size, pack_type, sales_unit (EA, PK pack, TU tube, RL reel), base_unit, unit_priced, first_break_qty, stock_status (IN_STOCK, OUT_OF_STOCK, CURRENTLY_UNAVAILABLE ...), in_stock, lifecycle (being_discontinued, being_removed or null), last_stock, has_datasheets, specs [{name, value}]";
const GRID = `20 per page: page, page_size, total, total_pages, has_more, count, items [{${CARD}}] and facets [{name, key, type, values [{value, count}]}] (the site's filters with counts: listed only, RS applies them in the browser, so they cannot be sent back as filters). No sort.`;
const page = z.number().int().min(1).max(500).optional().describe("Results page, 1-500 (20 per page; total_pages says how many the site has; default 1).");
const country = z.enum(["uk", "de", "au", "gb"]).optional()
  .describe("The RS market: uk (uk.rs-online.com, GBP; default), de (de.rs-online.com, EUR, German text) or au (au.rs-online.com, AUD). A link sent as the input picks its own market.");

export function registerRsComponentsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rscomponents/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_rscomponents",
    `Search ${SITE}. By keyword, MPN or RS stock number. ${GRID} Also query, spell_corrected_to and redirected_to (a search the site sends straight to a product, category or brand page returns that page's rows). No results is an empty 200 (charged). Captured 2026-11-28 on uk.rs-online.com: BC547 matched 10 products. ${BILL} ${SLOW}`,
    {
      query: z.string().min(1).max(120).describe("Keywords, a manufacturer part number (MPN) or an RS stock number, e.g. 'BC547'."),
      page,
      country,
    },
    post("search"),
  );

  server.tool(
    "get_rscomponents_product",
    `One product of ${SITE}, by stock number or link: stock_number, rs_stock_number, title, mpn, brand, brand_slug, brand_url, url, currency, prices_include_vat (false), vat_rate_percent, unit_price, unit_price_inc_vat, pack_price, price_breaks [{quantity, unit_price, unit_price_inc_vat, pack_price}], was_price, uom_message (e.g. "Each (In a Pack of 50)"), minimum_order_qty, pack_size, pack_type, sales_unit, base_unit, unit_priced, has_pack_variants, pack_variant {stock_number, url}, rohs_status, country_of_origin, is_new, availability {status, status_code, in_stock, lifecycle, last_stock, quantity, total_available, ship_date, schedule [{quantity, ship_date}], backorder_allowed, orderable} (no lead time in weeks), documents [{title, type, url}], datasheet_url, specs [{name, value}], categories [{name, level, path, url}], images. Alternative products are not on the page and are not returned. An unknown stock number is a charged 404. Captured 2026-11-28: 221-5535, Texas Instruments NE555P, 0.304 GBP a unit (0.365 with VAT) in packs of 50. ${BILL} ${SLOW}`,
    {
      stock_number: z.string().min(3).max(20).optional().describe("The RS stock number (items[].stock_number), with or without the dash: '221-5535', '2215535', '197-7393P'. Send stock_number or url."),
      url: z.string().min(1).max(400).optional().describe("An RS product link (uk, de or au), e.g. 'https://uk.rs-online.com/web/p/timer-circuits/2215535', instead of stock_number."),
      country,
    },
    post("product"),
  );

  server.tool(
    "get_rscomponents_category",
    `One category of ${SITE}, by path or link: path, category {name, breadcrumbs [{name, level, path, url}], is_last_level}, child_categories [{name, path, url, children}], indexable_filters [{name, slug, url}] (the site's own curated filtered listings) and its listing: ${GRID} An unknown category is a charged 404. ${BILL} ${SLOW}`,
    {
      path: z.string().min(1).max(400).describe("A category path as the market writes it (child_categories[].path, categories[].path of a product), e.g. 'semiconductors/power-management-ics/voltage-regulators', or its /web/c/ link."),
      page,
      country,
    },
    post("category"),
  );

  server.tool(
    "get_rscomponents_brand",
    `The brand page of ${SITE}, by brand slug or link: brand {name, slug, logo, url} and its listing: ${GRID} An unknown brand is a charged 404. ${BILL} ${SLOW}`,
    {
      brand: z.string().min(1).max(300).describe("A brand slug (brand_slug of a product, the end of a /web/b/ link), e.g. 'texas-instruments', or its /web/b/ link."),
      page,
      country,
    },
    post("brand"),
  );
}
