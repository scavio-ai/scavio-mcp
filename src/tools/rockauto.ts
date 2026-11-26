import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/rockauto.ts (one US catalog, no country). Rules the backend
// enforces and zod here does not: vehicles takes year only with make and model only with make and
// year; categories and parts need make, year, model, engine and carcode together, exactly as
// get_rockauto_vehicles answers them for an engine (RockAuto picks the vehicle by carcode: a
// carcode that answers another vehicle is a 400, not charged); tools takes subcategory only with
// category; ids (carcode, part_type_id, part_key) are digits. No zod `.default()`: the MCP SDK
// would post a defaulted field on every call.

const LANGUAGES = ["en", "es", "fr", "de"] as const;
const CURRENCIES = ["USD", "AUD", "BRL", "GBP", "CAD", "CLP", "EUR", "HUF", "JPY", "MXN", "NZD", "NOK", "PLN", "SEK", "CHF"] as const;

const FIRST = "RockAuto (rockauto.com, the online auto parts catalog based in Madison, Wisconsin)";
const NAME = "RockAuto";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Prices are RockAuto's, in the requested currency as RockAuto converts them for display (currency is echoed); shipping is not included (RockAuto prices it per warehouse in the cart).";
const NO_SORT = "RockAuto offers no sort and no paging on these lists: items are in RockAuto's own order.";
const ITEM =
  "position, brand, part_number, description, part_type, part_type_id, notes (RockAuto's fitment notes), tier (RockAuto's tier label, e.g. Economy, Daily Driver, Premium), price, price_text (as printed), price_per (e.g. Each), core_charge, pack_size, total, pack_options [{pack_size, price_each, total, selected}], currency, out_of_stock, closeout, closeout_text, non_stock_text, shipping_delay_days, remaining, remaining_text, popular (RockAuto's most-popular mark), fits_markets (us, ca, mx), alternate_numbers (OE / alternate numbers it replaces), image, info_url, part {part_key, carcode, part_type_id} (the input of get_rockauto_part)";
const NOT_AVAILABLE =
  "Not available: shipping costs (RockAuto prices shipping per warehouse in its cart), checkout, price history (poll and store the answers).";

const id = (example: string, what: string) =>
  z.union([z.string().min(1).max(10), z.number().int().nonnegative()]).describe(`${what} (digits, e.g. ${example}).`);
const name = (max: number) => z.string().min(1).max(max);

const language = z.enum(LANGUAGES).optional()
  .describe("en (default), es, fr or de: RockAuto's page language (names, notes, tiers and labels; part numbers and prices do not change).");
const currency = z.enum(CURRENCIES).optional()
  .describe("USD (default), AUD, BRL, GBP, CAD, CLP, EUR, HUF, JPY, MXN, NZD, NOK, PLN, SEK or CHF: RockAuto's display currency (one US catalog, prices converted by RockAuto).");

const vehicle = {
  make: name(60).describe("Required. Make as get_rockauto_vehicles answers it (engines[].make, e.g. HONDA)."),
  year: z.number().int().min(1900).max(2100).describe("Required. Model year (engines[].year, e.g. 2010)."),
  model: name(80).describe("Required. Model as get_rockauto_vehicles answers it (engines[].model, e.g. ACCORD)."),
  engine: name(80).describe("Required. Engine as get_rockauto_vehicles answers it (engines[].engine, e.g. 2.4L L4)."),
  carcode: id("1444945", "Required. RockAuto's vehicle code: engines[].carcode from get_rockauto_vehicles, or a vehicle's carcode from get_rockauto_suggestions / get_rockauto_resolve. RockAuto picks the vehicle by carcode: one that answers another vehicle than make / year / model / engine is a 400, not charged"),
};

export function registerRockautoTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rockauto/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_rockauto_vehicles",
    `The vehicle catalog of ${FIRST}, one level at a time: no input = makes [{make, name, markets, url}]; make = years [{year, markets, url}]; make + year = models [{model, markets, url}]; make + year + model = engines [{make, year, model, engine, carcode, markets, url}]. Returns level, language, count. markets are the vehicle markets RockAuto lists (us, ca, mx). An engine's make, year, model, engine and carcode are the vehicle inputs of get_rockauto_categories and get_rockauto_parts: this is where the carcode comes from. Captured 2026-11-26: HONDA 2010 ACCORD has two engines, 2.4L L4 (carcode 1444945) and 3.5L V6 (carcode 1444944). An unknown make, year or model is a charged 404. ${ONE}`,
    {
      make: name(60).optional().describe("No make: every make. A make (e.g. HONDA): its years."),
      year: z.number().int().min(1900).max(2100).optional().describe("With make: that year's models (e.g. 2010)."),
      model: name(80).optional().describe("With make and year: the model's engines, each with its carcode (e.g. ACCORD)."),
      language,
    },
    post("vehicles"),
  );

  server.tool(
    "get_rockauto_categories",
    `One vehicle's part categories on ${FIRST}. Without category: categories [{category (the input), name (in the page language), url}]; with category: part_types [{part_type_id (the input of get_rockauto_parts), name, category, url}]. Returns level, language, vehicle {make, year, model, engine, carcode} (as RockAuto answered it), count. Captured 2026-11-26: the 2010 HONDA ACCORD 2.4L L4 lists 30 part types under Brake & Wheel Hub (Brake Pad is 1684). The vehicle is checked against carcode: a carcode that answers another vehicle is a 400, not charged; an unknown category is a charged 404. ${ONE}`,
    {
      ...vehicle,
      category: name(80).optional()
        .describe("A category from categories[].category (e.g. Brake & Wheel Hub): its part types. Without it: the vehicle's categories."),
      language,
    },
    post("categories"),
  );

  server.tool(
    "get_rockauto_parts",
    `Every brand's listing for one part type on one vehicle on ${FIRST}: language, currency, vehicle, category, category_name, part_type {part_type_id, name}, count, items [${ITEM}], notes. ${NO_SORT} ${PRICES} Captured 2026-11-26: brake pads (1684) for the 2010 HONDA ACCORD 2.4L L4 listed 114 items, from 10.23 USD (an Economy tier closeout); NGK spark plug 97390 for the same car was 4.79 EUR each, or 4.57 EUR each in a pack of 4, with currency EUR. Large part types (brake pads) can take 80-100 s. ${NOT_AVAILABLE} ${ONE}`,
    {
      ...vehicle,
      category: name(80).describe("Required. The category (categories[].category from get_rockauto_categories, e.g. Brake & Wheel Hub)."),
      part_type_id: id("1684", "Required. part_types[].part_type_id from get_rockauto_categories (1684 = Brake Pad)"),
      part_type: name(80).optional().describe("Optional part type name (part_types[].name); RockAuto reads the part type by its id."),
      language,
      currency,
    },
    post("parts"),
  );

  server.tool(
    "search_rockauto",
    `Part number and interchange search on ${FIRST}: matches across brands, including the OE and interchange numbers RockAuto maps to its listings. Returns language, currency, part_number, brand, part_type_id, search_label, limited and limited_notice (RockAuto's "Results may be limited" notice), count, items [${ITEM}], notes. ${NO_SORT} No match is an empty list. ${PRICES} Captured 2026-11-26: BP1084 matched one BOSCH brake pad (QuietCast Semi-Metallic) at 29.79 USD; with language es and currency MXN the same part read "Pastilla de Freno" at 583.71 MXN. ${ONE}`,
    {
      part_number: z.string().min(1).max(60)
        .describe("Required. A part number: RockAuto's brands' numbers and the OE / interchange numbers RockAuto maps to them (e.g. BP1084, 41-110, PH7317, 0986494104)."),
      brand: name(60).optional().describe("Only this brand (a get_rockauto_brands value, e.g. BOSCH)."),
      part_type_id: id("1684", "Only this part type (an id from get_rockauto_categories part_types, get_rockauto_brands with include_part_types, or an item's part_type_id)").optional(),
      language,
      currency,
    },
    post("search"),
  );

  server.tool(
    "get_rockauto_brand",
    `One brand's parts of one part type on ${FIRST} (not tied to a vehicle): language, currency, brand, part_type_id, search_label, limited, limited_notice, count, items [${ITEM}], notes. RockAuto lists at most 50 rows here, with no paging or sort. ${PRICES} Captured 2026-11-26: BOSCH brake pads (1684) returned 50 rows with limited true, from 12.99 USD. ${ONE}`,
    {
      brand: name(60).describe("Required. A brand from get_rockauto_brands (RockAuto's brand name, e.g. BOSCH)."),
      part_type_id: id("1684", "Required. A part type id (get_rockauto_brands with include_part_types, or part_types from get_rockauto_categories)"),
      language,
      currency,
    },
    post("brand"),
  );

  server.tool(
    "get_rockauto_brands",
    `The brand list and part groups of ${FIRST}: language, count, brands (the input of get_rockauto_brand and search_rockauto's brand), part_groups, part_type_count and, with include_part_types, part_types [{part_type_id, name}]. Captured 2026-11-26: 568 brands. ${ONE}`,
    {
      include_part_types: z.boolean().optional().describe("true adds RockAuto's part type list (about 5,500 ids and names). Default false."),
      language,
    },
    post("brands"),
  );

  server.tool(
    "get_rockauto_part",
    `One part's detail page on ${FIRST}, by the part keys of an item (items[].part from get_rockauto_parts, search_rockauto, get_rockauto_brand or get_rockauto_tools): brand, part_number, title, part {part_key, carcode, part_type_id}, price, price_text, price_per, core_charge, pack_size, total, pack_options, currency, out_of_stock, description, specifications [{name, value}], oe_numbers (OEM / interchange numbers), alternate_numbers, warranty (as given), warranty_url, disclaimer, more_information (the manufacturer's text), images. ${NAME}'s part detail page is in English in every language (no language input); the price is in the requested currency. Captured 2026-11-26: BOSCH BP1084 at 29.79 USD with 14 specifications and a 12 Months warranty. ${ONE}`,
    {
      part_key: id("6129207", "Required. items[].part.part_key"),
      part_type_id: id("1684", "Required. items[].part.part_type_id"),
      carcode: id("0", "items[].part.carcode (0 from search_rockauto, get_rockauto_brand and get_rockauto_tools)").optional(),
      currency,
    },
    post("part"),
  );

  server.tool(
    "get_rockauto_suggestions",
    `The search box suggestions of ${FIRST} for typed text: query, count, vehicles [{year, make, model, engine, carcode, markets, part_type_id, part_type, category, text}], part_types [{part_type_id, name, category}] (need a vehicle), tools [{part_type_id, name, category, subcategory}] (tools and universal parts), help [{question, answer_preview, url}]. Suggestions come back in lower case as RockAuto returns them; a vehicle with carcode is an input of get_rockauto_categories and get_rockauto_parts. Part numbers are not suggested (use search_rockauto). Captured 2026-11-26: "2015 ford f-150" suggested four engines, each with its carcode. ${ONE}`,
    {
      query: z.string().min(2).max(100)
        .describe("Required. Typed text: a vehicle (2015 ford f-150), a part type (brake pad) or a tool. At least 2 characters."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_rockauto_resolve",
    `Free text to a vehicle on ${FIRST}: how RockAuto's search box reads "2010 honda accord brake pads". Returns query, count, matches [{year, make, model, engine, carcode, markets, part_type_id, part_type, category, text, leftover (the words RockAuto did not interpret)}]. A match without carcode needs get_rockauto_vehicles (make, year, model) for its engines. Captured 2026-11-26: "2010 honda accord brake pads" matched the 2010 honda accord and accord crosstour, leftover "brake pads", no engine yet. ${ONE}`,
    {
      query: z.string().min(3).max(150)
        .describe("Required. Free text naming a vehicle and, optionally, a part (e.g. 2010 honda accord brake pads). At least 3 characters."),
    },
    post("resolve"),
  );

  server.tool(
    "get_rockauto_tools",
    `The tools and universal parts catalog of ${FIRST}, one level at a time: no input = categories [{category, name, url}]; category = subcategories [{category, subcategory, name, url}]; category + subcategory = part_types [{part_type_id, name, url}]; part_type_id = that part type's listing: category, subcategory, part_type, items [${ITEM}]. Returns level, language, currency, count, notes. ${NO_SORT} ${PRICES} Captured 2026-11-26: Brake & Wheel Hub > Tool lists part types such as Brake Bleeder Kit and Bearing Puller. ${ONE}`,
    {
      category: name(80).optional().describe("A tools category (categories[].category, e.g. Brake & Wheel Hub): its subcategories."),
      subcategory: name(80).optional().describe("With category: a subcategory (subcategories[].subcategory, e.g. Tool): its part types."),
      part_type_id: id("1000891", "A tools / universal part type id (part_types[].part_type_id, or get_rockauto_suggestions tools[]): its listing").optional(),
      language,
      currency,
    },
    post("tools"),
  );

  server.tool(
    "get_rockauto_promotions",
    `The promotions and manufacturer rebates page of ${FIRST}: language, currency (USD: amounts as printed), read_date, count, promotions [{name, badge, title, offer, expires_text (as printed, e.g. Offer expires 12/31/26), expires (that date, YYYY-MM-DD), shown (false when the page hides the offer), link_text, link_url (the rebate form)}], recently_expired (RockAuto's list), notes. The page can still carry offers whose printed date has passed: dates are as given, with the read date. RockAuto publishes no coupon codes. Captured 2026-11-26: 8 promotions, among them an AutoMeter rebate "Get Up To $150 CASH BACK!" expiring 2026-12-31. ${ONE}`,
    { language },
    post("promotions"),
  );
}
