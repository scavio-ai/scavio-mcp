import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/extraspace.ts (US only, USD, no country). Rules the backend
// enforces and zod here does not: search takes exactly one of term or latitude with longitude;
// facility and reviews take exactly one of store_id or url (an extraspace.com facility link);
// city-prices and locations take a US state as a 2-letter code or its name; city must contain
// letters.
// No zod `.default()`: the MCP SDK would post a defaulted field on every call.

const UNIT_SIZES = ["5x5", "5x10", "5x15", "10x10", "10x15", "10x20", "10x25", "10x30"] as const;
const SORTS = ["distance", "price"] as const;
const REVIEW_SORTS = ["recent", "oldest", "rating_desc", "rating_asc"] as const;

const FIRST = "Extra Space Storage (extraspace.com, the US self-storage REIT)";
const NAME = "Extra Space";
const ONE = "Costs 1 credit (credits_used is what was charged). Failed upstream calls and refused inputs are not charged; a not-found is charged.";
const PRICES =
  "Prices are monthly USD and labelled as the facility pages label them: in_store_price (IN STORE) and web_rate (WEB RATE); a price Extra Space does not give is null.";
const CARD =
  "store_id (the input of get_extraspace_facility and get_extraspace_reviews), store_number, name, url, address, city, state, state_name, postal_code, latitude, longitude, distance_mi, phone, promotion, starting_at {starting, small, medium, large, parking}, rating, review_count, hours, features, unit_sizes_available, is_coming_soon, is_grand_opening, expected_opening, best_prices [{unit_id, type, size_class, dimensions, width, depth, square_feet, features, promotions, first_come, limited, in_store_price, web_rate}], image, google_maps_url";

const storeId = z.union([z.string().regex(/^\d{1,12}$/), z.number().int().positive()]).optional()
  .describe("An Extra Space facility id (search_extraspace facilities[].store_id, the last number of the facility link, e.g. 1934). The store number in the facility name is a different number. Send store_id or url.");
const facilityUrl = z.string().min(20).max(400).optional()
  .describe("Or the extraspace.com facility link (search_extraspace facilities[].url).");

export function registerExtraspaceTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/extraspace/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "search_extraspace",
    `Self-storage facilities on ${FIRST} near a ZIP code, "City, ST", place or point: up to 120 facilities, nearest first (Extra Space has no further pages), filtered by climate control, drive-up, indoor, RV parking, enclosed vehicle storage, 24-hour access and unit sizes, sorted by distance or Starting at price. Returns term, latitude, longitude, search_center, did_you_mean (an ambiguous place: send one of them as term), currency, filters, sort, total, count, facilities [${CARD}], notes. ${PRICES} Captured 2026-11-26: ZIP 90012 gave 120 facilities, the nearest 6109 - Los Angeles - Main St at 0.44 miles, starting at 69 USD a month (medium 179, large 341, parking 437), rated 4.8 from 524 reviews, with a Flash Sale. A place with no match is a charged 404. US only. ${ONE}`,
    {
      term: z.string().min(2).max(100).optional()
        .describe('A ZIP code (90012), "City, ST" (Denver, CO) or a place. Send term, or latitude with longitude.'),
      latitude: z.number().min(-90).max(90).optional().describe("Or a point: latitude with longitude (e.g. 32.7767, -96.797 for Dallas)."),
      longitude: z.number().min(-180).max(180).optional().describe("Longitude, with latitude."),
      climate_controlled: z.boolean().optional().describe("Only facilities with climate-controlled units."),
      drive_up_access: z.boolean().optional().describe("Only facilities with drive-up units."),
      indoor: z.boolean().optional().describe("Only facilities with indoor units."),
      rv_parking: z.boolean().optional().describe("Only facilities with RV, boat or vehicle parking (covered or uncovered)."),
      enclosed_vehicle_storage: z.boolean().optional().describe("Only facilities with enclosed vehicle storage."),
      all_hour_access: z.boolean().optional().describe("Only facilities with 24-hour access."),
      unit_sizes: z.array(z.enum(UNIT_SIZES)).max(UNIT_SIZES.length).optional()
        .describe(`Only facilities with at least one of these sizes available: ${UNIT_SIZES.join(", ")}.`),
      sort: z.enum(SORTS).optional()
        .describe("distance (default, nearest first, as Extra Space orders them) or price (lowest Starting at price first; facilities without one last)."),
    },
    post("search"),
  );

  server.tool(
    "get_extraspace_facility",
    `One ${NAME} facility in full by id or link: store_id, store_number, name, url, address, latitude, longitude, phone, existing_customer_phone, time_zone, hours by type, has_24_hour_access, rating, review_count, promotion, starting_at, price_stats [{category, lowest, average, highest, historical_lowest, historical_average, historical_highest}] (as Extra Space's page data gives them), has_kiosk, has_available_inventory, is_newly_built, is_coming_soon, is_grand_opening, description, directions, google_maps_url, images, unit_class_count, available_unit_class_count, units [{unit_id, size_class, dimensions, width, depth, square_feet, exact_size, is_parking, features, available, available_count, first_come, limited, promotions, in_store_price, web_rate}], nearest_locations, notes. ${PRICES} Captured 2026-11-26: facility 1934, 1935 - Knoxville - Middlebrook Pike (Knoxville, TN), rated 4.9 from 699, with 14 of 43 unit classes available; a 10' x 15' climate-controlled indoor unit was 98 USD a month web rate against 172 in store, with First Month Free. An unknown id is a charged 404. ${ONE}`,
    {
      store_id: storeId,
      url: facilityUrl,
      include_unavailable: z.boolean().optional()
        .describe("Also list unit classes with nothing to rent now (default: only the classes available now, as the facility page lists them)."),
    },
    post("facility"),
  );

  server.tool(
    "get_extraspace_reviews",
    `The Google reviews shown on an ${NAME} facility page, sorted (recent, oldest, rating_desc, rating_asc), filtered by stars and paged by Scavio over the facility's full set: store_id, name, rating, rating_count (Extra Space's summary, star-only ratings included), review_count, histogram, stars, sort, page, page_size, total, pages, has_more, count, reviews [{review_id, rating, text, date, source, reply (Extra Space's reply; the reviewer's name reads [name]), reply_date}], notes. Captured 2026-11-26: facility 1934 in Knoxville had 485 reviews over 25 pages of 20 (rated 4.9 from 699 ratings); stars [1] gave 6. No reviewer name is returned. An unknown id is a charged 404. ${ONE}`,
    {
      store_id: storeId,
      url: facilityUrl,
      sort: z.enum(REVIEW_SORTS).optional()
        .describe("recent (default), oldest, rating_desc or rating_asc (newest first within a rating)."),
      stars: z.array(z.number().int().min(1).max(5)).max(5).optional()
        .describe("Only reviews with these star ratings, e.g. [1, 2]."),
      page: z.number().int().min(1).max(1000).optional().describe("Page, from 1; has_more says whether another exists."),
      page_size: z.number().int().min(1).max(100).optional().describe("Reviews per page, 1 to 100 (default 20)."),
    },
    post("reviews"),
  );

  server.tool(
    "get_extraspace_city_prices",
    `Self-storage prices in a US city as ${NAME}'s city page gives them: city, state, state_name, url, currency, search_center, rating, review_count, price_summary (the page's own sentences), price_stats [{category, store_count, lowest, average, highest, historical_lowest, historical_average, historical_highest}], count, facilities [${CARD}], notes. Captured 2026-11-26: Dallas, TX listed 120 facilities, and the page said "105 self storage facilities near Dallas, TX have small 5' x 5' units available now, starting at $7 and averaging $24 per month." City pages are large: allow up to 3 minutes. A city with no page is a charged 404. ${ONE}`,
    {
      city: z.string().min(2).max(80)
        .describe("Required. A US city Extra Space has a city page for (get_extraspace_locations cities[].city, e.g. Dallas)."),
      state: z.string().min(2).max(40).describe("Required. Its state: a 2-letter code or the state's name (e.g. TX)."),
    },
    post("city-prices"),
  );

  server.tool(
    "get_extraspace_locations",
    `The US cities ${NAME} lists for its place search (about 1,700 in 44 states and DC), optionally narrowed by state or by the start of a city name: state, query, total, states, count, cities [{city, state, state_name}], notes. city and state are the inputs of get_extraspace_city_prices. Captured 2026-11-26: 1700 cities in all, 125 of them in TX. ${ONE}`,
    {
      state: z.string().min(2).max(40).optional().describe("Only cities in this state (code or name)."),
      query: z.string().min(1).max(80).optional()
        .describe('Only cities whose name starts with this ("San", or "San Antonio, TX").'),
    },
    post("locations"),
  );
}
