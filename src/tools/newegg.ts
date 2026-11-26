import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/newegg.ts (newegg.com USD, newegg.ca CAD and the Newegg Global storefronts
// uk au nz jp ph sg kr th mx in local currency). Markets per endpoint, enforced by the backend: search,
// category, product and reviews on every storefront; offers, deals, seller, seller products and suggestions
// on us and ca (narrowed here to those two); categories on us only. Reviews need the item's review_params
// (group_id, subcategory_id) from get_newegg_product or a search item. No zod `.default()`: the MCP SDK would
// post a defaulted field on every call.

const COUNTRIES = ["us", "ca", "uk", "au", "nz", "jp", "ph", "sg", "kr", "th", "mx"] as const;
const US_CA = ["us", "ca"] as const;
const SORTS = ["featured", "price_asc", "price_desc", "best_selling", "top_rated", "most_reviews"] as const;
const DEAL_TYPES = ["shell_shocker", "black_friday"] as const;
const OFFER_CONDITIONS = ["all", "new", "used"] as const;
const OFFER_SORTS = ["price", "seller_rating"] as const;
const REVIEW_SORTS = ["most_helpful", "newest", "highest_rated", "lowest_rated"] as const;

const SITE = "Newegg (newegg.com, the US computer and electronics store)";
const CREDITS = "2 credits (credits_used is what was charged). Failed calls and refused inputs are not charged; a not-found is charged. Usually a few seconds; a retried call can take up to about 4 minutes: allow a client timeout of at least 240 s.";
const PRICES = "list_price is the struck-through price, price the price shown after instant_rebate; a promo code's discount is given apart (promo.code_discount) and never taken off price; lowest_price_30_days and is_lowest_price_30_days are Newegg's own figures as given.";
const ITEM =
  "type (item or combo), item_number, product_number, title, brand, model, url, list_price, price, instant_rebate, lowest_price_30_days, is_lowest_price_30_days, shipping {charge, free}, promo {text, code, code_discount}, badges, rating, review_count, seller {name, url_key, marketplace}, shipped_by_newegg, ship_from_country, in_stock, open_box, refurbished, sponsored, best_selling_rank, category, image, review_params {group_id, subcategory_id}, group; combos: combo_id, title, url, list_price, combo_discount, price, items";

const shopping = () =>
  z.enum(COUNTRIES).optional()
    .describe("us (default; www.newegg.com, USD), ca (www.newegg.ca, CAD) or a Newegg Global storefront: uk, au, nz, jp, ph, sg, kr, th, mx (local currency, part of the catalog, English).");
const usCa = () =>
  z.enum(US_CA).optional()
    .describe("us (default; www.newegg.com, USD) or ca (www.newegg.ca, CAD). The Newegg Global storefronts do not serve this tool.");
const sort = () =>
  z.enum(SORTS).optional()
    .describe("featured (default, the site's order), price_asc, price_desc, best_selling, top_rated or most_reviews.");
const page = () =>
  z.number().int().min(1).max(100).optional()
    .describe("Page, from 1 (36 to 60 items per page as the site lists them). A page past the last answers no items.");
const filters = () =>
  z.array(z.string().min(1).max(30)).max(10).optional()
    .describe("Up to 10 filters: sold_by_newegg, in_stock, new, recertified, used, open_box, lowest_price_30_days, 40_percent_off, or a facet id from an answer's facets[].options[].id (brands, specs, price bands), e.g. ['in_stock', 'sold_by_newegg'].");
const itemNumber = () =>
  z.string().min(6).max(30)
    .describe("A Newegg item number: N82E16819113877 or 19-113-877 (R suffix = open box), 9SIA2W0KDW5195 (a marketplace item) or 0D9-000E-00346 (search items[].item_number).");
const query = () => z.string().min(1).max(200);
const categoryId = () => z.string().regex(/^\d{4,12}$/);

export function registerNeweggTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/newegg/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_newegg",
    `Keyword search on ${SITE}, newegg.ca or a Newegg Global storefront. Filters by name (sold_by_newegg, in_stock, new, recertified, used, open_box, lowest_price_30_days, 40_percent_off) or facet id; sorts featured, price_asc, price_desc, best_selling, top_rated, most_reviews. Returns country, storefront, currency, query, sort, filters, page, total, count, items [${ITEM}], facets [{name, type, options [{id, name, selected}]}], categories [{name, category_id, children}] (this storefront's category ids), breadcrumbs, notes. ${PRICES} Marketplace items (item numbers starting 9SI) carry the marketplace seller's store name and url_key; sponsored items are flagged. Captured 2026-11-26: 'rtx 5070' gave 4556 results on newegg.com (the first an MSI Vector 16 HX AI gaming laptop at 1599 USD, list 1999), 279 on newegg.ca and 43 on the UK storefront (prices in GBP). ${CREDITS}`,
    {
      query: query().describe("Keywords, e.g. 'rtx 5070'."),
      country: shopping(),
      filters: filters(),
      sort: sort(),
      page: page(),
    },
    post("search"),
  );

  server.tool(
    "get_newegg_category",
    `The items of one Newegg category, with keywords, filters and sorts as search_newegg: category_id, query, sort, filters, page, total, count, items [${ITEM}], facets (the category's spec filters), breadcrumbs, notes. Category ids differ per storefront (GPUs: 100007709 on us, 100007708 on ca): take them from get_newegg_categories (us) or from a search answer's categories and breadcrumbs (every storefront). ${PRICES} Captured 2026-11-26: GPUs (100007709) in stock on newegg.com listed 5016 items. ${CREDITS}`,
    {
      category_id: categoryId()
        .describe("A category id of this storefront: categories[].category_id of get_newegg_categories (us) or of a search answer (every storefront), breadcrumbs[].category_id, or a category link's N=. E.g. '100007709'."),
      query: query().optional().describe("Keywords within the category."),
      country: shopping(),
      filters: filters(),
      sort: sort(),
      page: page(),
    },
    post("category"),
  );

  server.tool(
    "get_newegg_categories",
    `The newegg.com menu tree: department_count, category_count, categories [{name, category_id, link, children}], notes. category_id is the id get_newegg_category takes on us; entries without one are links Newegg sets (guides, promotions). Captured 2026-11-26: 17 departments and 1055 categories. US only. ${CREDITS}`,
    {
      country: z.enum(["us"]).optional()
        .describe("us (default; the newegg.com menu). Other storefronts are not served."),
    },
    post("categories"),
  );

  server.tool(
    "get_newegg_product",
    `One Newegg item by item number: item_number, buy_box_changed, requested_item, served_item, parent_item, title, brand, model, mpn, upc, url, currency, list_price, original_price, price, instant_rebate, lowest_price_30_days, is_lowest_price_30_days, black_friday_save_percent, promo {text, code, code_discount}, promo_expires_at, shell_shocker, badges [{title, starts_at, ends_at}], in_stock, stock, quantity_limit, shipping, ship_from_country, seller {name, url_key, marketplace, rating, review_count, top_rated}, shipped_by_newegg, open_box, refurbished, rating, review_count, review_params {group_id, subcategory_id} (the input of get_newegg_reviews), category, breadcrumbs, bullets, specs [{group, specs [{name, value}]}], warranty, images, variants {options, items [{item_number, options, active}]}, combo_builder, package_options, review_summary {total, stars}, reviews (those the page shows, up to 8, no reviewer names), questions [{question, date, upvotes, answers}], notes. When Newegg's own unit is unavailable the page serves a marketplace offer instead: buy_box_changed is true, requested_item is the item number you asked for and served_item the offer's. Prices are as the page shows them on this request: there is no separate live price check. ${PRICES} Captured 2026-11-26: AMD Ryzen 7 9800X3D (19-113-877) at 439.99 USD on newegg.com (list 506.99, 67 instant rebate, plus a 70 promo code given apart) and 549.99 CAD on newegg.ca. An unknown item number is a charged 404. ${CREDITS}`,
    {
      item_number: itemNumber(),
      country: shopping(),
    },
    post("product"),
  );

  server.tool(
    "get_newegg_offers",
    `Every seller's offer on one Newegg item (Newegg's own included), by condition: item_number, condition, sort, page, page_size, total, pages, count, tabs [{condition, count, lowest_price, lowest_price_item}], offers [{item_number, url, price, list_price, instant_rebate, shipping, condition, in_stock, seller {name, url_key, marketplace, rating, review_count, rating_12_months, review_count_12_months, top_rated}, shipped_by_newegg, ship_from_country, delivery_days {fastest, slowest}}], notes. price is the offer's price after its instant rebate; tabs come with page 1 in price order. Seller names are marketplace store names. An item no other seller offers answers total 0. Captured 2026-11-26: item 19-113-877 had 28 offers on newegg.com (26 new from 418.99 USD, 2 used from 449.99). us and ca only (the Global storefronts list no other sellers). ${CREDITS}`,
    {
      item_number: itemNumber(),
      country: usCa(),
      condition: z.enum(OFFER_CONDITIONS).optional()
        .describe("all (default), new or used."),
      sort: z.enum(OFFER_SORTS).optional()
        .describe("price (default, low to high) or seller_rating."),
      page: z.number().int().min(1).max(50).optional()
        .describe("Page, from 1."),
      page_size: z.number().int().min(1).max(20).optional()
        .describe("Offers per page, 1 to 20 (default 20)."),
    },
    post("offers"),
  );

  server.tool(
    "get_newegg_reviews",
    `Customer reviews of one Newegg item, 25 per page, with group_id and subcategory_id from the product (or search) answer's review_params: item_number, sort, rating, verified_only, page, per_page, total, pages, count, stars {5..1}, reviews [{rating, title, text, pros, cons, date, verified_owner, helpful_votes, total_votes, item_number (the variant a review was written for), item_title, language, manufacturer_reply}], notes. No reviewer names. One review pool across Newegg's storefronts. Captured 2026-11-26: item 19-113-877 had 316 reviews over 13 pages, 699 of them 5 stars by the star counts. ${CREDITS}`,
    {
      item_number: itemNumber(),
      group_id: z.number().int().min(1)
        .describe("review_params.group_id of the product (or search) answer for this item, e.g. 196668433."),
      subcategory_id: z.number().int().min(1)
        .describe("review_params.subcategory_id of the product (or search) answer for this item, e.g. 343."),
      country: shopping(),
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("most_helpful (default), newest, highest_rated or lowest_rated."),
      rating: z.number().int().min(1).max(5).optional()
        .describe("Only reviews with this star rating."),
      verified_only: z.boolean().optional()
        .describe("Only verified owners' reviews when true."),
      page: z.number().int().min(1).max(400).optional()
        .describe("Page of 25 reviews, from 1."),
    },
    post("reviews"),
  );

  server.tool(
    "get_newegg_deals",
    `Newegg's deal event stores: Shell Shocker (daily deals) or the Black Friday store, optionally one category: type, category_id, page, total, count, ends_at (the Shell Shocker countdown end, ISO; one for the whole event), items [${ITEM}], categories [{name, category_id, children}], notes. A single deal's end shows on get_newegg_product (promo_expires_at, badges[].ends_at). ${PRICES} Captured 2026-11-26: Shell Shocker listed 38 deals ending 2026-11-27T08:00:00Z. us and ca only. ${CREDITS}`,
    {
      type: z.enum(DEAL_TYPES).optional()
        .describe("shell_shocker (default, Newegg's daily deals) or black_friday (the Black Friday event store)."),
      category_id: categoryId().optional()
        .describe("Deals in this category (the answer's categories[].category_id)."),
      country: usCa(),
      page: page(),
    },
    post("deals"),
  );

  server.tool(
    "get_newegg_seller",
    `A Newegg marketplace seller's public store details: seller, name, seller_id (the input of get_newegg_seller_products), rating, review_count, positive_percent, about, return_policy, notes. Captured 2026-11-26: store TECH-EDGE rated 4.7 from 83 reviews, 93.98% positive. us and ca only. ${CREDITS}`,
    {
      seller: z.string().min(1).max(200)
        .describe("A marketplace seller's store key: items[].seller.url_key of search or offers, or a /Seller-Store/ link, e.g. 'TECH-EDGE'."),
      country: usCa(),
    },
    post("seller"),
  );

  server.tool(
    "get_newegg_seller_products",
    `The items one Newegg marketplace seller lists (seller_id from get_newegg_seller), with keywords, filters and sorts as search_newegg: seller_id, query, sort, filters, page, total, count, items [${ITEM}], facets, notes. ${PRICES} Captured 2026-11-26: seller 1066805289 listed 2216 items. us and ca only. ${CREDITS}`,
    {
      seller_id: z.string().regex(/^\d{4,12}$/)
        .describe("The seller's listing id: seller_id of get_newegg_seller, e.g. '1066805289'."),
      query: query().optional().describe("Keywords within the seller's items."),
      country: usCa(),
      filters: filters(),
      sort: sort(),
      page: page(),
    },
    post("seller-products"),
  );

  server.tool(
    "get_newegg_suggestions",
    `Newegg's search box suggestions for what has been typed: query, count, suggestions, product_count, products [{item_number, title, url, promo_text, rating, review_count, image}], notes. us and ca only. ${CREDITS}`,
    {
      query: z.string().min(1).max(100)
        .describe("What has been typed so far, e.g. 'rtx 5'."),
      country: usCa(),
    },
    post("suggestions"),
  );
}
