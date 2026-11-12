import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/allegro.ts (allegro.pl, plus allegro.cz,
// allegro.sk and allegro.hu on every endpoint). Cross-field rules the backend
// enforces and zod here does not: offer takes offer_id or url; product and
// product-offers take product_id or url; category takes category_id or url;
// buying_format and deals are pl only (a 400 on cz, sk and hu). No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const COUNTRIES = ["pl", "cz", "sk", "hu"] as const;
const SORTS = [
  "relevance",
  "price_low_to_high",
  "price_high_to_low",
  "price_with_delivery_low_to_high",
  "price_with_delivery_high_to_low",
  "popularity",
  "ending_soonest",
  "newest",
] as const;
const OFFER_SORTS = [
  "relevance",
  "price_low_to_high",
  "price_high_to_low",
  "price_with_delivery_low_to_high",
  "price_with_delivery_high_to_low",
  "popularity",
] as const;

const MARKETS = "pl (allegro.pl, PLN, Polish, default), cz (allegro.cz, CZK, Czech), sk (allegro.sk, EUR, Slovak) or hu (allegro.hu, HUF, Hungarian)";
const LANGUAGE = "Titles, parameters and labels come back in the site's language (Polish on pl), as the site writes them.";
const OMNIBUS = "lowest_price_30d is the EU price disclosure Allegro shows next to a discount: the lowest price of the offer in the 30 days before the discount (with discount_percent). It is null when there is no discount, and it is not a price history: to track prices, poll and store your own.";
const ITEM = "offer_id (for get_allegro_offer), product_id (for get_allegro_product and get_allegro_product_offers), title, url, image, price and currency, buy_now_price (auctions), price_with_delivery (when the page shows it), free_delivery, delivery_text (the delivery estimate as shown), condition, is_auction with auction_ends_in, discount_percent and lowest_price_30d, seller (id, login, super_seller, positive_feedback_percent, is_business), rating and rating_count, sold_count ('x people bought recently' as a number; null on auctions) with sold_label, smart (Allegro Smart!), offers_count (offers for the same product), stock, placement (regular, promoted, sponsored or featured) with is_sponsored, and source (allegro, or allegro_lokalnie for Allegro Lokalnie offers inside pl results)";
const GRID = `Items with ${ITEM}. Also total (the exact number of matches), total_pages (at most 100), page, page_size (60 organic per page; sponsored slots come on top), sort, applied_filters, facets (every filter with its values, url parameter and offer count), country, language and currency`;
const GRID_SHORT = "The same item fields, totals and facets as search_allegro";
const SLOW = "sk and hu calls can take up to about a minute.";
const CHARGE = "Failed upstream calls are not charged (they are retried automatically); a not-found is charged. 2 credits.";

const country = () => z.enum(COUNTRIES).optional()
  .describe(`The Allegro site: ${MARKETS}. Defaults to pl. Titles and labels come in the site's language, prices in its currency.`);

const page = () => z.number().int().min(1).max(100).optional()
  .describe("Results page, 1-based (up to 100). 60 organic offers per page; sponsored slots come on top.");
const sort = () => z.enum(SORTS).optional()
  .describe("relevance (default), price_low_to_high, price_high_to_low, price_with_delivery_low_to_high, price_with_delivery_high_to_low, popularity, ending_soonest (auctions first to end) or newest. Sponsored slots are not sorted; where the site shows promoted offers as their own block, each block is in sort order.");

const priceConditionFields = {
  min_price: z.number().min(0).max(100_000_000).optional()
    .describe("Lowest price, in the site's currency."),
  max_price: z.number().min(0).max(100_000_000).optional()
    .describe("Highest price, in the site's currency."),
  condition: z.enum(["new", "used"]).optional()
    .describe("new or used."),
  smart: z.boolean().optional()
    .describe("Only offers with Allegro Smart! (free delivery and returns for members)."),
};
const filterFields = {
  ...priceConditionFields,
  buying_format: z.enum(["buy_now", "auction"]).optional()
    .describe("pl only: buy_now (fixed price) or auction."),
  deals: z.boolean().optional()
    .describe("pl only: only offers in Allegro's deals and promotions zone (seasonal campaign deals such as Black Weeks included while they run)."),
};
const categoryId = (description: string) => z.union([z.string().min(1).max(160), z.number().int().min(0)]).optional()
  .describe(description);
const productId = () => z.string().min(1).max(64).optional()
  .describe("A catalogue product id (a uuid): items[].product_id of a search or product_id of an offer, e.g. '90d08230-e02a-4210-913d-d417453321b8'. Alternative to url.");
const productUrl = () => z.string().min(1).max(800).optional()
  .describe("A product link (allegro.pl/produkt/..., any of the four sites). Alternative to product_id.");
const login = () => z.string().min(2).max(64).regex(/^[A-Za-z0-9._-]+$/)
  .describe("A seller login: items[].seller.login of a search or seller.login of an offer, e.g. 'Yupilo_pl'.");

export function registerAllegroTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/allegro/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_allegro",
    `Search Allegro, the largest marketplace in Poland and Central Europe, by keyword: sort by price, price with delivery, popularity, ending soonest or newest; filter by price range, new or used, buy now or auction (pl), Allegro Smart! and deals (pl); optionally inside one category. Sponsored and promoted offers are flagged. Misspellings are not corrected. ${GRID}. ${OMNIBUS} ${LANGUAGE} Markets: ${MARKETS}. ${SLOW} ${CHARGE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, in any language, e.g. 'laptop' or 'buty nike'."),
      country: country(),
      page: page(),
      sort: sort(),
      category_id: categoryId("Search inside one category: a category id (category.id or breadcrumb[].id of an offer, e.g. 491 = laptops) or its slug (laptopy-491)."),
      ...filterFields,
    },
    post("search"),
  );

  server.tool(
    "get_allegro_offer",
    `One Allegro offer (one seller's listing, /oferta) by number or link: title, condition, status, price, original_price and lowest_price_30d with discount_percent on a discount, price_with_delivery, stock (units available as shown), sold_count (null on auctions and on cz, sk and hu offers), auction state (current price, minimum next bid, bid step, end time, whether anyone has bid) or buy now price, every parameter (EAN / GTIN, brand, model...), gtin, brand, the seller's description as plain text, images, breadcrumb, delivery methods with price and estimated delivery, handling time, returns (days), warranty, the product's rating and offer count (product_id for get_allegro_product_offers), and the seller (login, super seller, positive feedback percent and counts for the last 12 months, is_business, company_name for business sellers). No bid history. ${OMNIBUS} ${LANGUAGE} Markets: ${MARKETS}. ${SLOW} ${CHARGE}`,
    {
      offer_id: z.union([z.string().regex(/^\d{8,14}$/), z.number().int().min(0)]).optional()
        .describe("An offer number: items[].offer_id of a search, category or seller answer, e.g. '17858046919'. Alternative to url."),
      url: z.string().min(1).max(800).optional()
        .describe("An offer link (allegro.pl/oferta/..., or a product link with ?offerId=; any of the four sites). Alternative to offer_id."),
      country: country(),
    },
    post("offer"),
  );

  server.tool(
    "get_allegro_product",
    `One Allegro catalogue product (/produkt: one item that groups many sellers' offers) by id or link: title, brand, GTIN, parameters, images, breadcrumb, description, lowest_price and offer_count (every seller's offer is on get_allegro_product_offers), the cheapest and fastest offers as the page highlights them, the featured (buy box) offer with its price, 30-day lowest price, stock, sold count and seller, how many people bought it recently, the rating (average, count, 1-5 star distribution), review aspects (topic, sentiment, mention counts) and the first 20 reviews as shown on the product page (rating, text, pros, cons, author as published e.g. 'b...y', date, helpful votes, images, is_best). Not the full review history. ${LANGUAGE} Markets: ${MARKETS}. ${SLOW} ${CHARGE}`,
    {
      product_id: productId(),
      url: productUrl(),
      country: country(),
    },
    post("product"),
  );

  server.tool(
    "get_allegro_product_offers",
    `Every seller's offer for one Allegro catalogue product: the price comparison page, for price monitoring across sellers. 60 offers per page, sortable by price or price with delivery and filterable by condition, price and Allegro Smart!. Each offer has price, price_with_delivery, delivery_text, condition, seller (login, super seller, positive feedback percent and count, is_business), smart, stock where shown, is_featured (the buy box offer) and the listing fields of search_allegro. Also total, total_pages, page and facets. Promoted offers can come first as their own block. ${LANGUAGE} Markets: ${MARKETS}. ${SLOW} ${CHARGE}`,
    {
      product_id: productId(),
      url: productUrl(),
      country: country(),
      page: page(),
      sort: z.enum(OFFER_SORTS).optional()
        .describe("relevance (default), price_low_to_high, price_high_to_low, price_with_delivery_low_to_high, price_with_delivery_high_to_low or popularity."),
      ...priceConditionFields,
    },
    post("product-offers"),
  );

  server.tool(
    "get_allegro_seller",
    `One Allegro seller's offers by login, with the seller (id, login, is_business, url; the super seller status, feedback score and member since are on get_allegro_seller_feedback), whether the seller is active, and the categories the seller sells in (with offer counts and a slug for category); search within the seller's offers and use the search sorts and filters. ${GRID_SHORT}. No seller address or tax id. ${LANGUAGE} Markets: ${MARKETS}. ${SLOW} ${CHARGE}`,
    {
      login: login(),
      country: country(),
      query: z.string().min(1).max(200).optional()
        .describe("Search within the seller's offers."),
      category: z.string().min(1).max(120).optional()
        .describe("Only one of the seller's categories: categories[].slug of a previous get_allegro_seller answer (e.g. komputery)."),
      page: page(),
      sort: sort(),
      ...filterFields,
    },
    post("seller"),
  );

  server.tool(
    "get_allegro_seller_feedback",
    `One Allegro seller's buyer ratings: summary (recommended and not recommended counts, unique counts, positive_percent, received, excluded and removed ratings, member_since, super_seller) and 20 ratings per page, newest first, each with recommended yes / no, comment, the reasons given (e.g. on-time delivery), date, the offers rated, and whether it was excluded from the score and why. No buyer identity is returned. ${LANGUAGE} Markets: ${MARKETS}. ${SLOW} ${CHARGE}`,
    {
      login: login(),
      country: country(),
      page: z.number().int().min(1).max(500).optional()
        .describe("Ratings page, 1-based (up to 500). 20 ratings per page, newest first."),
    },
    post("seller-feedback"),
  );

  server.tool(
    "get_allegro_category",
    `One Allegro category's offers by id or link, with the same sorts and filters as search_allegro and an optional query, plus the category (id, name, url, breadcrumb, subcategories or sibling categories with offer counts). ${GRID_SHORT}. ${LANGUAGE} Markets: ${MARKETS}. ${SLOW} ${CHARGE}`,
    {
      category_id: categoryId("A category id (e.g. 491 = laptops) or its slug (laptopy-491): breadcrumb[].id of an offer or subcategories[].id of a category answer. Alternative to url."),
      url: z.string().min(1).max(800).optional()
        .describe("A category link (allegro.pl/kategoria/..., any of the four sites), e.g. 'https://allegro.pl/kategoria/laptopy-491'. Alternative to category_id."),
      country: country(),
      query: z.string().min(1).max(200).optional()
        .describe("Search within the category."),
      page: page(),
      sort: sort(),
      ...filterFields,
    },
    post("category"),
  );
}
