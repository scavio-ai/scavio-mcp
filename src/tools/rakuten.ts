import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/rakuten.ts (Rakuten, the cashback site, formerly Ebates: us = rakuten.com USD,
// gb = rakuten.co.uk GBP, ca = rakuten.ca CAD in English or French; Rakuten Japan is not offered). Rules the
// backend enforces and zod here does not: each endpoint takes only the countries it lists (store-coupons and
// rates us + gb; suggestions, category, deals and in-store us only); language fr is for ca only; ca store pages go
// by slug, not id; category takes a slug (electronics or electronics/computers-tablets). No zod `.default()`: the
// MCP SDK would post a defaulted field on every call.

const SORTS = ["cashback", "recommended", "az", "za"] as const;
const CA_FLAGS = ["increased", "top", "new", "canadian", "bnpl"] as const;
const CA_DEPARTMENTS = [
  "baby-kids-toys", "books-music-movies-games", "clothing-shoes-accessories", "computers-electronics-office",
  "department-grocery-stores", "drugstores", "financial-services", "gift-cards", "gifts-flowers", "hardware-tools",
  "health-beauty", "home-auto-garden", "luxury", "make-your-move", "pets", "sports-outdoor", "travel-vacations",
] as const;
const SEARCH_TYPES = ["all", "stores", "coupons"] as const;
const DEAL_PAGES = ["black_friday", "cyber_monday", "coupons"] as const;

const RK = "Rakuten (rakuten.com, the cashback site, formerly Ebates)";
const ONE = "1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const LINKS = "Rakuten's shopping-trip links are never returned: page_path is the store's Rakuten page path as a plain identifier.";
const NO_DATES = "Rakuten publishes no end dates for cash back rates: poll and store the answers to track rate changes.";
const STORE =
  "store_id, name, slug, page_path, rate_text (as Rakuten writes it), was_text, elevated (true when Rakuten shows a was rate: a raised rate), reward {amount, type (percentage or fixed), up_to, tiered}, was_amount, in_store {rate_text, was_text, amount, type} or null, image";
const TIMEOUT = "Usually a few seconds; allow a client timeout of at least 240 s for a retried call.";

const page = (desc: string) => z.number().int().min(1).max(200).optional().describe(desc);
const idOrText = z.union([z.string().min(1).max(300), z.number().int().positive()]);
const country3 = z.enum(["us", "gb", "ca"]).optional()
  .describe("Market: us (rakuten.com, USD, default), gb (rakuten.co.uk, GBP) or ca (rakuten.ca, CAD).");
const country2 = z.enum(["us", "gb"]).optional()
  .describe("Market: us (rakuten.com, USD, default) or gb (rakuten.co.uk, GBP).");
const countryUs = z.enum(["us"]).optional()
  .describe("Market: us (rakuten.com, USD) only, the default.");
const language = z.enum(["en", "fr"]).optional()
  .describe("Rakuten Canada (country ca) only: en (default) or fr (French text, CAD).");
const storeRef = idOrText
  .describe("The store's Rakuten slug (macys: the path after /shop/ on rakuten.com and rakuten.co.uk; best-buy on rakuten.ca), its Rakuten page link, or its numeric store id (us, gb: stores[].store_id), e.g. 'macys' or 8333.");

export function registerRakutenTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/rakuten/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_rakuten_stores",
    `The store directory of ${RK} with every store's current cash back rate, in the US (rakuten.com), UK (rakuten.co.uk) or Canada (rakuten.ca, English or French). us and gb page Rakuten's all-stores list (36 a page; us filters by category); ca reads Rakuten Canada's list or one department and filters by flag (increased rate, top, new, Canadian, buy now pay later). Returns country, currency, sort, category, page, per_page, total (null on a filtered us list until its last page), pages, has_more, count, stores [${STORE}; ca adds coupons_only and flags {increased, top, new, canadian, bnpl}], categories (us) or departments and filters (ca), notes. Captured 2026-11-26: the US list sorted by cash back held 3208 stores over 90 pages, the first at 100% Cash Back (was 20%). ${NO_DATES} ${LINKS} ${TIMEOUT} ${ONE}`,
    {
      country: country3,
      language,
      category: idOrText.optional()
        .describe(`us: a Rakuten category slug or id from this tool's categories list (electronics or 651, clothing or 2, travel-vacations or 54). ca: a Rakuten Canada department (${CA_DEPARTMENTS.join(", ")}). Not on gb (its list has no category filter).`),
      sort: z.enum(SORTS).optional()
        .describe("cashback (highest rate first), recommended (Rakuten's order), az or za. Default: the site's own (us cashback, gb az, ca recommended = A to Z)."),
      filter: z.union([z.enum(CA_FLAGS), z.array(z.enum(CA_FLAGS)).max(5)]).optional()
        .describe("ca only: increased (raised rate), top, new, canadian, bnpl (buy now, pay later); several are combined."),
      page: page("Page, from 1 (36 stores a page)."),
    },
    post("stores"),
  );

  server.tool(
    "get_rakuten_store",
    `One store on ${RK} by slug, link or id: store_id, name, slug, page_path, rate_text, online {rate_text, was_text, amount, type, up_to, tiered}, elevated, was_amount, boosted, in_store {rate_text, reward_text, amount, type} or null, category_rates [{rate_text, amount, type, categories [{id, name}]}], terms {text, exclusions, special_terms}, in_store_terms (Rakuten's own text), posting_time, free_shipping, about, title, coupons {total, has_more, count, coupons [the first ones]}, reviews {average, count_text, items [{rating, text}]} (no reviewer names). ca (en or fr): rate_text, was_text, elevated, reward, category_rates [{category, rate_text, amount, type}], special_conditions, days_to_report, total_cash_back_to_date, attributes, coupons. Captured 2026-11-26: Macy's on rakuten.com at 12% Cash Back (was 2%) online plus 10 USD in-store; Argos on rakuten.co.uk up to 0.82% Cashback; Best Buy on rakuten.ca in French up to 6% (was 1%) with 25 category rates. ${NO_DATES} An unknown store is a charged not-found. ${LINKS} ${TIMEOUT} ${ONE}`,
    {
      country: country3,
      language,
      store: storeRef,
    },
    post("store"),
  );

  server.tool(
    "get_rakuten_store_coupons",
    `Every coupon and deal one store has on ${RK}, US or UK, 18 a page: store_id, name, page, per_page, total, pages, has_more, count, coupons [{coupon_id, store_id, store_name, description, code (null on a deal), restriction, tag (Rakuten's own label such as ENDS TODAY), rate_text, was_rate_text, image}], notes. Rakuten US and UK give no coupon end dates. Captured 2026-11-26: Macy's had 100 coupons and deals over 6 pages on rakuten.com. ${LINKS} ${TIMEOUT} ${ONE}`,
    {
      country: country2,
      store: storeRef,
      page: page("Page, from 1 (18 coupons a page)."),
    },
    post("store-coupons"),
  );

  server.tool(
    "get_rakuten_rates",
    `Current cash back rates for up to 100 stores in one call on ${RK}, US or UK: the cheap batch check for rate changes. Returns country, currency, requested, count, stores [{store_id, name, slug, page_path, rate_text, rate_with_type_text, amount, type, up_to, was_text, was_amount, elevated, tiered, in_store {rate_text, rate_with_type_text, was_text, amount, type} or null, image}] in the order asked, not_found (ids Rakuten did not answer). Captured 2026-11-26: Macy's 12% Cash Back, Kohl's 2% Cash Back, Expedia up to 12% Cash Back. ${NO_DATES} ${LINKS} ${TIMEOUT} ${ONE}`,
    {
      country: country2,
      store_ids: z.union([
        z.array(z.union([z.string().regex(/^\d{1,9}$/), z.number().int().positive()])).min(1).max(100),
        z.string().min(1).max(1100),
      ]).describe("1 to 100 Rakuten store ids (stores[].store_id from get_rakuten_stores), as an array or comma-separated, e.g. ['8333', '7206', '3930']."),
    },
    post("rates"),
  );

  server.tool(
    "search_rakuten",
    `Search ${RK} for a store, brand or product. type all (us, gb): top_store, offers_cash_back (false with no_cash_back_message when Rakuten says the store does not offer Cash Back), store_lists [{title (e.g. Stores that carry Nike), total, has_more, count, stores}], coupons {total, count, items}, products {total (Rakuten's count), has_more, count, items [{product_id, item_id, name, store_id, store_name, price_text, price, was_price_text, was_price, tag, rate_text, was_rate_text, store_count, image}]}. type stores: every store matching the query, 12 a page (us pages). type coupons: the coupons matching it. ca: stores, products and coupons (expires as an ISO date; null where Rakuten writes a far-future placeholder). Captured 2026-11-26: nike on rakuten.com gave Nike as the top store and 437925 products. ${LINKS} ${TIMEOUT} ${ONE}`,
    {
      country: country3,
      language,
      query: z.string().min(1).max(100)
        .describe("A store, brand or product, e.g. 'nike'."),
      type: z.enum(SEARCH_TYPES).optional()
        .describe("all (default: top store, stores, coupons, products), stores (every store matching the query, paged on us) or coupons."),
      page: page("us with type stores only: page, from 1 (12 stores a page)."),
    },
    post("search"),
  );

  server.tool(
    "get_rakuten_suggestions",
    `The rakuten.com search box suggestions (US) for what a member types: stores {total, items [{store_id, name, slug, page_path, rate_text, amount, type, up_to, in_store_text, logo}]} and products [{term, categories}]. ${TIMEOUT} ${ONE}`,
    {
      country: countryUs,
      query: z.string().min(1).max(60)
        .describe("What a member types in rakuten.com's search box, e.g. 'target'."),
    },
    post("suggestions"),
  );

  server.tool(
    "get_rakuten_category",
    `One rakuten.com category (US): every store with Cash Back in it, 36 a page, sorted recommended, cashback, az or za. Returns category {id, name, slug}, sort, page, per_page, total, pages, has_more, count, stores [${STORE}]; page 1 adds subcategories [{id, name, slug}] and sections (the category page's featured stores, deals, coupons and products) [{title, kind, total, has_more, count, items}]. Captured 2026-11-26: Electronics (id 651) held 258 stores over 8 pages with 7 subcategories. ${NO_DATES} An unknown category is a charged not-found. ${LINKS} ${TIMEOUT} ${ONE}`,
    {
      country: countryUs,
      category: z.string().min(1).max(120)
        .describe("A rakuten.com category slug (get_rakuten_stores categories[].slug: electronics, clothing, travel-vacations, home-garden; subcategories such as electronics/computers-tablets)."),
      sort: z.enum(SORTS).optional()
        .describe("recommended (default), cashback, az or za."),
      page: page("Page, from 1 (36 stores a page)."),
    },
    post("category"),
  );

  server.tool(
    "get_rakuten_deals",
    `Rakuten's event pages on rakuten.com (US): Black Friday, Cyber Monday or the deals and coupons hub, or one store's own Black Friday page. Returns country, currency, page, store, count, sections [{title, kind (stores, coupons or products), total, has_more, count, items}]: stores with current and was rates, coupons with codes, product deals with sale and was prices and Rakuten's tag (63% OFF) as given, plus notes. Rakuten gives no start or end dates. Captured 2026-11-26: the Black Friday page had 8 sections, the first 54 stores at 12% Cash Back. ${LINKS} ${TIMEOUT} ${ONE}`,
    {
      country: countryUs,
      page: z.enum(DEAL_PAGES).optional()
        .describe("black_friday (default), cyber_monday or coupons (Rakuten's deals and coupons hub)."),
      store: z.string().min(1).max(120).optional()
        .describe("With page black_friday: a store slug (e.g. 'macys') for that store's own Black Friday page."),
    },
    post("deals"),
  );

  server.tool(
    "get_rakuten_in_store",
    `Rakuten's card-linked in-store cash back offers (US), 21 a page: page, per_page, total, pages, has_more, count, offers [{offer_id, store_id, name, slug, page_path, rate_text, amount, type, status, terms (Rakuten's own text, its minimum spend as given), image}], notes. The public list only: Scavio never adds an offer to an account. Captured 2026-11-26: 84 offers over 4 pages, the first Finish Line at 2% In-Store. ${TIMEOUT} ${ONE}`,
    {
      country: countryUs,
      page: page("Page, from 1 (21 offers a page)."),
    },
    post("in-store"),
  );
}
