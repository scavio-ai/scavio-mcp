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

export function registerYoutubeTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_youtube",
    `Search YouTube and return video results as JSON. Each result includes video ID, title, channel, duration, view count, and upload date. Use when the user asks to find YouTube videos on a topic.`,
    {
      search: z.string().min(1).max(500)
        .describe("YouTube search query."),
      sort_by: z.enum(["relevance", "date", "view_count", "rating"]).default("relevance")
        .describe("Sort order. Use 'date' for most recent, 'view_count' for most watched."),
      type: z.enum(["video", "channel", "playlist"]).default("video")
        .describe("Result type filter."),
      upload_date: z.enum(["last_hour", "today", "this_week", "this_month", "this_year"]).optional()
        .describe("Filter by upload date. Omit for all time."),
      duration: z.enum(["short", "medium", "long"]).optional()
        .describe("Filter by duration. short=<4min, medium=4-20min, long=>20min."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_metadata",
    `Get metadata for a YouTube video by its video ID. Returns title, description, channel, duration, view count, like count, publish date, and thumbnail URLs. Use when the user has a specific video ID or URL and wants details about that video.`,
    {
      video_id: z.string()
        .describe("YouTube video ID, e.g. 'dQw4w9WgXcQ'. Extract from URL if the user provides a youtube.com link."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/metadata", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

}
