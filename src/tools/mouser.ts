import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/mouser.ts (Mouser Electronics, mouser.com, the electronic component distributor;
// us USD + uk GBP). 2 credits per call on every tool. Rules the backend enforces and zod here does not: search takes
// query, category or both; product takes mouser_part_number or url (a number with a "/" needs the url); manufacturer
// takes manufacturer or url; categories serves us only. No zod `.default()`: the MCP SDK would post a defaulted field
// on every call.

const SITE =
  "Mouser Electronics (mouser.com, the electronic component distributor), markets us (mouser.com, USD, default) and uk (mouser.co.uk, GBP), prices as the storefront shows them to a visitor who is not signed in, per piece; stock as the page shows it when fetched";
const BILL = "Costs 2 credits; credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const SLOW = "Mouser pages are slow: usually 30 to 160 s, up to about 240 s; allow a client timeout of at least 300 s.";
const ITEM =
  "position, mouser_part_number, mfr_part_number, manufacturer, manufacturer_slug (the input of get_mouser_manufacturer), description, url (the input of get_mouser_product), image, datasheet_url, currency, availability (In Stock, On Order, Non-Stocked, Not Available ...), in_stock_quantity, on_order_quantity, on_order [{quantity, expected, expected_date}], factory_lead_time_weeks, lifecycle (e.g. End of Life, when Mouser marks it), price_breaks [{packaging (Cut Tape, Reel, MouseReel or null), quantity, unit_price}], minimum_order_quantity, order_multiple, reel_quantity, mousereel_available, has_alternative_packaging";
const country = z.enum(["us", "uk", "gb"]).optional().describe("us (default: mouser.com, USD) or uk (mouser.co.uk, GBP; gb is accepted too).");

export function registerMouserTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/mouser/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_mouser",
    `Search ${SITE}, by keyword, manufacturer part number or Mouser part number, within a category or across the catalog, 25 parts a page in Mouser's own order (no sort is offered). Returns country, currency, query, category, redirected_to ({type: product, mouser_part_number, url} when Mouser answers with a product page; then items holds that part), page, page_size, heading, total, total_pages, has_more, count, items [{${ITEM}}], categories [{name, category, url, subcategories [{name, category, url, product_count}]}] (keyword searches), manufacturers [{name, count}] (keyword searches), facets [{name, values}] (category listings), breadcrumbs, note. Search rows list the breaks the row shows; get_mouser_product returns the full price table. A keyword with no parts returns total 0; an unknown category is a charged 404. Captured 2026-11-28: LM7805 matched 33 parts on 2 pages. ${BILL} ${SLOW}`,
    {
      query: z.string().min(1).max(200).optional().describe("Keywords, a manufacturer part number or a Mouser part number, e.g. 'LM7805'. Send query, category or both."),
      category: z.string().min(2).max(500).optional()
        .describe("A Mouser category path (categories[].category of get_mouser_categories or of a keyword search), e.g. 'semiconductors/integrated-circuits-ics/power-management-ics/voltage-regulators-voltage-controllers/linear-voltage-regulators', or a Mouser category link."),
      page: z.number().int().min(1).max(200).optional().describe("Results page, 1-based, 25 parts per page, up to page 200 (default 1)."),
      country,
    },
    post("search"),
  );

  server.tool(
    "get_mouser_product",
    `One part of ${SITE}, by Mouser part number or the url of a search row (a Mouser part number with a "/" does not open by number: pass the row's url). Returns mouser_part_number, requested_mouser_part_number, mfr_part_number, manufacturer, manufacturer_slug, name, description, url, image, datasheet_url, price (unit price at the lowest quantity break), availability, in_stock, in_stock_quantity, stock_note, on_order_quantity, on_order [{quantity, expected, expected_date}], factory_lead_time_weeks, minimum_order_quantity, order_multiple, full_reel_quantity, price_table [{heading (e.g. Full Reel (Order in multiples of 2500), null for the leading group), order_multiple, breaks [{quantity, unit_price, extended_price}]}], packaging, rohs_compliant, lifecycle, specifications [{name, value}], documents [{type, title, url}] (datasheets, product change notices), compliance {ushts, mxhts, eccn, ...}, country_of_origin, assembly_country_of_origin, country_of_diffusion, breadcrumbs, category, note. An unknown part number is a charged 404. Captured 2026-11-28: 595-NE555P, Texas Instruments NE555P, 0.59 USD at 1 piece, 26-week factory lead time. ${BILL} ${SLOW}`,
    {
      mouser_part_number: z.string().min(4).max(70).optional().describe("The Mouser part number (items[].mouser_part_number), e.g. '595-NE555P'. Send mouser_part_number or url."),
      url: z.string().max(600).optional().describe("The exact Mouser product link of a search row (items[].url, with its qs= part), instead of mouser_part_number."),
      country,
    },
    post("product"),
  );

  server.tool(
    "get_mouser_categories",
    `The electronic components category tree of ${SITE}, read from mouser.com (us only; its paths work unchanged in a uk search). Returns country, currency, count, subcategory_count, categories [{name, category, url, groups [{name, category, url, subcategories [{name, category, url, product_count}]}]}], note. Any category value is the category input of search_mouser. ${BILL} ${SLOW}`,
    {
      country: z.enum(["us"]).optional().describe("us (the default and the only value served)."),
    },
    post("categories"),
  );

  server.tool(
    "get_mouser_manufacturer",
    `One manufacturer's profile on ${SITE}, by Mouser slug or link. Returns country, currency, name, slug, url, logo, ecia_authorized, sections [{name, url}], products_url, newest_products_url, categories [{name, category (the category input of search_mouser), url}], note. An unknown slug is a charged 404. ${BILL} ${SLOW}`,
    {
      manufacturer: z.string().min(2).max(200).optional().describe("The manufacturer's Mouser slug (items[].manufacturer_slug), e.g. 'texas-instruments'. Send manufacturer or url."),
      url: z.string().max(300).optional().describe("A Mouser manufacturer link (https://www.mouser.com/manufacturer/<slug>/), instead of manufacturer."),
      country,
    },
    post("manufacturer"),
  );
}
