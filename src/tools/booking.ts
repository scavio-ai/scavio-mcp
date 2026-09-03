import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

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
    .describe("YYYY-MM-DD. MUST send with checkout."),
  checkout: z.string().regex(ISO_DATE, "checkout must be YYYY-MM-DD").optional()
    .describe("YYYY-MM-DD. MUST send with checkin."),
  adults: z.number().int().min(1).optional()
    .describe("Default 2."),
  children_ages: z.array(z.number().int().min(0).max(17)).max(10).optional()
    .describe("One AGE per child, not a count."),
  rooms: z.number().int().min(1).optional()
    .describe("Default 1."),
  currency: z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO 4217 code").optional()
    .describe("e.g. 'USD'. Default USD."),
});

const hotelField = () =>
  z.string().min(1).max(500)
    .describe("Booking.com URL or slug. Prefer URL from search_booking; wrong slug+country is a BILLED 404.");

const countryCodeField = () =>
  z.string().regex(/^[A-Za-z]{2}$/, "country_code must be a two-letter country code").optional()
    .describe("e.g. 'us'. Only for bare slugs. Wrong value is a billed 404.");

export function registerBookingTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_booking",
    `Search Booking.com stays. Requires destination or dest_id. checkin+checkout MUST be sent together. 25/page. 1 credit/page.`,
    {
      destination: z.string().min(1).max(200).optional()
        .describe("e.g. 'Austin, Texas'. Required unless dest_id."),
      dest_id: z.string().regex(/^\d+$/, "dest_id must be numeric").optional()
        .describe("Numeric destination id. Required unless destination."),
      dest_type: z.enum(["city", "region", "country", "district", "landmark", "airport", "hotel"]).optional()
        .describe("Only with dest_id."),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based."),
      sort_by: z.enum(["popularity", "price_low", "price_high", "stars_high", "stars_low", "stars_and_price", "distance", "review_score"]).optional()
        .describe("Sort order."),
      min_price: z.number().min(0).optional()
        .describe("Min price/night."),
      max_price: z.number().min(0).optional()
        .describe("Max price/night."),
      stars: z.array(z.number().int().min(1).max(5)).min(1).max(5).optional()
        .describe("e.g. [4, 5]."),
      min_review_score: z.enum(["6", "7", "8", "9"]).optional()
        .describe("Min review score."),
      property_type: z.union([
        z.enum(["apartments", "hostels", "hotels", "motels", "resorts", "bed_and_breakfasts", "villas", "campgrounds", "vacation_homes", "lodges", "homestays"]),
        z.number().int().min(1),
      ]).optional()
        .describe("Type name or numeric id."),
      free_cancellation: z.boolean().optional()
        .describe("Free cancellation only."),
      no_prepayment: z.boolean().optional()
        .describe("No prepayment only."),
      breakfast_included: z.boolean().optional()
        .describe("Breakfast included only."),
      ...stayFields(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/booking/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_booking_hotel",
    `Full Booking.com property: rooms, rates, facilities, policies. Send checkin+checkout together. 1 credit.`,
    {
      hotel: hotelField(),
      country_code: countryCodeField(),
      ...stayFields(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/booking/hotel", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_booking_reviews",
    `Booking.com guest reviews with score breakdown. No pagination. 1 credit.`,
    {
      hotel: hotelField(),
      country_code: countryCodeField(),
      ...stayFields(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/booking/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
