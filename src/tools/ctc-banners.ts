import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// SportChek (sportchek.ts) and Mark's (marks.ts) share one storefront, so one builder registers both
// banners' tools. Shapes mirror backend/src/routes/ctc-storefront.ts. Rules the backend enforces and
// zod here does not: product, reviews and questions take code or url (not both); list takes path or
// url (not both); deals (or a deals filter) on a deals page (/sale-clearance/) is a 400. No zod
// `.default()`: the MCP SDK would post a defaulted field on every call.

const SORTS = ["relevance", "price_high", "price_low", "rating"] as const;
const REVIEW_SORTS = ["newest", "relevance", "helpful", "rating_high", "rating_low"] as const;
const DEALS = ["sale", "clearance", "both"] as const;

export const CTC_SLOW = "Answers take about 10-90 seconds: allow up to 2 minutes.";
export const CTC_ONE =
  "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
export const CTC_FOOTNOTE = "Was price reflects the last national regular price this product was sold for.";

export interface CtcBannerTools {
  /** Platform id: the path segment and the tool-name suffix (sportchek, marks). */
  id: "sportchek" | "marks";
  /** Display name (SportChek, Mark's). */
  name: string;
  /** First-mention sentence, e.g. "SportChek (sportchek.ca, ...)". */
  first: string;
  /** Mark's only: language en | fr (fr reads L'Equipeur). */
  french: boolean;
  /** "reviews" (SportChek) or "questions" (Mark's). */
  feedback: "reviews" | "questions";
  /** Not available on this banner (one sentence). */
  notAvailable: string;
  exampleQuery: string;
  exampleCode: string;
  exampleList: string;
  exampleStore: string;
  exampleSuggest: string;
  exampleBrand: string;
  captured: {
    search: string;
    list: string;
    product: string;
    feedback: string;
    store: string;
    brands: string;
    categories: string;
  };
}

export function registerCtcBannerTools(server: McpServer, getClient: () => ScavioClient, b: CtcBannerTools) {
  const post = (endpoint: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/${b.id}/${endpoint}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  const PRICES = `Prices are ${b.name}'s online prices in Canadian dollars for a visitor without an account. was_price is the site's was price as given, only where the site shows one (clearance and some sale items); footnote is the site's own sentence on it: "${CTC_FOOTNOTE}" (English pages). A percent off is not returned: compute it from price and was_price and label it computed. sale_ends is the site's sale end date as given; price_message [{label, details}] is the site's promotion text as given. In our checks prices were the same at every store sampled.`;
  const STORE = `units_at_store are the units at the store the site assigns to the request's region (assigned_store {id, name, city, province}); a caller cannot choose a store.`;
  const LANG = b.french
    ? " language fr reads L'Equipeur (lequipeur.com, Mark's in French): the same product codes and Canadian dollar prices, French titles."
    : ` ${b.name} is English only.`;
  const PAIR = `For the same model at Amazon.ca and Walmart.ca use the Amazon and Walmart tools (Canadian marketplace); match on brand, model, colour and size.`;
  const ITEM =
    "position, code (the input of the product tools), name, brand, url, image, price, price_max, was_price, currency, on_sale, sale_ends, price_message [{label, details}], badges (SALE, CLEARANCE, TOPRATED, BESTSELLER, NEWARRIVAL), rating, review_count, colours [{name, price, was_price, on_sale, sale_ends, units_online_max}], sponsored";
  const LIST = `market, total, total_pages, page, page_size, has_more, count, sort, filters_applied, items [{${ITEM}}], facets (with include_facets: id, label, values [{label, count, facet, value, selected}]), footnote, notes`;
  const FILTERS =
    "sorted (relevance, price high or low, rating) and filtered (brand, sale or clearance, and any of the site's filters from facets)";

  const lang: Record<string, z.ZodTypeAny> = b.french
    ? {
        language: z.enum(["en", "fr"]).optional()
          .describe("en (default, marks.com) or fr (L'Equipeur, lequipeur.com: the same product codes and Canadian dollar prices, in French)."),
      }
    : {};
  const many = (example: string, description: string) =>
    z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).min(1).max(10)]).optional()
      .describe(`${description} One value or a list of up to 10 (e.g. ${example}).`);
  const listShape = {
    page: z.number().int().min(1).max(500).optional()
      .describe(`Page (default 1, at most 500); 24 products a page${b.id === "marks" ? " (12 on Mark's category pages)" : ""}, page_size says. total_pages says how many.`),
    sort: z.enum(SORTS).optional()
      .describe("relevance (default), price_high, price_low or rating (highest rated first): the site's sort menu."),
    brand: many(b.exampleBrand, "Brand, as the site's Brand Name filter names it: facets[id=brand].values[].value."),
    deals: z.union([z.enum(DEALS), z.array(z.enum(["sale", "clearance"])).min(1).max(2)]).optional()
      .describe("sale, clearance or both: the site's Deals filter. Not on a deals page (a 400, not charged): use it with search or a category page."),
    filters: z.array(z.object({
      facet: z.string().min(1).max(80),
      value: z.union([z.string().min(1).max(120), z.array(z.string().min(1).max(120)).min(1).max(10)]),
    })).max(6).optional()
      .describe("Any of the site's filters as facets[].values[] give them: {facet, value} (value: one or a list), up to 6, e.g. [{facet: \"sku_gender_attr\", value: \"Female\"}] (gender, size, colour, rating, price band, category and the category's own filters)."),
    include_facets: z.boolean().optional()
      .describe("Also return the site's filters with counts for these results (facets). Still 1 credit."),
    ...lang,
  };
  const target = {
    code: z.string().min(5).max(20).optional()
      .describe(`A ${b.name} product code (items[].code, e.g. ${b.exampleCode}). Send code or url.`),
    url: z.string().min(10).max(2000).optional()
      .describe(`A ${b.name} product link (items[].url) instead of code.`),
  };

  server.tool(
    `search_${b.id}`,
    `Search ${b.first} by keywords or a product code, ${FILTERS}, 24 a page.${LANG} Returns query, corrected_query, redirected_to, ${LIST}. ${PRICES} ${b.captured.search} ${PAIR} ${b.notAvailable} ${CTC_SLOW} ${CTC_ONE}`,
    {
      q: z.string().min(1).max(200).describe(`Keywords or a product code (e.g. ${b.exampleQuery}).`),
      ...listShape,
    },
    post("search"),
  );

  server.tool(
    `get_${b.id}_list`,
    `The products of a ${b.name} category or deals page (sale, clearance, Black Friday) by path or link, ${FILTERS}. Category paths come from get_${b.id}_categories.${LANG} Returns path, url, ${LIST}. ${PRICES} ${b.captured.list} An unknown page is a charged 404. ${CTC_SLOW} ${CTC_ONE}`,
    {
      path: z.string().min(2).max(300).optional()
        .describe(`A ${b.name} category or deals page path (categories[].path, or a sale, clearance or Black Friday page), e.g. ${b.exampleList}. Send path or url.`),
      url: z.string().min(10).max(2000).optional().describe("The page link instead of path."),
      ...listShape,
    },
    post("list"),
  );

  server.tool(
    `get_${b.id}_product`,
    `One ${b.name} product by code or link.${LANG} Returns market, requested_code, code, name, brand, url, price, price_max, was_price, currency, on_sale, sale_ends, price_message, badges, rating, review_count, description, features, specifications, images, breadcrumbs, options [{type, label, values}], style_code, variants [{sku, colour, size, width, options, style_code, price, was_price, on_sale, sale_ends, price_message, badges, units_at_store, units_online, ship_to_home, store_pickup, sellable, max_per_order}], assigned_store, footnote, notes. ${STORE} ${PRICES} ${b.captured.product} The site shows no UPC or barcode. An unknown product is a charged 404. ${CTC_SLOW} ${CTC_ONE}`,
    { ...target, ...lang },
    post("product"),
  );

  if (b.feedback === "reviews") {
    server.tool(
      `get_${b.id}_reviews`,
      `Customer reviews of one ${b.name} product by code or link, sorted (newest, relevance, helpful, rating high or low) and filtered by stars: code, name, url, summary {average, count, distribution, recommended}, sort, rating, page, page_size, total, total_pages, max_page, has_more, count, reviews [{id, rating, title, text, date, recommended, verified_purchaser, syndicated_from (the brand site a review was first posted on, as given), incentivized, helpful_yes, helpful_no, locale, secondary_ratings}], notes. Page 1 is the first 8 reviews, pages 2-4 the next 30 each (up to 98 per sort and star filter). No reviewer names. ${b.captured.feedback} An unknown product is a charged 404. ${CTC_SLOW} ${CTC_ONE}`,
      {
        ...target,
        page: z.number().int().min(1).max(4).optional()
          .describe("Page 1 (default, the first 8 reviews) to 4; each later page is the next 30."),
        sort: z.enum(REVIEW_SORTS).optional()
          .describe("newest (default), relevance, helpful, rating_high or rating_low: the site's review sort menu."),
        rating: z.number().int().min(1).max(5).optional().describe("Only reviews with this many stars (1-5)."),
      },
      post("reviews"),
    );
  } else {
    server.tool(
      `get_${b.id}_questions`,
      `Customer questions and answers on one ${b.name} product by code or link (marks.com, English): code, name, url, total, count, questions [{id, question, details, date, answer_count, locale, answers [{text, date, brand_answer, best_answer, helpful_yes, helpful_no}]}] (the newest 10), notes. brand_answer marks an answer the site flags as the brand's. No asker or answerer names. ${b.captured.feedback} An unknown product is a charged 404. ${CTC_SLOW} ${CTC_ONE}`,
      { ...target },
      post("questions"),
    );
  }

  server.tool(
    `get_${b.id}_suggestions`,
    `${b.name}'s search-box suggestions for typed text: market, query, count, terms, top_hit, categories, brands, notes.${b.french ? " English." : ""} ${CTC_SLOW} ${CTC_ONE}`,
    { q: z.string().min(1).max(100).describe(`The text typed so far (e.g. ${b.exampleSuggest}).`) },
    post("suggestions"),
  );

  server.tool(
    `get_${b.id}_store`,
    `One ${b.name} store by store number: market, id, name, url, address, phone, latitude, longitude, timezone, hours (weekly), special_hours, curbside_pickup, services, nearby_stores [{id, name, city, province_code, distance_km}] (up to 49), nearby_count, notes. Store numbers come from a product's assigned_store.id or nearby_stores[].id. Finding stores near a postal code is not supported. ${b.captured.store} An unknown store number is a charged 404. ${CTC_SLOW} ${CTC_ONE}`,
    {
      store_id: z.union([z.string().min(1).max(10), z.number().int().positive()])
        .describe(`Required. A store number (assigned_store.id, nearby_stores[].id), e.g. ${b.exampleStore}.`),
    },
    post("store"),
  );

  server.tool(
    `get_${b.id}_brands`,
    `${b.name}'s brand pages as the site lists them: market, letter, total_brands, count, brands [{name, slug, url}], notes. name is spelled from the brand page link; to filter search or list by a brand, use its Brand Name value from facets (include_facets: true).${LANG} ${b.captured.brands} ${CTC_ONE}`,
    {
      letter: z.string().min(1).max(1).optional().describe("Optional: only brands starting with this letter or digit."),
      ...lang,
    },
    post("brands"),
  );

  server.tool(
    `get_${b.id}_categories`,
    `${b.name}'s category tree: market, total_categories, count, categories [{id, name, path, url, level, children [...]}], notes. path is the input of get_${b.id}_list.${LANG} ${b.captured.categories} ${CTC_ONE}`,
    { ...lang },
    post("categories"),
  );
}
