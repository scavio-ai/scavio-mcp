import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

/**
 * Result lists that `count` caps in the MCP output. Upstream treats count as
 * best effort (count=3 returned 12 posts), so it is enforced here. Responses
 * are also deduplicated (items vs raw edges vs the raw GraphQL envelope) and
 * records projected to agent-useful fields, see src/lib/trim-platforms.ts.
 * get_instagram_profile is deliberately left unprojected. The REST API
 * response is unchanged.
 *
 * Credits: the per-tool cost in each description is the usual charge. Any
 * request can cost up to 10 when it needs extra work; credits_used in the
 * response is the exact charge.
 */
const IG_LISTS = ["items", "edges", "users"];

export function registerInstagramTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_instagram_profile",
    `Get an Instagram user's profile: bio, follower/following/post counts, verification and user_id. 1 credit.`,
    {
      username: z.string().optional()
        .describe("Handle without @, e.g. 'instagram'."),
      user_id: z.string().optional()
        .describe("Numeric user ID from a previous request."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/profile", params);
        return trimResponse(data);
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_posts",
    `List an Instagram user's posts, about 12 per page. Pass pagination_token from the previous response as cursor. 2 credits per page.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Max posts returned; upstream may fetch more, extras are trimmed."),
      cursor: z.string().optional()
        .describe("pagination_token from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/posts", params);
        return trimResponse(data, { platform: "instagram", limit: params.count, listKeys: IG_LISTS });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_reels",
    `List an Instagram user's Reels. Paginate with next_max_id. 1 credit (2 the first time a username is looked up).`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Max reels returned."),
      cursor: z.string().optional()
        .describe("next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/reels", params);
        return trimResponse(data, { platform: "instagram", limit: params.count, listKeys: IG_LISTS });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_tagged",
    `List posts an Instagram user is tagged in. Paginate with next_max_id. 1 credit (2 the first time a username is looked up).`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(50).default(12)
        .describe("Max posts returned."),
      cursor: z.string().optional()
        .describe("next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/tagged", params);
        return trimResponse(data, { platform: "instagram", limit: params.count, listKeys: IG_LISTS });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_stories",
    `Get an Instagram user's active stories. Not paginated. 2 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/stories", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_post",
    `Get a single Instagram post/reel. Provide url, media_id, or shortcode. media_type: 1=image, 2=video, 8=carousel. 2 credits.`,
    {
      url: z.string().optional()
        .describe("Post URL."),
      media_id: z.string().optional()
        .describe("Numeric media ID."),
      shortcode: z.string().optional()
        .describe("Post shortcode, e.g. 'DUajw4YkorV'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_post_comments",
    `Get comments on an Instagram post. Provide shortcode or url (not media_id). Paginate with next_min_id. 2 credits per page.`,
    {
      shortcode: z.string().optional()
        .describe("Post shortcode."),
      url: z.string().optional()
        .describe("Post URL."),
      cursor: z.string().optional()
        .describe("next_min_id from previous response."),
      sort_order: z.enum(["popular", "newest"]).default("popular")
        .describe("Sort order (best effort)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post/comments", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_comment_replies",
    `Get replies to an Instagram comment. Requires media_id (from get_instagram_post) and comment_id (pk from get_instagram_post_comments). 2 credits.`,
    {
      media_id: z.string()
        .describe("Post media ID (from get_instagram_post)."),
      comment_id: z.string()
        .describe("Comment pk from get_instagram_post_comments."),
      cursor: z.string().optional()
        .describe("next_min_child_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post/comments/replies", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_users",
    `Search Instagram users by keyword. 2 credits; a request with a cursor (rank_token, next page) costs 8.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().optional()
        .describe("rank_token from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/users", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_hashtags",
    `Search Instagram hashtags by keyword. 2 credits; a request with a cursor (rank_token, next page) costs 8.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query."),
      cursor: z.string().optional()
        .describe("rank_token from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/hashtags", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_followers",
    `Get an Instagram user's followers. Paginate with next_max_id/has_more. 2 credits per page.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(100).default(12)
        .describe("Max users returned."),
      cursor: z.string().optional()
        .describe("next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/followers", params);
        return trimResponse(data, { platform: "instagram", limit: params.count, listKeys: IG_LISTS });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_followings",
    `Get accounts an Instagram user follows. Paginate with next_max_id/has_more. 2 credits per page.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
      count: z.number().int().min(1).max(100).default(12)
        .describe("Max users returned."),
      cursor: z.string().optional()
        .describe("next_max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/followings", params);
        return trimResponse(data, { platform: "instagram", limit: params.count, listKeys: IG_LISTS });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_highlights",
    `List an Instagram user's story highlights: highlight id, title, cover and media_count. Pass an id to get_instagram_highlight_stories. 2 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/highlights", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_highlight_stories",
    `Get every story saved in one Instagram highlight, with image and video URLs and posting time. 2 credits.`,
    {
      highlight_id: z.string().regex(/^(highlight:)?\d{5,25}$/, "highlight_id must be an id from get_instagram_user_highlights")
        .describe("Highlight id from get_instagram_user_highlights, e.g. 'highlight:18149897764550869' (prefix optional)."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/highlight/stories", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_reels",
    `Search Instagram Reels by keyword: caption, author, play/like/comment counts and video URL. Paginate with pagination_token. 2 credits per page.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Search query, e.g. 'latte art'."),
      cursor: z.string().optional()
        .describe("pagination_token from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/reels", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_music",
    `Search Instagram audio tracks by song or artist: title, artist, duration and the id get_instagram_music_posts takes. 2 credits.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Song or artist, e.g. 'espresso'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/music", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_music_posts",
    `List the Reels that use an Instagram audio track, plus the track's total reel count. Paginate with paging_info.max_id. 1 credit per page.`,
    {
      music_id: z.string().regex(/^\d{5,25}$/, "music_id must be numeric")
        .describe("Audio id (the id field from search_instagram_music), e.g. '1747512212697470'."),
      cursor: z.string().optional()
        .describe("paging_info.max_id from previous response."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/music/posts", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_instagram_locations",
    `Search Instagram places by name: location id, name, address, city and coordinates. 2 credits.`,
    {
      keyword: z.string().min(1).max(500)
        .describe("Place name, e.g. 'eiffel tower'."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/search/locations", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_user_similar",
    `Get accounts similar to an Instagram user. Available for most creator accounts; some brand accounts return none. 2 credits.`,
    {
      username: z.string().optional()
        .describe("Handle without @."),
      user_id: z.string().optional()
        .describe("Numeric user ID."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/instagram/user/similar", params);
        return trimResponse(data, { platform: "instagram" });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_instagram_post_likers",
    `Get accounts that liked an Instagram post (up to about 1,000 per post) and the post's total like count. Provide shortcode or url. 2 credits.`,
    {
      shortcode: z.string().optional()
        .describe("Post shortcode, e.g. 'DeJ28eTxo4s'."),
      url: z.string().optional()
        .describe("Post URL."),
      count: z.number().int().min(1).max(1000).default(100)
        .describe("Max likers returned to you; the call fetches the full list either way, extras are trimmed."),
    },
    async ({ count, ...params }) => {
      try {
        const data = await getClient().post("/api/v1/instagram/post/likers", params);
        return trimResponse(data, { platform: "instagram", limit: count, listKeys: IG_LISTS });
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
