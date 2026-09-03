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

// Search and listing take the same stay + party block. Built per-tool so no two
// tool schemas share an instance.
const stayFields = () => ({
  check_in: z.string().regex(ISO_DATE, "check_in must be YYYY-MM-DD").optional()
    .describe("YYYY-MM-DD. Must pair with check_out."),
  check_out: z.string().regex(ISO_DATE, "check_out must be YYYY-MM-DD").optional()
    .describe("YYYY-MM-DD. Must pair with check_in."),
  adults: z.number().int().min(1).optional()
    .describe("Adults."),
  children: z.number().int().min(0).optional()
    .describe("Children 2-12."),
  infants: z.number().int().min(0).optional()
    .describe("Infants under 2."),
  pets: z.number().int().min(0).optional()
    .describe("Pets."),
});

const currencyField = () =>
  z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO 4217 code").optional()
    .describe("Currency, e.g. 'USD'. Default USD.");

const listingIdField = () =>
  z.string().min(1).max(500)
    .describe("Listing id or airbnb.com/rooms/ URL.");

export function registerAirbnbTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_airbnb",
    `Search Airbnb stays. ONLY source of prices (get_airbnb_listing has none). Send check_in+check_out together or prices default to random window. Prices are whole-stay totals, not per night. Paginate with page OR cursor, not both. 1 credit/page.`,
    {
      location: z.string().min(1).max(200)
        .describe("City, region, ZIP, or airbnb.com/s/ URL."),
      ...stayFields(),
      min_price: z.number().min(0).optional()
        .describe("Min whole-stay total (not per night)."),
      max_price: z.number().min(0).optional()
        .describe("Max whole-stay total."),
      room_type: z.enum(["entire_home", "private_room", "shared_room", "hotel_room"]).optional()
        .describe("Room type filter."),
      min_bedrooms: z.number().int().min(0).optional()
        .describe("Min bedrooms."),
      min_beds: z.number().int().min(0).optional()
        .describe("Min beds."),
      min_bathrooms: z.number().int().min(0).optional()
        .describe("Min baths."),
      superhost: z.boolean().optional()
        .describe("Superhost only."),
      instant_book: z.boolean().optional()
        .describe("Instant Book only."),
      guest_favorite: z.boolean().optional()
        .describe("Guest Favourite only."),
      free_cancellation: z.boolean().optional()
        .describe("Free cancellation only."),
      amenities: z.string().min(1).max(200).optional()
        .describe("Comma-separated, e.g. 'wifi,pool'. Names: wifi, air_conditioning, pool, kitchen, free_parking, washer, self_check_in, tv."),
      currency: currencyField(),
      page: z.number().int().min(1).optional()
        .describe("Page, 1-based. Cannot combine with cursor."),
      cursor: z.string().min(1).max(500).optional()
        .describe("Cursor from previous response. Cannot combine with page."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/airbnb/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_airbnb_listing",
    `Get full Airbnb listing details, amenities, host, rules, photos, rating breakdown. NO PRICES here; use search_airbnb for pricing. 1 credit.`,
    {
      listing_id: listingIdField(),
      ...stayFields(),
      currency: currencyField(),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/airbnb/listing", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_airbnb_reviews",
    `Get Airbnb review text for a listing. Rating breakdown is on get_airbnb_listing, not here. Paginate with limit+offset. Send limit explicitly or upstream returns only 7. 1 credit/page.`,
    {
      listing_id: listingIdField(),
      currency: currencyField(),
      limit: z.number().int().min(1).max(50).optional()
        .describe("Reviews per page, 1-50. Default 30, but returns 7 if omitted."),
      offset: z.number().int().min(0).optional()
        .describe("Skip rows, 0-based."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/airbnb/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
