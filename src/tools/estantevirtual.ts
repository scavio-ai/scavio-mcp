import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/estantevirtual.ts (Estante Virtual, estantevirtual.com.br, Brazil's used and new
// book marketplace, part of Magalu; Brazil, BRL). Rules the backend enforces and zod here does not: book and copies
// take book_id or url; copy and shipping take copy_id or url; the ISBN check digit is verified (a typo is a refused,
// uncharged input). No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SITE =
  "Estante Virtual (estantevirtual.com.br, Brazil's used and new book marketplace of sebos and booksellers, part of Magalu), Brazil only, Portuguese text, prices in BRL as shown to a visitor who is not signed in";
const COST =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const LIST_TIME = "Usually 3 to 30 s (up to 70 s when the site is busy); allow a client timeout of at least 180 s.";
const PAGE_TIME = "Usually 4 to 25 s; allow a client timeout of at least 180 s.";
const FAST_TIME = "Usually 2 to 10 s; allow a client timeout of at least 120 s.";
const BOOK =
  "A book (kind book, book_id ending -BK) is every copy of one ISBN; a one-copy listing without an ISBN group is kind listing with a copy_id. There is no work level: other editions are separate books.";
const CARD =
  "position, kind (book or listing), book_id, copy_id, title, author, publisher, year, isbn, book_language, url, image, lowest_price, copies {used, new}, department, badges, rating, review_count";
const GRID = `44 per page, pages 1 to 238, in the site's 6 sorts, filtered by any facet (used / new, author, publisher, year, seller city, seller, category, language, rating, a BRL price range). Returns page, page_size, total, total_pages, has_more, count, title, items [{${CARD}}], facets [{key, name, values [{value, label, count}], min, max}], sort, filters_applied and notes. ${BOOK}`;
const COPY =
  "copy_id, book_id, title, author, publisher, year, isbn, book_language, condition (used / new), has_invoice, condition_notes (the seller's own notes on a used copy), price, installment, department, image, available, url, badges";
const PRIVACY =
  "Sellers appear by shop name with city and state only; reviewer names are never returned.";

const value = z.string().min(1).max(140);
const values = z.union([value, z.array(value).max(12)]);
const grid = {
  sort: z.enum(["relevance", "price_asc", "price_desc", "newest", "best_sellers", "price_plus_shipping"]).optional()
    .describe("relevance (default), price_asc, price_desc, newest, best_sellers or price_plus_shipping: the site's 6 sorts."),
  condition: z.enum(["used", "new"]).optional().describe("Books with used or new copies (tipo-de-livro)."),
  author: z.string().max(140).optional().describe("Author facet value (autor, facets[].values[].value), e.g. 'machado-de-assis'."),
  publisher: z.string().max(140).optional().describe("Publisher facet value (editora), e.g. 'companhia-das-letras'."),
  city: z.string().max(140).optional().describe("Seller city facet value (cidade), e.g. 'sao-paulo'."),
  category: z.string().max(140).optional().describe("Category facet value (categoria), e.g. 'literatura-brasileira'."),
  filters: z.record(z.string(), values).optional()
    .describe("Facet filters: {key: value or [values]} with facets[].key and facets[].values[].value of an answer (tipo-de-livro, autor, editora, ano-de-publicacao, cidade, sebos-e-livreiros, promocoes, categoria, idioma, _avaliacao, compra-corporativa), e.g. {\"ano-de-publicacao\": \"2009\", \"idioma\": \"portugues\"}. Up to 12 values."),
  price_min: z.number().min(0).max(100000).optional().describe("Lowest price in BRL."),
  price_max: z.number().min(0).max(100000).optional().describe("Highest price in BRL."),
  page: z.number().int().min(1).max(238).optional().describe("Results page, 1 to 238 (44 per page)."),
};
const bookRef = {
  book_id: z.string().min(10).max(40).optional()
    .describe("The book id (items[].book_id of a search, book.book_id of get_estantevirtual_isbn), e.g. '017-4778-000-BK'. Send book_id or url."),
  url: z.string().min(1).max(800).optional()
    .describe("Or an estantevirtual.com.br book link."),
};
const copyRef = {
  copy_id: z.string().min(10).max(40).optional()
    .describe("The copy id (items[].copy_id of get_estantevirtual_copies, lowest_priced_used.copy_id of a book, copy_id of a one-copy listing), e.g. 'GME-2437-000'. Send copy_id or url."),
  url: z.string().min(1).max(800).optional()
    .describe("Or an estantevirtual.com.br copy link."),
};
const sellerId = z.union([z.string().min(1).max(12), z.number().int().min(1)])
  .describe("A seller id (sellers[].seller_id of get_estantevirtual_sellers, seller.id of a copy), e.g. '1002276'.");
const copySort = z.enum(["price_asc", "price_desc"]).optional();

export function registerEstantevirtualTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/estantevirtual/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_estantevirtual",
    `${SITE} search by title, author or ISBN keywords. ${GRID} Also query. No results is an empty, charged answer. ${PRIVACY} Not available: search suggestions, questions, stores, a was-price and Pix prices. Captured 2026-11-27: dom casmurro matched 3915 books, the first from 10 BRL. ${COST} ${LIST_TIME}`,
    {
      query: z.string().min(1).max(160)
        .describe("Title, author or ISBN keywords (Portuguese, as a reader types them), e.g. 'dom casmurro'."),
      ...grid,
    },
    post("search"),
  );

  server.tool(
    "get_estantevirtual_isbn",
    `The book for an ISBN on ${SITE}: isbn13, isbn10, book {${CARD}} (the copies grouped under the ISBN), listing_count and listings (single copies with the ISBN that the site did not group). The check digit is verified first, so a typo is refused and not charged. An ISBN with no copy on sale is a charged not-found. Captured 2026-11-27: 9788535914849 (1984, Companhia das Letras) had 198 used and 62 new copies from 18 BRL, plus 43 ungrouped listings. ${COST} ${LIST_TIME}`,
    {
      isbn: z.string().min(10).max(17)
        .describe("An ISBN-10 or ISBN-13 (dashes and spaces allowed), e.g. '9788535914849'."),
    },
    post("isbn"),
  );

  server.tool(
    "get_estantevirtual_book",
    `One ${SITE} book by book_id or link: book_id, title, author, publisher, year, isbn, url, image, available, currency, lowest_price {used, new}, lowest_priced_used and lowest_priced_new {copy_id, price, seller {id, name}, year, publisher, has_invoice, condition_notes, installment, url}, rating, review_count, percent_recommended, histogram and reviews [{review_id, rating, text, date, recommends, photo_count}] (every review the page shows, no reviewer names). No synopsis. ${BOOK} An unknown book is a charged not-found. Captured 2026-11-27: 017-4778-000-BK (1984) from 18 BRL used and 21.90 BRL new, rated 5 from 12 reviews. ${COST} ${PAGE_TIME}`,
    bookRef,
    post("book"),
  );

  server.tool(
    "get_estantevirtual_copies",
    `Every copy of a ${SITE} book on sale, by book_id and condition (used / new), up to 50 per page, sorted by price in either direction, filtered by printing year, publisher, seller city, seller or price: book_id, condition, sort, sellers_included, filters_applied, page, page_size, total, total_pages, has_more, count, items [{${COPY}, seller {id, name} with sellers: true, weight_grams}], facets and notes. The list carries no seller per copy: sellers: true adds each copy's seller with one extra call per copy, billed ceil((1 + copies) / 5) credits (10 copies = 3, 50 = 11); otherwise 1 credit. credits_used is what was charged; failed upstream calls and refused inputs are not charged; a not-found is charged. Captured 2026-11-27: 1984 (017-4778-000-BK) had 198 used copies, the cheapest at 18 BRL. Usually 2 to 10 s, 10 to 60 s with sellers: true; allow a client timeout of at least 180 s.`,
    {
      ...bookRef,
      condition: z.enum(["used", "new"]).optional().describe("used (default) or new copies."),
      sort: copySort.describe("price_asc (default) or price_desc."),
      page: z.number().int().min(1).max(500).optional().describe("Page, 1-based."),
      page_size: z.number().int().min(1).max(50).optional().describe("Copies per page, 1 to 50 (default 10)."),
      sellers: z.boolean().optional()
        .describe("Add each copy's seller (one extra call per copy: ceil((1 + copies) / 5) credits, e.g. 10 copies = 3). Default false (1 credit)."),
      year: z.string().max(10).optional().describe("Printing year facet (ano-de-publicacao), e.g. '2009'."),
      publisher: z.string().max(140).optional().describe("Publisher facet value (editora)."),
      city: z.string().max(140).optional().describe("Seller city facet value (cidade)."),
      filters: z.record(z.string(), values).optional()
        .describe("Facet filters {key: value or [values]}: ano-de-publicacao, editora, cidade, sebos-e-livreiros, _preco (min-max in cents)."),
    },
    post("copies"),
  );

  server.tool(
    "get_estantevirtual_copy",
    `One seller's copy on ${SITE} by copy_id or link: ${COPY}, seller {id, name, name_slug}, free_shipping, weight_grams, dimensions_cm and quantity (always 1: used copies are unique). An unknown copy is a charged not-found. Captured 2026-11-27: GME-2437-000, a new copy of 1984, at 21.90 BRL. ${COST} ${PAGE_TIME}`,
    copyRef,
    post("copy"),
  );

  server.tool(
    "get_estantevirtual_shipping",
    `The delivery quote for one ${SITE} copy to a CEP (Brazilian postal code): copy_id, cep, seller, price, currency, count, options [{type, service, seller_id, cost, free, min_days, max_days, min_date, max_date}] (the lowest-cost option the seller offers there) and free_shipping_threshold {min_order, missing, reached}. Captured 2026-11-27: GME-2437-000 to CEP 01310-100 cost 19.34 BRL in 9 days. ${COST} ${FAST_TIME}`,
    {
      ...copyRef,
      cep: z.string().min(8).max(12).describe("A Brazilian CEP (8 digits), e.g. '01310-100'."),
    },
    post("shipping"),
  );

  server.tool(
    "get_estantevirtual_seller",
    `A ${SITE} sebo (second-hand bookshop) or bookseller by seller id: seller_id, name (the shop name), name_slug, seller_type (private or business), official_store, active, member_since, city, state, description (phone numbers and emails removed), shipping_methods, url, rating, review_count, reviews_with_comment, percent_recommended, histogram, reviews (the newest, no reviewer names), catalogue_total and books (a page of 40 from its catalogue). No street address, ZIP, document number or contact is returned. An unknown seller is a charged not-found. Captured 2026-11-27: seller 1002276, a member since 2008, rated 4.92 from 38 reviews, with 2992 books in its catalogue. ${COST} ${PAGE_TIME}`,
    {
      seller_id: sellerId,
      name: z.string().max(120).optional().describe("The seller's name slug (name_slug), optional."),
    },
    post("seller"),
  );

  server.tool(
    "get_estantevirtual_seller_books",
    `A sebo's catalogue on ${SITE} by seller id, optionally searched by keyword and sorted by price, 40 per page: seller_id, query, sort, page, page_size, total, total_pages, has_more, count and items [{${COPY}}]. Captured 2026-11-27: seller 1002276 had 3 copies matching orwell. ${COST} ${LIST_TIME}`,
    {
      seller_id: sellerId,
      query: z.string().max(160).optional().describe("Search inside the seller's catalogue, e.g. 'orwell'."),
      sort: copySort.describe("price_asc or price_desc (default: the site's order)."),
      page: z.number().int().min(1).max(250).optional().describe("Page, 1-based (40 per page)."),
    },
    post("seller-books"),
  );

  server.tool(
    "get_estantevirtual_seller_reviews",
    `Buyers' reviews of a sebo on ${SITE} by seller id, 10 per page, newest to oldest, optionally positive or negative: seller_id, page, page_size, total_pages, has_more, rating_filter, total_filtered, count and reviews [{rating, text, date, recommends}]. No reviewer names. Captured 2026-11-27: seller 1002276 had 38 reviews over 4 pages. ${COST} ${FAST_TIME}`,
    {
      seller_id: sellerId,
      page: z.number().int().min(1).max(1000).optional().describe("Page, 1-based (10 per page)."),
      rating: z.enum(["positive", "negative"]).optional().describe("positive (3 to 5 stars) or negative (0 to 2), as the site's filters."),
    },
    post("seller-reviews"),
  );

  server.tool(
    "get_estantevirtual_sellers",
    `The ${SITE} sebo and bookseller directory: the whole country, a state (UF) or a city of that state, 30 per page: state, city, page, page_size, total, total_pages, has_more, count, sellers [{seller_id, name, active, member_since, city, state, free_shipping, rating, percent_recommended, url}], cities and states (the site's counts). ${PRIVACY} No address or contact. Captured 2026-11-27: Sao Paulo city, SP had 1258 sellers. ${COST} ${PAGE_TIME}`,
    {
      state: z.string().length(2).optional().describe("A Brazilian state code (UF), e.g. 'SP'. Leave out for the whole country."),
      city: z.string().max(80).optional()
        .describe("A city of that state, written as the site writes it, with accents (cities[] of the state's directory), e.g. 'São Paulo'."),
      page: z.number().int().min(1).max(250).optional().describe("Page, 1-based (30 per page)."),
    },
    post("sellers"),
  );

  server.tool(
    "get_estantevirtual_category",
    `One ${SITE} category by slug, sorted and filtered like search_estantevirtual. ${GRID} Also category_slug and url. An unknown category is a charged not-found. Captured 2026-11-27: literatura-brasileira held 840564 books. ${COST} ${LIST_TIME}`,
    {
      category_slug: z.string().min(1).max(300)
        .describe("A category slug or link from the site's menu (antropologia, artes, auto-ajuda, biografias, ciencia-politica, comunicacao, direito, engenharia, filosofia, historia-do-brasil, historia-geral, infanto-juvenis, literatura-brasileira, literatura-estrangeira, livros-raros, medicina, psicologia, ensino-de-idiomas) or a categoria facet value, e.g. 'literatura-brasileira'."),
      ...grid,
    },
    post("category"),
  );

  server.tool(
    "get_estantevirtual_list",
    `A ${SITE} list page by slug or /lst/ link: black-friday (default), livros-baratos, saldao-de-livros, livros-frete-gratis, lancamentos or another list of the site, 42 per page in the site's order: slug, url, page, page_size, total, total_pages, has_more, count, title, items [{${CARD}}] and notes. An unknown list is a charged not-found. Captured 2026-11-27: black-friday held 399 books, the first from 18 BRL. ${COST} ${LIST_TIME}`,
    {
      slug: z.string().min(1).max(300).optional()
        .describe("A list slug or /lst/ link, e.g. 'black-friday' (the default), 'livros-baratos', 'saldao-de-livros', 'livros-frete-gratis', 'lancamentos'."),
      page: z.number().int().min(1).max(250).optional().describe("Page, 1-based (42 per page)."),
    },
    post("list"),
  );
}
