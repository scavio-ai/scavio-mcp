#!/usr/bin/env node
/**
 * Assert what trimResponse keeps and drops, against small synthetic records
 * shaped like the real upstream payloads. Run after any change to
 * src/lib/trim-response.ts or src/lib/trim-platforms.ts.
 *
 *   npm run build
 *   node scripts/trim-check.mjs
 *
 * The rule under test: tool output shrinks, but ids, cursors, has_more flags,
 * text, counts and one usable URL per asset always survive.
 */
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { shapeResponse, trimResponse } = await import(pathToFileURL(join(root, "dist", "lib", "trim-response.js")).href);

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok    ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n${err.message}`);
    process.exitCode = 1;
  }
}

const media = (id) => ({ uri: id, url_list: [`https://a/${id}`, `https://b/${id}`, `https://c/${id}`], width: 720, height: 1280, url_key: "k", data_size: 1, file_hash: "h" });
const ttUser = (n) => ({
  uid: `u${n}`, sec_uid: `MS4w${n}`, unique_id: `handle${n}`, nickname: `Name ${n}`, follower_count: 10,
  avatar_thumb: media(`av${n}`), avatar_larger: media(`avl${n}`), avatar_300x300: media(`av3${n}`),
  commerce_user_info: { a: 1 }, cover_url: [media("c1"), media("c2")],
});
const aweme = (n) => ({
  aweme_id: `7${n}`, desc: `video ${n} #coffee`, create_time: 1789473794, region: "US",
  share_url: `https://www.tiktok.com/@h/video/7${n}?_r=1&u_code=abc`,
  statistics: { aweme_id: `7${n}`, digg_count: 5, play_count: 100, comment_count: 2, share_count: 1 },
  author: ttUser(n),
  video: {
    duration: 33434, width: 720, height: 1280, cover: media("cover"), play_addr: media("play"),
    play_addr_h264: media("h264"), bit_rate: [{ play_addr: media("br1") }, { play_addr: media("br2") }],
    animated_cover: media("anim"), misc_download_addrs: "{...}", meta: "x".repeat(1500),
  },
  music: { id_str: "6705", title: "Song", author: "Artist", play_url: media("mus"), avatar_thumb: media("ma"), extra: "x".repeat(900) },
  added_sound_music_info: { id_str: "6705", title: "Song" },
  text_extra: [{ hashtag_name: "coffee", hashtag_id: "14104", start: 1, end: 7, is_commerce: false }],
  cha_list: [{ cid: "14104", cha_name: "coffee", author: ttUser(9), share_info: { a: 1 } }],
  comment_config: { emoji_recommend_list: [1, 2, 3] }, suggest_words: { suggest_words: [] }, risk_infos: { x: 1 },
});

// ---------------------------------------------------------------- TikTok

check("tiktok search: count enforced, cursor + has_more kept, envelope noise dropped", () => {
  const raw = {
    data: {
      cursor: 20, has_more: 1, search_item_list: [1, 2, 3, 4, 5].map((n) => ({ aweme_info: aweme(n) })),
      extra: { logid: "x", now: 1 }, log_pb: { impr_id: "x" }, global_doodle_config: { a: 1 }, backtrace: "bt",
    },
    tt_chain_token: "secret", cookie: "sessionid=1",
    credits_used: 1,
  };
  const out = shapeResponse(raw, { platform: "tiktok", limit: 3, listKeys: ["search_item_list"] });
  assert.equal(out.data.search_item_list.length, 3);
  assert.equal(out.data.cursor, 20);
  assert.equal(out.data.has_more, 1);
  assert.equal(out.credits_used, 1);
  for (const k of ["extra", "log_pb", "global_doodle_config", "backtrace"]) assert.equal(k in out.data, false, k);
  for (const k of ["tt_chain_token", "cookie"]) assert.equal(k in out, false, k);
  assert.match(out._truncated["data.search_item_list"], /^3 of 5 returned/);
});

check("tiktok aweme: ids, text, stats, author handle, one play/cover URL kept; ladders dropped", () => {
  const a = shapeResponse({ data: { aweme_detail: aweme(1) } }, { platform: "tiktok" }).data.aweme_detail;
  assert.equal(a.aweme_id, "71");
  assert.equal(a.desc, "video 1 #coffee");
  assert.equal(a.statistics.play_count, 100);
  assert.equal(a.share_url, "https://www.tiktok.com/@h/video/71");
  assert.equal(a.author.sec_uid, "MS4w1");
  assert.equal(a.author.unique_id, "handle1");
  assert.deepEqual(a.author.avatar_thumb, { url_list: ["https://a/av1"] });
  assert.equal("avatar_larger" in a.author, false);
  assert.deepEqual(a.video.play_addr, { url_list: ["https://a/play"] });
  assert.deepEqual(a.video.cover, { url_list: ["https://a/cover"] });
  for (const k of ["bit_rate", "play_addr_h264", "animated_cover", "misc_download_addrs", "meta"]) assert.equal(k in a.video, false, k);
  assert.equal(a.music.id_str, "6705");
  assert.deepEqual(a.music.play_url, { url_list: ["https://a/mus"] });
  assert.deepEqual(a.text_extra, [{ hashtag_name: "coffee", hashtag_id: "14104" }]);
  assert.deepEqual(a.cha_list, [{ cid: "14104", cha_name: "coffee" }]);
  for (const k of ["added_sound_music_info", "comment_config", "suggest_words", "risk_infos"]) assert.equal(k in a, false, k);
});

check("tiktok comments: cid, text, counts and commenter ids kept", () => {
  const raw = { data: { cursor: 20, has_more: 1, total: 180, comments: [{ cid: "c1", text: "hi", digg_count: 3, reply_comment_total: 2, aweme_id: "71", user: ttUser(2), share_info: { a: 1 }, image_list: [1] }] } };
  const c = shapeResponse(raw, { platform: "tiktok" }).data.comments[0];
  assert.deepEqual(Object.keys(c).sort(), ["aweme_id", "cid", "digg_count", "reply_comment_total", "text", "user"]);
  assert.equal(c.user.sec_uid, "MS4w2");
});

check("no platform: records are not projected, only generic rules apply", () => {
  const out = shapeResponse({ data: { user: { ...ttUser(1), bio_extra: "kept" } } });
  assert.equal(out.data.user.bio_extra, "kept");
  assert.deepEqual(out.data.user.avatar_larger, { uri: "avl1", url_list: ["https://a/avl1"], width: 720, height: 1280, url_key: "k", data_size: 1, file_hash: "h" });
});

// ---------------------------------------------------------------- Instagram

const igRaw = (n) => ({
  id: `${n}_787`, pk: `${n}`, code: `C${n}`, media_type: 2, taken_at: 1789045214,
  caption: { text: `caption ${n}`, created_at: 1, did_report_as_spam: false, hashtags: ["#a"] },
  like_count: 10, comment_count: 2, play_count: 300,
  user: { pk: "787", id: "787", username: "natgeo", full_name: "NatGeo", is_verified: true, fan_club_info: { a: null }, account_badges: [] },
  thumbnail_url: `https://t/${n}`, video_url: `https://v/${n}`,
  video_versions: [{ url: "v1", width: 1 }, { url: "v2" }],
  image_versions: { items: [{ url: "i1" }, { url: "i2" }], additional_items: { first_frame: { url: "f" } } },
  clips_metadata: { big: "x".repeat(2000) }, xray_visual_2025_100d_embed: [0.1, 0.2], sharing_friction_info: { a: true },
});

check("instagram: count enforced on raw items, records projected, pagination token kept", () => {
  const raw = { data: { data: { count: 12, items: [1, 2, 3, 4, 5].map(igRaw), user: { username: "natgeo", id: "787" } }, pagination_token: "PT" } };
  const out = shapeResponse(raw, { platform: "instagram", limit: 3, listKeys: ["items", "edges", "users"] });
  const items = out.data.data.items;
  assert.equal(items.length, 3);
  assert.equal(out.data.pagination_token, "PT");
  assert.equal(items[0].pk, "1");
  assert.equal(items[0].code, "C1");
  assert.deepEqual(items[0].caption, { text: "caption 1", created_at: 1 });
  assert.equal(items[0].user.username, "natgeo");
  assert.equal("fan_club_info" in items[0].user, false);
  assert.equal(items[0].video_url, "https://v/1");
  for (const k of ["video_versions", "image_versions", "clips_metadata", "xray_visual_2025_100d_embed", "sharing_friction_info"]) {
    assert.equal(k in items[0], false, k);
  }
});

check("instagram: items/edges/raw-envelope triplicate collapses to items; cursor hoisted", () => {
  const norm = (n) => ({ id: `${n}_1`, pk: `${n}`, shortcode: `S${n}`, media_type: 1, like_count: 1, caption_text: "c", owner: { id: "1", username: "u" } });
  const raw = {
    data: {
      items: [norm(1), norm(2)], count: 2, next_max_id: null,
      edges: [{ node: norm(1) }, { node: norm(2) }],
      data: { user: { edge_user_to_photos_of_you: { count: 2, page_info: { has_next_page: true, end_cursor: "EC" }, edges: [{ node: norm(1) }] } } },
    },
  };
  const out = shapeResponse(raw, { platform: "instagram" });
  assert.deepEqual(Object.keys(out.data).sort(), ["count", "items", "page_info"]);
  assert.deepEqual(out.data.page_info, { has_next_page: true, end_cursor: "EC" });
  assert.equal(out.data.items[1].shortcode, "S2");
});

check("instagram: carousel child without flat URLs keeps one image candidate and one video", () => {
  const child = { id: "9", pk: "9", media_type: 8, taken_at: 1, image_versions2: { candidates: [{ url: "big", width: 1080 }, { url: "small", width: 150 }] }, video_versions: [{ url: "v1", width: 720, bandwidth: 9, id: "x" }, { url: "v2" }] };
  const out = shapeResponse({ data: child }, { platform: "instagram" }).data;
  assert.deepEqual(out.image_versions2, { candidates: [{ url: "big", width: 1080 }] });
  assert.deepEqual(out.video_versions, [{ url: "v1", width: 720 }]);
});

// ---------------------------------------------------------------- generic

check("generic: data: URI thumbnails dropped, remote URLs kept", () => {
  const out = shapeResponse({ shopping_results: [{ title: "Shoe", thumbnail: "data:image/webp;base64," + "A".repeat(4000), link: "https://x" }] });
  assert.deepEqual(out.shopping_results[0], { title: "Shoe", link: "https://x" });
});

check("generic: an XML document payload is kept (extract/SEC), a DASH manifest is not", () => {
  const xml = '<?xml version="1.0"?><rss>' + "x".repeat(2000) + "</rss>";
  const mpd = '<?xml version="1.0"?><MPD xmlns="urn:mpeg:dash">' + "x".repeat(2000) + "</MPD>";
  const out = shapeResponse({ content: xml, manifest_blob: mpd });
  assert.equal(out.content, xml);
  assert.equal("manifest_blob" in out, false);
});

check("generic: one image at many sizes collapses to one URL per image", () => {
  const sizes = [288, 400, 640, 1024, 1600, 5464];
  const img = (id) => sizes.map((s) => `https://yt3.ggpht.com/${id}=s${s}-c-fcrop64=1,0-rw-nd-v1`);
  const out = shapeResponse({ posts: [{ images: [...img("A"), ...img("B")] }] });
  assert.deepEqual(out.posts[0].images, ["https://yt3.ggpht.com/A=s1024-c-fcrop64=1,0-rw-nd-v1", "https://yt3.ggpht.com/B=s1024-c-fcrop64=1,0-rw-nd-v1"]);
});

check("generic: distinct images are never collapsed", () => {
  const urls = ["https://p/one=s64", "https://p/two=s64", "https://p/three=s64"];
  assert.deepEqual(shapeResponse({ screenshots: urls }).screenshots, urls);
});

check("generic: empty values stripped, zero/false kept (original behaviour)", () => {
  assert.deepEqual(shapeResponse({ a: null, b: "", c: [], d: {}, e: 0, f: false, g: [null, ""] }), { e: 0, f: false });
});

check("limit: list shorter than limit is untouched and adds no note", () => {
  const out = shapeResponse({ trends: [{ t: 1 }, { t: 2 }] }, { limit: 50, listKeys: ["trends"] });
  assert.equal(out.trends.length, 2);
  assert.equal("_truncated" in out, false);
});

check("limit: only top three object levels are searched, nested record lists are left alone", () => {
  const out = shapeResponse({ a: { b: { c: { trends: [1, 2, 3] } } }, trends: [1, 2, 3] }, { limit: 1, listKeys: ["trends"] });
  assert.equal(out.trends.length, 1);
  assert.equal(out.a.b.c.trends.length, 3);
});

check("trimResponse: input object is not mutated", () => {
  const raw = { data: { items: [1, 2, 3], edges: [1], data: { x: 1 } } };
  const before = JSON.stringify(raw);
  trimResponse(raw, { platform: "instagram", limit: 1, listKeys: ["items"] });
  assert.equal(JSON.stringify(raw), before);
});

console.log(`\n${passed} passed${process.exitCode ? ", FAILURES above" : ""}`);
