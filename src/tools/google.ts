import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerGoogleTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_google",
    `Search Google, return SERP results with organic, ads, AI Overview. 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Search query."),
      device: z.enum(["desktop", "mobile"]).optional()
        .describe("Device."),
      start: z.number().int().optional()
        .describe("Offset: 0=page 1, 10=page 2."),
      include_html: z.boolean().optional()
        .describe("Include raw HTML."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      google_domain: z.string().optional()
        .describe("e.g. 'google.co.uk'."),
      location: z.string().optional()
        .describe("Location name, auto-encoded to UULE."),
      uule: z.string().optional()
        .describe("UULE string, overrides location."),
      lr: z.string().optional()
        .describe("e.g. 'lang_en'."),
      cr: z.string().optional()
        .describe("e.g. 'countryUS'."),
      safe: z.enum(["active"]).optional()
        .describe("SafeSearch."),
      nfpr: z.boolean().optional()
        .describe("Disable spelling correction."),
      filter: z.enum(["0", "1"]).optional()
        .describe("'0' disables omitted-results filter."),
      time_period: z.enum(["last_hour", "last_day", "last_week", "last_month", "last_year"]).optional()
        .describe("Time window."),
      resolve_ai_overview: z.boolean().optional()
        .describe("Resolve deferred AI Overview (default true)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_ai_mode",
    `Google AI Mode: synthesized answer with cited sources. 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Question or prompt."),
      device: z.enum(["desktop", "mobile"]).optional()
        .describe("Device."),
      include_html: z.boolean().optional()
        .describe("Include raw HTML."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      google_domain: z.string().optional()
        .describe("e.g. 'google.co.uk'."),
      location: z.string().optional()
        .describe("Location name, auto-encoded to UULE."),
      uule: z.string().optional()
        .describe("UULE string, overrides location."),
      safe: z.enum(["active"]).optional()
        .describe("SafeSearch."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/ai-mode", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_maps_search",
    `Search Google Maps for local businesses and places. 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Search query."),
      start: z.number().int().optional()
        .describe("Offset, multiples of 20."),
      ll: z.string().optional()
        .describe("Map center '@lat,lng,zoomz'."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      google_domain: z.string().optional()
        .describe("e.g. 'google.co.uk'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/maps/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_maps_place",
    `Google Maps place details. Provide place_id or data_cid. 1 credit.`,
    {
      place_id: z.string().optional()
        .describe("Place ID (ChIJ...)."),
      data_cid: z.string().optional()
        .describe("Numeric CID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/maps/place", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_maps_reviews",
    `Google Maps reviews for a place. Provide data_id or place_id. Paginate with next_page_token. 1 credit.`,
    {
      data_id: z.string().optional()
        .describe("Data ID (0xHEX:0xHEX)."),
      place_id: z.string().optional()
        .describe("Place ID (ChIJ...)."),
      num: z.number().int().optional()
        .describe("Reviews per page, 1-20."),
      next_page_token: z.string().optional()
        .describe("Pagination cursor."),
      sort_by: z.enum(["relevance", "newest", "highest_rating", "lowest_rating"]).optional()
        .describe("Sort order."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      google_domain: z.string().optional()
        .describe("e.g. 'google.co.uk'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/maps/reviews", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_shopping",
    `Search Google Shopping for products with prices across retailers. 1 credit.`,
    {
      query: z.string().min(1).max(500)
        .describe("Product query."),
      device: z.enum(["desktop", "mobile"]).optional()
        .describe("Device."),
      start: z.number().int().optional()
        .describe("Result offset."),
      min_price: z.number().int().optional()
        .describe("Min price."),
      max_price: z.number().int().optional()
        .describe("Max price."),
      sort_by: z.number().int().optional()
        .describe("0=relevance, 1=price asc, 2=price desc."),
      free_shipping: z.boolean().optional()
        .describe("Free shipping only."),
      on_sale: z.boolean().optional()
        .describe("On sale only."),
      shoprs: z.string().optional()
        .describe("Shopping filter token."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      google_domain: z.string().optional()
        .describe("e.g. 'google.co.uk'."),
      location: z.string().optional()
        .describe("Location name, auto-encoded to UULE."),
      uule: z.string().optional()
        .describe("UULE string, overrides location."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/shopping", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_shopping_product",
    `Google Shopping product detail and sellers. Pass catalog_id+query for full data. 1 credit.`,
    {
      catalog_id: z.string().optional()
        .describe("Product catalog id."),
      query: z.string().optional()
        .describe("Required with catalog_id."),
      immersive_product_page_token: z.string().optional()
        .describe("Product page token."),
      page_token: z.string().optional()
        .describe("Alias for immersive_product_page_token."),
      product_id: z.string().optional()
        .describe("Product id."),
      device: z.enum(["desktop", "mobile", "tablet"]).optional()
        .describe("Device."),
      google_domain: z.string().optional()
        .describe("e.g. 'google.co.uk'."),
      sort_by: z.enum(["base_price", "total_price", "promotion", "seller_rating"]).optional()
        .describe("Seller sort."),
      load_all_stores: z.boolean().optional()
        .describe("Load all stores."),
      more_stores: z.boolean().optional()
        .describe("Fetch more stores."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      location: z.string().optional()
        .describe("Location name, auto-encoded to UULE."),
      uule: z.string().optional()
        .describe("UULE string, overrides location."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/shopping/product", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_shopping_stores",
    `Paginate google_shopping_product sellers. 1 credit.`,
    {
      catalog_id: z.string()
        .describe("Product catalog id."),
      next_page_token: z.string()
        .describe("Cursor from google_shopping_product."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/shopping/product/stores", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_flights",
    `Search Google Flights. Requires departure_id, arrival_id, outbound_date; set return_date for round trip (type=1). 1 credit.`,
    {
      departure_id: z.string()
        .describe("IATA code(s), comma-separated."),
      arrival_id: z.string()
        .describe("IATA code(s), comma-separated."),
      outbound_date: z.string()
        .describe("YYYY-MM-DD."),
      type: z.number().int().optional()
        .describe("1=round trip, 2=one way, 3=multi-city."),
      return_date: z.string().optional()
        .describe("YYYY-MM-DD; required when type=1."),
      adults: z.number().int().optional()
        .describe("Adults, 1-9."),
      children: z.number().int().optional()
        .describe("Children, 0-9."),
      infants_in_seat: z.number().int().optional()
        .describe("0-4."),
      infants_on_lap: z.number().int().optional()
        .describe("0-4."),
      travel_class: z.number().int().optional()
        .describe("1=economy, 2=premium, 3=business, 4=first."),
      stops: z.number().int().optional()
        .describe("0=any, 1=nonstop, 2=1 stop, 3=2 stops."),
      sort_by: z.number().int().optional()
        .describe("1=top, 2=price, 3=departure, 4=arrival, 5=duration, 6=emissions."),
      include_airlines: z.string().optional()
        .describe("Airline codes to include, comma-separated."),
      exclude_airlines: z.string().optional()
        .describe("Airline codes to exclude, comma-separated."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      currency: z.string().optional()
        .describe("e.g. 'USD'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/flights", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_hotels",
    `Search Google Hotels. Pass detail_token from results to google_hotels_detail. 1 credit.`,
    {
      query: z.string()
        .describe("e.g. 'Austin hotels'."),
      check_in_date: z.string()
        .describe("YYYY-MM-DD."),
      check_out_date: z.string()
        .describe("YYYY-MM-DD."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      currency: z.string().optional()
        .describe("e.g. 'USD'."),
      sort_by: z.number().int().optional()
        .describe("3=lowest price, 8=highest rating, 13=most reviewed."),
      min_price: z.number().int().optional()
        .describe("Min nightly price."),
      max_price: z.number().int().optional()
        .describe("Max nightly price."),
      rating: z.number().int().optional()
        .describe("7=3.5+, 8=4.0+, 9=4.5+."),
      hotel_class: z.string().optional()
        .describe("Star ratings, e.g. '4,5'."),
      amenities: z.string().optional()
        .describe("Amenity ids, comma-separated."),
      property_types: z.string().optional()
        .describe("Property-type ids, e.g. '12'."),
      free_cancellation: z.boolean().optional()
        .describe("Free cancellation only."),
      eco_certified: z.boolean().optional()
        .describe("Eco-certified only."),
      special_offers: z.boolean().optional()
        .describe("Special offers only."),
      next_page_token: z.string().optional()
        .describe("Pagination cursor."),
      limit: z.number().int().optional()
        .describe("Results to return, 1-20."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/hotels", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_hotels_detail",
    `Google Hotels property detail from a detail_token. 1 credit.`,
    {
      detail_token: z.string()
        .describe("From google_hotels results."),
      check_in_date: z.string()
        .describe("YYYY-MM-DD."),
      check_out_date: z.string()
        .describe("YYYY-MM-DD."),
      currency: z.string().optional()
        .describe("e.g. 'USD'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/hotels/detail", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_news",
    `Google News results. Query or browse via topic/story/publication token. 1 credit.`,
    {
      query: z.string().optional()
        .describe("Keyword search."),
      topic_token: z.string().optional()
        .describe("Topic token."),
      section_token: z.string().optional()
        .describe("Section token."),
      story_token: z.string().optional()
        .describe("Story token."),
      publication_token: z.string().optional()
        .describe("Publication token."),
      kgmid: z.string().optional()
        .describe("Knowledge Graph entity id."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      gl: z.string().optional()
        .describe("Country, e.g. 'us'."),
      google_domain: z.string().optional()
        .describe("e.g. 'google.co.uk'."),
      so: z.number().int().optional()
        .describe("0=relevance, 1=date."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/news", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_trends",
    `Google Trends interest data. Comma-separate query terms to compare. 1 credit.`,
    {
      query: z.string()
        .describe("Term(s), comma-separated to compare."),
      geo: z.string().optional()
        .describe("e.g. 'US', 'US-CA'."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      date: z.string().optional()
        .describe("e.g. 'today 12-m', 'now 7-d'."),
      tz: z.string().optional()
        .describe("Timezone offset in minutes."),
      data_type: z.enum(["TIMESERIES", "GEO_MAP", "GEO_MAP_0", "RELATED_QUERIES", "RELATED_TOPICS"]).optional()
        .describe("Dataset to return."),
      cat: z.string().optional()
        .describe("Category id."),
      gprop: z.enum(["images", "news", "youtube", "froogle"]).optional()
        .describe("Property filter."),
      region: z.enum(["COUNTRY", "REGION", "DMA", "CITY"]).optional()
        .describe("GEO_MAP resolution."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/trends", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "google_trending",
    `Google Trending Now searches for a country. 1 credit.`,
    {
      geo: z.string()
        .describe("e.g. 'US'."),
      hl: z.string().optional()
        .describe("Language, e.g. 'en'."),
      hours: z.number().int().optional()
        .describe("Window: 4, 24, 48, or 168."),
      cat: z.number().int().optional()
        .describe("Category, 0-20."),
      sort: z.enum(["relevance", "search_volume", "recency", "title"]).optional()
        .describe("Sort."),
      status: z.enum(["all", "active"]).optional()
        .describe("Trend status filter."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v2/google/trending", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
