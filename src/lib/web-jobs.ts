/**
 * MCP-side shaping for website map, crawl and batch (the Extract family's
 * multi-page operations). The REST API is untouched; this only decides how much
 * of a response lands in a model's context and what the model is told to do
 * next.
 *
 * - map: a site can list 5,000 URLs. When the caller sets no `limit` the tool
 *   asks for MCP_MAP_DEFAULT_LIMIT, and a truncated list carries a hint.
 * - crawl/batch status: a result page can hold up to 100 pages of up to 2 MB
 *   each. The tool asks for MCP_RESULTS_DEFAULT_LIMIT results per call and
 *   clips each page's content to `max_content_chars`, flagging the clip, so a
 *   status call stays inside a context window. `next_cursor` always survives.
 *
 * Deterministic and offline. Exported for scripts/trim-check.mjs.
 */
import { shapeResponse, type JsonObject, type JsonValue } from "./trim-response.js";

export const MCP_MAP_DEFAULT_LIMIT = 200;
export const MCP_RESULTS_DEFAULT_LIMIT = 10;
export const MCP_DEFAULT_CONTENT_CHARS = 4000;
/** MCP clients commonly cancel a tool call at 60 s; stay well inside it. */
export const MAX_WAIT_SECONDS = 50;
export const CRAWL_DEFAULT_WAIT_SECONDS = 30;
export const POLL_INTERVAL_MS = 3000;

export const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Shape a map response: add a hint when the link list was cut. */
export function shapeMap(raw: unknown): JsonValue {
  const out = shapeResponse(raw);
  if (isObject(out) && isObject(out.data) && out.data.truncated === true) {
    const d = out.data;
    return {
      ...out,
      _hint: `${d.returned} of ${d.total_found} URLs returned. Raise limit (up to 5,000, or your plan's cap) or narrow with search / include_paths / exclude_paths.`,
    };
  }
  return out;
}

export interface JobShapeOptions {
  type: "crawl" | "batch";
  maxContentChars?: number;
}

/**
 * Shape a crawl/batch status response: clip page content, then drop nulls, then
 * tell the model what to call next (more results, or wait for a running job).
 */
export function shapeJobStatus(raw: unknown, opts: JobShapeOptions): JsonValue {
  const max = opts.maxContentChars ?? MCP_DEFAULT_CONTENT_CHARS;
  const copy = structuredClone(raw ?? {}) as JsonValue;
  let clipped = 0;
  if (isObject(copy) && isObject(copy.data) && Array.isArray(copy.data.results)) {
    for (const r of copy.data.results) {
      if (isObject(r) && typeof r.content === "string" && r.content.length > max) {
        r.content = r.content.slice(0, max);
        r.content_clipped = true;
        clipped++;
      }
    }
  }
  const out = shapeResponse(copy);
  if (!isObject(out) || !isObject(out.data)) return out;

  const d = out.data;
  const tool = `get_${opts.type}_status`;
  const hints: string[] = [];
  const status = typeof d.status === "string" ? d.status : "";
  if (status && !TERMINAL_STATUSES.has(status)) {
    hints.push(`The ${opts.type} is ${status}: call ${tool} with id="${d.id}" and wait_seconds (up to ${MAX_WAIT_SECONDS}) to wait for it.`);
  }
  if (typeof d.next_cursor === "string") {
    hints.push(`More results: call ${tool} with id="${d.id}" and cursor="${d.next_cursor}".`);
  }
  if (clipped > 0) {
    hints.push(`${clipped} page(s) clipped to ${max} characters (content_clipped: true; content_length is the full size). Raise max_content_chars, or filter with status, to read more.`);
  }
  return hints.length ? { ...out, _hint: hints.join(" ") } : out;
}
