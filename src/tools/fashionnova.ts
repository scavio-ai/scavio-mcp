import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/fashionnova.ts (fashionnova.com: 104
// countries in the site's own country selector, 37 currencies, English
// everywhere and Spanish in 67 countries). country is a plain ISO-2 string
// rather than an enum, like ASOS: the backend answers 400 (before anything is
// charged) for a country or language Fashion Nova does not run. Cross-field
// rules the backend enforces and zod here does not: product, reviews and
// similar take exactly one of handle or url, collection one of handle or url;
// language es only where the storefront serves Spanish; search pages 1 to 18,
// or 1 to 6 under a sort other than featured. No zod `.default()`: the MCP
// SDK would post a defaulted field on every call.

const SORTS = ["featured", "best_selling", "price_low", "price_high", "newest"] as const;
const REVIEW_SORTS = ["highest_rated", "most_recent", "most_helpful", "lowest_rated"] as const;
const DIVISIONS = ["women", "curve"] as const;
const NAV_DIVISIONS = ["women", "men", "curve"] as const;
const EEA = "at, be, cy, cz, de, dk, ee, es, fi, fr, gr, hu, ie, is, it, lt, lu, lv, mt, nl, no, pl, pt, ro, se, si, sk";

const CREDITS = "Costs 1 credit. Failed upstream calls are not charged; a not-found is charged.";
const MARKETS =
  "Markets: 104 countries in Fashion Nova's own country selector (country, default us), each in its own currency (37 currencies: us USD, ca CAD, gb GBP, au AUD, mx MXN, jp JPY, ae AED, the euro countries EUR ...; zz is the site's International storefront, USD). English everywhere; Spanish (language es: titles, descriptions and attributes in Spanish) in 67 countries, not the US store. A country or language Fashion Nova does not run answers 400 before anything is charged. Every answer carries country, language and currency.";
const PRICES =
  "Prices are numbers in the storefront's currency, never converted: price is the lowest size price, compare_at the site's struck-through price, percent_off = round((1 - price / compare_at) * 100) (computed by Scavio from the two) and on_sale = compare_at above price (null / false without a compare-at). price_with_code is the price the site shows with its current promo code, when it shows one; final_sale flags a final-sale item.";
const EEA_TEXT = `In the 27 EEA storefronts (${EEA}) prices include VAT and Fashion Nova shows no compare-at price, so compare_at and percent_off are null and on_sale false there.`;
const STOCK = "sizes[].quantity is the units in stock Fashion Nova's page shows for the size (available, low_stock); not a guaranteed inventory count.";
const CARD =
  "product_id, handle (the style), color, color_slug, title, base_title, url, product_type, price, compare_at, percent_off, on_sale, currency, price_with_code {price, currency}, final_sale, badge (e.g. 60% OFF, DEALS), in_stock, coming_soon, limited, sizes_in_stock, sizes [{size, quantity, available, low_stock}], image, colors [{color, color_slug, product_id}]";
const LIST_OUT = `country, language, currency, sort, filters, unrecognized_filters (only when filters names a facet this list does not offer: the site matches nothing on it, so fix the name), page, page_size (60), total, total_pages, has_more, count, items (${CARD}), facets [{name, title, values [{value, label}]}] (the filter inputs this list offers)`;
const FILTERS =
  "Filters (several values = OR): size (e.g. M, 7, 1X), color (colour families), price_min / price_max (whole units of the storefront's currency), division (women, curve), category (e.g. Jeans, Dresses), filters (any other facet by facets[].name: occasion, fit_type, rise, stretch, wash, fabric, detail, neckline, sleeve, print ...). Sorts: featured (default), best_selling, price_low, price_high, newest.";
const REVIEW =
  "id, rating, title, body, date, verified_buyer, votes_up, votes_down, fit (runs_small, true_to_size, runs_large: the page's own fit labels), fit_score, size_purchased, usual_size, color_purchased, language, topics. Reviewer names are never returned.";
const NOT_AVAILABLE =
  "Not available: stores and store stock (Fashion Nova lists no stores), a brand directory (everything is Fashion Nova), price history (poll and store the answers), gift cards, new-arrival dates.";

const country = z.string().length(2).optional()
  .describe("Country, ISO-2 lower case (default us): the storefront and its currency, any of Fashion Nova's 104 countries (zz = International, USD). One Fashion Nova does not run answers 400 before anything is charged.");
const language = z.enum(["en", "es"]).optional()
  .describe("en (default) or es (Spanish titles, descriptions and attributes; only in the 67 countries whose storefront serves Spanish, not us).");
const strList = (description: string, max = 10) =>
  z.union([z.string().min(1).max(400), z.array(z.string().min(1).max(60)).min(1).max(max)]).optional().describe(description);

const listFields = {
  country,
  language,
  sort: z.enum(SORTS).optional().describe("featured (default), best_selling, price_low, price_high, newest."),
  size: strList("Sizes (facets name size), e.g. ['M', 'L'] or '7': up to 10 in a list, or 15 comma-separated."),
  color: strList("Colour families, up to 10 (facets name color): black, blue, white, pink, brown, red, yellow, green, gray, purple, orange, gold, silver, nude, ivory ..."),
  price_min: z.number().min(0).optional().describe("Lowest price, whole units of the storefront's currency."),
  price_max: z.number().min(0).optional().describe("Highest price, whole units of the storefront's currency."),
  division: z.union([z.enum(DIVISIONS), z.array(z.enum(DIVISIONS)).min(1).max(2)]).optional()
    .describe("women or curve (Fashion Nova's plus range)."),
  category: strList("Categories as the site writes them (facets name category), e.g. Jeans, Dresses, Tops."),
  filters: z
    .record(z.string(), z.union([z.string().min(1).max(400), z.array(z.string().min(1).max(60)).min(1).max(10)]))
    .optional()
    .describe("Other facets by facets[].name: value or list of values (facets[].values[].value), e.g. { \"fit_type\": \"Baggy\", \"rise\": \"High Rise\" }. Up to 10 facets. A facet the list does not offer matches nothing and is listed in unrecognized_filters."),
};

const handle = z.string().min(1).max(200).optional()
  .describe("Style handle (items[].handle), e.g. 'san-diego-sculpting-stretch-flare-jeans'; a colour handle <style>-fncolorname-<colour> is accepted too.");
const productUrl = z.string().min(20).max(400).optional()
  .describe("A fashionnova.com product link (https://www.fashionnova.com/products/<handle>?color=<colour>), any storefront.");
const color = z.string().min(1).max(80).optional()
  .describe("Colour slug (items[].color_slug, colors[].color_slug), e.g. 'black-wash'. Default: the style's default colour.");
const productRef = { handle, url: productUrl, color };
const division = z.enum(NAV_DIVISIONS).optional().describe("women (default), men or curve.");

export function registerFashionnovaTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/fashionnova/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_fashionnova",
    `Search one Fashion Nova storefront for sale prices, compare-at prices and sizes in stock: query, ${LIST_OUT}. The search is semantic (loosely related items further down): its total moves between calls and a later page can repeat a few items; it shows its first 18 pages of 60 (6 under a sort other than featured). Narrow with filters, or use get_fashionnova_collection for full depth. ${FILTERS} ${PRICES} ${EEA_TEXT} ${STOCK} ${MARKETS} ${NOT_AVAILABLE} ${CREDITS}`,
    {
      query: z.string().min(1).max(200).describe("Search text, e.g. 'bodycon dress'. Semantic: narrow with filters."),
      ...listFields,
      page: z.number().int().min(1).max(18).optional()
        .describe("Page, 60 per page: 1 to 18, or 1 to 6 with a sort other than featured (the site's search shows no more)."),
    },
    post("search"),
  );

  server.tool(
    "get_fashionnova_product",
    `One Fashion Nova style in one colour by handle (+ color) or link: country, language, currency, product_id, handle, color, color_slug, title, base_title, url, brand, division, product_type, description, details, materials, attributes (category, occasion, fit_type, rise, stretch, print ...), model_height (when the site gives it), price, compare_at, percent_off, on_sale, price_with_code, promo (the site's promo line), final_sale, badge, in_stock, coming_soon, limited, sizes [{size, sku, price, compare_at, quantity, available, low_stock}], images, colors (every colour of the style with its price, compare_at, percent_off, stock and sizes), rating {average, count, histogram (stars 1-5), fit, fit_score}, reviews (the first 3: ${REVIEW}), site_ai_review_summary (Fashion Nova's own AI summary of its reviews, labelled as such: summary, buy_if, topics, generated_at), size_guide {title, inches, cm}, delivery {standard, rush: {method, from, to, order_by}}, default_collection, collections [{handle, title}]. An unknown handle, or a colour the style does not have, answers 404 (charged). ${PRICES} ${EEA_TEXT} ${STOCK} ${MARKETS} ${CREDITS}`,
    { ...productRef, country, language },
    post("product"),
  );

  server.tool(
    "get_fashionnova_collection",
    `One Fashion Nova collection by handle or link, to full depth (pages 1 to 200 of 60; has_more follows the site's page count, and a page can hold fewer than 60 without being the last): handle, title, description, url, ${LIST_OUT}. Handles: sale (the markdown collection; there is no clearance collection), best-sellers, new, new-this-week, back-in-stock, coming-soon, jeans, dresses, mens, plus ... (get_fashionnova_categories lists them; the same handles work in every storefront). An unknown handle answers 404 (charged). ${FILTERS} ${PRICES} ${EEA_TEXT} ${MARKETS} ${CREDITS}`,
    {
      handle: z.string().min(1).max(200).optional()
        .describe("Collection handle (get_fashionnova_categories categories[].handle / sections[].items[].handle), e.g. sale, best-sellers, new, back-in-stock, jeans."),
      url: z.string().min(20).max(400).optional()
        .describe("A fashionnova.com collection link (https://www.fashionnova.com/collections/<handle>)."),
      ...listFields,
      page: z.number().int().min(1).max(200).optional().describe("Page, 60 per page, 1 to 200."),
    },
    post("collection"),
  );

  server.tool(
    "get_fashionnova_categories",
    `Fashion Nova's navigation for one division (women default, men, curve), as collection handles for get_fashionnova_collection: division, count, collection_count, categories [{name, handle, url, sections [{name, items [{name, handle, url}]}]}] (handle is null for a link that is not a collection), trending_searches (the site's own trending searches for the division). The same handles work in every storefront. ${CREDITS}`,
    { division },
    post("categories"),
  );

  server.tool(
    "get_fashionnova_suggestions",
    `Fashion Nova's search suggestions for a partial query (division women default, men, curve): query, division, count, queries (suggested searches), products [{product_id, title, title_es, handle, color_slug, url, image}] (no prices: call get_fashionnova_product), collections [{handle, title}]. The same for every storefront (no country). ${CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. 'dress'."),
      division,
    },
    post("suggestions"),
  );

  server.tool(
    "get_fashionnova_reviews",
    `A page of one Fashion Nova style's reviews by handle (+ color) or link: 10 per page, pages 1 to 8, sorted highest_rated (default, the page's own), most_recent, most_helpful or lowest_rated, optionally one star rating. handle, color_slug, sort, star, page, page_size, language (en), total (reviews matching the filter, as returned), has_more, rating {average, count, histogram, fit, fit_score}, count, reviews (${REVIEW}). Fashion Nova keeps one English review pool for every storefront, so there is no country. Takes 20 to 60 seconds. An unknown product answers 404 (charged). ${CREDITS}`,
    {
      ...productRef,
      sort: z.enum(REVIEW_SORTS).optional().describe("highest_rated (default), most_recent, most_helpful, lowest_rated."),
      star: z.number().int().min(1).max(5).optional().describe("Only reviews with this star rating (1-5)."),
      page: z.number().int().min(1).max(8).optional().describe("Page, 10 reviews each, 1 to 8."),
    },
    post("reviews"),
  );

  server.tool(
    "get_fashionnova_similar",
    `Products Fashion Nova recommends as similar to one style (by handle (+ color) or link), from the US store in USD: handle, color_slug, product_id, title, country (us), language, currency, count, items (${CARD}). An unknown product answers 404 (charged). ${PRICES} ${CREDITS}`,
    {
      ...productRef,
      limit: z.number().int().min(1).max(24).optional().describe("Products to return, 1 to 24 (default 12)."),
    },
    post("similar"),
  );
}
