import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/estatesales.ts (US only, USD, the 50 states and DC). Rules the backend
// enforces and zod here does not: sales takes zip, or city with state; companies takes metro (or its alias
// city) with state; sale takes sale_id or url, company org_id or url, item item_id or url, and when both
// are sent the id must match the link's; links must be estatesales.net links. No zod `.default()`: the MCP
// SDK would post a defaulted field on every call.

const STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;
const SALE_TYPES = [
  "estate_sales", "auctions", "moving_sales", "business_closings", "moved_offsite_to_warehouse", "by_appointment",
  "online_only_auctions", "auction_house", "moved_offsite_to_store", "charity_sales", "outside_sales",
  "single_item_type_collections", "buyouts_or_cleanouts", "demolition_sales", "online_estate_sales",
] as const;
const WHEN = ["any", "today", "tomorrow", "15_days"] as const;
const SORTS = ["distance", "start_date", "end_date", "newest", "most_pictures"] as const;

const FIRST = "EstateSales.net (estatesales.net, the US estate sale directory run by Vintage Software)";
const NAME = "EstateSales.net";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRIVATE =
  "Private sellers are never identified: a private sale gives its city, state and ZIP only (no name, phone, street address or coordinates). A company's name, phones, website and address are its public business contact.";
const DATES =
  "starts_at_local / ends_at_local (the sale's wall-clock time), starts_at_utc / ends_at_utc, dates [{starts_at_local, ends_at_local, starts_at_utc, ends_at_utc, show_end_time}]";
const PIC = "{url, thumbnail_url, width, height, description}";
const SLOW = "Answers can take 10 to 50 seconds: allow a client timeout of at least 150 s.";

const id = z.union([z.string().regex(/^\d{1,10}$/), z.number().int().positive()]);
const state = z.enum(STATES);

export function registerEstatesalesTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/estatesales/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_estatesales_sales",
    `Estate sales, auctions and moving sales near a US ZIP code or in a city's metro area on ${FIRST}, filtered by when they run and sale type and sorted 5 ways. Returns location {query, kind (zip or metro), state, city, metro, zip, heading, latitude, longitude}, when, types, sort, total_count and filtered_count (the site's own counts for the area), listed, count, sales [sale_id (the input of get_estatesales_sale), name, type, type_name, url, seller_type (company or private), company {org_id, name, page_url, website, phones, logo, package} (company-run sales), city, state, zip, address, address_released, latitude, longitude (company-run sales, once the address is released), distance_miles, schedule (Today, Tomorrow), ${DATES}, first_published_at, featured {local, regional, national}, picture_count, main_picture ${PIC}, auction_url, is_marketplace_sale], note. The page lists the first 20 sales of the area (nearest first) and has no deeper paging; when, type and sort apply to those 20. Captured 2026-11-26: around ZIP 75201 (Dallas, TX) the site counted 164 sales (87 in its default list) and listed 20, the nearest a sale moved offsite to a warehouse in Dallas 2.13 miles away with 629 pictures; around 10001 (New York, NY) with when tomorrow, 17 of the 20 listed matched. ${PRIVATE} An unknown ZIP or city is a charged 404. ${ONE}`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("A 5-digit US ZIP code (e.g. 75201): the sales around it. Send zip, or city with state."),
      city: z.string().min(2).max(80).optional()
        .describe("Or a US city (with state, e.g. Dallas): EstateSales.net lists the sales of its metro area."),
      state: state.optional().describe("A US state code (the 50 states and DC, e.g. TX); required with city."),
      when: z.enum(WHEN).optional()
        .describe("any (default), today, tomorrow or 15_days (starting within 15 days), read as the site's own date filter reads each sale."),
      type: z.array(z.enum(SALE_TYPES)).min(1).max(SALE_TYPES.length).optional()
        .describe(`Sale types to keep, any of: ${SALE_TYPES.join(", ")} (e.g. ["estate_sales"]).`),
      sort: z.enum(SORTS).optional()
        .describe("distance (default: the site's order, nearest first), start_date, end_date, newest (first published) or most_pictures."),
    },
    post("sales"),
  );

  server.tool(
    "get_estatesales_sale",
    `One ${NAME} sale in full by sale id or link: sale_id, name, type, type_name, url, status {message, has_started, is_over}, seller (company: {type, org_id, name, phones, page_url, website, logo, trusted}; private: {type}), location {address, city, state, zip, latitude, longitude, directions, address_released, address_shown_after_utc, address_shown_after_local}, ${DATES}, utc_offset, length_in_days, terms, description (plain text), featured, picture_count, pictures [${PIC}], auction_url, video_url, is_marketplace_sale, note. A company-run sale's street address is given as published, after its show-address time. Captured 2026-11-26: sale 5114622, a 3-day company-run estate sale in Garland, TX (2026-11-27 to 2026-11-29, starting tomorrow) with 287 pictures and its address released. ${PRIVATE} An unknown sale id is a charged 404. ${ONE}`,
    {
      sale_id: id.optional().describe("An EstateSales.net sale id (sales[].sale_id of get_estatesales_sales, e.g. 5114622). Send sale_id or url."),
      url: z.string().min(20).max(400).optional()
        .describe("Or the sale's estatesales.net link (sales[].url, https://www.estatesales.net/<ST>/<City>/<ZIP>/<sale id>)."),
    },
    post("sale"),
  );

  server.tool(
    "get_estatesales_companies",
    `Every estate sale company ${NAME} lists for a US metro area, in the site's order: state, metro, heading, count, companies [org_id (the input of get_estatesales_company), name, tagline, trusted, package, address, city, state, zip, latitude, longitude, phones, website, social {facebook, instagram, youtube, pinterest, linkedin, twitter}, page_url, logo, has_home_page, created_at, distance {miles, display}], note. A city resolves to its metro area. Captured 2026-11-26: the Dallas-Fort-Worth-Arlington metro (TX) listed 226 companies. Phones, websites and addresses are each company's public business contact as the directory shows it. An unknown metro is a charged 404. ${ONE}`,
    {
      state: state.describe("Required. The metro area's US state code (e.g. TX)."),
      metro: z.string().min(2).max(80).optional()
        .describe("The metro area as EstateSales.net names it (Dallas-Fort-Worth-Arlington, New-York) or a city in it (Dallas). Send metro or city."),
      city: z.string().min(2).max(80).optional().describe("Alias of metro: a city resolves to its metro area."),
    },
    post("companies"),
  );

  server.tool(
    "get_estatesales_company",
    `One estate sale company's public ${NAME} page by org id or link: profile {org_id, name, logo, phones, website, description, city, state, zip, page_url, primary_metro_area, metro_areas, social, memberships [{name, description}], has_home_page}, testimonials [{id, text, date}] (no author names), sales_count, sales [sale_id, name, type, type_name, url, address (as published), city, state, zip, status, has_started, starts_at_local, ends_at_local, picture_count, thumbnail_url, featured] (current and upcoming), note. Captured 2026-11-26: company 14402 (Arlington, TX) served 10 metro areas, had 22 testimonials and listed 19 sales. Phones, website and address are the company's public business contact. An unknown org id is a charged 404. ${SLOW} ${ONE}`,
    {
      org_id: id.optional()
        .describe("An EstateSales.net company id (companies[].org_id or sales[].company.org_id, e.g. 14402). Send org_id or url."),
      url: z.string().min(20).max(400).optional()
        .describe("Or the company's estatesales.net link (companies[].page_url, https://www.estatesales.net/companies/<ST>/<City>/<ZIP>/<org id>)."),
    },
    post("company"),
  );

  server.tool(
    "search_estatesales",
    `${NAME}'s keyword search over estate sales and marketplace items, 24 a page in the site's order (pages 1 to 4): query, page, page_size, total, total_pages, has_more, max_page, count, items [kind item: item_id (the input of get_estatesales_item), name, url, currency (USD), current_price, current_bid, buy_now_price, base_buy_now_price, bids, accepts_bids, buy_now, allows_shipping, shipping_cost, allows_local_pickup, city, state, starts_at_utc, ends_at_utc, main_picture; kind sale: sale_id, name, type, type_name, url, seller_type, company_name, address (company-run), city, state, zip, starts_at_local, ends_at_local, dates, featured, main_picture], companies [{org_id, name, city, state, zip, page_url}] (companies whose name matches), note. Item prices are in USD as listed. Captured 2026-11-26: lamp gave 1057 results over 45 pages (pages 1 to 4 can be read), the first a marketplace item in Greeley, CO at 5 USD; rolex gave 70. ${PRIVATE} ${SLOW} ${ONE}`,
    {
      query: z.string().min(2).max(100).describe("Required. A keyword (e.g. rolex, lamp, mid century modern): searches sales and marketplace items."),
      page: z.number().int().min(1).max(4).optional().describe("Page of 24, 1 to 4 (default 1); has_more says whether another exists."),
    },
    post("search"),
  );

  server.tool(
    "get_estatesales_item",
    `One ${NAME} marketplace item by item id or link: item_id, sale_id, name, url, description, currency (USD), prices {current, current_bid, starting_bid, minimum_bid, buy_now, base_buy_now, discount_percent}, bids, has_reserve, allows_bidding, allows_buy_now, shipping {allows_shipping, cost, days_to_ship}, pickup {allows_local_pickup, local_pickup_discount, details}, payment {online, in_person, in_person_details}, terms, categories [{id, name, parent_id}], tags, city, state, zip, published_at, starts_at_utc, ends_at_utc, utc_offset, status {has_started, has_ended, is_active, sale_has_ended}, dimensions, picture_count, pictures [{url, thumbnail_url}], seller {type, org_id, name, page_url, website, phones, logo, trusted} (the company selling it), note. Prices and bids are as of the fetch. Captured 2026-11-26: item 2038603 had a current bid of 635 USD after 4 bids (starting bid 100, minimum next bid 645), a reserve, local pickup only and no shipping. No bidder identity is returned. An unknown item id is a charged 404. ${ONE}`,
    {
      item_id: id.optional().describe("An EstateSales.net marketplace item id (items[].item_id of search_estatesales, e.g. 2038603). Send item_id or url."),
      url: z.string().min(20).max(400).optional()
        .describe("Or the item's estatesales.net link (https://www.estatesales.net/marketplace/items/<item id>)."),
    },
    post("item"),
  );
}
