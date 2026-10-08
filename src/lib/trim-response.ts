/**
 * Shapes an API response for a model's context window.
 *
 * The REST API returns upstream JSON close to raw, which is right for code and
 * wrong for an agent: a 3-video TikTok search was 225KB, a 3-post Instagram
 * page 291KB, a Google Shopping page 294KB. Almost all of it is media ladders
 * (the same video at five bitrates, the same avatar at five sizes, three CDN
 * mirrors of each URL), inline base64 thumbnails, DASH XML, tracking blobs and
 * session cookies. None of it helps an agent answer a question, and every byte
 * is paid for in context.
 *
 * Everything here is MCP-only. The REST API response is untouched.
 *
 * Rules, in the order they run:
 *  1. limit       - result lists named in `listKeys` are sliced to `limit`,
 *                   and the cut is reported in a top-level `_truncated` note
 *                   so the model knows there was more.
 *  2. platform    - a platform's record projector (src/lib/trim-platforms.ts)
 *                   keeps the agent-useful fields of each recognised record.
 *                   Ids, cursors and has_more flags are never dropped.
 *  3. generic     - anywhere in the tree: known-noise keys are dropped, CDN
 *                   mirror lists keep one URL, media-variant ladders keep one
 *                   variant, inline data: URIs and XML manifests are dropped.
 *  4. stripEmpty  - null, "", [] and {} are removed (the original behaviour).
 *
 * Deterministic and offline: no network, no randomness, no clock.
 */
import { PLATFORM_PREPARE, PLATFORM_PROJECTORS, type Platform } from "./trim-platforms.js";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type { Platform };

export interface TrimOptions {
  /** Max items kept in each result list named by `listKeys`. */
  limit?: number;
  /**
   * Keys of the result lists `limit` applies to. Looked up in the top three
   * object levels only (root, root.data, root.data.data), never deep, so a
   * nested `comments` inside a record is not mistaken for the page's list.
   */
  listKeys?: string[];
  /** Apply that platform's record projections. */
  platform?: Platform;
  /** Extra keys dropped wherever they appear, for one tool's known noise. */
  dropKeys?: string[];
}

/**
 * Keys that never carry agent-useful data on any platform we serve. Dropped
 * at any depth. Kept deliberately short: a key belongs here only if it is
 * noise everywhere it can appear, otherwise it goes in a platform projector
 * or a tool's `dropKeys`.
 */
const GLOBAL_DROP_KEYS = new Set<string>([
  // Session / tracking echoed back from the upstream request.
  "cookie",
  "tt_chain_token",
  "log_pb",
  // Streaming manifests and bitrate ladders: XML or many-URL blobs that only
  // a video player can use. One playable URL survives elsewhere in the record.
  "video_dash_manifest",
  "dash_manifest",
  "bit_rate",
  "bit_rate_audio",
  "misc_download_addrs",
  // Instagram ML embedding vector and video scrubber sprite sheets.
  "xray_visual_2025_100d_embed",
  "scrubber_spritesheet_info_candidates",
]);

/** Lists of variants of one asset: keep the first (the largest / default). */
const FIRST_ONLY_KEYS = new Set<string>(["url_list", "candidates", "video_versions"]);

const DATA_URI_MIN = 200;

function isPlainObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Inline base64 images (Google Shopping thumbnails are 4-5KB each) and inline
 * DASH manifests. Generic XML is deliberately NOT matched: extract and SEC
 * can legitimately return an XML document as their payload.
 */
function isDroppableString(s: string): boolean {
  if (s.length >= DATA_URI_MIN && s.startsWith("data:")) return true;
  return s.length > 1000 && s.slice(0, 200).includes("<MPD");
}

/**
 * The same image at several sizes, e.g. YouTube community posts list
 * `...=s288-c...`, `...=s400-c...` through `...=s5464-c...` for ONE image.
 * Grouped by the URL up to the size token; one URL kept per group, the
 * largest at or under 1080px (or the smallest when all are larger).
 */
const SIZE_TOKEN = /=s(\d+)(?=[-&]|$)/;
function collapseSizeLadder(arr: JsonValue[]): JsonValue[] {
  if (arr.length < 3 || !arr.every((v) => typeof v === "string" && v.startsWith("http") && SIZE_TOKEN.test(v))) return arr;
  const groups = new Map<string, { url: string; size: number }[]>();
  for (const url of arr as string[]) {
    const m = SIZE_TOKEN.exec(url)!;
    const base = url.slice(0, m.index);
    const list = groups.get(base) ?? [];
    list.push({ url, size: Number(m[1]) });
    groups.set(base, list);
  }
  if (groups.size === arr.length) return arr;
  const out: string[] = [];
  for (const list of groups.values()) {
    const fit = list.filter((x) => x.size <= 1080).sort((a, b) => b.size - a.size)[0];
    out.push((fit ?? list.sort((a, b) => a.size - b.size)[0]).url);
  }
  return out;
}

function compact(val: JsonValue, drop: Set<string>, project?: (o: JsonObject) => JsonObject): JsonValue | undefined {
  if (val === null || val === undefined || val === "") return undefined;

  if (typeof val === "string") return isDroppableString(val) ? undefined : val;

  if (Array.isArray(val)) {
    const out = collapseSizeLadder(val)
      .map((v) => compact(v, drop, project))
      .filter((v) => v !== undefined) as JsonValue[];
    return out.length ? out : undefined;
  }

  if (typeof val === "object") {
    const obj = project ? project(val) : val;
    const out: JsonObject = {};
    let hasKey = false;
    for (const [k, v] of Object.entries(obj)) {
      if (drop.has(k)) continue;
      const src = FIRST_ONLY_KEYS.has(k) && Array.isArray(v) && v.length > 1 ? [v[0]] : v;
      const clean = compact(src as JsonValue, drop, project);
      if (clean !== undefined) {
        out[k] = clean;
        hasKey = true;
      }
    }
    return hasKey ? out : undefined;
  }

  return val;
}

/**
 * Slice the named result lists in the top three object levels. Returns
 * "path: kept of received" notes for the lists that were cut.
 */
function applyLimit(root: JsonValue, keys: string[], limit: number): Record<string, string> {
  const notes: Record<string, string> = {};
  const want = new Set(keys);
  const visit = (node: JsonValue, path: string, depth: number) => {
    if (!isPlainObject(node) || depth > 2) return;
    for (const [k, v] of Object.entries(node)) {
      const p = path ? `${path}.${k}` : k;
      if (want.has(k) && Array.isArray(v)) {
        if (v.length > limit) {
          notes[p] = `${limit} of ${v.length} returned; raise count/limit for the rest (a next-page cursor or page continues after all ${v.length})`;
          node[k] = v.slice(0, limit);
        }
      } else if (isPlainObject(v)) {
        visit(v, p, depth + 1);
      }
    }
  };
  visit(root, "", 0);
  return notes;
}

/** Shape a parsed API response for the model. Exported for scripts/trim-check.mjs. */
export function shapeResponse(data: unknown, opts: TrimOptions = {}): JsonValue {
  // Work on a copy: limit and the platform prepare step mutate.
  let root = structuredClone(data ?? {}) as JsonValue;

  let notes: Record<string, string> = {};
  if (opts.platform) root = PLATFORM_PREPARE[opts.platform]?.(root) ?? root;
  if (opts.limit !== undefined && opts.listKeys?.length) notes = applyLimit(root, opts.listKeys, opts.limit);

  const drop = opts.dropKeys?.length ? new Set([...GLOBAL_DROP_KEYS, ...opts.dropKeys]) : GLOBAL_DROP_KEYS;
  const project = opts.platform ? PLATFORM_PROJECTORS[opts.platform] : undefined;
  const out = (compact(root, drop, project) ?? {}) as JsonValue;

  if (Object.keys(notes).length && isPlainObject(out)) {
    return { ...out, _truncated: notes };
  }
  return out;
}

export function trimResponse(data: unknown, opts: TrimOptions = {}): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(shapeResponse(data, opts)) }] };
}
