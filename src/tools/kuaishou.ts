import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";

// Kuaishou is priced PER ENDPOINT off four upstream price points, so every tool
// carries its own cost line. A single platform-wide "costs N credits" claim is
// wrong by up to 40x, which is why this sentence is appended everywhere rather
// than stated once.
const PRICING = "Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40 credits), never per platform.";

// This is CHINA Kuaishou (kuaishou.com). Our upstream source does not serve
// Kwai international (kwai.com): a real kwai.com id returns an empty envelope and
// still bills, so the distinction goes in the description, not a comment.
const NOT_KWAI = "Kuaishou China (kuaishou.com) only; Kwai international (kwai.com) is not served upstream.";

const CURSOR_DESC =
  "Opaque pagination cursor: the data.pcursor value from the previous response (the field is pcursor, NOT next_cursor). Omit for the first page; a pcursor of 'no_more' means there are no further pages.";

const SEARCH_CURSOR_DESC =
  "Opaque pagination cursor: the data.pcursor value from the previous response (the field is pcursor, NOT next_cursor, and NOT data.recoPcursor, which belongs to a separate recommendation stream and will not page the search). Omit for the first page; 'no_more' means the end.";

const KEYWORD_DESC =
  "Search keyword, 1-200 characters. Kuaishou is a Chinese-language platform: Chinese keywords reach the real catalogue, Latin-script queries return whatever Kuaishou matches, which is usually much thinner.";

export function registerKuaishouTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "get_kuaishou_profile",
    `Get the full profile of a Kuaishou (China) creator by user id as JSON: display name, bio, avatar, gender, IP-location province, and the follower / public-video / lifetime-like counters. Read followers from data.userProfile.ownerCount.fan, public videos from ownerCount.photo, and lifetime likes from ownerCount.total_photo_like - ownerCount.like is a DIFFERENT counter and is not the video like total. Both id forms work here, numeric and alphanumeric. Not paginated. Costs 10 credits, the dearest single-object call on the platform: resolve_kuaishou_user turns a share link into an id for 1 credit, and get_kuaishou_video already carries the author's follower count for 2, so only pay this when you need the profile itself. ${PRICING} ${NOT_KWAI}`,
    {
      user_id: z.string().min(1)
        .describe("Kuaishou user id, non-empty. Both forms work on this endpoint: numeric ('5518803932') and alphanumeric ('3xcuu5habgc8z29'). Get one from resolve_kuaishou_user or search_kuaishou_users and pass it through unchanged."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/profile", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_user_posts",
    `List a Kuaishou (China) creator's top posts as JSON, under data.feeds[]: caption, play / like / comment / share / collect counts, duration in milliseconds, publish timestamp in epoch milliseconds, cover image and video URL. Cursor-paginated. feeds[].photo_id is a JSON number above 2^53 and therefore arrives ROUNDED - take the exact ids from feeds[].share_info ("userId=<eid>&photoId=<eid>"), which is the form get_kuaishou_video accepts. Costs 1 credit per page, so this is the cheap way to pull a creator's catalogue when get_kuaishou_profile costs 10. ${PRICING} ${NOT_KWAI}`,
    {
      user_id: z.string().min(1)
        .describe("Kuaishou user id, non-empty. Get one from resolve_kuaishou_user (alphanumeric form) or search_kuaishou_users (numeric form) and pass it through unchanged rather than converting between forms."),
      cursor: z.string().optional()
        .describe(CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/user/posts", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_user_live",
    `Check whether one Kuaishou (China) creator is broadcasting right now, as JSON. Read data.dynamicIconV2.isLive for the on-air flag and data.dynamicIconV2.liveStream for the stream itself (stream id, title, cover, and the broadcaster's verified details). When the creator is offline the liveStream is simply absent: that is a normal "not broadcasting" answer, not an error, and it still bills. Not paginated - one account, one answer. Costs 1 credit, cheap enough to poll a watchlist; finding live streams by keyword instead is search_kuaishou_live at 10 credits. ${PRICING} ${NOT_KWAI}`,
    {
      user_id: z.string().min(1)
        .describe("Kuaishou user id, non-empty. Get one from resolve_kuaishou_user or search_kuaishou_users and pass it through unchanged."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/user/live", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "resolve_kuaishou_user",
    `Turn a Kuaishou (China) share link into the user id that get_kuaishou_profile, get_kuaishou_user_posts and get_kuaishou_user_live all require. Returns a bare { user_id } in the ALPHANUMERIC form (e.g. "3xcuu5habgc8z29"); this is the only Kuaishou endpoint whose response carries no data.result field. Accepts kuaishou.com and v.kuaishou.com links only - Kwai international (kwai.com) is not served upstream, so kwai.com links do not resolve. Not paginated. Costs 1 credit, a tenth of get_kuaishou_profile, so resolve first rather than guessing ids. ${PRICING}`,
    {
      share_link: z.string().url()
        .describe("A kuaishou.com or v.kuaishou.com link, e.g. 'https://v.kuaishou.com/KcdKDwFp'. Must be a syntactically valid URL. kwai.com links are not supported."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/user/resolve", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_video",
    `Get one Kuaishou (China) video by photo id or URL as JSON: caption, play / like / comment / share counts, duration in milliseconds, source resolution, publish timestamp, cover image and the MP4 URL. data.counts carries the AUTHOR's account totals (fanCount, followCount, collectionCount, photoCount), which saves a 10-credit get_kuaishou_profile call when the follower number is all you need. FIELD NAMES ARE camelCase HERE (photoId, viewCount, likeCount, commentCount, userId) while every feed endpoint on this platform is snake_case, so do not share one parser between them. data.photo.photoId is a STRING and exact, and both author id forms come back (photo.userId numeric, photo.userEid alphanumeric), which makes this the reliable place to get them. coverUrls[] and mainMvUrls[] are CDN mirrors of the same asset, signed and expiring - take the first and fall back to the next. Pass photo_id or url; sending neither is a 400 and is not billed. Not paginated. Costs 2 credits. ${PRICING} ${NOT_KWAI}`,
    {
      photo_id: z.string().min(1).optional()
        .describe("Kuaishou photo (video) id. Both the alphanumeric form ('3xtdqvdnqd3psuc') and the numeric form ('5211790816292981090') work. Either this or url is required. When piping from a feed endpoint, take the id from that feed's share_info rather than its rounded photo_id number."),
      url: z.string().url().optional()
        .describe("A kuaishou.com or v.kuaishou.com video URL, e.g. 'https://v.kuaishou.com/GKTpYm', as an alternative to photo_id. Either this or photo_id is required."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/video", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_video_comments",
    `Get the comment thread under a Kuaishou (China) video as JSON, 30 root comments per page: comment text, author name and id, authorArea (the commenter's IP-location province, the only geography Kuaishou publishes per comment), like count, subCommentCount and timestamp. data.subCommentsMap is a free bonus rather than a duplicate - it is keyed by root comment_id and pre-loads the first replies for the comments Kuaishou considers hot, so read it BEFORE spending a credit on get_kuaishou_comment_replies. data.commentCount is the video's TOTAL including replies and is far larger than the rows you can page through, so never use it as a loop bound; rootComments[].subCommentCount of 0 means there is nothing for get_kuaishou_comment_replies to fetch. Cursor-paginated. Costs 1 credit per page, so a full thread is cheap to mine. ${PRICING} ${NOT_KWAI}`,
    {
      photo_id: z.string().min(1)
        .describe("Kuaishou photo (video) id. Id only - this endpoint has no URL form. Use the exact id from get_kuaishou_video (photo.photoId) or a feed's share_info, not a rounded photo_id number."),
      cursor: z.string().optional()
        .describe(CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/video/comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_comment_replies",
    `Expand one comment thread on a Kuaishou (China) video: every reply under a root comment, as JSON, with reply text, author, authorArea (IP-location province), the user being answered (reply_to plus replyToUserName, so a thread can be rebuilt in order) and like count. THE EMPTY-RESULT TRAP: an unknown, mistyped, or wrong-video root_comment_id is NOT an error - Kuaishou answers HTTP 200 with subComments: [] and pcursor "no_more", and the call is still billed. Take photo_id and root_comment_id from the SAME get_kuaishou_video_comments response and only call this for comments whose subCommentCount is above 0. Check that response's data.subCommentsMap first: for the hottest comments the replies are already in hand for free. Cursor-paginated, and count sizes the page (1-50). Costs 1 credit per page. ${PRICING} ${NOT_KWAI}`,
    {
      photo_id: z.string().min(1)
        .describe("Kuaishou photo (video) id the root comment sits on, non-empty. Use your own exact request value, not the rounded photo_id echoed inside comment objects."),
      root_comment_id: z.string().min(1)
        .describe("Id of the top-level comment whose replies you want: rootComments[].comment_id from get_kuaishou_video_comments, taken from the same response as photo_id. An id belonging to a different video returns an empty page and still bills."),
      cursor: z.string().optional()
        .describe(CURSOR_DESC),
      count: z.number().int().min(1).max(50).optional()
        .describe("Replies per page, 1-50. Omit to use Kuaishou's default. A value outside 1-50 is a 400 and is not billed."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/video/sub-comments", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_videos_batch",
    `Look up as many as 20 Kuaishou (China) videos in ONE request as JSON, under data.photos[]: caption, play / like / comment / share / collect counts, duration, publish time, cover and MP4 URL for each. COSTS 40 CREDITS FLAT, whatever the list length - by far the dearest call on the platform. get_kuaishou_video costs 2, so a batch only pays off from roughly 20 ids down; below that, loop the cheap call. The list is hard-capped at 20 and a longer one is rejected by validation before you are billed. MISSING IDS ARE SILENT: Kuaishou returns only the photos it resolved, so data.photos can be shorter than the ids you sent (deleted, private and region-blocked videos simply do not appear) and the 40 credits are still spent - diff the two lists yourself. Order is not guaranteed to match the request: match on photos[].originalPhotoId, which is a STRING and exact, because photos[].photo_id is a JSON number above 2^53 and arrives rounded. Field names are snake_case here, unlike the camelCase get_kuaishou_video. Not paginated. ${PRICING} Kuaishou China (kuaishou.com) only; a Kwai international (kwai.com) id returns an empty envelope and still costs 40.`,
    {
      photo_ids: z.array(z.string().min(1)).min(1).max(20)
        .describe("1 to 20 non-empty Kuaishou photo (video) ids; use the numeric id form. More than 20 is rejected before billing - chunk longer lists yourself, at 40 credits per chunk."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/videos/batch", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_kuaishou",
    `Run Kuaishou (China)'s own MIXED search for a keyword as JSON: ranked videos with full engagement counts, plus the related-search suggestions the app surfaces alongside them. Rows arrive under data.mixFeeds[] and are HETEROGENEOUS - switch on itemType before reading anything: 5 is a video at item.feed, 9 is related searches at item.relatedSearches[], 4 is a user at item.user, 6 is a live stream at item.live, and 25 is a commerce promo card at item.mixKbox[] which is an ad slot, not an organic result. Never index mixFeeds positionally, and treat an unknown itemType as skippable rather than as an error. THIS IS THE SLOWEST CALL ON THE PLATFORM, roughly 20 seconds against 1.5-3 seconds for the dedicated searches, so set a client timeout above 30 seconds - or prefer search_kuaishou_videos, search_kuaishou_users or search_kuaishou_live, which cost the same 10 credits, answer far faster and come back already filtered. data.isRecommendResult true means Kuaishou filled the page with recommendations rather than keyword matches; do not read those rows as matches. Cursor-paginated. Costs 10 credits PER PAGE - all four search endpoints are the 10, so cap your page count. ${PRICING} ${NOT_KWAI}`,
    {
      keyword: z.string().min(1).max(200)
        .describe(KEYWORD_DESC),
      cursor: z.string().optional()
        .describe(SEARCH_CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/search", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_kuaishou_videos",
    `Search Kuaishou (China) videos by keyword as JSON, 20 ranked results a page: caption, author, play / like / comment / share / collect counts, duration, publish time and cover image, with no user rows mixed in. Rows arrive under data.mixFeeds[] with itemType 5 and the payload at item.feed - Kuaishou can still inject a card row, so skip anything that is not itemType 5 rather than assuming index positions. feed.photo_id is a JSON number above 2^53 and arrives ROUNDED; use feed.share_info ("userId=<eid>&photoId=<eid>") for the exact ids, which is the form get_kuaishou_video accepts. Field names are snake_case here, unlike the camelCase get_kuaishou_video. Prefer this over search_kuaishou when you only want videos: same 10 credits, roughly eight times faster. Cursor-paginated. Costs 10 credits PER PAGE - all four search endpoints are the 10, so cap your page count. ${PRICING} ${NOT_KWAI}`,
    {
      keyword: z.string().min(1).max(200)
        .describe(KEYWORD_DESC),
      cursor: z.string().optional()
        .describe(SEARCH_CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/search/videos", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_kuaishou_users",
    `Find Kuaishou (China) creators by name, handle or topic as JSON, 20 accounts a page: display name, public handle (kwaiId), bio, fansCount, photoCount, verified and isBanned flags, and the numeric user_id. This is the creator-discovery entry point - the ids it returns are what get_kuaishou_profile, get_kuaishou_user_posts and get_kuaishou_user_live all take. Rows arrive under data.mixFeeds[] with itemType 4 and the payload at item.user; skip anything else rather than indexing positionally. user_id arrives as a JSON number, so stringify it and pass it through unchanged, do not reformat it. Field traps: fansCount is an integer but photoCount is a STRING ("20"), photoInfo is a pre-rendered Chinese summary line and not a parseable metric, the row carries NO total like count (that is ownerCount.total_photo_like on get_kuaishou_profile, 10 credits), and isBanned accounts still appear in results. There is NO follower-count or verified filter upstream - filter client-side on fansCount and verified. Cursor-paginated. Costs 10 credits per page; if you already have a share link, resolve_kuaishou_user gets you the id for 1. ${PRICING} ${NOT_KWAI}`,
    {
      keyword: z.string().min(1).max(200)
        .describe(KEYWORD_DESC),
      cursor: z.string().optional()
        .describe(SEARCH_CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/search/users", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "search_kuaishou_live",
    `Search Kuaishou (China) live streams that are ON AIR RIGHT NOW for a keyword, as JSON: stream id, broadcaster, like count, cover, the commerce badge Kuaishou shows on the card, and the FLV playback URLs. This is how to find live-commerce broadcasts while they are still selling. Rows arrive under data.mixFeeds[]: itemType 6 is a stream at item.live, and itemType 25 is a commerce promo card at item.mixKbox[] - an ad slot carrying no stream, which was the FIRST row of the capture - so filter on itemType 6 and never index positionally. LIVE DATA IS A SNAPSHOT: streams end without notice, a liveStreamId is only good while the broadcast lasts, and live.playInfo.playUrls[] are signed FLV pull URLs that expire and stop working the moment the broadcast ends, so re-run the search instead of caching it. live.likeCount and live.audienceCount are ABBREVIATED STRINGS as the app renders them ("629.1k"), not integers - parse them or you will silently compare strings; live.acu is a number. live.simpleLiveCoverReasonTag.text.content is the card badge and carries the sales line on live-commerce streams. live.user is a reduced user object with no counters; call get_kuaishou_profile for those. Cursor-paginated. Costs 10 credits per page; checking ONE known creator is get_kuaishou_user_live at 1 credit. ${PRICING} ${NOT_KWAI}`,
    {
      keyword: z.string().min(1).max(200)
        .describe(KEYWORD_DESC),
      cursor: z.string().optional()
        .describe(SEARCH_CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/search/live", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_tag_feed",
    `Read the feed behind a Kuaishou (China) hashtag as JSON, 20 posts a page: caption, author, play / like / comment / share / collect counts and cover image under data.mixFeeds[] (videos are itemType 5 with the payload at item.feed - skip other card types), plus the tag's own lifetime view total at data.tagInfo.viewCount. Send the tag TEXT without the leading '#'; Kuaishou resolves it to its own tag id and echoes both back as tagInfo.name and tagInfo.tagId, so CHECK tagInfo.name against what you asked for before trusting a run - a near-miss resolves to a different tag rather than erroring. THERE IS NO TAB OR SORT PARAMETER: you always get Kuaishou's default ordering for the tag, so do not read the feed as chronological. feed.photo_id is a JSON number above 2^53 and arrives rounded - use feed.share_info for the exact ids. Cursor-paginated. Costs 1 credit per page, a tenth of what the search endpoints cost, so this is the cheap way to mine a trend or track a campaign tag over time. ${PRICING} ${NOT_KWAI}`,
    {
      tag: z.string().min(1).max(200)
        .describe("Hashtag text, 1-200 characters, WITHOUT the leading # - send '挑战', not '#挑战'. Kuaishou is a Chinese-language platform, so Chinese tags are where the volume is."),
      cursor: z.string().optional()
        .describe(CURSOR_DESC),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/tag/feed", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );

  server.tool(
    "get_kuaishou_trending",
    `Read one Kuaishou (China) leaderboard as JSON - one board per call, and each call bills. board 'hot' (the default when omitted) returns the hot-search keyword list: 50 ranked entries under data.hots already sorted by hotValue descending, plus the pinned data.topHots, each entry carrying id, keyword, hotValue, hotWordType, ksOrderId, pvSoarSignal and viewCount. The live, shopping, brand and music boards are SEPARATE upstream rankings with their OWN response shapes - do not assume they carry hots[]; read the one you need once and map it yourself. Fields that look useful and are not: hotValue is Kuaishou's heat score, not views or searches, and is only comparable within one snapshot of one board; viewCount and pvSoarSignal were 0 on every row of the capture, so treat them as unpopulated rather than as zero traffic; a non-empty ksOrderId marks a promoted slot, so check it before treating an entry as organic. Not paginated, with no limit or region parameter and no historical view - poll on a schedule and store the results if you want a time series. The keywords are the natural input to get_kuaishou_tag_feed (1 credit) or search_kuaishou_videos (10). Costs 1 credit whichever board you ask for, the cheapest trend signal on the platform. ${PRICING} ${NOT_KWAI}`,
    {
      board: z.enum(["hot", "live", "shopping", "brand", "music"]).optional()
        .describe("Which leaderboard to read: 'hot' (used when omitted) is the hot-search keyword list; 'live', 'shopping', 'brand' and 'music' are the live-stream, e-commerce, brand and music rankings. One board per call, and each board is a different upstream ranking with its own response shape."),
    },
    async (params) => {
      try {
        const data = await getClient().post("/api/v1/kuaishou/trending", params);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
