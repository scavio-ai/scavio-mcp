import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

export function registerYoutubeTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "search_youtube",
    `Search YouTube videos. Paginate with next_cursor/has_more. 2 credits.`,
    {
      search: z.string().min(1).max(500)
        .describe("YouTube search query."),
      sort_by: z.enum(["relevance", "date", "view_count", "rating"]).default("relevance")
        .describe("Sort order."),
      type: z.enum(["video", "channel", "playlist", "movie"]).optional()
        .describe("Restrict to one type."),
      upload_date: z.enum(["last_hour", "today", "this_week", "this_month", "this_year"]).optional()
        .describe("Upload date filter."),
      duration: z.enum(["short", "medium", "long"]).optional()
        .describe("short <4min, medium 4-20min, long >20min."),
      features: z.array(z.enum(["hd", "4k", "subtitles", "creative_commons", "live", "360", "3d", "hdr", "vr180"])).optional()
        .describe("Feature filters, e.g. ['hd','subtitles']."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
      hd: z.boolean().optional()
        .describe("Deprecated, use features."),
      "4k": z.boolean().optional()
        .describe("Deprecated, use features."),
      subtitles: z.boolean().optional()
        .describe("Deprecated, use features."),
      creative_commons: z.boolean().optional()
        .describe("Deprecated, use features."),
      live: z.boolean().optional()
        .describe("Deprecated, use features."),
      "360": z.boolean().optional()
        .describe("Deprecated, use features."),
      "3d": z.boolean().optional()
        .describe("Deprecated, use features."),
      hdr: z.boolean().optional()
        .describe("Deprecated, use features."),
      vr180: z.boolean().optional()
        .describe("Deprecated, use features."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_youtube_shorts",
    `Search YouTube Shorts. Paginate with next_cursor/has_more. 2 credits.`,
    {
      search: z.string().min(1).max(500)
        .describe("Search query."),
      sort_by: z.enum(["relevance", "date", "view_count", "rating"]).default("relevance")
        .describe("Sort order."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/shorts", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "youtube_search_suggestions",
    `YouTube search autocomplete suggestions for a query. 1 credit.`,
    {
      search: z.string().min(1).max(500)
        .describe("Partial search query."),
      language: z.string().default("en")
        .describe("Language, e.g. 'en'."),
      region: z.string().default("US")
        .describe("Region, e.g. 'US'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/suggestions", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_video",
    `Get YouTube video details: title, channel, stats, description, chapters, captions. 1 credit.`,
    {
      video_id: z.string()
        .describe("Video ID or watch URL, e.g. 'dQw4w9WgXcQ'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/video", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_metadata",
    `Deprecated alias of get_youtube_video. 1 credit.`,
    {
      video_id: z.string()
        .describe("Video ID or watch URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/video", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_comments",
    `Get comments on a YouTube video. Each has a reply_cursor for get_youtube_comment_replies. Paginate with next_cursor/has_more. 1 credit.`,
    {
      video_id: z.string()
        .describe("Video ID, e.g. 'dQw4w9WgXcQ'."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/comments", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_comment_replies",
    `Get replies to a YouTube comment. Requires reply_cursor from get_youtube_comments. 1 credit.`,
    {
      video_id: z.string()
        .describe("Video ID."),
      reply_cursor: z.string()
        .describe("reply_cursor from get_youtube_comments."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/comments/replies", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_transcript",
    `Get a YouTube video's transcript/captions. 8 credits.`,
    {
      video_id: z.string()
        .describe("Video ID or watch URL."),
      language: z.string().default("en")
        .describe("Language, e.g. 'en'."),
      format: z.enum(["text", "srt"]).default("text")
        .describe("'text' = plain, 'srt' = timed subtitles."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/transcript", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_related",
    `Get related/recommended videos for a YouTube video. Single page, no pagination. 1 credit.`,
    {
      video_id: z.string()
        .describe("Video ID."),
      cursor: z.string().optional()
        .describe("Pagination cursor (endpoint accepts but never returns one)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/related", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_youtube_channels",
    `Search YouTube channels by keyword. Paginate with next_cursor/has_more. 1 credit.`,
    {
      search: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/search", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_channel",
    `Get a YouTube channel's profile. 1 credit.`,
    {
      channel_id: z.string()
        .describe("Channel ID, @handle, or channel URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_channel_videos",
    `List a YouTube channel's videos. Paginate with next_cursor/has_more. 1 credit.`,
    {
      channel_id: z.string()
        .describe("Channel ID, @handle, or channel URL."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/videos", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_channel_shorts",
    `List a YouTube channel's Shorts. No view count available. Paginate with next_cursor/has_more. 1 credit.`,
    {
      channel_id: z.string()
        .describe("Channel ID, @handle, or channel URL."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/shorts", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_channel_community",
    `List a YouTube channel's community posts (data.posts). Paginate with next_cursor/has_more. 1 credit.`,
    {
      channel_id: z.string()
        .describe("Channel ID, @handle, or channel URL."),
      cursor: z.string().optional()
        .describe("Pagination cursor from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/community", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "resolve_youtube_channel",
    `Resolve a YouTube @handle or URL to its canonical channel ID. Other channel tools accept handles directly. 1 credit.`,
    {
      channel: z.string()
        .describe("@handle or channel URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/resolve", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_streams",
    `Get direct media stream URLs for a YouTube video. 3 credits.`,
    {
      video_id: z.string()
        .describe("Video ID or watch URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/streams", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
