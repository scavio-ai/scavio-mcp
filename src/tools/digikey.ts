import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/digikey.ts (DigiKey, digikey.com, the electronic component distributor; us USD,
// ca CAD, de EUR). 2 credits per call; a product looked up by DigiKey part number is held at 4 (2 when it lands
// straight on a digikey.com product page). Rules the backend enforces and zod here does not: search takes query,
// category_id or both (filters only with category_id); product takes url or digikey_part_number. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "DigiKey (digikey.com, the electronic component distributor; digikey.ca CAD and digikey.de EUR by country), prices as DigiKey lists them to a visitor who is not signed in, with price breaks per packaging. Stock is one number for every market, as the page shows it when fetched";
const BILL = "credits_used is what was charged. Failed upstream calls and refused inputs are not charged; a not-found is charged what it spent.";
const SLOW = "Usually 10 to 40 s, up to about 200 s when DigiKey is slow; allow a client timeout of at least 300 s.";
const ITEM =
  "position, product_id, digikey_part_number, digikey_part_number_packaging, mpn, manufacturer, manufacturer_id, description, url, image, datasheet_url, rohs_compliant, quantity_available, stock [{label, quantity}] (DigiKey, factory and marketplace stock as the row lists them), unit_price, pricing [{packaging, min_order_quantity, unit_price, price_breaks [{quantity, unit_price, extended_price}]}], product_status, series, packaging, tariff_note, specs [{id, name, value}]";
const country = z.enum(["us", "ca", "de"]).optional()
  .describe("us (default: digikey.com, USD), ca (digikey.ca, CAD) or de (digikey.de, EUR, German labels, prices without VAT).");

export function registerDigikeyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/digikey/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_digikey",
    `Search ${SITE}. Markets us and de (digikey.ca: use get_digikey_product and get_digikey_categories). With query alone DigiKey answers with its category view (result_type categories): exact_matches [{product_id, mpn, manufacturer, description, url, image, unit_price}] (parts whose manufacturer part number matches) and categories [{id, name, parent, product_count, url}]: search again with category_id and the same query for the product rows. An exact part number can land on one product (result_type product, product as in get_digikey_product). With category_id (a leaf category) it returns that category's rows (result_type products): page 1 of DigiKey's listing, 25 rows in DigiKey's order (later pages are not offered: narrow with query and filters), total, has_more, items [{${ITEM}}], facets and common_filters [{id, name, type, options [{id, name, product_count}]}] (the values filters takes), category, breadcrumbs, applied and filter_check ({<filter id>: applied | not_applied | unknown}). Captured 2026-11-28: LM317 in category 699 with Manufacturer Texas Instruments and In Stock matched 62 parts. Costs 2 credits. ${BILL} ${SLOW}`,
    {
      query: z.string().min(1).max(120).optional().describe("Keywords, a manufacturer part number or a DigiKey part number, e.g. 'LM7805'. Send query, category_id or both."),
      category_id: z.union([z.string().min(1).max(300), z.number().int().positive()]).optional()
        .describe("A leaf category id (categories[].id of a search or of get_digikey_categories, where leaf is true), e.g. '699', or a DigiKey category link; returns that category's product rows, narrowed by query and filters."),
      filters: z.record(z.string(), z.array(z.union([z.string(), z.number()]))).optional()
        .describe('With category_id: {<facet id>: [<option id>, ...]} from facets[] and common_filters[] of a category search, e.g. {"-1": ["296"]} for Manufacturer Texas Instruments, {"-2": ["5"]} for In Stock. Up to 10 filters.'),
      country: z.enum(["us", "de"]).optional().describe("us (default: digikey.com, USD) or de (digikey.de, EUR, German labels, prices without VAT)."),
    },
    post("search"),
  );

  server.tool(
    "get_digikey_product",
    `One product of ${SITE}, by DigiKey product link (items[].url) or DigiKey part number: product_id, digikey_part_numbers, mpn, manufacturer, description, detailed_description, url, images, datasheet_url, lifecycle_status (DigiKey's Part Status), series, is_new_product, normally_stocking, quantity_available, standard_lead_time and standard_lead_time_weeks (the manufacturer's standard lead time as the page states it), pricing [{digikey_part_number, packaging, min_order_quantity, order_multiple, price_breaks [{quantity, unit_price, extended_price}]}], unit_price, vat (de: unit price with and without VAT), standard_package_quantity, marketplace {is_marketplace_only, ships_from_note}, notes, environmental {rohs_status, reach_status, moisture_sensitivity_level, eccn, htsus}, specs, part_number_aliases, category, breadcrumbs, documents [{type, title, url}] (datasheets, PCNs, models), related_parts (DigiKey's "You May Also Be Interested In" list) and substitutes (when DigiKey's page lists them, with DigiKey's substitute type). An unknown product is a charged 404. Captured 2026-11-28: 497-1575-5-ND, STMicroelectronics LM317T, 1.19 USD at 1 piece, Active, 30-week standard lead time. Costs 2 credits by link; a DigiKey part number is held at 4 (DigiKey resolves it through a search page; 2 when it lands straight on a digikey.com product page). ${BILL} ${SLOW}`,
    {
      url: z.string().max(600).optional()
        .describe("A DigiKey product link (items[].url) on digikey.com, digikey.ca or digikey.de; the link's site sets the market. Send url or digikey_part_number."),
      digikey_part_number: z.string().min(2).max(64).optional()
        .describe("A DigiKey part number (items[].digikey_part_number, digikey_part_numbers[]), e.g. '497-1575-5-ND', instead of url."),
      country,
    },
    post("product"),
  );

  server.tool(
    "get_digikey_categories",
    `The product categories of ${SITE}. Without category_id: the top-level categories as DigiKey's product index lists them (total_categories, count, categories [{id, name, url, product_count, new_product_count, leaf, subcategories_listed, subcategories}]; the index carries the full subtree with counts for some of them). With category_id: that category with its subcategories and product counts (category, categories, breadcrumbs). leaf true marks a category whose rows search_digikey returns with category_id. An unknown category id is a charged 404. Costs 2 credits. ${BILL} ${SLOW}`,
    {
      category_id: z.union([z.string().min(1).max(300), z.number().int().positive()]).optional()
        .describe("A category id (categories[].id), e.g. '32', to read its subcategories and product counts; leave out for the top-level categories."),
      country,
    },
    post("categories"),
  );
}
