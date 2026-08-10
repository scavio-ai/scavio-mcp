#!/usr/bin/env node
/**
 * Drive a real tools/list against the built stdio server and report the tool
 * count, the wire size of the response, and any duplicate tool names.
 *
 * tools/list is serialised into every client session before the user says
 * anything, so its size is a budget that has to be measured rather than
 * estimated. Run this whenever the tool surface changes.
 *
 *   npm run build
 *   node scripts/toolslist.mjs                       # SCAVIO_PLATFORMS unset (default set)
 *   SCAVIO_PLATFORMS=all node scripts/toolslist.mjs  # everything
 *   node scripts/toolslist.mjs --names               # also print every tool name
 *
 * No API key is needed: tools/list never calls the Scavio API.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entry = join(root, "dist", "index.js");
const showNames = process.argv.includes("--names");

const child = spawn(process.execPath, [entry], {
  cwd: root,
  env: { ...process.env, TRANSPORT: "stdio", SCAVIO_API_KEY: process.env.SCAVIO_API_KEY ?? "sk_test_toolslist" },
  stdio: ["pipe", "pipe", "pipe"],
});

let stderr = "";
child.stderr.on("data", (d) => { stderr += d.toString(); });

const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");

let buf = "";
// Not awaited here on purpose: the listener has to be attached before the
// initialize request below is written, or the reply is missed.
const pending = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`timed out waiting for tools/list\n${stderr}`)), 30000);
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id === 1) {
        send({ jsonrpc: "2.0", method: "notifications/initialized", params: {} });
        send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      } else if (msg.id === 2) {
        clearTimeout(timer);
        resolve({ line, msg });
      }
    }
  });
  child.on("exit", (code) => {
    clearTimeout(timer);
    reject(new Error(`server exited (${code}) before answering\n${stderr}`));
  });
});

send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "toolslist", version: "0" } },
});

const { line, msg } = await pending;
child.kill();

const tools = msg.result.tools;
const names = tools.map((t) => t.name);
const duplicates = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
const bytes = Buffer.byteLength(JSON.stringify(tools), "utf8");

console.log(`SCAVIO_PLATFORMS   ${process.env.SCAVIO_PLATFORMS ?? "(unset - default set)"}`);
console.log(`tools              ${tools.length}`);
console.log(`tools/list bytes   ${bytes.toLocaleString()} (${(bytes / 1024).toFixed(1)}KB)`);
console.log(`wire response      ${Buffer.byteLength(line, "utf8").toLocaleString()} bytes`);
console.log(`avg per tool       ${Math.round(bytes / tools.length).toLocaleString()} bytes`);
console.log(`duplicate names    ${duplicates.length ? duplicates.join(", ") : "none"}`);
if (showNames) console.log("\n" + names.join("\n"));

process.exit(duplicates.length ? 1 : 0);
