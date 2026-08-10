import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// No zod `.default()` anywhere in this file, on purpose. The MCP SDK applies a
// zod default BEFORE the handler runs, so a defaulted field is posted on every
// single call whether the model set it or not — which is exactly how the
// shipped Walmart tool ended up sending a value the backend enum rejected.
// Upstream defaults are documented in the .describe() text instead and left for
// the backend to apply.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Search and listing take the same stay + party block. Built per-tool so no two
// tool schemas share an instance.
const stayFields = () => ({
  check_in: z.string().regex(ISO_DATE, "check_in must be YYYY-MM-DD").optional()
    .describe("Check-in date, YYYY-MM-DD. MUST be sent together with check_out — Airbnb prices a window, not a day."),
  check_out: z.string().regex(ISO_DATE, "check_out must be YYYY-MM-DD").optional()
    .describe("Check-out date, YYYY-MM-DD. Must be after check_in and sent together with it."),
  adults: z.number().int().min(1).optional()
    .describe("Adults in the party."),
  children: z.number().int().min(0).optional()
    .describe("Children aged 2-12."),
  infants: z.number().int().min(0).optional()
    .describe("Infants under 2."),
  pets: z.number().int().min(0).optional()
    .describe("Pets travelling with the party."),
});

const currencyField = () =>
  z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO 4217 code").optional()
    .describe("ISO 4217 display currency, e.g. 'USD'. Defaults to USD; without it Airbnb prices off the proxy exit and two identical requests can disagree.");

const listingIdField = () =>
  z.string().min(1).max(500)
    .describe("Airbnb listing id, e.g. '1704452615554844556', or a full airbnb.com/rooms/ URL. Query parameters on a pasted URL are discarded — they carry someone else's dates.");

export function registerAirbnbTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_airbnb",
    `Search Airbnb stays in a location as JSON. Each listing carries the STAY-TOTAL and PER-NIGHT price with the full discount ledger, rating and review count, bedrooms/beds/baths, coordinates, badges (Superhost, Guest Favourite), images, and the listing id.

This is the ONLY source of Airbnb prices. get_airbnb_listing returns no nightly rate under any parameters, so any pricing question has to be answered from here.

Send check_in and check_out TOGETHER. A dateless search silently defaults to a window 30 days out for 5 nights AND Airbnb A/B-tests both the window and the prices — the same URL has returned first-row prices of $680, $802 and $2,238 across runs. The response flags this as dates_are_defaulted. Pass explicit dates for anything you intend to reproduce or compare.

min_price and max_price are WHOLE-STAY totals, not per night. currency defaults to USD. room_type and the amenity names are validated before the scrape on purpose: an unrecognised value is not an error upstream, it returns the UNFILTERED set under a 200.

Paginate with page (18 listings per page) OR with cursor from a previous response — never both, because cursor wins and the request is rejected rather than silently billed for a discarded page number. Costs 1 credit per page.`,
    {
      location: z.string().min(1).max(200)
        .describe("Where to search: a city ('Austin, TX'), a region ('Lake Tahoe'), a ZIP, or a pasted airbnb.com/s/ URL. A location Airbnb cannot resolve is a 404, not an empty result."),
      ...stayFields(),
      min_price: z.number().min(0).optional()
        .describe("Minimum price for the WHOLE STAY (not per night), in the currency field."),
      max_price: z.number().min(0).optional()
        .describe("Maximum price for the WHOLE STAY (not per night), in the currency field. Must not be below min_price."),
      room_type: z.enum(["entire_home", "private_room", "shared_room", "hotel_room"]).optional()
        .describe("Restrict to one kind of place. Closed set — an unrecognised value would return the UNFILTERED set under a 200 upstream, so it is rejected here."),
      min_bedrooms: z.number().int().min(0).optional()
        .describe("Minimum bedrooms."),
      min_beds: z.number().int().min(0).optional()
        .describe("Minimum beds."),
      min_bathrooms: z.number().int().min(0).optional()
        .describe("Minimum bathrooms."),
      superhost: z.boolean().optional()
        .describe("Only Superhost listings."),
      instant_book: z.boolean().optional()
        .describe("Only Instant Book listings."),
      guest_favorite: z.boolean().optional()
        .describe("Only listings badged Guest Favourite."),
      free_cancellation: z.boolean().optional()
        .describe("Only listings offering free cancellation."),
      amenities: z.string().min(1).max(200).optional()
        .describe("Comma-separated amenity filter, e.g. 'wifi,pool'. Named vocabulary: wifi, air_conditioning, pool, kitchen, free_parking, washer, self_check_in, tv — or raw numeric Airbnb amenity ids. An unrecognised NAME is rejected before the scrape, because upstream it would silently return the unfiltered set."),
      currency: currencyField(),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. 18 listings per page. CANNOT be combined with cursor — sending both is rejected."),
      cursor: z.string().min(1).max(500).optional()
        .describe("A next_cursor from a previous response. Use INSTEAD of page — cursor wins, so sending both is rejected."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/airbnb/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_airbnb_listing",
    `Get one Airbnb listing in full as JSON: description, property and room type, capacity and room counts, the complete grouped amenity list (including the ones the place does NOT have), host profile and stats, house rules with parsed check-in/check-out times, cancellation policy, sleeping arrangements, photo tour and every image — and the RATING BREAKDOWN: six category ratings, the five-bucket star distribution, and Airbnb's AI-synthesised review tags.

IT RETURNS NO NIGHTLY PRICE. The Airbnb room page carries no rate under ANY parameters, with or without dates. Prices are search-only: use search_airbnb for them.

The rating breakdown lives here and NOT on get_airbnb_reviews, so this is the tool for aggregate review sentiment; get_airbnb_reviews is for individual review bodies.

Accepts a listing id or a full /rooms/ URL (query parameters are discarded — they carry someone else's dates). The stay parameters are accepted and echoed back, but they do not price anything. No pagination. Costs 1 credit.`,
    {
      listing_id: listingIdField(),
      ...stayFields(),
      currency: currencyField(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/airbnb/listing", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_airbnb_reviews",
    `Get Airbnb review BODIES for one listing as JSON: the guest's written comment, per-review rating, review date, and the reviewer's name, photo and location.

It does NOT carry the rating breakdown or the review tags — those are on get_airbnb_listing. Use this tool when you need what guests actually wrote.

Paginate with limit and offset: count is the listing's TOTAL review count, returned is how many this response holds, so page while offset + returned is below count. limit accepts 1-50 and defaults to 30 upstream. Send limit explicitly when paging — with no explicit limit the upstream returns a fixed 7 rows.

Accepts a listing id or a full /rooms/ URL. Costs 1 credit per page.`,
    {
      listing_id: listingIdField(),
      currency: currencyField(),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Review bodies per page, 1-50. Upstream default is 30. Send it explicitly when paging — with no explicit limit the upstream returns a fixed 7 rows."),
      offset: z.number().int().min(0).optional()
        .describe("Rows to skip, 0-based. Use with limit to page past the first set."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/airbnb/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
