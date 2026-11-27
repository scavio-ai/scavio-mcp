import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/qvc.ts (QVC + HSN, the video shopping networks of QVC Group). Rules the backend
// enforces and zod here does not: the per-endpoint site and market allowlist (a refused pair is a 400, never billed),
// item number formats per market, product and reviews take item_number or url, category takes url or path, hour goes
// with date, and parameters of the other site (department on qvc, filters on hsn) are refused. No zod `.default()`:
// the MCP SDK would post a defaulted field on every call.

const SITE =
  "QVC (qvc.com) and HSN (hsn.com), the video shopping networks of QVC Group; site qvc (default) or hsn; QVC markets us (qvc.com, USD), uk (qvcuk.com, GBP), de (qvc.de, EUR), it (qvc.it, EUR) and jp (qvc.jp, JPY); HSN is US only. Data comes in each storefront's language and currency";
const ONE =
  "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged. Usually 2 to 20 s: allow a client timeout of at least 90 s.";
const QVC_PRICE =
  "price is the current selling price; qvc_price is QVC's own everyday price; special_price names QVC's price code as given (TSV = Today's Special Value, SPB = Black Friday Sale, ...) with its window when given; easy_pay lists Easy Pay instalments as given.";
const HSN_PRICE = "price is the current price; original_price is HSN's struck price; flexpay lists FlexPay instalments as given.";
const QVC_ITEM =
  "position, item_number (what get_qvc_product, get_qvc_products and get_qvc_reviews take), title, brand, url, image, currency, price, price_max, qvc_price, qvc_price_max, price_with_shipping and qvc_price_with_shipping (uk, as given), special_price {code, description, badge, starts_at, ends_at}, comparison_price (it), easy_pay [{code, installments, installment_amount, text}], shipping_charge, rating, review_count, added_to_cart_last_week (as given), stock (in_stock, sold_out or waitlist), promo_text, colors, last_on_air";
const HSN_ITEM =
  "position, item_number (what get_qvc_product and get_qvc_reviews take with site hsn), sku, title, brand, url, image, currency, price, original_price, percent_off, flexpay {payments, amount}, shipping_charge, note (Free Shipping...), flag (Customer Pick, Clearance, Today's Special...), todays_special {today, presale, post_sale}, badge, on_air_today, available, categories";

const MARKETS = ["us", "uk", "de", "it", "jp"] as const;
const SORTS = ["relevance", "newest", "top_sellers", "rating", "recently_on_air", "price_desc", "price_asc", "featured", "best_selling"] as const;
const QVC_SORTS = ["relevance", "newest", "top_sellers", "rating", "recently_on_air", "price_desc", "price_asc"] as const;

const site = z.enum(["qvc", "hsn"]).optional()
  .describe("qvc (default) or hsn.");
const market = (allowed: string) =>
  z.enum(MARKETS).optional()
    .describe(`QVC market: ${allowed}. Defaults to us. HSN serves the US only (leave market unset or us).`);
const page = z.number().int().min(1).max(100).optional()
  .describe("Results page, 1-based (1 to 100). Defaults to 1; total_pages reports the last one.");
const itemTarget = {
  item_number: z.string().min(1).max(20).optional()
    .describe("The item number from items[].item_number: QVC US a letter and digits (e.g. 'K341654'); QVC UK, DE, IT and JP digits (e.g. '833632'); HSN a product id (e.g. '23550176'). Send item_number or url."),
  url: z.string().min(1).max(800).optional()
    .describe("Or a product link: qvc.com /p/<name>/<item>, qvcuk.com, qvc.de, qvc.it, qvc.jp, or hsn.com /products/<name>/<id>."),
};
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const network = z.enum(["hsn", "hsn2"]).optional()
  .describe("HSN network: hsn (default) or hsn2.");

export function registerQvcTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string, fixed: Record<string, unknown> = {}) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/qvc/${path}`, { ...params, ...fixed });
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_qvc",
    `${SITE}. Keyword search. site qvc: 7 sorts, 1 to 96 a page (default 24), facet filters on us, uk and de; returns query, page, page_size, total, total_pages, has_more, count, sort, filters_applied, facets [{id, name, multi_select, values [{name, count, filter, selected}]}] and items [${QVC_ITEM}]. site hsn: 6 sorts, 60 a page (fixed), a department filter; returns the same paging fields, department, departments [{code, name, count}] and items [${HSN_ITEM}] (HSN search results carry no star rating; get_qvc_product has it). ${QVC_PRICE} ${HSN_PRICE} Captured 2026-11-27: blender on QVC US gave 102 results over 5 pages, the first the Ninja Professional Plus Duo Blender with Auto IQ at 99.98 USD against a QVC price of 159.99, rated 4.67 from 950 reviews; ring on HSN gave 687 results over 12 pages. ${ONE}`,
    {
      site,
      market: market("us, uk, de, it or jp"),
      query: z.string().min(1).max(200)
        .describe("Search keywords, in the market's language, e.g. 'blender'."),
      sort: z.enum(SORTS).optional()
        .describe("qvc: relevance (default), newest, top_sellers, rating, recently_on_air (not on jp), price_desc, price_asc. hsn: featured (default), best_selling, rating, newest, price_desc, price_asc."),
      filters: z.array(z.string().min(1).max(40)).max(10).optional()
        .describe("qvc us, uk and de: up to 10 facet tokens from a previous answer's facets[].values[].filter (a brand, price band, rating, category...), e.g. ['8c::1z139k3']. One category token at most."),
      department: z.string().min(1).max(6).optional()
        .describe("hsn: a department code from a previous answer's departments[].code (e.g. 'j' Jewelry, 'fa' Fashion, 'ho' Home)."),
      page,
      page_size: z.number().int().min(1).max(96).optional()
        .describe("qvc: 1 to 96 a page, default 24. hsn: 60 (fixed; leave unset)."),
    },
    post("search"),
  );

  server.tool(
    "get_qvc_product",
    `One product of ${SITE}, by item number or link. site qvc: the search item fields plus brand_id, description, bullets, retail_value with retail_value_reason as given (e.g. If Purchased Separately), price_excluding_tax and tax (jp), shipping_text, auto_delivery {text}, first_available, sold_last_30_days (as given), max_order_quantity, categories, images, promotions, protection_plans and variants [{color_code, color, size_code, size, stock (in_stock, sold_out, waitlist), buyable, price, qvc_price, retail_value, price_with_shipping, delivery_days}]; stock is QVC's flag, QVC publishes no unit counts. site hsn: item_number, sku, item_code, title, brand, url, price, original_price, shipping_charge, flexpay, flexpay_options [{text, payments, amount, card_only}], flag, todays_special, sale_time_remaining (HSN's countdown as given), on_air_today, rating, review_count, has_warranty, primary_category, description, images, variant_count and variants [{item_number, sku, color_code, color, size_code, size, plus_size, stock (available, low_inventory, sold_out), units_left (when HSN shows it)}]; HSN variants carry no price of their own. ${QVC_PRICE} Captured 2026-11-27: the GE Profile Opal Mini Pro Nugget Ice Maker w/ Side Tank (K341654) was 279.98 USD against a QVC price of 379, a Today's Special Value from 2026-11-23 to 2026-12-01, rated 4.43 from 46 reviews; an HSN legging had 31 variants at 22.96 USD (was 27). An unknown item is a charged not-found. ${ONE}`,
    {
      site,
      market: market("us, uk, de, it or jp"),
      ...itemTarget,
    },
    post("product"),
  );

  server.tool(
    "get_qvc_products",
    `Up to 20 QVC products in one call (qvc.com us or qvc.it it; HSN has no batch): requested, count, items [item_number, title, brand, url, image, currency, price, price_max, qvc_price, retail_value, special_price {code, description, starts_at, ends_at}, easy_pay, rating, review_count, stock] in the order asked, and not_found (the item numbers that do not exist). A summary per item: get_qvc_product has the variants and full detail. ${QVC_PRICE} Captured 2026-11-27: two US item numbers returned both, the GE Profile Opal Mini Pro at 279.98 USD. ${ONE}`,
    {
      market: z.enum(["us", "it"]).optional()
        .describe("QVC market: us (default) or it."),
      item_numbers: z.array(z.string().min(1).max(20)).min(1).max(20)
        .describe("1 to 20 QVC item numbers, e.g. ['K341654', 'K82223', 'A700206']."),
    },
    post("products"),
  );

  server.tool(
    "get_qvc_todays_special",
    `Today's special on QVC (qvc.com, us) or HSN (hsn.com). site qvc: the Today's Special Value item: headline, subline, item_number, window {code, description, starts_at, ends_at} (UTC, as QVC gives it; QVC can extend TSV pricing past the TV day) and item (the full product as get_qvc_product returns it). site hsn: current {item_number, title, price, original_price, flexpay, sale_time_remaining (HSN's countdown as given), url, image}, item (the current item in full), count, items (the Today's Specials list, about 9, each flagged today, presale or post_sale: ${HSN_ITEM}) and list_complete (false when the list could not be read this time). Captured 2026-11-27: QVC's Today's Special Value was the Diamonique Set of 5 Boxed Jewelry Gifts at 49.98 USD (QVC price 67) from 2026-11-25 to 2026-12-05; HSN's Today's Special was a set of 2 rechargeable flashlights at 39.99 USD (was 59.99). ${ONE}`,
    {
      site,
    },
    post("todays-special"),
  );

  server.tool(
    "get_qvc_on_air",
    `What is on air now on each QVC channel (qvc.com, us: QVC, QVC2, QVC3, QVC Home; HSN has none): count and channels [{channel_code, channel, item_number, item (the item's price summary: title, price, qvc_price, special_price, easy_pay, url, image...; null when QVC gave none)}]. Captured 2026-11-27: 4 channels, each with its item on air. ${ONE}`,
    {},
    post("on-air"),
  );

  server.tool(
    "get_qvc_program_guide",
    `The TV program guide of QVC (qvc.com, us) or HSN (hsn.com). site qvc: one day for every QVC channel (or one), in Eastern, Central, Mountain or Pacific time, 14 days back to 17 ahead: date, time_zone, channel_count, show_count, channels [{channel_code, channel, shows [{start, end (with the time zone's UTC offset), duration_hours, show_name, show_code, source_code, description}]}]. site hsn: one day of HSN or HSN2, hourly, Eastern time: date, network, show_count, shows [{time, start, hour, show_name, network, items_aired {date, hour, network}}] (items_aired is what get_qvc_recently_aired takes). Show names are as the guide lists them; on-air host and guest names are not included (a QVC show description that names one is null). Captured 2026-11-27: the QVC channel listed 14 shows on 2026-11-26; HSN listed 24 hourly shows. ${ONE}`,
    {
      site,
      date: ymd.optional()
        .describe("YYYY-MM-DD (US Eastern day). Defaults to today. qvc: 14 days back to 17 ahead."),
      time_zone: z.enum(["eastern", "central", "mountain", "pacific"]).optional()
        .describe("qvc: eastern (default), central, mountain or pacific."),
      channel: z.string().min(1).max(30).optional()
        .describe("qvc: one channel by code or name (QVC, 2CH / QVC2, STA / QVC3, ONQ / QVC Home). Defaults to all."),
      network,
    },
    post("program-guide"),
  );

  server.tool(
    "get_qvc_recently_aired",
    `The items HSN (hsn.com) presented in one show hour of HSN or HSN2 (Eastern time; QVC is not offered here): date, hour, network, show {time, start, hour, show_name, selected}, count, items [${HSN_ITEM}] and shows (the day's other hours). Defaults to the latest show; an hour that has not aired yet can be empty. ${HSN_PRICE} Captured 2026-11-27: the 9 PM show listed 2 items, the first a neck and shoulder massager at 49.99 USD (was 59.99). ${ONE}`,
    {
      date: ymd.optional()
        .describe("YYYY-MM-DD (Eastern). Defaults to today."),
      hour: z.number().int().min(0).max(23).optional()
        .describe("Show hour 0-23 (Eastern), with date: a program guide row's items_aired.hour. Defaults to the latest show."),
      network,
    },
    post("recently-aired", { site: "hsn" }),
  );

  server.tool(
    "get_qvc_category",
    `One category or collection grid of QVC (qvc.com, us), 96 a page: path, url, title, page, page_size, total, total_pages, has_more, count, sort and items [position, item_number, title, url, image, currency, price, was_price, price_code (TSV, SPB, ...), easy_pay_count, promo_text, rating, review_count, added_to_cart_last_week]. HSN categories are not offered yet (search_qvc with site hsn and a department covers HSN's departments). An unknown link is a charged not-found. Captured 2026-11-27: the QVC Clearance Sale collection held 8551 items over 90 pages, the first a holiday throw at 11.99 USD. ${ONE}`,
    {
      url: z.string().min(1).max(800).optional()
        .describe("A qvc.com category or collection link: /c/<name>/-/<group>/c.html or /collections/<name>.html. Send url or path."),
      path: z.string().min(1).max(300).optional()
        .describe("Or the same link's path, e.g. '/collections/deals-clearance.html'."),
      sort: z.enum(QVC_SORTS).optional()
        .describe("relevance (default), newest, top_sellers, rating, recently_on_air, price_desc, price_asc."),
      page,
    },
    post("category"),
  );

  server.tool(
    "get_qvc_suggestions",
    `The QVC search-box suggestions for a partial query (us, uk or de; HSN has none): query, count, suggestions (search terms) and products (the suggested items, with the search item fields). Captured 2026-11-27: blen on QVC US gave 7 suggestions and 4 products. ${ONE}`,
    {
      market: z.enum(["us", "uk", "de"]).optional()
        .describe("QVC market: us (default), uk or de."),
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'blen'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_qvc_reviews",
    `The first page of reviews of one product of QVC (qvc.com, us) or HSN (hsn.com), as the product page shows it: QVC the 8 newest, HSN the 12 highest rated. First page only: no paging, sort or star filter. Returns item_number, page, order, count, total (written reviews), average_rating, review_count (rating-only reviews included), ratings_only_count, rating_distribution, recommended_count, not_recommended_count, reviews [review_id, rating, title, text, submitted_at, recommended, syndicated, syndicated_from, helpful_votes, unhelpful_votes, pros, cons, verified_purchaser, badges, secondary_ratings, language, photo_count], questions_total and questions [question, submitted_at, answer_count, answers [answer, submitted_at, is_brand_answer]]. No reviewer names, nicknames or locations. Captured 2026-11-27: the Ninja Professional Plus Duo Blender (K82223) showed its 8 newest of 918 written reviews, 950 ratings averaging 4.67. Takes 20 to 60 s: allow a client timeout of at least 120 s. 1 credit (credits_used is what was charged); a not-found is charged, failed upstream calls and refused inputs are not.`,
    {
      site,
      ...itemTarget,
    },
    post("reviews"),
  );
}
