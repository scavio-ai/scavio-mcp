import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/thriftbooks.ts (ThriftBooks, thriftbooks.com, the US online used-book seller, USD).
// Rules the backend enforces and zod here does not: on search, page x page_size must stay within 10000 and an ISBN as
// query is a 400 that points to get_thriftbooks_isbn; max_price must be at least min_price. No zod `.default()`: the
// MCP SDK would post a defaulted field on every call.

const FORMATS = [
  "paperback", "hardcover", "mass_market_paperback", "library_binding", "audio_cd", "mp3_cd", "audio_cassette",
  "perfect_paperback", "board_book", "comic", "dvd", "blu_ray", "4k_ultra_hd",
] as const;
const CONDITIONS = ["new", "like_new", "very_good", "good", "acceptable"] as const;
const LANGUAGES = [
  "english", "spanish", "french", "german", "italian", "chinese", "russian", "portuguese", "polish", "japanese",
  "dutch", "turkish", "korean", "greek",
] as const;
const SORTS = ["most_popular", "relevance", "bestsellers", "title_asc", "title_desc", "newest", "oldest"] as const;
const EDITION_SORTS = ["bestselling", "newest", "oldest", "price_asc", "price_desc"] as const;
const LISTS = ["bestsellers", "deals", "new_releases"] as const;

const SITE = "ThriftBooks (thriftbooks.com, the US online used-book seller), prices in USD";
const ONE = "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Prices are ThriftBooks' own in USD for its US storefront, as shown to a visitor who is not signed in (no member or cart prices). Every answer carries store, host, country (us), currency (USD) and language (en).";
const QTY = "A New copy quantity of 500 is the most ThriftBooks shows: 500 means 500 or more.";
const CONDITION =
  "condition, condition_id, in_stock, price, list_price, quantity, edition_id, copy_id, format_id, isbn, ean, ex_library, no_dust_jacket, no_cd, thrift_deal, promotion, loyalty_bonus_points (ReadingRewards bonus points shown on the copy), shipping_surcharge, est_days_to_ship, ship_country_restriction, image";
const TABLE = `format_count, in_stock, low_price, high_price, formats [{format, format_id, in_stock, low_price, high_price, default_edition {edition_id, isbn, ean}, conditions [{${CONDITION}}]}], notes. One row per format and condition (New, Like New, Very Good, Good, Acceptable); a row with in_stock false has no copy for sale now (price null)`;
const COPY = "copy_id, edition_id, condition, condition_id, price, quantity, ex_library, no_dust_jacket, no_cd, backorder";

const idValue = z.union([z.string().min(1).max(12), z.number().int().positive()]);
const workId = idValue
  .describe("A ThriftBooks work id (items[].work_id of search_thriftbooks, work_id of get_thriftbooks_isbn), e.g. 26830049. A work is the book across all its editions.");
const editionId = idValue
  .describe("A ThriftBooks edition id (edition_id of get_thriftbooks_isbn, conditions[].edition_id of get_thriftbooks_work, editions[].edition_id), e.g. 49364660.");
const nameOrId = z.union([z.string().max(40), z.number().int()]);
const listOf = () => z.union([nameOrId, z.array(nameOrId).max(10)]);
const formatList = listOf().optional()
  .describe(`Formats, one or a list of up to 10: ${FORMATS.join(", ")}, or a format_id an answer lists.`);
const conditionList = listOf().optional()
  .describe(`Conditions, one or a list: ${CONDITIONS.join(", ")}.`);
const page = z.number().int().min(1).max(1000).optional();

export function registerThriftbooksTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/thriftbooks/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_thriftbooks",
    `${SITE} search: keywords or the whole catalog, with the presets bestsellers, deals (ThriftBooks Deals) and new_releases; filters for format, condition, language, genre, price, deals, new releases, collectible, signed, first edition and large print; the site's 7 sorts; up to 50 works a page. Returns query, list, sort, page, page_size, total, total_pages, did_you_mean, applied_filters, count, items [position, work_id (what get_thriftbooks_work, get_thriftbooks_editions and get_thriftbooks_reviews take), title, authors [{id, name}], series [{id, name, number}], in_stock, buy_now {price, condition, condition_id, format, format_id, edition_id, copy_id, isbn, publisher, release_date, ex_library, no_dust_jacket, no_cd} (the copy the result puts up for sale), low_price, high_price (the work's price range across editions and conditions), list_price, available_copies, edition_count, collectible_count, collectible_low_price, thrift_deal, backorder, book_language, rating, review_count, image, edition_image], facets {genres, age_ranges, product_types [{id, name, count, selected}], formats, conditions, languages [{id, name, selected}]} (ids to send back as filters), notes. page x page_size must stay within 10000 (the site's search depth). ThriftBooks search does not match ISBNs: an ISBN query is a 400 that points to get_thriftbooks_isbn. ${QTY} ${PRICES} Captured 2026-11-27: project hail mary gave 3 works, the first with 27 editions from 17.25 to 29.99 USD; the bestsellers list counted 11593338 works. ${ONE}`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Search keywords (title, author, subject), e.g. 'project hail mary'. Leave out to browse the whole catalog with list, genre or other filters. Not an ISBN."),
      list: z.enum(LISTS).optional()
        .describe("A preset: bestsellers (the site's bestseller order), deals (ThriftBooks Deals) or new_releases (New Releases). Combines with query and the filters."),
      sort: z.enum(SORTS).optional()
        .describe("most_popular (default; bestsellers with list bestsellers), relevance (top matches), bestsellers, title_asc, title_desc, newest or oldest (publication date)."),
      page: page.describe("Results page, 1-based (default 1). page x page_size must stay within 10000."),
      page_size: z.number().int().min(1).max(50).optional()
        .describe("Works per page, 1 to 50 (default 25)."),
      format: formatList,
      condition: conditionList,
      language: listOf().optional()
        .describe(`Languages, one or a list: ${LANGUAGES.join(", ")}, or a language id from facets.languages.`),
      genre: z.union([idValue, z.array(idValue).max(10)]).optional()
        .describe("Genre ids, one or a list, from facets.genres[].id (13207 Fiction, 13564 Horror, 15013 Science Fiction & Fantasy) or facets.age_ranges[].id."),
      min_price: z.number().int().min(0).max(10000).optional()
        .describe("Lowest price in whole US dollars."),
      max_price: z.number().int().min(0).max(10000).optional()
        .describe("Highest price in whole US dollars (at least min_price)."),
      deals: z.boolean().optional().describe("ThriftBooks Deals only (the same as list deals)."),
      new_releases: z.boolean().optional().describe("New Releases only (the same as list new_releases)."),
      collectible: z.boolean().optional().describe("Collectibles only."),
      signed: z.boolean().optional().describe("Signed books only."),
      first_edition: z.boolean().optional().describe("First editions only."),
      large_print: z.boolean().optional().describe("Large print only."),
      include_out_of_stock: z.boolean().optional()
        .describe("Also list works with no copy for sale now (default false, as the site)."),
    },
    post("search"),
  );

  server.tool(
    "get_thriftbooks_isbn",
    `Look a book up on ${SITE} by ISBN-10 or ISBN-13 (check digit verified; an ISBN-10 is converted to ISBN-13): the work and edition ThriftBooks matches, then the work's format x condition table with the price, quantity and copy details of each condition. Returns isbn, isbn13, isbn10, work_id, edition_id, ${TABLE}; requested_edition marks the rows of the matched edition. ${QTY} ${PRICES} Captured 2026-11-27: ISBN 9780593135204 matched work 26830049 and edition 49364660, 4 formats from 17.25 to 23.92 USD, the hardcover New at 23.92 USD (list 32) with quantity 500. An ISBN ThriftBooks does not carry is a charged not-found; a bad check digit is a refused input, not charged. ${ONE}`,
    {
      isbn: z.string().min(10).max(17)
        .describe("An ISBN-10 or ISBN-13, dashes and spaces allowed, e.g. '9780593135204'."),
    },
    post("isbn"),
  );

  server.tool(
    "get_thriftbooks_work",
    `The format x condition table of one work on ${SITE} by work_id: for each format (Hardcover, Paperback, Audio CD, ...) the price, quantity and copy details of each condition (New, Like New, Very Good, Good, Acceptable), as the work's page shows them. Returns work_id, ${TABLE}. ${QTY} ${PRICES} Captured 2026-11-27: work 246187 (The Hunger Games) had 4 formats from 7.19 to 34.59 USD, the hardcover New at 17.9 USD (list 22.99). An unknown work is a charged not-found. ${ONE}`,
    { work_id: workId },
    post("work"),
  );

  server.tool(
    "get_thriftbooks_edition",
    `One edition of a book on ${SITE} by edition_id: edition_id, title, authors (as given), format, isbn, isbn13, upc, publisher, release_date, pages, book_language, large_print, age_range, grade_range, list_price, in_stock, buy_now {price, condition, copy_id}, low_price, high_price, lowest_new_price, lowest_used_price, has_new_copies, has_used_copies, available_copies, backorder, thriftbooks_sales_rank, description (the start of the overview the edition page shows, cut to about 300 characters), image, copies [${COPY}], notes. ${QTY} ${PRICES} Captured 2026-11-27: edition 49364660, the Project Hail Mary hardcover (496 pages), New at 23.92 USD against a list price of 32. An unknown edition is a charged not-found. ${ONE}`,
    { edition_id: editionId },
    post("edition"),
  );

  server.tool(
    "get_thriftbooks_copies",
    `Every copy for sale of one edition on ${SITE} by edition_id, one row per condition and copy type (ex-library, no dust jacket, no CD): edition_id, count, copies [${COPY}], notes. An empty list means no copy is in stock (or no edition has the id). ${QTY} ${PRICES} Captured 2026-11-27: edition 4587405 had 1 copy, Good with no dust jacket at 9.29 USD. ${ONE}`,
    { edition_id: editionId },
    post("copies"),
  );

  server.tool(
    "get_thriftbooks_editions",
    `All editions of one work on ${SITE}, 25 a page, filtered by format and condition, in stock only (default) or every edition, sorted bestselling, newest, oldest or by price: work_id, sort, in_stock_only, applied_filters, page, per_page, total, total_pages, count, editions [edition_id, title, edition_description, authors [{id, name}], format, isbn, ean, upc, publisher, release_date, pages, book_language, large_print, age_range, grade_range, list_price, in_stock, low_price, others_watching, image, copies [${COPY}, thrift_deal]], top_formats [{format, format_id}], notes. isbn and ean are as ThriftBooks lists them (an edition without an ISBN can carry another catalog code there). An empty list means no edition matches (or no work has the id). ${QTY} ${PRICES} Captured 2026-11-27: work 246187 had 33 editions in stock over 2 pages. ${ONE}`,
    {
      work_id: workId,
      format: formatList,
      condition: conditionList,
      sort: z.enum(EDITION_SORTS).optional()
        .describe("bestselling (default), newest, oldest (publication date), price_asc or price_desc."),
      page: page.describe("Editions page, 1-based, 25 a page (total_pages says how many)."),
      in_stock_only: z.boolean().optional()
        .describe("Editions with a copy for sale now only (default true, as the site). false lists every edition."),
    },
    post("editions"),
  );

  server.tool(
    "get_thriftbooks_reviews",
    `ThriftBooks customer reviews of one work on ${SITE}, 10 a page in the site's order: work_id, page, per_page, has_next, count, reviews [review_id, rating, headline, text, date, verified_purchase, likes, dislikes], notes. No reviewer names. Captured 2026-11-27: work 26830049 (Project Hail Mary) gave 10 reviews on page 1 with another page after it. ${ONE}`,
    {
      work_id: workId,
      page: page.describe("Reviews page, 1-based, 10 a page (has_next says if there is another)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_thriftbooks_suggestions",
    `${SITE} search-box suggestions: title and author completions for a partial query, as given: query, count, suggestions. Captured 2026-11-27: hunger gave 6 suggestions, the first The Hunger Games. ${ONE}`,
    {
      query: z.string().min(1).max(100)
        .describe("A partial search query, e.g. 'hunger'."),
    },
    post("suggestions"),
  );
}
