import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/mediaexpert.ts (mediaexpert.pl: one Polish
// store, PLN, Polish, no country input). Cross-field rules the backend
// enforces and zod here does not: product takes exactly one of product_id or
// url; reviews takes exactly one of sku, product_id or url; limit on list
// tools must be one of 5, 10, 15, 20, 30, 50. No zod `.default()`: the MCP SDK
// would post a defaulted field on every call.

const SORTS = ["relevance", "price_asc", "price_desc", "rating", "newest", "name_asc", "name_desc", "brand_asc", "brand_desc", "discount"] as const;
const REVIEW_SORTS = ["most_helpful", "least_helpful", "newest", "oldest", "highest_rating", "lowest_rating"] as const;

const STORE = "Media Expert is mediaexpert.pl, the Polish consumer-electronics and home-appliance chain: one Polish store, prices in PLN, so there is no country input. Names, specifications, labels and reviews come back in Polish, as Media Expert writes them.";
const BILL = "Billed on what the request actually costs (credits_used reports it). Failed upstream calls are not charged; a not-found is charged.";
const PAGE_CREDITS = `Costs 1 credit. ${BILL}`;
const LIST_CREDITS = `Costs 1 credit unsorted, 3 credits with a sort or when Media Expert loads the list lazily (one more lookup for the rest of the page). ${BILL}`;
const PRICES =
  "Prices are numbers in PLN: price (the listed price), old_price (Media Expert's struck-through price, as shown), omnibus_lowest_30d (the lowest price of the last 30 days that Media Expert shows next to a promotion under the EU Omnibus Directive, as shown), code_price {price, code, valid_from, valid_to} (the price with a discount code, the code and its dates), discount_shown {amount, percent} (Media Expert's own figure, where it shows one) and discount_percent (computed by Scavio from old_price, or for a code price from price, to the lowest price you can pay).";
const ITEM =
  "product_id (for get_mediaexpert_product and get_mediaexpert_store_stock), offer_id, sku (Media Expert's product code, for get_mediaexpert_reviews), ean, name, brand, model, url, image, price, old_price, omnibus_lowest_30d, code_price, discount_percent, discount_shown, currency, availability (Media Expert's type: available, preorder, not_available, advance for marketplace shipping), availability_label (as shown), rating, review_count, seller {id, name, slug, marketplace} (marketplace true for third-party marketplace sellers), in_store, energy_class, warranty_months, top_product, outlet, category {category_id, name, path}, labels (Media Expert's notes under the price, e.g. Darmowa dostawa: free delivery)";
const LIST_CORE = `sort, page, page_size, total (Media Expert's count; it stops at 5,000 for broad searches: total_capped), total_capped, total_pages (up to 100), has_more, count, currency, items (${ITEM})`;
const FACETS_OUT = "facets [{code, name, values [{name, count, filter}]}] (send filter back in filters)";
const LIST_OUT = `kind (products, or subcategories for a parent category page: subcategories [{category_id, name, path, url, product_count}]), title, breadcrumbs, ${LIST_CORE}, ${FACETS_OUT}`;
const NOT_AVAILABLE =
  "Not available: a price filter, Q&A (Media Expert has none), leaflets, price history (poll and store the answers), unit counts, checkout prices, other countries or languages.";

const sortField = z.enum(SORTS).optional()
  .describe("relevance (default: Media Expert's own order), price_asc, price_desc (Media Expert's own price order, kept as given: it follows promotional and code prices and is approximate against price, so re-sort the page if you need a strict order), rating, newest, name_asc, name_desc, brand_asc, brand_desc, discount. Any sort costs 3 credits.");
const pageField = z.number().int().min(1).max(100).optional().describe("Page, 1 to 100 (total_pages says how deep the list goes).");
const limitField = z.number().int().min(5).max(50).optional()
  .describe("Products per page: one of 5, 10, 15, 20, 30, 50 (default 30), the page sizes Media Expert offers.");
const filtersField = z.union([z.string().min(1).max(600), z.array(z.string().min(1).max(150)).min(1).max(10)]).optional()
  .describe("Up to 10 filters: facets[].values[].filter of an earlier answer (brand, promotions, Top Hit, instalments, energy class, specifications, marketplace seller), e.g. ['samsung', 'pojemnosc-kg_od-10-kg']. Several filters narrow together. There is no price filter.");
const listFields = { sort: sortField, page: pageField, limit: limitField };
const categoryPath = z.string().min(1).max(300);
const productId = z.union([z.string().min(1).max(11), z.number().int().positive()]);
const productRef = {
  product_id: productId.optional()
    .describe("Media Expert product id: items[].product_id (up to 8 digits), e.g. 8128227. The offer id (items[].offer_id, 9-10 digits) is refused."),
  url: z.string().min(20).max(500).optional().describe("A Media Expert product link (https://www.mediaexpert.pl/<category>/<product>)."),
};

export function registerMediaExpertTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/mediaexpert/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_mediaexpert",
    `Search Media Expert for prices, old prices, the Omnibus 30-day low and code prices: query, category_id, redirected_to {type, path, url} (Media Expert sends many single words to a category page, e.g. telewizor; the list then is that category's, with its ${FACETS_OUT}), ${LIST_CORE}. 30 products per page by default (up to 50), up to 100 pages. ${PRICES} ${STORE} ${NOT_AVAILABLE} Costs 3 credits for a search page (Media Expert loads search lists lazily: one more lookup for the rest of the page); 1 credit when it answers with a full category page. ${BILL}`,
    {
      query: z.string().min(1).max(200).describe("Search text (Polish works best: telewizor, pralka, iphone 17)."),
      category_id: z.union([z.string().min(1).max(9), z.number().int().positive()]).optional()
        .describe("Narrow the search to one category id (get_mediaexpert_categories categories[].category_id)."),
      ...listFields,
    },
    post("search"),
  );

  server.tool(
    "get_mediaexpert_product",
    `One Media Expert product in full by product_id or link: requested, ${ITEM}, marketplace, eans, description (plain text), images, key_attributes [{name, values}], specifications [{group, attributes [{name, values}]}], variants [{name, options [{value, product_id}]}] (colour, memory ...), delivery {delivery_label, store_pickup_label, parcel_locker_label (as Media Expert words them, e.g. w poniedziałek: on Monday), collect_in_1h, delivery_info, min_shipping_price}, installments {monthly, months, interest_rate}, seller {id, name, slug, marketplace, url, rating {total, recommended, not_recommended, recommended_percent}}, preorder, renewed, product_set, first_listed_at, rating_summary {average, recommendations, verified_purchases, features}, breadcrumbs, related [{product_id, name, url, image}]. A product Media Expert no longer lists is a charged 404. ${PRICES} ${STORE} ${PAGE_CREDITS}`,
    productRef,
    post("product"),
  );

  server.tool(
    "get_mediaexpert_store_stock",
    `One product's stock indicator at the Media Expert stores nearest a Polish city, town or postcode (up to 40, nearest first; small towns list the nearest stores and pickup points): product_id, location, count, in_stock_count, collect_in_1h_count, stores [{store_id, name, code, type (store or pickup_point), address {street, house_number, apartment, postcode, city, province}, phone, latitude, longitude, distance_km, hours [{day, open, close}], stock_level, in_stock, collect_in_1h (Media Expert's "Odbierz za godzinę": ready to collect within an hour), button_label, order_to_store_day (when it is not on the shelf: the day an order reaches that store, as Media Expert words it), display_unit, availability, availability_label}]. stock_level is Media Expert's stock indicator, a bucket, not a unit count (seen: 0, 2, 9, 20; 0 = none on the shelf). Send items[].product_id, not the offer id: an offer id answers 400 before anything is charged; an unknown product id is a charged 404; a marketplace item (shipped by its seller, never in stores) is a charged 400. Costs 2 credits. ${BILL}`,
    {
      product_id: productId.describe("Media Expert product id (items[].product_id), e.g. 8128227. Marketplace items are not stocked in stores."),
      location: z.string().min(2).max(60).describe("A Polish city or town (Warszawa, Kraków, Sanok) or a postcode (00-950)."),
      limit: z.number().int().min(1).max(40).optional().describe("Stores, nearest first, 1 to 40 (default 40)."),
    },
    post("store-stock"),
  );

  server.tool(
    "get_mediaexpert_stores",
    `Every Media Expert store (about 640) or the stores of one city: city, total_stores, count, stores [{store_id, store (the reference for store), url, address {street, house_number, apartment, postcode, city}, latitude, longitude, hours [{day, open, close}], closed_today, next_open_day, services (e.g. Skrytka ME Box, the store's parcel locker)}]. Or one store's page by store: the same fields plus phone, events and alerts. No stock here: for stock near a place use get_mediaexpert_store_stock. ${PAGE_CREDITS}`,
    {
      city: z.string().min(2).max(60).optional()
        .describe("Only the stores in this city (as Media Expert writes it; case and Polish accents do not matter), e.g. Warszawa."),
      store: z.string().min(3).max(300).optional()
        .describe("One store's page: stores[].store (e.g. warszawa/al-jerozolimskie-148) or its mediaexpert.pl/sklepy/... link."),
    },
    post("stores"),
  );

  server.tool(
    "get_mediaexpert_reviews",
    `Media Expert's own customer reviews of one product, up to 100 per page and every review reachable, by sku (1 call) or by product_id or link (the page names the sku): sku, product_id, sort, rating_min, rating_max, verified_only, page, limit, total, total_pages, has_more, count, average_rating, recommendations, verified_purchases, features [{name, average}] (Media Expert's per-feature averages), reviews [{id, rating, title, text, created_at, verified_purchase (Media Expert's "confirmed by purchase"), incentivized (the review came from a Media Expert promotional campaign, "Opinia z akcji promocyjnej"), incentive_label, feature_ratings [{name, rating}], helpful_yes, helpful_no, store_reply_count}]. With a star range Media Expert gives no total (has_more means a full page). Review text is in Polish. No reviewer name or any reviewer identity is returned. Marketplace offers carry no product code and have no Media Expert reviews (charged 404). ${PAGE_CREDITS}`,
    {
      sku: z.union([z.string().min(1).max(9), z.number().int().positive()]).optional()
        .describe("Media Expert product code: items[].sku, e.g. 709727 (the cheapest way in: 1 call)."),
      ...productRef,
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_helpful (default, Media Expert's own order), least_helpful, newest, oldest, highest_rating, lowest_rating."),
      rating_min: z.number().int().min(1).max(5).optional().describe("Lowest star rating to include (1-5)."),
      rating_max: z.number().int().min(1).max(5).optional().describe("Highest star rating to include (1-5)."),
      verified: z.boolean().optional().describe("Only reviews Media Expert marks as confirmed by purchase."),
      page: z.number().int().min(1).max(10_000).optional().describe("Page (every review is reachable)."),
      limit: z.number().int().min(1).max(100).optional().describe("Reviews per page, 1 to 100 (default 10)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_mediaexpert_category",
    `One Media Expert category's products by path, with filters (facets[].values[].filter), sort and paging: category, filters, ${LIST_OUT}. ${PRICES} ${STORE} ${LIST_CREDITS}`,
    {
      category: categoryPath
        .describe("A category path (get_mediaexpert_categories categories[].path, breadcrumbs[].path) or its mediaexpert.pl link, e.g. agd/pralki-i-suszarki/pralki."),
      filters: filtersField,
      ...listFields,
    },
    post("category"),
  );

  server.tool(
    "get_mediaexpert_categories",
    `Media Expert's category tree (24 departments, about 5,000 categories), or one category's subtree: category (the starting node), depth, count, node_count, categories [{category_id, name, path (the input of get_mediaexpert_category), url, product_count, child_count, children}]. Costs 2 credits. ${BILL}`,
    {
      category: categoryPath.optional().describe("Start the tree at this category path (e.g. agd)."),
      category_id: z.union([z.string().min(1).max(9), z.number().int().positive()]).optional()
        .describe("Start the tree at this category id (e.g. 12900)."),
      depth: z.number().int().min(1).max(6).optional()
        .describe("Levels to return, 1 to 6 (default 2 from the top, 3 from a category). child_count says what lies below a cut."),
    },
    post("categories"),
  );

  server.tool(
    "get_mediaexpert_brands",
    `Media Expert's brand directory (about 16,000 brands): query, letter, total_brands, matches, page, limit, has_more, count, featured, brands [{brand_id, name, slug (the input of get_mediaexpert_brand), url}]. ${PAGE_CREDITS}`,
    {
      query: z.string().min(1).max(100).optional().describe("Only brands whose name contains this text, e.g. sams."),
      letter: z.string().min(1).max(1).optional().describe("Only brands starting with this letter or digit."),
      page: z.number().int().min(1).max(10_000).optional().describe("Page."),
      limit: z.number().int().min(1).max(1000).optional().describe("Brands per page, 1 to 1000 (default 100)."),
    },
    post("brands"),
  );

  server.tool(
    "get_mediaexpert_brand",
    `One brand's products on Media Expert, optionally inside a category, with filters, sort and paging: brand, category, filters, ${LIST_OUT}. ${PRICES} ${STORE} ${LIST_CREDITS}`,
    {
      brand: z.string().min(1).max(120).describe("A brand: brands[].slug (e.g. samsung, amica) or its mediaexpert.pl/<brand> link."),
      category: categoryPath.optional().describe("Only this brand inside one category path (e.g. agd/pralki-i-suszarki/pralki)."),
      filters: filtersField,
      ...listFields,
    },
    post("brand"),
  );

  server.tool(
    "get_mediaexpert_promotions",
    `Media Expert promotion lists, Black Weeks included: without list, the lists its promotions page links (query, black_weeks, total_lists, count, lists [{list (the input of list), list_id, name, url, black_weeks}]; costs 1 credit); with list, that list's products (list, list_id, url, ${LIST_OUT}; 1 credit unsorted, 3 with a sort or a lazily loaded list). Every product also carries its own promotion data (old_price, omnibus_lowest_30d, code_price). ${PRICES} ${BILL}`,
    {
      list: z.string().min(3).max(300).optional()
        .describe("One promotion list: lists[].list (e.g. 32975-logitech-black-weeks-czas-na-nowy-poziom-sprzetu) or its mediaexpert.pl/lista,... link. Without it, the promotion lists."),
      query: z.string().min(1).max(100).optional().describe("Only lists whose name or reference contains this text (without list)."),
      black_weeks: z.boolean().optional().describe("Only Black Weeks / Black Friday lists (without list)."),
      ...listFields,
    },
    post("promotions"),
  );

  server.tool(
    "get_mediaexpert_outlet",
    `Media Expert's outlet (ex-display, returned and end-of-line items at outlet prices): without category, the outlet's groups (kind subcategories, with product counts); with an outlet group path, its subgroups or products (${LIST_OUT}). old_price is the price before the outlet price. ${PRICES} ${LIST_CREDITS}`,
    {
      category: categoryPath.optional()
        .describe("An outlet group path (subcategories[].path), e.g. outlet/outlet-agd/outlet-lodowki-wolnostojace. Without it, the outlet's groups."),
      filters: filtersField,
      ...listFields,
    },
    post("outlet"),
  );

  server.tool(
    "get_mediaexpert_seller",
    `A marketplace seller on Media Expert (third-party sellers next to Media Expert's own stock): seller {seller_id, name, slug, url, rating {total, recommended, not_recommended, recommended_percent}, min_shipping_price, delivery_info, categories [{category_id, name, product_count}]}, and its offers: ${LIST_CORE}. ${PRICES} ${LIST_CREDITS}`,
    {
      seller: z.string().min(1).max(200)
        .describe("A marketplace seller: items[].seller.slug (e.g. autobi) or its mediaexpert.pl/sprzedawca-marketplace/... link."),
      ...listFields,
    },
    post("seller"),
  );

  server.tool(
    "get_mediaexpert_suggestions",
    `Media Expert's search suggestions for a partial query: query, count, suggestions [{phrase, searches (how many times shoppers searched it, Media Expert's count), average_results}], categories [{name, path, url}]. ${PAGE_CREDITS}`,
    {
      query: z.string().min(1).max(100).describe("What the shopper has typed so far, e.g. pral."),
      limit: z.number().int().min(1).max(10).optional().describe("Suggestions, 1 to 10 (default 8, as on the site)."),
    },
    post("suggestions"),
  );
}
