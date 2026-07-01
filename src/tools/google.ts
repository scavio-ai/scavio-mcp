import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { ScavioClient } from "../lib/client.js";
import { ApiError } from "../lib/errors.js";

function handleApiError(err: unknown): never | { isError: true; content: { type: "text"; text: string }[] } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { isError: true, content: [{ type: "text", text: "Rate limited. Wait and retry." }] };
    if (err.status === 401) throw new McpError(ErrorCode.InternalError, "Invalid SCAVIO_API_KEY. Check your configuration.");
    return { isError: true, content: [{ type: "text", text: `Scavio API error (${err.status}): ${err.message}` }] };
  }
  throw new McpError(ErrorCode.InternalError, String(err));
}

export function registerGoogleTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_google",
    `Search Google (v2) and return structured SERP results as JSON: organic results (title, URL, snippet), ads, and the AI Overview when Google shows one. Use when the user asks to search the web, find current information, or look something up online. Costs 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Search query (1-500 characters)."),
      device: z.enum(["desktop", "mobile"]).optional()
        .describe("Device to emulate."),
      start: z.number().int().optional()
        .describe("Result offset: 0 = page 1, 10 = page 2, ... up to 990."),
      include_html: z.boolean().optional()
        .describe("Include the raw Google HTML in the response."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      google_domain: z.string().optional()
        .describe("Regional Google domain (e.g. 'google.co.uk')."),
      location: z.string().optional()
        .describe("Canonical location name; auto-encoded to a UULE string."),
      uule: z.string().optional()
        .describe("Pre-encoded UULE location string (takes priority over location)."),
      lr: z.string().optional()
        .describe("Language restrict (e.g. 'lang_en')."),
      cr: z.string().optional()
        .describe("Country restrict (e.g. 'countryUS')."),
      safe: z.enum(["active"]).optional()
        .describe("SafeSearch filter."),
      nfpr: z.boolean().optional()
        .describe("Disable spelling correction / auto-fixes when true."),
      filter: z.enum(["0", "1"]).optional()
        .describe("'0' disables the omitted/similar-results filter."),
      time_period: z.enum(["last_hour", "last_day", "last_week", "last_month", "last_year"]).optional()
        .describe("Restrict results to a recent time window."),
      resolve_ai_overview: z.boolean().optional()
        .describe("Resolve a deferred AI Overview (server default true)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_ai_mode",
    `Get a Google AI Mode conversational answer with references as JSON. Use when the user wants a synthesized, AI-generated answer to a question with cited sources rather than a plain list of links. Costs 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Question or prompt (1-500 characters)."),
      device: z.enum(["desktop", "mobile"]).optional()
        .describe("Device to emulate."),
      include_html: z.boolean().optional()
        .describe("Include the raw Google HTML in the response."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      google_domain: z.string().optional()
        .describe("Regional Google domain (e.g. 'google.co.uk')."),
      location: z.string().optional()
        .describe("Canonical location name; auto-encoded to a UULE string."),
      uule: z.string().optional()
        .describe("Pre-encoded UULE location string (takes priority over location)."),
      safe: z.enum(["active"]).optional()
        .describe("SafeSearch filter."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/ai-mode", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_maps_search",
    `Search Google Maps for local businesses as JSON. Each result includes name, address, rating, review count, place_id, data_cid, and coordinates. Use when the user wants to find places, businesses, or points of interest. Costs 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Search query (1-500 characters)."),
      start: z.number().int().optional()
        .describe("Result offset; must be a multiple of 20 (0, 20, 40, ...)."),
      ll: z.string().optional()
        .describe("Map center as '@lat,lng,zoomz'; controls where results come from."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      google_domain: z.string().optional()
        .describe("Regional Google domain (e.g. 'google.co.uk')."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/maps/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_maps_place",
    `Get Google Maps place details as JSON: name, address, phone, hours, rating, categories, and more. Provide one of place_id or data_cid. Costs 1 credit.`,
    {
      place_id: z.string().optional()
        .describe("Place ID (ChIJ...)."),
      data_cid: z.string().optional()
        .describe("Numeric CID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/maps/place", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_maps_reviews",
    `Get Google Maps reviews for a place as JSON. Each review includes author, rating, text, and timestamp. Provide one of data_id or place_id. Use next_page_token for pagination. Costs 1 credit.`,
    {
      data_id: z.string().optional()
        .describe("Data ID (0xHEX:0xHEX)."),
      place_id: z.string().optional()
        .describe("Place ID (ChIJ...)."),
      num: z.number().int().optional()
        .describe("Reviews per page (1-20)."),
      next_page_token: z.string().optional()
        .describe("Pagination cursor from a prior response."),
      sort_by: z.enum(["relevance", "newest", "highest_rating", "lowest_rating"]).optional()
        .describe("Sort order."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      google_domain: z.string().optional()
        .describe("Regional Google domain (e.g. 'google.co.uk')."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/maps/reviews", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_shopping",
    `Search Google Shopping product listings as JSON. Each result includes title, price, source/store, rating, and product identifiers. Use when the user wants to compare products and prices across retailers. Costs 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product search query (1-500 characters)."),
      device: z.enum(["desktop", "mobile"]).optional()
        .describe("Device to emulate."),
      start: z.number().int().optional()
        .describe("Result offset."),
      min_price: z.number().int().optional()
        .describe("Minimum price filter."),
      max_price: z.number().int().optional()
        .describe("Maximum price filter."),
      sort_by: z.number().int().optional()
        .describe("0 = relevance, 1 = price ascending, 2 = price descending."),
      free_shipping: z.boolean().optional()
        .describe("Only items with free shipping."),
      on_sale: z.boolean().optional()
        .describe("Only items on sale."),
      shoprs: z.string().optional()
        .describe("Opaque Google Shopping filter token."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      google_domain: z.string().optional()
        .describe("Regional Google domain (e.g. 'google.co.uk')."),
      location: z.string().optional()
        .describe("Canonical location name; auto-encoded to a UULE string."),
      uule: z.string().optional()
        .describe("Pre-encoded UULE location string (takes priority over location)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/shopping", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_shopping_product",
    `Get Google Shopping product detail and sellers as JSON. Pass catalog_id together with query for full data. Costs 1 credit.`,
    {
      catalog_id: z.string().optional()
        .describe("Durable product catalog id."),
      query: z.string().optional()
        .describe("Product query; required when catalog_id is set."),
      immersive_product_page_token: z.string().optional()
        .describe("Immersive product page token."),
      page_token: z.string().optional()
        .describe("Alias for immersive_product_page_token."),
      product_id: z.string().optional()
        .describe("Product id."),
      device: z.enum(["desktop", "mobile", "tablet"]).optional()
        .describe("Device to emulate."),
      google_domain: z.string().optional()
        .describe("Regional Google domain (e.g. 'google.co.uk')."),
      sort_by: z.enum(["base_price", "total_price", "promotion", "seller_rating"]).optional()
        .describe("Seller sort order."),
      load_all_stores: z.boolean().optional()
        .describe("Load all available stores."),
      more_stores: z.boolean().optional()
        .describe("Fetch additional stores."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      location: z.string().optional()
        .describe("Canonical location name; auto-encoded to a UULE string."),
      uule: z.string().optional()
        .describe("Pre-encoded UULE location string (takes priority over location)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/shopping/product", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_shopping_stores",
    `Get more sellers for a Google Shopping product as JSON (paginate google_shopping_product). Requires catalog_id and next_page_token. Costs 1 credit.`,
    {
      catalog_id: z.string()
        .describe("Durable product catalog id."),
      next_page_token: z.string()
        .describe("Pagination cursor from google_shopping_product."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/shopping/product/stores", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_flights",
    `Search Google Flights as JSON: itineraries with prices, durations, airlines, and stops. Requires departure_id, arrival_id, and outbound_date; set return_date when type=1 (round trip). Costs 1 credit.`,
    {
      departure_id: z.string()
        .describe("Departure IATA code(s); comma-separated allowed."),
      arrival_id: z.string()
        .describe("Arrival IATA code(s); comma-separated allowed."),
      outbound_date: z.string()
        .describe("Outbound date (YYYY-MM-DD)."),
      type: z.number().int().optional()
        .describe("1 = round trip, 2 = one way, 3 = multi-city."),
      return_date: z.string().optional()
        .describe("Return date (YYYY-MM-DD); required when type=1."),
      adults: z.number().int().optional()
        .describe("Number of adults (1-9)."),
      children: z.number().int().optional()
        .describe("Number of children (0-9)."),
      infants_in_seat: z.number().int().optional()
        .describe("Infants in seat (0-4)."),
      infants_on_lap: z.number().int().optional()
        .describe("Infants on lap (0-4)."),
      travel_class: z.number().int().optional()
        .describe("1 = economy, 2 = premium, 3 = business, 4 = first."),
      stops: z.number().int().optional()
        .describe("0 = any, 1 = nonstop, 2 = <=1 stop, 3 = <=2 stops."),
      sort_by: z.number().int().optional()
        .describe("1 = top, 2 = price, 3 = departure, 4 = arrival, 5 = duration, 6 = emissions."),
      include_airlines: z.string().optional()
        .describe("Comma-separated airline codes/alliances to include."),
      exclude_airlines: z.string().optional()
        .describe("Comma-separated airline codes/alliances to exclude."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      currency: z.string().optional()
        .describe("Currency code (ISO 4217, e.g. 'USD')."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/flights", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_hotels",
    `Search Google Hotels as JSON: properties with prices, ratings, and detail_tokens. Requires query, check_in_date, and check_out_date. Pass a returned detail_token to google_hotels_detail. Costs 1 credit.`,
    {
      query: z.string()
        .describe("Search query; use a '<City> hotels' form."),
      check_in_date: z.string()
        .describe("Check-in date (YYYY-MM-DD)."),
      check_out_date: z.string()
        .describe("Check-out date (YYYY-MM-DD)."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      currency: z.string().optional()
        .describe("Currency code (ISO 4217, e.g. 'USD')."),
      sort_by: z.number().int().optional()
        .describe("3 = lowest price, 8 = highest rating, 13 = most reviewed."),
      min_price: z.number().int().optional()
        .describe("Minimum nightly price."),
      max_price: z.number().int().optional()
        .describe("Maximum nightly price."),
      rating: z.number().int().optional()
        .describe("7 = 3.5+, 8 = 4.0+, 9 = 4.5+."),
      hotel_class: z.string().optional()
        .describe("Comma-separated star ratings (2-5)."),
      amenities: z.string().optional()
        .describe("Comma-separated amenity ids."),
      property_types: z.string().optional()
        .describe("Comma-separated property-type ids (e.g. '12' for vacation rentals)."),
      free_cancellation: z.boolean().optional()
        .describe("Only properties with free cancellation."),
      eco_certified: z.boolean().optional()
        .describe("Only eco-certified properties."),
      special_offers: z.boolean().optional()
        .describe("Only properties with special offers."),
      next_page_token: z.string().optional()
        .describe("Pagination cursor from a prior response."),
      limit: z.number().int().optional()
        .describe("Number of properties to return (1-20)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/hotels", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_hotels_detail",
    `Get Google Hotels property details as JSON from a hotels listing detail_token. Requires detail_token, check_in_date, and check_out_date. Costs 1 credit.`,
    {
      detail_token: z.string()
        .describe("Property detail token from a hotels listing."),
      check_in_date: z.string()
        .describe("Check-in date (YYYY-MM-DD)."),
      check_out_date: z.string()
        .describe("Check-out date (YYYY-MM-DD)."),
      currency: z.string().optional()
        .describe("Currency code (ISO 4217, e.g. 'USD')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/hotels/detail", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_news",
    `Get Google News results as JSON. Provide a query, or browse via a topic/story/publication token. Costs 1 credit.`,
    {
      query: z.string().optional()
        .describe("Keyword search."),
      topic_token: z.string().optional()
        .describe("Browse a news topic."),
      section_token: z.string().optional()
        .describe("Browse a topic section."),
      story_token: z.string().optional()
        .describe("Fetch full coverage of a story."),
      publication_token: z.string().optional()
        .describe("Browse a publication."),
      kgmid: z.string().optional()
        .describe("Knowledge Graph entity id."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      gl: z.string().optional()
        .describe("Country of the search (ISO 3166-1 alpha-2, e.g. 'us')."),
      google_domain: z.string().optional()
        .describe("Regional Google domain (e.g. 'google.co.uk')."),
      so: z.number().int().optional()
        .describe("Sort order: 0 = relevance, 1 = date (only with query or kgmid)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/news", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_trends",
    `Get Google Trends interest data as JSON. Requires a query (comma-separate terms to compare). Choose the dataset via data_type (interest over time, geo map, related queries/topics). Costs 1 credit.`,
    {
      query: z.string()
        .describe("Search term(s); comma-separated for comparisons."),
      geo: z.string().optional()
        .describe("Location code (e.g. 'US', 'GB', 'US-CA')."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      date: z.string().optional()
        .describe("Time range (e.g. 'today 12-m', 'now 7-d')."),
      tz: z.string().optional()
        .describe("Timezone offset in minutes."),
      data_type: z.enum(["TIMESERIES", "GEO_MAP", "GEO_MAP_0", "RELATED_QUERIES", "RELATED_TOPICS"]).optional()
        .describe("Which trends dataset to return."),
      cat: z.string().optional()
        .describe("Category id."),
      gprop: z.enum(["images", "news", "youtube", "froogle"]).optional()
        .describe("Google property filter."),
      region: z.enum(["COUNTRY", "REGION", "DMA", "CITY"]).optional()
        .describe("Resolution for GEO_MAP data."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/trends", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_trending",
    `Get Google Trending Now searches for a country as JSON. Requires geo (country code). Costs 1 credit.`,
    {
      geo: z.string()
        .describe("Country code (e.g. 'US')."),
      hl: z.string().optional()
        .describe("UI language (ISO 639-1, e.g. 'en')."),
      hours: z.number().int().optional()
        .describe("Trending window: 4, 24, 48, or 168."),
      cat: z.number().int().optional()
        .describe("Category id (0-20)."),
      sort: z.enum(["relevance", "search_volume", "recency", "title"]).optional()
        .describe("Sort order."),
      status: z.enum(["all", "active"]).optional()
        .describe("Filter by trend status."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/trending", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
