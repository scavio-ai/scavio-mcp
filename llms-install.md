# Scavio MCP Server - LLM Installation Guide

Scavio is a unified search and data API for AI agents: web search (Google SERP, AI Mode, Maps, Shopping, Flights, Hotels, News, Trends), page extraction for any URL, and structured data across e-commerce, social, travel, real estate, jobs, app stores, software and business reviews, ad libraries and company filings. 1393 tools across 173 platforms plus Extract (single pages, site maps, crawls and batches), one API key.

## Prerequisites

1. A Scavio API key. The user must sign up at https://dashboard.scavio.dev/sign-up?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme (free, 50 signup credits, no credit card) and create a key on the API Keys page. Keys start with `sk_live_` or `sk_test_`.
2. For local (stdio) installation: Node.js 20 or later.

Ask the user for their API key before configuring. Never invent or reuse a placeholder key.

## Important: only a subset of tools loads by default

The server exposes 1393 tools. Registering all of them writes 3032KB into `tools/list`, which is roughly 90k tokens of context in every session and more tools than some clients accept. So the server registers a default set (143 tools, 114KB) and gates the rest behind `SCAVIO_PLATFORMS`.

**Default (env var unset):** `extract`, `company`, `google`, `youtube`, `amazon`, `walmart`, `reddit`, `tiktok`, `tiktok-shop`, `instagram`, `x`, `linkedin` - 143 tools including `get_usage`. This is the platform set 0.12.x shipped plus Extract and Company Enrich, so upgrading never removes a tool.

**To add platforms**, set `SCAVIO_PLATFORMS` to a comma-separated list of platform keys. `default` expands to the set above, so `SCAVIO_PLATFORMS=default,zillow,redfin` is additive. `SCAVIO_PLATFORMS=all` registers all 1393 tools. `SCAVIO_PLATFORMS=none` registers only `get_usage`.

Ask the user which platforms they actually need, and set only those. Do not set `all` unless the user asks for it - it is the configuration that causes context bloat and client tool-limit errors.

**Platform keys:** `extract`, `company`, `google`, `chatgpt`, `gemini`, `youtube`, `tiktok`, `instagram`, `reddit`, `x`, `linkedin`, `threads`, `kuaishou`, `amazon`, `walmart`, `ebay`, `target`, `homedepot`, `costco`, `heb`, `kroger`, `publix`, `ikea`, `wayfair`, `ashley`, `maisonsdumonde`, `williamssonoma`, `bedbathbeyond`, `decathlon`, `specs`, `lowes`, `acehardware`, `tractorsupply`, `michaels`, `nike`, `staples`, `samsclub`, `bjs`, `canadiantire`, `sportchek`, `marks`, `rona`, `dollargeneral`, `dollartree`, `discounttire`, `vevor`, `nellis`, `estatesales`, `bringatrailer`, `sephora`, `ulta`, `dermstore`, `bathandbodyworks`, `spacenk`, `lookfantastic`, `cultbeauty`, `yesstyle`, `notino`, `douglas`, `boots`, `aldi`, `instacart`, `pcexpress`, `microcenter`, `walgreens`, `cvs`, `wholefoods`, `harborfreight`, `autozone`, `oreilly`, `rockauto`, `carscom`, `autotrader`, `cargurus`, `carmax`, `carvana`, `truecar`, `edmunds`, `kbb`, `petsmart`, `petco`, `iherb`, `chewy`, `menards`, `nordstrom`, `nordstromrack`, `bestbuy`, `newegg`, `tcgplayer`, `nintendo`, `hm`, `zara`, `uniqlo`, `asos`, `fashionnova`, `gap`, `zappos`, `vinted`, `mercari`, `depop`, `poshmark`, `offerup`, `thredup`, `macys`, `saks`, `kohls`, `jcpenney`, `dicks`, `footlocker`, `fanatics`, `academy`, `rei`, `qvc`, `barnesandnoble`, `thriftbooks`, `belk`, `abercrombie`, `llbean`, `sweetwater`, `argos`, `mediaexpert`, `action`, `hema`, `carrefour`, `allegro`, `bolcom`, `olx`, `trendyol`, `mercadolibre`, `kabum`, `magalu`, `casasbahia`, `buscape`, `rdsaude`, `reclameaqui`, `leroymerlin`, `natura`, `boticario`, `centauro`, `rakuten`, `tiktok-shop`, `booking`, `airbnb`, `vrbo`, `expedia`, `tripadvisor`, `yelp`, `zillow`, `redfin`, `realtor`, `rightmove`, `rentcom`, `trulia`, `streeteasy`, `rentcafe`, `movoto`, `hotpads`, `apartmentlist`, `compass`, `affordablehousing`, `lennar`, `extraspace`, `publicstorage`, `uhaul`, `indeed`, `glassdoor`, `appstore`, `googleplay`, `g2`, `capterra`, `trustpilot`, `goodreads`, `googleads`, `metaads`, `sec`, `companieshouse`

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
- 402 Insufficient credits: the account is out of credits; top up at https://dashboard.scavio.dev/billing?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme.
- 429 Rate limited: the plan's concurrency limit was hit; retry after a moment.
- A tool the user expects is missing: its platform is not in the allowlist. Add the platform key to `SCAVIO_PLATFORMS` (or the `x-scavio-platforms` header) and restart the client. Check the server's stderr line on startup - it prints the platforms it registered.
- Client reports too many tools: narrow `SCAVIO_PLATFORMS` instead of using `all`.
- Local server exits immediately: check Node.js >= 20 (`node --version`).
