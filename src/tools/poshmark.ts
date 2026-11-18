import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/poshmark.ts (poshmark.com USD, poshmark.ca
// CAD; country defaults to us). Every tool accepts us and ca
// (POSHMARK_ENDPOINT_COUNTRIES). search, sold, category, brand, brands,
// suggestions, parties, party-listings and similar answer for that market;
// product, closet, closet-listings, love-notes, closets-search and categories
// are global (country only picks the domain asked). Cross-field rules the
// backend enforces and zod here does not: product takes exactly one of
// listing_id or url; category needs department, subcategory needs category;
// any other country answers 400 before anything is charged. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const MARKETS = ["us", "ca"] as const;
const SORTS = ["relevance", "just_shared", "just_in", "price_asc", "price_desc", "price_drop", "most_liked"] as const;
const CONDITIONS = ["new_with_tags", "new_with_tags_or_boutique", "boutique", "like_new", "good", "fair"] as const;
const DEPARTMENTS = ["Women", "Men", "Kids", "Home", "Pets", "Electronics"] as const;
const COLORS = [
  "Red", "Pink", "Orange", "Yellow", "Green", "Blue", "Purple", "Gold", "Silver", "Black", "Gray", "White", "Cream", "Brown", "Tan",
] as const;
const AVAILABILITY = ["available", "sold", "all"] as const;
const PARTY_STATUSES = ["all", "scheduled", "archived"] as const;

const CREDITS = "Costs 1 credit. Failed upstream calls are not charged; a not-found is charged.";
const ITEM =
  "listing_id, url, title, price {amount, currency}, original_price (the original price the seller entered, null when none), first_price (the price it was first listed at: above price after a price drop, below it when the seller raised the price), price_drop_percent, size, brand, brand_slug, condition, department, category, subcategories, colors, status (available, sold, not_for_sale), sold_at, picture_url, picture_count, like_count, comment_count, share_count, shipping_discount, seller_username, created_at, updated_at, market";
const LIST_OUT = `market, currency, sort, availability, filters, page, page_size, total, has_more, count, items (${ITEM}), facets (top 25 brands, colours and category counts)`;
const CONDITION_TEXT =
  "Condition filter: new_with_tags, new_with_tags_or_boutique, boutique (Boutique retail listings), like_new, good, fair. Item condition reads the same names (not_new_with_tags on some older listings; null when the seller set none).";
const SORT_TEXT = "Sorts: relevance (default), just_shared, just_in (newest listed), price_asc, price_desc, price_drop (recently price dropped), most_liked.";
const GRID =
  "48 listings per page; total is Poshmark's approximate count of matches; about 5,000 listings are reachable per query (page up to 105); has_more says if the next page has listings.";
const SOLD_PRICE =
  "On a sold listing, price is the price shown on the sold listing (Poshmark says a sold listing reflects the final order price; offers are private and not returned) and sold_at is the date Poshmark marked it sold.";
const SOLD_CAP =
  "Sold listings stop at 10 pages = 480 per query and filter combination (Poshmark's own limit): narrow with filters or split by price_min / price_max ranges to reach more; a sold page above 10 answers 400 before anything is charged.";
const GLOBAL_IDS = "Listing ids and closets are global: they open from either market, in the listing's own currency (no conversion).";
const PRIVACY = "Real names, avatars, cities, likers, comment authors and Love Note buyers are never returned (only seller usernames).";
const NOT_AVAILABLE =
  "Not available: Posh Shows, trending searches, the full brand directory (get_poshmark_brands gives the top 50; brand filters take any name), Love Notes beyond the latest 100, sold results beyond 480 per query and filter combination, offers, bundles, price history.";

const market = (global = false) =>
  z.enum(MARKETS).optional().describe(
    global
      ? "Optional: the Poshmark domain to ask, us (default, poshmark.com) or ca (poshmark.ca). The data is global: the same record answers on both, prices stay in the listing's own currency."
      : "Market (default us): us (poshmark.com, USD) or ca (poshmark.ca, CAD); results are that market's own listings in its currency. Any other country answers 400 before anything is charged.",
  );

const strList = (description: string, max = 10) =>
  z.union([z.string().min(1).max(400), z.array(z.string().min(1).max(80)).min(1).max(max)]).optional().describe(description);
const listingId = (description: string) => z.string().regex(/^[0-9a-fA-F]{24}$/).describe(description);
const searchPage = z.number().int().min(1).max(105).optional()
  .describe("Page, 1 to 105, 48 listings each (about 5,000 reachable per query). Sold listings stop at page 10.");
const availability = z.enum(AVAILABILITY).optional()
  .describe("available (default), sold or all. Sold pages stop at 10 (480 listings).");
const department = z.enum(DEPARTMENTS).optional().describe(`Department: ${DEPARTMENTS.join(", ")}.`);
const category = z.string().min(1).max(100).optional()
  .describe("Category slug or name from get_poshmark_categories (e.g. Bags, Pants_&_Jumpsuits). Needs department.");
const subcategory = z.string().min(1).max(100).optional()
  .describe("Subcategory slug or name from get_poshmark_categories (e.g. Totes, Leggings). Needs category.");
const brandList = z.union([z.string().min(1).max(80), z.array(z.string().min(1).max(80)).min(1).max(10)]).optional()
  .describe("Brand names as Poshmark writes them (items[].brand, get_poshmark_brands, get_poshmark_suggestions), one or up to 10, e.g. 'Coach'.");

const filters = {
  sort: z.enum(SORTS).optional().describe(SORT_TEXT),
  size: strList("Sizes as Poshmark writes them (items[].size, e.g. 10, M, OS), up to 10."),
  condition: z.enum(CONDITIONS).optional().describe(CONDITION_TEXT),
  color: strList(`Colours, up to 5: ${COLORS.join(", ")}.`, 5),
  price_min: z.number().min(0).max(1_000_000).optional().describe("Lowest price, whole units of the market's currency."),
  price_max: z.number().min(0).max(1_000_000).optional().describe("Highest price, whole units of the market's currency."),
};

const username = z.string().min(1).max(40)
  .describe("Closet username (poshmark.com/closet/<username>, items[].seller_username), e.g. 'thriftedbyher'.");

export function registerPoshmarkTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/poshmark/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_poshmark",
    `Search Poshmark listings in one market (us poshmark.com USD, ca poshmark.ca CAD): ${LIST_OUT}, query. availability available (default), sold or all. Filters: brand (up to 10), department, category / subcategory (from get_poshmark_categories), size, condition, color, price_min / price_max. ${SORT_TEXT} ${CONDITION_TEXT} ${GRID} ${SOLD_CAP} ${NOT_AVAILABLE} ${CREDITS}`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. 'lululemon align'."),
      country: market(),
      page: searchPage,
      availability,
      brand: brandList,
      department,
      category,
      subcategory,
      ...filters,
    },
    post("search"),
  );

  server.tool(
    "get_poshmark_sold",
    `Sold Poshmark listings by keyword, with sold prices and sold dates, in one market (us USD, ca CAD): ${LIST_OUT}, query (every item status sold, with sold_at). ${SOLD_PRICE} ${SOLD_CAP} total is Poshmark's approximate count of sold matches, far more than the 480 reachable. Filters: brand, department, category / subcategory, size, condition, color, price_min / price_max. ${SORT_TEXT} ${CREDITS}`,
    {
      query: z.string().min(1).max(200).describe("Search keywords, e.g. 'coach bag'."),
      country: market(),
      page: z.number().int().min(1).max(10).optional()
        .describe("Page, 1 to 10, 48 sold listings each (480 per query and filter combination)."),
      brand: brandList,
      department,
      category,
      subcategory,
      ...filters,
    },
    post("sold"),
  );

  server.tool(
    "get_poshmark_product",
    `One Poshmark listing in full by listing_id or link: listing_id, url, title, description, status (available, sold, not_for_sale), sold_at, market (the listing's market), price, original_price (seller-entered), first_price, price_drop_percent, price_drop_text, shipping {text, price, discounted_from}, shipping_discount, bundle_discount (the seller's bundle offer text), promotions, brand, brand_slug, condition, department, category, subcategories, category_path, size, sizes [{size, quantity_available, quantity_sold}], multi_size, colors, style_tags, pictures, video_count, like_count, comment_count, share_count, comments [{text, created_at}; no authors, @mentions of other users shown as @user], created_at, published_at, updated_at, seller {username, url, home_market, posh_ambassador (posh_ambassador, posh_ambassador_ii or null), super_seller, followers, following, listings, shares, items_sold (Poshmark's rounded figure, e.g. 700+), orders_shipped, love_notes, on_vacation, last_active_at, joined_at}, detail (full, or basic when only the core fields could be read). On a sold listing price is the price shown on the sold listing. ${GLOBAL_IDS} ${PRIVACY} ${CREDITS}`,
    {
      listing_id: listingId("Listing id (items[].listing_id, 24 hex characters), e.g. '6ad80f0dce5b0ace7ee9abd7'.").optional(),
      url: z.string().min(20).max(400).optional().describe("A poshmark.com or poshmark.ca listing link."),
      country: market(true),
    },
    post("product"),
  );

  server.tool(
    "get_poshmark_category",
    `One Poshmark category's listings in a market (us USD, ca CAD): department (required), category and subcategory (slugs or names from get_poshmark_categories); answers department / category / subcategory as Poshmark matched them, then ${LIST_OUT}. A category Poshmark does not know is a charged 404. availability available (default), sold or all. Filters: brand, size, condition, color, price_min / price_max. ${SORT_TEXT} ${GRID} ${SOLD_CAP} ${CREDITS}`,
    {
      department: z.enum(DEPARTMENTS).describe(`Department: ${DEPARTMENTS.join(", ")}.`),
      category,
      subcategory,
      country: market(),
      page: searchPage,
      availability,
      brand: brandList,
      ...filters,
    },
    post("category"),
  );

  server.tool(
    "get_poshmark_brand",
    `One Poshmark brand's listings in a market (us USD, ca CAD), optionally in one department and category: brand {id, name}, brand_slug, department, category, then ${LIST_OUT}. An unknown brand is a charged 404. availability available (default), sold or all. Filters: size, condition, color, price_min / price_max. ${SORT_TEXT} ${GRID} ${SOLD_CAP} ${CREDITS}`,
    {
      brand: z.string().min(1).max(80)
        .describe("One brand: its name (Coach, lululemon athletica) or slug (items[].brand_slug, e.g. lululemon_athletica)."),
      department,
      category,
      country: market(),
      page: searchPage,
      availability,
      ...filters,
    },
    post("brand"),
  );

  server.tool(
    "get_poshmark_closet",
    `A Poshmark closet (seller) by username: username, url, home_market, posh_ambassador (posh_ambassador, posh_ambassador_ii or null), super_seller, followers, following, listings, shares, items_sold (Poshmark's rounded figure, e.g. 700+), orders_shipped, love_notes (total received), on_vacation, last_active_at, joined_at, description. Closets are global. An unknown username is a charged 404. ${PRIVACY} ${CREDITS}`,
    { username, country: market(true) },
    post("closet"),
  );

  server.tool(
    "get_poshmark_closet_listings",
    `A Poshmark closet's listings, available (default) or sold, 48 per page: username, market (the seller's home market: listings are read there automatically, so prices are in its currency; still 1 credit), currency, availability, on_vacation (a closet on vacation hold shows no available listings), page, page_size, total, has_more, count, items (${ITEM}). ${SOLD_PRICE} ${CREDITS}`,
    {
      username,
      availability: z.enum(["available", "sold"]).optional().describe("available (default) or sold."),
      page: z.number().int().min(1).max(105).optional().describe("Page, 48 listings each."),
      country: market(true),
    },
    post("closet-listings"),
  );

  server.tool(
    "get_poshmark_love_notes",
    `The latest Love Notes a Poshmark closet received (buyer notes left with a 5-star rating): username, count (at most 100: Poshmark shows only the latest 100, no paging), total (all Love Notes received, from the closet's stats), complete, notes [{comment, created_at, listing_id, picture_url}]. No author is returned. Closets are global. An unknown username is a charged 404. ${CREDITS}`,
    { username, country: market(true) },
    post("love-notes"),
  );

  server.tool(
    "search_poshmark_closets",
    `Poshmark closets whose username matches a query, 24 per page: query, page, total, has_more, count, closets [{username, url, home_market, joined_at}]. Global (both markets). Use get_poshmark_closet for a closet's stats. ${CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("Part of a closet username, e.g. 'vintage'."),
      page: z.number().int().min(1).max(200).optional().describe("Page, 24 closets each."),
      country: market(true),
    },
    post("closets-search"),
  );

  server.tool(
    "get_poshmark_categories",
    `Poshmark's category tree (the same on us and ca): count (6 departments), category_count, subcategory_count, departments [{id, name, slug, categories [{id, name, slug, subcategories [{id, name, slug}]}]}]. Slugs are the department / category / subcategory inputs of search_poshmark, get_poshmark_sold, get_poshmark_category and get_poshmark_brand. Large answer. ${CREDITS}`,
    { country: market(true) },
    post("categories"),
  );

  server.tool(
    "get_poshmark_brands",
    `Poshmark's top 50 brands in a market: market, count, brands [{id, name}]. name is the input of get_poshmark_brand and the brand filter. The full brand directory is not available; brand inputs take any brand name. ${CREDITS}`,
    { country: market() },
    post("brands"),
  );

  server.tool(
    "get_poshmark_suggestions",
    `Poshmark brand and brand + category suggestions for a partial query in a market (us, ca): market, query, count, suggestions [{type (brand, brand_category), text, brand, brand_id, category}]. Poshmark suggests brands (and a brand's categories when the query names one brand), not free-text searches. ${CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'lulu'."),
      country: market(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_poshmark_parties",
    `Posh Parties of one market (us, ca; each market has its own parties): upcoming ones and those of the last few days (20). market, status, count, parties [{party_id, url, name, type (style, department, category, brand), status (scheduled, archived), start_time, end_time, listing_count, theme_brands, theme_departments, theme_categories [{department, category}], hosts (usernames), market}]. ${CREDITS}`,
    {
      country: market(),
      status: z.enum(PARTY_STATUSES).optional().describe("all (default), scheduled (upcoming) or archived (ended)."),
    },
    post("parties"),
  );

  server.tool(
    "get_poshmark_party_listings",
    `Listings shared to one Posh Party, 20 per page by cursor (ended parties still list): market, currency, party_id, count, has_more, next_cursor, items (${ITEM}). Party ids are per market: ask with the party's own market (another market's id answers only a few unrelated listings). An unknown party id answers 0 items. ${CREDITS}`,
    {
      party_id: listingId("Party id (parties[].party_id of get_poshmark_parties), e.g. '6af437b4ccaeb9c6a30f84a3'."),
      cursor: z.string().min(1).max(400).optional().describe("next_cursor of the previous page."),
      country: market(),
    },
    post("party-listings"),
  );

  server.tool(
    "get_poshmark_similar",
    `Listings Poshmark shows as similar to one listing (16, no paging), from the market asked (us USD, ca CAD; ask with the listing's own market): market, listing_id, count, items (${ITEM}). An unknown listing is a charged 404. ${CREDITS}`,
    {
      listing_id: listingId("Listing id (items[].listing_id), e.g. '6ad80f0dce5b0ace7ee9abd7'."),
      country: market(),
    },
    post("similar"),
  );
}
