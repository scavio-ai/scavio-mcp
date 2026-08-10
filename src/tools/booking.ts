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

// Booking prices a STAY, not a property, so all three endpoints take the same
// occupancy block. Built per-tool so no two tool schemas share an instance.
const stayFields = () => ({
  checkin: z.string().regex(ISO_DATE, "checkin must be YYYY-MM-DD").optional()
    .describe("Check-in date, YYYY-MM-DD. MUST be sent together with checkout — Booking ignores a lone checkin and prices a default range of its own instead."),
  checkout: z.string().regex(ISO_DATE, "checkout must be YYYY-MM-DD").optional()
    .describe("Check-out date, YYYY-MM-DD. Must be after checkin and sent together with it."),
  adults: z.number().int().min(1).optional()
    .describe("Adults in the party. Upstream default is 2."),
  children_ages: z.array(z.number().int().min(0).max(17)).max(10).optional()
    .describe("One AGE (0-17) per child, not a count — Booking prices children by age. Max 10 entries."),
  rooms: z.number().int().min(1).optional()
    .describe("Rooms required. Upstream default is 1."),
  currency: z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO 4217 code").optional()
    .describe("ISO 4217 display currency, e.g. 'USD'. Defaults to USD; without it Booking prices off the proxy exit and two identical requests can disagree."),
});

const hotelField = () =>
  z.string().min(1).max(500)
    .describe("A booking.com property URL, or the bare page slug, e.g. 'citizenm-austin-downtown'. Query parameters on a pasted URL are discarded. Prefer the url a search_booking row returns — a bare slug with the wrong country_code is a real, BILLED 404.");

const countryCodeField = () =>
  z.string().regex(/^[A-Za-z]{2}$/, "country_code must be a two-letter country code").optional()
    .describe("Two-letter country segment of the property path, e.g. 'us'. Only consulted for a bare slug (a full URL carries its own). Defaults to us — a wrong value is a billed 404.");

export function registerBookingTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_booking",
    `Search Booking.com for hotels, apartments, hostels, resorts and other stays in a destination, as JSON. Each property carries its name and property url, the live price for the stay you asked for, review score and review count, star rating, location and distance, room type, and deal badges.

Either destination or dest_id is required. A search with NEITHER returns Booking's homepage — it still costs a credit and returns nothing. dest_type is silently ignored by Booking without dest_id, so it is rejected here rather than billed.

checkin and checkout must be sent TOGETHER. Send only one and Booking prices a default range of its own, returning real prices for dates you never asked for. currency defaults to USD; without it Booking prices off the proxy exit and two identical requests can disagree.

Chain the url on a result row into get_booking_hotel or get_booking_reviews — that is always cheaper than guessing a slug plus country_code, which is a real, BILLED 404 when wrong.

Paginate with page: 25 properties per page. min_review_score is an ENUM of '6', '7', '8' or '9' — Booking silently drops any other threshold. Costs 1 credit per page.`,
    {
      destination: z.string().min(1).max(200).optional()
        .describe("Free-text destination, e.g. 'Austin, Texas'. Required unless dest_id is given."),
      dest_id: z.string().regex(/^\d+$/, "dest_id must be numeric").optional()
        .describe("Booking's own NUMERIC destination id, e.g. '20126662'. Use it to pin an ambiguous name; a search response returns the dest_id it resolved. Required unless destination is given."),
      dest_type: z.enum(["city", "region", "country", "district", "landmark", "airport", "hotel"]).optional()
        .describe("What dest_id refers to. Only meaningful WITH dest_id and rejected without it, because Booking ignores it on its own."),
      page: z.number().int().min(1).optional()
        .describe("Results page, 1-based. 25 properties per page, 1 credit per page."),
      sort_by: z.enum(["popularity", "price_low", "price_high", "stars_high", "stars_low", "stars_and_price", "distance", "review_score"]).optional()
        .describe("Result sort order. Upstream default is 'popularity'. 'distance' ranks from the searched destination centre, not from your location."),
      min_price: z.number().min(0).optional()
        .describe("Minimum price PER NIGHT, in the currency field."),
      max_price: z.number().min(0).optional()
        .describe("Maximum price PER NIGHT, in the currency field. Must not be below min_price."),
      stars: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional()
        .describe("Star ratings to keep, e.g. [4, 5]. Multiple values are OR'd."),
      min_review_score: z.enum(["6", "7", "8", "9"]).optional()
        .describe("Minimum guest review score. ONLY '6', '7', '8' or '9' — Booking offers exactly these four floors and silently drops any other threshold."),
      property_type: z.union([
        z.enum(["apartments", "hostels", "hotels", "motels", "resorts", "bed_and_breakfasts", "villas", "campgrounds", "vacation_homes", "lodges", "homestays"]),
        z.number().int().min(1),
      ]).optional()
        .describe("Property type name, or a raw numeric Booking accommodation-type id for a type this list does not name."),
      free_cancellation: z.boolean().optional()
        .describe("Only properties offering free cancellation."),
      no_prepayment: z.boolean().optional()
        .describe("Only properties that take no prepayment."),
      breakfast_included: z.boolean().optional()
        .describe("Only rates that include breakfast."),
      ...stayFields(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/booking/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_booking_hotel",
    `Get one Booking.com property in full as JSON: its rooms and rate plans priced for the stay you asked for, facilities, house rules, check-in and check-out windows, cancellation and prepayment policies, images, location, and review scores.

It takes dates because Booking prices a STAY, not a property. Omit them and you do not get a property without prices — you get prices for a two-night range Booking chose. The response echoes whichever dates were used, so a price is never for an unknown stay. checkin and checkout must be sent together.

Accepts a booking.com property URL or the bare page slug. country_code is only consulted for a bare slug and defaults to 'us'; a wrong country on a bare slug is a real, BILLED 404, so chaining the url a search_booking row returns is always cheaper.

Single-property lookup with NO pagination. Costs 1 credit.`,
    {
      hotel: hotelField(),
      country_code: countryCodeField(),
      ...stayFields(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/booking/hotel", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_booking_reviews",
    `Get Booking.com guest reviews for one property as JSON, with the score breakdown by category (staff, cleanliness, value, location, comfort, facilities) and Booking's own summary of what guests praised and complained about.

There is NO PAGE PARAMETER — do not try to paginate this and do not invent one. One call returns one response: total_count is the property's WHOLE review history, count is how many reviews this response actually holds.

Accepts a booking.com property URL or the bare page slug, exactly like get_booking_hotel; country_code is only consulted for a bare slug and a wrong one is a real, BILLED 404. The stay parameters are accepted because Booking serves the review page inside a priced stay context. Costs 1 credit.`,
    {
      hotel: hotelField(),
      country_code: countryCodeField(),
      ...stayFields(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/booking/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
