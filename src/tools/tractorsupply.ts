import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/tractorsupply.ts (tractorsupply.com, US only, so no tool
// takes country). Cross-field rules the backend enforces and zod here does not: search,
// product, category, brand and deals take store or zip (one of them, not both); product
// takes item_number or url (not both); store-prices and store-stock take stores, store or
// zip (stores and zip not both), limit only with zip; list tools take at most 6 filters in
// all (brand, on_sale, new, pickup, rating and filters). No zod `.default()`: the MCP SDK
// would post a defaulted field on every call.

const SORTS = ["popular", "rating", "name_asc", "name_desc", "price_asc", "price_desc", "recent", "new_arrivals"] as const;
const PAGE_SIZES = [24, 48, 96, 200] as const;

const NAME = "Tractor Supply (tractorsupply.com, the US rural lifestyle retailer)";
const CHARGES = "Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const ONE = `Costs 1 credit (credits_used is what was charged). ${CHARGES}`;
const PRICED =
  "Tractor Supply prices by store, so store (a store number) or zip (the nearest store Tractor Supply lists for it) is required: priced_for {store_id, zone (the store's price zone), city, state, from (store or zip), zip} names the store the prices are for. Tractor Supply's terms note that prices may vary in different geographic markets, so the same item can be priced differently at different stores.";
const NOT_AVAILABLE =
  "Not available: review or Q&A text (rating and review_count only), search suggestions, the weekly ad, a clearance list, price history (poll and store the answers), Neighbor's Club member prices, live chick availability, Petsense, checkout.";
const ITEM =
  "position, item_number (the size the item's link names: the input of get_tractorsupply_product, get_tractorsupply_store_prices, get_tractorsupply_store_stock, get_tractorsupply_fulfillment, get_tractorsupply_promotions), part_number (the product's), name, brand, url, image, price, price_min and price_max (across sizes), was_price, on_sale, clearance, discount_percent (computed by Scavio from was_price), savings_up_to {amount, percent}, currency (USD), unit_price {amount, unit}, badge, rating, review_count, availability (Online In Stores, Online Only, In Stores Only), pickup, standard_delivery, same_day_delivery, vendor_part_number, variant_count, item_numbers";
const LIST = `country, currency, store_requested, zip_requested, priced_for, total, page, page_size, total_pages, count, sort, brand, on_sale, new, pickup, rating, filters, corrected_query, relaxed_query, breadcrumbs [{name, category_id}], items (${ITEM}), facets [{name, id, values [{label, count, filter (send it in filters)}]}], notes`;

const storeNo = z.union([z.string().min(1).max(8), z.number().int().positive()]);
const store = storeNo
  .describe("A Tractor Supply store number (get_tractorsupply_stores lists them, e.g. \"1933\" Glendive MT). Prices are that store's.");
const zip = z.string().min(5).max(10)
  .describe("A 5-digit US ZIP code (e.g. \"59330\"): the nearest store Tractor Supply lists for it is used (priced_for names it).");
const itemNumber = z.union([z.string().min(4).max(20), z.number().int().positive()])
  .describe("A Tractor Supply item number (items[].item_number, 7 digits, e.g. \"2340147\").");
const page = z.number().int().min(1).max(100).optional().describe("Page (1-100).");
const pageSize = z.number().int().optional()
  .describe(`Products per page: ${PAGE_SIZES.join(", ")} (default 24), as Tractor Supply lists them.`);
const sort = z.enum(SORTS).optional()
  .describe("popular (default, Most Popular), rating, name_asc, name_desc, price_asc, price_desc, recent or new_arrivals: Tractor Supply's sort menu.");
const brandFilter = z.string().min(1).max(80).optional()
  .describe("Only this brand (the Brand facet's value, e.g. Purina, Producer's Pride).");
const onSale = z.boolean().optional().describe("Only products on sale.");
const isNew = z.boolean().optional().describe("Only new arrivals.");
const pickup = z.boolean().optional().describe("Only products the store offers for pickup.");
const rating = z.number().int().min(1).max(4).optional().describe("Only products rated at least this many stars (1-4).");
const filters = z.array(z.string().min(4).max(220)).max(6).optional()
  .describe('Facet filters: facets[].values[].filter values from an earlier answer, sent exactly as given (e.g. "2bb%3A%2250%20lb%22"). At most 6 in all with brand, on_sale, new, pickup and rating.');
const storeOrZip = {
  store: store.optional().describe("A Tractor Supply store number (e.g. \"1933\"): prices are that store's. Send store or zip."),
  zip: zip.optional().describe("A 5-digit US ZIP code (e.g. \"59330\"): prices are for the nearest store Tractor Supply lists for it. Send store or zip."),
};
const listShape = { page, page_size: pageSize, sort, brand: brandFilter, on_sale: onSale, new: isNew, pickup, rating, filters, ...storeOrZip };
const { brand: _brand, ...brandListShape } = listShape;
const { on_sale: _onSale, new: _new, ...dealsListShape } = listShape;
const multiStore = {
  item_number: itemNumber,
  stores: z.array(storeNo).min(1).max(25).optional()
    .describe("Up to 25 Tractor Supply store numbers, e.g. [\"1933\", \"1923\"]. Send stores, store or zip."),
  store: store.optional().describe("One Tractor Supply store number (instead of stores)."),
  zip: zip.optional().describe("A 5-digit US ZIP code: the stores nearest it (instead of stores)."),
  limit: z.number().int().min(1).max(10).optional()
    .describe("With zip: how many of the nearest stores (1-10, default 5)."),
};

export function registerTractorsupplyTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/tractorsupply/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_tractorsupply",
    `Search ${NAME} by keywords, an item number or a UPC, priced for one store, sorted (popular, rating, name, price, recent, new arrivals), filtered (brand, on sale, new, pickup, rating, any facet) and paged (24-200 a page). ${PRICED} Returns query, redirected_to {type, url, category_id} (Tractor Supply sends some searches to a category page: the list is that category's), category_id, ${LIST}. ${NOT_AVAILABLE} ${ONE}`,
    {
      query: z.string().min(1).max(200).describe("Keywords (layer pellets), a Tractor Supply item number or a UPC."),
      ...listShape,
    },
    post("search"),
  );

  server.tool(
    "get_tractorsupply_product",
    `One ${NAME} product or size in full by item number or link, priced for one store. ${PRICED} Returns country, currency, store_requested, zip_requested, priced_for, item_number, part_number, type (item: one size; product: every size), name, brand, url, image, price, price_max (across sizes), was_price, was_price_max, pickup_price (where Tractor Supply gives a separate pickup price), price_type (regular, sale, clearance), on_sale, discount_percent (computed by Scavio from was_price), savings_up_to, mapp {type, min, max} (the manufacturer's minimum advertised price where Tractor Supply flags it; reported as given; flagged items can still show different prices at different stores), rating, review_count, availability, upc, vendor_part_number, buyable, description, specifications [{name, value}], options [{name, value}], variants [{item_number, name, vendor_part_number, buyable}], parent {part_number, url}, breadcrumbs [{name, url, category_id}], fulfillment {store_pickup, standard_delivery, same_day_delivery, truck_delivery, shipping_restricted_states}, hazmat, country_of_origin, attachments, promotions [{name, description, type, kind, site_wide, starts, ends}], notes. An unknown item is a charged 404. Costs 1 credit (2 on the first call for a store not yet looked up; credits_used is what was charged). ${CHARGES}`,
    {
      item_number: itemNumber.optional(),
      url: z.string().min(10).max(600).optional()
        .describe("A tractorsupply.com product link (items[].url), instead of item_number."),
      ...storeOrZip,
    },
    post("product"),
  );

  server.tool(
    "get_tractorsupply_store_prices",
    `One ${NAME} item's price at up to 25 stores, or at the stores nearest a ZIP, as Tractor Supply shows it for each store (prices follow each store's price zone): country, currency, item_number, name, url, zip_requested, count, priced_count, price_range {min, max} (across the stores asked), stores [{store_id, name, city, state, zone, distance_miles, unknown_store, price, price_max, was_price, pickup_price, price_type, on_sale, discount_percent, mapp}], failed_stores, notes. An unknown item is a charged 404. Costs 1 credit per 5 lookups (each store's price, a store's details when not yet known, the item): 25 new stores cost 11. ${CHARGES}`,
    multiStore,
    post("store-prices"),
  );

  server.tool(
    "get_tractorsupply_store_stock",
    `Units on hand as ${NAME} reports them, for one item at up to 25 stores or at the stores nearest a ZIP, with stock in transit and the date Tractor Supply gives for its pickup: country, item_number, zip_requested, count, in_stock_count, total_units, in_transit_units, stores [{store_id, name, city, state, distance_miles (with zip), units, status, in_stock, in_transit [{units, pickup_date, source}]}], unknown_stores, failed_stores, not_reported, notes. Stock is as Tractor Supply reports it, not a promise. An unknown item is a charged 404. Costs 1 credit (10 stores per lookup). ${CHARGES}`,
    multiStore,
    post("store-stock"),
  );

  server.tool(
    "get_tractorsupply_fulfillment",
    `How one ${NAME} item can reach a ZIP from one store, as Tractor Supply gives it: country, item_number, store_id, store {name, city, state}, zip, quantity, pickup {units (at the store), status, in_transit}, delivery_options [{type (standard_delivery, same_day_delivery, ship_to_store), name, delivery_date, order_by (cut-off, UTC), order_by_local, time_zone}], same_day_delivery, ship_to_store, standard_delivery, notes. ${ONE}`,
    {
      item_number: itemNumber,
      store,
      zip: zip.describe("The delivery ZIP code (5 digits, e.g. \"59330\")."),
      quantity: z.number().int().min(1).max(999).optional().describe("Quantity (default 1)."),
    },
    post("fulfillment"),
  );

  server.tool(
    "get_tractorsupply_stores",
    `The ${NAME} stores nearest a US ZIP code, in Tractor Supply's order: country, zip, count, stores [{position, store_id, name, address {line1, city, state, zip}, phone, latitude, longitude, distance_miles, time_zone, zone (the store's price zone), hours [{day, open, close, closed}], hours_text, services (propane refill and exchange, trailer rental, PetVet clinic, pet wash, garden center, ...), store_pickup, aisle_locations, events [{title, starts, ends, start_time, end_time}]}], services_nearby, notes. A ZIP with no store is a charged 404. ${ONE}`,
    {
      zip: zip.describe("A 5-digit US ZIP code (e.g. \"59301\")."),
      limit: z.number().int().min(1).max(10).optional().describe("How many stores (1-10, default 10)."),
    },
    post("stores"),
  );

  server.tool(
    "get_tractorsupply_store",
    `One ${NAME} store by store number: country, store_id, name, address, phone, latitude, longitude, zone (the store's price zone), store_pickup, time_zone, hours, hours_text, services, aisle_locations, events (dated store events), notes. An unknown store number is a charged 404. ${ONE}`,
    { store },
    post("store"),
  );

  server.tool(
    "get_tractorsupply_category",
    `One ${NAME} category's products by link, path, slug or listing id, priced for one store, sorted, filtered and paged. ${PRICED} Returns category, category_id, ${LIST}. A wrong category is a charged 404. ${ONE}`,
    {
      category: z.union([z.string().min(1).max(500), z.number().int().positive()])
        .describe("A Tractor Supply category link or path (/tsc/catalog/poultry-feed), its slug (poultry-feed) or a listing category id (breadcrumbs[].category_id). get_tractorsupply_categories lists them."),
      ...listShape,
    },
    post("category"),
  );

  server.tool(
    "get_tractorsupply_categories",
    `${NAME}'s departments, or one department's or category's categories (two levels): country, parent_id, count, node_count, categories [{tree_id (the input of parent_id), name, url (the input of get_tractorsupply_category), children [...]}], notes. An unknown tree id is a charged 404. ${ONE}`,
    {
      parent_id: z.union([z.string().min(1).max(20), z.number().int().positive()]).optional()
        .describe("A category tree id (categories[].tree_id, e.g. \"1004851\"): its categories, two levels. Without it: the departments."),
    },
    post("categories"),
  );

  server.tool(
    "get_tractorsupply_brand",
    `One brand's products on ${NAME}, priced for one store, optionally matching keywords, sorted, filtered and paged. ${PRICED} Returns brand, query, ${LIST}. A brand with no products is a charged 404. ${ONE}`,
    {
      brand: z.string().min(1).max(80)
        .describe("A brand as Tractor Supply names it (items[].brand, e.g. Purina, Producer's Pride, 4health)."),
      query: z.string().min(1).max(200).optional().describe("Only this brand's products matching these keywords."),
      ...brandListShape,
    },
    post("brand"),
  );

  server.tool(
    "get_tractorsupply_deals",
    `${NAME}'s products on sale (type sale, default) or its new arrivals (type new), priced for one store, optionally matching keywords, sorted, filtered and paged. ${PRICED} Returns type, query, ${LIST}. ${ONE}`,
    {
      type: z.enum(["sale", "new"]).optional().describe("sale (default): products on sale; new: new arrivals."),
      query: z.string().min(1).max(200).optional().describe("Only deals matching these keywords."),
      ...dealsListShape,
    },
    post("deals"),
  );

  server.tool(
    "get_tractorsupply_promotions",
    `The promotions ${NAME} lists for one item, with their dates: country, item_number, name, url, count, promotions [{name, description, type, kind (product, shipping), site_wide, starts, ends (null: open-ended)}], notes. Ended promotions are left out. An unknown item is a charged 404. ${ONE}`,
    { item_number: itemNumber },
    post("promotions"),
  );
}
