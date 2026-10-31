import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/samsclub.ts. No zod `.default()`: the MCP
// SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_low", "price_high", "top_selling"] as const;
const REVIEW_SORTS = ["newest", "oldest", "highest", "lowest", "most_helpful"] as const;

const sort = () =>
  z.enum(SORTS).optional()
    .describe("relevance, price_low, price_high or top_selling. Defaults to the site's own order.");

const itemId = () =>
  z.string().regex(/^\d{1,20}$/)
    .describe("Sam's Club item id: the number at the end of a samsclub.com/ip/ URL, or item_id from search, e.g. '19396800826'.");

const CLUB_NOTE = "Prices and stock are for a nearby club chosen by location, returned in club; use get_sams_club_product with club_id for a specific club.";

export function registerSamsClubTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/samsclub/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_sams_club",
    `Search Sam's Club. Each result has item_id, price, was_price and savings_amount, unit price, Instant Savings (amount, end date, purchase limit), rating, review count, stock, pickup/delivery/shipping availability and aisle. Up to 45 per page. ${CLUB_NOTE} 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'paper towels'."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      sort: sort(),
    },
    post("search"),
  );

  server.tool(
    "get_sams_club_product",
    `One Sam's Club item: online price and the club shelf price (club_price) with was price, savings and unit price, Instant Savings (amount, end date, limit), rating histogram, images, UPC, model, specifications, and fulfillment per method with stock status and aisle. Pass club_id (from get_sams_club_clubs) to price and stock a specific club. available_quantity is capped at 8: 8 means 8 or more. 1 credit.`,
    {
      item_id: itemId(),
      club_id: z.string().regex(/^\d{1,6}$/).optional()
        .describe("Sam's Club club number from get_sams_club_clubs, e.g. '6372'. club_price, in-club stock and aisle are then that club's."),
    },
    post("product"),
  );

  server.tool(
    "get_sams_club_clubs",
    `Sam's Club clubs near a US ZIP, nearest first, within 100 miles: club_id, name, address, coordinates, distance in miles, phone, opening hours, services and whether the club is temporarily closed. Use club_id with get_sams_club_product. 1 credit.`,
    {
      zip: z.string().regex(/^\d{5}$/)
        .describe("5-digit US ZIP code, e.g. '75201'."),
      limit: z.number().int().min(1).max(20).optional()
        .describe("Clubs to return, nearest first. 1-20, default 10."),
    },
    post("clubs"),
  );

  server.tool(
    "get_sams_club_savings",
    `Every item on Sam's Club Instant Savings, paged (up to 45 per page): price, was price and savings amount, plus each offer's amount, end date, purchase limit and the channels (shipping, pickup, delivery) it applies to. ${CLUB_NOTE} 1 credit/call.`,
    {
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      sort: sort(),
    },
    post("savings"),
  );

  server.tool(
    "get_sams_club_category",
    `Products in a Sam's Club category, paged, with the same fields as search_sams_club. Clearance is category 1150109. A category with nothing on its shelf returns an empty list. ${CLUB_NOTE} 1 credit/call.`,
    {
      category_id: z.string().regex(/^\d{1,12}$/)
        .describe("Category id: the number at the end of a samsclub.com /browse/ or /cp/ URL. Clearance is '1150109'."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based."),
      sort: sort(),
    },
    post("category"),
  );

  server.tool(
    "get_sams_club_reviews",
    `Customer reviews for a Sam's Club item, 10 per page: rating, title, text, author, date, verified purchase and helpful votes, plus the average rating, total count and 1-5 star breakdown. 1 credit/page.`,
    {
      item_id: itemId(),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based, 10 per page."),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("newest, oldest, highest, lowest or most_helpful."),
    },
    post("reviews"),
  );
}
