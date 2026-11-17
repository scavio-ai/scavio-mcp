import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/bolcom.ts (bol.com, the Netherlands and
// Belgium, EUR). Storefronts follow BOLCOM_ENDPOINT_MARKETS: every endpoint
// serves nl-nl, be-nl and be-fr (country nl / be, language nl / fr; fr only
// with be). Cross-field rules the backend enforces and zod here does not:
// product takes exactly one of product_id, url or ean; offers one of
// product_id or url; seller and seller-products one of seller_id or url;
// brand one of brand_id or url; campaign one of campaign_id or url; nl + fr
// answers 400. No zod `.default()`: the MCP SDK would post a defaulted field
// on every call.

const SEARCH_SORTS = ["relevance", "popularity", "price_asc", "price_desc", "rating", "wishlist"] as const;
const LIST_SORTS = ["popularity", "price_asc", "price_desc", "rating", "wishlist"] as const;
const CONDITIONS = ["new", "refurbished", "second_hand"] as const;
const DELIVERY = ["today", "tomorrow", "evening", "sunday", "free_shipping"] as const;

const CHARGE = "Costs 2 credits. Failed upstream calls are not charged; a not-found is charged.";
const STORES =
  "Storefronts: nl-nl (bol.com Netherlands, Dutch), be-nl (Belgium, Dutch) and be-fr (Belgium, French), all EUR. Every answer carries country, language, storefront and currency.";
const IDS =
  "Product ids, EANs, category ids, seller ids and offer ids are the same on every storefront; prices, offers and stock can differ between the Netherlands and Belgium.";
const BEFR =
  "On be-fr bol's own texts are French, some partner titles stay Dutch, review_topics (topic and summary) come back in Dutch as bol serves them, and review texts are bol's own translation (is_translated).";
const PRICES =
  "Prices are numbers in euros. reference_price is the price bol shows next to the price: reference_price_type rrp (the supplier's recommended price, 'Adviesprijs') or most_shown_price (bol's most-shown non-promotional price over the last 90 days); discount_percent is against it, discount_shown when bol shows it struck through. bol shows no price history and no 30-day lowest price: to track prices, poll and store your own.";
const ITEM =
  "product_id (a string), title, url, brand (brand_id, name), category, rating (average, count), offer (the buy box: offer_id, price, reference_price, reference_price_type, discount_percent, discount_shown, condition, seller_id, seller_name, sold_by_bol, delivery_text, delivery_date, low_stock, labels with campaign_id), cheapest_second_hand and cheapest_refurbished when bol shows them, energy_label, image, family_id, sponsored (a paid placement). List items carry no EAN (get_bolcom_product has it)";
const LIST =
  "total (bol's count), count, sponsored_count, page, max_page, has_more, sort, sorts_offered, filters, filters_ignored, facets (id, name, values with id, count and applied; ranges with min / max)";
const NOT_BUILT =
  "Not available: search suggestions, review paging / sorting / star filter beyond the first 10, seller review texts, price history or 30-day lowest price, pickup points, bol Select member prices, a structured variant selector.";

const country = () =>
  z.enum(["nl", "be"]).optional()
    .describe("Storefront country: nl (default, bol.com Netherlands) or be (bol.com Belgium). Anything else answers 400 before anything is charged.");
const language = () =>
  z.enum(["nl", "fr"]).optional()
    .describe("Storefront language: nl (default) or fr (only with country be: storefront be-fr). nl + fr answers 400.");

const id = (description: string) =>
  z.union([z.string().min(1).max(20), z.number().int().positive()]).describe(description);
const productId = () =>
  z.string().regex(/^\d{6,20}$/).optional()
    .describe("A bol.com product id as a STRING (items[].product_id of a search answer), e.g. '9300000239314960'. 16 digits: too long for a JSON number, so never send it as a number.");

const page = (search: boolean) =>
  z.number().int().min(1).max(search ? 10 : 500).optional()
    .describe(search
      ? "Results page, 1-based, about 24-30 items per page. bol.com search stops at page 10 (about 280 results); higher answers 400."
      : "Results page, 1-500, 1-based, about 24 items per page (max_page in the answer; bol lists at most 500 pages, higher answers 400). A page past max_page answers an empty page with a note.");
const searchSort = () =>
  z.enum(SEARCH_SORTS).optional()
    .describe("relevance (default), popularity, price_asc, price_desc, rating or wishlist (most wished for). No newest sort. Sorting by anything but relevance can narrow bol's result set (measured 6,655 results down to 30); price sorts follow bol's own ordering, so small inversions against the live buy-box price occur.");
const listSort = () =>
  z.enum(LIST_SORTS).optional()
    .describe("popularity (default), price_asc, price_desc, rating or wishlist (most wished for). relevance is not offered on listing pages (400). Price sorts follow bol's own ordering; small inversions occur.");

const filterFields = {
  price_min: z.number().min(0).optional().describe("Lowest price in euros."),
  price_max: z.number().min(0).optional().describe("Highest price in euros."),
  condition: z.union([z.enum(CONDITIONS), z.array(z.enum(CONDITIONS)).min(1).max(3)]).optional()
    .describe("new, refurbished or second_hand (one or more)."),
  deals_only: z.boolean().optional().describe("Only products on a deal."),
  select_deals: z.boolean().optional().describe("Only bol Select member deals."),
  delivery: z.union([z.enum(DELIVERY), z.array(z.enum(DELIVERY)).min(1).max(5)]).optional()
    .describe("Delivery filters as bol offers them: today, tomorrow, evening, sunday, free_shipping (one or more)."),
  brand_facet_id: id("A brand VALUE id from the brand facet of an earlier answer (facets[].values[].id of the Merk / Marque facet, e.g. 4294862300 = Apple). A different id space from brand_id (items[].brand.brand_id, get_bolcom_brand): Apple is brand_facet_id 4294862300 but brand_id 5070005.").optional(),
  facets: z.array(z.union([z.string().min(1).max(12), z.number().int().positive()])).max(10).optional()
    .describe("Facet value ids from facets[].values[].id of an earlier answer (any facet: colour, size, rating band ...). Ids bol did not apply come back in filters_ignored."),
};

export function registerBolcomTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/bolcom/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_bolcom",
    `Search bol.com (the online marketplace of the Netherlands and Belgium) by keyword: items (${ITEM}), ${LIST}, dominant_category. Filters: category_id, price_min / price_max, condition, deals_only, select_deals, delivery, brand_facet_id and raw facet value ids. Search stops at page 10. Sponsored items are flagged. ${PRICES} ${IDS} ${BEFR} ${STORES} ${CHARGE}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'airpods' (Dutch or French work best; an EAN finds that product)."),
      country: country(),
      language: language(),
      page: page(true),
      sort: searchSort(),
      category_id: id("Search within one category: a category id from the category facet or a product's category_path, e.g. 8440.").optional(),
      ...filterFields,
    },
    post("search"),
  );

  server.tool(
    "get_bolcom_product",
    `One bol.com product by product_id, link or EAN, the competitor-price call: product_id, ean, title, subtitle, brand, description (plain text), specifications (group, name, key, value), category_path, buy_box (offer_id, price, reference_price and reference_price_type, discount_percent, condition, seller with seller_id, name, sold_by_bol, rating out of 10 and top_seller, shipping_cost, delivery_text, delivery_date, low_stock, labels), offer_count, cheapest_new, fastest_new (price and delivery promise), cheapest_second_hand, refurbished (grades with their cheapest offer), energy_label, images, video, series, rating (average, count, 1-5 distribution), review_topics and review_summary (bol's own AI-generated summaries; review_summary can be null), reviews (the first 10 as bol shows them, pooled across the product family, each with the product_id it was written for: rating, title, text, pros, cons, verified, is_translated, date, helpful counts; no reviewer names), more_reviews. By EAN the answer adds requested_ean. The 10 lowest-priced offers are on get_bolcom_offers. An unknown product answers 404 (charged). ${PRICES} ${IDS} ${BEFR} ${NOT_BUILT} ${STORES} Costs 2 credits (4 by EAN: a search plus the product page, billed on actual cost). Failed upstream calls are not charged; a not-found is charged.`,
    {
      product_id: productId(),
      url: z.string().min(20).max(500).optional()
        .describe("A bol.com product link (the url of a search or product answer); its storefront is used unless country / language are sent."),
      ean: z.string().min(8).max(14).optional()
        .describe("An EAN / GTIN (8, 12, 13 or 14 digits), e.g. '4242005483976': finds the product carrying it. 4 credits."),
      country: country(),
      language: language(),
    },
    post("product"),
  );

  server.tool(
    "get_bolcom_offers",
    `The lowest-priced 10 offers for one bol.com product, for price comparison and price monitoring: product_id, title, url, counts (new, refurbished, second_hand: all of the product's offers), offers (up to 10, lowest price first: offer_id, price, reference_price, reference_price_type, discount_percent, condition, refurbished_grade, second_hand_state, condition_note, shipping_cost, delivery_text, delivery_date, seller with seller_id, name, sold_by_bol, rating out of 10, top_seller, labels), count, has_more (true when bol has more offers than the 10 returned: the higher-priced ones are not returned and there is no paging). The list does not mark the buy box: get_bolcom_product's buy_box.offer_id names it. Fewer sellers ship to Belgium. An unknown product answers 404 (charged). ${PRICES} ${IDS} ${STORES} ${CHARGE}`,
    {
      product_id: productId(),
      url: z.string().min(20).max(500).optional()
        .describe("A bol.com product link or its price overview link."),
      country: country(),
      language: language(),
    },
    post("offers"),
  );

  server.tool(
    "get_bolcom_seller",
    `A bol.com seller's public profile by seller_id or link: seller (seller_id, name, url, active_since, description, rating out of 10 with up to four sub-ratings (product_info / delivery_time / shipping / service; some sellers have fewer), rating_method (recent_reviews: the last 3 months; all_reviews: all of the seller's reviews), reviews_used_for_rating, positive_percent (bol's positive percentage over those reviews), top_seller, reviews positive / neutral / negative / total, product_count, business: company_name, city, country, registration_number, vat_number and country_of_origin as bol publishes them under EU trader rules; no street address). Review texts are not returned. The seller's products are on get_bolcom_seller_products. An unknown seller answers 404 (charged). ${IDS} ${STORES} ${CHARGE}`,
    {
      seller_id: id("A bol.com seller id (offer.seller_id or buy_box.seller.seller_id of an answer), e.g. '1770745'. Seller id '0' is bol itself.").optional(),
      url: z.string().min(20).max(500).optional()
        .describe("A bol.com seller page link (seller.url of a seller answer) or the link of the seller's product list."),
      country: country(),
      language: language(),
    },
    post("seller"),
  );

  server.tool(
    "get_bolcom_seller_products",
    `The products a bol.com seller sells, by seller_id or link, paged and sorted: seller (seller_id, name), items (${ITEM}; offer is the product's buy box, which may be another seller's), ${LIST}. Defaults to popularity. ${PRICES} ${IDS} ${STORES} ${CHARGE}`,
    {
      seller_id: id("A bol.com seller id, e.g. '1767374'.").optional(),
      url: z.string().min(20).max(500).optional().describe("A bol.com seller page link."),
      country: country(),
      language: language(),
      page: page(false),
      sort: listSort(),
    },
    post("seller-products"),
  );

  server.tool(
    "get_bolcom_category",
    `Products in one bol.com category (category_id), paged, sorted and filtered like search_bolcom (price, condition, deals_only, select_deals, delivery, brand_facet_id, facets): category (category_id, name, url, breadcrumbs), items (${ITEM}), ${LIST}. Defaults to popularity; categories go deeper than search (up to page 500). An unknown category answers 404 (charged). ${PRICES} ${IDS} ${BEFR} ${STORES} ${CHARGE}`,
    {
      category_id: id("A bol.com category id (category_path[].category_id of a product, the category facet of a search), e.g. '8440'."),
      country: country(),
      language: language(),
      page: page(false),
      sort: listSort(),
      ...filterFields,
    },
    post("category"),
  );

  server.tool(
    "get_bolcom_brand",
    `Products of one brand on bol.com, by brand_id or a brand link, paged and sorted: brand (brand_id, name, premium_brand), items (${ITEM}), ${LIST}. Defaults to popularity. brand_id is items[].brand.brand_id (Apple 5070005), not the brand_facet_id search filter. An unknown brand answers 404 (charged). ${PRICES} ${IDS} ${STORES} ${CHARGE}`,
    {
      brand_id: id("A bol.com brand id (brand.brand_id of a search or product answer), e.g. '5070005' (Apple).").optional(),
      url: z.string().min(20).max(500).optional().describe("A bol.com brand page link."),
      country: country(),
      language: language(),
      page: page(false),
      sort: listSort(),
    },
    post("brand"),
  );

  server.tool(
    "get_bolcom_deals",
    `Today's bol.com deals as its deals page serves them: day_deal (title, campaign_id, url on the asked storefront, ends_at, highlighted_product) and category_deals (category_id, category_name, products with product_id, title, url, image and offer: price, reference price, discount, labels; deal products carry seller_id only), more_deal_category_ids, count. Open the day deal's products with get_bolcom_campaign and its campaign_id. ${PRICES} ${STORES} ${CHARGE}`,
    {
      country: country(),
      language: language(),
    },
    post("deals"),
  );

  server.tool(
    "get_bolcom_campaign",
    `The products of one bol.com promotion (a Black Friday deal list, the day deal ...) by campaign_id or link, paged and sorted: campaign (campaign_id, name, description, type, ends_at), items (${ITEM}; offer is each product's buy box, which does not always carry this campaign's label), ${LIST}. Defaults to popularity. An ended or unknown campaign answers 404 (charged). ${PRICES} ${IDS} ${STORES} ${CHARGE}`,
    {
      campaign_id: id("A bol.com campaign id (labels[].campaign_id of an offer, day_deal.campaign_id of get_bolcom_deals), e.g. '555136'.").optional(),
      url: z.string().min(20).max(500).optional().describe("A bol.com campaign (promotion) link."),
      country: country(),
      language: language(),
      page: page(false),
      sort: listSort(),
    },
    post("campaign"),
  );
}
