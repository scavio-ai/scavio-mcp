import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Notino: 10 tools on /api/v1/notino (search, product, reviews, category, brand, promo, brands,
// suggestions, stores, store). Shapes mirror backend/src/routes/notino.ts. Rules the backend enforces
// and zod here does not: product and reviews take exactly one of url or order_code; a product or
// listing link picks its own storefront (market applies otherwise; default de); stores and store
// answer only on the 8 storefronts with Notino stores (default cz); filters are facet ids of an
// earlier answer (at most 10). No zod `.default()`: the MCP SDK would post a defaulted field on
// every call.

const MARKETS = [
  "de", "at", "ch", "cz", "sk", "pl", "hu", "ro", "bg", "hr", "si", "ua", "fr", "be", "nl", "it", "es", "pt", "gr",
  "gb", "ie", "dk", "se", "fi", "lt", "lv", "ee",
] as const;
const STORE_MARKETS = ["cz", "sk", "pl", "at", "hu", "ro", "bg", "hr"] as const;
const SORTS = ["relevance", "bestseller", "price_asc", "price_desc", "top_rated", "newest"] as const;
const REVIEW_SORTS = ["newest", "oldest", "highest_rating", "lowest_rating", "most_helpful"] as const;

const FIRST = "Notino (notino.com, the Brno-based online perfume and cosmetics store with 27 country shops)";
const NAME = "Notino";
const LANG =
  "Names, labels and review texts are in the storefront's language, as Notino writes them; field names are English.";
const MARKET_TEXT =
  "Storefronts (market, default de; a product or listing link picks its own): de at ch cz sk pl hu ro bg hr si ua fr be nl it es pt gr gb ie dk se fi lt lv ee. One language each (be is French, ch German), its own currency (EUR, GBP, CZK, HUF, PLN, RON, UAH, DKK, SEK, CHF) and its own prices. Every answer carries market, shop, language, currency.";
const BILL =
  "Billed on what the request actually costs (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const ONE = `Costs 1 credit (2 on gb). ${BILL}`;
const PAGED =
  "Page 1, unsorted and unfiltered: 1 credit (2 on gb). Any other page, sort or filter: 3 credits (4 on gb), because Notino's page 1 is read for the list's own ids before the wanted page.";
const SLOW = "Answers usually take 1-30 seconds and can take up to about 4 minutes (deeper review views): allow up to 4 minutes or more.";
const DEAL =
  "deal {reason (on_sale, clearance), voucher_code (e.g. black), discount_value, discount_type, discount_percent, discounted_price (the price with the code), voucher_not_for_cheapest, basket_condition {name, condition, condition_type, discount} (a discount that needs a basket of a brand or category), free_delivery, tags (e.g. blackfriday), campaign_ids} or null";
const ITEM = `product_id, master_id, url, name, sub_name, brand, annotation, image, price, currency, rrp (as shown; listings rarely carry one), unit_price {value, unit, per_amount}, stock_level (Notino's stock word: more_than_20, more_than_5, last_1 ... last_5, out_of_stock), in_stock, product_code, master_product_code, rating, review_count, is_new, sponsored (a paid placement Notino mixes into the list, kept in place), free_delivery, ${DEAL}, variant_count, variants [{variant_id, label (size or shade), colors (hex)}], category {category, subcategory, type, kind}`;
const LIST = `page_type (Category, Brand, Promo), title, breadcrumbs [{name, url}], sort, page, page_size (24), total, total_pages, has_more, count, currency, items [{${ITEM}}], facets [{group, type, multi_choice, values [{id, name, count, selected, color}]}] (send values[].id in filters), price_range {min, max}, selected_filters, note`;
const NOT_AVAILABLE =
  "Not available: per-store stock (pickup_store_count says how many Notino stores hold a variant), a postcode store search, cart or checkout prices, price history (poll and store the answers; lowest_price_30d is Notino's own 30-day low), reviewer names or identity.";

const market = z.enum(MARKETS).optional()
  .describe("The storefront (default de; a product or listing link picks its own). gb (notino.co.uk) costs more per call.");
const storeMarket = z.enum(STORE_MARKETS).optional()
  .describe(`A storefront with Notino stores and pickup points: ${STORE_MARKETS.join(", ")} (default cz).`);
const listFields = {
  market,
  page: z.number().int().min(1).max(500).optional()
    .describe("Page of 24 (1 to 500, default 1; total_pages says how deep a list goes)."),
  sort: z.enum(SORTS).optional()
    .describe("relevance (default), bestseller, price_asc, price_desc, top_rated, newest: Notino's own sort options."),
  filters: z.union([z.array(z.number().int().positive()).min(1).max(10), z.string().min(1).max(120)]).optional()
    .describe("Up to 10 filter ids: facets[].values[].id of an earlier answer (brand, category, type of goods, skin type, gender, offers, free delivery, new, rating), e.g. [100004]. Ids of one group widen, of different groups narrow, as on the site."),
};
const productRef = {
  url: z.string().min(3).max(400).optional()
    .describe("A Notino product link or path (/<brand>/<product>/, or /<brand>/<product>/p-<variant id>/ for one size or shade), e.g. https://www.notino.de/dior/sauvage-eau-de-parfum-fuer-herren/. Send url or order_code."),
  order_code: z.string().min(3).max(16).optional()
    .describe("A Notino order code: variants[].order_code (one size or shade), e.g. CHD7138."),
};

export function registerNotinoTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/notino/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_notino",
    `Search ${FIRST} by text, with page, sort and filters: market, shop, language, currency, query, redirected_to {page_type, path, url} (Notino sends brand names and some category words to that page; the list is then that page's), ${LIST}, total_capped. Sorted by relevance Notino stops the list near 500 products (total_capped true); any other sort lists the full set. Voucher codes show here, per item (items[].deal). Captured 2026-11-26: "vitamin c serum" on notino.de listed 499 products (capped), with items carrying the Black Friday code black (e.g. 20% off, the discounted price beside the price). ${LANG} ${MARKET_TEXT} ${NOT_AVAILABLE} Costs 1 credit (2 on gb) with any page, sort or filter; a search Notino answers with a brand or category page that does not keep the page, sort or filters reads that page with them: 3 credits (4 on gb). ${BILL} ${SLOW}`,
    {
      query: z.string().min(1).max(200)
        .describe("Search text (any language; the storefront's own language matches best), e.g. vitamin c serum."),
      ...listFields,
    },
    post("search"),
  );

  server.tool(
    "get_notino_product",
    `One ${NAME} product with every variant (size, shade) by link or order code: market, shop, language, currency, requested, selected_variant_id (the variant of a /p-<id>/ link or of the order code), master_id, catalog_master_id, master_product_code, name, brand {brand_id, name, url, manufacturer}, annotation, sub_name, collection, url, gender, is_perfume, description (plain text), fragrance_notes [{note, values}], breadcrumbs, category {kind, category, subcategory, type}, rating {average, count, text_reviews, translated_reviews}, variant_count, variants [{variant_id, catalog_id, name, variant_name, label, order_code, product_code, ean, url, price, currency, vat_percent, rrp (the recommended retail price where the storefront shows one, e.g. es), rrp_type, anchor_price, lowest_price_30d (the lowest price of the last 30 days Notino shows under EU price rules), unit_price {value, unit, per_amount}, amount {value, unit}, availability {state (CanBeBought, ShowWatchdog), can_buy, stock_level (more_than_20, less_than_5, out_of_stock), in_stock, max_order_quantity, pickup_store_count (how many Notino stores hold it)}, colors (shade hex), images, characteristics [{name, values}], ingredients, instructions, warnings, manufacturer_importer, gift_campaign_ids}], gift_campaigns [{campaign_id, type (special, try_it_first), text, image, variant_ids}], deliveries [{name, type, price, free_shipping, date, date_from, date_to, order_by_time}], alternate_sites [{market, locale, url}] (the same product on other storefronts), related_product_ids, reviews_url. Voucher codes show on listings (search, category, brand, promo: items[].deal). Captured 2026-11-26: DIOR Sauvage Eau de Parfum 200 ml (order code CHD13588, EAN 3348901428545) at 180 EUR on notino.de with lowest_price_30d 170, and 805 PLN on notino.pl (held by 3 Polish stores); on notino.es, Estée Lauder Advanced Night Repair 75 ml at 134 EUR with rrp 179. A product the storefront does not sell is a charged 404. ${LANG} ${MARKET_TEXT} ${NOT_AVAILABLE} ${ONE} ${SLOW}`,
    { ...productRef, market },
    post("product"),
  );

  server.tool(
    "get_notino_reviews",
    `Customer reviews of one ${NAME} product, 8 per page: market, shop, language, currency, sort, rating, page, page_size, product_url, reviews_url, master_product_id, average_rating, rating_count, total, total_pages, has_more, count, reviews [{review_id, rating, title, text, created_at, likes, dislikes, verified_purchase, author_type, variant_id, from_shop (the storefront it was written on), translated, source_language, original_title, original_text, partner_domain, image_count}], rating_buckets {5..1}, content_counts, shops [{shop, market, count}], variants [{variant_catalog_id, count}], aspects [{aspect, average}] (the per-aspect ratings, on review-tab views), view (review_page or review_tab). No reviewer name or any reviewer identity is returned. Up to page 8 per view. Captured 2026-11-26: DIOR Sauvage on notino.de averaged 4.8 from 77 ratings, with 54 written reviews from notino.de, notino.at and notino.ch. Credits: the newest 8 (page 1, no star filter) 1 credit (2 on gb; by order_code the product page is read first: 1, or 4 on gb); any other page, sort or star filter opens the product's review tab: 1 credit on every storefront, slower (typically 10-45 seconds, up to about 4 minutes: set a client timeout of at least 250 seconds). ${LANG} ${MARKET_TEXT} ${BILL}`,
    {
      ...productRef,
      market,
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("newest (default), oldest, highest_rating, lowest_rating, most_helpful: the review tab's own five orders."),
      rating: z.number().int().min(1).max(5).optional().describe("Reviews with this many stars (1-5)."),
      page: z.number().int().min(1).max(8).optional().describe("Page of 8 (1 to 8)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_notino_category",
    `One ${NAME} category's products by path or link, with page, sort and filters: market, shop, language, currency, path, url, ${LIST}. Captured 2026-11-26: /hautseren/ (face serums) on notino.de listed 2,549 products over 107 pages. ${LANG} ${MARKET_TEXT} ${PAGED} ${BILL} ${SLOW}`,
    {
      category: z.string().min(1).max(400)
        .describe("A Notino category path (breadcrumbs[].url, facets of type Category) or its link, e.g. /hautseren/."),
      ...listFields,
    },
    post("category"),
  );

  server.tool(
    "get_notino_brand",
    `One brand's products on a ${NAME} storefront, with page, sort and filters: market, shop, language, currency, path, url, ${LIST}. Captured 2026-11-26: CeraVe on notino.de listed 44 products; Skin Renewing Peptide Cream 48 g at 27.90 EUR, 16.74 EUR with the Black Friday code black (40% off). ${LANG} ${MARKET_TEXT} ${PAGED} ${BILL} ${SLOW}`,
    {
      brand: z.string().min(1).max(400)
        .describe("A brand: brands[].slug of get_notino_brands (e.g. dior, cerave) or its link."),
      ...listFields,
    },
    post("brand"),
  );

  server.tool(
    "get_notino_promo",
    `A ${NAME} promo list (default Black Friday) with its products and the terms its banner gives: market, shop, language, currency, path, url, terms (as Notino writes them, e.g. the code and dates of a Black Friday discount), ${LIST}. Every item carries its own deal (voucher code, discount, discounted price). Captured 2026-11-26: /black-friday/ on notino.de listed 12,000 products (500 pages); its terms gave the code black, valid 23.11. to 29.11.2026, not on items already on sale or in clearance. ${LANG} ${MARKET_TEXT} ${PAGED} ${BILL} ${SLOW}`,
    {
      promo: z.string().min(1).max(400).optional()
        .describe("A promo page path or link (default black-friday, live on every storefront in November 2026)."),
      ...listFields,
    },
    post("promo"),
  );

  server.tool(
    "get_notino_brands",
    `A ${NAME} storefront's brand directory (about 1,800 brands on notino.de; 1,765 on 2026-11-26): market, shop, language, currency, query, letter, featured_only, total_brands, matches, page, limit, has_more, count, brands [{name, slug (the input of get_notino_brand), url, featured, letter}]. ${MARKET_TEXT} ${ONE}`,
    {
      market,
      query: z.string().min(1).max(100).optional().describe("Brands whose name contains this text (e.g. dior)."),
      letter: z.string().min(1).max(1).optional().describe("Brands starting with this letter or digit."),
      featured_only: z.boolean().optional().describe("Only the brands Notino's directory highlights (in bold)."),
      page: z.number().int().min(1).max(1000).optional().describe("Page, 1-based (default 1)."),
      limit: z.number().int().min(1).max(2000).optional().describe("Brands per page, 1 to 2000 (default 500)."),
    },
    post("brands"),
  );

  server.tool(
    "get_notino_suggestions",
    `${NAME}'s search suggestions for a partial query: market, shop, language, currency, query, count, sections [{section, items [{text, kind (collection, brand ...), url}]}], products [{name, description, product_code, url, image}]. ${LANG} ${MARKET_TEXT} ${ONE}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far (e.g. dior sa)."),
      market,
    },
    post("suggestions"),
  );

  server.tool(
    "get_notino_stores",
    `${NAME}'s stores and pickup points in one storefront (${STORE_MARKETS.join(", ")}): market, shop, language, currency, city, cities, total_stores, count, stores [{store (the input of get_notino_store), url, name, place, city_group, address {street, city, postcode, country}, latitude, longitude, opening_hours [{days, opens, closes}], open_now, status_changes_at, image}]. Stores are listed by city; there is no postcode search. Captured 2026-11-26: 7 stores in the Czech Republic (Brno, Ostrava, Praha). Costs 1 credit. ${BILL}`,
    {
      market: storeMarket,
      city: z.string().min(1).max(60).optional()
        .describe("Only the stores in this city (accents and case do not matter), e.g. Praha."),
    },
    post("stores"),
  );

  server.tool(
    "get_notino_store",
    `One ${NAME} store's page: market, shop, language, currency, store, url, name, description, open_now, status_changes_at, services {card_payment, complaints, direct_sale, order_pickup, dermo_shop}, opening_hours (7 days from today: [{day, open, today, public_holiday, times [{start, end}]}]), address, latitude, longitude, map_url, phone, email, images. Stores exist on ${STORE_MARKETS.join(", ")}. Per-store stock is not offered. Costs 1 credit. ${BILL}`,
    {
      store: z.string().min(2).max(400)
        .describe("stores[].store of a get_notino_stores answer (e.g. florentinum-praha), or the store's link."),
      market: storeMarket,
    },
    post("store"),
  );
}
