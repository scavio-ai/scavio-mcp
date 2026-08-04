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
    `Search YouTube and return video results as JSON. Each result includes video ID, title, channel, duration, view count, and upload date; the response also groups shorts, channels, and playlists. Use data.next_cursor as the next cursor while has_more is true. Costs 2 credits. Use when the user asks to find YouTube videos on a topic.`,
    {
      search: z.string().min(1).max(500)
        .describe("YouTube search query."),
      sort_by: z.enum(["relevance", "date", "view_count", "rating"]).default("relevance")
        .describe("Sort order. Use 'date' for most recent, 'view_count' for most watched."),
      type: z.enum(["video", "channel", "playlist", "movie"]).optional()
        .describe("Restrict results to one type. Omit for the mixed response (videos plus the shorts, channels and playlists groups); setting it to 'video' suppresses those groups."),
      upload_date: z.enum(["last_hour", "today", "this_week", "this_month", "this_year"]).optional()
        .describe("Filter by upload date. Omit for all time."),
      duration: z.enum(["short", "medium", "long"]).optional()
        .describe("Filter by duration. short=<4min, medium=4-20min, long=>20min."),
      features: z.array(z.enum(["hd", "4k", "subtitles", "creative_commons", "live", "360", "3d", "hdr", "vr180"])).optional()
        .describe("Feature filters to require, e.g. ['hd','subtitles']."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
      hd: z.boolean().optional()
        .describe("Deprecated: use features ['hd']. HD videos only."),
      "4k": z.boolean().optional()
        .describe("Deprecated: use features ['4k']. 4K videos only."),
      subtitles: z.boolean().optional()
        .describe("Deprecated: use features ['subtitles']. Videos with subtitles/CC only."),
      creative_commons: z.boolean().optional()
        .describe("Deprecated: use features ['creative_commons']. Creative Commons licensed videos only."),
      live: z.boolean().optional()
        .describe("Deprecated: use features ['live']. Live videos only."),
      "360": z.boolean().optional()
        .describe("Deprecated: use features ['360']. 360-degree videos only."),
      "3d": z.boolean().optional()
        .describe("Deprecated: use features ['3d']. 3D videos only."),
      hdr: z.boolean().optional()
        .describe("Deprecated: use features ['hdr']. HDR videos only."),
      vr180: z.boolean().optional()
        .describe("Deprecated: use features ['vr180']. VR180 videos only."),
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
    "search_youtube_shorts",
    `Search YouTube Shorts and return short-form video results as JSON. Each result includes video ID, title, URL, thumbnail, view count, and upload time. Use data.next_cursor as the next cursor while has_more is true. Costs 2 credits.`,
    {
      search: z.string().min(1).max(500)
        .describe("YouTube Shorts search query."),
      sort_by: z.enum(["relevance", "date", "view_count", "rating"]).default("relevance")
        .describe("Sort order. Use 'date' for most recent, 'view_count' for most watched."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/shorts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "youtube_search_suggestions",
    `Get YouTube search autocomplete suggestions for a partial query as JSON. Returns a list of suggested search strings in data.suggestions. Use to expand a seed keyword or surface what people search for. Costs 1 credit.`,
    {
      search: z.string().min(1).max(500)
        .describe("Partial or seed search query to autocomplete."),
      language: z.string().default("en")
        .describe("Suggestion language code, e.g. 'en', 'es', 'fr'."),
      region: z.string().default("US")
        .describe("Two-letter region code, e.g. 'US', 'GB', 'IN'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/suggestions", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_video",
    `Get full details for a YouTube video as JSON. Returns title, author, channel, publish date, description, length in seconds, view count, keywords, thumbnail, playability status, chapters, and available captions. Accepts a video ID or a watch URL. Use when the user has a specific video and wants details about it. Costs 1 credit.`,
    {
      video_id: z.string()
        .describe("YouTube video ID, e.g. 'dQw4w9WgXcQ', or a full watch URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/video", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_metadata",
    `Deprecated alias of get_youtube_video, kept for backward compatibility. Get details for a YouTube video by its video ID or watch URL. Prefer get_youtube_video for new integrations. Costs 1 credit.`,
    {
      video_id: z.string()
        .describe("YouTube video ID, e.g. 'dQw4w9WgXcQ', or a full watch URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/video", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_comments",
    `Get comments on a YouTube video as JSON. Each comment includes its ID, text, like count, reply count, publish time, a reply_cursor for fetching its replies, and author details. Accepts a video ID. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      video_id: z.string()
        .describe("YouTube video ID, e.g. 'dQw4w9WgXcQ'."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_comment_replies",
    `Get replies to a specific YouTube comment as JSON. Requires the video ID and the reply_cursor from a comment in the get_youtube_comments response. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      video_id: z.string()
        .describe("YouTube video ID, e.g. 'dQw4w9WgXcQ'."),
      reply_cursor: z.string()
        .describe("The reply_cursor from a comment in the get_youtube_comments response."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous replies response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/comments/replies", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_transcript",
    `Get the transcript of a YouTube video as JSON. Returns the caption text for the requested language. Use format 'text' for a plain transcript or 'srt' for timed subtitles. Accepts a video ID. Costs 8 credits. Use when the user wants to read, summarize, or analyze a video's content.`,
    {
      video_id: z.string()
        .describe("YouTube video ID, e.g. 'dQw4w9WgXcQ', or a full watch URL."),
      language: z.string().default("en")
        .describe("Transcript language code, e.g. 'en', 'es', 'fr'."),
      format: z.enum(["text", "srt"]).default("text")
        .describe("'text' for a plain transcript, 'srt' for timed subtitles."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/transcript", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_related",
    `Get videos related to a YouTube video as JSON. Each result includes video ID, title, URL, channel, thumbnail, view count, publish time, and length, under data.results with data.total_count. Accepts a video ID. Use to discover similar or recommended videos. This endpoint returns no next_cursor and no has_more, so treat the response as a single page. Costs 1 credit.`,
    {
      video_id: z.string()
        .describe("YouTube video ID, e.g. 'dQw4w9WgXcQ'."),
      cursor: z.string().optional()
        .describe("Opaque pagination cursor. Accepted by the endpoint, but the response never returns one, so there is normally nothing to pass here."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/related", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_youtube_channels",
    `Search YouTube channels by keyword as JSON. Each result includes channel ID, name, handle, URL, thumbnail, subscriber count, and description. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      search: z.string().min(1).max(500)
        .describe("Channel search query."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_channel",
    `Get a YouTube channel's profile as JSON. Returns channel ID, title, description, handle, URL, subscriber/video/view counts, country, creation date, verified flag, avatar, banner, and external links. Accepts a channel ID, an @handle, or a channel URL. Costs 1 credit.`,
    {
      channel_id: z.string()
        .describe("YouTube channel ID (e.g. 'UC...'), an @handle, or a channel URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_channel_videos",
    `List a YouTube channel's videos as JSON. Each result includes video ID, title, URL, thumbnail, duration, view count, publish time, and live flag. Accepts a channel ID, an @handle, or a channel URL. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      channel_id: z.string()
        .describe("YouTube channel ID (e.g. 'UC...'), an @handle, or a channel URL."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/videos", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_channel_shorts",
    `List a YouTube channel's Shorts as JSON. Each result includes video ID, title, URL and thumbnail only - there is no view count, because the upstream field for Shorts carries promo text rather than a count. Accepts a channel ID, an @handle, or a channel URL. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      channel_id: z.string()
        .describe("YouTube channel ID (e.g. 'UC...'), an @handle, or a channel URL."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/shorts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_channel_community",
    `List a YouTube channel's community posts as JSON, under data.posts (the only YouTube endpoint whose list key is not results). Each post includes its ID, URL, text, author, publish time, vote count, comment count, attached images, and attachment type. Accepts a channel ID, an @handle, or a channel URL. Use data.next_cursor as the next cursor while has_more is true. Costs 1 credit.`,
    {
      channel_id: z.string()
        .describe("YouTube channel ID (e.g. 'UC...'), an @handle, or a channel URL."),
      cursor: z.string().optional()
        .describe("Pagination cursor (next_cursor) from a previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/community", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "resolve_youtube_channel",
    `Resolve a YouTube @handle or channel URL to its canonical channel ID and URL, returned as JSON. The other channel tools accept a handle or URL directly, so this is only needed when you want the id itself. Costs 1 credit.`,
    {
      channel: z.string()
        .describe("A YouTube @handle (e.g. '@MrBeast') or a channel URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/channel/resolve", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_youtube_streams",
    `Get direct media stream URLs for a YouTube video as JSON. Returns progressive and adaptive formats with itag, URL, mime type, bitrate, resolution, quality label, fps, and audio details, plus available qualities and URL expiry. Accepts a video ID. Costs 3 credits.`,
    {
      video_id: z.string()
        .describe("YouTube video ID, e.g. 'dQw4w9WgXcQ', or a full watch URL."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/youtube/streams", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
