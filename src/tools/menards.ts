import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/menards.ts. Cross-field rules the backend
// enforces and zod here does not: product takes item_id OR url; stores takes
// zip OR city+state. Menards has no search endpoint. No zod `.default()`: the
// MCP SDK would post a defaulted field on every call.

export function registerMenardsTools(server: McpServer, getClient: () => ScavioClient) {
  const post = (path: string) => async (params: Record<string, unknown>) => {
    try {
      const data = await getClient().post(`/api/v1/menards/${path}`, params);
      return trimResponse(data);
    } catch (err) {
      return handleApiError(err);
    }
  };

  server.tool(
    "get_menards_product",
    `One Menards product by item id or URL (there is no search): name, brand, model number, SKU, description, bullets, specifications, images, videos and documents, with the full price ladder: everyday price, sale price and its end date, mail-in rebates (text such as "11% REBATE*", amount, dates), final_price after rebates and the you-save amount. Also pickup, delivery and ship-to-store flags. Pass store_id for that store's stock quantity, stock message, aisle location and not_available_at_store; without it prices are the default store's (3598) and stock fields are null. Prices are in dollars. With store_id it can take 10-40 seconds. An unknown item id or store number is a 404. 1 credit; 2 credits with store_id.`,
    {
      item_id: z.string().regex(/^\d{8,16}$/).optional()
        .describe("Menards item id: the number after p- in a menards.com product URL, e.g. '60893666613'. Not the SKU or model number. Pass this or url."),
      url: z.string().max(2000).optional()
        .describe("A menards.com product URL, e.g. 'https://www.menards.com/main/p-60893666613.htm'. Pass this or item_id."),
      store_id: z.string().regex(/^\d{1,5}$/).optional()
        .describe("Menards store number from get_menards_stores, e.g. '3181'. Adds that store's stock quantity, stock message and aisle, priced for that store. Costs 2 credits instead of 1 and typically takes 10-40 seconds."),
    },
    post("product"),
  );

  server.tool(
    "get_menards_stores",
    `Menards stores near a US ZIP code or a city and state, nearest first: store number (store_id), name, address, coordinates, distance in miles and services (garden center, grocery, rental center, propane and more). Use a store_id with get_menards_product for that store's stock and aisle. 1 credit.`,
    {
      zip: z.string().regex(/^\d{5}(-\d{4})?$/).optional()
        .describe("US ZIP code, e.g. '55401'. Pass this, or city and state."),
      city: z.string().min(1).max(80).optional()
        .describe("City to search around, with state, e.g. 'Madison'."),
      state: z.string().regex(/^[A-Za-z]{2}$/).optional()
        .describe("2-letter US state code, with city, e.g. 'WI'."),
    },
    post("stores"),
  );
}
