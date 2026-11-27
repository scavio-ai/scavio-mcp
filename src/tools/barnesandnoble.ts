import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/barnesandnoble.ts (Barnes & Noble, barnesandnoble.com, US only, USD). Rules the
// backend enforces and zod here does not: product and store availability take ean or isbn (check digits verified);
// stores takes near, or latitude and longitude together, not both; category takes path or url, not both; filters
// hold at most 10 values in all. No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE = "Barnes & Noble (barnesandnoble.com, the US bookseller), US only, prices in USD";
const ONE = "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const HEAVY = "Collection, list and deal pages are large: usually 8 to 35 s; allow a client timeout of at least 90 s.";
const PRICE =
  "price is what Barnes & Noble charges a visitor now, original_price the struck-through price when the page shows one. Member prices are not shown to visitors and are not returned.";
const ITEM =
  "position, ean (what get_barnesandnoble_product and get_barnesandnoble_store_availability take), work_id, title, contributors [{name, role}], format, format_detail, edition, series {title, number}, publication_date, sales_rank, price, original_price, on_sale, currency, availability (as given: IN_STOCK, OUT_OF_STOCK, PREORDER ...), rating and rating_count (empty in lists; product carries them), badges (the site's badges, e.g. $3 OFF, Best Seller), image, url";
const GRID = `total (the site's count for the whole list), count, page_size (24), has_more, sort, sort_label, filters, items [${ITEM}], facets [{filter, title, values [{value, label, count}]}], notes. Barnes & Noble shows 24 results per page and the answer holds that first page: narrow with sort and filters. ${PRICE}`;

const country = z.enum(["us"]).optional()
  .describe("us (the only market: barnesandnoble.com serves the United States, prices in USD). Defaults to us.");
const code = z.union([z.string().min(10).max(24), z.number().int().positive()]);
const bookTarget = {
  ean: code.optional()
    .describe("The book's EAN / ISBN-13 (items[].ean, formats[].ean; 978, 979 or Barnes & Noble's 2940 digital EANs) or an ISBN-10 (converted to its 978 EAN), e.g. '9780593135204'. Check digits are verified."),
  isbn: code.optional()
    .describe("Or an ISBN-10 or ISBN-13 (dashes allowed). Send ean or isbn."),
};
const sort = z.enum(["relevance", "bestselling", "newest", "oldest", "price_asc", "price_desc", "title"]).optional()
  .describe("The site's sort menu: relevance (Top Matches, default), bestselling, newest, oldest, price_asc, price_desc, title (A to Z). price_asc puts free eBooks first.");
const filterValue = z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).min(1).max(10)]);
const filters = z
  .object({
    format: filterValue.optional()
      .describe("Format as the site names it: Hardcover, Paperback, eBook, Audiobook, BN Exclusive, Large Print, Audio CD ... (facets[].values[].value)."),
    availability: filterValue.optional()
      .describe("in_stock, preorder, ships_in_1_2_days."),
    price: filterValue.optional()
      .describe("A price band: under_5 (Under $5), 5_10 ($5 - $10), 10_15 ($10 - $15), 15_25 ($15 - $25), 25_50 ($25 - $50), over_50 (Over $50)."),
    subject: filterValue.optional()
      .describe("A subject as the site names it (Fiction, Kids, Social Sciences ...; facets[].values[].value)."),
    age: filterValue.optional()
      .describe("An age range as the site names it (0 - 2 Years, 3 - 5 Years ...)."),
    language: filterValue.optional()
      .describe("A language as the site names it (English, Spanish ...)."),
  })
  .strict()
  .optional()
  .describe("The site's own filters (format, availability, price, subject, age, language): a value or a list of values each, at most 10 values in all. facets in an answer lists the values with their counts.");
const near = z.string().min(1).max(80);

export function registerBarnesandnobleTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/barnesandnoble/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_barnesandnoble",
    `${SITE} keyword search (title, author, series, ISBN or subject), sorted with the site's sort menu and filtered by format, availability, price band, subject, age and language: query, ${GRID} Captured 2026-11-27: project hail mary gave 3101 results (24 listed), the first Project Hail Mary (Deluxe Edition): A Novel at 37 USD, on sale from 40. Usually 2 to 15 s. ${ONE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Keywords: title, author, series, ISBN or subject, e.g. 'project hail mary'."),
      sort,
      filters,
      country,
    },
    post("search"),
  );

  server.tool(
    "get_barnesandnoble_product",
    `One ${SITE} title by EAN / ISBN-13 or ISBN-10: requested_ean, ean, work_id, title, contributors, format, parent_format, edition, publisher, imprint, publication_date, pages, dimensions {height, width, depth} (as the site lists them), language, series, audience_age, run_time, sales_rank, price, original_price, on_sale, currency, available_for_sale, inventory {in_stock, preorder, backorder} (the page's online stock flags), rating, rating_scale_max, rating_count, member_offers (the member offer text the page shows, as given; never a member price), badges, collections [{name, url, path}], categories [{name, url, path}], image, images, url, overview (a short excerpt of the publisher's overview: at most 300 characters, cut at a word; overview_truncated says when it was cut; never book excerpts or sample text), formats [{format, ean, title, price, original_price, on_sale, available_for_sale, requested}] (one EAN per format the page links, not every edition), notes. Review text is not available. ${PRICE} Captured 2026-11-27: Project Hail Mary in hardcover at 32 USD, rated 4.6 from 287 ratings, with 6 formats from the 14.99 USD eBook to the 49.99 USD Audio CD. An unknown EAN is a charged not-found. Usually 2 to 15 s. ${ONE}`,
    { ...bookTarget, country },
    post("product"),
  );

  server.tool(
    "get_barnesandnoble_store_availability",
    `Store pickup availability of one ${SITE} title at the Barnes & Noble stores near a ZIP code, a city or a store number (usually 16 to 32 stores, nearest first): ean, near, near_type, count, available_count, stores [{store_id, name, address {street, location_name (the shopping center, when the site names one), city, state, zip}, phone, hours, distance_miles, ean, eligible, available}], notes. eligible and available are Barnes & Noble's own pickup flags, not unit counts: the site publishes none. Prices are national (the product price). Captured 2026-11-27: EAN 9780439023528 near ZIP 60611 was available for pickup at 28 of 28 stores, the nearest State Street at 0.73 miles. Usually 2 to 15 s. ${ONE}`,
    {
      ...bookTarget,
      near: near
        .describe("Where to check: a US ZIP code ('60611'), a city and state ('Austin, TX') or a Barnes & Noble store number ('2234')."),
      country,
    },
    post("store-availability"),
  );

  server.tool(
    "get_barnesandnoble_stores",
    `The Barnes & Noble stores near a US ZIP code, a city and state or a point, nearest first, each store's public listing: near, latitude, longitude, count, stores [{store_id (what get_barnesandnoble_store takes), name, address {street, location_name, city, state, zip}, phone, latitude, longitude, distance_miles, time_zone, hours, hours_by_day [{day, open, close, text}], holiday_hours [{name, date, open, close, text}], services {cafe, toys_games, vinyl, used_books, electronics}, open_date, events_count, url}], notes. Hours are as the store page writes them (open and close without AM / PM; text gives the page's own wording). Captured 2026-11-27: ZIP 10001 listed 44 stores, the nearest Union Square at 0.81 miles. Usually 2 to 15 s. ${ONE}`,
    {
      near: near.optional()
        .describe("A US ZIP code or a city and state, e.g. '10001' or 'Austin, TX'. Send near, or latitude and longitude."),
      latitude: z.number().min(-90).max(90).optional()
        .describe("Latitude (with longitude), instead of near."),
      longitude: z.number().min(-180).max(180).optional()
        .describe("Longitude (with latitude)."),
      country,
    },
    post("stores"),
  );

  server.tool(
    "get_barnesandnoble_store",
    `One Barnes & Noble store by id: the get_barnesandnoble_stores fields plus corp_name and holiday_hours_text (the store's holiday hours line as given), notes. Captured 2026-11-27: store 2234, Fifth Avenue, New York, NY, open 9-9 every day with a cafe, toys and games and vinyl, closed on Thanksgiving. An unknown store is a charged not-found. Usually 2 to 15 s. ${ONE}`,
    {
      store_id: z.union([z.string().min(1).max(8), z.number().int().positive()])
        .describe("A Barnes & Noble store id (stores[].store_id), e.g. '2234'."),
      country,
    },
    post("store"),
  );

  server.tool(
    "get_barnesandnoble_suggestions",
    `The search-box suggestions of ${SITE} for a partial query: query, total, count, products (up to 10, with the search item fields), topics [{label, path, url}] (subjects; send path to get_barnesandnoble_category), notes. The answer carries no keyword completions. Captured 2026-11-27: hunger gave 10 title suggestions (5710 matches) and subject topics such as Fiction. Usually 2 to 15 s. ${ONE}`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'hunger'."),
      country,
    },
    post("suggestions"),
  );

  server.tool(
    "get_barnesandnoble_bestsellers",
    `A ${SITE} bestseller list: the Bestsellers page (top, default), Bestselling Books, The New York Times Best Sellers or B&N Stores Bestsellers: list, title, url, total, count, items [{rank, ...search item fields}] (the first page of 20 to 24 titles), lists [{heading, link, link_path, count, items [{rank, ean, title, format, contributors, price, original_price, on_sale, available_for_sale, image}]}] (for a list page that shows its titles as separate lists, such as Hardcover Fiction and Paperback Nonfiction; items is then empty), notes. rank is the position on the list; sales_rank is the site's own sales rank. ${PRICE} Captured 2026-11-27: the Bestsellers page counted 180416 titles (24 listed), number 1 a hardcover at 32 USD. ${HEAVY} ${ONE}`,
    {
      list: z.enum(["top", "books", "nyt", "stores"]).optional()
        .describe("top (default: the Bestsellers page), books (Bestselling Books), nyt (The New York Times Best Sellers), stores (B&N Stores Bestsellers, hardcover fiction and nonfiction)."),
      country,
    },
    post("bestsellers"),
  );

  server.tool(
    "get_barnesandnoble_category",
    `One ${SITE} collection by path or link (Mystery & Thriller, New Releases, Kids ages 3-5 ...), sorted and filtered like search: path, url, title, breadcrumbs [{name, url, path}], ${GRID} A collection page that shows shelves instead of a product list answers items [] and shelves [{heading, group, link, link_path, count, items}] as the page shows them. Captured 2026-11-27: books/mystery-thrillers (Best Mystery & Thriller Books) counted 188000 titles, the first a 17.99 USD paperback. An unknown collection is a charged not-found. ${HEAVY} ${ONE}`,
    {
      path: z.string().min(1).max(400).optional()
        .describe("A collection path (get_barnesandnoble_categories path, suggestions topics[].path; /collections/ optional), e.g. 'books/mystery-thrillers'. Send path or url."),
      url: z.string().min(1).max(400).optional()
        .describe("Or a barnesandnoble.com/collections/ link (its query string is not read: send sort and filters)."),
      sort,
      filters,
      country,
    },
    post("category"),
  );

  server.tool(
    "get_barnesandnoble_categories",
    `The ${SITE} header navigation as the site shows it: count, group_count, link_count, departments [{name, url, path, groups [{name, url, path, links [{name, url, path}]}]}], notes. path is what get_barnesandnoble_category takes (null for a page that is not a collection). Captured 2026-11-27: 9 departments, 52 groups and 238 links. ${HEAVY} ${ONE}`,
    { country },
    post("categories"),
  );

  server.tool(
    "get_barnesandnoble_deals",
    `A ${SITE} deals page: the Black Friday and Cyber Monday deals (default, while the site runs it), Coupons & Deals, Book Deals for Kids, eBook or audiobook deals: type, title, url, count, item_count, sections [{heading, group, link, link_path, count, items [{ean, title, format, contributors, price, original_price, on_sale, available_for_sale, image}]}] (the page's deal shelves, the sale price next to the compare-at price as given), notes. The page gives no end date per deal. Captured 2026-11-27: the Black Friday and Cyber Monday page held 21 shelves with 165 titles, the first 50% Off Hardcover Fiction. A deals page the site does not run is a charged not-found. ${HEAVY} ${ONE}`,
    {
      type: z.enum(["black_friday", "coupons", "kids", "ebooks", "audiobooks"]).optional()
        .describe("black_friday (default: the Black Friday and Cyber Monday deals), coupons (Coupons & Deals), kids (Book Deals for Kids), ebooks, audiobooks."),
      country,
    },
    post("deals"),
  );
}
