import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/bringatrailer.ts (one site, no country; amounts in each lot's
// own currency). Rules the backend enforces and zod here does not: results takes one of make,
// model_id or location_id (location_id one id); no_reserve and premium are not combined on
// results; max_bid takes the site's steps only; category, origin and era take the listed names
// or ids; year_min <= year_max; page x page_size at most 10,000 on results; price-history needs
// model_id or make; listing takes slug or url. No zod `.default()`: the MCP SDK would post a
// defaulted field on every call.

const SORTS = ["recently_closed", "popular", "highest_bid", "oldest"] as const;
const STATUSES = ["all", "sold", "reserve_not_met"] as const;
const RECENCIES = ["7d", "30d", "1y", "2y", "5y"] as const;
const LIVE_SORTS = ["ending_soon", "ending_latest", "bid_high", "bid_low"] as const;
const MAX_BIDS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000];
const CATEGORIES =
  "Aircraft (543), All-Terrain Vehicles (431), Boats (383), Charity & Non-Profit (415), Convertibles (434), Diesels (560), Electric Vehicles (426), Go-Karts (428), Hot Rods (429), Kei Vehicles (556), Military Vehicles (447), Minibikes & Scooters (430), Motorcycles (70), Parts (379), Projects (10), Race Cars (11), Right-Hand Drive (557), RVs & Campers (436), Service Vehicles (479), Side-by-Sides (553), Station Wagons (433), Tractors (432), Trains (544), Truck & 4x4 (21), Vans (418), Wheels (380)";
const ORIGINS =
  "American (3), Brazilian (499), British (4), Canadian (498), Czech (542), Dutch (497), French (6), German (7), Italian (8), Japanese (9), Korean (496), Prewar (441), Spanish (82), Swedish (18)";
const ERAS = "2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920, 1910, 1900, pre-1900";

const FIRST = "Bring a Trailer (bringatrailer.com, the online collector-car auction site owned by Hearst)";
const NAME = "Bring a Trailer";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const CUR = "Amounts are in each lot's own currency (USD, EUR, GBP and others, as the site shows it).";
const PRIV = "No usernames, member profile links, chassis numbers / VINs or seller ZIP codes are returned.";
const LOT =
  'id, title, url, slug (the input of get_bringatrailer_listing), year (from the title), status (sold, reserve_not_met, withdrawn, ended), sold, amount (the sale price of a sold lot from the site\'s "Sold for" result, the high bid of a lot that ended under its reserve), currency, ended_at, no_reserve, premium, bat_alumni, country_code, thumbnail, excerpt';
const CARD = "id, title, url, slug, year, current_bid (null before any bid), currency, ends_at, no_reserve, premium, bat_alumni, country, country_code, thumbnail, excerpt";

const modelId = z
  .union([z.number().int().positive(), z.string().min(1).max(2400), z.array(z.union([z.number().int().positive(), z.string().min(1).max(12)])).min(1).max(200)])
  .optional()
  .describe("A model page id (an id from get_bringatrailer_suggestions or get_bringatrailer_make models[].id, e.g. 1833018 = BMW E30 M3), or a list of up to 200 ids (get_bringatrailer_model filter_ids, for a model family such as Porsche 911).");
const recency = z.enum(RECENCIES).optional()
  .describe("Only results that ended in the last 7 days (7d), 30 days (30d), 1, 2 or 5 years (1y, 2y, 5y). Default all time.");
const yearMin = z.number().int().min(1885).max(2027).optional().describe("Earliest model year (1885-2027, e.g. 1987).");
const yearMax = z.number().int().min(1885).max(2027).optional().describe("Latest model year (1885-2027, e.g. 1991).");

export function registerBringatrailerTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/bringatrailer/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_bringatrailer_results",
    `Search the completed auctions of ${FIRST}: keywords (or none), with the site's sorts (recently closed, popular, highest bid, oldest) and filters (sold or reserve not met, recency, model years, max bid, category, origin, era, no reserve, Premium, and one make, model_id or location_id), up to 60 a page, through the first 10,000 results of a query. Returns query, sort, status, filters_applied, page, page_size, total, total_pages, reachable_pages, has_more, count, lots [{${LOT}}], notes. View, watcher and comment counts are on get_bringatrailer_listing. Captured 2026-11-26: "e30 m3" matched 439 completed results; "porsche 911" with status reserve_not_met and recency 30d matched 120. ${CUR} ${ONE}`,
    {
      q: z.string().max(200).optional().describe("Keywords (e.g. e30 m3). Omitted: every completed result (filters and sort still apply)."),
      exclude: z.string().max(200).optional().describe("Leave out results matching these words (e.g. parts)."),
      sort: z.enum(SORTS).optional().describe("recently_closed (default), popular, highest_bid or oldest (the site's own sorts)."),
      status: z.enum(STATUSES).optional().describe("all (default), sold, or reserve_not_met (ended under the reserve)."),
      recency,
      year_min: yearMin,
      year_max: yearMax,
      max_bid: z.number().int().optional().describe(`Only results below this amount, one of the site's steps: ${MAX_BIDS.join(", ")}.`),
      category: z.union([z.string().min(1).max(60), z.number().int().positive()]).optional().describe(`A category name or id: ${CATEGORIES}.`),
      origin: z.union([z.string().min(1).max(40), z.number().int().positive()]).optional().describe(`An origin name or id: ${ORIGINS}.`),
      era: z.union([z.string().min(1).max(10), z.number().int()]).optional().describe(`A decade: ${ERAS}.`),
      no_reserve: z.boolean().optional().describe("Only no-reserve auctions (not together with premium: the site applies the two as either-or)."),
      premium: z.boolean().optional().describe("Only Premium listings (not together with no_reserve)."),
      make: z.string().min(1).max(60).optional()
        .describe("A make name as the site lists it (BMW, Porsche, Land Rover; get_bringatrailer_make filter.make). Use one of make, model_id or location_id."),
      model_id: modelId,
      location_id: z.union([z.number().int().positive(), z.string().min(1).max(12)]).optional()
        .describe("A location page id (get_bringatrailer_location location_id or a location suggestion id, e.g. 89009067 = Germany): only lots located there."),
      page: z.number().int().min(1).max(5000).optional().describe("Page (default 1). The site pages through the first 10,000 results of a query: page x page_size at most 10,000."),
      page_size: z.number().int().min(1).max(60).optional().describe("Results per page, 1-60 (default 36)."),
    },
    post("results"),
  );

  server.tool(
    "get_bringatrailer_price_history",
    `Every completed result of one model (model_id, or a list of ids for a model family) or make on ${FIRST}, in one call: total, sold_count, reserve_not_met_count, sell_through_rate, first_date, last_date, stats_by_currency {<currency>: {sold {count, min, max, median, average}, reserve_not_met {...}}}, capped (the site returns at most 10,000 results), results [{id, title, url, slug, date, amount (sale price or high bid), currency, sold, status}] newest to oldest, notes. Optional recency and model-year range. Captured 2026-11-26: the BMW E30 M3 (model_id 1833018) over the last year (recency 1y) had 70 results, 58 sold (sell-through 0.829), median sold price 59250 USD, plus 2 EUR lots that ended under the reserve. ${CUR} ${ONE}`,
    {
      model_id: modelId,
      make: z.string().min(1).max(60).optional()
        .describe("A make name (instead of model_id, e.g. Porsche): its results, at most the 10,000 most recent. Send model_id or make."),
      recency,
      year_min: yearMin,
      year_max: yearMax,
    },
    post("price-history"),
  );

  server.tool(
    "get_bringatrailer_listing",
    `One auction on ${NAME} by slug or link, live or ended: id, lot_number, title, url, status (live, sold, reserve_not_met, withdrawn, ended), sold, reserve_not_met, no_reserve, premium, bat_alumni, currency, current_bid (live), sold_price (the site's "Sold for" figure), high_bid (ended under the reserve), ends_at / ended_at, bid_count, comment_count, views, watchers, location {text, city, region, country, country_code} (no ZIP), seller_type (private_party or dealer) and seller_type_label as given, details (the Listing Details bullets, without the chassis number), categories, description, photo_count, photos, bat_history (earlier ${NAME} results of the same vehicle: result, amount, currency, date), bids [{amount, currency, time}] (the full bid history), comments {page, page_size, total, total_pages, has_more, items [{time, text, is_seller, likes}]}, notes. Captured 2026-11-26: a 1988 BMW M3 sold for 80000 USD after 29 bids, with 11598 views and 1220 watchers; a Euro 1994 BMW 850CSi sold for 109000 EUR. ${PRIV} An unknown slug is a charged 404. ${ONE}`,
    {
      slug: z.string().min(2).max(300).optional()
        .describe("A listing slug (lots[].slug, e.g. 1988-bmw-m3-272-2), the part after /listing/ in a bringatrailer.com link. Send slug or url."),
      url: z.string().min(10).max(2000).optional().describe("A bringatrailer.com/listing/<slug>/ link instead of slug."),
      comments_page: z.number().int().min(1).max(1000).optional().describe("Comments page (default 1)."),
      comments_page_size: z.number().int().min(1).max(500).optional().describe("Comments per page, 1-500 (default 100)."),
    },
    post("listing"),
  );

  server.tool(
    "get_bringatrailer_live",
    `Every live auction on ${FIRST} (about 1,000 lots, read from one page, so a call takes 20 seconds to 3 minutes), filtered by Scavio by keyword, make, country, ending within N hours, no reserve and Premium, sorted by ending time or current bid, paged. Returns total_live, total, sort, filters_applied, page, limit, has_more, count, lots [{${CARD}, era}], notes. Captured 2026-11-26: 1073 live lots. ${CUR} ${ONE}`,
    {
      q: z.string().max(200).optional().describe("Words in the lot title or excerpt (e.g. land cruiser)."),
      make: z.string().min(1).max(60).optional().describe("A make, matched in the lot title (e.g. Porsche)."),
      country: z.string().min(2).max(60).optional()
        .describe("Country of the lot: a two-letter code (US, DE, GB) or a country name as listed (United Kingdom)."),
      ending_within_hours: z.number().int().min(1).max(336).optional().describe("Only auctions scheduled to end within this many hours (1-336)."),
      no_reserve: z.boolean().optional().describe("Only no-reserve auctions."),
      premium: z.boolean().optional().describe("Only Premium listings."),
      sort: z.enum(LIVE_SORTS).optional().describe("ending_soon (default), ending_latest, bid_high or bid_low."),
      limit: z.number().int().min(1).max(2000).optional().describe("Lots per page, 1-2000 (default 100)."),
      page: z.number().int().min(1).max(1000).optional().describe("Page of the filtered list (default 1)."),
    },
    post("live"),
  );

  server.tool(
    "get_bringatrailer_make",
    `One make page of ${FIRST}: make, title, description, url, filter {make} (for get_bringatrailer_results and get_bringatrailer_price_history), model_count, models [{id, title, url, path, year_min, year_max, image}], live_count, live [{${CARD}}], completed_total, recent_results [{${LOT}}], notes. A make page can take up to a minute. Captured 2026-11-26: BMW listed 143 models, 68 live auctions and 22576 completed results. An unknown make is a charged 404. ${ONE}`,
    {
      make: z.string().min(1).max(300).describe("Required. A make slug or name (bmw, porsche, land-rover, Land Rover) or its bringatrailer.com link."),
    },
    post("make"),
  );

  server.tool(
    "get_bringatrailer_model",
    `One model page of ${FIRST} (e.g. bmw/e30-m3, or a family such as porsche/911): title, description, url, filter_ids (the model_id list for get_bringatrailer_results and get_bringatrailer_price_history), sub_models, live_count, live [{${CARD}}], completed_total, recent_results [{${LOT}}], notes. Captured 2026-11-26: bmw/e30-m3 had 2 live auctions and 491 completed results. An unknown model is a charged 404. ${ONE}`,
    {
      model: z.string().min(3).max(300)
        .describe("Required. A make and model path (get_bringatrailer_make models[].path, e.g. bmw/e30-m3 or porsche/911) or its bringatrailer.com link."),
    },
    post("model"),
  );

  server.tool(
    "get_bringatrailer_location",
    `The lots of ${FIRST} located in one country: title, url, location_id (for get_bringatrailer_results), live_count, live [{${CARD}}], completed_total, recent_results [{${LOT}}], notes. Captured 2026-11-26: Germany (location_id 89009067) had 3 live auctions and 250 completed results. An unknown country is a charged 404. ${ONE}`,
    {
      country: z.string().min(2).max(300)
        .describe("Required. A country name or slug (germany, united-kingdom, Italy) or its bringatrailer.com/location/ link."),
    },
    post("location"),
  );

  server.tool(
    "get_bringatrailer_suggestions",
    `The search-box suggestions of ${FIRST} for a partial make, model or place: query, count, suggestions [{id (the page id get_bringatrailer_results takes as model_id or location_id), title, type (make, model, location, other), url, path}], notes. Captured 2026-11-26: "land cruiser" gave 10 suggestions, among them Toyota Land Cruiser FJ25 and FJ55. ${ONE}`,
    {
      q: z.string().min(1).max(100).describe("Required. A partial make, model or place (e.g. land cruiser)."),
    },
    post("suggestions"),
  );
}
