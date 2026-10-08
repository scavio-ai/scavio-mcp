/**
 * Per-platform record projections for trimResponse (see trim-response.ts).
 *
 * TikTok and Instagram are the two platforms whose MCP tools pass upstream
 * app-API records through nearly raw: a single TikTok video record has ~155
 * keys (77KB), an Instagram media record ~130 keys (24KB). Generic rules can
 * only shave those, so each recognised record type is projected onto the
 * fields an agent actually uses: ids, text, author, counts, timestamps,
 * canonical URL, one playable/display URL, and every cursor.
 *
 * Projection only ever REMOVES keys from a record. Paths an agent already
 * relies on (data.aweme_list[].statistics.digg_count, video.play_addr.url_list[0],
 * items[].caption.text, ...) keep working unchanged.
 *
 * Records are recognised by signature, not by path, so the same projector
 * covers search, feeds, hashtag lists, detail and comments alike. Projectors
 * are applied only when a tool opts in with `platform`, which is why the
 * profile tools (a single, already-small record whose bio fields matter) do
 * not pass it.
 */
import type { JsonObject, JsonValue } from "./trim-response.js";

export type Platform = "tiktok" | "instagram";

const isObj = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);

function pick(o: JsonObject, keys: readonly string[]): JsonObject {
  const out: JsonObject = {};
  for (const k of keys) if (k in o) out[k] = o[k];
  return out;
}

/** `{uri, url_list:[a,b,c], width, height, url_key, data_size, ...}` -> `{url_list:[a]}`. */
function firstUrl(m: JsonValue | undefined): JsonValue | undefined {
  if (!isObj(m) || !Array.isArray(m.url_list) || m.url_list.length === 0) return undefined;
  return { url_list: [m.url_list[0]] };
}

/** Share URLs carry per-request tracking params; the path is the canonical link. */
function stripQuery(u: JsonValue | undefined): JsonValue | undefined {
  return typeof u === "string" ? u.split("?")[0] : u;
}

// ---------------------------------------------------------------- TikTok

const TT_AWEME_KEEP = [
  "aweme_id", "desc", "create_time", "region", "desc_language", "content_type", "aweme_type",
  "is_top", "is_ads", "share_url", "statistics", "author", "video", "music", "text_extra",
  "cha_list", "image_post_info", "poi_info", "item_title",
] as const;

const TT_USER_KEEP = [
  "uid", "sec_uid", "unique_id", "nickname", "signature", "avatar_thumb", "follower_count",
  "following_count", "total_favorited", "aweme_count", "favoriting_count", "verification_type",
  "custom_verify", "enterprise_verify_reason", "region", "language", "secret", "create_time",
  "ins_id", "twitter_name", "youtube_channel_id", "youtube_channel_title", "bio_url",
] as const;

const TT_COMMENT_KEEP = [
  "cid", "text", "create_time", "digg_count", "reply_comment_total", "user", "aweme_id",
  "reply_id", "reply_to_reply_id", "is_author_digged", "comment_language", "label_text",
  "stick_position", "reply_comment",
] as const;

function tiktokAweme(o: JsonObject): JsonObject {
  const out = pick(o, TT_AWEME_KEEP);
  if ("share_url" in out) out.share_url = stripQuery(out.share_url) ?? null;
  else if (isObj(o.share_info) && typeof o.share_info.share_url === "string") out.share_url = stripQuery(o.share_info.share_url) ?? null;
  if (isObj(o.video)) {
    const v = pick(o.video, ["duration", "width", "height", "ratio"]);
    const cover = firstUrl(o.video.cover);
    const play = firstUrl(o.video.play_addr);
    if (cover) v.cover = cover;
    if (play) v.play_addr = play;
    out.video = v;
  }
  if (isObj(o.music)) {
    const m = pick(o.music, ["id", "id_str", "mid", "title", "author", "owner_handle", "duration", "original", "is_original_sound"]);
    const play = firstUrl(o.music.play_url);
    if (play) m.play_url = play;
    out.music = m;
  }
  if (Array.isArray(o.text_extra)) {
    out.text_extra = o.text_extra.map((t) => (isObj(t) ? pick(t, ["hashtag_name", "hashtag_id", "user_id", "sec_uid", "type"]) : t));
  }
  if (Array.isArray(o.cha_list)) {
    out.cha_list = o.cha_list.map((c) => (isObj(c) ? pick(c, ["cid", "cha_name"]) : c));
  }
  if (isObj(o.image_post_info) && Array.isArray(o.image_post_info.images)) {
    out.image_post_info = {
      images: o.image_post_info.images.map((i) => (isObj(i) ? { display_image: firstUrl(i.display_image) ?? null } : i)),
    };
  }
  if (isObj(o.poi_info)) out.poi_info = pick(o.poi_info, ["poi_id", "poi_name"]);
  return out;
}

function tiktokUser(o: JsonObject): JsonObject {
  const out = pick(o, TT_USER_KEEP);
  if ("avatar_thumb" in out) out.avatar_thumb = firstUrl(out.avatar_thumb) ?? null;
  return out;
}

function projectTiktok(o: JsonObject): JsonObject {
  if ("cid" in o && "text" in o) return pick(o, TT_COMMENT_KEEP);
  if ("aweme_id" in o && ("video" in o || "author" in o || "desc" in o)) return tiktokAweme(o);
  if ("sec_uid" in o && ("unique_id" in o || "nickname" in o)) return tiktokUser(o);
  return o;
}

/** Envelope noise that sits beside the result list on every TikTok page. */
function prepareTiktok(root: JsonValue): JsonValue {
  if (isObj(root) && isObj(root.data)) {
    for (const k of ["extra", "global_doodle_config", "backtrace", "feedback_type", "ad_info"]) delete root.data[k];
  }
  return root;
}

// ---------------------------------------------------------------- Instagram

const IG_MEDIA_KEEP = [
  "id", "pk", "code", "shortcode", "media_type", "product_type", "is_video", "taken_at",
  "taken_at_date", "expiring_at", "caption", "caption_text", "accessibility_caption", "title",
  "like_count", "comment_count", "play_count", "ig_play_count", "view_count", "video_view_count",
  "share_count", "reshare_count", "save_count", "video_duration", "is_paid_partnership", "is_pinned",
  "user", "owner", "coauthor_producers", "usertags", "tagged_users", "sponsor_tags", "location",
  "thumbnail_url", "display_uri", "display_url", "video_url", "image_versions2", "image_versions",
  "video_versions", "carousel_media", "carousel_media_count",
] as const;

const IG_USER_KEEP = ["pk", "id", "username", "full_name", "is_verified", "is_private", "profile_pic_url", "follower_count"] as const;

function instagramMedia(o: JsonObject): JsonObject {
  const out = pick(o, IG_MEDIA_KEEP);
  if (isObj(out.caption)) out.caption = pick(out.caption, ["text", "created_at"]);
  if (isObj(out.location)) out.location = pick(out.location, ["pk", "name", "short_name", "city", "address", "lat", "lng"]);
  // One display image and one video URL is enough. When the flat
  // thumbnail_url / video_url is present the ladders are pure duplicates.
  const hasThumb = typeof out.thumbnail_url === "string" || typeof out.display_uri === "string" || typeof out.display_url === "string";
  if (hasThumb) {
    delete out.image_versions2;
    delete out.image_versions;
  } else {
    if (isObj(out.image_versions2)) out.image_versions2 = pick(out.image_versions2, ["candidates"]);
    if (isObj(out.image_versions)) out.image_versions = pick(out.image_versions, ["items", "candidates"]);
  }
  if (typeof out.video_url === "string") delete out.video_versions;
  else if (Array.isArray(out.video_versions) && out.video_versions.length) {
    const v = out.video_versions[0];
    out.video_versions = [isObj(v) ? pick(v, ["url", "width", "height"]) : v];
  }
  return out;
}

function projectInstagram(o: JsonObject): JsonObject {
  if (("pk" in o || "id" in o) && "media_type" in o && ("code" in o || "taken_at" in o || "shortcode" in o)) return instagramMedia(o);
  if ("username" in o && ("pk" in o || "id" in o) && !("media_type" in o)) return pick(o, IG_USER_KEEP);
  return o;
}

const IG_CURSOR_KEYS = ["page_info", "next_max_id", "more_available", "has_more", "pagination_token", "end_cursor"];

function findKey(node: JsonValue, key: string, depth = 0): JsonValue | undefined {
  if (depth > 6) return undefined;
  if (Array.isArray(node)) return undefined;
  if (!isObj(node)) return undefined;
  if (key in node && node[key] !== null) return node[key];
  for (const v of Object.values(node)) {
    const hit = findKey(v, key, depth + 1);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * Instagram list responses carry the same records two or three times: the
 * normalized `data.items`, the raw `data.edges`, and the raw GraphQL envelope
 * under `data.data` (e.g. data.data.xdt_api__v1__clips__user__connection_v2.edges).
 * Keep `items`, hoist any cursor that only lived in the raw copy, drop the rest.
 */
function prepareInstagram(root: JsonValue): JsonValue {
  if (!isObj(root) || !isObj(root.data)) return root;
  const d = root.data;
  if (!Array.isArray(d.items)) return root;
  if (isObj(d.data)) {
    for (const k of IG_CURSOR_KEYS) {
      if (k === "end_cursor" && isObj(d.page_info)) continue;
      if (d[k] === undefined || d[k] === null) {
        const hit = findKey(d.data, k);
        if (hit !== undefined) d[k] = hit;
      }
    }
    delete d.data;
  }
  if (Array.isArray(d.edges)) delete d.edges;
  return root;
}

// ---------------------------------------------------------------- registry

export const PLATFORM_PROJECTORS: Record<Platform, (o: JsonObject) => JsonObject> = {
  tiktok: projectTiktok,
  instagram: projectInstagram,
};

export const PLATFORM_PREPARE: Record<Platform, (root: JsonValue) => JsonValue> = {
  tiktok: prepareTiktok,
  instagram: prepareInstagram,
};
