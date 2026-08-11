# Scavio MCP Server - LLM Installation Guide

Scavio is a unified search and data API for AI agents: web search (Google SERP, AI Mode, Maps, Shopping, Flights, Hotels, News, Trends), page extraction for any URL, and structured data across e-commerce, social, travel, real estate, jobs, app stores, software reviews, ad libraries and company filings. 191 tools across 31 platforms plus Extract, one API key.

## Prerequisites

1. A Scavio API key. The user must sign up at https://dashboard.scavio.dev (free, 50 signup credits, no credit card) and create a key on the API Keys page. Keys start with `sk_live_` or `sk_test_`.
2. For local (stdio) installation: Node.js 20 or later.

Ask the user for their API key before configuring. Never invent or reuse a placeholder key.

## Important: only a subset of tools loads by default

The server exposes 191 tools. Registering all of them writes 262KB into `tools/list`, which is roughly 70k tokens of context in every session and more tools than some clients accept. So the server registers a default set (106 tools, 102KB) and gates the rest behind `SCAVIO_PLATFORMS`.

**Default (env var unset):** `extract`, `google`, `youtube`, `amazon`, `walmart`, `reddit`, `tiktok`, `tiktok-shop`, `instagram`, `x`, `linkedin` - 106 tools including `get_usage`. This is the surface 0.12.x shipped plus Extract, so upgrading never removes a tool.

**To add platforms**, set `SCAVIO_PLATFORMS` to a comma-separated list of platform keys. `default` expands to the set above, so `SCAVIO_PLATFORMS=default,zillow,redfin` is additive. `SCAVIO_PLATFORMS=all` registers all 191 tools. `SCAVIO_PLATFORMS=none` registers only `get_usage`.

Ask the user which platforms they actually need, and set only those. Do not set `all` unless the user asks for it - it is the configuration that causes context bloat and client tool-limit errors.

**Platform keys:** `extract`, `google`, `youtube`, `tiktok`, `instagram`, `reddit`, `x`, `linkedin`, `threads`, `kuaishou`, `amazon`, `walmart`, `ebay`, `target`, `homedepot`, `tiktok-shop`, `booking`, `airbnb`, `tripadvisor`, `yelp`, `zillow`, `redfin`, `indeed`, `glassdoor`, `appstore`, `googleplay`, `g2`, `capterra`, `googleads`, `metaads`, `sec`, `companieshouse`

Keys are matched case- and punctuation-insensitively (`meta-ads` = `metaads` = `META_ADS`), and `twitter` resolves to `x`. Unknown keys are logged to stderr and skipped, never fatal.

## Option A: Remote server (recommended, no installation)

Configure an HTTP MCP server:

- URL: `https://mcp.scavio.dev/mcp`
- Transport: streamable HTTP
- Header: `x-api-key: <USER_API_KEY>`
- Optional header: `x-scavio-platforms: <comma-separated keys>` (the remote has no env var, so the allowlist is passed per connection; `?platforms=` on the URL works too)

Cline `cline_mcp_settings.json` entry:

```json
{
  "mcpServers": {
    "scavio": {
      "type": "http",
      "url": "https://mcp.scavio.dev/mcp",
      "headers": {
        "x-api-key": "USER_API_KEY_HERE",
        "x-scavio-platforms": "extract,google,reddit"
      }
    }
  }
}
```

## Option B: Local server (stdio via npx)

```json
{
  "mcpServers": {
    "scavio": {
      "command": "npx",
      "args": ["-y", "@scavio/mcp-server"],
      "env": {
        "SCAVIO_API_KEY": "USER_API_KEY_HERE",
        "SCAVIO_PLATFORMS": "extract,google,reddit"
      }
    }
  }
}
```

Omit `SCAVIO_PLATFORMS` to accept the default set.

## Verify the installation

Call the `get_usage` tool. It is free, always registered regardless of the allowlist, and a successful response returns the account plan and credit balance. If it returns 401, the API key is wrong or missing.

## Troubleshooting

- 401 Unauthorized: key missing/typo. Remote uses the `x-api-key` header; local uses the `SCAVIO_API_KEY` env var.
- 402 Insufficient credits: the account is out of credits; top up at https://dashboard.scavio.dev/billing.
- 429 Rate limited: the plan's concurrency limit was hit; retry after a moment.
- A tool the user expects is missing: its platform is not in the allowlist. Add the platform key to `SCAVIO_PLATFORMS` (or the `x-scavio-platforms` header) and restart the client. Check the server's stderr line on startup - it prints the platforms it registered.
- Client reports too many tools: narrow `SCAVIO_PLATFORMS` instead of using `all`.
- Local server exits immediately: check Node.js >= 20 (`node --version`).
