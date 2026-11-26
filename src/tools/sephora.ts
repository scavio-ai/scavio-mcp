import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/sephora.ts + sephora-ca.ts. `country` is
// optional and absent by default, so a US call posts exactly what it did
// before Sephora Canada existed. With country "ca" search, category and
// product read Sephora Canada (sephora.com/ca); the six get_sephora_brand /
// brands / suggestions / offers / stores / store tools are Sephora Canada
// only and need no country (the backend defaults it to "ca").
// Cross-field rules the backend enforces and zod here does not: product takes
// url OR product_id; zip is US only (a 400 with country "ca"); language,
// filters, include_facets and category sort are Canada only (a US call
// ignores them). No zod `.default()`: the MCP SDK would post a defaulted
// field on every call.

const SORTS = ["relevance", "best_selling", "rating", "price_low", "price_high", "newest"] as const;
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

const CA = "Sephora Canada (sephora.com/ca, Sephora's Canadian store: 152 stores per its store list on Nov 25, 2026)";
const CAD = "Prices in CAD as Sephora Canada gives them (French prices such as '33,00 $' are read as 33.00).";
const CA_CARD = "product_id, sku_id, brand, name, url, image, price, list_price, sale_price, value_price, price_range, price_text, rating, review_count, more_colors, on_sale, sale_scope (full | partial), bestseller, new, Sephora-exclusive, online-only, limited-edition and app-exclusive flags, sponsored";
const CA_LISTING = `language, page, sort, filters_applied, total_results, total_pages, has_more, count, products [${CA_CARD}], facets (with include_facets), market {country, currency, language, site}`;
const CA_ONLY = `${CA} only (no country needed).`;

const page = () =>
  z.number().int().min(1).max(100).optional()
    .describe("Page, 1-based, 60 per page.");
const country = () => z.enum(["us", "ca"]).optional()
  .describe(`'us' (default, sephora.com, unchanged) or 'ca' (${CA}, CAD).`);
const caLanguage = () => z.enum(["en", "fr"]).optional()
  .describe("ca only: 'en' (default) or 'fr'. Same product and sku ids and CAD prices; French names, descriptions and facet values.");
const language = () => z.enum(["en", "fr"]).optional()
  .describe("'en' (default) or 'fr'.");
const filters = () => z.object({
  brand: z.string().max(100).optional()
    .describe("Only this brand, as the Brand facet shows it, e.g. 'The Ordinary'."),
  on_sale: z.boolean().optional().describe("Only products on sale."),
  new: z.boolean().optional().describe("Only new products."),
  clean: z.boolean().optional().describe("Only Clean at Sephora products."),
  rating: z.number().int().min(1).max(4).optional().describe("1-4: that many stars and up."),
  min_price: z.number().min(0).optional().describe("Lowest price in CAD."),
  max_price: z.number().min(0).optional().describe("Highest price in CAD."),
  facets: z.array(z.object({ facet: z.string().max(80).optional(), value: z.string().max(200) })).max(10).optional()
    .describe("Up to 10 {facet, value} from a response's facets (include_facets)."),
}).strict().optional()
  .describe("ca only: filters; several all apply. An unknown filter is a 400.");
const includeFacets = () => z.boolean().optional()
  .describe("ca only: also return facets [{facet, type, values [{value, name, count, selected}]}] to filter on.");
const caSort = () => z.enum(SORTS).optional()
  .describe("relevance (default), best_selling, rating, price_low, price_high or newest.");

export function registerSephoraTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/sephora/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_sephora",
    `Search sephora.com (US) products, 60 per page. Each result has product_id, sku_id, brand, name, url, price, list and sale price in dollars (price_range when sizes are priced differently), value price for sets, rating, review count, extra colors, and bestseller, new, Sephora-exclusive, online-only, limited-edition and sponsored flags. Pass zip for same-day delivery eligibility. Also returns category facets with product counts and related searches. With country 'ca', ${CA}: ${CA_LISTING}, plus redirect (a brand keyword such as 'the ordinary' answers that brand's products), categories and related_searches; filters, include_facets and language; zip is US only. ${CAD} Use a result's url or product_id with get_sephora_product. 1 credit/call.`,
    {
      query: z.string().min(1).max(200)
        .describe("Search keywords, e.g. 'lipstick'."),
      page: page(),
      sort: z.enum(SORTS).optional()
        .describe("relevance (default), best_selling, rating, price_low, price_high or newest."),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US only: US ZIP code, e.g. '10001'. Each product then carries same_day_eligible for that ZIP."),
      country: country(),
      filters: filters(),
      include_facets: includeFacets(),
      language: caLanguage(),
    },
    post("search"),
  );

  server.tool(
    "get_sephora_category",
    `Products in a sephora.com (US) category, 60 per page, same fields as search_sephora, plus the category's id, name and URL, total product count, parent category, subcategories with product counts and breadcrumbs. With country 'ca', a ${CA} category: category, parent_category, subcategories, breadcrumbs, ${CA_LISTING}; sort, filters, include_facets and language. ${CAD} An unknown category is a 404 (charged for ca). 1 credit/call.`,
    {
      category: z.string().min(1).max(300)
        .describe("Category name as in a sephora.com/shop/ URL (e.g. 'lipstick', 'face-serum', 'makeup-cosmetics'), or the full https://www.sephora.com/shop/... URL (for ca a sephora.com/ca link)."),
      page: page(),
      country: country(),
      sort: z.enum(SORTS).optional()
        .describe("ca only: relevance (default), best_selling, rating, price_low, price_high or newest."),
      filters: filters(),
      include_facets: includeFacets(),
      language: caLanguage(),
    },
    post("category"),
  );

  server.tool(
    "get_sephora_product",
    `One sephora.com (US) product: name, brand, rating, review count, loves count, price range, description, suggested usage, category and breadcrumbs, a summary of what reviews say with pro and con sentiment counts (no review text), and every shade or size as a sku with sku_id, shade, size, price, list and sale price, in_stock, only_few_left, ingredients, images, swatch, and pickup and same-day eligibility. With country 'ca', the ${CA} product (the same product and sku ids as sephora.com): CAD price_min / price_max, review_summary (Sephora's own AI-generated summary of customer reviews, labelled as Sephora's: not a fact), review_sentiments, latest_reviews (the 10 latest reviews the page shows, without reviewer names), and every sku with price, list and sale price, on_sale, in_stock, only_few_left, ingredients and national pickup / same-day eligibility flags; upc is always null (not shown). Not available for ca: stock per store, the full review list with sorts or a star filter. An unknown product is a 404 (charged for ca). 2 credits.`,
    {
      url: z.string().min(1).max(500).optional()
        .describe("sephora.com product URL (a search or category result's url), e.g. 'https://www.sephora.com/product/mac-cosmetics-m-a-cximal-silky-matte-lipstick-P510799'. Preferred: it answers faster. Pass this or product_id."),
      product_id: z.string().regex(/^[Pp]\d{3,12}$/).optional()
        .describe("Sephora product id (a result's product_id), e.g. 'P510799' (the same ids in Canada, e.g. 'P428500'). Pass this or url."),
      country: country(),
      language: caLanguage(),
    },
    post("product"),
  );

  server.tool(
    "get_sephora_brand",
    `${CA_ONLY} One brand's products: brand {brand_id, name, seo_name, url, description}, categories with product counts, ${CA_LISTING}. ${CAD} An unknown brand is a charged 404. 1 credit/call.`,
    {
      brand: z.string().min(1).max(300)
        .describe("Brand name as in a sephora.com/ca/en/brand/<name> link (e.g. 'the-ordinary', 'dior'; see get_sephora_brands), or the link itself."),
      page: page(),
      sort: caSort(),
      filters: filters(),
      include_facets: includeFacets(),
      language: language(),
    },
    post("brand"),
  );

  server.tool(
    "get_sephora_brands",
    `${CA_ONLY} Every brand in Sephora Canada's A-Z brand directory: language, count, brands [{brand_id, name, seo_name, url, letter}]. Use a seo_name with get_sephora_brand. 1 credit/call.`,
    {
      language: language(),
    },
    post("brands"),
  );

  server.tool(
    "get_sephora_suggestions",
    `${CA_ONLY} Sephora Canada's search-box suggestions for what the shopper has typed: query, language, count, terms (suggested searches) and products [{product_id, sku_id, name, brand, rating, review_count, image, url}], as the site gives them. 1 credit/call.`,
    {
      query: z.string().min(1).max(100)
        .describe("What the shopper has typed so far, e.g. 'lip'."),
      language: language(),
    },
    post("suggestions"),
  );

  server.tool(
    "get_sephora_offers",
    `${CA_ONLY} The current offers on Sephora Canada's beauty offers page: language, count, offers [{id, section, title, description, eligibility (as given: Online, In Store, Apps, Rouge, VIB, Insider), app_only, threshold, promo_code, promo_id, end_date (ISO with offset, as given; null when the offer states none), legal_copy, action_label, url}], note. Offers carry no start date; a start stated in an offer's text appears only in its description. No prices or member pricing. 2 credits.`,
    {
      language: language(),
    },
    post("offers"),
  );

  server.tool(
    "get_sephora_stores",
    `${CA_ONLY} The Canadian stores on Sephora Canada's store list, optionally one province: language, province, total_stores, province_counts, count, stores [{name, city, location (the mall), province, province_name, slug, url}]. Use a slug with get_sephora_store. No store finder by postal code. 1 credit/call.`,
    {
      province: z.enum(PROVINCES).optional()
        .describe("Only stores in this province or territory, e.g. 'QC'."),
      language: language(),
    },
    post("stores"),
  );

  server.tool(
    "get_sephora_store",
    `${CA_ONLY} One store by slug or link: store {store_id, slug, name, type, address {line1, line2, city, province, postal_code, country}, phone, latitude, longitude, time_zone, hours (monday..sunday as the page shows them), holiday_hours [{start_date, end_date, hours, closed, reason}], curbside_hours, services {buy_online_pick_up, in_store_pickup, curbside, beauty_services, store_events}, message, url}, language. No stock per store. An unknown store is a charged 404. 1 credit/call.`,
    {
      store: z.string().min(1).max(300)
        .describe("A store slug from get_sephora_stores (e.g. 'toronto-eaton-centre'), or the store's link."),
      language: language(),
    },
    post("store"),
  );
}
