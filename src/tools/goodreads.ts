import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/goodreads.ts (one global English site, no country). Rules the backend
// enforces and zod here does not: book takes exactly one of book_id, url or isbn (an ISBN-10 or ISBN-13 with
// a valid checksum); reviews, book_lists take one of book_id or url; author, author_books one of author_id or
// url; series one of series_id or url; editions one of work_id or url; list one of list_id or url; quotes one of
// query, tag or work_id; new_releases one of genre or month (YYYY-MM between 2007-01 and 12 months from now);
// a url must be a goodreads.com link of the right kind; reviews language is a code as Goodreads lists it (en,
// es, zh-TW ...), and a language with no reviews is a charged 404; genre shows one page only.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const SEARCH_TYPES = ["books", "lists", "quotes"] as const;
const REVIEW_SORTS = ["popular", "newest", "oldest"] as const;
const AUTHOR_SORTS = ["popularity", "original_publication_year", "title", "average_rating", "number_of_pages"] as const;
const EDITION_SORTS = ["title", "original_date_published", "date_published", "avg_rating", "num_ratings", "format"] as const;
const GENRE_LISTS = ["popular", "most_read"] as const;

const FIRST = "Goodreads (goodreads.com, Amazon's book community)";
const NAME = "Goodreads";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const NO_PII = "Reviewer names, avatars and profile links are never returned (profile links are cut out of review text).";
const BOOK_CARD = "book_id, work_id, title, url, cover_url, author {author_id, name, url, goodreads_author}, rating (0-5), ratings_count";
const REVIEW = "{review_id, rating (1-5; null when the reader gave no stars), created_at, updated_at, text (plain text), spoiler, recommend_for, likes, comments}";

const id = z.union([z.string().min(1).max(400), z.number().int().positive()]);
const link = (what: string) => z.string().min(10).max(400).optional().describe(`Or a goodreads.com ${what} link.`);
const page = (max: number, size: string) =>
  z.number().int().min(1).max(max).optional().describe(`Page${size}, 1 to ${max} (has_more says whether there is another).`);

export function registerGoodreadsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/goodreads/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_goodreads",
    `Search ${FIRST} for books (by title, author or ISBN), Listopia lists or quotes, 20 a page: site, query, type, page, page_size, total (exact counts only), total_text (as Goodreads words it, e.g. over 111k), has_more, count, results. Books: [{position, ${BOOK_CARD}, other_authors, reviews_count, editions_count, published (this edition), series [{series_id, title, position, url}], kindle_price (USD, as given), description}]. Lists: [{position, list_id, title, url, books_count, voters, sponsored, top_books}]. Quotes: [{position, quote_id, text, author, author_quotes_url, book_title, likes (rounded as the search shows it), likes_text, url}]. Goodreads search has no sort and no title or author field filter. Captured 2026-11-26: dune gave over 111k books, the first Dune by Frank Herbert (book_id 44767458), rated 4.29 from 1732454 ratings with 524 editions; courage in quotes gave over 34.7k. Goodreads retired its official API (no new developer keys since 2020). ${ONE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Required. A title, an author, a phrase or an ISBN (an ISBN finds that edition), e.g. dune."),
      type: z.enum(SEARCH_TYPES).optional().describe("books (default), lists or quotes: Goodreads' own search tabs."),
      page: page(100, " of 20"),
    },
    post("search"),
  );

  server.tool(
    "get_goodreads_book",
    `One book on ${NAME} by id, link or ISBN: site, requested, book_id, work_id (the input of get_goodreads_editions and get_goodreads_quotes), url, title, title_complete, original_title, description, cover_url, author, authors [{author_id, name, role, url, goodreads_author}], author_profile {bio, photo_url, works_count, followers}, rating, ratings_count, rating_distribution {5..1}, reviews_count, review_languages [{language, count}], genres [{name, slug (the input of get_goodreads_genre), url}], series [{series_id, title, position, url}], format, pages, publisher, published, first_published, language, isbn, isbn13, asin, awards [{name, category, designation (winner, nominee), year, url}], places [{name, country, year, url}], characters [{name, url}], kindle {price, currency (USD), price_text, kindle_unlimited, prime_reading} (as Goodreads shows it), quotes_count, questions_count, discussions_count, editions_url, reviews_total, reviews_shown, reviews (the first 30, popular order) [${REVIEW}], notes. Captured 2026-11-26: book 44767458, Dune by Frank Herbert (Ace hardcover, 2019, 658 pages, ISBN 9780593099322), rated 4.29 from 1732454 ratings, 91243 reviews in 54 languages, Hugo Award winner 1966, Kindle 9.99 USD. ${NO_PII} An unknown id or ISBN is a charged 404. ${ONE}`,
    {
      book_id: id.optional()
        .describe("A Goodreads book id (book_id of any answer, e.g. 44767458) or the id with its slug (44767458-dune). Send one of book_id, url or isbn."),
      url: link("book"),
      isbn: z.string().min(10).max(20).optional()
        .describe("Or an ISBN-13 or ISBN-10 (checksum verified, e.g. 9780735211292): the edition with it."),
    },
    post("book"),
  );

  server.tool(
    "get_goodreads_reviews",
    `Reader reviews of one book on ${NAME}, 30 a page, with Goodreads' own sort (popular, newest, oldest), star filter, language filter and this-edition filter: site, book {book_id, work_id, title, author, url}, sort, stars, language, edition_only, pages_requested, pages_read, page_size, total (as Goodreads counts the view), has_more, count, reviews [${REVIEW}]. The default view (popular, page 1, no filter) also returns rating, ratings_count, rating_distribution and review_languages. Up to 4 pages (120 reviews) of one view per call: Goodreads has no jump to a deeper page. Sorted, filtered or multi-page views open the review page and read what it shows: slower (typically 15-60 s, up to about 2 minutes). Captured 2026-11-26: Onyx Storm (book_id 209439446) had 225773 reviews in the popular view, rated 4.22 from 2016940 ratings; 1-star reviews of Atomic Habits (book_id 59910150) numbered 1145. ${NO_PII} ${ONE} Allow up to 4 minutes.`,
    {
      book_id: id.optional().describe("A Goodreads book id (e.g. 44767458). Send book_id or url."),
      url: link("book"),
      sort: z.enum(REVIEW_SORTS).optional().describe("popular (default), newest or oldest: the review page's own orders."),
      stars: z.number().int().min(1).max(5).optional().describe("Only reviews with this many stars (1-5)."),
      language: z.string().min(2).max(10).optional()
        .describe("Only reviews in this language, as the page's filter lists it (en, es, fr, de, zh-TW ...; review_languages of get_goodreads_book or a plain reviews answer lists them with counts)."),
      edition_only: z.boolean().optional()
        .describe("Only reviews of this edition (default: every edition of the work, as Goodreads shows them)."),
      pages: z.number().int().min(1).max(4).optional()
        .describe("Pages of 30 to read in this call, 1 to 4 (up to 120 reviews of the view; default 1)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_goodreads_suggestions",
    `The books ${NAME} suggests as a reader types a title, author or ISBN (its search box): site, query, count, books [{${BOOK_CARD}, title_bare, pages, description}]. An ISBN returns that edition. Captured 2026-11-26: sanderson gave 5 books, the first Mistborn: The Final Empire (book_id 68428). ${ONE}`,
    {
      query: z.string().min(1).max(100).describe("Required. What a reader has typed so far: a title, an author or an ISBN (e.g. sanderson)."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_goodreads_author",
    `One author's page on ${NAME}: site, author_id, name, url, goodreads_author, photo_url, born {date, place}, died, website, genres [{name, slug, url}], influences, member_since (Goodreads Authors), bio, rating, ratings_count, reviews_count, works_count, followers, top_books [{${BOOK_CARD}, published_year, editions_count}], series [{series_id, title, url}]. Captured 2026-11-26: Brandon Sanderson (author_id 38550), 464 works, rated 4.39 from 10073402 ratings, 299148 followers, 10 top books and 5 series. An unknown id is a charged 404. ${ONE}`,
    {
      author_id: id.optional().describe("A Goodreads author id (author.author_id of any answer, e.g. 38550). Send author_id or url."),
      url: link("author"),
    },
    post("author"),
  );

  server.tool(
    "get_goodreads_author_books",
    `Every book of one author on ${NAME}, 30 a page, in Goodreads' order or by original_publication_year, title, average_rating or number_of_pages: site, author_id, author, sort, page, page_size, has_more, count, books [{${BOOK_CARD}, other_authors, published_year, editions_count}]. Captured 2026-11-26: Brandon Sanderson (author_id 38550) by original_publication_year gave 30 books a page with more to follow. ${ONE}`,
    {
      author_id: id.optional().describe("A Goodreads author id (e.g. 38550). Send author_id or url."),
      url: link("author"),
      sort: z.enum(AUTHOR_SORTS).optional()
        .describe("popularity (default), original_publication_year, title, average_rating, number_of_pages: the author page's own sorts."),
      page: page(100, " of 30"),
    },
    post("author-books"),
  );

  server.tool(
    "get_goodreads_series",
    `One series on ${NAME} with every book in Goodreads' reading order: site, series_id, url, title, primary_works, total_works, description, count, books [{label (Book 1, Book 2.5 ...), position, ${BOOK_CARD}, title_bare, reviews_count, pages, published, description}]. Captured 2026-11-26: The Stormlight Archive (series_id 49075), 5 primary works of 27, Book 1 The Way of Kings rated 4.66 from 739918 ratings. ${ONE}`,
    {
      series_id: id.optional().describe("A Goodreads series id (series[].series_id of get_goodreads_book, e.g. 49075). Send series_id or url."),
      url: link("series"),
    },
    post("series"),
  );

  server.tool(
    "get_goodreads_editions",
    `Every edition of one work on ${NAME}, 10 a page, with Goodreads' six sorts: site, work_id, title, author, first_published, book_url, sort, page, page_size, total, has_more, count, editions [{book_id, title, url, cover_url, published, publisher, format, edition, pages, isbn13, isbn10, asin, language, authors, rating, ratings_count}]. Captured 2026-11-26: Dune (work_id 3634639) by num_ratings gave 524 editions, the first the Ace Deluxe Edition hardcover of October 2019 (ISBN 9780593099322). ${ONE}`,
    {
      work_id: id.optional()
        .describe("A Goodreads work id: work_id of get_goodreads_book (all editions of a book share it, e.g. 3634639). Send work_id or url."),
      url: link("work editions"),
      sort: z.enum(EDITION_SORTS).optional()
        .describe("title, original_date_published, date_published, avg_rating, num_ratings, format: the editions page's own six sorts (default Goodreads' own order)."),
      page: page(1000, " of 10"),
    },
    post("editions"),
  );

  server.tool(
    "get_goodreads_list",
    `One Listopia list on ${NAME}, 100 books a page in vote order: site, list_id, url, title, description, books_count, voters, created, tags, page, page_size, has_more, count, books [{rank, ${BOOK_CARD}, other_authors, score, votes}]. The list's creator is not returned. Captured 2026-11-26: Best Books Ever (list_id 1), 80344 books and 299515 voters, number 1 The Hunger Games by Suzanne Collins with 46656 votes. ${ONE}`,
    {
      list_id: id.optional().describe("A Goodreads Listopia list id (list_id of a list answer, e.g. 1). Send list_id or url."),
      url: link("list"),
      page: page(1000, " of 100"),
    },
    post("list"),
  );

  server.tool(
    "get_goodreads_book_lists",
    `The Listopia lists that contain one book on ${NAME}, 30 a page: site, book_id, title, page, page_size, has_more, count, lists [{list_id, title, url, rank (the book's place on the list), rank_text, books_count, voters}]. Captured 2026-11-26: Dune (book_id 44767458) is 59th out of 80,324 books on Best Books Ever. ${ONE}`,
    {
      book_id: id.optional().describe("A Goodreads book id (e.g. 44767458). Send book_id or url."),
      url: link("book"),
      page: page(1000, " of 30"),
    },
    post("book-lists"),
  );

  server.tool(
    "search_goodreads_lists",
    `Listopia lists on ${NAME} whose title matches, 20 a page: site, query, page, page_size, total, total_text, has_more, count, lists [{position, list_id, title, url, books_count, voters, sponsored, top_books [{book_id, title, author, url, cover_url, rating, ratings_count}]}]. Captured 2026-11-26: fantasy gave over 9,332 lists, the first Best Books of the 20th Century (list_id 6, 7801 books, 49901 voters). ${ONE}`,
    {
      query: z.string().min(1).max(200).describe("Required. Words in a list's title (e.g. fantasy)."),
      page: page(100, " of 20"),
    },
    post("list-search"),
  );

  server.tool(
    "get_goodreads_quotes",
    `Quotes on ${NAME} by search words, by tag or from one book (work_id): site, query, tag, work_id, title, page, page_size, total, has_more, count, quotes [{quote_id, text, author, book {title, work_id, quotes_url}, tags, likes, url}]. Captured 2026-11-26: Dune (work_id 3634639) had 1462 quotes, 30 a page, the first by Frank Herbert with 17117 likes. ${ONE}`,
    {
      query: z.string().min(1).max(200).optional()
        .describe("Quotes containing these words, or by this author or from this book (e.g. hope). Send one of query, tag or work_id."),
      tag: z.string().min(1).max(80).optional().describe("Or quotes with this tag (tags[] of a quote answer, e.g. love)."),
      work_id: id.optional().describe("Or quotes from one book: its work_id (get_goodreads_book, e.g. 3634639)."),
      page: page(100, " of 20 (query) or 30 (tag, work_id)"),
    },
    post("quotes"),
  );

  server.tool(
    "get_goodreads_genre",
    `Books of one genre on ${NAME}: the first 50 of the genre's shelf (popular: book_id, title, url, cover_url, author, other_authors, shelved_count, rating, ratings_count, published_year; shelved_books is the shelf's size, capped at 100,000) or the books most read this week (most_read: position, book_id, title, url, cover_url): site, genre, list, title, count, books, notes. Goodreads shows visitors one page of a genre, so there is no page. Captured 2026-11-26: fantasy (popular) gave 50 books, the first Harry Potter and the Philosopher's Stone by J.K. Rowling, shelved 91113 times, rated 4.47. An unknown genre is a charged 404. ${ONE}`,
    {
      genre: z.string().min(1).max(80)
        .describe("Required. A Goodreads genre as its link writes it (fantasy, science-fiction, young-adult, historical-fiction; genres[].slug of get_goodreads_book)."),
      list: z.enum(GENRE_LISTS).optional()
        .describe("popular (default): the first 50 books of the genre's shelf, most shelved first; most_read: the books most read this week in the genre."),
    },
    post("genre"),
  );

  server.tool(
    "get_goodreads_new_releases",
    `New releases on ${NAME}: by genre (the new releases Goodreads tags with it: position, book_id, title, url, cover_url) or by month (YYYY-MM: the month's most popular releases across every genre, the first 15 Goodreads shows on its page: rank, count (the number Goodreads ranks by, as given), ${BOOK_CARD}, reviews_count, description; has_more says whether its list ranks more): site, genre, month, list_name, has_more, count, books, notes. Captured 2026-11-26: 2026-11 gave 15 books, number 1 Peculiar Stars by Rebecca Yarros, rated 4.7 from 24299 ratings. ${ONE}`,
    {
      genre: z.string().min(1).max(80).optional().describe("New releases Goodreads tags with this genre (e.g. fantasy). Send genre or month."),
      month: z.string().regex(/^\d{4}-\d{1,2}$/, "month must be YYYY-MM").optional()
        .describe("Or YYYY-MM (e.g. 2026-11, from 2007-01 to 12 months ahead): the month's most popular releases across every genre."),
    },
    post("new-releases"),
  );
}
