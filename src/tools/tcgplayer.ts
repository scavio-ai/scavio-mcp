import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/tcgplayer.ts (tcgplayer.com, US
// marketplace, USD). Cross-field rules the backend enforces and zod here does
// not: product, listings, price history and sales take product_id OR url;
// search needs a query unless game or set is given. No zod `.default()`: the
// MCP SDK would post a defaulted field on every call.

const SEARCH_SORTS = ["relevance", "best_match", "best_selling", "name_asc", "price_asc", "price_desc"] as const;
const LISTING_SORTS = ["price_shipping", "price"] as const;
const HISTORY_RANGES = ["month", "quarter", "semi_annual", "annual"] as const;
const PRODUCT_TYPES = ["cards", "sealed"] as const;
const TRENDING_GAMES = ["all", "pokemon", "magic", "yugioh"] as const;
const CONDITIONS = "Near Mint, Lightly Played, Moderately Played, Heavily Played, Damaged, Unopened (or NM, LP, MP, HP, DM, U)";

const PRODUCT_FIELDS = "product id, name, URL, image, game, set name, code and id, card number, rarity, product type, sealed and foil-only flags, release date, market price, median price, lowest price, lowest price with shipping and listing count";

const productId = () => z.union([z.number().int().positive(), z.string().regex(/^\d{1,10}$/)]).optional()
  .describe("TCGplayer product id, the number after /product/ in a tcgplayer.com URL (a search result's product_id), e.g. 219058.");
const productUrl = () => z.string().min(1).max(600).optional()
  .describe("A tcgplayer.com product URL (/product/<id>/...). Used when product_id is not given.");
const game = () => z.string().min(1).max(80).optional()
  .describe("Game (product line) url_name from get_tcgplayer_games: pokemon, magic, yugioh, pokemon-japan, one-piece-card-game, lorcana-tcg...");
const sellerKey = () => z.string().min(4).max(16)
  .describe("TCGplayer seller key, a listing's seller.key (8 characters), e.g. '58f7acae'.");
const searchSort = () => z.enum(SEARCH_SORTS).optional()
  .describe("relevance (default), best_match, best_selling, name_asc, price_asc or price_desc (by market price). relevance and best_match rankings shift between calls and page 2+ drops products already seen (duplicates_removed), so a price or name sort pages more predictably.");
const searchPage = () => z.number().int().min(1).max(200).optional()
  .describe("Results page, 1-based, up to 200. Defaults to 1.");
const searchLimit = () => z.number().int().min(1).max(50).optional()
  .describe("Products per page, 1-50. Defaults to 24.");
const textList = (example: string, description: string) =>
  z.union([z.array(z.string().min(1).max(40)).max(10), z.string().min(1).max(200)]).optional()
    .describe(`${description} Array or comma-separated string, e.g. ${example}.`);

export function registerTcgplayerTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/tcgplayer/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_tcgplayer",
    `Search TCGplayer (US marketplace, USD) for trading cards and sealed products across every game (Pokemon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Lorcana and 60+ more), up to 50 per page, sorted by relevance, best match, best selling, name or market price, filtered by game, set, rarity and cards vs sealed. query is optional when game or set is given, to browse it. Each product has ${PRODUCT_FIELDS}, plus up to 3 featured live listings (price, shipping, condition, printing, seller). Also returns total_results, has_more and the filter facets (game, set, rarity, product type, card type, condition, language, printing...) with counts; a facet's url_value is what game and set accept. Use a result's product_id with get_tcgplayer_product, get_tcgplayer_listings, get_tcgplayer_price_history or get_tcgplayer_sales. 1 credit.`,
    {
      query: z.string().max(200).optional()
        .describe("Search keywords, e.g. 'charizard'. Optional when game or set is given."),
      game: game(),
      set: z.string().min(1).max(80).optional()
        .describe("Only this set, by url_name from get_tcgplayer_sets (or a set facet's url_value), e.g. 'base-set'."),
      rarity: z.string().min(1).max(60).optional()
        .describe("Only this rarity, as spelled in the rarity facet (e.g. Common, Rare, Holo Rare, Secret Rare)."),
      product_type: z.enum(PRODUCT_TYPES).optional()
        .describe("cards (single cards) or sealed (booster boxes, packs, decks, tins...)."),
      sort: searchSort(),
      page: searchPage(),
      limit: searchLimit(),
    },
    post("search"),
  );

  server.tool(
    "get_tcgplayer_product",
    "One TCGplayer product (US marketplace, USD) by product id or URL: name, URL, images (200, 400 and 1000 px), game, set, card number, rarity, product type, release date, market, median and lowest listing price, listing and seller counts, card text, flavor text, the game's card attributes (Pokemon HP, stage, energy type, attacks, weakness, retreat cost; Magic color, mana value, type line, power, toughness; Yu-Gi-Oh! attribute, monster type, level, ATK, DEF...) and every SKU (condition x printing x language, e.g. Near Mint / Normal / English) with its market price, lowest_sale_price and highest_sale_price over recent sales, sale_count (the sales behind the market price) and when it was calculated. The sale fields are sale statistics, not live listings; use get_tcgplayer_listings for offers. An unknown id is a 404 (not billed). 1 credit.",
    {
      product_id: productId(),
      url: productUrl(),
    },
    post("product"),
  );

  server.tool(
    "get_tcgplayer_listings",
    "Live marketplace listings for one TCGplayer product (US, USD), cheapest first by price plus shipping (default) or by item price, up to 50 per page, filtered by condition, printing, language, verified sellers or TCGplayer Direct. Each listing has listing id, price, shipping, total, quantity, condition, printing, language, listing type (standard or custom, with the custom title and description) and the seller: key, id, name, URL, rating percent, sales band, gold star, verified and Direct flags, programs and location. Also returns total_results, has_more and condition / printing / language / listing type counts. Use a seller.key with get_tcgplayer_seller. 1 credit.",
    {
      product_id: productId(),
      url: productUrl(),
      condition: textList("['Near Mint']", `Only these conditions: ${CONDITIONS}.`),
      printing: textList("['Foil']", "Only these printings, as a product's skus[].printing spells them (Normal, Foil, Holofoil, Reverse Holofoil, 1st Edition, Unlimited...)."),
      language: textList("['English']", "Only these languages (English, Japanese, French, German, Italian, Spanish, Portuguese, Korean, Chinese (S), Chinese (T), Russian)."),
      verified_sellers: z.boolean().optional().describe("Only verified sellers."),
      direct_only: z.boolean().optional().describe("Only TCGplayer Direct sellers."),
      sort: z.enum(LISTING_SORTS).optional()
        .describe("price_shipping (default, cheapest price plus shipping first) or price (item price only)."),
      page: z.number().int().min(1).max(200).optional()
        .describe("Page, 1-based, up to 200. Defaults to 1."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Listings per page, 1-50. Defaults to 10."),
    },
    post("listings"),
  );

  server.tool(
    "get_tcgplayer_price_history",
    "Sales price history for one TCGplayer product (US, USD) over a month, quarter (default), half year or year, per SKU (condition, printing, language): total quantity sold, transaction count, average daily sales, and buckets newest first (daily for month, 3-day for quarter, weekly for semi_annual and annual) with market price, quantity sold, transaction count and the low and high sale price with and without shipping (null for a bucket with no sales). Totals across SKUs included. This is the tool for sold volume and price trends. A product with no history is a 404. 1 credit.",
    {
      product_id: productId(),
      url: productUrl(),
      range: z.enum(HISTORY_RANGES).optional()
        .describe("month (daily buckets), quarter (default, 3-day buckets), semi_annual (weekly) or annual (weekly)."),
    },
    post("price-history"),
  );

  server.tool(
    "get_tcgplayer_sales",
    "The 5 most recent sales of one TCGplayer product (US, USD), optionally only in some conditions: order date, condition, printing, language, quantity, sale price, shipping, total and listing type. TCGplayer shows only the newest 5, so this is not a full sold history; use get_tcgplayer_price_history for volume and daily or weekly sale ranges. 1 credit.",
    {
      product_id: productId(),
      url: productUrl(),
      condition: textList("['Near Mint']", `Only sales in these conditions: ${CONDITIONS}.`),
    },
    post("sales"),
  );

  server.tool(
    "get_tcgplayer_games",
    "Every game (product line) on TCGplayer, 70+ (Magic: The Gathering, Yu-Gi-Oh!, Pokemon, One Piece, Lorcana...): game_id, name, url_name (what search_tcgplayer, get_tcgplayer_sets and get_tcgplayer_seller_products accept as game) and whether TCGplayer Direct carries it. No parameters. 1 credit.",
    {},
    async () => {
      try {
        const data = await getClient().post("/api/v1/tcgplayer/games", {});
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_tcgplayer_sets",
    "Every set of one TCGplayer game, newest release first: set_id (for get_tcgplayer_price_guide), name, url_name (for search_tcgplayer's set filter), abbreviation, release date and the supplemental flag. An unknown game is a 404. 1 credit.",
    {
      game: z.union([z.string().min(1).max(80), z.number().int().positive()])
        .describe("Game url_name or game_id from get_tcgplayer_games (pokemon, magic, yugioh, or 3, 1, 2...)."),
    },
    post("sets"),
  );

  server.tool(
    "get_tcgplayer_price_guide",
    "The TCGplayer price guide for one whole set (US, USD): one row per product per condition and printing with product id, name, URL, card number, rarity, market price and low price, for cards (default) or sealed products, up to 500 rows per page. total_results is given for cards (null for sealed). A set with nothing in the guide is a 404. 1 credit.",
    {
      set_id: z.union([z.number().int().positive(), z.string().regex(/^\d{1,8}$/)])
        .describe("Set id from get_tcgplayer_sets, e.g. 604 (Pokemon Base Set)."),
      product_type: z.enum(PRODUCT_TYPES).optional()
        .describe("cards (default) or sealed."),
      page: z.number().int().min(1).max(100).optional()
        .describe("Page, 1-based, up to 100. Defaults to 1."),
      limit: z.number().int().min(1).max(500).optional()
        .describe("Rows per page, 1-500. Defaults to 100. One row per card per condition and printing."),
    },
    post("price-guide"),
  );

  server.tool(
    "get_tcgplayer_suggestions",
    "The TCGplayer search-box autocomplete for a partial query (no game filter): suggested products (product id, name, URL, set, game, score), matching sets and the games the matches come from with counts. 1 credit.",
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'charizard'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_tcgplayer_trending",
    "What shoppers are searching on TCGplayer right now, overall or for Pokemon, Magic or Yu-Gi-Oh!: up to 10 terms with a popularity score. 1 credit.",
    {
      game: z.enum(TRENDING_GAMES).optional()
        .describe("all (default), pokemon, magic or yugioh."),
    },
    post("trending"),
  );

  server.tool(
    "get_tcgplayer_seller",
    "One TCGplayer seller by seller key (a listing's seller.key): store name, URL, location, member since, lifetime sales band, completed sales rank, rating percent, gold star, Direct, Pro, certified hobby shop and WPN flags, US and international shipping, store hours, games sold, social links, and the last 365 days of buyer feedback summarized (total, percent positive, count per star, as described / arrived when expected / good communication). An unknown key is a 404. 1 credit.",
    {
      seller_key: sellerKey(),
    },
    post("seller"),
  );

  server.tool(
    "get_tcgplayer_seller_feedback",
    "Individual buyer feedback on one TCGplayer seller from the last 365 days, newest first, up to 50 per page, optionally only one star rating or only feedback with a comment: date, rating, comment, as described / arrived when expected / good communication, and the buyer's masked nickname as the site shows it. Also total_results as TCGplayer reports it (approximate under the rating and with_comment filters) and has_more (true when the page is full). 1 credit.",
    {
      seller_key: sellerKey(),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only feedback with this many stars, 1-5."),
      with_comment: z.boolean().optional()
        .describe("Only feedback that has a written comment."),
      page: z.number().int().min(1).max(500).optional()
        .describe("Page, 1-based, up to 500. Defaults to 1."),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Feedback per page, 1-50. Defaults to 10."),
    },
    post("seller-feedback"),
  );

  server.tool(
    "get_tcgplayer_seller_products",
    `The products one TCGplayer seller has listed (US, USD), optionally matching keywords or one game, up to 50 per page, sorted like search_tcgplayer. Each product has ${PRODUCT_FIELDS}, plus the seller's own listings of it (price, shipping, condition, printing, language, quantity). Also total_results, has_more and facets. 1 credit.`,
    {
      seller_key: sellerKey(),
      query: z.string().max(200).optional()
        .describe("Only the seller's products matching these keywords, e.g. 'charizard'. Optional."),
      game: game(),
      sort: searchSort(),
      page: searchPage(),
      limit: searchLimit(),
    },
    post("seller-products"),
  );
}
