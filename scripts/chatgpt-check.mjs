#!/usr/bin/env node
/**
 * Verify the /chatgpt profile against the OpenAI plugin directory rules it was
 * built for (see src/tools/chatgpt-app.ts). Starts the built HTTP server on a
 * local port and talks MCP to it; exits non-zero on the first failed check.
 *
 *   npm run build
 *   node scripts/chatgpt-check.mjs          # offline checks (fake API for errors)
 *   node scripts/chatgpt-check.mjs --live   # also real calls; needs SCAVIO_API_KEY, spends ~4 credits
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "dist", "index.js");
const live = process.argv.includes("--live");

const EXPECTED = [
  "search_google", "google_news", "google_shopping", "google_maps_search", "google_maps_place",
  "google_maps_reviews", "company_enrich", "extract_url", "map_website", "crawl_website",
  "get_crawl_status", "cancel_crawl", "batch_extract", "get_batch_status", "cancel_batch", "get_usage",
];
// Plugin 1.1: social, retail and real estate tools. Exact count pinned so an
// added or removed upstream tool is a deliberate review, not drift.
const BROAD_PREFIXES = /tiktok|instagram|youtube|reddit|tweet|_x_|search_x|linkedin|amazon|walmart|ebay|target|home_depot|bestbuy|zillow|redfin|realtor/;
const EXCLUDED = [
  "get_tiktok_user_followers", "get_tiktok_user_followings", "get_tiktok_user_region",
  "get_instagram_user_followers", "get_instagram_user_followings", "get_instagram_post_likers",
  "get_instagram_user_stories", "get_instagram_highlight_stories", "get_tweet_retweeters",
  "get_x_user_followers", "get_x_user_followings", "get_linkedin_person", "get_linkedin_person_about",
  "get_linkedin_person_posts", "get_youtube_streams", "get_youtube_metadata",
];
const BROAD_COUNT = Number(process.env.CHATGPT_BROAD_COUNT ?? 126);
const MAX_BYTES = 160 * 1024;
const HIDDEN = {
  search_google: ["include_html", "location", "uule", "web_only"],
  google_shopping: ["location", "uule"],
  google_maps_search: ["ll"],
  crawl_website: ["webhook_url"],
  batch_extract: ["webhook_url"],
};
// Pricing, plan names and billing words that must not reach model-readable text.
const BANNED = /\b\d+\s*cr\b|\bcredits?\b|PRICE-BEARING|\bfree\b(?! shipping)|\bPAYG\b|\bBootstrap\b|\bStartup\b|\bGrowth\b|\bProject\b|\bHobby\b|\bbill(ed|ing)?\b|\bupgrade\b|\btop up\b|\bultra\b/i;
const BANNED_ALLOWED = new Set(["get_usage"]); // reports the user's own balance by design
const STRIPPED = ["credits", "credits_used", "credits_remaining", "response_time", "time_taken_displayed", "cached", "fetched_at", "request_id", "status_url", "created_at", "started_at", "completed_at"];

let failures = 0;
const check = (ok, label, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : `\n      ${detail}`}`);
  if (!ok) failures++;
};

function startServer(port, extraEnv = {}) {
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: { ...process.env, TRANSPORT: "http", PORT: String(port), ...extraEnv },
    stdio: ["ignore", "ignore", "pipe"],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server did not start")), 15000);
    child.stderr.on("data", (d) => {
      if (String(d).includes("started (http)")) {
        clearTimeout(timer);
        resolve(child);
      }
    });
  });
}

async function rpc(port, path, method, params, apiKey) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(apiKey ? { "x-api-key": apiKey } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data: "));
  return { status: res.status, headers: res.headers, body: line ? JSON.parse(line.slice(6)) : text };
}

const listTools = async (port, path, key) => (await rpc(port, path, "tools/list", {}, key)).body.result.tools;
const callTool = async (port, key, name, args) => (await rpc(port, "/chatgpt", "tools/call", { name, arguments: args }, key)).body;

function findKeys(value, keys, found = new Set()) {
  if (Array.isArray(value)) value.forEach((v) => findKeys(v, keys, found));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (keys.includes(k)) found.add(k);
      findKeys(v, keys, found);
    }
  }
  return found;
}

const children = [];
let fakeApi;
const seenSources = new Set();
try {
  // ---- Offline: tool surface ------------------------------------------------
  const port = 3911;
  children.push(await startServer(port, { OPENAI_APPS_CHALLENGE: "test-challenge-token" }));
  const key = process.env.SCAVIO_API_KEY ?? "sk_test_chatgpt_check";

  const unauth = await rpc(port, "/chatgpt", "tools/list", {});
  check(unauth.status === 401, "/chatgpt without a key is 401");
  check(
    (unauth.headers.get("www-authenticate") ?? "").includes("/.well-known/oauth-protected-resource/chatgpt"),
    "401 points at the /chatgpt resource metadata",
    unauth.headers.get("www-authenticate") ?? "",
  );
  const meta = await (await fetch(`http://127.0.0.1:${port}/.well-known/oauth-protected-resource/chatgpt`)).json();
  check(meta.resource?.endsWith("/chatgpt"), "resource metadata names the /chatgpt resource", JSON.stringify(meta));
  const challenge = await fetch(`http://127.0.0.1:${port}/.well-known/openai-apps-challenge`);
  check(challenge.status === 200 && (await challenge.text()) === "test-challenge-token", "challenge token served verbatim");

  const tools = await listTools(port, "/chatgpt", key);
  const names = tools.map((t) => t.name);
  const broadNames = names.filter((n) => !EXPECTED.includes(n));
  check(EXPECTED.every((n) => names.includes(n)), `all ${EXPECTED.length} core tools`, names.join(", "));
  check(broadNames.every((n) => BROAD_PREFIXES.test(n)), "only social, retail and real estate tools beyond the core", broadNames.filter((n) => !BROAD_PREFIXES.test(n)).join(", "));
  check(broadNames.length === BROAD_COUNT, `exactly ${BROAD_COUNT} broad tools`, `got ${broadNames.length}`);
  check(!EXCLUDED.some((n) => names.includes(n)), "excluded people-data and media tools absent", EXCLUDED.filter((n) => names.includes(n)).join(", "));
  const bytes = Buffer.byteLength(JSON.stringify(tools), "utf8");
  check(bytes <= MAX_BYTES, `tools/list under ${MAX_BYTES / 1024}KB`, `${bytes} bytes`);
  console.log(`      ${names.length} tools, ${(bytes / 1024).toFixed(1)}KB`);
  for (const t of tools) {
    const a = t.annotations ?? {};
    check(
      ["readOnlyHint", "destructiveHint", "openWorldHint"].every((h) => typeof a[h] === "boolean"),
      `${t.name}: explicit boolean hints`,
      JSON.stringify(a),
    );
    const texts = [t.description, ...Object.values(t.inputSchema?.properties ?? {}).map((p) => p.description ?? "")];
    if (!BANNED_ALLOWED.has(t.name)) {
      const hit = texts.find((s) => BANNED.test(s));
      check(!hit, `${t.name}: no pricing or plan text`, hit);
    }
    const props = Object.keys(t.inputSchema?.properties ?? {});
    const leaked = (HIDDEN[t.name] ?? []).filter((p) => props.includes(p));
    check(leaked.length === 0, `${t.name}: hidden inputs absent`, leaked.join(", "));
    const modeEnum = t.inputSchema?.properties?.mode?.enum;
    if (modeEnum) check(!modeEnum.includes("ultra"), `${t.name}: no 'ultra' mode`, modeEnum.join(","));
  }

  const defaults = await listTools(port, "/mcp", key);
  check(defaults.length > 100, "/mcp still serves the full default set", `got ${defaults.length}`);
  const extractDefault = defaults.find((t) => t.name === "extract_url");
  check(/PRICE-BEARING/.test(JSON.stringify(extractDefault)), "/mcp descriptions unchanged");

  // ---- Offline: error rewrites against a fake API ----------------------------
  fakeApi = createServer((req, res) => {
    const status = req.headers.authorization === "Bearer sk_revoked" ? 401 : 402;
    seenSources.add(req.headers["x-client-source"]);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: status === 401 ? "Unauthorized" : "Insufficient credits", billing_url: "https://dashboard.scavio.dev/billing" }));
  });
  await new Promise((r) => fakeApi.listen(3913, "127.0.0.1", r));
  const errPort = 3912;
  children.push(await startServer(errPort, { SCAVIO_API_BASE_URL: "http://127.0.0.1:3913" }));
  const r402 = await callTool(errPort, "sk_broke", "search_google", { query: "x" });
  const t402 = r402.result?.content?.[0]?.text ?? JSON.stringify(r402);
  check(r402.result?.isError === true && !/https?:\/\/|upgrade|top up/i.test(t402), "402 text has no link or upsell", t402);
  const r401 = await callTool(errPort, "sk_revoked", "search_google", { query: "x" });
  const t401 = JSON.stringify(r401);
  check(/Reconnect Scavio in ChatGPT/.test(t401) && !/SCAVIO_API_KEY/.test(t401), "401 text tells the user to reconnect", t401);
  check(seenSources.size === 1 && seenSources.has("scavio-mcp-chatgpt"), "calls are tagged X-Client-Source: scavio-mcp-chatgpt", [...seenSources].join(", "));

  // ---- Live: response minimization --------------------------------------------
  if (live) {
    if (!process.env.SCAVIO_API_KEY) throw new Error("--live needs SCAVIO_API_KEY");
    const cases = [
      ["get_usage", {}],
      ["search_google", { query: "espresso machine reviews" }],
      ["extract_url", { url: "https://example.com" }],
      ["batch_extract", { urls: ["https://example.com", "https://example.org"], wait_seconds: 40 }],
    ];
    for (const [name, args] of cases) {
      const r = await callTool(port, key, name, args);
      const text = r.result?.content?.[0]?.text;
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        check(false, `${name}: JSON result`, JSON.stringify(r).slice(0, 300));
        continue;
      }
      check(!r.result.isError, `${name}: succeeded`, text.slice(0, 200));
      const found = [...findKeys(parsed, STRIPPED)];
      check(found.length === 0, `${name}: no telemetry fields`, found.join(", "));
      if (name === "get_usage") {
        const extra = Object.keys(parsed).filter((k) => !["plan", "credit_balance", "credits_used_this_period", "period_start"].includes(k));
        check(extra.length === 0, "get_usage: only plan, balance, period usage", extra.join(", "));
      }
    }
  }
} catch (err) {
  console.error(err);
  failures++;
} finally {
  for (const c of children) c.kill();
  fakeApi?.close();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
