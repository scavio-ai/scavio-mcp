# Scavio MCP Server

![GitHub Repo stars](https://img.shields.io/github/stars/scavio-ai/scavio-mcp?style=social)
![License](https://img.shields.io/github/license/scavio-ai/scavio-mcp)

[Scavio](https://scavio.dev?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) is a unified [Web Search API](https://scavio.dev/docs/search-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and MCP server that gives AI agents web search, page extraction, and structured data from e-commerce, social, travel, jobs, real-estate, app-store, ad-library and company-filing sources. 1497 tools across 184 platforms plus Extract, Company Enrich, map, crawl and batch, one API key.

**The 22 platforms added in 0.13.0 are opt-in.** Registering all 1497 tools puts ~3252KB of tool definitions — roughly 90k tokens — into every session before you type anything. So the default is the platform set 0.12.x already had, plus Extract and Company Enrich: 143 tools, 114KB. Upgrading never removes a tool you were using. Everything else is one env var away: see [Choosing which tools load](#choosing-which-tools-load).

## Remote MCP Server

Connect directly to Scavio's remote MCP server without any local installation:

```
https://mcp.scavio.dev/mcp
```

Two ways to authenticate:

- **Sign in with OAuth, no key to copy.** Claude Desktop, claude.ai and Claude Code sign in to your Scavio account through the server. In Claude Desktop or claude.ai: Settings > Connectors > Add custom connector, name it Scavio, paste the URL, then Connect and Authorize. In Claude Code: `claude mcp add --transport http scavio https://mcp.scavio.dev/mcp`, then run `/mcp` and choose Authenticate.
- **API key.** Pass it in the `x-api-key` header. Get your key at [scavio.dev](https://scavio.dev?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

---

## Run Locally (npx)

Prefer to run the server on your own machine? Use `npx` with no clone or build. The server runs over stdio and only needs your `SCAVIO_API_KEY`.

### Claude Code

```bash
claude mcp add scavio -e SCAVIO_API_KEY=YOUR_SCAVIO_API_KEY -- npx -y @scavio/mcp-server
```

### Any MCP-Compatible Client (Claude Desktop, Cursor, Windsurf, VS Code, etc.)

```json
{
  "mcpServers": {
    "scavio": {
      "command": "npx",
      "args": ["-y", "@scavio/mcp-server"],
      "env": {
        "SCAVIO_API_KEY": "YOUR_SCAVIO_API_KEY"
      }
    }
  }
}
```

Requires Node.js 20+. Get your API key at [scavio.dev](https://scavio.dev?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

---

## Install

### Claude Code

Sign in with OAuth, then run `/mcp` inside Claude Code and choose Authenticate:

```bash
claude mcp add --transport http scavio https://mcp.scavio.dev/mcp
```

Or pass an API key:

```bash
claude mcp add --transport http scavio https://mcp.scavio.dev/mcp --header "x-api-key: YOUR_SCAVIO_API_KEY"
```

### Claude Desktop

No API key needed: Settings > Connectors > Add custom connector, name it Scavio, paste `https://mcp.scavio.dev/mcp`, then Connect and sign in to your Scavio account. The same steps work on claude.ai.

Or run the server locally. Add to `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "scavio": {
      "command": "npx",
      "args": ["-y", "@scavio/mcp-server"],
      "env": {
        "SCAVIO_API_KEY": "YOUR_SCAVIO_API_KEY"
      }
    }
  }
}
```

Requires Node.js 20+. Restart Claude Desktop after saving.

### Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=scavio&config=eyJ1cmwiOiJodHRwczovL21jcC5zY2F2aW8uZGV2L21jcCIsImhlYWRlcnMiOnsieC1hcGkta2V5IjoiWU9VUl9TQ0FWSU9fQVBJX0tFWSJ9fQ%3D%3D)

Or add to `.cursor/mcp.json` in your project root or `~/.cursor/mcp.json` for global:

```json
{
  "mcpServers": {
    "scavio": {
      "type": "http",
      "url": "https://mcp.scavio.dev/mcp",
      "headers": {
        "x-api-key": "YOUR_SCAVIO_API_KEY"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "scavio": {
      "type": "http",
      "url": "https://mcp.scavio.dev/mcp",
      "headers": {
        "x-api-key": "YOUR_SCAVIO_API_KEY"
      }
    }
  }
}
```

### VS Code

Create `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "scavio": {
      "type": "http",
      "url": "https://mcp.scavio.dev/mcp",
      "headers": {
        "x-api-key": "YOUR_SCAVIO_API_KEY"
      }
    }
  }
}
```

### ChatGPT

1. Go to [ChatGPT](https://chatgpt.com) > **Settings** > **Apps & Connectors**
2. Click **Add custom connector**
3. Enter the MCP server URL: `https://mcp.scavio.dev/mcp`
4. Configure authentication with your API key

### Cline

Add to `cline_mcp_settings.json` (open via Cline sidebar > MCP Servers > Configure):

```json
{
  "mcpServers": {
    "scavio": {
      "type": "http",
      "url": "https://mcp.scavio.dev/mcp",
      "headers": {
        "x-api-key": "YOUR_SCAVIO_API_KEY"
      }
    }
  }
}
```

### Zed

Add to settings (`Cmd+,`):

```json
{
  "assistant": {
    "mcp_servers": {
      "scavio": {
        "type": "http",
        "url": "https://mcp.scavio.dev/mcp",
        "headers": {
          "x-api-key": "YOUR_SCAVIO_API_KEY"
        }
      }
    }
  }
}
```

### Any MCP-Compatible Client

```json
{
  "type": "http",
  "url": "https://mcp.scavio.dev/mcp",
  "headers": {
    "x-api-key": "YOUR_SCAVIO_API_KEY"
  }
}
```

---

## Choosing which tools load

Scavio exposes 1497 tools. Loading all of them costs ~3252KB of `tools/list` —
roughly 90k tokens of context in every session before the user has said anything,
and more tools than some clients will accept at all. So the server registers a
curated subset by default and lets you pick the rest. The sizes below are
measured, not estimated: `npm run toolslist` reproduces them.

`SCAVIO_PLATFORMS` is a comma-separated allowlist of platform keys:

| Value | Registers |
|-------|-----------|
| *(unset)* or `default` | Every platform 0.12.x had, plus `extract` and `company` — **143 tools, 114KB** |
| `all` | every platform — **1497 tools, ~3252KB** |
| `extract,sec,g2` | just those platforms — 18 tools, 21KB |
| `default,zillow,metaads` | the default set plus two more — 149 tools, 122KB |
| `default,chatgpt,gemini` | the default set plus ChatGPT and Gemini — 145 tools, 117KB |
| `none` | no platform tools, only `get_usage` |

Keys are matched case- and punctuation-insensitively, so `meta-ads`, `metaads`
and `META_ADS` are the same thing, and `twitter` resolves to `x`. An unknown key
is logged to stderr and skipped rather than failing the server.

`get_usage` always registers — it is free, and it is what every install guide
tells you to call to check the server works.

**Platform keys:** `extract`, `company`, `google`, `chatgpt`, `gemini`, `youtube`, `tiktok`, `instagram`,
`reddit`, `x`, `linkedin`, `threads`, `kuaishou`, `amazon`, `walmart`, `ebay`,
`target`, `homedepot`, `costco`, `heb`, `kroger`, `publix`, `ikea`, `wayfair`, `ashley`, `maisonsdumonde`, `williamssonoma`, `bedbathbeyond`, `decathlon`, `specs`, `lowes`, `acehardware`, `tractorsupply`, `michaels`, `nike`, `staples`, `samsclub`, `bjs`, `canadiantire`, `sportchek`, `marks`, `rona`, `dollargeneral`, `dollartree`, `discounttire`, `vevor`, `nellis`, `estatesales`, `bringatrailer`, `sephora`, `ulta`, `dermstore`, `bathandbodyworks`, `spacenk`, `lookfantastic`, `cultbeauty`, `yesstyle`, `notino`, `douglas`, `boots`, `aldi`, `instacart`, `pcexpress`, `microcenter`, `walgreens`, `cvs`, `wholefoods`, `harborfreight`, `autozone`, `oreilly`, `rockauto`, `carscom`, `autotrader`, `cargurus`, `carmax`, `carvana`, `truecar`, `edmunds`, `kbb`, `petsmart`, `petco`, `iherb`, `chewy`, `menards`, `nordstrom`, `nordstromrack`, `bestbuy`, `newegg`, `tcgplayer`, `nintendo`, `hm`, `zara`, `uniqlo`, `asos`, `fashionnova`, `gap`, `zappos`, `vinted`, `mercari`, `depop`, `poshmark`, `offerup`, `thredup`, `macys`, `saks`, `kohls`, `jcpenney`, `dicks`, `footlocker`, `fanatics`, `academy`, `rei`, `qvc`, `barnesandnoble`, `thriftbooks`, `belk`, `abercrombie`, `llbean`, `sweetwater`, `argos`, `mediaexpert`, `action`, `hema`, `carrefour`, `allegro`, `bolcom`, `olx`, `trendyol`, `mercadolibre`, `kabum`, `magalu`, `casasbahia`, `buscape`, `rdsaude`, `reclameaqui`, `leroymerlin`, `natura`, `boticario`, `centauro`, `enjoei`, `atacadao`, `carrefourbr`, `terabyte`, `cobasi`, `netshoes`, `estantevirtual`, `cea`, `renner`, `pichau`, `dafiti`, `rakuten`, `tiktok-shop`, `booking`, `airbnb`, `vrbo`, `expedia`,
`tripadvisor`, `yelp`, `zillow`, `redfin`, `realtor`, `rightmove`, `rentcom`, `trulia`, `streeteasy`, `rentcafe`, `movoto`, `hotpads`, `apartmentlist`, `compass`, `affordablehousing`, `lennar`, `extraspace`, `publicstorage`, `uhaul`, `indeed`, `glassdoor`,
`appstore`, `googleplay`, `g2`, `capterra`, `trustpilot`, `goodreads`, `googleads`, `metaads`, `sec`, `companieshouse`

### Local (stdio)

```json
{
  "mcpServers": {
    "scavio": {
      "command": "npx",
      "args": ["-y", "@scavio/mcp-server"],
      "env": {
        "SCAVIO_API_KEY": "YOUR_SCAVIO_API_KEY",
        "SCAVIO_PLATFORMS": "extract,google,zillow,redfin"
      }
    }
  }
}
```

### Remote (HTTP)

The hosted server has no env var to read, so pass the allowlist per connection —
either as a header or as a query parameter:

```json
{
  "scavio": {
    "type": "http",
    "url": "https://mcp.scavio.dev/mcp",
    "headers": {
      "x-api-key": "YOUR_SCAVIO_API_KEY",
      "x-scavio-platforms": "extract,google,sec,companieshouse"
    }
  }
}
```

```
https://mcp.scavio.dev/mcp?platforms=all
```

### Upgrading from 0.12.x

Nothing to do. The default set is exactly the 10 platforms 0.12.x registered,
plus Extract — every tool you were using still loads. Those platforms keep gaining
tools (Walmart grew from 2 to 7; TikTok, YouTube, Reddit and X gained 19 in 0.20.0;
Extract gained map, crawl and batch in 0.21.0; Instagram gained 8 in 0.22.0; Google gained google_custom_search in 0.23.0; company_enrich joined the default in 0.50.0), which is why the default count is now 143.

The 22 platforms added in 0.13.0 are opt-in. Add them additively:

```
SCAVIO_PLATFORMS=default,zillow,redfin,sec
```

One breaking fix worth knowing: `search_walmart` previously sent
`fulfillment_speed: "anytime"` on every call, which the API rejects. The
parameter is now `today` or `tomorrow` with no default.

---

## Available Tools

Every tool costs 1 credit per call unless its section says otherwise. Several
platforms price per endpoint (YouTube, Instagram, LinkedIn, Kuaishou) or per
request body (Extract, Threads, Walmart); `get_amazon_options` and `get_usage`
are free.

### [Extract](https://scavio.dev/docs/extract?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `extract_url` | Read any web page and return it as clean Markdown, plain text, or raw HTML |
| `map_website` | List a site's page URLs from its sitemaps and start page, path-filtered, with `lastmod` when known |
| `crawl_website` | Crawl a site from one URL and extract every same-site page; waits up to `wait_seconds` and returns results, or the job id |
| `get_crawl_status` | A crawl's status, page counts, credits used and page results, paged by cursor; can wait for completion |
| `cancel_crawl` | Stop a running crawl; nothing more is billed, results so far stay readable |
| `batch_extract` | Extract a list of URLs in one job, results in input order; waits up to `wait_seconds` |
| `get_batch_status` | A batch's status and results, paged by cursor; can wait for completion |
| `cancel_batch` | Stop a running batch |

Extract is tier-priced by the `mode` parameter, not flat: `normal` (the default)
and `advanced` (renders JavaScript) cost 1 credit, `ultra` (for the hardest pages)
costs 2. Start at `normal` and escalate only when the
content comes back empty or blocked. You are billed only on a successful
extraction — a dead link, a bot wall or a timeout costs nothing. There is no
pagination: the whole page comes back in one call.

**Map, crawl and batch** (new in 0.21.0) are the multi-page operations:

- **Pricing.** `map_website` costs 1 credit. Crawl and batch bill per
  *successful* page at Extract's price for the tier (normal 1, advanced 1,
  ultra 2); failed and skipped pages are free, and status and cancel calls are
  free. Credits are taken page by page, and a job stops cleanly with
  `stopped_reason: "insufficient_credits"` if the balance runs out.
- **Plan limits** (max pages per crawl / active jobs / URLs per batch): Free
  10 / 1 / 10, PAYG 100 / 1 / 50, Project 500 / 2 / 100, Bootstrap 2,000 / 3 / 500,
  Startup 5,000 / 5 / 1,000, Growth 10,000 / 10 / 1,000. Starting a job past the
  active-job limit returns a 429 that names the running jobs.
- **Behaviour.** Robots.txt is always obeyed for map and crawl. A crawl stays on
  the start URL's site (subdomains optional) and visits pages under the start
  path first. Results are kept for 3 days; a job runs for at most 6 hours.
- **Built for tool-call time limits.** MCP clients usually cancel a tool call
  after about 60 seconds, so a crawl is a job, not one long call.
  `crawl_website` / `batch_extract` start the job and wait up to `wait_seconds`
  (default 30, max 50): a small job comes back finished with its first page of
  results; a large one returns the job id (and `webhook_secret`, shown only
  once, if you set `webhook_url`). `get_crawl_status` / `get_batch_status` take
  the same `wait_seconds` to long-poll, and `cursor` to page.
- **Output stays small.** Status calls return 10 results per call by default
  (`limit` up to 100) and clip each page's content to `max_content_chars`
  (default 4,000); clipped pages carry `content_clipped: true` next to the full
  `content_length`. `map_website` asks for 200 links when you set no `limit`
  (the API default is 1,000). Every response that has more to read carries a
  `_hint` naming the exact next call. Repeat a start call with the same
  `idempotency_key` and you get the original job back instead of a second one.

### [Company Enrich](https://scavio.dev/docs/company-enrich?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `company_enrich` | A company's published emails, phone numbers, social profiles and contact page, plus the owner or founder's name and title with the page that names them, from its website or a Google Maps `place_id` |

Platform key `company`, in the default set. The step after `google_maps_search`:
pass each local result's `place_id` and get the business's contact details, a
lead list from a Maps search in two calls. Provide `url` (the company's own
site; a social profile is a 400) or `place_id` (the listing is looked up first,
then its website is read).

Returns `data.company` (`name`, `website`, `domain`, `emails[]`, `phones[]`,
`socials` keyed by network, `contact_page`, `address`, `place_id`),
`data.owner` (`name`, `title`, `source_url`, `email`, `email_status`) or null
when no page names one. An owner is only returned when
the cited page names them; `email_status` is `published` when an address on the
site matches the owner's name, otherwise `not_found`.

10 credits from a `url`, 20 from a `place_id` (1 when the listing has no
readable website); a site that cannot be reached is free. Each call reads
several pages live, so it takes 10-45 seconds; a `place_id` call can pass 60
seconds, so raise the client's tool-call timeout if it cancels at 60.

### [Google Search API](https://scavio.dev/docs/search-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_google` | Web search (v2) with organic results, ads, and AI Overview; `web_only` + `location` for organic rankings as seen from a city (local rank tracking) |
| `google_custom_search` | Google results in the Custom Search JSON API format (`items[]`, `searchInformation`, `queries.nextPage`) for code ported from CSE |
| `google_ai_mode` | AI Mode conversational answer with cited sources |
| `google_maps_search` | Search Google Maps for local businesses |
| `google_maps_place` | Place details: address, phone, hours, rating |
| `google_maps_reviews` | Reviews for a place with pagination |
| `google_shopping` | Product listings with price, store, and rating |
| `google_shopping_product` | Product detail and sellers |
| `google_shopping_stores` | More sellers for a product (pagination) |
| `google_flights` | Flight itineraries with prices and stops |
| `google_hotels` | Hotel search with prices and ratings |
| `google_hotels_detail` | Hotel property details |
| `google_news` | News results by query, topic, story, or publication |
| `google_trends` | Interest-over-time and related queries |
| `google_trending` | Trending searches |

### [ChatGPT and Gemini](https://scavio.dev/docs/chatgpt-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `chatgpt_prompt` | Ask ChatGPT a prompt: the full Markdown answer, every cited page (title, publisher, date), the web searches it ran and the products it recommended |
| `gemini_prompt` | Ask Google Gemini a prompt: the full Markdown answer, the URLs it cites and the products it recommended |

For AI visibility and brand monitoring: ask what a buyer would ask ("best CRM for small
agencies") and see whether a brand is recommended, which competitors are, and which pages
the answer cites. Both tools return the same shape (`answer.markdown`, `sources[]`,
`search_queries[]`, `shopping[]`), so comparing assistants needs one parser. Every call is a
fresh answer and takes 10-40 seconds. ChatGPT costs 2 credits and Gemini 5 credits per answered
prompt; failed prompts are free.
Opt-in: add `chatgpt` and `gemini` to `SCAVIO_PLATFORMS` (e.g. `default,chatgpt,gemini`).
Docs: [ChatGPT](https://scavio.dev/docs/chatgpt-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme),
[Gemini](https://scavio.dev/docs/gemini-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

### [YouTube Data API](https://scavio.dev/docs/youtube-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_youtube` | Search videos, channels, and playlists |
| `search_youtube_shorts` | Search short-form videos |
| `youtube_search_suggestions` | Get search autocomplete suggestions |
| `get_youtube_video` | Get full video details, chapters, and captions |
| `get_youtube_metadata` | Deprecated alias of `get_youtube_video` |
| `get_youtube_comments` | Get comments on a video with pagination |
| `get_youtube_comment_replies` | Get replies to a specific comment |
| `get_youtube_transcript` | Get a video transcript as plain text or SRT |
| `get_youtube_related` | Get videos related to a video |
| `search_youtube_channels` | Search channels by keyword |
| `get_youtube_channel` | Get channel profile by ID, handle, or URL |
| `get_youtube_channel_videos` | List a channel's videos |
| `get_youtube_channel_shorts` | List a channel's Shorts |
| `get_youtube_channel_community` | List a channel's community posts |
| `resolve_youtube_channel` | Resolve a handle or URL to a channel ID |
| `get_youtube_streams` | Get direct media stream URLs for a video |
| `get_youtube_community_post` | Get one community post: text, author, likes, images, comments cursor |
| `get_youtube_community_post_comments` | Get comments on a community post with pagination |

Credit cost varies: `get_youtube_transcript` costs 5, `get_youtube_streams` 3,
`search_youtube` and `search_youtube_shorts` 2, and every other YouTube tool 1.
`get_youtube_related` accepts a cursor but never returns one, so treat it as a
single page.

### [Amazon Product API](https://scavio.dev/docs/amazon-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_amazon` | Search product listings across 22 marketplaces (no sort option) |
| `get_amazon_product` | Get full product details by ASIN |
| `get_amazon_offers` | List every seller offering an ASIN, with buy-box winner |
| `get_amazon_options` | List the supported marketplaces and their country codes (free) |

### [Walmart API](https://scavio.dev/docs/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_walmart` | Search product listings with price and delivery filters |
| `get_walmart_product` | Get full product details by product ID |
| `get_walmart_reviews` | Customer reviews with ratings, text, author, date and the rating breakdown |
| `get_walmart_category` | Products within a category, same product shape as search |
| `get_walmart_offers` | The buy-box offer for a product: price, seller, condition, buy-box flag |
| `get_walmart_seller` | Marketplace seller storefront: name, rating, Pro Seller badge, business details |
| `get_walmart_seller_products` | A seller's catalogue; `total_count` is the real size |
| `get_walmart_stores` | Stores near a US ZIP or Canadian postal code, nearest first, with `store_id`, address, distance and hours |

Walmart is priced by the request body, not at a flat rate: `com` (US, default)
and `ca` cost 1 credit, `com.mx` costs 2. Only `search_walmart` and
`get_walmart_category` accept every `domain`.

Store targeting: pass `delivery_zip` and `store_id` together on `search_walmart`
or `get_walmart_product` to get one store's assortment and availability. Take the
`store_id` from `get_walmart_stores` on the same domain (walmart.com or
walmart.ca). A store-targeted call costs 2 credits, takes 10-60 seconds, and
echoes the store it used in `data.location`. `get_walmart_product` accepts
`domain: "ca"` only together with a store pair.

Two shapes to plan for. `get_walmart_offers` returns the buy-box winner only —
Walmart server-renders just that one offer, so expect a single row even when
`total_offer_count` is higher. And `get_walmart_seller_products` is capped at
roughly the first 40 items with no page or cursor parameter; read `total_count`
to know you are looking at a slice. Both seller tools need the NUMERIC
`seller_catalog_id` from a product, search or offers response — the GUID-form
`seller_id` in those same responses 404s.

### [TikTok API](https://scavio.dev/docs/tiktok-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `get_tiktok_profile` | Get user profile (bio, follower/following counts, likes) |
| `get_tiktok_user_posts` | List a user's videos with stats |
| `get_tiktok_video` | Get detailed info for a single video |
| `get_tiktok_video_comments` | Get comments on a video |
| `get_tiktok_comment_replies` | Get replies to a specific comment |
| `search_tiktok_videos` | Search videos by keyword |
| `search_tiktok_users` | Search users by keyword |
| `get_tiktok_hashtag` | Get hashtag details and stats |
| `get_tiktok_hashtag_videos` | List videos for a hashtag |
| `get_tiktok_user_followers` | Get a user's follower list |
| `get_tiktok_user_followings` | Get a user's following list |
| `get_tiktok_trending_searches` | Search terms trending now (about 90, no region filter) |
| `get_tiktok_trending_videos` | A sample of trending videos (about 6 per call) |
| `get_tiktok_search_suggestions` | Search autocomplete suggestions for a keyword |
| `get_tiktok_music` | Get a sound: artist, album, duration, videos using it, chart rank |
| `get_tiktok_music_videos` | List videos that use a sound (about 14 per page) |
| `search_tiktok_music` | Search sounds by keyword |
| `get_tiktok_music_chart` | Top 50 or Viral 50 sound chart (global) |
| `get_tiktok_user_similar` | Creators similar to a user (about 30 per page) |
| `get_tiktok_user_playlists` | List a user's playlists (series) |
| `get_tiktok_playlist_videos` | List the videos in a playlist |
| `get_tiktok_user_live` | Is a user live now: room status, title, viewers |
| `get_tiktok_user_region` | The region an account is registered in, plus sec_user_id |

Every TikTok tool costs 1 credit. The trending, sound, playlist, similar-creator, live
and region tools return TikTok's own payload shape, trimmed for context: large numeric
ids can lose precision as JSON numbers, so use the string forms (`id_str`, `sec_uid`,
`sec_user_id`). `get_tiktok_trending_videos` returns about 6 videos per call whatever
`count` says, and `get_tiktok_music_videos` ignores `count` (about 14 per page). Search
suggestions can be empty for long-tail keywords and still bill. An unknown username is
a billed 404 on `get_tiktok_user_live` and an unbilled 404 on `get_tiktok_user_region`.

### [Instagram API](https://scavio.dev/docs/instagram-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `get_instagram_profile` | Get user profile (bio, follower/following/post counts) |
| `get_instagram_user_posts` | List a user's posts with pagination |
| `get_instagram_user_reels` | List a user's Reels with pagination |
| `get_instagram_user_tagged` | List posts a user is tagged in |
| `get_instagram_user_stories` | Get a user's active stories |
| `get_instagram_post` | Get a single post by url, media_id, or shortcode |
| `get_instagram_post_comments` | Get comments on a post |
| `get_instagram_comment_replies` | Get replies to a specific comment |
| `search_instagram_users` | Search users by keyword |
| `search_instagram_hashtags` | Search hashtags by keyword |
| `get_instagram_user_followers` | Get a user's follower list |
| `get_instagram_user_followings` | Get a user's following list |
| `get_instagram_user_highlights` | List a user's story highlights (id, title, cover, item count) |
| `get_instagram_highlight_stories` | Get every story in one highlight, with media URLs |
| `search_instagram_reels` | Search Reels by keyword with pagination |
| `search_instagram_music` | Search audio tracks by song or artist |
| `get_instagram_music_posts` | List the Reels that use an audio track, plus its total reel count |
| `search_instagram_locations` | Search places by name (id, address, coordinates) |
| `get_instagram_user_similar` | Get accounts similar to a creator |
| `get_instagram_post_likers` | Get accounts that liked a post, plus its total like count |

Instagram is priced per endpoint: `get_instagram_profile`, `get_instagram_user_reels`,
`get_instagram_user_tagged` and `get_instagram_music_posts` cost 1 credit (reels and
tagged cost 2 the first time a username is looked up), and the other tools cost 2.
`search_instagram_users` and `search_instagram_hashtags` cost 8 when you pass a
`cursor` for the next page. Any request can cost up to 10 when it needs extra work;
`credits_used` in the response is always the exact charge.

### [Reddit API](https://scavio.dev/docs/reddit-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_reddit` | Search Reddit posts by query, relevance order, cursor pagination |
| `get_reddit_post` | Get a single post by URL or id (no comments; see below) |
| `get_reddit_search_suggestions` | Get search autocomplete suggestions |
| `get_reddit_post_comments` | Get a post's top-level comments with pagination |
| `get_reddit_comment_replies` | Get replies to a specific comment |
| `get_reddit_subreddit` | Get subreddit metadata and subscriber count |
| `get_reddit_subreddit_posts` | List a subreddit's post feed |
| `get_reddit_user` | Get a redditor's profile |
| `get_reddit_user_posts` | List a redditor's submitted posts |
| `get_reddit_user_comments` | List a redditor's comments |
| `get_reddit_popular` | Get the site-wide popular feed |
| `get_reddit_trending` | Get current trending search queries |
| `search_reddit_comments` | Search comments by keyword, with the post and subreddit each was left on |
| `search_reddit_subreddits` | Find subreddits by keyword, with subscriber counts |

Every Reddit tool costs 1 credit. Two things to know: `search_reddit` takes a query
and a cursor only - there is no sort or post-type filter, results come back in
relevance order (`search_reddit_comments` does sort: relevance, hot, top or new) - and `get_reddit_post` returns a flat post object with no comments,
so call `get_reddit_post_comments` with the post id for those. Reddit is the slowest
platform here, typically 5-15 seconds per call.

### [X API](https://scavio.dev/docs/x-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_x` | Search tweets and people by keyword |
| `get_tweet` | Get full details for a single tweet |
| `get_tweet_comments` | Get replies to a tweet (ranked or chronological) |
| `get_tweet_retweeters` | List users who retweeted a tweet |
| `get_x_user` | Get a user's profile by handle |
| `get_x_user_tweets` | List a user's tweets |
| `get_x_user_replies` | List a user's tweets and replies |
| `get_x_user_media` | List a user's media tweets |
| `get_x_user_followers` | List a user's followers |
| `get_x_user_followings` | List accounts a user follows |
| `get_x_trending` | Get trending topics for a country |
| `search_x_communities` | Find X Communities by keyword, with member counts |
| `get_x_community` | Get a Community's description, member count, topic and rules |
| `get_x_community_tweets` | List a Community's posts by relevance or recency |

`get_x_user_tweets`, `get_x_user_replies` and `get_x_user_media` return a
`next_cursor` but no `has_more`, so page until the cursor is absent or the timeline
comes back empty.

### [LinkedIn API](https://scavio.dev/docs/linkedin-person?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `get_linkedin_person` | Get a member's full profile, experience and education |
| `get_linkedin_person_about` | Get a member's about/overview sections |
| `get_linkedin_person_posts` | List a member's recent posts (up to 50) |
| `get_linkedin_company` | Get a company's profile, locations and related companies |
| `get_linkedin_company_posts` | List a company's recent posts (up to 50) |
| `search_linkedin_jobs` | Search for jobs by keyword and location |
| `get_linkedin_job` | Get full details for a job listing |
| `get_linkedin_post` | Get full details for a single post |
| `get_linkedin_post_comments` | Get comments on a post, 10 per page |

All take a vanity handle, slug or id, or a full LinkedIn URL. Credit cost varies:
`get_linkedin_person`, `get_linkedin_person_about`, `get_linkedin_company` and
`get_linkedin_post` cost 1; `get_linkedin_person_posts`,
`get_linkedin_company_posts`, `search_linkedin_jobs` and
`get_linkedin_post_comments` cost 10 per page; `get_linkedin_job` costs 30.

Member contact info, the company employee directory, per-company job listings,
people search and post search are no longer available, so those five tools were
removed. `get_linkedin_company` still returns a
small sample of featured employees, and `search_linkedin_jobs` with a company
name substitutes for per-company listings.

### [TikTok Shop API](https://scavio.dev/docs/tiktok-shop-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_tiktok_shop` | Search TikTok Shop products by keyword (US catalog, exact prices) |
| `get_tiktok_shop_search_suggestions` | Keyword autocomplete for a partial query, 8 regions |
| `get_tiktok_shop_product` | Full product detail (no price; ~44% of search IDs resolve) |
| `get_tiktok_shop_product_reviews` | Paginated product reviews, up to 200 per call |
| `get_tiktok_shop_categories` | The global category tree (28 top-level, 240 nodes) |
| `get_tiktok_shop_category_products` | List products under a category ID, with exact prices |
| `get_tiktok_shop_shop_products` | List a seller's catalog, 30 per page, with exact prices |
| `resolve_tiktok_shop_url` | Resolve a TikTok Shop URL or share link to a product/shop ID |

Two things to know: `get_tiktok_shop_product` does not return a price (TikTok masks it on the
product page) - exact prices come from `search_tiktok_shop`,
`get_tiktok_shop_shop_products` and `get_tiktok_shop_category_products`. And only about 44% of the
product IDs returned by search resolve on `get_tiktok_shop_product` (11 of 25 measured), because
TikTok Shop has no detail data for the rest. That miss is signalled by the HTTP 404 status, not by any
field in the response body, and it is a normal outcome rather than an error to retry - the tool
returns it as a plain result with `status: "no_detail_data"` so agents skip the product instead of
looping. For an id that will not resolve, `get_tiktok_shop_product_reviews` is often still usable:
across 8 measured ids that failed on detail, 8 of 8 returned HTTP 200 on reviews and 7 of 8 returned
at least one review.

### [Threads](https://scavio.dev/docs/threads-profile?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `get_threads_profile` | Profile details for a Threads user, by `user_id` or `username` |
| `get_threads_user_posts` | A user's Threads posts, cursor-paginated |
| `get_threads_user_replies` | A user's replies, cursor-paginated |
| `get_threads_post` | A single post by id or threads.net URL |
| `get_threads_post_comments` | Replies to a post, cursor-paginated |
| `search_threads_users` | Profiles matching a name or handle - the only search Threads exposes |

Threads is priced by how you address a user, not per endpoint: 2 credits when you pass `user_id`, 4 credits when you pass `username`. Only `get_threads_profile`, `get_threads_user_posts` and `get_threads_user_replies` accept a username; the other three are always 2. Prefer `user_id` - a handle costs a second lookup.

### [Kuaishou (China)](https://scavio.dev/docs/kuaishou-profile?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `get_kuaishou_profile` | Profile details for a Kuaishou user (10 credits) |
| `get_kuaishou_user_posts` | A user's top posts, cursor-paginated |
| `get_kuaishou_user_live` | A user's current live-stream status |
| `resolve_kuaishou_user` | Turn a Kuaishou share link into a user id |
| `get_kuaishou_video` | A single video by photo id or URL (2 credits) |
| `get_kuaishou_video_comments` | Comments on a video, cursor-paginated |
| `get_kuaishou_comment_replies` | Replies under a root comment |
| `get_kuaishou_videos_batch` | Up to 20 videos in one call (40 credits) |
| `search_kuaishou` | Mixed-result search across Kuaishou (10 credits) |
| `search_kuaishou_videos` | Video search results (10 credits) |
| `search_kuaishou_users` | User search results (10 credits) |
| `search_kuaishou_live` | Live-stream search results (10 credits) |
| `get_kuaishou_tag_feed` | Posts under a hashtag, cursor-paginated |
| `get_kuaishou_trending` | Hot, live, shopping, brand and music leaderboards |

Kuaishou is priced per endpoint, not at a flat rate: `get_kuaishou_profile` and all four search tools cost 10, `get_kuaishou_video` 2, `get_kuaishou_videos_batch` 40, and every other tool 1.

### [eBay](https://scavio.dev/docs/ebay-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_ebay` | Search live or SOLD listings: price, condition, bids, shipping, seller feedback |
| `get_ebay_product` | One listing in full: price, condition, images, item specifics, shipping, returns, auction state |
| `get_ebay_seller` | Seller profile card: store name, feedback score, items sold, followers, location |

1 credit per call. `get_ebay_seller` is a profile card and cannot enumerate a catalogue - list a seller's inventory with `search_ebay` and `seller` set and no keyword. `sold: true` searches completed listings that actually sold; on that view eBay publishes no headline count, so `total_results` is null. `per_page` accepts only 60, 120 or 240.

### [Target](https://scavio.dev/docs/target-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_target_products` | Search Target.com: prices, ratings, badges and promotions |
| `get_target_category` | Products in a category, same shape as search plus the breadcrumb |
| `get_target_product` | Product details by TCIN: price, images, specifications, variants, fulfillment |
| `get_target_reviews` | Reviews with the rating breakdown, per-attribute averages and guest photos |
| `get_target_availability` | In-store stock at every Target near a ZIP: units, in-store, pickup, curbside and ship-to-store status, distance, address, hours |

1 credit per call. `get_target_product`, `get_target_reviews` and `get_target_availability` are single-shot; search and category page with `page` + `count`. `store_id` on search, category, product and reviews sets the store for prices only; `get_target_availability` is the store-stock tool.

### [Home Depot](https://scavio.dev/docs/home-depot-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_home_depot` | Search Home Depot: price, brand and model, ratings, per-store pickup/delivery; `country: "ca"` for Home Depot Canada |
| `get_home_depot_product` | Full item detail: pricing, media, spec table, dimensions, documents, return policy; for Canada a store's price next to the online price |
| `get_home_depot_reviews` | Full review bodies, rating distribution, per-attribute ratings, seller responses; for Canada the first 8 reviews and the first page of questions |
| `get_home_depot_stores` | Stores near a ZIP, city or address (US) or a postal code, city or latitude / longitude (`country: "ca"`): store number, address, coordinates, hours, services |
| `get_home_depot_availability` | One item at a store: price, promotions and pickup stock at `store_id`, delivery to a `zip` (US); for Canada the store's price, exact units, aisle and bay (`store_id` required) |
| `get_home_depot_shipping` | US only: every delivery option for an item to a ZIP for a quantity: charge, dates, delivery level, states it will not ship to |
| `get_home_depot_category` | Home Depot Canada only: one category or collection page by `category_id`, priced at a store |
| `get_home_depot_categories` | Home Depot Canada only: the department tree and the current event and collection pages |
| `get_home_depot_stock` | Home Depot Canada only: exact units of one item at every store near a postal code or city, no prices |
| `get_home_depot_store` | Home Depot Canada only: one store with address, services, 7 dated days of hours and nearby stores |
| `get_home_depot_suggestions` | Home Depot Canada only: search-box keyword suggestions |

US (homedepot.com, the default): 2 credits per call, `get_home_depot_shipping` 4. Search page size is fixed at 12 and cannot be changed. Reviews return 30 per page; `total_pages` is the last page that exists and asking past it is a 404.

**Home Depot Canada** (homedepot.ca, The Home Depot's Canadian store: 182 stores in 10 provinces): pass `country: "ca"` to `search_home_depot`, `get_home_depot_product`, `get_home_depot_reviews`, `get_home_depot_stores` and `get_home_depot_availability`; the five Canada-only tools need no country. `get_home_depot_shipping` with `country: "ca"` is a 400, not charged (no delivery quotes for Canada). 1 credit per call on every Canada tool. Prices in CAD as Home Depot Canada gives them; `language: "fr"` returns French names and links (same ids and prices). Search and category take `store_id` (default store 7274; `data.store` says which), 1-40 products a page, the sorts `best_match`, `price_low`, `price_high` and `top_rated` (`top_sellers` is a 400 for Canada), facet `filters` (from `include_facets`) and `deals` (`special_buy`, `new_lower_price`, `savings`). Every product carries `store_units` (exact units at that store) and aisle / bay.

Prices can differ by store (lumber does; the tools, Christmas tree and fridge sampled had one price everywhere), and the online price can differ from a store's price. `get_home_depot_product` with `store_id` returns `price` as that store's price (`price_source: "store"`) and `online_price` beside it; `get_home_depot_availability` with `country: "ca"` returns one store's price, exact units, aisle and bay. Captured 2026-11-25: the 2-inch x 4-inch x 8-ft SPF Premium Stud (1000112108) at store 7128 (ST-HENRI, QC) at 4.14 CAD with 2858 units in aisle 19, bay 001, and an `online_price` of 6.58. When Home Depot Canada has no store record for an item that exists, `get_home_depot_product` returns the online price with `store_price_returned: false`, and `get_home_depot_availability` and `get_home_depot_stock` answer an unbilled 502.

Not available for Canada: UPC or barcodes (Home Depot Canada shows none), structured sale end dates (the price badge and Home Depot's promotion text only), reviews past the first 8 per language, delivery quotes, the flyer, cart or checkout, price history (poll and store the answers). Home Depot Canada has no public API. For the same item at other Canadian retailers use the [Canadian Tire](https://scavio.dev/canadiantire-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Walmart](https://scavio.dev/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (`domain: "ca"`) and Amazon (`country: "ca"`) tools; match on brand and model. See the [Home Depot API page](https://scavio.dev/homedepot-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

### [Costco](https://scavio.dev/docs/costco-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_costco` | Search by keyword or item number: online and original price, rating, member-only and stock flags, promotions, facets |
| `get_costco_category` | Products in a category, same filters and shape as search |
| `get_costco_categories` | Department list, or the full subcategory tree under one department |
| `get_costco_product` | Full detail for up to 20 items: description, features, specs, variants, purchase limits, delivery fee, promotion dates |
| `get_costco_prices` | Online vs in-warehouse price at up to 10 warehouses: discount, final price, promotion dates, per-member limits, price code |
| `get_costco_availability` | In-warehouse stock status for one item at up to 10 warehouses, plus pickup and same-day delivery |
| `get_costco_reviews` | Reviews with rating distribution and recommend count; sort, star filter, up to 100 per page |
| `get_costco_warehouses` | Warehouses near a US zip or coordinates: `warehouse_id`, address, hours, departments, services, gas prices |
| `get_costco_gas_prices` | Regular, premium and diesel prices at Costco gas stations near a location or at given warehouses |
| `get_costco_coupons` | The current member coupon book: item number, amount off, final price, scope, limits, valid dates |
| `get_costco_deals` | Deal feeds: new, while supplies last, treasure hunt, member favorites, online only, on sale |
| `get_costco_clearance` | Clearance and manager-markdown items at one warehouse, decoded from the shelf price ending |
| `get_costco_search_suggestions` | Search suggestions for a partial query, plus matching warehouses |

1 credit per call, except the multi-warehouse tools: `get_costco_prices` makes one
lookup per two locations (online counts as one) and `get_costco_availability` one per
warehouse, billed 1 credit per 5 lookups, so 10 warehouses cost 2 credits.
`get_costco_warehouses` and `get_costco_gas_prices` cost 2 for `country: "ca"`; gas by
`warehouse_ids` is 1 credit per 5 warehouses (2 per warehouse on ca).

`search_costco`, `get_costco_category` and `get_costco_deals` take `warehouse_id` to add
that warehouse's in-store price, stock and price code to every result. Get the id from
`get_costco_warehouses`. `country` is `us` (default) or `ca` everywhere except
`get_costco_coupons` (US only); `search_costco`, `get_costco_product` and
`get_costco_warehouses` also accept `uk`, `au`, `mx`, `jp`, `kr` and `tw` for keyword,
sort and paging only. Price codes in `get_costco_clearance` are the member-community
decode (.97 clearance, .00/.88 manager markdown; .49/.79/.89 special buy on request),
not something Costco publishes, and only items Costco lists online are covered.
`get_costco_coupons` returns the first 50 offers of a ~200-offer book by default; pass
`limit` for more.

### HEB

| Tool | Description |
|------|-------------|
| `search_heb` | Search HEB grocery products: price (cents), sale status, unit price, size, UPC, stock, EBT/SNAP, aisle location |
| `get_heb_product` | Full detail: nutrition facts, ingredients, images, similar products, coupons, EBT/SNAP, breadcrumbs |
| `get_heb_stores` | Store locator by ZIP or city: address, hours, pharmacy, fulfillment channels, distance |

2 credits per call. HEB is a Texas-based grocery chain. Pass `product_url` (from
`search_heb`) or `slug` + `product_id` for product detail. Pass `store_id` (the
`store_number` from `get_heb_stores`, e.g. `"441"`) to `search_heb` or
`get_heb_product` for that store's prices, stock, aisle location and assortment;
the store used is echoed in `data.store`, and `product_id` alone is enough with a
`store_id`. US only.

HEB Mexico: pass `country: "mx"` to `search_heb` and `get_heb_product` for
heb.com.mx. Prices are Mexican peso cents (`10000` = MX$100.00) for HEB Mexico's
default store, and every row adds `stock` (units on hand), `promotions` (price
cuts, multi-buys, free gifts, with end dates), `is_sponsored` and the EAN barcode
in `upc`. Search pages are 20 rows with `total_pages`. `get_heb_stores` is US only.

### Spec's

| Tool | Description |
|------|-------------|
| `search_specs` | Search Spec's (Texas liquor): online price (cents), case price, promo and Keyclub flags, stock, SKU, UPC, slug |
| `get_specs_product` | Every store's price and stock for one product in `store_prices` (about 200 stores), plus the online price and details |
| `get_specs_stores` | Stores in a Texas region: store_id, address, phone, coordinates, hours |

5 credits per call. Pass the `slug` from `search_specs` to `get_specs_product`;
add `store_id` (from `get_specs_stores`, e.g. `"169"`) to put that store's price
at the top.

### Lowe's

| Tool | Description |
|------|-------------|
| `search_lowes` | Search Lowe's at one store by keyword or category: that store's price, was-price and savings, stock quantity, pickup/delivery/parcel availability, rating; `on_sale` for the store's deals |
| `get_lowes_product` | One item at one store: price, on-hand stock and lead times, stock at nearby stores, aisle and bay, specifications, UPC, dimensions |
| `get_lowes_stores` | Stores near a ZIP: store_id, address, phone, coordinates, distance, hours, features |
| `get_lowes_reviews` | Review bodies, 10 per page: rating, title, text, recommended, helpful votes, verified flag, photos, brand replies, star counts |

2 credits per call; `get_lowes_reviews` is 1. Prices and stock are per store, so
`store_id` and that store's own `zip` (both from `get_lowes_stores`, e.g. `"0595"`
and `"28117"`) are required on search and product. Deals are `search_lowes` with
`on_sale: true`; there is no clearance tool.

### [Ace Hardware](https://scavio.dev/docs/acehardware-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Ace Hardware API for Ace Hardware (acehardware.com, the US hardware cooperative): Ace Hardware prices by store (an item's price at the Ace store you pick, named in `priced_for`), exact units on hand at that store and its 25 nearest, and that store's weekly ad; plus search, categories, brands, deals with promo codes, store details and Ace's paint colours. Pair it with [Home Depot](https://scavio.dev/homedepot-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [Lowe's](https://scavio.dev/lowes-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for a local hardware price check on the same item (brand + model).

| Tool | Description |
|------|-------------|
| `search_acehardware` | Search by keywords, an Ace item number or a UPC: 15-200 a page, with total, price, list price, sale price, msrp, `price_list`, rating, review count, Special Offers, fulfilment, facets; sorts relevance, price, name, newest, oldest; `brand`, `offer` (sale, ace_rewards, buy_and_get, buy_more_save), `on_sale` and facet filters; `redirected_to` when Ace sends the search to a category or product |
| `get_acehardware_product` | One product by item number or link, priced for an Ace store with `store`: `priced_for` {store_id, price_list}, price, list and sale price, msrp, promotions, UPC, specifications, measurements, images, assembly options, fulfilment, rating and review count |
| `get_acehardware_store_stock` | Exact units on hand (`units_in_stock`, `soft_units`, shelf `location_code`, regional distribution centre units) for one product at 1-25 stores, or at one store and its 25 nearest (`nearby`) |
| `get_acehardware_store` | One store by store number: address, phone, coordinates, hours, services, departments, brands, programs, features (pickup, curbside, delivery, assembly, propane, Benjamin Moore, Ace Rewards), price zones, nearest stores, same-owner stores |
| `get_acehardware_stores` | The 25 stores Ace lists as nearest an Ace store; with `details` each one's name, address, phone, coordinates, `distance_miles`, hours, services |
| `get_acehardware_category` | One category's products by link, path or id, with the list sorts, filters and paging |
| `get_acehardware_categories` | Ace's departments and their categories (two levels), or one department's |
| `get_acehardware_brand` | One brand's products by slug or link, or without one Ace's brand index (about 5,700 brands, filtered by `query`) |
| `get_acehardware_deals` | Ace's sales and specials list plus its site-wide promotions with codes and start / end dates |
| `get_acehardware_weekly_ad` | One store's weekly ad, page by page: title, `valid_from`, `valid_to`, items with price text and the Ace item numbers each tile names |
| `get_acehardware_paint_colors` | Ace's paint colours (about 5,300: Benjamin Moore, Clark+Kensington, Magnolia Home) with hex, RGB, families and collections, filtered by name or code, family, brand or collection |

Platform key `acehardware`. 1 credit per call, with these exceptions:
`search_acehardware` 2 (3 when Ace redirects the search to a category and the
list options are applied to it); `get_acehardware_product` 2 (with or without
`store`); `get_acehardware_store_stock` 1 per 5 stores (1 store 1, 5 stores 1,
25 stores 5; `nearby` 6); `get_acehardware_stores` with `details` 1 lookup per
store (25 stores 6). An occasional call costs 2 instead of 1; `credits_used` in
the response is what was charged. US only (acehardware.com, USD), so no tool
takes `country`.

Ace stores are independently owned and operated, and the same item can be
priced differently at different stores (Ace's terms: pricing varies by
location). `get_acehardware_product` with `store` (a 5-digit Ace store number,
sent as a string to keep leading zeros, e.g. `"03085"`) returns the price as
Ace shows it for that store, with `priced_for` {store_id, price_list}; without
a store, `priced_for` names the price list Ace used (`CORP` is Ace's online
price). `msrp` is reported as Ace gives it and can be below a store's price.
Listing prices (`search_acehardware`, category, brand and deals) are the price
Ace shows in its listing (`price_list` per item), not a store's price. Store
stock is exact units as Ace reports them; Ace answers 0 for a store number or
product it does not know, exactly as for one out of stock. There is no store
search by ZIP or city: every store tool takes an Ace store number, shown in
each Ace store page link (acehardware.com/store-details/<number>), and
`get_acehardware_stores` lists the 25 nearest to one. Not available: review or
Q&A text (rating and count only), search suggestions, ZIP or city store
search, pickup or delivery dates, price history (poll and store the answers),
Ace Rewards member prices, Ace Handyman, rentals, Ace-licensed stores outside
the US, checkout. Failed calls and refused inputs are not charged; a not-found
(an unknown product, category, brand or store) is charged.

### [Tractor Supply](https://scavio.dev/docs/tractorsupply-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Tractor Supply API for Tractor Supply (tractorsupply.com, the US rural lifestyle retailer): an item's price at the store you pick (named in `priced_for` with the store's price zone), one item's price at up to 25 stores in one call, exact units on hand per store with stock in transit and its pickup date, and pickup and delivery options for a ZIP; plus search, categories, brands, deals, promotions with dates and store details. Pair it with [Ace Hardware](https://scavio.dev/acehardware-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Walmart](https://scavio.dev/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [Chewy](https://scavio.dev/chewy-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for a price check on the same item.

| Tool | Description |
|------|-------------|
| `search_tractorsupply` | Search by keywords, an item number or a UPC, priced for one store (`store` or `zip`): 24-200 a page, with total, price, was price, unit price, rating, review count, availability, pickup and delivery flags, facets; sorts popular, rating, name, price, recent, new arrivals; `brand`, `on_sale`, `new`, `pickup`, `rating` and facet filters; `redirected_to` when Tractor Supply sends the search to a category |
| `get_tractorsupply_product` | One product or size by item number or link, priced for one store: `priced_for` {store_id, zone, city, state, from, zip}, price, was price, pickup price, `mapp`, UPC, specifications, variants, fulfilment, promotions, rating and review count |
| `get_tractorsupply_store_prices` | One item's price at up to 25 stores, or at the stores nearest a ZIP: price, was price, pickup price and zone per store, plus `price_range` {min, max} |
| `get_tractorsupply_store_stock` | Exact units per store as Tractor Supply reports them, status, and in-transit units with their pickup date, at up to 25 stores or near a ZIP |
| `get_tractorsupply_fulfillment` | Pickup units and delivery options (standard, same day, ship to store) with dates and order cut-offs, for one item at one store and a ZIP |
| `get_tractorsupply_stores` | The stores nearest a US ZIP: address, phone, coordinates, distance, price zone, hours, services (propane, trailer rental, PetVet, pet wash, ...), dated store events |
| `get_tractorsupply_store` | One store by store number: address, phone, zone, hours, services, events |
| `get_tractorsupply_category` | One category's products by link, path, slug or id, priced for one store, with the list sorts, filters and paging |
| `get_tractorsupply_categories` | Tractor Supply's departments, or one department's categories (two levels) |
| `get_tractorsupply_brand` | One brand's products, priced for one store, optionally matching keywords |
| `get_tractorsupply_deals` | Products on sale (`type: sale`) or new arrivals (`type: new`), priced for one store |
| `get_tractorsupply_promotions` | The promotions Tractor Supply lists for one item, with start and end dates |

Platform key `tractorsupply`. 1 credit per call, with these exceptions:
`get_tractorsupply_product` 2 on the first call for a store not yet looked up;
`get_tractorsupply_store_prices` 1 per 5 lookups (each store's price, a store's
details when not yet known, the item: 25 new stores cost 11). `credits_used` in
the response is what was charged. US only (tractorsupply.com, USD), so no tool
takes `country`.

Tractor Supply prices by store, so search, product, category, brand and deals
need `store` (a Tractor Supply store number, e.g. `"1933"`) or `zip` (the
nearest store Tractor Supply lists for it is used); there is no default store.
Every price answer carries `priced_for` {store_id, zone, city, state, from,
zip}. Tractor Supply's terms note that prices may vary in different geographic
markets, and the same item can be priced differently at different stores: the
same 50 lb bag of Producer's Pride 16% Layer Pellets (item 2340147) was $14.49
at store 1933 Glendive MT (zone 81) and $20.19 at store 1923 Port Orchard WA
(zone 92). Some items carry a manufacturer's minimum advertised price (`mapp`)
and show one price everywhere. Item numbers are 7 digits (`items[].item_number`)
and are the input of product, store prices, store stock, fulfilment and
promotions. Store stock is units as Tractor Supply reports them, not a promise.
Not available: review or Q&A text (rating and count only), search suggestions,
the weekly ad, a clearance list, price history (poll and store the answers),
Neighbor's Club member prices, live chick availability, Petsense, checkout.
Failed calls and refused inputs are not charged; a not-found (an unknown item,
category, brand, store or a ZIP with no store) is charged.

### [Michaels](https://scavio.dev/docs/michaels-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Michaels API for Michaels (michaels.com, the US and Canada arts and crafts retailer): units of one SKU at the Michaels stores near a ZIP or postal code exactly as Michaels reports them, units of up to 30 SKUs at one store, a product with every colour and size, its price next to Michaels' own "Reg." label and its promotions with Michaels' own start and end dates; plus search, categories, brands, deals (Sale, New, Clearance, Great Buy), stores and search suggestions, for www.michaels.com (USD) and canada.michaels.com (CAD, English or French). Pair it with [Walmart](https://scavio.dev/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Amazon](https://scavio.dev/amazon-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [Etsy](https://scavio.dev/etsy-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for a price check on the same item.

| Tool | Description |
|------|-------------|
| `search_michaels` | Search by keywords, an item number or a UPC: up to 100 a page, with total, price, was price, `was_price_text` (Michaels' own label), unit price, rating, review count, seller type, pickup and delivery flags, promotions, facets; sorts best match, best sellers, new arrivals, price, rating; brand, price, rating, store pickup, sale, new, clearance, great buy, seller and facet filters |
| `get_michaels_product` | One product by SKU or link: variants (colours, sizes) with price, sale price and UPC, promotions with start and end, online stock (not store stock), Pro-pack unit price, specifications, rating and review count |
| `get_michaels_store_stock` | Units of one SKU at the stores near a US ZIP or Canadian postal code, as Michaels reports them, with pickup message, distance, hours and a `virtual` flag for pop-up stores |
| `get_michaels_store_inventory` | Units of up to 30 SKUs at one store |
| `get_michaels_stores` | The stores near a US ZIP, a city or a point: address, phone, coordinates, distance, hours, services (custom framing, curbside pickup, same-day delivery, ...) |
| `get_michaels_store` | One store by store number (US or Canada): address, phone, hours, services, opening and closing dates |
| `get_michaels_category` | One category's products by `/shop/` link or path or by code path, with the list sorts, filters and paging |
| `get_michaels_categories` | Michaels' departments, or one category's subcategories, with the code paths the list tools take |
| `get_michaels_brand` | One brand's products, optionally matching keywords or within a category |
| `get_michaels_deals` | Michaels' Sale, New, Clearance or Great Buy (US) products matching keywords or within a category |
| `get_michaels_suggestions` | The search suggestions Michaels shows as you type, with suggested categories and brands |

Platform key `michaels`. 2 credits per call; `get_michaels_category` and
`get_michaels_deals` cost 4 when the category is a `/shop/` link or path (one
more call finds its code path; a code path costs 2). `credits_used` in the
response is what was charged.

`country` is `us` (default, www.michaels.com, USD) or `ca`
(canada.michaels.com, CAD); `language` is `en` (default) or `fr` (with `ca`
only). `get_michaels_stores`, `get_michaels_categories` and
`get_michaels_suggestions` are US only; with `ca`, list tools take a category
code path (search facets list them), not a `/shop/` path. Prices are national
per country: the store does not change them, it matters for stock. The same
Cricut Explore 5 bundle (SKU 10816737) was $199.00 next to Michaels' "Reg.$249.00"
on www.michaels.com and CAD 269.99 next to "Reg.$349.99" on canada.michaels.com.
Store stock is units as Michaels reports them, not a promise: Soft Classic Solid
Yarn by Loops & Threads (SKU 10228177) showed 85 units at store 1191 (New York,
Chelsea). `online_stock` on a product is Michaels' online stock, not a store's.
Search and the list tools mix Michaels items and Marketplace items
(`seller_type`); Marketplace items carry a seller id, no seller name. A UPC
search answers with the product group's lead SKU. Not available: review or Q&A
text (rating and count only), the weekly ad, coupons, classes and events, aisle
locations, Marketplace seller names, custom framing, price history (poll and
store the answers), checkout. Failed calls and refused inputs are not charged;
a not-found (an unknown product, category, brand or store) is charged.

### [Nike](https://scavio.dev/docs/nike-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Nike API for Nike (nike.com, including Jordan Brand): Nike's sale price next to its own full price and discount percent as Nike gives them, every size with its GTIN, and Nike's launch calendar with price, release start, method and a per-size level for each launch item; the same style code priced on 62 storefronts in 42 countries, each in its own currency. Plus search, listings, Jordan / ACG / SB, the Sale listing and review summaries. Nike has no public API for catalog, prices or launches. Pair it with [Foot Locker](https://scavio.dev/footlocker-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Dick's](https://scavio.dev/dicks-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Amazon](https://scavio.dev/amazon-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [eBay](https://scavio.dev/ebay-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for a price check on the same style code.

| Tool | Description |
|------|-------------|
| `search_nike` | Search by keywords or a style color: the first 24 product groups with price, full price, discount percent, promotions with dates, colorways, facets; sorts featured, newest, price high or low; one facet token narrows step by step |
| `get_nike_product` | One product by link or style color: every size with its GTIN and Nike's status (sizes, not stock levels), colorways with prices, launch dates, member product and Nike By You flags, features and details |
| `get_nike_category` | One listing by path token or link (men's shoes, running, a collection), sorted and filtered by up to 6 facet tokens |
| `get_nike_brand` | Jordan Brand, ACG or Nike SB products, sorted and filtered |
| `get_nike_deals` | Nike's Sale listing, optionally for one gender or one category, sorted and filtered (e.g. by discount band) |
| `get_nike_releases` | Nike's launch calendar (upcoming, feed or in stock): price, release start, method (LINE or DRAW as Nike labels it) and per-size level HIGH / MEDIUM / LOW / OOS with GTIN |
| `get_nike_release` | One launch by link, thread slug or style color, past launches too (back to 2022) |
| `get_nike_reviews` | One product's review summary: total, average rating, size and comfort ratings, Nike's own summary where Nike shows one, and the 3 newest reviews |

Platform key `nike`. 1 credit per call; `credits_used` in the response is what
was charged.

`country` is a two-letter storefront code (default `us`, www.nike.com; `cn` is
www.nike.com.cn) and `language` picks the storefront language where a country
has several (`ch`: de, en, fr, it; `be`: nl, de, en, fr; `ca`: en, fr; `us`:
en, es; `jp`: ja, en). `get_nike_releases` and `get_nike_release` are not
offered on `vn`, `cn` or `jp` in English (Nike's launch calendar lists no
launches there); `get_nike_reviews` is not offered on `cn`. Prices are per
storefront and differ between markets, also inside the euro zone: the same
Nike Dunk Low (style color DD1503-103) was $78.97 next to a $120 full price
(34%) on www.nike.com, £54.99 next to £109.99 (50%) on nike.com/gb, €59.99 next
to €119.99 (50%) on nike.com/fr and ¥17,050 on nike.com/jp. Search and the list
tools return Nike's first page only (24 product groups; total and total_pages
as Nike gives them). Product sizes carry a GTIN and Nike's status, not a stock
level; launch items carry a per-size level as Nike gives it, and before a
launch Nike can show LOW on every size. Read-only data: no entry or purchase.
Not available: store locator, in-store or pickup stock, stock levels for
regular products, review paging or Q&A, search suggestions, pages past the
first, member prices, gift cards, Nike Factory store prices, Converse,
checkout. Failed calls and refused inputs are not charged; a not-found (an
unknown product, listing or launch) is charged.

### [Staples](https://scavio.dev/docs/staples-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Staples API for Staples (staples.com, the US office supply retailer; Staples Canada at staples.ca): an ink cartridge's price next to Staples' own cost per page and the stated page yield, copy paper per ream, and the units of one item at the Staples stores near a ZIP exactly as Staples reports them; plus search, categories, On Promotion and Clearance deals, coupons with Staples' own end dates, stores, reviews with full paging, customer Q&A and trending searches. Staples has no public API for its catalog, prices or store stock (Staples Business Advantage connects contract buyers' purchasing systems). Pair it with [Amazon](https://scavio.dev/amazon-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Walmart](https://scavio.dev/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Target](https://scavio.dev/target-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [Best Buy](https://scavio.dev/bestbuy-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for a price check on the same item.

| Tool | Description |
|------|-------------|
| `search_staples` | Search by keywords, a model number or an item number: 40 a page to page 250, with total, price, was price, Staples' own price per unit (`$5.00/Ream`, `$0.10 Cost Per Page`), rating, delivery and pickup flags, facets; sorts best match, price low or high, top rated, newest; brand, facet, price, On Promotion and Clearance filters. Canada: Staples Canada's top matches in English or French |
| `get_staples_product` | One product by item number or link: price, was price, price per unit, pack size, page yield, sheets per ream, Staples' promotion texts with their expiry, coupon codes, specifications, rating breakdown, ream / carton variants, delivery dates for a ZIP and pickup units at a store. Canada: CAD price, barcode, variants |
| `get_staples_category` | One class listing by CL id or link, with the list sorts, filters and paging |
| `get_staples_categories` | Staples' departments, or one department's sub-departments and classes |
| `get_staples_deals` | Staples' On Promotion or Clearance products for keywords or a class |
| `get_staples_coupons` | The coupons on Staples' coupons page: code, headline, details, end date, channel |
| `get_staples_store_stock` | Units of one item at the stores near a US ZIP that have it for pickup, as Staples reports them, with the pickup text (Ready in 30 mins), distance and hours |
| `get_staples_stores` | The stores near a US ZIP or city: address, phone, coordinates, distance, this week's hours, services |
| `get_staples_store` | One store by store number |
| `get_staples_reviews` | One item's reviews, up to 100 a page, 6 sorts, star and photo filters, verified and incentivized flags, Staples' own review summary |
| `get_staples_questions` | One item's customer questions with their answers, 10 a page |
| `get_staples_trending` | The trending searches Staples shows in its search box |

Platform key `staples`. 1 credit per call; `credits_used` in the response is
what was charged.

`country` is `us` (default, www.staples.com, USD) or `ca` (www.staples.ca,
Staples Canada, CAD) on `search_staples` and `get_staples_product`; `language`
is `en` (default) or `fr` (with `ca` only). Every other tool is US only. Prices
are national: the ZIP changes delivery availability and dates, the store
changes pickup units, neither changes the price. The HP 64XL Black High Yield
cartridge (item 2724258, "Prints Up to 600 Pages") carried Staples' own "$0.10
Cost Per Page"; Hammermill Copy Plus (item 122374, 10 reams) was $49.99 at
"$5.00/Ream". Store stock lists only the stores that have the item: the same
HP 64XL showed 7 stores near ZIP 60540 with 63 units in all (12 at store 1633,
Naperville). An empty list means no nearby store has it or it is not offered
for store pickup. Staples returns a `threshold` value beside the units; it is
passed through as given. staples.com publishes no UPC (the model number is the
manufacturer part number); Staples Canada products carry a barcode. Canada
answers search with Staples Canada's top matches (about 5, no paging) and
offers product only. Not available: the weekly ad, search suggestions, print
and tech service prices, ink recycling rewards, Rewards member prices, price
match requests, Staples Business Advantage contract prices, price history
(poll and store the answers), checkout. Failed calls and refused inputs are not
charged; a not-found (an unknown item, class, department or store) is charged.

### Sam's Club

| Tool | Description |
|------|-------------|
| `search_sams_club` | Search Sam's Club: price, was price, savings, unit price, Instant Savings, rating, stock, fulfillment, aisle |
| `get_sams_club_product` | One item: online and club shelf price, Instant Savings, rating histogram, specifications, per-method stock and aisle; `club_id` for a specific club |
| `get_sams_club_clubs` | Clubs near a ZIP: club_id, address, coordinates, distance, phone, hours, services |
| `get_sams_club_savings` | Every Instant Savings item: offer amount, end date, purchase limit, channels |
| `get_sams_club_category` | Products in a category, same fields as search; clearance is category `1150109` |
| `get_sams_club_reviews` | Review bodies, 10 per page, with average rating and 1-5 star breakdown |

`get_sams_club_clubs` is 1 credit per call; every other Sam's Club tool is 2.
Search, savings and category use a nearby club chosen by
location (echoed in `club`); for one specific club, call `get_sams_club_product`
with a `club_id` from `get_sams_club_clubs`. `available_quantity` is capped at 8 by
the site, so 8 means 8 or more.

### [BJ's Wholesale Club](https://scavio.dev/docs/bjs-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

BJ's Wholesale Club API for BJ's Wholesale Club (bjs.com, the US warehouse club), US only, prices in USD: keyword search and category listings with the online price, sale price and its dates, the price of the club BJ's assigned to the visit, availability, fulfillment and EBT flags, coupons and bought-last-month counts; one product in full with every variant, regular price, savings, offer dates and fulfillment per item number; the category tree; customer reviews with BJ's own review summary and questions with answers; the guest coupon book; and the club directory by state. See the [BJ's Wholesale Club API page](https://scavio.dev/bjs-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_bjs` | Keyword search: up to 40 results with total, departments, related searches, facets and priced_for (the club BJ's assigned, or null) |
| `get_bjs_product` | One product by product id or link: online price, regular price, savings, offer dates, unit price, variants with GTIN, availability and fulfillment per item number |
| `get_bjs_category` | The products of one category (ids from `get_bjs_categories`): up to 40 results with total, subcategories and facets |
| `get_bjs_categories` | The full category tree (about 980 categories) or one category's subtree, with product counts |
| `get_bjs_reviews` | Customer reviews, 10 a page newest first, with summary, BJ's own AI review summary and questions with answers (no names) |
| `get_bjs_coupons` | The guest coupon book: manufacturer and BJ's coupons with value, limits, dates and qualifying UPCs |
| `get_bjs_clubs` | The club directory (about 280 clubs in 22 states), all or one state |

Platform key `bjs`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. `search_bjs`, `get_bjs_category`,
`get_bjs_reviews` and `get_bjs_coupons` take 15 to 100 seconds: allow a client
timeout of at least 240 s.

US only, prices in USD. Search and category pages list up to 40 results: BJ's
ignores its own page parameter, so there is no deeper paging; total is BJ's own
count. price is the online price; club_price, club_sale and in-club stock are
for the club BJ's assigned to the visit (priced_for), which cannot be chosen:
there is no price, stock or availability for a club you pick and no club finder
by ZIP code. Where BJ's shows "Member Only Price" to a visitor,
member_only_price is true and the answer carries the list price only, never a
member price, sale price or sale dates. A club-only item has price null and
club_only true. Reviews carry no reviewer, asker or answerer names or locations.
Captured 2026-11-26: coffee gave 125 results (40 listed), the first Folgers
Classic Roast Ground Coffee 43.5 oz. at 24.79 USD with 8158 reviews; TVs held
162 products priced for the Jersey City, NJ club, the first a Samsung 75" 4K TV
at 599.99 USD with a 397.99 USD sale to 2026-11-30; Scotch-Brite 420-Sheet Lint
Rollers, 4 pk. were 9.99 USD (regular 12.99); the coupon book loaded 268 of 567
offers; New York had 50 clubs. Not available: a chosen club's price or stock,
member prices, deeper search pages, clipping coupons, price history (poll and
store the answers). Failed calls and refused inputs are not charged; a not-found
(an unknown product or a category with no product list) is charged.

### Canadian Tire

| Tool | Description |
|------|-------------|
| `search_canadian_tire` | Search at one store by keyword or category: price and regular price (CAD), savings, clearance/sale/rebate badges, rating, SKU, stock at the store |
| `get_canadian_tire_product` | One product at one store: specifications, variants with SKUs, warranty, manuals, store price, stock, pickup and ship-to-home dates |
| `get_canadian_tire_stores` | Stores near a postal code or coordinates; with `sku`, each store's stock quantity and aisle for it |
| `get_canadian_tire_availability` | Up to 50 SKUs at one store in one call: price, clearance and sale flags, price valid-until date, stock, aisle |
| `get_canadian_tire_clearance` | Every clearance item at one store, 100 per page |
| `get_canadian_tire_deals` | Sale, instant rebate, special buy or Triangle Rewards items at one store |

1 credit per call. `store_id` (from `get_canadian_tire_stores`, e.g. `"600"`) is
required on search, product, availability, clearance and deals. Prices differ by
store and province (Quebec prices differ). Rating and review count only, no
review text.

### [SportChek](https://scavio.dev/docs/sportchek-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

SportChek API for SportChek (sportchek.ca, Canada's sporting goods retailer, a Canadian Tire Corporation banner): SportChek prices in CAD with the was price, sale label and the sale's posted end date SportChek shows, filters from the site's own facets, one product's sizes and colours with online units and the units at the store SportChek assigns, customer reviews with a rating summary, search suggestions, one store's hours and nearby stores, and the brand and category lists. See the [SportChek API page](https://scavio.dev/sportchek-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_sportchek` | Search by keywords or a product code: price, was price, `sale_ends`, `price_message`, badges, rating, colours with online units; 4 sorts, brand, sale or clearance and any facet filter; 24 a page |
| `get_sportchek_list` | A category or deals page (sale, clearance, Black Friday) by path or link, with the same sorts and filters |
| `get_sportchek_product` | One product by code or link: variants (colour, size, width) with their own price, was price and `sale_ends`, `units_at_store`, `units_online`, ship to home and store pickup; specifications, features, images, `assigned_store` |
| `get_sportchek_reviews` | Reviews with a summary (average, count, star distribution, recommended); page 1 the first 8, pages 2-4 the next 30 each; 5 sorts and a star filter |
| `get_sportchek_suggestions` | Search-box suggestions for typed text |
| `get_sportchek_store` | One store by number: address, phone, coordinates, hours, special hours, curbside, up to 49 nearby stores with distance |
| `get_sportchek_brands` | SportChek's brand pages (164 captured 2026-11-25) |
| `get_sportchek_categories` | The category tree; `path` is the input of `get_sportchek_list` |

### [Mark's](https://scavio.dev/docs/marks-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Mark's API for Mark's (marks.com, the Canadian workwear, casual clothing and footwear retailer, a Canadian Tire Corporation banner; L'Equipeur in French): Mark's prices in CAD with the was price, sale label and the sale's posted end date Mark's shows, filters from the site's own facets, one product's sizes, widths and colours with online units and the units at the store Mark's assigns, customer questions and answers, search suggestions, one store's hours and nearby stores, and the brand and category lists. `language: "fr"` reads L'Equipeur (lequipeur.com): the same product codes and CAD prices, French titles. See the [Mark's API page](https://scavio.dev/marks-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_marks` | Search by keywords or a product code: price, was price, `sale_ends`, `price_message`, badges, rating, colours with online units; 4 sorts, brand, sale or clearance and any facet filter; 24 a page; `language` en or fr |
| `get_marks_list` | A category or deals page (sale, clearance, Black Friday) by path or link, with the same sorts and filters; 12 a page on category pages; `language` en or fr |
| `get_marks_product` | One product by code or link: variants (colour, size, width) with their own price, was price and `sale_ends`, `units_at_store`, `units_online`, ship to home and store pickup; specifications, features, images, `assigned_store`; `language` en or fr |
| `get_marks_questions` | The newest 10 customer questions with their answers (`brand_answer` flag) |
| `get_marks_suggestions` | Search-box suggestions for typed text |
| `get_marks_store` | One store by number: address, phone, coordinates, hours, special hours, curbside, up to 49 nearby stores with distance |
| `get_marks_brands` | Mark's brand pages (113 captured 2026-11-25); `language` en or fr |
| `get_marks_categories` | The category tree; `path` is the input of `get_marks_list`; `language` en or fr |

Platform keys `sportchek` and `marks`. 1 credit per call on every tool of both
banners; `credits_used` in the response is what was charged. Calls take about
10-90 seconds: allow up to 2 minutes. Canada only, prices in CAD.

`was_price` is the site's was price as given, only where the site shows one;
`footnote` carries the site's own sentence on it ("Was price reflects the last
national regular price this product was sold for.", English pages). A percent
off is not returned: compute it from `price` and `was_price` and label it
computed. `sale_ends` is the sale end date the site shows, as given.
`units_at_store` are the units at the store the site assigns to the request's
region (`assigned_store`); a caller cannot choose a store. In our checks prices
were the same at every store sampled. Filters come from `facets`
(`include_facets: true`); list paths come from the categories tools; `deals` on
a deals page is a 400 (the page already is one). Captured 2026-11-25:
SportChek's Columbia Women's Amaze Puff Down Jacket (84166659F) at 206.24 CAD
with the promotion "25% Off* - Discount Applied. See details." and `sale_ends`
December 1, 2026; Mark's Dakota WorkPro Series 6114 work boots (75983776F) at
124.99 CAD with a was price of 199.99, the same price on L'Equipeur.

Reviews are SportChek only (no reviewer names); questions are Mark's only (no
asker names); SportChek is English only. Not available: choosing a store for
price or stock, stores near a postal code, the flyer, Triangle Rewards or CT
Money prices, price history (poll and store the answers), UPC or barcodes (the
site shows none), cart or checkout. For the same model at Amazon.ca and
Walmart.ca use the Amazon and Walmart tools; match on brand, model, colour and
size. Failed calls and refused inputs are not charged; a not-found is charged.

### [RONA](https://scavio.dev/docs/rona-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

RONA API for RONA (rona.ca, the Canadian home improvement retailer: RONA+ and RONA stores, about 425 corporate and affiliated dealer stores per RONA inc.): RONA store prices in CAD for up to 60 article numbers at one store in one call, with the regular price, rebate and exact store units, so the same lumber, panels or tools can be priced store by store and next to Home Depot Canada; keyword search, category and weekly deals lists priced at the store you choose; one product with the sale end RONA shows; the 403 stores on RONA's store locator by province, city, banner or nearest a point; one store's hours; and which stores near a store have an article. See the [RONA API page](https://scavio.dev/rona-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_rona` | Search by keywords: price, regular price, on sale, unit, rating, review count, store units; 6 sorts, RONA's filters (brand, price band, rating, on sale, clearance, Buy in Bulk, category); 24, 48 or 96 a page; `redirected_to` when RONA sends the term to a category |
| `get_rona_product` | One product by article number or link: price, regular price, rebate, `sale_ends_text` as RONA shows it, `sale_ends` (ISO, when unambiguous), store units, aisle, DC and parcel units, nearby stores with units, specifications, UPC, model, rating and review count |
| `get_rona_prices` | Up to 60 article numbers at one store (`store_id` required): price, regular price, rebate, on sale, exact store units, DC and parcel units, aisle, UPC, model |
| `get_rona_category` | One category by path, with the search sorts, filters and paging; with `family_id` and `store_id`, the category's products at that store for 1 credit |
| `get_rona_categories` | The department tree; `path` is the input of `get_rona_category` |
| `get_rona_stores` | RONA's 403 stores (RONA+ and RONA; corporate and dealer) by province, city and banner, or nearest a latitude and longitude, with services |
| `get_rona_store` | One store by number: address, phone, coordinates, hours, special hours, department hours |
| `get_rona_stock` | Which stores near a store (or a point) have one article, with exact units, nearest first |
| `get_rona_deals` | RONA's weekly deals or clearance listing: sale price and regular price, paged and filtered like search (RONA's own order, no sort) |

Platform key `rona`. Credits: `get_rona_prices`, `get_rona_categories`,
`get_rona_stores` and `get_rona_store` 1; `search_rona` and `get_rona_deals`
2 (3 with `store_id`; 2 more when RONA redirects a search term);
`get_rona_product` 3; `get_rona_stock` 3; `get_rona_category` 2 (3 with
`store_id`), or 1 with `family_id` and `store_id`. `credits_used` in the
response is what was charged. Answers can take up to about a minute: allow up
to 2 minutes.

Canada only, prices in CAD; `language` is `en` (default) or `fr` on every
tool (article numbers and prices are the same in both). Without `store_id`,
search, category and deals are priced at the store RONA's site picks for the
visit (`store.requested` false); with `store_id` prices and units are that
store's. RONA prices some goods per store: captured 2026-11-26, 2-in x 4-in x
8-ft SPF Select Lumber (0971073) was 4.35 CAD at store 41460 (Quebec), 4.22 at
55130 (Ontario) and 4.19 at 62860 (Alberta), while the DEWALT 20 V MAX
Brushless Compact Drill/Driver Kit on sale (00277649) was 118 at all three.
`units` are exact store units; `null` means RONA showed no count, not zero.
Article numbers are strings (leading zeros count). `get_rona_stock`: RONA
offers no nearby-store list for some articles (lumber), and the list can come
back empty now and then (retry once). For the same item at Home Depot Canada
use the Home Depot tools with `country: "ca"`, matching the same grade and
length or the same model. Not available: review text (rating and review count
only), search suggestions, postal-code store lookup (pass latitude and
longitude, or a city or province), the printed flyer, cart or checkout, price
history (poll and store the answers). Failed calls and refused inputs are not
charged; a not-found (an unknown article, category or store) is charged.

### Dollar General

| Tool | Description |
|------|-------------|
| `search_dollar_general` | Search at one store: price, original price, units on hand at that store, rating, coupons and promotions, UPC |
| `get_dollar_general_product` | One product by UPC at one store: price, units on hand, nearby stores with stock, description, images, coupons |
| `get_dollar_general_stores` | Stores near a ZIP or coordinates (up to 25); with `upc`, that product's unit count at every store in one call |
| `get_dollar_general_deals` | On-sale or clearance items priced and stocked at one store |
| `get_dollar_general_coupons` | Current digital coupons: value, brand, minimum quantity, start and expiration dates |

1 credit per call. `store_id` (from `get_dollar_general_stores`, e.g. `"14838"`) is
required on search, product and deals. Clearance items carry the current price
only, with no was-price. Rating and review count only, no review text.

### [Dollar Tree](https://scavio.dev/docs/dollartree-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Dollar Tree API for Dollar Tree (dollartree.com, the US and Canada discount variety store chain): an item's online case price next to its unit price, case pack, minimum order and split-case multiple as Dollar Tree gives them, and the units of one item at a Dollar Tree store plus the nearby stores; plus search, categories, brands, sale, clearance, New Arrivals and More Choices listings, stores with hours and services, and reviews. Dollar Tree has no public API for its catalog, prices or store stock (suppliers work through its vendor portal and EDI). Pair it with [Dollar General](https://scavio.dev/dollargeneral-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Walmart](https://scavio.dev/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Target](https://scavio.dev/target-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [Instacart](https://scavio.dev/instacart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for a price check on the same item.

| Tool | Description |
|------|-------------|
| `search_dollartree` | Search by keywords or an item number: 48 a page (up to 250) to page 200, with total, unit price, list price, case price, case pack, minimum quantity, split-case flags, rating, in-store-only and clearance flags, facets; sorts relevance, price low or high, newest, rating; category, brand, price point, rating, in-store-only, price and facet filters |
| `get_dollartree_product` | One item by item number or link: unit price, case price, case pack, minimum quantity, split case, banner code (DT or FD), UPCs as given, online stock units, specifications, categories, SKU variants |
| `get_dollartree_category` | One category listing by dimension id or link, with the list sorts, filters and paging |
| `get_dollartree_categories` | Dollar Tree's departments with every sub-category, or one category's sub-categories |
| `get_dollartree_brand` | One brand's items, with the other spellings Dollar Tree lists the same brand under |
| `get_dollartree_deals` | Sale, clearance, New Arrivals or More Choices (Dollar Tree's multi-price assortment) items |
| `get_dollartree_store_stock` | Units of one item at a Dollar Tree store (store number required) plus up to about 63 nearby stores (none at some rural stores), ship-to-home cases and the most units orderable for delivery with an ETA, and ship-to-store with its distribution centre and ETA |
| `get_dollartree_stores` | The stores near a US ZIP or city (20 per answer): address, phone, coordinates, distance, hours, holiday hours, EBT, frozen foods, More Choices |
| `get_dollartree_store` | One store page by link or slug; Canada store pages with `country: "ca"` |
| `get_dollartree_reviews` | One item's newest English reviews (up to about 98 per call) with rating breakdown and syndication flags |

Platform key `dollartree`. 1 credit per call, `get_dollartree_stores` 5;
`credits_used` in the response is what was charged.

`country` is `us` (www.dollartree.com, USD) on every tool; `ca` (Dollar Tree
Canada store pages, English, no prices) is taken by `get_dollartree_store` only,
because Dollar Tree Canada has no shopping site. Prices are Dollar Tree's online
unit prices from one national online price list (the same at every store and ZIP
measured); Dollar Tree notes that prices and availability may vary between stores
and online, and in-store shelf prices are not published online. Online orders are
by the case: item 221159 (9-in. White Paper Plates, 40-ct. Packs) was $1.50 a
unit with a case pack of 30 at a case price of $45.00 and a minimum quantity of 5;
stores sell single units. A case pack or case price Dollar Tree gives as 0 is
null, never computed. `split_case.available` is computed by Scavio as
`minimum_quantity < case_pack` (Dollar Tree's own flag reads N on every item);
on `get_dollartree_product`, `split_case_fee` is Dollar Tree's raw field as
given: its meaning is not published, so it is not a fee. `banner_code` (product
only) is Dollar Tree's banner code (DT or FD), not a store-brand flag. `get_dollartree_store_stock` needs a store number (from
`get_dollartree_stores`; a ZIP alone does not pick a store): the same item showed
116 units at store 5126 (New York) and 63 nearby stores, 59 of them with stock;
`ship_to_home` came from distribution centre 99006 with 2,374 cases of 30 and
`max_order_units` 75,570 (the most units orderable for delivery, the same at
every store, not cases x case_size). `store.status` can be null, and some rural
stores list no nearby stores. Changed in 0.84.1: `split_case.fee` and
`store_brand` removed, `split_case_fee` and `banner_code` added on product,
`ship_to_home.units` replaced by `max_order_units`, `dc_number` added to
`ship_to_home` and `ship_to_store`.
Store stock, stores and reviews are slow (usually 10-35 s, up to about 2.5
minutes). Search matches item numbers, not UPCs. Reviews are the newest only (no
other sort, no star filter, no Q&A, no reviewer names); many are syndicated from
brand sites and flagged. Not available: search suggestions, the weekly ad, deal
validity dates, Quick Order / bulk ordering, gift cards, Canada products and
prices, price history (poll and store the answers), checkout. Failed calls and
refused inputs are not charged; a not-found (an unknown item, category, brand or
store) is charged.

### [Discount Tire](https://scavio.dev/docs/discounttire-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Discount Tire API for Discount Tire (discounttire.com, the US tire and wheel retailer, America's Tire in parts of CA, PA, NJ and NY): the price of a tire at a named store, the same tire at other Discount Tire and America's Tire stores, the tires that fit a vehicle (year, make, model, trim, size option) with the original-equipment tire flagged and staggered front / rear sets, and the exact units at the stores near a ZIP; plus tires by size, wheels, models with every size, promotions with their end dates, categories, search suggestions, stores, store hours, tire and store reviews, and the read-only appointment calendar. Discount Tire has no public product API (it runs an affiliate programme through CJ, and fleet customers use an account portal). See the [Discount Tire API page](https://scavio.dev/discounttire-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme). Pair it with [Walmart](https://scavio.dev/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Sam's Club](https://scavio.dev/samsclub-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [Amazon](https://scavio.dev/amazon-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for the same tire (match on manufacturer part number or GTIN), and with [AutoZone](https://scavio.dev/autozone-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [O'Reilly](https://scavio.dev/oreilly-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for parts.

| Tool | Description |
|------|-------------|
| `search_discounttire` | Tires in one size (225/65R17, LT, flotation, or width + aspect ratio + diameter; optional rear size for staggered pairs) at one store: price per tire, promotions with end dates, exact units at the store, GTIN, manufacturer part number, Good / Better / Best tier, facets; sorts best seller, price, rating; brand, category, speed rating, load range, Three-Peak, run flat, rebates, instant savings, in stock and price filters |
| `get_discounttire_vehicle` | The vehicle selector, one step per call: years, makes, models, trims, tire size options, then the fitment (front and rear size, staggered, wheel diameters, optional plus sizes) |
| `get_discounttire_vehicle_tires` | The tires that fit a vehicle at one store, original-equipment tire flagged; staggered vehicles as front / rear sets; optional Treadwell ranking with Discount Tire's own estimates |
| `get_discounttire_product` | One tire or wheel by item number at one store: price, promotions, units, load index, speed rating, UTQG, tread depth, sidewall, run flat, wheel specs, FAQs |
| `get_discounttire_model` | Every size of one tire or wheel model at one store, with each size's price and the price range |
| `get_discounttire_store_stock` | Exact units of 1-4 items at the stores near a ZIP (5 per page, 10-150 miles), with Discount Tire's availability text |
| `get_discounttire_stores` | Discount Tire and America's Tire stores near a ZIP, city or point (10 per page), with rating and store code |
| `get_discounttire_store` | One store: address, dated hours for the coming week, ratings, services, nearby stores |
| `get_discounttire_reviews` | Discount Tire's own reviews of a tire model or one size, with category ratings; sorts, star filter, full paging |
| `get_discounttire_store_reviews` | Discount Tire's own reviews of one store (5 per page), with cleanliness and knowledge ratings |
| `get_discounttire_wheels` | Wheels by size and bolt pattern, or that fit a vehicle, at one store |
| `get_discounttire_browse` | Tire models in a category, of a brand, or matching keywords, with the price range at one store |
| `get_discounttire_categories` | Discount Tire's tire or wheel types (the category filter and the browse slug) |
| `get_discounttire_suggestions` | What Discount Tire's search box suggests for a few letters (models and categories, no prices) |
| `get_discounttire_appointments` | One store's appointment calendar for a month, read only: bookable days, hours and open slots (start and end in the store's local time) |

Platform key `discounttire`. 1 credit per call; `credits_used` in the response is
what was charged.

`country` is `us` (www.discounttire.com, USD) on every tool: Discount Tire and
America's Tire are one catalog sold in the United States only. Prices, stock and
promotions are per store: the price tools (search, vehicle tires, product,
model, wheels, browse) take `store` (a store code from `get_discounttire_stores`)
or `zip` (the nearest store is used), and every answer names the store used in
`store`. Price can differ between stores and is not different at every store:
measured 2026-11-25, Michelin Defender 2 225/65R17 (item 108547) was $206 a tire
at 9 stores in 8 states and $205 at an America's Tire store in New Jersey; across
45 tires, the stores measured in Texas, Florida and Washington showed no
differences, a California store 1, a Michigan store 3 and the New Jersey store
13 of 32. `price` is
per tire or wheel: Discount Tire publishes no set-of-four price, so 4 x price is
arithmetic, not a Discount Tire price. Promotions are Discount Tire's own title
and text with its end date (`ends`, ISO 8601 UTC, and `ends_text` as given); no
start date. The vehicle chain for a 2022 Ford F-150 XLT Crew Cab 2WD is year
2022, make Ford, `vehicle_id` 17361, `trim_id` 52455, `assembly_id` 0000E28B
(245/70R17); a staggered vehicle such as the 2022 Corvette Stingray (245/35R19
front, 305/30R20 rear) comes back as front / rear sets, each tire with its own
per-tire price (a set is 2 front + 2 rear). Treadwell ranking fields (rank,
mileage, miles per dollar, ride and stopping ratings) are Discount Tire's own
estimates, as given. Store stock is the exact unit count per store; a store with
0 units can still say "Available as soon as <date>". Reviews are Discount Tire's
own, fully paged, with no reviewer names. Appointments are read only: Scavio
never books; slot start and end times are the store's local time
(YYYY-MM-DDTHH:MM, no time zone). Not available: the deals page text, road hazard and certificate
prices, financing, installation and fee amounts, the Treadwell chat, fleet
accounts, Tire Rack, price history (poll and store the answers), checkout and
booking. Failed calls and refused inputs are not charged; a not-found (an unknown
item, model, category, brand or store) is charged.

### [Vevor](https://scavio.dev/docs/vevor-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Vevor API for VEVOR (vevor.com, the tools and equipment seller with storefronts in 13 countries): VEVOR's price on each storefront in its own currency, the was price only while a VEVOR deal is active (with VEVOR's deal start and end), every variant with its own price and stock, shipping fee and delivery date by US state or Canadian province, and the same SKU on all 13 storefronts in one call. See the [Vevor API page](https://scavio.dev/vevor-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_vevor` | Search by keywords in the storefront language or a SKU: 60 items a page with price, was price, deal end, stock units, labels, rating; sorts popular, price low or high, hot, new; in stock, on sale, Black Friday, bulk savings, pickup (US), price range, rating and category filters |
| `get_vevor_product` | One product by SKU or link: price, deal window, stock units, variants with their own price and stock, specs, images, protection plans, return policy, rating breakdown, VEVOR's own AI review summary |
| `get_vevor_shipping` | Shipping fee, free shipping flag and delivery dates for one SKU to a US state, Canadian province or postcode |
| `get_vevor_reviews` | Reviews up to 100 a page, sorted recommended, newest or helpful, filtered by stars, photos or this exact SKU; language and country per review, VEVOR's replies |
| `get_vevor_questions` | Customer questions with their answers, 5 a page, VEVOR's own answers flagged |
| `get_vevor_suggestions` | What VEVOR's search box suggests for typed text |
| `get_vevor_categories` | VEVOR's category tree (departments, categories, sub-categories) or one branch, with ids |
| `get_vevor_category` | One category listing, sorted, filtered and paged like search |
| `get_vevor_collections` | Best Sellers (optionally one category), New Arrivals with first-listed dates, or one promotion page |
| `get_vevor_deals` | Daily Deals, Clearance or the Deals page, optionally one category |
| `get_vevor_prices` | The same SKU on all 13 storefronts: status, price, was price, deal end and stock units per storefront, each in its own currency (3 credits) |

Platform key `vevor`. 1 credit per call, `get_vevor_prices` 3; `credits_used` in
the response is what was charged.

Storefronts (`country`, default `us`, and `language`, default the first listed):
`us` (www.vevor.com, USD; en, es), `ca` (www.vevor.ca, CAD; en, fr), `gb`
(www.vevor.co.uk, GBP), `au` (www.vevor.com.au, AUD), `de`, `fr`, `es`, `it`,
`nl` (EUR, each in its own language), `pl` (PLN), `mx` (MXN, es), `no`
(www.vevor.co.no, EUR) and `eu` (eur.vevor.com, VEVOR's storefront for the other
European countries, EUR; en, sv, da, fi, no, pt, cs, el, sk, hu, ro). Each
storefront language has its own search index, so send the search term in that
language. The same SKU has its own price on each storefront: measured 2026-11-25,
one SKU (GYQXJBMQJQYPKEO1LV0) was 195.01 USD on www.vevor.com, 233.90 CAD on
www.vevor.ca, 175.90 GBP on www.vevor.co.uk, 170.90 EUR on www.vevor.de, 261.99
EUR on www.vevor.co.no and 721.90 PLN on www.vevor.pl. Price and stock do not
change by ZIP; the shipping fee and delivery date change by US state (required
for `us`) or Canadian province (required for `ca`): a welder to Alaska (AK 99501)
had a $130 fee, contiguous states were measured free. `was_price` is given only
while a VEVOR deal is active (deal `starts` / `ends` as VEVOR gives them) or when
VEVOR's page shows its own strikethrough price, otherwise null: never compute a
discount from it. Search and listing totals are exact up to 100 and then read
"100+" (`total_is_lower_bound`). Reviews are one pool shared across storefronts
and a product's variants, so they come in many languages (`language`, `country`
per review), fully paged up to 100 a page, with no reviewer names. Not available:
coupon codes (VEVOR shows them only after a claim), the pickup store, Pro or bulk
prices, financing, the ships-from warehouse, VEVOR's listings on other
marketplaces (use the Amazon, Walmart, Home Depot, Tractor Supply, TikTok Shop or
eBay tools), price history (poll and store the answers), checkout. Failed calls
and refused inputs are not charged; a not-found (an unknown SKU or category, or a
SKU the storefront does not sell) is charged.

### [Nellis Auction](https://scavio.dev/docs/nellis-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Nellis Auction API for Nellis Auction (nellisauction.com, the liquidation auction marketplace with pickup warehouses in Las Vegas, Phoenix, Houston, Philadelphia, Denver and Dallas): a lot's current bid and bid count, Nellis's own Estimated Retail Price as labelled, the buyer's premium percent, open and close times, Nellis's condition grade, the pickup warehouse, the bid history without bidder names, and a sold lot's final price by id. See the [Nellis Auction API page](https://scavio.dev/nellis-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_nellis` | Search the open auctions of one shopping location: 48, 120 or 240 lots a page with current bid, bid count, Estimated Retail Price, close time, condition and pickup warehouse; 9 sorts (featured, current bid, ending soon or last, estimated retail, bids); category, brand, pickup warehouse, condition stars, retail range, auction event, color and size filters with Nellis's counts |
| `get_nellis_item` | One lot by id or link, open, closed or sold: current bid, final price of a sold lot (before premium and tax), market status, condition grade and notes, operator, pickup warehouse, bid history (amount, time, Winning or Outbid, no bidder names) |
| `get_nellis_locations` | The 13 pickup warehouses with address, coordinates, operator and opening hours per day |
| `get_nellis_categories` | Live counts of open lots per category, subcategory, brand, auction event and pickup warehouse in one shopping location |

Platform key `nellis`. 1 credit per call; `credits_used` in the response is what
was charged.

Shopping locations (`location`, default `las-vegas`): `las-vegas`, `phoenix`,
`houston`, `philadelphia` (pickup in Delran, NJ), `denver` and `dallas` (run by
Lots Of Auctions), with 13 pickup warehouses in all. Search lists open auctions
only, as Nellis's own search does; a closed or sold lot is read by id with
`get_nellis_item`, and a sold lot's `final_price` is the winning bid before
Nellis's buyer's premium and tax. `retail_price` is Nellis's own "Estimated Retail
Price", as Nellis labels it, not an MSRP. The buyer's premium is, in Nellis's
words, "typically 15% but may vary based on the auction event"
(`buyer_premium_percent` per lot). Captured 2026-11-25: a sold lot (id 141100004,
Estimated Retail Price 9.99) closed at a final price of 6 after 5 bids. Bids move
live: `current_bid`, `bid_count` and `closes` are as of the fetch. Not available:
closed or sold lots in search, search suggestions, shipping (pickup only), UPC or
model numbers, buy-now, reserve prices, live bid updates, bidding, watchlists and
checkout; for the same item's new price use the Amazon or Walmart tools, and the
eBay tools for sold prices (match on title and brand). Failed calls and refused
inputs are not charged; a not-found (an unknown id, or a category with no open
lots) is charged.

### [EstateSales.net](https://scavio.dev/docs/estatesales-sales?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

EstateSales.net API for EstateSales.net (estatesales.net, the US estate sale directory run by Vintage Software): estate sales, auctions and moving sales near any US ZIP code or in a city's metro area with their dates, sale type, distance and pictures, filtered by when they run and sale type; one sale in full with its schedule, terms, description and every picture; every estate sale company listed for a metro area and one company's public page with its upcoming sales; keyword search over sales and marketplace items; and one marketplace item with its current bid, buy-now price, shipping and pickup. See the [EstateSales.net API page](https://scavio.dev/estatesales-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `get_estatesales_sales` | Sales near a US ZIP code or in a city's metro area (city with state): when (today, tomorrow, within 15 days), sale types, 5 sorts; the first 20 sales of the area with the site's own total and filtered counts |
| `get_estatesales_sale` | One sale by sale id or link: status, seller (company with its public business contact, or private), location (street address once released), local and UTC dates for every sale day, terms, description, pictures, auction and video links |
| `get_estatesales_companies` | Every estate sale company listed for a US metro area (a city resolves to its metro): address, phones, website, social links, package, trusted flag, distance |
| `get_estatesales_company` | One company's public page by org id or link: profile, metro areas, memberships, testimonials (no author names) and its current and upcoming sales |
| `search_estatesales` | Keyword search over sales and marketplace items, 24 a page, pages 1 to 4, plus companies whose name matches |
| `get_estatesales_item` | One marketplace item by item id or link: prices and bids in USD, reserve, buy now, shipping, local pickup, payment, terms, categories, status, pictures and the company selling it (no bidder identity) |

Platform key `estatesales`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. `get_estatesales_company` and
`search_estatesales` can take 10 to 50 seconds: allow a client timeout of at
least 150 s.

US only (the 50 states and DC), prices in USD. A sales page lists the first 20
sales of the area, nearest first, with no deeper paging; `when`, `type` and
`sort` apply to those 20, and `total_count` and `filtered_count` are the site's
own counts for the area (captured 2026-11-26: around ZIP 75201, Dallas, TX, the
site counted 164 sales and listed 20, the nearest 2.13 miles away with 629
pictures; the Dallas-Fort-Worth-Arlington metro listed 226 companies; a search
for lamp gave 1057 results over 45 pages, of which pages 1 to 4 can be read;
item 2038603 had a current bid of 635 USD after 4 bids). Private sellers are
never identified: a private sale gives its city, state and ZIP only (no name,
phone, street address or coordinates). A company-run sale's street address is
given as published, once its show-address time has passed. Company names,
phones, websites and addresses are each company's public business contact;
testimonials carry no author names and items no bidder identity. Not available:
sales past the first 20 of an area, search pages past 4, bidding or buying,
price history (poll and store the answers). Failed calls and refused inputs are
not charged; a not-found (an unknown ZIP, city, metro, sale, company or item) is
charged.

### Sephora

| Tool | Description |
|------|-------------|
| `search_sephora` | Search sephora.com (US): price, list and sale price, rating, review count, bestseller/new/exclusive flags, category facets; `zip` for same-day eligibility; `country: "ca"` for Sephora Canada with filters and facets |
| `get_sephora_category` | Products in a category, same fields as search, with subcategories, parent category and breadcrumbs; for Canada also sorts, filters and facets |
| `get_sephora_product` | One product: every shade or size with price, stock, ingredients and pickup/same-day eligibility, plus a review summary with pro and con sentiment counts; for Canada the 10 latest reviews (no reviewer names) and Sephora's AI review summary, labelled as Sephora's |
| `get_sephora_brand` | Sephora Canada only: one brand's products (e.g. `the-ordinary`, `dior`) with the brand's categories, sorts, filters and facets |
| `get_sephora_brands` | Sephora Canada only: every brand in the A-Z brand directory, with the `seo_name` to pass to `get_sephora_brand` |
| `get_sephora_suggestions` | Sephora Canada only: the search-box suggestions (terms and products) for a partial query |
| `get_sephora_offers` | Sephora Canada only: the current beauty offers with eligibility, promo code, threshold and end date as given (no start date), app-only offers flagged |
| `get_sephora_stores` | Sephora Canada only: the Canadian stores on Sephora's store list, by province, with counts per province |
| `get_sephora_store` | Sephora Canada only: one store's address, phone, coordinates, weekly and holiday hours and services |

US (sephora.com, the default): `search_sephora` and `get_sephora_category` are 1
credit per call, `get_sephora_product` 2. `get_sephora_product` takes a result's
`url` (faster) or `product_id` (e.g. `"P510799"`). The US review summary and
sentiment counts come with no review text.

**Sephora Canada** (sephora.com/ca, Sephora's Canadian store: 152 stores per its
store list on Nov 25, 2026): pass `country: "ca"` to `search_sephora`,
`get_sephora_category` and `get_sephora_product`; the six other tools are
Sephora Canada only and need no country. Canadian beauty prices in CAD (The
Ordinary, Dior, Rare Beauty, Supergoop and the rest of the catalogue) with sale
prices and dated offers. Credits: search, category, brand, brands, suggestions,
stores and store 1 each; product and offers 2. Product and SKU ids are the same
as on sephora.com, with CAD prices as Sephora Canada gives them (French prices
such as `33,00 $` are read as 33.00). `language: "fr"` returns French names,
descriptions and facet values with the same ids and prices. Listings take
`sort`, `filters` (`brand`, `on_sale`, `new`, `clean`, `rating` 1-4,
`min_price`, `max_price`, `facets`) and `include_facets`; a brand keyword such
as `the ordinary` answers that brand's products with a `redirect`. `zip` is US
only (a 400 with `country: "ca"`).

Captured 2026-11-26: Dior Sauvage Eau de Parfum (`P428500`) at 128 to 300 CAD,
the 3.4 oz / 100 ml SKU 2038131 at 200 CAD, `in_stock: true`,
`only_few_left: false`; the Sephora Collection Oil Infusion Hydrating Lip Oil
(`P518068`) at a sale price of 10.50 CAD (list 15.00) in a `lip oil` search;
26 offers, among them 30% off Sephora Collection with `end_date`
2026-11-30T23:59:00.000-08:00; and 152 stores on the store list (ON 64, QC 26,
AB 22, BC 22). Each SKU carries price, list and sale price, `in_stock` and
`only_few_left`. `review_summary` is Sephora's own AI-generated summary of
customer reviews and is labelled as Sephora's; read it as Sephora's summary,
not as a fact. Store address and phone are public business data, returned as
captured.

Not available for Canada: stock per store, a store finder by postal code, the
full review list with its sorts or a star filter, UPC (`upc` is always null:
the pages show none), Beauty Insider prices, cart or checkout, price history
(poll and store the answers). Sephora publishes no public product or store
API. For the same product at other Canadian retailers use the
[Dermstore](https://scavio.dev/dermstore-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (`country: "ca"`),
[Amazon](https://scavio.dev/amazon-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (`country: "ca"`) and
[Walmart](https://scavio.dev/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (`domain: "ca"`) tools; match on
brand, name and size. See the
[Sephora API page](https://scavio.dev/sephora-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

### Ulta Beauty

| Tool | Description |
|------|-------------|
| `search_ulta` | Search Ulta Beauty: list and sale price, discount, promo text, rating, review count, badge, variant count |
| `get_ulta_category` | Products in a category (e.g. `/shop/makeup/lips/lipstick`), same fields as search |
| `get_ulta_product` | One product by URL: price, GTIN, ingredients, every shade or size variant, ship/pickup/same-day eligibility, five most recent reviews |
| `get_ulta_stores` | One shade or size at the 10 stores nearest a ZIP: in stock or out of stock per store, hours, distance |

1 credit per call. `get_ulta_stores` takes a result's `product_id` and `sku_id`
plus a ZIP. Ulta publishes in stock / out of stock per store, not unit counts.

### [Bring a Trailer](https://scavio.dev/docs/bringatrailer-results?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Bring a Trailer API for Bring a Trailer (bringatrailer.com, the online collector-car auction site owned by Hearst): completed auction results with the sale price or the high bid of a lot that ended under its reserve, a model's or make's full price history with sell-through rate and median sold price per currency, one auction in full with its bid history and comments, every live auction, and the make, model and location pages. See the [Bring a Trailer API page](https://scavio.dev/bringatrailer-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `get_bringatrailer_results` | Search completed auctions by keywords (or none): 4 sorts, sold or reserve not met, recency, model years, max bid, category, origin, era, no reserve or Premium, and one make, model id or location id; up to 60 a page through the first 10,000 results of a query |
| `get_bringatrailer_price_history` | Every completed result of one model (or a model family's ids) or make in one call: sold and reserve-not-met counts, sell-through rate, min / max / median / average per currency, newest to oldest |
| `get_bringatrailer_listing` | One auction by slug or link, live or ended: sold price or high bid, bid count, views, watchers, location (no ZIP), seller type, listing details, description, photos, earlier results of the same vehicle, the full bid history and paged comments, without usernames |
| `get_bringatrailer_live` | Every live auction (about 1,000) filtered by keyword, make, country, ending within N hours, no reserve and Premium, sorted by ending time or current bid |
| `get_bringatrailer_make` | One make page: its models with the ids results take, live auctions, completed total and recent results |
| `get_bringatrailer_model` | One model page (or a family such as porsche/911): the model ids for results and price history, live auctions, completed total and recent results |
| `get_bringatrailer_location` | The lots located in one country: the location id for results, live auctions, completed total and recent results |
| `get_bringatrailer_suggestions` | Search-box suggestions for a partial make, model or place, with the page ids results takes |

Platform key `bringatrailer`. Credits: 1 per call on every tool;
`credits_used` in the response is what was charged. Answers can take up to
about 200 seconds (`get_bringatrailer_live` reads every live lot in one call,
20 seconds to 3 minutes; a make page up to a minute): allow up to 4 minutes.

One site, no country input. Amounts are in each lot's own currency as the site
shows it (USD, EUR, GBP and others): read `currency` on every lot (captured
2026-11-26: a 1988 BMW M3 sold for 80000 USD after 29 bids; a Euro 1994 BMW
850CSi sold for 109000 EUR). `amount` is the sale price of a sold lot and the
high bid of a lot that ended under its reserve, before the site's buyer's fee.
Results reach the first 10,000 of a query (page x page_size at most 10,000):
narrow with filters or recency for older lots; price history is capped at
10,000 results (`capped`). Captured 2026-11-26: the BMW E30 M3 (model_id
1833018) over the last year had 70 results, 58 sold, median sold price 59250
USD. `no_reserve` and `premium` are not combined on results. Bids and comments
carry no usernames, and no member profile links, chassis numbers / VINs or
seller ZIP codes are returned. Failed calls and refused inputs are not
charged; a not-found (an unknown slug, make, model or country) is charged.

### [Dermstore](https://scavio.dev/docs/dermstore-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Dermstore API for Dermstore (dermstore.com, the US skincare and beauty retailer, shipping to the US and Canada): price, RRP as Dermstore gives it and Dermstore's offer text per product and per brand, every shade, size or strength with its own price and stock, UPC, auto-replenish plans, the current offers with their end times, and US vs Canada prices for the same SKU. See the [Dermstore API page](https://scavio.dev/dermstore-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_dermstore` | Search by keywords or a Dermstore SKU: up to 200 a page, 7 sorts, filters (brand, skin type, concern, SPF band, key ingredient, preference, gender, price, rating, discount), facets on request; a mapped keyword (sunscreen, retinol, eltamd) returns the page Dermstore sends it to, reported in `resolved_from` |
| `get_dermstore_list` | Any Dermstore list page by path or link: a category, brand, `/sale`, an offer page (`/shop/black-friday/30-off`), `/gift-sets` or an ingredient page, same filters and sorts as search |
| `get_dermstore_product` | One product by SKU or link: price, RRP, `discount_percent`, UPC, variants with their own price and stock, ingredients, directions, auto-replenish discounts, loyalty points, the page's offer banner, rating, review count and the 10 latest reviews (no reviewer names) |
| `get_dermstore_suggestions` | Search-box suggestions: suggested terms, corrections and up to 5 products |
| `get_dermstore_offers` | Dermstore's current offers as its coupon-codes page lists them: code, gift, spend threshold, end time and the list page of the products |
| `get_dermstore_brands` | The A-Z brand directory (about 235 brands), optionally one letter |
| `get_dermstore_categories` | The category tree as the site navigation shows it |

Platform key `dermstore`. 1 credit per call; `credits_used` in the response is what
was charged.

Markets (`country`, default `us`): `us` (USD, shipping to the US) and `ca`
(Dermstore's own Canadian dollar prices, not converted). `rrp` is Dermstore's
RRP as given; `discount_percent` is computed by Scavio from price and RRP, only
when the RRP is above the price. `offer` is Dermstore's own promotion text, as
given; code rates differ by brand. Captured 2026-11-25: EltaMD UV Clear SPF 46
(1.7 fl. oz., SKU 11370303) at 46 USD and 65.78 CAD; Medik8 offered "30% Off
With Code JOY + Gift", while SkinCeuticals offered "Earn 10% Back + $25 Gift"
(double points, as Dermstore states it). Offers carry the end time Dermstore
gives (`ends`); Dermstore gives no start date. Not available: a full review
feed or review paging (only the 10 latest via `get_dermstore_product`), Q&A,
member (VIP) prices, cart or checkout prices, price history (poll and store the
answers), offer start dates. For the same product at Sephora, Ulta or Amazon,
use those tools and match on UPC, or brand + name + size. Failed calls and
refused inputs are not charged; a not-found (an unknown SKU or list path) is
charged.

### [Bath & Body Works](https://scavio.dev/docs/bathandbodyworks-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Bath & Body Works API for Bath & Body Works (bathandbodyworks.com, the US body care and home fragrance retailer, and bathandbodyworks.ca in English): keyword search and category pages with price, list price, promotion callouts, rating, fragrance name and family, sorted and filtered as on the site; the category tree; one product in full with fragrance notes, ingredients and UPC; the promotions attached to a product with their start and end times and terms; the current offers and Top Offers; whether a store takes a pickup order for a product and its pickup purchase limit; the store directory and one store's address and hours; and a product's review summary. See the [Bath & Body Works API page](https://scavio.dev/bathandbodyworks-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_bathandbodyworks` | Keyword search, sorted by relevance, price, top rated or new arrivals, filtered by fragrance name, fragrance family and product type; the 48 results the site shows, with its own total and facets |
| `get_bathandbodyworks_category` | One category page by path or link (including deal pages such as /g/top-offers and /t/black-friday), with the same sorts and filters as search |
| `get_bathandbodyworks_categories` | The category tree as the site's navigation menu lists it, with the path each category page takes |
| `get_bathandbodyworks_product` | One product by id or link: price, list price, promotions, rating, fragrance name, family, classification and notes, description, ingredients, UPC, online purchase limit and low-stock flag, images |
| `get_bathandbodyworks_promotions` | The promotions attached to one product with start and end times (UTC) and terms as given |
| `get_bathandbodyworks_offers` | The current offers: the home page's offer cards and the Top Offers tiles, with validity and terms as given |
| `get_bathandbodyworks_store_availability` | Whether one store takes a pickup order for one product, with its pickup purchase limit (0-24) and the national price |
| `get_bathandbodyworks_store` | One store's public page by store id: address, phone, coordinates, hours, services, store types and nearby stores |
| `get_bathandbodyworks_stores` | Every store id in the market's store directory |
| `get_bathandbodyworks_reviews_summary` | One product's rating, review count and up to 4 newest reviews (no reviewer names) |

Platform key `bathandbodyworks`. Credits: 1 per call on every tool; `credits_used`
in the response is what was charged. `get_bathandbodyworks_promotions`,
`get_bathandbodyworks_store_availability` and `get_bathandbodyworks_store` usually
take 10 to 40 seconds: allow a client timeout of at least 90 s.

`country` `us` (default, USD) or `ca` (bathandbodyworks.ca in English, CAD); a
product link's site sets the market. Search and category pages give the 48 results
the site shows with its own total, and no page 2: narrow with sort and the filters.
Every size is its own product id. Prices are national, the same at every store.
Store availability is the pickup purchase limit the store sets (0-24), not a count
of what a store holds: the site publishes none. Captured 2026-11-26: a top-rated
search for candle among 3-Wick Candles gave 48 of 123, the first the Vanilla Eggnog
3-Wick Candle at 26.95 USD; the same search on `ca` counted 173; the Champagne
Toast 3-Wick Candle (028029548) was 24.95 USD (26.95 CAD in Canada), rated 4.75 from
3789 reviews, with store BBW00010 in San Antonio, TX taking pickup orders up to 24;
the Into the Night Gift Set carried 3 promotions, one "$40 with any $40 purchase"
from 2026-11-26 11:00 to 2026-11-27 11:00 UTC; the offers page listed 15 promotions;
the Canada store directory listed 114 stores. Not available: unit counts, store
search by ZIP, full review paging, Spanish or French pages, price history (poll and
store the answers). Failed calls and refused inputs are not charged; a not-found
(an unknown product, path or store) is charged.

### ALDI

| Tool | Description |
|------|-------------|
| `search_aldi` | Search at one store: price and was-price, unit price, stock level, aisle location, ALDI-exclusive brand flag, dietary labels |
| `get_aldi_product` | One product at one store: price, stock, description, ingredients, allergen warnings, images |
| `get_aldi_stores` | Stores near a ZIP: store_id, address, coordinates, distance |

1 credit per call. Prices are per store and per `service_type`: `instore` (the
shelf price, default), `pickup` or `delivery` (online prices, often higher).
Pass `store_id` (from `get_aldi_stores`, e.g. `"151248"`) or a `zip` to use the
nearest store. ALDI has no product ratings.

### [Space NK](https://scavio.dev/docs/spacenk-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Space NK API for Space NK (spacenk.com, the London-based luxury beauty retailer, owned by Ulta Beauty): product search, category and brand lists with Space NK's ten sorts, price next to the struck-through price and Space NK's badges, the online stock count of a shade or size, every shade or size of a product, customer reviews with star distribution and skin context (no reviewer names), the UK stores near a postcode with Space NK's in-store and Click & Collect flags for one product, and the gifts with purchase on the offers page. See the [Space NK API page](https://scavio.dev/spacenk-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_spacenk` | Search by keywords: 36 a page, 10 sorts, a brand filter; `full: true` fills all 36 products (else the first 12 in full and 24 ids) |
| `get_spacenk_category` | One category by id (`black-friday` is the Black Friday list), same paging, sorts and brand filter |
| `get_spacenk_brand` | One brand's products by brand id, same paging and sorts |
| `get_spacenk_brands` | Every brand A-Z (245 on uk), optionally one letter |
| `get_spacenk_product` | One product by product id or shade / size id: price, list price, EAN, online `stock_count`, size, ingredients, every shade or size with its stock, promotions and badges |
| `get_spacenk_reviews` | Reviews of one product by its master id (starts with M): up to 100 a page, 4 sorts, star filter, text search, rating distribution, skin context; no reviewer names |
| `get_spacenk_suggestions` | Search-box suggestions: brands, categories, articles and products |
| `get_spacenk_stores` | Up to 20 UK stores nearest a postcode or point for one product: hours, distance, in-store and Click & Collect flags (not counts) |
| `get_spacenk_offers` | The gifts with purchase on the offers page (uk or ie): brand, gift, condition, spend threshold, and the page's validity line |

Platform key `spacenk`. Credits: 1 per call; `search_spacenk`, `get_spacenk_category`
and `get_spacenk_brand` with `full: true` cost up to 5 (one extra call per product
filled, billed on what was spent). `credits_used` in the response is what was
charged. Answers can take up to about 30 seconds: allow up to 4 minutes.

Markets (`market`, default `uk`): `uk` (GBP), `ie` (EUR), `nl` (EUR, Dutch copy)
and `au` (AUD), each in its own currency as Space NK prices it; `us`, `de` and `ca`
are refused with a 400 (Space NK's US path shows UK prices). Stores are UK only and
take a product id; reviews take the product (master) id starting with M, not a shade
or size id, and are one English pool shown on every market; offers take `uk` or
`ie` only. Captured 2026-11-26: TAKAMI Vitamin B3+ Spot Serum at 43.5 GBP (list
price 58) with an online stock count of 57; Charlotte Tilbury Airbrush Flawless
Foundation at 59 AUD on `au`, 269 reviews. Not available: the US market, a price
filter (the site ignores it; sort by price instead), store stock counts, price
history (poll and store the answers), cart or checkout. Failed calls and refused
inputs are not charged; a not-found (an unknown category or brand id) is charged.

### [Lookfantastic](https://scavio.dev/docs/lookfantastic-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Lookfantastic API for Lookfantastic (lookfantastic.com, THG's beauty retailer with 10 country sites): price, RRP as Lookfantastic gives it and the site's offer text per product, every shade or size with its own price, stock and barcode (EAN), the 10 latest reviews (no reviewer names), the current offers with their end times, and the same SKU priced on each site and in each currency the site offers. See the [Lookfantastic API page](https://scavio.dev/lookfantastic-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_lookfantastic` | Search by keywords (in the site's language) or a SKU: up to 40 a page, 7 sorts, filters (brand, skin type, concern, SPF band, key ingredient, formulation, any other site filter, price, rating, discount), facets on request; a mapped keyword returns the page Lookfantastic sends it to, reported in `resolved_from` |
| `get_lookfantastic_list` | Any list page by path or link: a category, brand (`/brands/cerave`) or offer page (`/black-friday`), up to 200 a page, same filters and sorts |
| `get_lookfantastic_product` | One product by SKU or link: price, RRP, `discount_percent`, barcode, variants with their own price and stock, ingredients, directions, the page's offer banner, rating, review count and the 10 latest reviews |
| `get_lookfantastic_suggestions` | Search-box suggestions: suggested terms, corrections and up to 5 products |
| `get_lookfantastic_offers` | The current offers as the voucher-codes page lists them: code, gift, spend threshold, end time and the list page of the products |
| `get_lookfantastic_brands` | The A-Z brand directory (415 brands on gb), optionally one letter |
| `get_lookfantastic_categories` | The category tree as the site navigation shows it |

Platform key `lookfantastic`. Credits: 1 per call; `credits_used` in the response is
what was charged. Answers can take up to about 30 seconds: allow up to 4 minutes.

Markets (`market`, default `gb`): `gb` (lookfantastic.com, the UK and international
site, 22 currencies via `currency`: GBP default, USD, EUR, AUD, CAD, CHF, SEK, DKK,
NOK, JPY, KRW, HKD, SGD, AED, SAR, ILS, NZD, CNY, MYR, TWD, THB, IDR), `de`, `fr`,
`es`, `it`, `nl`, `at`, `ie` (EUR, each in its own language), `pl` (PLN default or
EUR) and `eu` (eu.lookfantastic.com, English, euro prices of its own). A currency a
site does not offer is a 400, not charged; nothing is converted. Captured 2026-11-26:
PIXI Glow Tonic 250ml (SKU 11200055) at 12.6 GBP (RRP 18) on `gb` and 14.49 EUR (RRP
20.7) on `fr`. Not available: full review paging (only the 10 latest via
`get_lookfantastic_product`), cart or checkout prices (code discounts apply at the
cart), price history (poll and store the answers), offer start dates. Failed calls
and refused inputs are not charged; a not-found (an unknown SKU or list path) is
charged.

### [Cult Beauty](https://scavio.dev/docs/cultbeauty-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Cult Beauty API for Cult Beauty (cultbeauty.co.uk, THG's beauty retailer): price, RRP as Cult Beauty gives it and the site's offer text per product, every shade or size with its own price, stock and barcode, the 10 latest reviews (no reviewer names), the current offers with their end times, and the same SKU on the UK and international sites in 12 currencies. See the [Cult Beauty API page](https://scavio.dev/cultbeauty-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_cultbeauty` | Search by keywords or a SKU: up to 40 a page, 7 sorts, filters (brand, skin type, concern, SPF content, key ingredient, formulation, a brand's range, any other site filter, price, rating, discount), facets on request; a mapped keyword returns the page Cult Beauty sends it to, reported in `resolved_from` |
| `get_cultbeauty_list` | Any list page by path or link: a category (`/skin-care`), brand (`/brands/cerave`) or offer page (`/black-friday-cyber-monday`), up to 200 a page, same filters and sorts |
| `get_cultbeauty_product` | One product by SKU or link: price, RRP, `discount_percent`, barcode, variants with their own price and stock, ingredients, directions, the page's offer banner, rating, review count and the 10 latest reviews |
| `get_cultbeauty_suggestions` | Search-box suggestions: suggested terms, corrections and up to 5 products |
| `get_cultbeauty_offers` | The current offers as the voucher-codes page lists them (`gb` only): code, gift, spend threshold, end time and the list page of the products |
| `get_cultbeauty_brands` | The A-Z brand directory (289 brands on gb), optionally one letter |
| `get_cultbeauty_categories` | The category tree as the site navigation shows it |

Platform key `cultbeauty`. Credits: 1 per call; `credits_used` in the response is
what was charged. Answers can take up to about 30 seconds: allow up to 4 minutes.

Markets (`market`, default `gb`): `gb` (cultbeauty.co.uk, GBP default) and `intl`
(cultbeauty.com, EUR default), both in English and both with the same 12 currencies
via `currency`: GBP, EUR, USD, AUD, CHF, AED, SAR, ILS, HKD, SGD, JPY, CNY. A currency
outside that list is a 400, not charged; nothing is converted. `get_cultbeauty_offers`
on `intl` is a 400, not charged (cultbeauty.com has no voucher-codes page). Captured
2026-11-26: PIXI Glow Tonic 250ml (SKU 11200055) at 12.6 GBP (RRP 18) on `gb` and
14.21 EUR (RRP 20.3) on `intl`. Not available: full review paging (only the 10
latest via `get_cultbeauty_product`), cart or checkout prices (code discounts apply
at the cart), price history (poll and store the answers), offer start dates. Failed
calls and refused inputs are not charged; a not-found (an unknown SKU or list path)
is charged.

### [YesStyle](https://scavio.dev/docs/yesstyle-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

YesStyle API for YesStyle (yesstyle.com, the Hong Kong-based online store for Asian beauty and fashion, shipping to 150+ countries): YesStyle's own price, list price and discount for the shipping country in that country's currency (YesStyle keeps regional price lists), flash-sale and Black Friday labels, the site coupon with its tiers and expiry, a deal's end date and claimed share, every shade and size with its own price, ingredients, bestseller ranks, brand satisfaction, and customer reviews with skin type and photos (no reviewer names). Keyword search, category, brand and deal lists, 100 a page with seven sorts and YesStyle's Featured, price and facet filters. See the [YesStyle API page](https://scavio.dev/yesstyle-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_yesstyle` | Search by keywords or a brand name: 100 a page, 7 sorts, Featured filters (in stock, flash sales, Black Friday, clearance, Korean / Japanese brands, cruelty-free, vegan ...), price band, department and any facet; facets on request |
| `get_yesstyle_category` | One category by id or link, same sorts and filters plus Type, Region (brand country) and Ingredients |
| `get_yesstyle_brand` | One brand's products by id or link, plus the brand's region and customer satisfaction |
| `get_yesstyle_brands` | Every YesStyle brand (about 4,300), filtered by name and paged |
| `get_yesstyle_deals` | Black Friday, flash sales, clearance, rock-bottom prices, price drops, 24-hour sale, value & gift sets, twin packs, on a department (default Beauty) |
| `get_yesstyle_product` | One product by id or link: price, list price, discount, sale end date, deal claimed share, availability, ingredients, bestseller ranks, packs, shipping and returns; `include_variants` adds every shade / size with its own price |
| `get_yesstyle_reviews` | Customer reviews, 15 a page, 4 sorts, star / positive / negative / photo / video filters, summary with star counts and satisfaction (no reviewer names) |
| `get_yesstyle_suggestions` | Suggested search terms and products for typed text, priced for the shipping country |
| `get_yesstyle_markets` | The 153 shipping countries with currency and language, and which 39 the page tools serve |

Platform key `yesstyle`. Credits: `search_yesstyle`, `get_yesstyle_category`,
`get_yesstyle_brand`, `get_yesstyle_deals` and `get_yesstyle_product` 2
(`get_yesstyle_product` with `include_variants` 3; when the variant list is
unavailable, `variants_status` says so and that part is not charged);
`get_yesstyle_brands`, `get_yesstyle_reviews`, `get_yesstyle_suggestions` and
`get_yesstyle_markets` 1. Billed on what the request actually costs:
`credits_used` in the response is what was charged. Answers usually take 2-30
seconds and can take up to about 225 seconds: allow up to 4 minutes.

Countries (`country`, ISO-2, default `us`; `uk` is read as `gb`): search,
category, brand, deals and product serve 39 shipping countries (ae at au be ca
ch cl cz de dk es fr gb gr hk hu ie il in it jp kr kz mx my nl no nz ph pl pt
ro sa se sg th tw us za); Brazil is held back, and any other country is a 400
before anything is charged. Reviews and suggestions take any of the 153
countries YesStyle ships to. `language` is one of en fr de es it nl pl pt ru
ar zh_TW (default: the country's own on YesStyle). Prices are YesStyle's own
for the shipping country, in its currency; the currency follows the country.
Every answer is checked for its country (`market`). Captured 2026-11-26: COSRX
Advanced Snail 96 Mucin Power Essence was US$ 16.09 in the US (list price 25,
FLASH SALE); the 100ml option (product id 1052684694) was GBP 10.96 in the
United Kingdom and JPY 2,497 in Japan. The search tool does not take `type`,
`region` or `ingredients` (YesStyle's search does not apply them); use the
category, brand or deals tools. Not available: stores, a currency other than
the country's, cart or checkout, price history (poll and store the answers),
EAN / UPC (YesStyle shows none). Failed calls, a page that came back for
another country, and refused inputs are not charged; a not-found (an unknown
product) is charged.

### [Notino](https://scavio.dev/docs/notino-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Notino API for Notino (notino.com, the Brno-based online perfume and cosmetics store with 27 country shops): every size and shade of a perfume or cosmetic with its own price, EAN, the lowest price of the last 30 days Notino shows under EU price rules, the recommended retail price where a storefront shows one, stock level and how many Notino stores hold it; the voucher code, discount and discounted price on every listed item; promo lists with their terms; customer reviews from every storefront (no reviewer names); the brand directory; and Notino's stores with opening hours in 8 countries. 27 storefronts, each in its own language and currency with its own prices. See the [Notino API page](https://scavio.dev/notino-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_notino` | Search by text: 24 a page, 6 sorts, facet filters; Notino's redirects to a brand or category page are reported in `redirected_to` |
| `get_notino_product` | One product by link or order code: every variant with price, EAN, `lowest_price_30d`, RRP where shown, stock level, store count, ingredients; deliveries, gift campaigns and the same product on other storefronts |
| `get_notino_reviews` | Customer reviews, 8 a page, 5 sorts and a star filter, with rating buckets, per-storefront counts and aspect ratings (no reviewer names) |
| `get_notino_category` | One category's products by path or link, same sorts and filters |
| `get_notino_brand` | One brand's products by slug or link |
| `get_notino_promo` | A promo list (default Black Friday) with its terms and each item's deal |
| `get_notino_brands` | A storefront's brand directory (about 1,800 on notino.de), by text, letter or featured |
| `get_notino_suggestions` | Search suggestions: collections, brands and products |
| `get_notino_stores` | Notino's stores and pickup points in one of 8 storefronts, by city |
| `get_notino_store` | One store: services, 7 days of opening hours, address, map link and contact |

Platform key `notino`. Credits: 1 per call, 2 on `gb` (notino.co.uk).
`get_notino_category`, `get_notino_brand` and `get_notino_promo`: page 1
unsorted and unfiltered 1 (2 on `gb`); any other page, sort or filter 3 (4 on
`gb`). `search_notino` 1 (2 on `gb`) with any page, sort or filter; a search
Notino answers with a brand or category page that does not keep the page,
sort or filters 3 (4 on `gb`). `get_notino_reviews`: the newest 8 (page 1, no
star filter) 1 (2 on `gb`; by `order_code` 1, or 4 on `gb`); any other page,
sort or star filter 1 on every storefront. `get_notino_stores` and
`get_notino_store` 1. Billed on what the request actually costs:
`credits_used` in the response is what was charged. Answers can take up to
about 240 seconds (deeper review views, typically 10-45 seconds): allow up to
4 minutes, or 250 seconds on review views as the API asks.

Storefronts (`market`, default `de`; a product or listing link picks its
own): de at ch cz sk pl hu ro bg hr si ua fr be nl it es pt gr gb ie dk se fi
lt lv ee, one language each (be is French, ch German), each with its own
currency and prices. Stores exist on cz sk pl at hu ro bg hr (default `cz`),
listed by city; there is no postcode search. Captured 2026-11-26: DIOR Sauvage
Eau de Parfum 200 ml (order code CHD13588, EAN 3348901428545) was 180 EUR on
notino.de with `lowest_price_30d` 170, and 805 PLN on notino.pl, held by 3
Polish stores; Estée Lauder Advanced Night Repair 75 ml was 134 EUR on
notino.es with an RRP of 179. Sorted by relevance, Notino stops a search near
500 products (`total_capped`); any other sort lists the full set. Voucher
codes show on listings (`items[].deal`), not on the product tool. Not
available: per-store stock (`pickup_store_count` only), a postcode store
search, cart or checkout prices, price history (poll and store the answers),
reviewer names or identity. Failed calls and refused inputs are not charged;
a not-found (a product the storefront does not sell) is charged.

### [Douglas](https://scavio.dev/docs/douglas-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Douglas API for Douglas (douglas.de, the Dusseldorf-based beauty retailer with about 1,960 stores in Europe), on 15 storefronts in 13 countries: the price, Douglas' struck-through price, the discount, the 30-day lowest price Douglas shows beside a reduction and the RRP / UVP, per product and per variant, in each storefront's own currency and language; keyword search, category, brand and deal lists (the sale department and the Beauty / Black Friday list, with the offers page's promotions and their validity text); one product with EAN, ingredients, scent notes and every size or shade; the stores near a city or postcode with opening and holiday hours; Douglas' own review summary; search suggestions and the brand index. See the [Douglas API page](https://scavio.dev/douglas-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_douglas` | Search by keywords: 48 a page, 6 sorts, brand codes, the sale badge and any facet of the page; `redirected_to` when Douglas sends the keyword to a category or brand page |
| `get_douglas_category` | One category by path, code or link, with the search sorts, filters and paging |
| `get_douglas_brand` | One brand's products by brand code, path or link, with the search sorts, filters and paging |
| `get_douglas_deals` | The sale department, the Beauty / Black Friday list or any category's sale-badged products, plus the storefront's promotions (de, at, ch-de, ch-fr, pl) with their legal text |
| `get_douglas_product` | One product by base or variant code or link: price, was price, discount, 30-day low, RRP, unit price, EAN, ingredients, scent notes, stock level and every variant; `variants_ean` adds each variant's EAN |
| `get_douglas_stores` | Stores near a city or postcode: address, phone, coordinates, distance, opening hours, dated holiday hours |
| `get_douglas_store` | One store by id: every stores field plus parking, public transport, top brands, events and service booking |
| `get_douglas_review_summary` | Douglas' own AI-generated summary of a product's reviews (base code) |
| `get_douglas_suggestions` | Search-box suggestions: up to 10 products and the storefront's trending searches |
| `get_douglas_brands` | Every brand on a storefront (about 1,890 on de), filtered by name or letter |

Platform key `douglas`. Credits: 1 per call; 2 on `it` (Italy), where `get_douglas_stores`
and `get_douglas_store` stay 1. `get_douglas_product` with `variants_ean` adds 1 credit
per variant looked up (2 on `it`), up to 10. `credits_used` in the response is what
was charged. Answers can take up to about 210 seconds (a listing page takes 5 to 210
seconds; the brand index up to about 200): allow up to 4 minutes.

Markets (`market`, default `de`): `de`, `at`, `ch-de`, `ch-fr` (CHF), `nl`, `be-nl`,
`be-fr`, `es`, `it`, `pl` (PLN), `cz` (CZK), `sk`, `hu` (HUF), `ro` (RON), `lt`; the
rest in EUR. Names and texts come in the storefront's language, and prices and
assortment differ per storefront. Captured 2026-11-26: Yves Saint Laurent Libre Eau
de Parfum 30 ml (5000005003) on `de` at 52.99 EUR, was 59.99, 30-day low 52.99, RRP
87. `sale_only` is a 400 on `ch-de` / `ch-fr` (Douglas Switzerland shows no sale
badge); `was_price` shows every reduction. Douglas Portugal, Croatia, Slovenia,
Latvia, Estonia and Bulgaria (another shop platform) and France (Nocibe) are not
offered. Not available: review texts, review paging or star filters, per-store
stock, store reservation, price history (poll and store the answers), cart or
checkout. Failed calls and refused inputs are not charged; a not-found (an unknown
code, category, brand or store) is charged.

### [Boots](https://scavio.dev/docs/boots-product?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Boots API for Boots (boots.com, the UK health and beauty retailer with over 1,800 stores, and boots.ie in Ireland): one product by link or product id with the price, Boots' was price and Save amount, unit price, every shade or size, the offers and promo codes on the page and the Advantage Card offers, in GBP on boots.com and EUR on boots.ie; whether the stores near a UK postcode or a point have one product, shade or size in stock; the stores near a postcode or town with their services; and one store's opening hours. Boots search is not available yet: start from a Boots product link or its 8-digit id. See the [Boots API page](https://scavio.dev/boots-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `get_boots_product` | One product by link or 8-digit id: price, was price, saving, size, unit price, `catentry_id`, shades or sizes with their `item_code`, online stock, offers with promo codes, Advantage Card offers, description, ingredients |
| `get_boots_store_stock` | In stock or out of stock at the stores near a UK postcode or a latitude and longitude, nearest first, with each store's hours; no unit counts |
| `get_boots_stores` | Stores near a UK postcode or a town (uk and ie): store number, address, coordinates, distance, services; the place's latitude and longitude for `get_boots_store_stock` on ie |
| `get_boots_store` | One store by page slug or link, store number (boots.com) or exact name: address, phone, hours, pharmacy hours, services |

Platform key `boots`. Credits: 1 per call; 2 when Boots answered only on a second
attempt (3 for two-step lookups: a product by `product_id`, a store by
`store_number` or `name`). `credits_used` in the response is what was charged.
Answers usually take 2 to 60 seconds and can take up to about 200 seconds: allow up
to 4 minutes.

Markets (`market`, default `uk`): `uk` (boots.com, GBP) and `ie` (boots.ie, EUR: its
own prices, and some UK products are not sold there). Captured 2026-11-26: CeraVe AM
Facial Moisturising Lotion SPF30 52ml (10331199) at 11.62 GBP on `uk` (was 15.50) and
13.50 EUR on `ie` (was 18); near SW11 1QN it was in stock at 79 of 85 stores.
`get_boots_store_stock` takes `item_code` and `catentry_id` from `get_boots_product`;
on `ie` it takes latitude and longitude (from `get_boots_stores` with a town). When no
store near the place has the item, `stores` is empty and the answer is charged (an
unknown item code answers the same way). Not available: search, category, brand and
deal lists, reviews, ratings, type-ahead, stock counts, price history (poll and store
the answers). Failed calls and refused inputs are not charged; a not-found is charged.

### [Instacart](https://scavio.dev/docs/instacart-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Instacart API for Instacart (instacart.com, the US and Canada grocery delivery and pickup marketplace): Instacart prices by store at a ZIP. Every store delivering to a ZIP with its pricing label, one product priced at every one of those stores, one query across up to 10 stores, a store's search, aisles, deals and pickup locations, and delivery, pickup or in-store prices side by side.

| Tool | Description |
|------|-------------|
| `get_instacart_retailers` | Every store serving a ZIP or Canadian postal code: slug (the `retailer` input of the other tools), delivery and pickup ETA text, `no_markups` (Instacart's "No markups" label), EBT, pickup / delivery availability |
| `search_instacart` | Search one store at a ZIP: price, was price, deal badge, unit price, loyalty price, stock, dietary labels, brand filters; sorts best_match, price_asc, price_desc; `on_sale`, `brand_id`, paging; `service_type` delivery, pickup or instore |
| `get_instacart_cross_search` | One query across up to 10 stores delivering to a US ZIP, each store's first matching products priced (up to 20 per store); us only |
| `get_instacart_product` | One product at one store: ingredients, warnings / allergens, key nutrients as given, images, size, the store's price block, rating summary |
| `get_instacart_price_compare` | The same product priced at every store delivering to the ZIP, Instacart delivery prices sorted low to high |
| `get_instacart_categories` | One store's department and aisle tree, with the slugs for `get_instacart_category` |
| `get_instacart_category` | The products of one department, aisle or collection, paged |
| `get_instacart_deals` | One store's Sales collection: sale price with the regular price, multi-buy offers; no coupons |
| `get_instacart_stores` | A retailer's pickup locations near the ZIP, nearest first, with 7 days of hours for the 5 nearest |
| `get_instacart_suggestions` | Search suggestions for a partial query, for one store or every store at the ZIP; English only |
| `get_instacart_reviews` | One product's customer reviews, 15 a page, rating summary, syndication source and incentivized flag; no reviewer identity; us only |

Platform key `instacart`. 1 credit per call; `search_instacart` 3 (2 when the
page fits in Instacart's first answer); `get_instacart_cross_search` 3 for up
to 5 stores, 4 for 6 to 10. Markets (`country`, default us): us
(instacart.com, USD) on every tool; ca (instacart.ca, CAD) on every tool
except cross-search and reviews (a 400, not charged). `language` fr (Canada
only) returns French names, aisles and price text as Instacart shows them in
Quebec; suggestions are English only. `zip` is required: a US ZIP, or a
Canadian postal code with country ca. A ZIP with no Instacart service area
answers an empty list and a note.

Every price is Instacart's price for that store, ZIP and service type, named
in `priced_for` with the retailer's pricing label as Instacart shows it (e.g.
Costco "Prices are higher than your local warehouse."). Retailers set their
Instacart prices, which can be above their in-store prices, so an Instacart
delivery price is not the store's shelf price; `service_type` instore returns
Instacart's in-store prices where it shows them. Product ids are the same at
every store. `get_instacart_price_compare` carries no unit price or stock
(`get_instacart_product` gives them per store). For direct shelf prices see
the Kroger, Costco, ALDI, Publix and Whole Foods tools. Not available:
delivery and service fees or order minimums as numbers (Instacart shows them
at checkout), coupons, Instacart+ member prices, account, order or cart data,
price history (poll and store the answers). Failed calls and refused inputs
are not charged; a not-found (an unknown ZIP, product id or category, or a
store that does not serve the ZIP) is charged.

### [PC Express](https://scavio.dev/docs/pcexpress-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

PC Express API for PC Express (Loblaw's online grocery for Real Canadian Superstore, No Frills, Loblaws, Zehrs, Fortinos, Valu-mart, Your Independent Grocer, Wholesale Club, Provigo and Maxi; Loblaw operates 2,504 stores per its 2025 annual report): what each Loblaw banner charges for the same product code at its default store on one date, with the deal end date and the PC Optimum offer as shown. Keyword search, category and collection (deals centre, Black Friday) lists, one product with GTIN, ingredients, nutrition and comparison prices, a banner's pickup stores and one store's hours, and search suggestions. See the [PC Express API page](https://scavio.dev/pcexpress-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_pcexpress` | Search one banner by keywords or article number: price, was price, unit price, deal with expiry date, PC Optimum points, member-only price, badges, stock status; 48 a page, 5 sorts, filters (brand, deals, price band, Prepared in Canada, dietary, aisle, any facet); `redirected_to` when PC Express sends the term to a collection or category |
| `get_pcexpress_category` | One category by id or link: a product list (paged, sorted, filtered) or a department's carousels and sub-categories |
| `get_pcexpress_collection` | One collection page (deals-centre, black-friday, no-name, pc-value, new-arrivals ...): products with prices and deals, in sections |
| `get_pcexpress_product` | One product by code or link: GTIN, ingredients, nutrition, comparison prices, unit price, deal, promotions, deposit, stock status as given |
| `get_pcexpress_stores` | A banner's pickup stores by city, postal code start or province, or nearest a latitude and longitude, with today's hours |
| `get_pcexpress_store` | One store by id: 7 dated days of store, pharmacy, clinic, optical and holiday hours, services |
| `get_pcexpress_suggestions` | The search terms PC Express suggests for a partial query |

Platform key `pcexpress`. Credits: `get_pcexpress_product` and
`get_pcexpress_store` 5 (product 1 when it answers from the search listing,
`source` search); every other tool 1. `credits_used` in the response is what
was charged. Answers can take up to about a minute; product, store, stores
and suggestions can take longer: allow up to 2 minutes.

Canada only, prices in CAD. `banner` (default `superstore`): `superstore`,
`nofrills`, `loblaw`, `zehrs`, `fortinos`, `valumart`, `independent`,
`wholesaleclub`, `provigo`, `maxi`. `language` is `en`, or `fr` on `provigo`
(French only) and `maxi` (French by default, English too). Prices are each
banner's default online store's; choosing a store is not offered (a
`store_id` on a priced tool is a 400, not charged), and every answer says which
store priced it in `store` (`requested` false). The same product code is priced
per banner: captured 2026-11-26, No Name Large Size Eggs 12 Pack
(20812144001_EA) was 3.93 CAD at Real Canadian Superstore's default store 1033
and 4.17 at Maxi's default store 8976. Deals carry the end date PC Express
shows (`expiry_date`), no start date; PC Optimum points are as shown;
`member_only_price` is the price the site shows publicly on the item. For
national brands at Walmart.ca use the Walmart tools with domain `ca`. Not
available: choosing a store, review text (rating and count only), the printed
flyer, Shoppers Drug Mart, Atlantic Superstore, City Market and T&T, cart or
checkout, PC Optimum prices behind a login, price history (poll and store the
answers). Failed calls and refused inputs are not charged; a not-found (an
unknown code, category, collection or store) is charged.

### Micro Center

| Tool | Description |
|------|-------------|
| `search_micro_center` | Search by keyword or category at one store: price, original price, stock count at that store, open-box count and lowest price, rebate text |
| `get_micro_center_product` | One product: specs, UPC, reviews, the store's stock and open-box units, and an in-stock yes/no for every store |
| `get_micro_center_stores` | Every store with its 3-digit store_id, city, state and address |

2 credits per call; `get_micro_center_stores` is 1. Stock is per 3-digit
`store_id` (e.g. `"131"`, Dallas); without one, the web store `029` (shippable
items) is used. Counts are capped at 25+ (`quantity_capped`).

### Walgreens

| Tool | Description |
|------|-------------|
| `search_walgreens` | Search retail products (no pharmacy): regular, sale and unit price, promotions, coupons, rating, availability, clearance flag |
| `get_walgreens_product` | One product: SKU, UPC, price, savings, offers, ingredients, warnings, rating, category path, images |
| `get_walgreens_stores` | Walgreens and Duane Reade stores near a ZIP or coordinates: store number, address, phone, hours |
| `get_walgreens_stock` | One product's live stock at up to 20 stores in one call: status, unit count, in_stock |

2 credits per call; `get_walgreens_stock` is 4. Prices are national, the same
at every store. Store numbers (from `get_walgreens_stores`, e.g. `"9438"`) go to
`get_walgreens_stock` as `store_ids`.

### CVS

| Tool | Description |
|------|-------------|
| `search_cvs` | Search front-store products (no pharmacy): regular, sale and unit price, promotions, coupons, rating, and units in store and for pickup at one store |
| `get_cvs_product` | One product by URL or id: price, promotion end date, UPC, ingredients, directions, warnings, every variant |
| `get_cvs_stock` | Units at one store for up to 20 SKUs: in store, pickup, online |

`search_cvs` and `get_cvs_stock` are 1 credit per call, `get_cvs_product` 2.
There is no store locator: the store number is on every
cvs.com store page (e.g. `"7019"`). Search stock defaults to store 7019 (New
York). Prices are the same at every store. `get_cvs_product` can take 10-30+
seconds.

### Whole Foods Market

| Tool | Description |
|------|-------------|
| `search_whole_foods` | Search at one store: regular, sale and Prime member price, sale dates, on-sale and local flags, category and diet facets |
| `get_whole_foods_category` | One category at one store, same fields as search, with 6 sorts and on-sale and diet filters |
| `get_whole_foods_deals` | Every sale item at one store, store-wide or in one category |
| `get_whole_foods_product` | One product by ASIN, URL or slug: ingredients, nutrition facts, diets, plus that store's in-store and online prices as separate blocks |
| `get_whole_foods_stores` | Stores near a ZIP: store_id, address, phone, distance, in-store and pickup hours |
| `get_whole_foods_store` | One store: status, phone, Prime eligibility, opening date, address, sales flyer URL |
| `get_whole_foods_sales_flyer` | One store's current weekly flyer: each promotion's regular, sale and Prime price as printed, dates, ASINs covered |

1 credit per call. Prices are per 5-digit `store_id` (from
`get_whole_foods_stores`); without one, store `10145` (Austin) is used. Search
sorts only by relevance, `price_asc` or `price_desc`. No ratings, reviews, UPCs
or per-store unit stock.

### Harbor Freight

| Tool | Description |
|------|-------------|
| `search_harbor_freight` | Search by keyword and/or category: price, sale price and end date, public coupon price, Inside Track member price, compare-at price, rating, facets |
| `get_harbor_freight_clearance` | Clearance items, optionally narrowed by keyword, category or brand, same fields as search |
| `get_harbor_freight_product` | One product by item number, id or URL: every price above, UPC, specs, warranty, manuals, variants |
| `get_harbor_freight_prices` | Current prices for up to 50 item numbers in one call |
| `get_harbor_freight_stores` | Stores near a ZIP, "City, ST" or coordinates: store_id, address, phone, hours |
| `get_harbor_freight_availability` | Up to 20 items at chosen or nearest stores: stock status (in_stock, limited, out_of_stock, not_carried) and aisle |
| `get_harbor_freight_reviews` | Reviews for one item, newest first, with average rating and total count |

1 credit per call. Prices are national. Store stock is a status from a daily
snapshot (`inventory_updated_at`), not a unit count.

### [AutoZone](https://scavio.dev/docs/autozone-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

AutoZone API for AutoZone (autozone.com, the US auto parts retailer): AutoZone parts prices by vehicle, the parts that fit a year / make / model in a part type, with price, was price, deal price, core charge, warranty and pickup availability for the store AutoZone prices the request for; part-number cross-reference; full product detail with ratings; every review; the store directory; clearance and mail-in rebates; plus search, product and store stock at a chosen store on AutoZone Brazil.

| Tool | Description |
|------|-------------|
| `search_autozone` | Search by keywords, an AutoZone part number or another brand's part number (cross-reference: PH3614 finds the parts AutoZone matches to it): the first 24 results with AutoZone's total, price, `was_price`, `deal_price`, `core_charge`, warranty, fitment, availability per fulfilment option, facets; sorts relevance, price_asc, price_desc; one facet filter, `brand`, `min_price`, `max_price`; us and br |
| `get_autozone_product` | One product by item id or link: specifications, features, safety data sheets, fitment type, price, was price, deal price and label, core charge, warranty, availability per fulfilment option, rating distribution; us and br |
| `get_autozone_category` | One part type's products by path, optionally only the parts that fit a `vehicle` {year, make, model}, with sorts, one facet filter and a price range |
| `get_autozone_brand` | One brand's products (duralast, mobil-1), optionally within one part type |
| `get_autozone_vehicles` | The vehicle selector one level at a time: years, makes, models, submodels and engines (submodels and engines us only) |
| `get_autozone_reviews` | One product's reviews, 10 a page, full depth, sorts default, most_recent, most_helpful, a star filter, the rating distribution, AutoZone's review summary on page 1, the reviewer's vehicle as written and review photos; no reviewer identity; us only |
| `get_autozone_stores` | The store directory one level at a time: states, then cities, then a city's stores with address and hours; us, br, mx |
| `get_autozone_store` | One store by slug or link: address, phone, coordinates, hours and holiday hours; us, br, mx |
| `get_autozone_categories` | The category menu (about 23 departments) with the part type paths for `get_autozone_category`; us, br, mx |
| `get_autozone_clearance` | AutoZone's clearance list (us) |
| `get_autozone_rebates` | AutoZone's current mail-in rebates (us) with end date, postmark date and the form link |
| `get_autozone_store_stock` | Brazil only: one product at a Brazilian store you choose, with that store's price and in-store quantity |

Platform key `autozone`. 1 credit per call; 2 on br `search_autozone`,
br `get_autozone_product` and `get_autozone_store_stock`. Markets (`country`,
default us): us (autozone.com, USD) on every tool; br (autozone.com.br,
Portuguese text, BRL) on search, product, store stock, vehicles, stores, store
and categories; mx (autozone.com.mx) on vehicles, stores, store and categories
only (Mexico search and product are a 400, not charged: AutoZone Mexico prices
only for a Mexican store it does not reliably assign).

Every price is AutoZone's price for the store AutoZone assigns to the request,
named in `priced_for` (store number, address, city, state, ZIP). AutoZone
prices differ by store, core charges too, so the same part can cost more or
less elsewhere and two calls can be priced for different stores; there is no
store or ZIP input on us. `core_charge` is the refundable deposit AutoZone adds
on parts like batteries until the old part is returned (0 when none). Lists
(search, category, brand, clearance) return the first 24 results with
AutoZone's `total`, with no paging: narrow with one facet filter, a price range
or a sort. List items carry no rating (`get_autozone_product` does). Vehicle
fit is at year / make / model level: items AutoZone ties to an engine read
`fitment.vehicle_fit` NEEDS_BASE_VEHICLE. AutoZone runs search ranking tests
(`ranking_variant`), so totals and order can differ between two identical
calls. Brazil search and product are priced for store 7602 Sao Paulo
(Interlagos); `get_autozone_store_stock` prices for the Brazilian store you
name. Not available: results past the first 24, stores near a ZIP, stock at a
chosen US or Mexican store, search suggestions, VIN lookup, engine-level
fitment, repair guides, AutoZonePro / commercial pricing, Mexico prices, price
history (poll and store the answers), checkout. Failed calls and refused inputs
are not charged; a not-found (an unknown item id, vehicle, brand, state, city
or store) is charged.

### [O'Reilly Auto Parts](https://scavio.dev/docs/oreilly-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

O'Reilly Auto Parts API for O'Reilly Auto Parts (oreillyauto.com, the US auto parts retailer): O'Reilly part-number cross-reference with prices (another brand's, AutoZone's or an OE part number in, O'Reilly's matching parts out), the parts that fit a vehicle, with price, sale price, core charge, rebates and pickup availability for the store O'Reilly prices the request for; store stock near a ZIP; full product detail with the rating and the 10 most recent reviews; VIN decode; the store directory (US and Mexico); rebates and deals. Pair it with [AutoZone](https://scavio.dev/autozone-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for a two-store parts price check on the same part.

| Tool | Description |
|------|-------------|
| `search_oreilly` | Search by keywords or an O'Reilly part number: 24 a page, pages 1-20, with O'Reilly's total, price, `regular_price`, `sale_price`, `core_charge`, warranty, fit notes, availability per fulfilment option, deals, facets; sorts relevance, price_desc, price_asc, best_selling, brand; `brand`, `availability` (store_pickup, home_delivery) and attribute facet filters; optionally only parts for a `vehicle` {base_vehicle_id} |
| `get_oreilly_cross_reference` | O'Reilly's parts that replace another brand's or an OE part number (FRAM PH3614, Motorcraft FL820S), in the search item shape; with several manufacturers on one number it answers the lists to choose from first |
| `get_oreilly_product` | One product by link or by `line_code` + `part_number`: UPC, specifications, description, images, documents, breadcrumbs, price, core charge, deals, rebates, availability, rating and the 10 most recent reviews; with `vehicle`, `vehicle_fit` (fits true or null, never false) |
| `get_oreilly_vehicles` | The vehicle selector one level at a time: types, years, makes, models, submodels, engines; `resolve` for the `base_vehicle_id` the vehicle inputs take; `vin` decodes a 17-character VIN |
| `get_oreilly_compatibility` | The makes one part fits; with `make`, the models, engines and years |
| `get_oreilly_category` | One category's products by link or path, with the list sorts, filters, paging and `vehicle` |
| `get_oreilly_categories` | The category tree (about 34 departments, 1,300 nodes) with the links for `get_oreilly_category` |
| `get_oreilly_brand` | One brand's products by brand link, or without one the brand index |
| `get_oreilly_store_stock` | Which stores within 50 miles of a ZIP or a point can hand over one part: in store now, store pickup, pickup time and distance; availability states, not unit counts |
| `get_oreilly_stores` | The 25 nearest stores within 50 miles of a ZIP or a point, with hours, holiday adjustments and services; or the store directory by state (+ city), us and mx |
| `get_oreilly_store` | One store: us by store id; us or mx by directory link; mx by store number + state + city |
| `get_oreilly_suggestions` | Part-type search suggestions for typed text, with the category each opens |
| `get_oreilly_rebates` | O'Reilly's current rebates with valid dates, postmark-by date, terms and the form (PDF) |
| `get_oreilly_deals` | O'Reilly's coupons, offers and promotions (O'Reilly's own text) plus its deals menu |

Platform key `oreilly`. 2 credits per call, with these exceptions:
`get_oreilly_product` by `line_code` + `part_number` 4 (by link 2);
`get_oreilly_cross_reference` 2 with `part_type_id` + `manufacturer`, 4 with
one of them or when several manufacturers use the number, 6 with neither when
one manufacturer matches; `get_oreilly_brand` index (no brand) 4;
`get_oreilly_store_stock` and `get_oreilly_stores` by ZIP 4 (by latitude +
longitude, or the directory, 2); `get_oreilly_deals` 4. Markets (`country`,
default us): us (oreillyauto.com, USD) on every tool; mx on
`get_oreilly_stores` and `get_oreilly_store` only (O'Reilly's Mexican store
directory, in Spanish; Mexico shows no prices, so mx elsewhere is a 400, not
charged).

Every price is O'Reilly's price for the store O'Reilly assigns to the request,
named in `priced_for` (store id, address, city, state, ZIP). O'Reilly prices
differ by store, so two calls can be priced for different stores; there is no
store or ZIP input for prices. `core_charge` is the refundable deposit O'Reilly
adds on parts like batteries until the old part is returned (0 when none).
Lists (search, category, brand, cross-reference) return 24 a page and O'Reilly
serves 20 pages (a page above 20 is a 400, not charged). List items carry no
rating (`get_oreilly_product` does). Vehicle fit is at year / make / model
level (submodel and engine show in `fit_notes`); `vehicle_fit.fits` on a
product is true or null, never false, so check fit with a vehicle search,
category or `get_oreilly_compatibility`. A cross-reference can return 0
matches. Store stock is availability states, not unit counts. Not available:
unit counts in store stock, a chosen store for prices, reviews past the 10 most
recent (no paging, sort or star filter), Q&A, Mexico prices or catalog, Canada,
license-plate lookup, the weekly ad, repair guides or trouble codes, O'Reilly
Pro / First Call Online commercial pricing, price history (poll and store the
answers), checkout. Failed calls and refused inputs are not charged; a
not-found (an unknown product, VIN, category, brand, state, city or store) is
charged.

### PetSmart

| Tool | Description |
|------|-------------|
| `search_petsmart` | Search products: price, original and sale price, rating, how many stores stock it, pickup and Autoship eligibility; `store_id` lists only what that store has |
| `get_petsmart_product` | One product with every size/flavor: price, sale price and end date, Autoship first-order and recurring price, ship and pickup options |
| `get_petsmart_stores` | The 12 stores nearest a ZIP with hours and services; pass a `sku` for each store's unit count |
| `get_petsmart_store_stock` | Units at one store for up to 20 SKUs, plus a nearby store that has it |
| `get_petsmart_availability` | Unit counts for up to 20 store and SKU pairs in one call |
| `get_petsmart_deals` | The Sale section by pet, sale event or keyword, with the current sale events |

1 credit per call. Prices are national. The Sale section also lists points and
Autoship promotions, so `on_sale` marks the rows whose price is actually
reduced.

### Petco

| Tool | Description |
|------|-------------|
| `search_petco` | Search products: price, list price, Repeat Delivery (autoship) price, rating, fulfillment flags, every variation |
| `get_petco_category` | Products in a category path, e.g. `dog/dog-food/dry-dog-food`, same fields as search |
| `get_petco_product` | One product by part number or URL with every variant: cat_entry_id, UPC, prices, first-autoship price, ingredients, guaranteed analysis |
| `get_petco_stores` | Up to 10 stores nearest a ZIP: store_id, store number, address, hours |
| `get_petco_store_inventory` | Units on hand at one store for up to 10 products |

1 credit per call. Prices are national. `get_petco_store_inventory` takes
`cat_entry_id` values (from search or product), not part numbers, and a
`store_id` from `get_petco_stores` or a ZIP. `get_petco_product` and
`get_petco_category` can take 10-30 seconds.

### iHerb

| Tool | Description |
|------|-------------|
| `search_iherb` | Search by keyword: price, list price, discount, rating, review count, stock, badges, recent sales; brand filter |
| `get_iherb_product` | One product: UPC, price per serving, supplement facts, expiration date, best-seller rankings, variants |
| `get_iherb_prices` | Price, discount, stock, rating and review count for up to 50 products in one call |
| `get_iherb_reviews` | Rating summary: average, star histogram, counts per language, top positive and top critical review |

2 credits per call. US store, USD. iHerb is online only, so there are no store
tools. `get_iherb_reviews` is a summary, not a full review list.

### Chewy

| Tool | Description |
|------|-------------|
| `search_chewy` | Search or browse a category: one-time, Autoship and first-Autoship price, MAP price, per-unit price, rating, stock |
| `get_chewy_product` | One product by id or URL: every price above, review count and star distribution, GTIN, ingredients, every variant |

10 credits per call. Some broad queries go straight to a category; `redirect`
then names it. No store data.

### Menards

| Tool | Description |
|------|-------------|
| `search_menards` | Search one store, 40 per page: price, sale price, rebate, final price and that store's stock count; sort by price or brand, in-stock-today and price filters |
| `get_menards_product` | One product by item id or URL: everyday and sale price, mail-in rebates (e.g. 11%), final price after rebates; `store_id` adds stock quantity and aisle |
| `get_menards_stores` | Stores near a ZIP or a city and state: store_id, address, distance, services |

`search_menards` is 2 credits and needs a `store_id` from `get_menards_stores`.
`get_menards_product` is 1 credit, 2 with `store_id` (10-40 seconds); take the
item id from a search result or a menards.com product URL (`p-60893666613.htm`).
`get_menards_stores` is 1 credit.

### Nordstrom

| Tool | Description |
|------|-------------|
| `search_nordstrom` | Search nordstrom.com (US), 24 per page: price and price range, original price, percent off, on-sale flag, rating, review count, badges, low-inventory flag, marketplace seller, colors; sort by rating, price, newest or percent off |
| `get_nordstrom_product` | One product by URL or style id: every color and size as a sku with UPC, price, price type and quantity available to ship, star histogram, size-fit distribution, praised and criticized features, and the reviews shown on the product page |
| `get_nordstrom_category` | Browse a category, sale section (`sale/women`) or new arrivals (`/browse/new`), 24 per page: the same product rows as search plus the category's breadcrumbs, subcategories and filter sidebar with product counts |
| `get_nordstrom_brand` | A brand page (`/brands/astr-the-label--53360` or a product's `brand_url`), 24 per page: the same product rows as search plus the brand's sub-pages and filter sidebar |
| `get_nordstrom_stores` | Full-line stores and Nordstrom Local near a ZIP or latitude/longitude (up to 100 miles), or by store number: address, phone, weekly and daily hours, coordinates, pickup and curbside flags, amenities |
| `get_nordstrom_availability` | Per sku of one product: ship quantity, pickup quantity (chain-wide) and the stores that offer in-store pickup |
| `get_nordstrom_suggestions` | The nordstrom.com search-box autocomplete for a partial term |
| `get_nordstrom_reviews` | A product's full review history, up to 200 per call: sort by most helpful, most recent, highest or lowest rated; filter by stars, verified purchases, photos or text; plus the rating summary, histogram, size and width rating, praised and criticized features and the AI review summary |

5 credits per call; `get_nordstrom_availability` is 10 (the product page plus the
store lookup) and `get_nordstrom_reviews` is 10. US site only. Product,
reviews and availability take a result's `url` or `style_id`; an unknown style
id is a 404. Product reviews are the ones shown on the product page (up to
about 13) plus the total review count and star histogram;
`get_nordstrom_reviews` returns the rest (rating-only reviews included, without
text). It takes 20-60s, up to about 100s at 200 reviews, so lower
`max_reviews` if your client times out long tool calls; `sort` cannot be
combined with `search`. A sku's `quantity` is units
available to ship, and `in_stock` means it can be shipped or picked up in a
store, so a sku can read in stock with quantity 0. Availability quantities are
chain-wide: per store Nordstrom only says whether pickup is available, not how
many units. A ZIP with no store within range returns an empty list (billed).
For nordstromrack.com see [Nordstrom Rack](#nordstrom-rack).

### Nordstrom Rack

| Tool | Description |
|------|-------------|
| `search_nordstromrack` | Search nordstromrack.com (US), 24 per page: price and price range, compare-at price, percent off, on-sale flag, clearance price range, any promotion on top (`promotion_price_range`, `promotion_percent_off`), rating, review count, badges, low-inventory flag, marketplace seller, colors; sort by rating, price, newest or percent off |
| `get_nordstromrack_product` | One product by URL or style id: every color and size as a sku with UPC, price, price type and quantity available to ship, clearance and promotion price ranges, star histogram, size-fit distribution, praised and criticized features, and the reviews shown on the product page |
| `get_nordstromrack_category` | Browse any `/shop` or `/clearance` listing: departments, deals, new arrivals, Clear the Rack (`/clearance`) and flash events (`/shop/flash` lists them, `/shop/flash/event-7` opens one), 24 per page, with breadcrumbs, subcategories and the filter sidebar |
| `get_nordstromrack_brand` | A brand page (`/brands/adidas` or a product's `brand_url`), 24 per page: the same product rows as search plus the filter sidebar |
| `get_nordstromrack_stores` | Nordstrom Rack stores near a ZIP or latitude/longitude (up to 100 miles), or by store number: address, phone, weekly and daily hours, coordinates, pickup and curbside flags, amenities |
| `get_nordstromrack_availability` | Per sku of one product: ship quantity, pickup quantity (chain-wide) and the Rack stores that offer in-store pickup |
| `get_nordstromrack_suggestions` | The nordstromrack.com search-box autocomplete for a partial term |
| `get_nordstromrack_reviews` | A product's Rack review history, up to 200 per call: sort by most helpful, most recent, highest or lowest rated; filter by stars, verified purchases, photos or text; plus the rating summary, histogram, size and width rating, praised and criticized features and the AI review summary |

Nordstrom Rack is its own platform key (`nordstromrack`), separate from
`nordstrom`. 5 credits per call; `get_nordstromrack_availability` is 10 and
`get_nordstromrack_reviews` is 10. US site only. Category takes Rack paths
(`/shop/...`, `/clearance/...`, `/shop/flash/event-N`); there is no `/browse`.
Brand paths have no id (`/brands/adidas`); the nordstrom.com `--<id>` form is a
404. During Clear the Rack a clearance item can carry an extra percent off on
top of its clearance price: `promotion_price_range` is the price after it and
`promotion_percent_off` the extra percent. Rack has its own review pool,
separate from nordstrom.com's, so the same style can show a different rating
and review count on each. Reviews take 15-60s, up to about 100s at 200; lower
`max_reviews` if your client times out long tool calls. Stores and availability
cover Rack stores only, and availability quantities are chain-wide: per store
the site only says whether pickup is available, not how many units.

### Best Buy

| Tool | Description |
|------|-------------|
| `search_bestbuy` | Search bestbuy.com (US), 18 organic products per page: SKU, model, price, regular price, savings, on-sale flag, deal badge, condition, rating, review count, seller type; filter by brand, on sale, clearance, open box or a price range; sort by best match, best selling, best discount, price, rating or newest; plus the filter sidebar with counts; `country: "ca"` for Best Buy Canada |
| `get_bestbuy_product` | One product by SKU or URL: UPC, model, every open-box offer by condition (fair, good, excellent) with its price and savings against new and against the regular price, financing, the full specification table, the AI review summary, features, images and manuals; for Canada sale start / end, EHF by province and open-box / refurbished SKUs with their own prices |
| `get_bestbuy_reviews` | First-party Best Buy reviews, 20 per page, sorted or filtered to one star rating, with the star histogram, recommended percent and the most mentioned pros and cons with mention counts; for Canada verified-only, with-photos and French-only filters |
| `get_bestbuy_category` | Browse a category (`abcat...`) or merchandised deals page (`pcmcat...`) by id or URL, 18 per page, with the same filters and sorts as search; for Canada a numeric id (e.g. `21344` Televisions) or `departments`, with the category tree |
| `get_bestbuy_deals` | Today's Deal of the Day and the more-deals row, up to 15 products with live prices; for Canada one deal collection (`black_friday`, `top_deals`, `clearance`, `open_box`, `refurbished`) |
| `get_bestbuy_stores` | Best Buy stores near a US ZIP, up to 15, with dated opening hours for the next 35 days; for Canada near a postal code, a city or latitude / longitude |
| `get_bestbuy_availability` | Store pickup status of one SKU at up to 8 stores (nearest a ZIP or given store ids): in_stock, limited, ship_to_store, out_of_stock, not_available_for_pickup or unknown, with the pickup date; for Canada exact units per store for up to 20 SKUs at up to 50 stores |
| `get_bestbuy_suggestions` | The bestbuy.com search-box autocomplete, each term with its categories and SKUs; for Canada search terms only |
| `get_bestbuy_prices` | Current price, regular price, savings, deal badge and deal end for up to 15 SKUs in one call; for Canada up to 20 SKUs with the sale end and EHF |
| `get_bestbuy_questions` | Best Buy Canada only: customer questions about one product, each with its answer count and top answer |

Platform key `bestbuy`. US (bestbuy.com, the default): 2 credits per call;
`get_bestbuy_category` is 3 on a `pcmcat` page, `get_bestbuy_deals` 3,
`get_bestbuy_stores` and `get_bestbuy_suggestions` 1, and
`get_bestbuy_availability` 2 flat for up to 8 stores. `get_bestbuy_prices` is 2
per call whatever the number of SKUs (up to 15). Product, reviews and
availability take `sku` or `url`; availability takes exactly one of `zip` or
`store_ids`, and `min_price` and `max_price` go together. Availability is store
pickup status, not unit counts: Best Buy publishes a quantity only when it shows
"only N left" (`limited`), so `quantity` is null for `in_stock`. Availability
takes 5-20s. An unknown SKU is a 404 and is not billed.

**Best Buy Canada** (bestbuy.ca, Best Buy's Canadian store: 142 stores across
Canada per Best Buy's FY2026 10-K, plus a marketplace of third-party sellers):
pass `country: "ca"` to any of the nine tools; `get_bestbuy_questions` is
Best Buy Canada only and needs no country. 1 credit per call on every Canada
call. Prices in CAD as Best Buy Canada gives them. The price is national (the
same in every province and store); only the environmental handling fee varies
by province: `province` (default `ON`) sets `ehf`, and product and prices also
return `ehf_by_province`. `language: "fr"` returns French names, specs and
links (same SKUs and prices). Listings take `page_size` 1-100 (default 24), the
sorts `best_match`, `price_low`, `price_high` and `rating` (`best_selling`,
`best_discount` and `newest` are a 400 for Canada), and the extra filters
`rating`, `sold_by`, `seller`, `in_stock_online` and `facets`; results are
capped at the first 2,000 of a query (`results_capped`). Marketplace sellers
come back named as Best Buy Canada lists them. Product carries the UPC,
`sale_starts_at` / `sale_ends_at` (UTC) and the Geek Squad open-box, open-box
and refurbished SKUs with their own prices; its `rating` and `review_count`
are null (read them from `get_bestbuy_reviews` or `get_bestbuy_prices`).

Availability for Canada returns exact units per store: captured 2026-11-25,
the Apple MacBook Air 13.6" (2026, M5, 16GB / 512GB, SKU 19791103) at 35 units
in the Centreville store in Montreal (store 651), at 1589.99 CAD (regular
1789.99, sale ending 2026-12-03 07:00 UTC). A store with no stock record for
the SKU comes back `status: "unknown"` with `units: null`, never out of stock.
Stores take a `postal_code` (`radius_km` 1-100), a `city` or `latitude` +
`longitude`. Deals for Canada are a collection, not a Deal of the Day (Best Buy
Canada has none); `dates_text` carries the collection's own dates when its page
states them ("Sale kicking off November 19 and running until December 3" on
the Black Friday collection, captured 2026-11-25).

Not available for Canada: per-store prices (the price is national), a Deal of
the Day, results past 2,000 per query, review photos hosted off Best Buy, cart
or checkout, price history (poll and store the answers). Best Buy's developer
API (developer.bestbuy.com) covers bestbuy.com only. For the same model at
other Canadian retailers use the [Amazon](https://scavio.dev/amazon-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (`country: "ca"`),
[Walmart](https://scavio.dev/walmart-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (`domain: "ca"`), [Costco](https://scavio.dev/costco-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)
(`country: "ca"`) and [Canadian Tire](https://scavio.dev/canadiantire-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)
tools; match on brand and model. See the
[Best Buy API page](https://scavio.dev/bestbuy-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

### [Newegg](https://scavio.dev/docs/newegg-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Newegg API for Newegg (newegg.com, the US computer and electronics store), newegg.ca and 9 Newegg Global storefronts: keyword search, category listings and the newegg.com category tree with Newegg's filters and sorts; one item in full with list price, price after instant rebate, promo code apart, Newegg's own 30-day lowest price, stock, seller, specs, warranty and variants; every seller's offer on an item, Newegg's own included, by condition; customer reviews with pros, cons and verified-owner marks; Shell Shocker daily deals and the Black Friday store; a marketplace seller's store details and listings; and search suggestions. See the [Newegg API page](https://scavio.dev/newegg-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_newegg` | Keyword search with named filters (sold by Newegg, in stock, condition, open box, 30-day lowest price, 40% off) or facet ids and 6 sorts; items, facets, this storefront's category ids and breadcrumbs |
| `get_newegg_category` | The items of one category by `category_id` (ids differ per storefront), with keywords, filters and sorts as search |
| `get_newegg_categories` | The newegg.com menu tree: departments and categories with the ids `get_newegg_category` takes (us only) |
| `get_newegg_product` | One item by item number: prices, rebate, promo code, 30-day lowest price, badges with dates, stock, quantity limit, seller, specs, warranty, variants, review summary and questions; `buy_box_changed`, `requested_item` and `served_item` when the page serves a marketplace offer |
| `get_newegg_offers` | Every seller's offer on one item, all, new or used, by price or seller rating, with each condition's offer count and lowest price (us, ca) |
| `get_newegg_reviews` | Customer reviews of one item, 25 a page, by helpfulness, date or rating, star filter and verified owners only; takes the item's `review_params` |
| `get_newegg_deals` | Shell Shocker daily deals (with the countdown end) or the Black Friday store, optionally one category (us, ca) |
| `get_newegg_seller` | A marketplace seller's store: rating, review count, positive percent, about and return policy (us, ca) |
| `get_newegg_seller_products` | The items one marketplace seller lists, with keywords, filters and sorts (us, ca) |
| `get_newegg_suggestions` | The search box's suggestions and suggested products for what has been typed (us, ca) |

Platform key `newegg`. Credits: 2 per call on every tool; `credits_used` in the
response is what was charged. Answers usually take a few seconds; a retried
call can take up to about 4 minutes: allow a client timeout of at least 240 s.

Markets (`country`, default `us`): `us` (www.newegg.com, USD), `ca`
(www.newegg.ca, CAD) and the Newegg Global storefronts `uk`, `au`, `nz`, `jp`,
`ph`, `sg`, `kr`, `th`, `mx` (part of Newegg's catalog, in English, priced in
the local currency). Search, category, product and reviews work on every
storefront; offers, deals, seller, seller products and suggestions on `us` and
`ca`; categories on `us`. Category ids differ per storefront (GPUs: 100007709
on us, 100007708 on ca). `list_price` is the struck-through price and `price`
the price after `instant_rebate`; a promo code's discount is given apart and
never taken off `price`; `lowest_price_30_days` is Newegg's own figure. When
Newegg's own unit is unavailable the product page serves a marketplace offer:
`buy_box_changed` is true, `requested_item` is the item number asked for and
`served_item` the offer's. Prices are as the page shows them on that request;
there is no separate live price check. Reviews are one pool across Newegg's
storefronts and carry no reviewer names; seller names are marketplace store
names. Captured 2026-11-26: rtx 5070 gave 4556 results on newegg.com, 279 on
newegg.ca and 43 on the UK storefront (in GBP); AMD Ryzen 7 9800X3D
(19-113-877) was 439.99 USD on newegg.com (list 506.99, 67 instant rebate, a 70
promo code given apart) and 549.99 CAD on newegg.ca, with 28 offers on
newegg.com (26 new from 418.99 USD, 2 used from 449.99) and 316 reviews; Shell
Shocker listed 38 deals; the newegg.com menu held 17 departments and 1055
categories. Not available: cart, checkout, price history (poll and store the
answers), other sellers on the Global storefronts. Failed calls and refused
inputs are not charged; a not-found (an unknown item number) is charged.

### TCGplayer

| Tool | Description |
|------|-------------|
| `search_tcgplayer` | Search TCGplayer (US, USD) cards and sealed products across every game (Pokemon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Lorcana and 60+ more), up to 50 per page: market, median and lowest price, listing count, set, rarity, card number and up to 3 featured listings; filter by game, set, rarity or cards vs sealed; sort by relevance, best selling, name or market price; plus facets with counts |
| `get_tcgplayer_product` | One product by id or URL: images, card attributes, market / median / lowest listing price, listing and seller counts, and every SKU (condition x printing x language) with its market price and the recent sale range (lowest and highest sale price, sale count) |
| `get_tcgplayer_listings` | Every live seller offer on a product, up to 50 per page, filtered by condition, printing, language, verified sellers or Direct, sorted by price plus shipping or price, with seller rating percent, sales band, gold star and location |
| `get_tcgplayer_price_history` | Up to a year of sales history per SKU (month, quarter, semi_annual, annual): per bucket market price, quantity sold, transaction count and the low and high sale price |
| `get_tcgplayer_sales` | The 5 most recent sales of a product: date, condition, printing, quantity, price and shipping |
| `get_tcgplayer_games` | Every game (product line) on TCGplayer, 70+, with the url_name the other tools accept |
| `get_tcgplayer_sets` | Every set of one game, newest first, with the set_id the price guide takes |
| `get_tcgplayer_price_guide` | A whole set's price table, cards or sealed, up to 500 rows per page: market and low price per card per condition and printing |
| `get_tcgplayer_suggestions` | The tcgplayer.com search-box autocomplete: products, sets and games |
| `get_tcgplayer_trending` | Trending searches right now, overall or for Pokemon, Magic or Yu-Gi-Oh! |
| `get_tcgplayer_seller` | A seller's profile by seller key, with the 365-day feedback summary and rating percent |
| `get_tcgplayer_seller_feedback` | Individual feedback rows on a seller from the last 365 days, filterable by star rating or with a comment; buyers appear only as the site's masked nickname |
| `get_tcgplayer_seller_products` | A seller's catalogue with their own listings of each product, filtered by keywords or game |

Platform key `tcgplayer`. 1 credit per call, every tool. US marketplace,
prices in USD. Product, listings, price history and sales take `product_id`
or a tcgplayer.com `/product/<id>/` URL; an unknown id is a 404 and is not
billed. SKU sale fields on `get_tcgplayer_product` (`lowest_sale_price`,
`highest_sale_price`, `sale_count`) are recent SALE statistics, not live
listings; use `get_tcgplayer_listings` for offers. `get_tcgplayer_sales`
returns only the 5 newest sales; for sold volume use
`get_tcgplayer_price_history`, whose low and high sale prices are null in a
bucket with no sales. Seller tools take the 8-character `seller.key` from a
listing. No store locator, product reviews or buylist prices.

### [RockAuto](https://scavio.dev/docs/rockauto-vehicles?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

RockAuto API for RockAuto (rockauto.com, the online auto parts catalog based in Madison, Wisconsin): every brand's listing for one part type on one vehicle with RockAuto's price, tier (Economy, Daily Driver, Premium), fitment notes, pack prices, core charge, closeout and stock flags; part number and OE / interchange search across brands; one brand's parts of a part type; one part's specifications, OE numbers and warranty; the vehicle chain (make, year, model, engine and carcode); the tools and universal parts catalog; and RockAuto's manufacturer rebates with their printed end dates. Prices in 15 display currencies, pages in English, Spanish, French or German. See the [RockAuto API page](https://scavio.dev/rockauto-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `get_rockauto_vehicles` | The vehicle catalog one level at a time: makes, a make's years, a year's models, a model's engines, each engine with its `carcode` |
| `get_rockauto_categories` | One vehicle's part categories, or one category's part types (`part_type_id`) |
| `get_rockauto_parts` | Every brand's listing for one part type on one vehicle: price, tier, fitment notes, pack options, core charge, closeout, out of stock, OE / alternate numbers |
| `search_rockauto` | Part number and interchange search across brands (OE and interchange numbers included), with RockAuto's "Results may be limited" notice |
| `get_rockauto_brand` | One brand's parts of one part type, not tied to a vehicle (at most 50 rows, as RockAuto lists them) |
| `get_rockauto_brands` | The brand list (568 brands) and part groups; optionally about 5,500 part type ids and names |
| `get_rockauto_part` | One part's detail page by its part keys: price, specifications, OE numbers, warranty, the manufacturer's text, images (English only) |
| `get_rockauto_suggestions` | Search-box suggestions for typed text: vehicles with `carcode`, part types, tools, help |
| `get_rockauto_resolve` | Free text ("2010 honda accord brake pads") to RockAuto vehicles, with the words RockAuto did not interpret |
| `get_rockauto_tools` | The tools and universal parts catalog one level at a time, down to a part type's listing |
| `get_rockauto_promotions` | RockAuto's promotions and manufacturer rebates: offer, printed expiry and its date, rebate form link, recently expired |

Platform key `rockauto`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Answers can take up to about 100 seconds
(large part types such as brake pads): allow up to 4 minutes.

One US catalog (no `country`): `currency` is `USD` (default), `AUD`, `BRL`,
`GBP`, `CAD`, `CLP`, `EUR`, `HUF`, `JPY`, `MXN`, `NZD`, `NOK`, `PLN`, `SEK` or
`CHF`, as RockAuto converts its prices for display; `language` is `en`
(default), `es`, `fr` or `de` (names, notes, tiers and labels; part numbers and
prices do not change). `get_rockauto_part` is English in every language. The
`carcode` comes from the vehicle chain: send `make`, `year`, `model`, `engine`
and `carcode` together exactly as `get_rockauto_vehicles` answers them for an
engine (or take a vehicle's `carcode` from `get_rockauto_suggestions` /
`get_rockauto_resolve`); RockAuto picks the vehicle by carcode, and one that
answers another vehicle is a 400, not charged. Captured 2026-11-26: brake pads
(1684) for the 2010 HONDA ACCORD 2.4L L4 (carcode 1444945) listed 114 items,
from 10.23 USD; BOSCH BP1084 was 29.79 USD, or 583.71 MXN in Spanish. Lists
have no sort or paging (RockAuto's own order). Not available: shipping costs
(RockAuto prices them per warehouse in its cart), checkout, coupon codes
(RockAuto publishes none), price history (poll and store the answers). Failed
calls and refused inputs are not charged; a not-found is charged.

### [Cars.com](https://scavio.dev/docs/carscom-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Cars.com API for Cars.com (cars.com, the US car marketplace run by Cars Commerce): new, used and certified car listings around a US ZIP with Cars.com's 11 sorts and its filters (year, price, mileage, trims, drivetrain, color, deal rating, body style, seller type, keyword); one listing with the price breakdown and all-in price, Cars.com's deal rating and good deal range, the price history and vehicle history; dealer profiles, inventories and customer reviews; owner reviews of a model year; a dealer locator; and Cars.com's research pages (make, model, model year, trims). See the [Cars.com API page](https://scavio.dev/carscom-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_carscom` | Listings around a ZIP and radius: 24 a page up to page 417, 11 sorts, filters (make, model, year, price, mileage, trims, drivetrain, color, deal rating, body style, seller type, keyword), facets on request; `total` capped at 10,000 |
| `get_carscom_listing` | One listing by id or link: price, MSRP (new), mileage, specs, price breakdown with fees and all-in price, deal rating and good deal range, price history, features, vehicle history, CPO terms, dealer |
| `get_carscom_dealer` | A dealer's public profile: rating, review count, phone, website, address, hours, service department, inventory count, awards |
| `get_carscom_dealer_inventory` | A dealer's vehicles for sale, 24 a page, with price, mileage and deal badge |
| `get_carscom_dealer_reviews` | A dealer's customer reviews, 10-40 a page, 4 sorts (no reviewer names) |
| `get_carscom_model_reviews` | Owner reviews of one model year, 10-200 a page, 4 sorts, with rating, recommend percent and category ratings (no reviewer names) |
| `get_carscom_dealers` | Dealers around a ZIP by make, minimum rating and name, sorted by rating, name or distance |
| `get_carscom_research` | Research pages: make lineup, model generations, model year (average listing or starting price, MPG, ratings, NHTSA score, trims) or trims |

Platform key `carscom`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Answers can take up to about 80 seconds
(search pages): allow up to 4 minutes.

US only (no `country`), prices in USD as the seller lists them. Cars.com has no
public API for reading listings. `zip` (a 5-digit US ZIP) is required on
`search_carscom` and `get_carscom_dealers`; an unknown ZIP is a 400, not
charged. `radius`, `mileage_max`, `page_size` and `min_rating` take Cars.com's
own steps; `model` needs `make`, `trims` need `make` and `model`;
`filters_not_applied` lists values Cars.com ignored. Captured 2026-11-26: used
Toyota RAV4 around 10001 gave 700 listings; Ford F-150 around 75201 (Dallas)
sorted `price_low` gave 4401, the first a 2005 F-150 XL at 3900 USD; the 2019
Toyota RAV4 rated 4.4 from 458 owner reviews. No VINs, stock numbers,
private-seller names or contact details, reviewer names or towns, or dealer
employee names are returned; the dealer's business name, address, phone,
website and hours are kept. Not available: a star filter on reviews (the site
has none), sold prices, messaging or checkout. Failed calls and refused inputs
are not charged; a not-found (a listing no longer available, an unknown dealer
or model year) is charged.

### [Autotrader](https://scavio.dev/docs/autotrader-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Autotrader API for Autotrader (autotrader.com, the US car marketplace run by Cox Automotive): new, used and certified cars for sale around any US ZIP code with Autotrader's own deal label next to the Kelley Blue Book Fair Purchase Price range as given, dealer fees and price history per listing, dealer and private-seller listings, dealers near a ZIP with their inventory, and each make's models with the price range per model year. See the [Autotrader API page](https://scavio.dev/autotrader-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_autotrader` | Search around a US ZIP (required) with a radius, by make, model and trim code: 5 sorts, filters (model year, price, mileage, body style, drivetrain, colours, dealer or private seller, new / used / certified, fuel, transmission, vehicle history, Good or Great deal, a feature, doors, seats), 25 or 100 a page up to page 100, Spotlight placements flagged, price / mileage / year stats for the whole result set |
| `get_autotrader_listing` | One listing by id or link: description, images, features, specifications, warranties with what remains, Kelley Blue Book owner rating, price history, deal label with the KBB Fair Purchase Price range, dealer fees, and the dealer's address, phone, website and hours (null for a private seller) |
| `get_autotrader_dealers` | Dealers near a US ZIP, optionally of one make or with cars in a price or model-year range: the first 50, nearest first, with rating, address, phone and website |
| `get_autotrader_dealer` | One dealer by id or link: rating, address, phone, website, hours, home services, listing count, makes in stock and the first page of the inventory |
| `get_autotrader_makes` | One make's models: model years, popular models, price range and MPG labels per model year, and the model name `search_autotrader` takes |

Platform key `autotrader`. 2 credits per call on every tool; `credits_used` in the
response is what was charged. Answers can take up to about 225 seconds: allow up
to 4 minutes.

US only, prices in USD. `zip` is required on search and dealers; an unknown ZIP is
a 400 and not charged. `deal_label` is Autotrader's own label (Great, Good), based
on the Kelley Blue Book Fair Purchase Price range, returned as given in
`kbb_fair_purchase_price` {amount, low, high, delta}. Captured 2026-11-26: Honda
Civic around 90012 resolved to Los Angeles (25 miles) with 1882 listings; a used
2018 Civic LX at 18881 USD was labelled Great against a KBB Fair Purchase Price of
19440 (range 18690-20140). A model spelled differently (F-150) is matched to
Autotrader's name (F150); a model Autotrader does not list for the make is a
charged 404 that lists the make's models. Private sellers: `seller` is type,
city, state and distance only (no name, phone or street address). VINs and stock
numbers are never returned; phone numbers, emails and VIN-like codes inside
descriptions read `[removed]`. The dealer finder does not page (the first 50,
nearest first): narrow with radius or make. Not available: dealer reviews
(rating and rating count only), autotrader.co.uk or autotrader.ca (separate
sites), more than 100 pages of a search. Failed calls and refused inputs are not
charged; a not-found (a sold or removed listing, an unknown dealer) is charged.

### [CarGurus](https://scavio.dev/docs/cargurus-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

CarGurus API for CarGurus (cargurus.com, the car marketplace run by CarGurus, Inc., in the US, Canada and the UK): car listings around a ZIP, postal code or postcode with CarGurus' own deal rating and expected price next to the asking price, dealers with their reviews and inventory, CarGurus' price trends (the CarGurus Index, makes, models, model years), model-year research pages and CarGurus' expert reviews, in English, Spanish (US) and French (Canada). See the [CarGurus API page](https://scavio.dev/cargurus-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_cargurus` | Search around a ZIP / postal code / postcode (required) with a radius, by make, model and trim: 11 sorts, filters (year, price, mileage, drivetrain, colour, body type, condition, seller type, deal rating, fuel, transmission, single owner, no accidents, price drops, other CarGurus filter keys), 24 tiles a page up to page 500; each listing carries price, price with fees, expected price, deal rating, price drop and specs; facets on request |
| `get_cargurus_dealer` | One dealer by id or link: address, phones, website, hours, rating, the reviews the page embeds (no reviewer names), the dealer's inventory paged, sorted and filtered like search, nearby dealers |
| `get_cargurus_dealers` | Dealers with listings around a US ZIP (US site only), optionally for one make / model: up to 150, with rating, distance and listing count |
| `get_cargurus_price_trends` | CarGurus' price trends for the market, a make or a model: average prices with and without fees, change against 30, 90 and 365 days ago, daily series, market movers |
| `get_cargurus_research` | A model-year research page (US site) by id, link, or year + make + model: trims with MSRP and specs, pricing today vs a month and a year ago, the CarGurus test-drive review, owner reviews (no reviewer names) |
| `get_cargurus_expert_reviews` | CarGurus' editorial car reviews, 24 a page |
| `get_cargurus_makes` | Every make the market's site lists, with the per-site make id |
| `get_cargurus_models` | One make's models with CarGurus' listing counts nationwide or around a ZIP / postal code |

Platform key `cargurus`. 1 credit per call, also when a make or model name is
resolved with a first page; `credits_used` in the response is what was charged.
Answers can take up to about 120 seconds: allow up to 4 minutes.

Markets (`market`, default `us`): `us` (cargurus.com, USD, miles), `us-es` (its
Spanish pages), `ca` (cargurus.ca, CAD, km), `ca-fr` (its French pages), `uk`
(cargurus.co.uk, GBP, miles); data comes in the market's language and currency.
Dealers near a ZIP: `us` and `us-es` only (the Canadian and UK search pages
carry no dealer list); price trends and expert reviews: `us`, `ca`, `uk`;
research: the US site. `zip` must match the market, and `distance` takes the
site's radii (us / uk 10-500 miles, ca 25-500 km) or `nationwide`. Make and
model ids differ per site (Ford is m2 in the US and Canada, m273 in the UK):
names resolve to the market's id. `deal_rating`, `deal_rating_label`,
`deal_score` and `expected_price` are CarGurus' own price analysis, as CarGurus
labels it. Captured 2026-11-26: Toyota RAV4 around 10001 resolved to New York
(50 miles) with 1107 listings; a 2024 RAV4 LE AWD at 27000 USD against an
expected 27763 was rated Good Deal; the US CarGurus Index stood at 28289 USD.
Sponsored placements are inserted by CarGurus out of the requested order and
flagged. There is no listing detail tool: each listing already carries the
price, expected price, deal rating, mileage, options and specs. No VINs, stock
numbers or private-seller details are returned. Not available: review paging,
sort or star filters on dealer reviews, finance and delivery filters. Failed
calls and refused inputs are not charged; a not-found (an unknown dealer,
research id or make) is charged.

### [CarMax](https://scavio.dev/docs/carmax-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

CarMax API for CarMax (carmax.com, the largest US used-car retailer, with 263 stores in 42 states and no-haggle prices): used-car inventory within a radius of any US ZIP or nationwide, with the price, CarMax's price drops, mileage, features, the store holding the car and the shipping fee and dates to that ZIP; one car in full with CarMax's history callouts and warranties; every photo; the stores and one store's lot; owner reviews per model-year; and the recent CarMax instant offers for a model-year as CarMax shows them. See the [CarMax API page](https://scavio.dev/carmax-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_carmax` | Search by make and model (F-150 and F150 both work), body type, keyword, up to 8 facet filters, year / price / mileage ranges and max shipping fee, around a US ZIP (required) within 5-500 miles or nationwide; 8 sorts, up to 100 cars a page, `total`, `has_more`, facets on request |
| `get_carmax_listing` | One car by stock number or link: price, previous price and price-drop text as CarMax words it, mileage, engine, MPG, accident and owner counts and CarMax's callouts as given, warranties, features, specifications, reconditioning, the store and the model review summary |
| `get_carmax_photos` | Every photo of a car (images and 360 exterior), thumbnail, 1600x1200 and 16x9 links |
| `get_carmax_stores` | Stores nearest a US ZIP (with distance) or in a state or city: id, address, phones, coordinates, hours, service and holiday hours |
| `get_carmax_store` | One store by id: address, phones, hours, is open now, alert, and CarMax's price and fee terms for that store's state |
| `get_carmax_store_inventory` | The cars on one store's lot, with the search filters, sorts and paging (no keyword, no radius) |
| `get_carmax_reviews` | Owner reviews of one model-year, 10 a page, full depth, 5 sorts and an exact star filter; title, pros and cons, the owner's mileage and time owned, no reviewer identity |
| `get_carmax_review_summary` | The owner-review summary of a model-year: count, average, star distribution, top likes and dislikes |
| `get_carmax_suggestions` | Make and model suggestions for the start of a name, with the slugs search takes |
| `get_carmax_makes` | Every make CarMax lists (60, captured 2026-11-26) |
| `get_carmax_models` | One make's models with the slugs search and car value take |
| `get_carmax_car_value` | Recent CarMax instant offers for one model-year as CarMax shows them: offer range, the page headline range, each recent offer with mileage, date and trim, trim ranges and the median offer by year |

Platform key `carmax`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Answers can take up to about 80 seconds (a
100-car page): allow up to 4 minutes.

US only, prices in USD. `zip` is required on search and store inventory:
CarMax prices each car's shipping fee and dates to it (captured 2026-11-26:
Ford F-150 within 100 miles of 75201 gave 49 cars, the nearest store Texas
Stadium (Irving) at 7 miles, a 2026 F150 STX at 44998 USD with 1971 miles and a
49 USD shipping fee). `get_carmax_listing` carries no shipping: use
`search_carmax` with a zip. `get_carmax_car_value` is what CarMax offered for
cars of that model-year, not an appraisal of any one car; `offer_range` and the
page's `headline_range` can differ (captured 2026-11-26: 2019 Ford F150, 10
recent offers from 11000 to 20000 USD, headline $16,400-$25,400). Accident and
owner counts are as CarMax shows them. No VIN is returned, and reviews carry no
reviewer name or identity. Not available: a deal rating or price analysis
(CarMax prices are no-haggle), private sellers (every car is CarMax's), store
reviews, price history beyond the previous price and drop date, a trim filter.
Failed calls and refused inputs are not charged; a not-found (an unknown or
sold stock number, store, make, model-year without reviews or value page) is
charged.

### [Carvana](https://scavio.dev/docs/carvana-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Carvana API for Carvana (carvana.com, the US online used-car retailer): its national used-car inventory by make and model with Carvana's price, previous price and the Kelley Blue Book value it shows next to the price, Carvana's own tags (Great Deal, New Price, No Reported Accidents), shipping cost to a Carvana city page, one vehicle in full with its inspection checklist, imperfections and warranty, and Carvana's model-year guides, trim guides and model lineups. See the [Carvana API page](https://scavio.dev/carvana-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_carvana` | Search by make and model, 24 a page: 6 sorts, filters (model year, price, maximum mileage, trims, drive types, colours, body styles, fuel types, Carvana's tags, free shipping), a Carvana city page for shipping and delivery, facets on request |
| `get_carvana_vehicle` | One vehicle by id or link: price, previous price, KBB value, MSRP, powertrain, dimensions, warranty and what remains, prior use, recalls, highlights, the inspection checklist, imperfections with photos, features, packages, the hub it ships from |
| `get_carvana_model_guide` | Carvana's research page for one model year: what changed, specs by trim, trims in stock, owner rating and the owner reviews the page shows (no names), FAQ |
| `get_carvana_trims` | Carvana's trim guide for one model: trim groups with what each adds, who it suits, attributes and stock |
| `get_carvana_make` | One make's model lineup with the model names search takes and stock per model |
| `get_carvana_makes` | Every make in Carvana's inventory with its in-stock count |

Platform key `carvana`. 1 credit per call; `credits_used` in the response is what
was charged. Answers usually take about 10 seconds and can take up to about 235
seconds with a retry: allow up to 4 minutes.

US only, prices in USD before taxes, title, registration and fees. Inventory is
national: the location changes shipping costs and delivery flags, not which
vehicles exist. There is no ZIP targeting: pass `city` (one of Carvana's own
city pages, e.g. `new-york-ny`), else the location is the one Carvana sets for
the visit (`location.source` says which). `city` works only with make, model and
page: a filter or a sort with `city` is a 400. The most popular order is
recomputed per visit and not stable between pages: page with a fixed sort.
Captured 2026-11-26: Ford F-150 from 2019 tagged Great Deal, lowest price
first: 578 vehicles; a 2019 F-150 XLT at 21990 USD (previously 22590) with 93232
miles next to a KBB value of 23600. Makes and models go by the names Carvana
writes (hyphens count: F-150, CR-V); an unknown make or model is a charged 404
that lists Carvana's names. No VINs. Not available: ZIP targeting, keyword
search, a minimum-mileage filter, new vehicles, delivery or shipping quotes for
an address, monthly payments, taxes and fees, price trends. Failed calls and
refused inputs are not charged; a not-found (an unknown or sold vehicle) is
charged.

### [TrueCar](https://scavio.dev/docs/truecar-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

TrueCar API for TrueCar (truecar.com, the US car-buying marketplace): new and used dealer inventory around any US ZIP with the price, MSRP, TrueCar's own price label and rating as given, mileage, history counts and the dealer; one listing in full by VIN or link with TrueCar's price summary, dealer fees, specs, warranties and history flags; TrueCar's model overviews with trims, starting MSRP and the starting market average; owner reviews per generation; dealer profiles and one dealer's lot; makes, models and TrueCar's own suggestions. See the [TrueCar API page](https://scavio.dev/truecar-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_truecar` | New or used dealer inventory around a US ZIP (required) by make and model, 30 a page, TrueCar's ten sorts, radius, year, price, maximum mileage, trim, body style, drivetrains, colors, fuel types, accident-free and certified pre-owned; `total` (capped at 10,000), `has_more`, TrueCar's national price range and per-trim averages |
| `get_truecar_listing` | One listing by VIN or truecar.com listing link (input only; never returned): price, MSRP, TrueCar's price label and rating, price summary with dealer fees and dealer asking price, specs and features, warranties, CPO program, history flags as TrueCar shows them, seller notes, the dealer with phone and hours |
| `get_truecar_model` | TrueCar's overview of a model (optionally a model year): generation, owner rating with star counts, sub-ratings, trims with starting MSRP and starting market average, specs ranges, warranty, segment ranking, model years, national new and used data |
| `get_truecar_reviews` | Owner reviews of a model by generation, star and text filters, up to 100 a page in TrueCar's own order; pros, cons, sub-ratings and dates, no reviewer names, initials or states |
| `get_truecar_dealer` | One dealer by id or dealership link: address, phone, hours, description, links, services and images (no employees; TrueCar shows no dealer reviews) |
| `get_truecar_dealer_inventory` | One dealer's new or used vehicles, 30 a page |
| `get_truecar_suggestions` | TrueCar's suggestions for a text: makes, models, trims and body styles with the slugs search takes |
| `get_truecar_makes` | Every make with used inventory (63, captured 2026-11-26) and the national new and used counts |
| `get_truecar_models` | One make's models with slugs, body styles, engine types and new / used inventory flags |

Platform key `truecar`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Answers usually arrive within about 15
seconds: allow up to 4 minutes.

US only, prices in USD. `zip` is required on search (captured 2026-11-26: a
used Toyota RAV4 around 10001 gave 2440 vehicles, the first a 2017 RAV4 Hybrid
XLE at 16485 USD with 125334 miles, 5.8 miles away; a new Ford F-150 around
75201 by lowest price gave 1705, the first a 2026 F-150 XL at 39063 USD, MSRP
40085). TrueCar also lists vehicles from far-away dealers offered with delivery:
read `distance_miles`. `price_label` and `price_rating` are TrueCar's own labels
as given (TrueCar shows no basis). The VIN is an input of `get_truecar_listing`
only and is never returned: search and dealer inventory carry no VIN, stock
number, listing link or dealer photo, so a search result cannot be passed to
`get_truecar_listing`. Not available: keyword search (use make and model or
`get_truecar_suggestions`), a mileage minimum, private sellers, a review sort,
dealer reviews, delivery quotes and payment estimates, price history (poll and
store the answers). Failed calls and refused inputs are not charged; a
not-found (an unknown VIN, make, model, year or dealer) is charged.

### [Edmunds](https://scavio.dev/docs/edmunds-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Edmunds API for Edmunds (edmunds.com, the US car research and shopping site owned by CarMax): new and used car listings around any US city with the price, price change, MSRP and Edmunds' own local and national deal rating as given; one listing in full with dealer fees and price history; owner reviews per model year; dealer pages with sales and service ratings and reviews; a model year's research page with Edmunds' expert review; MSRP, invoice and Edmunds Suggested Price per trim; and Edmunds' used-car values per condition (dealer retail, private party, trade-in, auction). See the [Edmunds API page](https://scavio.dev/edmunds-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_edmunds` | Used (with certified) or new listings around a US city + state (required; a ZIP is refused), by make and model or every make (used), radius 10-500 miles, 5 sorts, year / price / mileage ranges, trim, drivetrain, exterior colour, body type, deal rating and no accidents; 21 a page |
| `get_edmunds_listing` | One listing by VIN with make, model and year, or by link (VIN input only; never returned): price, advertised price, MSRP, destination and dealer fees, monthly payment estimate, price history, deal rating, days on Edmunds, history flags as given, seller comments, the dealer with hours |
| `get_edmunds_reviews` | Owner reviews of one model year, 5 a page, 4 sorts and a star filter, with Edmunds' seven category ratings; no reviewer names |
| `get_edmunds_dealer` | One dealer by id or link: address, phones, hours, websites, sales and service ratings, inventory counts per model, and reviews 21 a page with dealer replies (reviewer names taken out) |
| `get_edmunds_model` | A model year's research page: MSRP range, styles with specs, Edmunds' expert review (rating, verdict, pros, cons, recommended trim), the owners' rating and listing counts |
| `get_edmunds_price` | MSRP, invoice and Edmunds Suggested Price per trim, with the place Edmunds computes the suggested price for |
| `get_edmunds_appraisal` | Used-car values per style and condition (outstanding, clean, average, rough): dealer retail, private party, trade-in, auction, the assumed mileage and the place Edmunds computes values for |
| `get_edmunds_makes` | Every make Edmunds lists (69) and one make's models with the slugs the other tools take |

Platform key `edmunds`. Credits: 2 per call on every tool; `credits_used` in
the response is what was charged. Allow up to 4 minutes per answer.

US only, prices in USD. Search takes a US city and state, not a ZIP: Edmunds
places a search by its own city pages, and `location` says the city it searched
around (captured 2026-11-26: a used Toyota RAV4 around New York, NY, 25 miles,
gave 3124 listings, among them a 2015 RAV4 Limited at 7995 USD with 157526
miles, rated Great against Edmunds' local estimate of 13201 USD, at a dealer in
Carlstadt, NJ, 8.6 miles away). `deal_rating` is Edmunds' own rating as Edmunds
gives it. Edmunds computes its Suggested Price and its used-car values for a
place of its own and states it: read `suggested_price_near` and `values_near`
with the figures (captured 2026-11-26: the 2025 Toyota RAV4 XLE at 32760 USD
MSRP, 30725 invoice, Edmunds Suggested Price 30140 near Paramus, NJ 07652; a
2020 RAV4 LE AWD in clean condition at an assumed 72000 miles near Paramus, NJ:
dealer retail 23946, private party 21638, trade-in 19036 USD). Appraisal values
are Edmunds' estimates, not an offer. VINs are input only and never returned
(listing photos are not returned, since every Edmunds photo link carries the
VIN); no stock numbers; private sellers city and state only; reviewer names are
never returned. Not available: ZIP-based search, a VIN-specific appraisal,
price history beyond a listing's own entries. Failed calls and refused inputs
are not charged; a not-found (an unknown city, model, year, listing, dealer or
trim) is charged.

### [Kelley Blue Book](https://scavio.dev/docs/kbb-car-value?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Kelley Blue Book API for Kelley Blue Book (kbb.com, Cox Automotive's car value and research site): a car's Kelley Blue Book values by make, model, year, trim, condition and mileage, every price type KBB gives (17 for a used car: trade-in, private party and auction values from Fair to Excellent, typical listing price, lending value, CPO and Fair Purchase Price) with KBB's region, mileage and option adjustments, optionally for a US ZIP code; one model year's trims, depreciation, specs and rankings; cars for sale around a ZIP with KBB's deal rating against the Fair Purchase Price range; one listing in full; owner reviews; dealers near a ZIP and one dealer's inventory; and KBB's make and model directory. KBB's own data feed is a business contract, not a self-serve API. See the [Kelley Blue Book API page](https://scavio.dev/kbb-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `get_kbb_car_value` | A car's values by make, model, year and `trim` (trim slug, vehicle id or a unique trim name), intent (`buy_used`, `buy_new`, `trade_in_sell`), condition and mileage, optionally for a `zip`: the headline values and every KBB price type with base value, adjustments and range |
| `get_kbb_model` | One model year: trims with their slugs and values, new-car pricing, depreciation history and forecast, specs, rankings, Best Cars rank, years and other models |
| `search_kbb` | Cars for sale around a US ZIP (required) with a radius or nationwide: used, new or all, make and model (never widened to the whole make), 4 sorts, year / price / mileage ranges, drivetrain, exterior colour, dealer or private seller; 25 or 100 a page; KBB's deal rating, Fair Purchase Price range, dealer fees, price history; spotlights and price / mileage / year stats |
| `get_kbb_listing` | One car for sale by listing id or link: the search fields plus description, images, features, specifications, warranties, open recalls as KBB shows them, KBB's consumer rating and the dealer's public business details |
| `get_kbb_reviews` | Owner reviews of a model year, 8 a page (pages 1-10), 3 sorts and a star filter: text, ratings by category, pros, cons, helpful votes; KBB's averages and distribution; no reviewer names |
| `get_kbb_dealers` | Dealers near a US ZIP, optionally of one make and within a radius: up to 50, nearest first, with rating, distance, address, phone and website |
| `get_kbb_dealer` | One dealer by id or link: hours, home services, rating, inventory count, price stats, makes and the first page of inventory |
| `get_kbb_makes_models` | KBB's make and model directory, used or new, with the slugs the value, model and review tools take |

Platform key `kbb`. Credits: 1 per call; `get_kbb_car_value` with a `zip` 2 (up
to 6 when KBB's ZIP form needs a second, costlier attempt); `get_kbb_reviews`
past page 1, with another sort or a star filter 1 or 5. `credits_used` in the
response is what was charged. Answers can take up to 4 minutes: allow a client
timeout of at least 240 s.

US only, USD. Values are exactly as Kelley Blue Book gives them; without `zip`
they are for KBB's default location (`location.zip` and `location.valid_text`
say which). `zip` on a car value takes `mileage` and works for `buy_used` and
`trade_in_sell`, not `buy_new`. Captured 2026-11-26: a 2021 Toyota RAV4 LE Sport
Utility 4D at 40000 miles in good condition had a Fair Purchase Price of 25950
USD (range 23750 to 28150) and a Private Party Value Good of 24350 USD at KBB's
default ZIP 92620, and a Fair Purchase Price of 25410 USD at ZIP 10001; used
Toyota RAV4 around 10001 gave 574 listings, the first a 2020 RAV4 LE with 4709
miles at 27665 USD, rated a Great deal against a Fair Purchase Price of 31443
USD. No VIN or stock number is returned; private sellers carry city, state and
distance only, and reviews carry no reviewer name, nickname or location.
Dealer name, address, phone, website and rating are the dealer's public business
details. Not available: dealer reviews (rating and count only), a VIN lookup,
review pages past 10, Kelley Blue Book Canada or Brazil. Failed calls and refused
inputs are not charged; a not-found (an unknown model, trim, listing or dealer)
is charged.

### [Nintendo](https://scavio.dev/docs/nintendo-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Nintendo eShop API: one game's regular price, sale price and sale end date in each eShop country, in that country's currency, plus catalog search, product detail, deals, new and upcoming releases and a game's DLC, across 46 countries.

| Tool | Description |
|------|-------------|
| `search_nintendo` | Search one country's eShop catalog by keyword: nsuid, title, platform (Switch / Switch 2), release date, publisher, price, regular price, sale price, discount, sale start and end, age rating; Europe and Japan with sorts and filters (platform, on sale, publisher, type; Europe also price range, genre, players, demo), the Americas 40 tiles per page by relevance or newest |
| `get_nintendo_product` | One product by nsuid, link or (Americas) slug: publisher, developer, genres, players, languages, file size, age rating and descriptors, description, prices with the sale window, demo, Nintendo Switch Online; Americas also editions, play modes, the game's DLC with prices and the stock signal for hardware, amiibo and merchandise |
| `get_nintendo_prices` | The eShop price of 1 to 50 item ids in one country: price, regular price, sale price, discount, sale start and end, sales status; every market including the prices-only kr, hk, tw and il |
| `get_nintendo_deals` | Games on sale now: Europe and Japan every discounted game in the catalog, the Americas Nintendo's featured sale pages (with each item's sale page and the list of sale pages) |
| `get_nintendo_releases` | New releases (newest first) or upcoming games (soonest first) with prices, filtered by platform |
| `get_nintendo_dlc` | A game's DLC, bundles and upgrade packs with prices and sale windows |

Platform key `nintendo`. Every tool costs 1 credit. Markets (`country`,
default `us`) and languages (`language`, default the market's first):
Americas us (USD), ca (CAD; English or French), mx (MXN), br (BRL;
Portuguese), ar (ARS), cl (CLP), co (COP) and pe (PEN) (Spanish); Europe in
the market's language: gb (GBP) and ie (EUR) (English), de and at (EUR;
German), ch (CHF; German, French or Italian), fr, be (French or Dutch), nl,
lu (French), it, es and pt (EUR), au (AUD), nz (NZD) and za (ZAR) (English);
pl (PLN), cz (CZK), se (SEK), no (NOK), dk (DKK), fi, sk, hu, ro, bg, gr, hr,
si, ee, lv, lt, mt and cy (EUR) have no Nintendo site of their own and read
the English European catalog with that country's own prices; jp (JPY;
Japanese). `get_nintendo_prices` also serves kr (KRW), hk (HKD), tw (TWD) and
il (EUR, European item ids). ph (no Philippines item ids published yet), ru
(no eShop), uk (use gb) and countries with no eShop data answer 400 before
anything is charged.

Item ids (`nsuid`) are per eShop region: Americas (US CA MX BR AR CL CO PE),
Europe (EU / EFTA, GB, AU, NZ, ZA, IL), Japan, Korea, and Hong Kong + Taiwan
(Taiwan uses Hong Kong ids). An id from one region is `not_found` in another
and there is no cross-region title mapping: look the game up with
`search_nintendo` or `get_nintendo_product` in that region, then call
`get_nintendo_prices` for any country of the region (up to 50 ids). Americas
search tiles carry a `slug` and no `nsuid`: read the product with the slug.
Prices are always the requested country's eShop price in its currency;
`sale_start` and `sale_end` are the eShop's own sale window. Nintendo shows
no price history or historical low: poll `get_nintendo_prices` to build one.
Americas deals are Nintendo's featured sale pages, not every discounted game;
Europe and Japan deals are every game on sale. Americas search sorts by
relevance or newest only and takes no filters, and the Americas releases
lists are one page; an unsupported sort or filter answers 400, never silently
dropped. No user reviews (Nintendo's stores have none; age ratings only), no
best-seller charts and no autocomplete. Failed calls are not charged; a
not-found is charged.

### [H&M](https://scavio.dev/docs/hm-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

H&M product data API: one article's price, sale price, member price and online stock by size in each H&M market, in that market's currency, plus catalog search, category, sale and new-arrivals grids, search suggestions, stores and where an article is made, across 47 countries.

| Tool | Description |
|------|-------------|
| `search_hm` | Search one market's catalog by keyword or article code: article code, title, price, regular price, sale price, member price, discount, prior price (EU), colours, sizes with online stock, category id; up to 72 per page, sorted by relevance, newest or price, filtered by department, store assortment, colour, size, material, fit, product type and on sale; facets and price range |
| `get_hm_product` | One article by article code or link (2 credits, can take up to about a minute): description, composition, materials, care, fit attributes, the prices with H&M's price disclosure, every colourway with its own prices, sizes with online stock and few-left, rating and the latest reviews H&M shows (up to 10, with fit feedback) |
| `get_hm_stock` | Online stock per size for every colour of a product, by article or product code (not store stock) |
| `get_hm_stores` | A country's stores with address, coordinates, phone, opening hours and exceptions, departments; filtered by city, postal code or a lat / lng radius |
| `get_hm_category` | A category grid by H&M's category id (the same ids in every market, e.g. `ladies_dresses`, `men_jeans`), with the search sorts and filters |
| `get_hm_deals` | A department's sale grid (default women) with sale price, regular price and discount; may be empty between sales |
| `get_hm_new_arrivals` | A department's new-arrivals grid (default women), with the search sorts and filters |
| `get_hm_suggestions` | Search suggestions for what a shopper has typed, in the market's language |
| `get_hm_production` | Where an article is made as H&M publishes it: production countries, suppliers and factories (name, city, workers range; no street addresses) |

Platform key `hm`. `get_hm_product` costs 2 credits, every other tool 1.
Markets (`country`, default `us`) and languages (`language`, default the
market's first): us (USD), ca (CAD; English or French), mx (MXN; Spanish),
gb (GBP), ie (EUR), de and at (EUR; German), ch (CHF; German, French or
Italian), fr, be (Dutch or French), nl, it, es, pt (EUR), se (SEK), fi (EUR;
Finnish or Swedish), dk (DKK), no (NOK), pl (PLN), cz (CZK), sk (EUR), hu
(HUF), ro (RON), bg (EUR), gr (EUR), rs (RSD), tr (TRY), ua (UAH), il (ILS;
Hebrew), hk and mo (HKD; Chinese or English), tw (TWD; Chinese or English),
jp (JPY), kr (KRW), in (INR), my (MYR), ph (PHP), sg (SGD), vn (VND), au
(AUD), each in its own language; and hr, cy, ee, lv, lt, lu and si on H&M's
shared English EUR store (answers say store `eu`). Every tool serves all 47
except `get_hm_product` (not mo, tw or the shared EU store countries: use
`search_hm` or `get_hm_stock` there) and `get_hm_stores` (not mo: H&M lists
no stores there). Countries where H&M runs a separate site (ae, eg, id, th,
br, cn) or has no online store, ru, and uk (use gb) answer 400 before
anything is charged.

Article codes are global: the same 10-digit code (7-digit product code +
3-digit colour) in every market, so one code compares a price across markets
with one call per `country`. `price` is what a non-member pays now;
`member_price` is H&M's member price as shown to signed-in members;
`prior_price` is the earlier price H&M shows next to an EU markdown. Stock is
online stock per size: H&M publishes no per-size store stock (`search_hm`
with `store` lists a store's assortment). Category ids are the same in every
market, and a category returns everything H&M files under that id, which can
be more than the site's curated page. H&M runs sales in seasons, so
`get_hm_deals` may return an empty grid between sales. No price history
(poll to track changes), no full review list (the 10 latest only), no
checkout or member-only cart prices, and H&M's sibling brands (COS, Weekday,
& Other Stories, Monki, ARKET) are not covered. Failed calls are not
charged; a not-found is charged.

### [Zara](https://scavio.dev/docs/zara-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Zara product data API: Zara prices by country (one reference's price, sale price and availability in up to 10 markets per call, each in that market's own currency), stock by size online and in physical stores, catalogue search, product detail, materials and origin, category, special-prices and new-arrivals lists, stores and search suggestions, across 102 Zara storefronts.

| Tool | Description |
|------|-------------|
| `search_zara` | Search one market's catalogue by keyword, or look up a reference (all its colours): product id, reference, title, price, old price, discount, availability, colours; up to 96 per page, sorted by relevance or price, filtered by section, colour, size and price range; facets and price range |
| `get_zara_product` | One product by link, product id + slug, or reference: description, prices, composition, every colour with its sizes, online availability per size, promotions and images |
| `get_zara_materials` | Composition, care, certifications and origin (country of production as Zara states it; France shows traceability steps) |
| `get_zara_stock` | Online availability per size of one colour (in_stock, out_of_stock, low_on_stock, coming_soon) |
| `get_zara_stores` | Stores near a point, nearest first, with address, coordinates, phones, 7 dated days of opening hours and services |
| `get_zara_store_stock` | Units per size of one colour in physical stores (sales floor and stockroom), by store ids or a point |
| `get_zara_categories` | A market's category tree (id, name, section, parent, leaf, redirect id) |
| `get_zara_category` | Every product of one category, paged and sorted over the whole list, optionally only marked-down items |
| `get_zara_deals` | A section's SPECIAL PRICES list (woman, man, girl or boy) with old price and discount |
| `get_zara_new_arrivals` | A section's NEW ARRIVALS list (woman, man, girl or boy) |
| `get_zara_prices` | One reference across up to 10 markets: price, old price, discount, currency, title and availability per market, plus the markets that do not sell it |
| `get_zara_suggestions` | Search suggestions for what a shopper has typed, in the market's language |

Platform key `zara`. Every request is billed what it spent (`credits_used`
in the answer): 2 credits per call for `search_zara`, `get_zara_materials`,
`get_zara_stock`, `get_zara_stores`, `get_zara_categories` and
`get_zara_category`; `get_zara_product` 2 (4 when opened by reference or
when the slug is another market's or language's, 6 for both);
`get_zara_store_stock` 2 with store ids, 4 with a point; `get_zara_deals` 4
(2 when the market has no special-prices category); `get_zara_new_arrivals`
4; `get_zara_prices` 2 per market that answered; `get_zara_suggestions` 2 (4
when the English fallback runs). China (`cn`, Zara's separate site) costs 1
credit per call instead of 2.

Markets (`country`, default `us`): the 102 Zara storefronts with an online
store of their own, each in its own currency, e.g. us (USD), ca (CAD), mx
(MXN), br (BRL), gb (GBP; the United Kingdom), the euro countries, ch (CHF),
se, dk, no, pl, cz, hu, ro, tr, ua, il, ae, sa, kw, qa, eg, ma, in, jp (JPY),
kr (KRW), cn (CNY), hk, tw, sg, my, th, id, vn, au, nz, za and the rest of
Latin America and Europe Zara sells online in; ic is the Canary Islands, xe
Abu Dhabi, Al Ain and Ras Al Khaimah, xk Kosovo. `language` takes Zara's own
languages for the market (205 market-languages; the first listed is Zara's
default), listed per market in the `search_zara` description. Every tool
serves all 102 except `get_zara_stores` and `get_zara_store_stock` (not ao
or iq: Zara lists no stores there), `get_zara_new_arrivals` (not dz) and
`get_zara_suggestions` (not ad, al, am, az, ba, dz, mk, mo, uz or xk).
Belarus, uk (use gb) and the countries Zara serves only from its worldwide
store answer 400 before anything is charged.

References are global on Zara's international site, so one reference
compares a price across markets in a single `get_zara_prices` call. A
colour's product id is usually the same across markets but can differ, and
China (`cn`) runs its own ids, so match across markets with the reference. Prices are numbers in the market's own currency, never
converted; `old_price` is set only on a markdown. Zara runs seasonal sales
and lists special prices between them: `get_zara_deals` resolves each
market's special-prices list live and answers an empty list (not an error)
where a market has none for the section; in fr, be, lu, mc and iq Zara lists
special prices without a previous price. `get_zara_stock` is online stock;
`get_zara_store_stock` is units in physical stores. Category ids are shared
across the northern-hemisphere catalogue; au, za and br run their own (get
them from `get_zara_categories`). No reviews (Zara shows none), no price
history (poll `get_zara_prices`), and Inditex's other brands (Pull&Bear,
Massimo Dutti, Bershka, Stradivarius, Oysho, Zara Home, Lefties) are not
covered. Failed calls are not charged; a not-found is charged.

### [Uniqlo](https://scavio.dev/docs/uniqlo-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Uniqlo API: Uniqlo prices by country (one product id priced in up to 10 markets per call, each in its own currency, never converted), online stock by colour and size, store stock near a point, reviews with fit feedback, sale and limited-time offers, new arrivals, catalogue search, product detail, categories, stores and search suggestions, across 41 Uniqlo markets.

| Tool | Description |
|------|-------------|
| `search_uniqlo` | Search by keyword on us, jp, kr (up to 100 per page; featured, newest, price or top-rated sort; gender, category, flag, colour, size and price filters; facets and related keywords) and on Uniqlo's Greater China sites tw, hk, cn (their own product codes; best-selling sort) |
| `get_uniqlo_product` | One product by id or link on 41 markets: description, composition, care, origin, category, price, promo price, sale and limited-offer flags, 30-day lowest price (Europe), colours, sizes, rating with fit, images; variants with l2_id on us, jp, kr |
| `get_uniqlo_stock` | Online stock of every colour x size x length variant (in_stock, low_stock, out_of_stock; quantity capped at 11 as Uniqlo shows it) |
| `get_uniqlo_store_stock` | Stock of one variant in the stores nearest a point (status per store, no unit counts), by l2_id or by product id + colour + size, with the variant's price group |
| `get_uniqlo_stores` | Stores near a point, or one store by id, with address, phone, weekly opening hours, store type, sections and services |
| `get_uniqlo_reviews` | Reviews with rating, title, text, date, fit (1 tight to 5 loose), purchased size and colour, height, weight and age ranges; 5 sorts |
| `get_uniqlo_suggestions` | Search suggestions, categories and feature pages for a partial query; trending search words with no query |
| `get_uniqlo_category` | Every product of one category path, paged and sorted, optionally one flag |
| `get_uniqlo_deals` | The sale or limited-time-offer list of a market, optionally one gender |
| `get_uniqlo_new_arrivals` | Items Uniqlo flags New, optionally one gender |
| `get_uniqlo_categories` | A market's category tree (gender, class, category, subcategory) with the paths search and category take |
| `get_uniqlo_prices` | One product id across up to 10 of 38 uniqlo.com markets: price, promo price, discount, flags, tax and availability per market, plus the markets that do not sell it |

Platform key `uniqlo`. 1 credit per call; `get_uniqlo_store_stock` is 2
when resolved from product id + colour + size (1 with `l2_id`), and
`get_uniqlo_prices` is 1 credit per market that answered (a market that does
not sell the product answers too; failed markets are free).

Markets (`country`, default `us`) by tool:
- **Every tool:** us (USD, en), jp (JPY, ja), kr (KRW, ko).
- **Search + product:** tw (TWD), hk (HKD), cn (CNY), Uniqlo's Greater China
  sites, in Chinese, with their own product codes (not valid elsewhere).
- **Product + prices:** au, be (nl, fr, en), ca (en, fr), de, dk (en), es, fr,
  gb (GBP; `uk` accepted), id, in, it, my, nl, ph, se (en), sg, th, vn, and
  Uniqlo's EU store (EUR, English) for at, bg, cz, ee, fi, gr, hr, hu, ie,
  lt, lu, lv, pl, pt, ro, si and sk.

Countries with no Uniqlo online store (ch, no, nz, mx, tr, ae, il, ru), a
market a tool does not serve and a language a market does not serve answer
400 before anything is charged.

Product ids (`E479000-000`) are global on uniqlo.com, so one id compares a
price across markets in a single `get_uniqlo_prices` call. Prices are numbers
in the market's own currency, never converted. On us, jp, kr and ca (and on
some items sg, my and in) Uniqlo marks a drop with flags only, so
`promo_price` equals `price`; in Europe, Australia and most of Southeast Asia
`promo_price` is below `price`. `on_sale`, `limited_offer` and `price_flags`
carry the flags. Only a limited-time offer has a window: quote Uniqlo's own
label in `price_flags.name` (e.g. "until 11/18"), not a date read from `end`;
a sale flag carries a start but no end, and Select Colors/Sizes Only carries
no dates.

`price_group`: product and prices default to `00`, Uniqlo's regular price
list. Search can list the same `product_id` a second time in price group
`01`, mostly Uniqlo's Select Colors/Sizes Only sale price for some colours /
sizes; pass `price_group: "01"` to `get_uniqlo_product` to read that price
and the colours / sizes it covers. `get_uniqlo_prices` compares group `00`
unless `price_group` is sent.

`get_uniqlo_stock` is online stock; `get_uniqlo_store_stock` is per store.
Send it the price group the variant came from (`price_group`, default `00`):
a variant of price group `01` asked as `00` reads out of stock in every store.
Review totals are pooled per region (the European markets share one pool).
No reviewer names or locations, no price history (poll and store your own)
and no store-level prices. GU is a separate brand and not a separate platform
here; Uniqlo's own listings can include GU collaboration items (kr limited
offers did). Failed calls are not charged; a not-found is charged.

### [ASOS](https://scavio.dev/docs/asos-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

ASOS product data API: ASOS prices by country and currency (one product's price, previous price, RRP, sale flag and online stock by size in each ASOS store and currency), catalogue search, product detail, reviews by store with ASOS's AI summary, categories, brands, the sale and new-in lists, and the markets table, across 235 countries and 245 country-currency combinations.

| Tool | Description |
|------|-------------|
| `search_asos` | Search one store by keyword: product id, title, brand, price, previous price, RRP, lowest 30-day price, discount, colours; up to 200 per page, sorted by relevance, newest or price, filtered by gender, brand, colour, size, body-fit range, product type, price and sale; facets and price range |
| `get_asos_product` | One product by id, co-ord group id or link: description, composition, care, size and fit, every size variant with price and online stock, rating with fit and quality, ASOS's AI review summary and the other colours |
| `get_asos_stock` | Price and online stock per variant of up to 100 product ids in one call, plus the ids the store does not sell |
| `get_asos_reviews` | Reviews of one product on one store, up to 50 per page, sorted and filtered by star rating, with fit and quality averages and ASOS's labelled AI summary |
| `get_asos_suggestions` | Search suggestions for what a shopper has typed, in the store's language |
| `get_asos_category` | Every product of one category or brand page, paged and sorted, with the search filters |
| `get_asos_categories` | The store's women and men navigation tree with category ids |
| `get_asos_brands` | The store's A-Z brand list for women or men (brand_id is a category id) |
| `get_asos_deals` | The store's SALE category for women or men, with previous price and discount |
| `get_asos_new_arrivals` | The store's NEW IN category for women or men |
| `get_asos_markets` | Every country ASOS sells in with its store, language, currencies and size schema |

Platform key `asos`. 1 credit per call on every tool.

Markets (`country`, default `gb`; `currency`, default ASOS's own default for
the country): the 235 countries in ASOS's own country selector, served by 13
ASOS stores. Eleven have a site of their own in their own language: gb (GBP),
us and pr (USD), fr and mc (EUR, French; the French overseas territories in
USD), de and at (EUR, German), es and ad (EUR, Spanish), it, sm and va (EUR,
Italian), au (AUD), dk (DKK), nl (EUR), pl (PLN) and se (SEK). ASOS's
European store (33 countries, English: ie, pt, be, fi, gr, cz, hu, ro, no ...)
and its international store (170 countries, English: ca, mx, in, za, ch, nz,
ae, sa, hk, il, jp, kr, sg, tw, cn ...) serve the rest. `currency` takes any
currency ASOS offers the country (245 country-currency combinations, e.g. ae
AED or GBP, il ILS, GBP or USD, jp USD or GBP). Every tool serves every
combination except `get_asos_suggestions` on pl (ASOS's Polish store answers
no suggestions). Russia and Belarus (ASOS is not selling there), uk (use gb)
and countries ASOS does not list answer 400 before anything is charged.

Product and category ids are the same on every store (titles come back in the
store's language), so one product id compares a price across countries and
currencies with one call per country. Countries served by the same ASOS store
in the same currency share one price list, except Ireland, which has its own
euro prices on ASOS's European store (measured 2026-11-16 on all 245
country-currency combinations); which products are offered still differs by
country. `price` is the lowest size price when ASOS prices sizes differently
(variants carry each size's price). Prices are numbers in the requested currency, never converted:
`price`, `previous_price` (ASOS's "was"), `rrp`, `lowest_price_30d` where ASOS
shows it, `is_marked_down`, `is_outlet`, `discount_percent` and
`discount_basis`. `get_asos_stock` is online stock per variant (ASOS has no
physical stores) and carries variant ids, not size names: map them with
`get_asos_product`. Which reviews come back depends on the store: gb,
us, au and ASOS's European and international stores share one English review
pool; es, it, nl, se, dk and pl add reviews written in their own language to
that pool; fr and de show only reviews written in French or German (each
review carries its language). Reviewer names are never returned. Keyword search
serves at most 2,088 results whatever `total` says (`max_reachable`); category
lists page through everything. The `search_asos` brand filter takes brand
facet ids from a search answer; `get_asos_brands` returns category ids to pass
to `get_asos_category`. No outlet (ASOS's outlet categories are empty), no
promo codes (shown only to signed-in shoppers) and no price history (poll
`get_asos_stock`). Failed calls are not charged; a not-found is charged.

### [Fashion Nova](https://scavio.dev/docs/fashionnova-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Fashion Nova API for Fashion Nova sale prices: each style's price, compare-at (struck-through) price, percent off, final-sale flag and per-size stock in any of Fashion Nova's 104 countries in local currency, plus search, collections (sale, best sellers, new, back in stock) up to about 10,000 products each, product detail with every colour and size, the navigation tree, search suggestions, reviews and similar styles.

| Tool | Description |
|------|-------------|
| `search_fashionnova` | Search one storefront, 60 per page up to page 18 (6 under a sort); size, colour, price, division, category and facet filters; 5 sorts |
| `get_fashionnova_product` | One style in one colour by handle or link: every colour with its own sizes (SKU, price, compare-at, quantity, low stock), rating with fit, the first 3 reviews, Fashion Nova's own AI review summary, size guide, delivery and promo |
| `get_fashionnova_collection` | One collection by handle or link (sale, best-sellers, new, new-this-week, back-in-stock, jeans ...), pages 1 to 166 (up to about 10,000 products), with the search filters |
| `get_fashionnova_categories` | The navigation tree for women, men or curve as collection handles, plus the site's trending searches |
| `get_fashionnova_suggestions` | Search suggestions for a partial query: suggested searches, products and collections |
| `get_fashionnova_reviews` | One style's reviews, 10 per page up to page 8, 4 sorts and a star filter, with size purchased, usual size and fit |
| `get_fashionnova_similar` | Up to 24 styles Fashion Nova recommends as similar (US store, USD) |

Platform key `fashionnova`. 1 credit per call on every tool.

Markets (`country`, default `us`): the 104 countries in Fashion Nova's own
country selector, each in its own currency (37 currencies: us USD, ca CAD,
gb GBP, au AUD, mx MXN, jp JPY, ae AED, the euro countries EUR ...; `zz` is
the site's International storefront in USD). `language` is `en` (default,
every country) or `es` (Spanish titles, descriptions and attributes, in 67
countries; not the US store). A country or language Fashion Nova does not run
answers 400 before anything is charged. Suggestions and categories are the
same in every storefront; reviews are per style (not per colour), one pool
shared by every market, mostly English (no `country`); similar answers from
the US store in USD. A collection lists up to about 10,000 products (pages
1-166); consecutive pages can repeat a few products, so dedupe by
`product_id` + `color`.

Prices are numbers in the storefront's currency, never converted: `price`
(the lowest size price), `compare_at` (the site's struck-through price),
`percent_off` (computed by Scavio: `round((1 - price / compare_at) * 100)`),
`on_sale`, `price_with_code` (the price with Fashion Nova's current code as
the page computes it, 40% off the compare-at price), `code_lowers_price`
(false when that code price is not below `price`: the code does not lower
it) and `final_sale`. In the 27 EEA countries (at, be, cy, cz,
de, dk, ee, es, fi, fr, gr, hu, ie, is, it, lt, lu, lv, mt, nl, no, pl, pt, ro,
se, si, sk) Fashion Nova shows VAT-inclusive prices and no compare-at price,
so `compare_at` and `percent_off` are null there. The same jeans read on
2026-11-19: us 18 USD (compare-at 34.99, 49% off), ca 27 CAD (51), gb 17 GBP
(32), au 31 AUD (60), mx 338 MXN (656), fr 20.95 EUR (no compare-at).
`sizes[].quantity` is the stock Fashion Nova's page shows per size, not a
guaranteed inventory count.

Search is semantic and matched loosely: its `total` moves between calls, a
later page can repeat a few items, and it shows its first 18 pages of 60 (6
under a sort other than `featured`); narrow with filters. Collections page
through fully (`has_more` follows the site's page count). Filters: `size`,
`color`, `price_min` / `price_max` (whole units of the storefront's currency),
`division` (`women`, `curve`), `category`, and `filters` for any other facet
by `facets[].name`; a facet the list does not offer matches nothing and is
listed in `unrecognized_filters` (present only then). Sorts: `featured`, `best_selling`,
`price_low`, `price_high`, `newest`. Reviews: `highest_rated` (default),
`most_recent`, `most_helpful`, `lowest_rated`, `star` 1-5, 10 per page, pages
1 to 8, totals as returned; reviewer names are never returned. Review calls
take 20 to 60 seconds. Not available: stores (Fashion Nova lists none), a
brand directory (everything is Fashion Nova), price history (poll and store
the answers), gift cards, new-arrival dates. Failed calls are not charged; a
not-found is charged.

### [Gap Inc.](https://scavio.dev/docs/gap-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Gap Inc. API for one API across Gap, Old Navy, Banana Republic, Athleta, Gap Factory and Banana Republic Factory (`brand`), in the US (USD) and Canada (CAD, English or French): keyword search and category pages with the list price, the price shown and its type (regular, promotion or markdown), filtered by department, sale type, color, price, rating, pickup store and any facet; the navigation tree; one product with every color and SKU, each with its price and online stock status; current prices for up to 100 colors in one call, banners mixed; stores near a ZIP or postal code with hours; one store's details; pickup stock at up to 10 stores as in stock, low stock or out of stock; search suggestions, trending searches and the banner's current promotions. See the [Gap Inc. API page](https://scavio.dev/gap-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_gap` | Keyword search on one banner, filtered by department, sale type, color, price, rating, pickup store and any facet, 5 sorts, up to 200 per page, with total, pages and facets |
| `get_gap_category` | One category by cid (from `get_gap_categories`) or link, with each color's online unit count as given |
| `get_gap_categories` | The banner's navigation tree with the cid and style each category page takes |
| `get_gap_product` | One product by color id or link: review summary, details, every variant (Regular, Tall, Petite), color and SKU with list price, price shown, discount, stock status, backorder and ship dates, UPC |
| `get_gap_prices` | Current prices for up to 100 colors in one call, banners may mix |
| `get_gap_stores` | Stores of one banner near a US ZIP, a Canadian postal code or a point, with hours, dated holiday hours and pickup |
| `get_gap_store` | One store's public details by store id: status, opening date, address, phone, coordinates, services |
| `get_gap_store_stock` | Pickup stock at up to 10 stores for up to 20 SKUs or every SKU of one style: in_stock, low_stock or out_of_stock |
| `get_gap_suggestions` | The search box's suggested queries with department filters, and suggested products with prices |
| `get_gap_trending` | The trending searches the banner's search box shows |
| `get_gap_deals` | The banner's current promotions as its promo drawer words them, and its menu's sale, deal and clearance links |

Platform key `gap`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Large search or category pages (200 items) can take
about 25 s.

`brand` `gap` (default), `old_navy`, `banana_republic`, `athleta`,
`gap_factory` or `banana_republic_factory`; `country` `us` (default) or `ca`;
`language` `en` (default) or `fr` on `ca`. Ids are per banner and market, and
a product or category link sets both. `regular_price` is the list price and
`effective_price` the price shown; a checkout code discount is never applied to a
price (it shows as text in `flags`, and `get_gap_deals` words it as the site
does, with no end dates). Store stock is the site's pickup bucket per SKU per store,
with no unit counts and no per-store price. Captured 2026-11-26: a Gap search for
jeans gave 713 results over 72 pages of 10, the first the Mid Rise UltraSoft Baggy
Jeans (403540002) at 35 USD shown against a list price of 89.95 USD (promotion, 61%
off); an Old Navy search for sweater gave 393; the Old Navy clearance category
3033077 held 2481 colors; one prices call read 5 colors across Old Navy, Banana
Republic, Athleta, Gap Factory and Banana Republic Factory; the Gap store nearest ZIP
10001 was Times Square, 0.77 miles away; stock for 4 SKUs at 3 stores read in stock
for one SKU at 2 of them and out of stock for the rest; a French Canadian search for
chandail gave 278 results in CAD; the Gap menu had 10 divisions and 302 categories,
and the deals drawer 5 offers. Not available: review texts, unit counts per store,
in-store prices, promotion end dates, price history (poll and store the answers),
checkout. Failed calls and refused inputs are not charged; a not-found (a page past
the last, an unknown cid, product or store) is charged.

### [Zappos](https://scavio.dev/docs/zappos-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Zappos API for Zappos (zappos.com, the US shoe and clothing store, an Amazon company) and 6pm (6pm.com, the Zappos outlet site): keyword search or the whole catalog, one value per facet (brand, gender, department, category, size, width, color, price band, on sale), sorted by relevance, price, percent off, rating, newest or best sellers, plus a sale mode; one product in full with every color and size, the exact units in stock per size, width and color, price and original price per style, UPC and ASIN; customer reviews with comfort, look and fit ratings; customer questions with Zappos staff answers; the lowest price of each color as Zappos gives it; the department and category tree with item counts; and search suggestions. See the [Zappos API page](https://scavio.dev/zappos-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_zappos` | Keywords or the whole catalog on zappos.com or 6pm.com (`site`), one value per facet (up to 12 facets), 7 sorts, `mode` sale, up to 100 items a page with total, total_pages, facets and per-color units on hand |
| `get_zappos_product` | One product by `product_id`, `style_id`, `stock_id` or `asin`: every color with price, original price, percent off, badges and attributes, every size with exact units on hand, UPC and ASIN, the fit answers of reviewers and a review summary |
| `get_zappos_reviews` | Customer reviews of one product, 25 a page, most helpful or latest: overall, comfort and look ratings, size, width and arch fit, text, date, upvotes, verified purchase and incentivized flags, media (zappos.com only) |
| `get_zappos_questions` | Every customer question of one product with its answers, votes and the answers by Zappos staff (zappos.com only) |
| `get_zappos_lowest_prices` | The lowest price of each color of one product as Zappos gives it for its product page (zappos.com only) |
| `get_zappos_categories` | One level of the department > category > subcategory tree with item counts and the facets search takes |
| `get_zappos_suggestions` | Up to 10 search-box completions for a partial query |

Platform key `zappos`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged.

US only, prices in USD. zappos.com and 6pm.com share product, style and stock
ids, but prices and stock differ between them, so every answer names its site;
reviews, questions and lowest prices exist on zappos.com only (`site` 6pm is
refused, not charged). `on_hand` is the exact number of units in Zappos'
warehouse stock (Zappos sells online and has no stores). A color or size that
is out of stock has no price on the site: `price` is null with a `price_note`.
The lowest prices are each color's lowest price as Zappos gives it; Zappos does
not state the period they cover, so they are not a 30-day low. Captured
2026-11-26: running shoes on zappos.com gave 7142 items over 715 pages; Brooks
Adrenaline GTS 25 (10002909) had 22 colors and 512 sizes, 114 in stock with
5995 units in all, color Black/Biscuit at 109.95 USD (was 155, 29% off) with
76 units; HOKA Bondi 9 had 2558 reviews over 103 pages; product 9405856 had 33
questions with 11 answers by Zappos staff; department Shoes held 63603 items in
13 categories. Reviews and questions carry no reviewer, asker or answerer
names. Not available: store stock (there are no stores), several values in one
facet, price history (poll and store the answers). Failed calls and refused
inputs are not charged; a not-found (an unknown product, department or
category) is charged.

### Vinted

| Tool | Description |
|------|-------------|
| `search_vinted` | Search second-hand listings on any of 27 Vinted country sites by keywords, category, brand, condition, size, color, material and price range, sorted by relevance, newest or price: 96 items per page, pages 1-10, with price, the Vinted fee, total price, brand, size, condition, favourites, photos and the seller id |
| `get_vinted_product` | One listing by item id or URL: description, price in the seller's currency, brand, size, condition, color, material, category path, all photos, reserved and sold state, and the seller's login, feedback count and rating |
| `get_vinted_seller` | A member's public seller profile: feedback count and rating, positive / neutral / negative counts, listed item count, verification, response time, holiday mode, last seen |
| `get_vinted_seller_products` | The items one member has listed, newest first, cheapest first or by relevance, up to 96 per page |
| `get_vinted_seller_feedback` | Reviews left for a member, newest first, up to 50 per page: rating 1-5, text, date, automatic flag and the member's reply; no reviewer identity |
| `get_vinted_brands` | Find brands by name: brand id (for search's `brand_ids`), listing count, luxury flag and whether Vinted authenticity-checks it |
| `get_vinted_suggestions` | The Vinted search-box autocomplete in the site's language, up to 10 suggestions with their type |
| `get_vinted_filters` | The options of one search filter (size, condition, color, material) with live item counts, optionally for a query and category |
| `get_vinted_categories` | The category tree in the site's language (9 top-level, about 3,000 in all), or one category's subtree with its path |

Platform key `vinted`. 1 credit per call, every tool. Every tool takes an
optional `country`: `fr` (default), `be`, `lu`, `es`, `nl`, `lt`, `de`, `at`,
`it`, `uk`, `pt`, `us`, `cz`, `sk`, `pl`, `se`, `ro`, `hu`, `dk`, `fi`, `hr`,
`gr`, `ie`, `ee`, `lv`, `si`, `au`. Category, condition and filter names come
back in that site's language. Every site, `uk`, `us` and `au` included, can
show listings from sellers in other countries, with the price converted to the
site's currency (vinted.co.uk shows an Australian seller's 20 AUD item at
10.43 GBP); the EU sites share one cross-border pool. A product is priced in
the SELLER's own currency, which can differ from the site's.
`service_fee` is the Vinted fee the buyer pays on top of the price (formerly
the Buyer Protection fee). Search serves at most 10 pages of 96
(`total_is_capped` is true past 960 matches), and price sorts surface loosely
matching cheap listings, so pair them with a category or price range. Live
listings only: no sold-item search, shipping prices, pickup points or similar
items. Seller data is limited to public buyer-relevant fields.

### [Mercari](https://scavio.dev/docs/mercari-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Mercari API for Mercari US (mercari.com, USD, English) and Mercari Japan (jp.mercari.com, JPY, Japanese): Mercari sold prices and on-sale listings for the same query, item detail with price drops, categories, brands, US deals and trending, and Mercari Japan seller profiles, seller reviews and Mercari Shops shops.

| Tool | Description |
|------|-------------|
| `search_mercari` | Search listings by keyword, category or brand: price, original price and discount when the seller dropped it, condition, brand, size, seller id, free shipping (us: with the shipping filter), created time; `status` on_sale, sold (sold and in transit) or all; sorted by relevance, newest, price, likes (jp) or recently sold (us; us sold searches come most recently sold first); us 50 per page up to page 20, jp 120 per page up to page 91 |
| `get_mercari_item` | One listing by item id or link: description, price, original price, sold_at (when Mercari shows it), condition, category path, size, color, shipping (payer, method, days to ship, ships from), likes, photos and the seller summary; jp adds the full public comment list and Mercari Shops products |
| `get_mercari_category` | Listings in one category, paged and sorted, with keywords and the search filters |
| `get_mercari_categories` | The category tree: us one level at a time, jp the full tree or one parent's children |
| `get_mercari_brands` | The brand list (us about 28,800, jp about 52,600), filtered by name, pages of 1,000 |
| `get_mercari_brand` | Listings of one brand, paged and sorted, optionally within a category |
| `get_mercari_deals` | Listings on Mercari's deals filter (price dropped), with original price and discount (us) |
| `get_mercari_trending` | Mercari's trending keywords and brands with rank, change, demand and 7-day sold rate as Mercari shows them (us) |
| `get_mercari_seller` | A seller's public profile: good / normal / bad ratings, listing count, followers, badges and the first 30 listings (jp) |
| `get_mercari_seller_reviews` | The most recent 100 reviews of a user: rating, text, date and role (seller or buyer), no reviewer names (jp) |
| `get_mercari_shop` | A Mercari Shops shop profile: rating, review count, followers, open state, badges (jp; no product list) |

Platform key `mercari`. 1 credit per call on every tool.

Markets (`country`): `us` (default) and `jp`. Search, item, category,
categories, brands and brand serve both; deals and trending are us only;
seller, seller reviews and shop are jp only. A market a tool does not serve,
Mercari UK (closed: `gb` / `uk`) and any other value answer 400 before
anything is charged. Item, category, brand and seller ids are per market: an
id from us is not valid on jp. `status: "sold"` returns sold listings (sold
and in transit) with their prices, so asking prices and sold prices for the
same query come from one tool. On us, Mercari orders sold results most
recently sold first whatever relevance asks (price sorts apply) and matches the
keyword more loosely than on-sale results, so check titles before comparing
prices. Sold US items keep full data on `get_mercari_item`, with `sold_at` when
Mercari shows it. Search grids carry no likes and no sold time (the item has
both); on us they carry `free_shipping` only when you filter by shipping. us
pages run to page 20 and later pages can repeat earlier items, so dedupe by
`item_id`; `total` stops at 10,000 on us and 15,000 on jp (that many or more). Prices are numbers, US dollars on us and whole yen on jp;
`original_price` is the seller's earlier price when above `price`, with
`discount_percent` against it (never set on jp results). Mercari Japan data is in Japanese as sellers
wrote it (not translated), and jp calls are slower (typically 10-20 s, up to
about a minute; us about 3-20 s). jp `newest` follows Mercari Japan's own
order, where relisted items move up. Not available: US seller profiles and
reviews, US search suggestions, Japanese trending, price-drop history, buying
or messaging. Failed calls are not charged; a not-found is charged.

### [Depop](https://scavio.dev/docs/depop-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Depop API for Depop resale prices: what Depop listings ask in each storefront (the buyer-market price with buyer fee, tax and shipping as Depop shows them), what a shop's items sold for, shop profiles with ratings, reviews and items sold, plus brand, category and curated explore pages, search suggestions and similar listings, across Depop's 9 storefronts.

| Tool | Description |
|------|-------------|
| `search_depop` | Search listings for sale in one buyer market: the first 24 results per query, sorted by relevance or price; brand, condition, colour, price range, marked-down, gender, group / product type, kids and size filters; facets with counts |
| `get_depop_product` | One listing by slug, link or product id, priced for a buyer in the market: description, hashtags, brand, category path, condition, colours, sizes, shipping, discount, the buyer-market price and the seller's own listing price, and the seller summary (rating, reviews, items sold, last seen) |
| `get_depop_category` | The first 24 listings of one category path (e.g. `mens/bottoms/jeans`) |
| `get_depop_brand` | The first 24 listings of one brand by slug |
| `get_depop_explore` | One of Depop's curated explore pages (e.g. `90s-menswear`) with the market's other explore pages |
| `get_depop_suggestions` | Search suggestions for a partial query, with their group and gender |
| `get_depop_shop` | A shop's profile: bio, verified, followers, rating, review counts, items sold, last seen, listings per category |
| `get_depop_shop_products` | A shop's listings for sale, cursor-paged (24 per page), with created and updated times |
| `get_depop_shop_sold` | A shop's sold listings with the price they sold at, any markdown and whether it sold on Depop or was marked sold by the seller, cursor-paged (24 per page) |
| `get_depop_shop_reviews` | Reviews a shop got as a seller or as a buyer, 24 per page: date, rating, text and the product; no reviewer names |
| `search_depop_shops` | Shops whose username matches a query |
| `get_depop_categories` | The category tree (departments, groups, product types) with the paths and ids the other tools take; names in en, en-US, de, fr or it; optional size sets |
| `get_depop_brands` | Brands by first letter, or one brand by slug with its description |
| `get_depop_similar` | Listings Depop shows as similar to one listing (us) |

Platform key `depop`. Credits per call: search, category, brand and explore
1 (5 on nz); product 1 on us, 2 on gb, au, ie, ca, de, fr, it and 6 on nz;
suggestions 1 on every market; shop, shop products, shop sold, shop reviews,
shops search, categories, brands and similar 1.

Markets (`country`, the buyer's country, default `us`): us (USD), gb (GBP;
`uk` accepted), au (AUD), ie (EUR), ca (CAD), nz (NZD), de (EUR), fr (EUR),
it (EUR). Search, product, category, brand, explore and suggestions serve all
nine; similar is us only; shop data, categories and brands are global (no
`country`). Any other country answers 400 before anything is charged.

Search, category, brand and explore return the first 24 results per query:
Depop serves no next page, so narrow with filters, sort or a price range.
Sorts are relevance, `price_asc` and `price_desc` (newest and most popular are
not available). The market is the buyer's: listing ids are global, search
shows that market's sellers, and the same listing priced from another market
shows that buyer's fee, tax (for example UK import VAT) and shipping. Prices
are numbers: `price`, `original_price` (the seller's own original price),
`buyer_fee`, `tax`, `shipping` (what the buyer pays), `total` (Scavio's sum of
price, buyer fee, tax and shipping) and `headline_price` (the price Depop
itself headlines: us leaves out shipping, gb includes the fee and shipping),
in the listing's currency (`price.currency`), which is usually the market's
but some sellers list in another one: list items carry `buyer_market_price`,
false for those, which Depop shows unconverted (product too). List items
carry no seller country; `get_depop_product` has `seller.country`. On us,
Depop returns a buyer fee on some calls and not on others for the same
listing: report what it returns. Depop has no keyword search of sold
listings: sold prices come per shop from `get_depop_shop_sold` (`status` `sold` =
sold on Depop, `marked_as_sold` = the seller marked it sold, which may be
outside Depop), and Depop shows no sale date (`updated_at` is the listing's last update). Depop's
interface is English in every storefront; titles and descriptions are what
sellers wrote (often German, French or Italian on de, fr, it). No seller real
names, cities or reviewer identities. Not available: results past the first
24, keyword sold search, trending searches, views, join date, Top Seller
badge, offers / bundles, price history, similar outside us. Failed calls are
not charged; a not-found is charged.

### [Poshmark](https://scavio.dev/docs/poshmark-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Poshmark API for Poshmark sold prices: sold listings by keyword with the price shown on the sold listing and the date Poshmark marked it sold, filtered by brand, department, category, size, condition, colour and price; active listings with the original price the seller entered and price drops; closets with items sold and Love Notes; plus categories, top brands, suggestions, Posh Parties and similar listings, on poshmark.com (USD) and poshmark.ca (CAD).

| Tool | Description |
|------|-------------|
| `search_poshmark` | Search listings in one market, 48 per page (about 5,000 reachable per query): available, sold or all; brand, department, category, size, condition, colour and price filters; 7 sorts incl. just in and price drop; facets |
| `get_poshmark_sold` | Sold listings by keyword with the price shown on the sold listing and `sold_at`, the date Poshmark marked it sold; up to 480 per query and filter combination (10 pages of 48) |
| `get_poshmark_product` | One listing by id or link: description, prices (price, original price, first price, price drop), shipping, bundle discount, sizes with quantities, comments (no authors), and the seller summary (Posh Ambassador, items sold, orders shipped, Love Notes) |
| `get_poshmark_category` | One category's listings (department, category, subcategory from `get_poshmark_categories`), available, sold or all |
| `get_poshmark_brand` | One brand's listings, optionally in one department and category, available, sold or all |
| `get_poshmark_closet` | A closet (seller) by username: followers, listings, shares, items sold, orders shipped, Love Notes count, Posh Ambassador, last active, joined |
| `get_poshmark_closet_listings` | A closet's available or sold listings, 48 per page, in the seller's home market |
| `get_poshmark_love_notes` | The latest 100 Love Notes a closet received, with the total count; no authors |
| `search_poshmark_closets` | Closets whose username matches a query, 24 per page |
| `get_poshmark_categories` | The category tree: 6 departments, their categories and subcategories with the slugs the other tools take |
| `get_poshmark_brands` | Poshmark's top 50 brands in a market |
| `get_poshmark_suggestions` | Brand and brand + category suggestions for a partial query |
| `get_poshmark_parties` | Posh Parties of a market: upcoming and recent, with themes, hosts and listing counts |
| `get_poshmark_party_listings` | Listings shared to one Posh Party, 20 per page by cursor |
| `get_poshmark_similar` | 16 listings Poshmark shows as similar to one listing |

Platform key `poshmark`. 1 credit per call on every tool.

Markets (`country`, default `us`): us (poshmark.com, USD) and ca
(poshmark.ca, CAD); both storefronts are English. Search, sold, category,
brand, brands, suggestions, parties, party listings and similar return that
market's own listings in its currency. Listing ids and closets are global: a
listing opens from either market in its own currency (no conversion), and
closet listings are read in the seller's home market. Any other country
answers 400 before anything is charged.

Sold search reaches up to 480 sold listings per query and filter combination
(10 pages of 48, Poshmark's own limit); `total` is Poshmark's approximate
count, so narrow with filters or split by `price_min` / `price_max` to reach
more. On a sold listing, `price` is the price shown on the sold listing
(Poshmark says a sold listing reflects the final order price; offers are
private and not returned) and `sold_at` is the date Poshmark marked it sold.
`original_price` is the original price the seller entered; `first_price` is
the price it was first listed at, which can be below `price` when the seller
raised the price. Active search reaches about 5,000 listings per query (105
pages of 48). Conditions: `new_with_tags`, `new_with_tags_or_boutique`,
`boutique`, `like_new`, `good`, `fair`. Sorts: relevance, `just_shared`,
`just_in`, `price_asc`, `price_desc`, `price_drop`, `most_liked`.
`items_sold` is Poshmark's display string (e.g. `700+`). Seller usernames
only: no real names, cities, likers, comment authors or Love Note buyers.
Not available: sold results beyond 480 per query and filter combination, Love
Notes beyond the latest 100, Posh Shows, trending searches, the full brand
directory (top 50; brand inputs take any name), offers, bundles, price
history. Failed calls are not charged; a not-found is charged.

### [OfferUp](https://scavio.dev/docs/offerup-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

OfferUp API for OfferUp (offerup.com, the US local marketplace for buying and selling used items, cars and trucks): asking prices around any US ZIP code, so the same item's asking prices in different US metros, with the area OfferUp resolved the ZIP to; cars and trucks filtered by dealer or private seller, make, model year and mileage; one listing in full with condition, posted date and vehicle details; the category tree; and a seller's public profile numbers. See the [OfferUp API page](https://scavio.dev/offerup-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_offerup` | Search by keywords around a US ZIP (required) with a radius: 5 sorts plus newest model year and lowest mileage for vehicles; filters by asking price, condition, category, and in Cars & Trucks seller type (dealer or private), make, year range and max mileage; about 48 a page up to page 50, `has_more`, no total count |
| `get_offerup_listing` | One listing by id or link: asking price, original price, firm, status, condition, posted and updated dates, description, photos, category, attributes, vehicle details (no VIN), city and state, local pickup and the seller's public numbers |
| `get_offerup_category` | One category by slug or id around a US ZIP, with the search filters, sorts (no best match) and paging |
| `get_offerup_categories` | The category tree: 14 top-level categories, 151 in all, with the slugs and ids the other tools take |
| `get_offerup_seller` | A seller's public profile: seller type, rating, rating count, items sold, joined, response time, last active, badges, the first 20 listings; dealers and businesses also name, website and opening hours |

Platform key `offerup`. 1 credit per call; `get_offerup_listing` is 1, or 2
when the listing needs a second, costlier fetch. `credits_used` in the
response is what was charged.

US only, prices in USD. `zip` is required on search and category: OfferUp
lists local items, and `location.resolved` says which area OfferUp used for
the ZIP (captured 2026-11-25: 98101 resolved to Seattle, 60601 to Chicago),
`location.radius_miles` which radius it applied. `filters_not_applied` lists
any filter OfferUp did not apply to the feed (vehicle filters on a
non-vehicle search). `seller_type` applies in Cars & Trucks only: on search it
limits the results to category 5.1. Promoted OfferUp listings are marked
`sponsored`. Search tiles carry no posted date or condition (the listing
does). Prices are asking prices, not sold prices. Private sellers: no seller
names (a dealer or business account's name only), usernames, avatars, phone
numbers, emails, street addresses, coordinates or VINs; phone numbers, emails
and VIN-like codes in titles and descriptions read `[removed]`. Not
available: sold listings or sold prices (OfferUp does not show them
publicly), shipping (OfferUp ended nationwide shipping in 2025; listings are
local pickup), search suggestions, a total result count, a seller's listings
past the first 20, messaging or offers. For the same item's new price use the
Amazon and Walmart tools, and Mercari's sold search for sold prices (match on
model and title). Failed calls and refused inputs are not charged; a
not-found (an unknown listing, category or seller) is charged.

### [thredUP](https://scavio.dev/docs/thredup-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

thredUP API for thredUP prices: each item's price, the estimated original retail and % off, condition and flaws, measurements, materials and who priced it (thredUP, a Direct Listing seller or a dropship partner); search, sold listings by brand or category, category, brand and deal grids (clearance, under $10, new arrivals, price drops), Rescue boxes, the category and filter values, the brand directory, suggestions, trending searches and similar items, on thredUP's US store (thredup.com, USD).

| Tool | Description |
|------|-------------|
| `search_thredup` | Search items, 119 per page up to page 21 (about 2,500 per query); semantic free text plus brand, department, category, size, condition, colour, material, pattern, price, clearance and seller-type filters; 7 sorts |
| `get_thredup_sold` | Sold listings by filters only (brand and / or category, no keyword), with the price the item last listed at; thredUP shows no sold date |
| `get_thredup_product` | One item by item number or link: price, estimated original retail, % off, condition notes (the flaws thredUP noted), measurements, characteristics, materials, pictures, authentication, Direct Listing shipping and buyer protection, similar brands |
| `get_thredup_category` | One department's category (department and category tag from `get_thredup_categories`) |
| `get_thredup_brand` | One brand's items in a department |
| `get_thredup_deals` | Deal collections: `clearance`, `under_10`, `new_arrivals`, `price_drops` |
| `get_thredup_rescue_boxes` | Rescue boxes (mystery bundles): bundles with item count, price and state |
| `get_thredup_categories` | One department's categories and filter values: sizing ids, conditions, colours, materials, patterns, price ranges |
| `get_thredup_brands` | The brand directory: brands matching a term, every brand under a letter, or the letter groups |
| `get_thredup_suggestions` | Search suggestions for a partial query, each a ready filter set |
| `get_thredup_trending` | Trending searches for women, girls or boys |
| `get_thredup_similar` | The first 120 items thredUP shows as similar to one item |

Platform key `thredup`. 1 credit per call on every tool.

One store: thredup.com in USD (thredUP ships to the US and Canada from it),
so there is no `country` input. Departments: `women` (default), `girls`,
`boys`, `handbags`, `shoes`, `designer`, `plus`, `juniors`, `maternity`,
`accessories`; thredUP has no men's department.

`estimated_retail` is the estimated original retail: thredUP's own estimate on
items thredUP prices, entered by the seller on Direct Listing items.
`percent_off` is computed from the price and the estimated retail
(`round((1 - price / estimated_retail) * 100)`), null when the estimated retail
is missing or not above the price. `seller_type` says who priced the item:
`thredup`, `direct_listing` (peer sellers) or `dropship` (partner listings).
`status`: `available`, `reserved`, `sold`. Conditions: `new_with_tags`,
`excellent`, `very_good`, `good`, `flawed`.

List tools answer 119 items per page, pages 1 to 21 (about 2,500 items per
query and filter combination); `total` caps at 10,000 (`total_capped` true
means 10,000+). Free text is matched loosely (semantic), so use the `brand`
filter for one brand. `size` takes sizing ids from `get_thredup_categories`,
not labels; `condition`, `color` and `material` take up to 5 values. The price
filter is approximate (thredUP matches a base price). Every answer reports the
`sort` applied. Sold listings take filters only, with the price the item last
listed at and no sold date. List calls take 15 to 45 seconds. Not available:
product reviews (thredUP shows none), seller shops, sold dates, men's clothing,
price history. No seller or consignor names or ids are returned. Failed calls
are not charged; a not-found is charged.

### Macy's

| Tool | Description |
|------|-------------|
| `search_macys` | Search macys.com (US), 60 organic items per page: price, regular and sale price, percent off, sale end date, deal label (Black Friday Deal, Clearance, LAST ACT, Today Only), promotions, rating, review count, colors; filter by brand, color, special offer, any price range, pickup store or any facet; sort by featured, price, top rated, best sellers or newest; plus the facets with counts |
| `get_macys_product` | One product by id or URL, or up to 10 ids in one call: price block with sale end, rating histogram, text vs total review counts, fit slider, AI review summary, colors with prices, sizes and every variant (UPC, color, size, availability, low-stock flag, ship days) |
| `get_macys_reviews` | Macy's own reviews, up to 100 per page, newest, highest or lowest rated or with photos first, filtered by star rating or a word, with slider ratings, photos, syndication source and the brand's response |
| `get_macys_category` | Browse a category by id or URL, 60 per page, with the same filters and sorts as search |
| `get_macys_brand` | Browse a brand's page by its page id (a product's `brand_page_id`) or URL, 60 per page, with the same filters and sorts as search |
| `get_macys_deals` | Sales & Offers, Clearance, Today Only, Last Act, Limited-Time Specials or Black Friday Deals, 60 per page, with the same filters and sorts as search |
| `get_macys_stores` | Macy's stores near a ZIP, a point or a city + state, up to 15, with hours, curbside hours and the same-day pickup cut-off |
| `get_macys_store_availability` | Store pickup for one product: which stores near a location can hand it over, or per variant at one `store_id` whether it can be picked up and whether it is in the store |
| `get_macys_suggestions` | The macys.com search-box autocomplete, up to 7 suggested searches |

Platform key `macys`. 1 credit per call, every tool. US site only, prices in
USD. Search, category, brand and deals share one grid: 60 organic items per
page with `total` and `total_pages`, and totals can differ between sorts, as
they do on the site. Ad-only sponsored tiles are dropped (`sponsored_dropped`
counts them) unless `include_sponsored`; organic items that also hold a paid
slot stay, flagged `is_sponsored`. A keyword Macy's maps to a category returns
`redirected_to_category`. A batch of `product_ids` (up to 10) gets Macy's
summary view: no rating histogram, and a collection without its members'
variants. A collection member's id answers with the collection product
(`requested_id` echoes the id asked for). `review_count` includes ratings
without text; reviews returns written reviews only (`text_review_count`).
Store availability is pickup and in-store flags, never unit counts: Macy's
publishes no quantities. A `store_id` comes from `get_macys_stores`. No coupon
codes, Q&A text or price history: to track prices, poll and store your own.

### Saks Fifth Avenue

| Tool | Description |
|------|-------------|
| `search_saks` | Search saksfifthavenue.com (US), 24 grid positions per page: price, regular and sale price, percent off, badge, final-sale and clearance flags, returnable, limited inventory, promotions, review count, colors; filter by designer, color, size, any price range, on sale, new arrivals or any facet; sort by featured, best sellers, newest, price, sale first or designer A-Z; plus the facets with counts and price ranges |
| `get_saks_product` | One product by id or URL, optionally one color + size: price block, final-sale / returnable / marketplace flags, promotions, colors and sizes with availability, every SKU with its online warehouse units, availability message and restock date, merchandising attributes, average rating and review count |
| `get_saks_category` | Browse a category by its `/c/` path or URL, 24 per page, with the same filters and sorts as search, plus breadcrumbs |
| `get_saks_brand` | Browse a designer's page by slug (from `get_saks_designers`) or URL, 24 per page, with the same filters and sorts as search |
| `get_saks_deals` | Sale, Women's Clothing Sale, Men's Sale, Women's New Arrivals or Men's New Arrivals, 24 per page, with the same filters and sorts as search |
| `get_saks_stores` | Saks stores near a ZIP or a point within 15-300 miles, with today's hours and a `pickup` flag for stores that offer in-store pickup |
| `get_saks_store_availability` | Pickup availability of one variant sku at stores near a location: availability message, in stock, limited, and `units_at_store` when the site shows a count |
| `get_saks_suggestions` | The search-box suggestions: result count, designers, categories (with paths for `get_saks_category`), up to 5 products and popular searches |
| `get_saks_designers` | The A-Z designer index (about 1,200 designers) with the slugs `get_saks_brand` takes, optionally one letter |

Platform key `saks`. 2 credits per call, every tool. US site only, prices in
USD. Search, category, brand and deals share one grid: 24 positions per page
with `total`, `total_pages`, `start` and `next_start`. An editorial tile can
take a grid position, so a page may carry 22-23 items: walk with `start` =
the previous `next_start` to miss nothing (`page` also works). A keyword the
site maps to a designer or category page returns `redirected_to`. Facet
values feed the filters as listed: `size` takes the facet label ("Medium",
not "M"). Store availability needs a VARIANT sku (a product's
`variants[].sku`, or a product resolved with color + size); `units_at_store`
is present only when the site shows a count, otherwise null. Rating and
review count only: review text is not available. No clearance list, coupon
codes, international prices or price history: to track designer sale
prices, poll and store your own.

### Kohl's

| Tool | Description |
|------|-------------|
| `search_kohls` | Search kohls.com (US), 120 products per page: price, regular and sale price, price label (sale / clearance), percent off, with-code price and its offer codes, cart-only price flag, promotions, rating, review count, badges, Sephora and pickup / ship-to-store flags, sponsored flag; filter by brand, color, size, on sale, clearance or any facet value (price buckets included); sort by featured, new arrivals, best sellers, price, highest rated or percent off; plus the facets with counts and `corrected_query` |
| `get_kohls_product` | One product by id or URL, optionally at one store: price block with with-code price and offer codes, Kohl's Cash earn and redeem windows, the public offers that apply, `dept`, every variant with sku, UPC, color, size, availability and online units, average rating, review count and recommended percent |
| `get_kohls_category` | Browse a catalog listing by its path or URL (the path carries its `CN=` filter), 120 per page, with the same filters and sorts as search, plus breadcrumbs |
| `get_kohls_brand` | Browse one brand by name or URL, 120 per page, with the same filters and sorts as search |
| `get_kohls_deals` | Clearance (default), Sale, items that earn Kohl's Cash now, or Sephora at Kohl's, 120 per page, with the same filters and sorts as search |
| `get_kohls_stores` | Kohl's stores near a ZIP, a city + state or a point within 1-100 miles (default 25): `store_id`, address, phone, weekly hours, badges (Sephora...) and services |
| `get_kohls_store_availability` | Pickup stock of one SKU at every store within about 50 miles of a ZIP: `pickup_units` (a unit count), `stock_level`, ship-to-store units and window, store hours |
| `get_kohls_suggestions` | The search-box suggestions: keyword completions, or matching products with `type: "products"` |
| `get_kohls_coupons` | Today's public Kohl's coupon codes: code, description, end date, Kohl's Card-only flag, terms and eligible-products URLs |

Platform key `kohls`. 2 credits per call, except `get_kohls_stores` (1
credit). US site only, prices in USD. Search, category, brand and deals share
one grid: 120 products per page with `total` and `total_pages`; up to about 8
sponsored items stay in the list, flagged `is_sponsored` and counted in
`sponsored_count`. Facet value ids feed `filters` as returned; price is a
facet bucket ("Price:$25 to $50"), not a free min / max. A category needs a
kohls.com catalog path or URL that carries its `CN=` filter. Store
availability takes a product's `variants[].sku` (and optionally its `dept`)
and returns real pickup unit counts per store. `with_code_price` is the
price after a public offer code, with the code. Rating and review count only:
review text is not available. No price history, international sites, account
offers or checkout: to track clearance prices, poll and store your own.

### JCPenney

| Tool | Description |
|------|-------------|
| `search_jcpenney` | Search jcpenney.com (US), 48 products per page (at most 25 pages): current, regular and after-coupon price ranges with the coupon code, price type (sale / clearance / original), percent off, deal label, rating, review count, badge, availability label, colors with SKU ids, marketplace flag and seller; filter by brand, color, size, price range, deal label or any facet value; sort by relevance, new arrivals, best sellers, rating or price; plus the facets with counts, `corrected_query` and `redirected_to` |
| `get_jcpenney_product` | One product by id or URL, or up to 20 by `product_ids`: price block (regular, sale and clearance ranges, percent off, after-coupon price with its code, price window), breadcrumbs, average rating, review count, question and answer counts, and every variant with sku, UPC, color, size, status and online stock level (high / low / out) |
| `get_jcpenney_category` | Browse a category by its `/g/` path or URL (the path carries its `id=cat...`), 48 per page, with the same filters and sorts as search, plus breadcrumbs |
| `get_jcpenney_brand` | Browse one brand by name or brand page URL, 48 per page, with the same filters and sorts as search |
| `get_jcpenney_deals` | Clearance (default), Sale, Black Friday deals, Big Buy, Limited Time Special, Best Value, Gotta Have It, Closeout, Buy 1 Get 1 or any Deals & Promotions label, across all products or one department |
| `get_jcpenney_stores` | JCPenney stores near a ZIP, a city + state or a point within 1-100 miles (default 25), paged: `store_id`, address, phone, weekly hours, timezone, services (salon, portrait studio, JCPenney Beauty, Curbside Pickup...), pickup directions and bookable appointments |
| `get_jcpenney_store_availability` | Real unit counts of one SKU at the 5 nearest stores to a ZIP (or lat + lng): `quantity`, `status`, `updated_at`, store hours, plus `stores_with_stock` and `total_quantity` |
| `get_jcpenney_suggestions` | The search-box suggestions: keyword completions with their search URL and department refinements where JCPenney offers them |
| `get_jcpenney_coupons` | Today's public JCPenney coupons: code (null for in-store offers that need none), channel, headline, details, start and end dates, disclaimer and eligible-products URL |
| `get_jcpenney_reviews` | Real review text of one product by id or URL, up to 98 per call (default 38), sorted most recent, most helpful, highest or lowest rating, or relevance, optionally one star rating: `total_reviews` (every language), `displayed_reviews` (the English reviews JCPenney lists), `matching_reviews` for the sort and filter, rating distribution, recommended percent, secondary ratings (Quality, Value...), and per review the text, rating, author nickname, location, dates, helpful votes, `verified_purchaser`, `incentivized`, `syndicated` with `syndication_source`, photos, videos and the brand's response |
| `get_jcpenney_questions` | Customer questions and every answer for one product, up to 50 questions (default 10), newest answers first: `total_questions`, `total_answers`, and per answer the text, author, `author_type` (brand, retailer for JCPenney staff, ai, customer), `ai_label` (AI-Generated / AI-Assisted), `is_best_answer` and votes |

Platform key `jcpenney`. 1 credit per call, reviews and questions included. US site only (Puerto Rico
stores included), prices in USD. Search, category, brand and deals share one
grid: 48 products per page, at most 25 pages (1,200 items deep), with
`total` and `total_pages`. Facet values feed `filters` as
`{facet id: value}`. A category needs a jcpenney.com `/g/` path or URL that
carries its `id=cat...`; a department page lists no products without a
filter. Prices are product-level ranges plus the after-coupon price and its
code: JCPenney does not expose a price per size or color. Store availability
takes a product's `variants[].sku` and returns real unit counts at exactly
the 5 nearest stores. Reviews and questions are slower than the other
tools: usually 15-90s, up to about 3 minutes, and failed calls are not
charged. `total_reviews` counts every language and is often larger than
`displayed_reviews`; the questions list has no sort option. Reviewer age,
gender and IP addresses are never returned. No price history, international
sites, account offers or JCPenney Rewards balances, or checkout: to track
clearance prices, poll and store your own.

### Dick's Sporting Goods

| Tool | Description |
|------|-------------|
| `search_dicks` | Search dickssportinggoods.com (US), 48 items per page by default (up to 144): current and list price ranges, percent off, MAP "see price in cart" flag, rating, review count, badge, options, `is_pinned` and `scheduled_prices` (the offer-price windows Dick's has planned); filter by brand, an approximate price range or any facet value; sort by relevance, top sellers, savings, price, featured, new arrivals or brand A-Z; plus facets with counts, categories, `did_you_mean` and `redirected_to` |
| `get_dicks_product` | One product by id or URL with every SKU: price, list price, percent off, MAP flag, `is_clearance`, `online_units`, UPC, `buyable`, ship class and lead time per variant, plus specs, attributes, category, rating, review count and question and answer counts (2 credits) |
| `get_dicks_products` | Up to 5 products in one call: the fast style-level summary (price and list-price ranges, percent off, clearance, buyable, options, specs, rating, review count), unknown ids in `not_found` |
| `get_dicks_reviews` | The 15 newest reviews of one product with full text, pros, cons, badges, secondary ratings, photos and the brand's response, plus rating stats and distribution and question and answer counts (2 credits) |
| `get_dicks_category` | Browse a category by its `/f/` or `/c/` path, URL or id, in the site's featured order by default, with the same filters and sorts as search |
| `get_dicks_brand` | Browse one brand by name, optionally narrowed by a keyword, with the same filters and sorts as search |
| `get_dicks_deals` | Clearance (default), Sale or This Week's Deals, with the same filters and sorts as search (sort `savings` for the biggest discounts first) |
| `get_dicks_store_availability` | Unit counts for 1-20 SKUs at up to 100 stores near a ZIP or a point within 1-250 miles (default 25): DICK'S, Golf Galaxy or Public Lands stores with address, phone, hours, distance, `units` and `in_store_units` per SKU, plus `sku_totals` |
| `get_dicks_suggestions` | The search-box suggestions: keyword completions, brands, categories and products with prices |

Platform key `dicks`. 1 credit per call, except `get_dicks_product` and
`get_dicks_reviews` at 2 credits. US site only, prices in USD. Search,
category, brand and deals share one grid: 48 items per page by default, up
to 144, with `total` and `total_pages`. Facet values feed `filters` as
`{facet id: value}`; the price range is approximate. Merchandised items are
flagged `is_pinned` and can make page 1 a few items longer than
`page_size`. `scheduled_prices` are the retailer's own planned price windows
and can change: not a forecast or price history. Prices differ per size and
color (some sizes on clearance, others not), so read the variant in
`get_dicks_product`; `get_dicks_products` is the cheap style-level check.
Product and reviews are slower than the other tools: usually 20-75 s, up to
about 2.5 minutes, and failed calls are not charged. Reviews are the newest
15 only: no paging, sort or star filter, and questions and answers are
counts only. There is no standalone store locator: store details come with a
SKU lookup, and an unknown SKU reads 0 at every store, so take SKUs from
`get_dicks_product`. No price history, ScoreCard prices or points, international
sites, account data or checkout: to track clearance prices, poll and store
your own.

### Foot Locker

| Tool | Description |
|------|-------------|
| `search_footlocker` | Search Foot Locker on any of 13 storefronts, 48 items per page: price, list price, percent off, `lowest_price_30d` (European storefronts), sale, new and launch flags, rating, review count and every colorway with its price; filter by brand, gender, color, price bucket, `on_sale` or any facet (shoe size per gender, style, sport...); 7 sorts; plus facets with counts, `data_as_of` and `redirected_to` |
| `get_footlocker_product` | One product by SKU or URL: description, style code, price block, availability online / to ship / for pickup, launch info, size chart, every colorway and every size with `available`, `ship`, `pickup`, `stores_available` (a store count, not units), UPC and store SKU |
| `get_footlocker_category` | Browse a category by its `/category/` path, URL or collection id, with the same filters and sorts as search |
| `get_footlocker_brand` | Browse one brand by name (any case) or brand page URL, optionally narrowed by a keyword |
| `get_footlocker_deals` | Sale (every storefront), Foot Locker Exclusives (us and ca) or the items a promo code applies to |
| `get_footlocker_releases` | The release calendar (us, ca, gb): launch date and time, retail price (us and ca), colorway, style code, heat level, size run and reservation windows where the storefront runs them; filter by upcoming / launched, a date window and brand |
| `get_footlocker_stores` | Foot Locker stores near a US ZIP, a city + state or a point (up to 50): address, phone, weekly hours, opening date, alert and closure notices |
| `get_footlocker_store_availability` | Which nearby Foot Locker stores show a product (or one size) as available: yes / no per store and per size, plus ship and pickup flags |
| `get_footlocker_reviews` | 1-98 reviews of one product (default 38) with full text, sort, star filter, secondary ratings, photos and the brand's response, plus rating stats and distribution |
| `get_footlocker_questions` | 1-50 shopper questions of one product (default 10) with every answer and its author type (brand, retailer or customer) |

Platform key `footlocker`. 1 credit per call. Storefronts (`country`): us
(footlocker.com, USD, default), ca (CAD, `language` en or fr), gb (GBP), de,
fr, it, es, nl, be (`language` nl or fr), at, ie (EUR), au (AUD) and nz (NZD);
titles come in the storefront's language. Search, product, category, brand
and deals (sale, discount_eligible) work on all 13; exclusives on us and ca;
releases on us, ca and gb (gb has no prices or reservation windows); stores,
store availability, reviews and questions are US only. Search, category,
brand and deals share one grid: 48 items per page, 7 sorts, facet values feed
`filters`. Listings can be a few hours old: `data_as_of` says when each one
was built. Availability is yes / no per size: Foot Locker publishes no unit
counts. The release calendar is monitoring data only: nothing here enters,
reserves or buys a release. Reviews and questions are slow: usually 25-90 s,
up to about 3-4 minutes, so allow a client timeout of at least 240 s; failed
calls are not charged. Unknown SKUs, categories and brands are a charged
404. No search suggestions, member (FLX) prices or account data, Kids Foot
Locker or Champs stores, price history or checkout: to track prices, poll and
store your own.

### Fanatics

Fanatics merchandise and product data (jerseys, hats, fan gear, collectibles), not sportsbook odds.

| Tool | Description |
|------|-------------|
| `search_fanatics` | Search Fanatics by keyword on 8 storefronts and 4 US league stores, up to 72 items per page: price, regular, sale, clearance and with-code price, price label, percent off, top seller, customizable, ready to ship, ship-by and delivery estimate; narrow by gender, league, department or any facet via `filters`; 4 sorts; plus facets with ids, `corrected_query`, `total` (9000 cap on the US site) and `data_as_of` |
| `get_fanatics_product` | One product by id or URL: league, team, player, the price block (regular / sale / clearance / with-code price), the site's current promo code, every size with `stock_level` (low / out, never a unit count), ship-by and delivery window, every colorway, personalization fields with the team roster, jersey assurance and authentic flags, and the rating with fit, value and quality |
| `browse_fanatics` | Browse a team, player, league section, department, brand or collection by URL or ids, with `price_band`, `on_sale`, `gender` and facet filters |
| `get_fanatics_deals` | Sale, clearance or under-25 listings, optionally for one league, team, department or brand |
| `get_fanatics_reviews` | 1-50 reviews of one product (default 10) with full text, 4 sorts, star filter, fit / quality / value, the site's own AI-written summary and the features reviewers mention; reviews cover the whole style, so each carries its `product_id` |

Platform key `fanatics`. 1 credit per call. Storefronts (`country`): us
(fanatics.com, USD, default), gb (GBP), de, fr, es, it (EUR), jp (JPY) and
ca (CAD, `language` en or fr); titles come in the storefront's language.
US league stores (`site`, with country us): fanatics (default), nflshop,
mlbshop, nhlshop and mlsstore; the same product ids work on every store.
Search, product, browse and deals work on every storefront and store;
`price_band` and the under-25 deals are not on jp; reviews are US only
(fanatics.com). Search, browse and deals share one grid: 24, 48 or 72 items
per page, sorted by top sellers, price or newest, facet values feed
`filters`. `data_as_of` says when Fanatics built each listing (it can be a
few minutes old). The with-code price is the price with the site-wide promo
code shown on the page; product prices already include personalization.
Reviews are slow: usually 20-90 s, up to about 4 minutes, so allow a client
timeout of at least 300 s; when busy they return 503 with Retry-After.
Failed calls are not charged; unknown products are a charged 404. No search
suggestions, store locator or store stock, Q&A, FanCash, member pricing,
unit counts, price history or checkout: to track jersey sale prices, poll
and store your own.

### [Academy Sports + Outdoors](https://scavio.dev/docs/academy-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Academy Sports + Outdoors API for academy.com (the US sporting goods retailer, stores in 21 states): keyword search, category and deal listings (Hot Deals, Clearance, Black Friday and its sub-shops, the Flash Sale) with price, was price, saving, cart-only pricing, promotions, rating, review count and Academy's deal badges, sorted and filtered by any facet and price; one product with every variant, its UPC, price and online units, and Academy's own notices and warnings as given; exact units of each variant at one store for pickup; stores near a ZIP code or point with hours and services; store details; the category navigation; and search suggestions. Academy has no public API. See the [Academy Sports + Outdoors API page](https://scavio.dev/academy-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_academy` | Keyword search, up to 29 organic results a page with sponsored placements apart, 6 sorts, any facet (brand, product type, color, deals, size) and a price range |
| `get_academy_product` | One product by slug or link with every variant: UPC, price, was price, saving, unit price text, availability, pickup and ship-to-store eligibility, online units; is_firearm and is_ammo flags and Academy's notices as given |
| `get_academy_store_availability` | Exact in-store units of every variant of one product at one store (part number, store id, state), plus ship-to-store units, the nearest store with stock and online status |
| `get_academy_stores` | Stores near a US ZIP code or a point, nearest first, 50 miles by default (up to 250), with hours by day, services and fulfilment flags |
| `get_academy_store` | 1 to 20 stores by id with the same fields, unknown ids in not_found |
| `get_academy_category` | One category by path or link, sorted and filtered like search |
| `get_academy_categories` | The category navigation as the site's header shows it: departments, groups and links |
| `get_academy_deals` | Hot Deals, Clearance, Black Friday (with sub-shops) or the Flash Sale, sorted and filtered like search, with the banner schedule as given |
| `get_academy_suggestions` | Search-box keyword completions, suggested products and, optionally, popular searches |

Platform key `academy`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Calls usually take 2 to 20 seconds: allow a client
timeout of at least 90 s.

US only, prices in USD and national (the same at every store). Captured
2026-11-26: a search for yeti tumbler gave 140 results over 5 pages, the first
The YETI DuraCoat Rambler 20 oz Tumbler at 19.97 to 40 USD (was 35, 43% off),
rated 4.7 from 29355 reviews, with 24 variants; at store 19 (Houston, TX) 14 of
its 24 variants were in stock with 51 units in all; the Coolers category listed
394 items over 14 pages; the Black Friday shop listed 1262 items with 9
sub-shops; 24 stores were within 25 miles of ZIP 77098. Firearms and ammunition
are returned exactly as Academy lists them, with its own flags and notices.
Review text is not available (rating and count only). Not available: review
text, price history (poll and store the answers), a weekly ad, per-item deal end
dates, checkout. Failed calls and refused inputs are not charged; a not-found
(an unknown product, part number, store or category) is charged.

### [REI](https://scavio.dev/docs/rei-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

REI API for rei.com (REI, the US outdoor co-op): keyword search, category listings and the Deals and REI Outlet listings with price, compare-at price, percent off, sale, clearance and outlet flags, REI's badges and dated promo text, colors and sizes with their SKU ids, sorted 9 ways and filtered by any facet or one store; one product with every SKU, specs, the review summary with fit ratings and customer questions with answers; reviews 10 a page with star filters; store pickup status of one SKU at the nearest stores (in stock, ship to store or unavailable); stores near a ZIP code with special hours; one store with services, rentals and departments; and search suggestions. REI has no public API. See the [REI API page](https://scavio.dev/rei-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_rei` | Keyword search, 30 or 90 a page, 9 sorts, any facet (brand, price, rating, deals, features, color, size) and one store |
| `get_rei_category` | One category by slug or link, sorted and filtered like search, with child categories and counts |
| `get_rei_deals` | Deals (everything on sale or clearance) or REI Outlet, optionally in one category |
| `get_rei_product` | One product by id or link: every SKU with price, compare-at, price type, savings, UPC and availability, specs, the review summary with fit ratings and questions with answers |
| `get_rei_reviews` | Reviews 10 a page, 5 sorts, a star filter, with fit, reviewer context bands, syndication source and brand responses |
| `get_rei_store_stock` | Pickup status of one SKU at the 4 to 10 stores nearest a ZIP code, city and state, or point: in stock, ship to store or unavailable, with estimated arrival |
| `get_rei_stores` | Stores near a US ZIP code or a point, up to 10 within 100 miles by default, with upcoming special hours |
| `get_rei_store` | One store by store number: services, rentals, departments, hours and closed dates |
| `get_rei_suggestions` | Search-term suggestions for a partial query |

Platform key `rei`. Credits: 2 per call on every tool; `credits_used` in the
response is what was charged. Calls usually take 3 to 20 seconds: allow a client
timeout of at least 90 s.

US only, prices in USD as shown to a visitor who is not signed in. Store stock
is REI's own pickup flags: REI publishes no unit counts. Captured 2026-11-26: a
search for rain jacket gave 285 results over 10 pages, the first the REI Co-op
Rainier Rain Jacket at 99.95 USD; the Tents category listed 522 items over 18
pages; REI Outlet listed 3654 items; the Half Dome 2 Tent with Footprint
(product 243702) was 329 USD with 3 SKUs and a review summary of 62 reviews
averaging 4.23; its SKU 2437020001 was in stock at 8 of the 9 stores nearest
ZIP 98101 and ship-to-store at the ninth; 8 stores were within 100 miles of ZIP
80202, with the Thanksgiving and #OptOutside closures listed. Reviews carry no
reviewer names or locations. Not available: unit counts, member prices (only
REI's member reward estimate), used gear (REI does not sell it online), price
history (poll and store the answers), checkout. Failed calls and refused inputs
are not charged; a not-found (an unknown product, category or store) is charged.

### [QVC + HSN](https://scavio.dev/docs/qvc-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

QVC + HSN API for QVC (qvc.com) and HSN (hsn.com), the video shopping networks of QVC Group: keyword search on QVC US, UK, Germany, Italy and Japan and on HSN, with the current price, QVC's everyday price, the special price code and window (Today's Special Value, Black Friday Sale), Easy Pay or FlexPay instalments, rating and stock flags; one product in full with every color and size; up to 20 QVC products in one call; today's special on QVC and HSN; what is on air now on each QVC channel; the TV program guide; the items HSN presented in one show hour; QVC category and collection grids; QVC search suggestions; and the first page of a product's reviews. See the [QVC + HSN API page](https://scavio.dev/qvc-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_qvc` | Keyword search: QVC 7 sorts, 1 to 96 a page and facet filters (us, uk, de); HSN 6 sorts, 60 a page and a department filter |
| `get_qvc_product` | One product by item number or link: price, QVC price, special price window, instalments, description, variants with stock flags (HSN: low-inventory units when shown) |
| `get_qvc_products` | Up to 20 QVC products in one call (us or it), in the order asked, with not_found |
| `get_qvc_todays_special` | QVC's Today's Special Value with its window, or HSN's Today's Special and the Today's Specials list |
| `get_qvc_on_air` | The item on air now on each QVC channel (QVC, QVC2, QVC3, QVC Home) with its price summary |
| `get_qvc_program_guide` | One day of the QVC guide (every channel or one, 4 US time zones) or the hourly HSN / HSN2 guide; no host or guest names |
| `get_qvc_recently_aired` | The items HSN presented in one show hour of HSN or HSN2 |
| `get_qvc_category` | One QVC category or collection grid, 96 a page, 7 sorts |
| `get_qvc_suggestions` | QVC search-box suggestions and suggested items (us, uk, de) |
| `get_qvc_reviews` | The first page of a product's reviews (QVC 8 newest, HSN 12 highest rated) with the rating summary and questions; no reviewer names |

Platform key `qvc`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Most calls take 2 to 20 seconds; `get_qvc_reviews`
takes 20 to 60 s: allow a client timeout of at least 120 s.

`site` is `qvc` (default) or `hsn`; `market` picks the QVC storefront: `us`
(qvc.com, USD), `uk` (qvcuk.com, GBP), `de` (qvc.de, EUR), `it` (qvc.it, EUR) or
`jp` (qvc.jp, JPY). HSN is US only. Search and product cover every QVC market and
HSN; the batch covers us and it; suggestions us, uk and de; today's special,
program guide and reviews QVC US and HSN; on air and category QVC US; recently
aired HSN. HSN categories are not offered yet (search with a department covers
HSN's departments). Reviews are the first page only, as the product page shows
it: no paging, sort or star filter. Stock is the site's flag; QVC publishes no
unit counts. Show names are kept as the guide lists them; on-air host and guest
names are not included. Captured 2026-11-27: blender on QVC US gave 102 results,
the first the Ninja Professional Plus Duo Blender with Auto IQ at 99.98 USD
against a QVC price of 159.99; ring on HSN gave 687 results; the GE Profile Opal
Mini Pro Nugget Ice Maker w/ Side Tank was 279.98 USD (QVC price 379) as a Today's
Special Value from 2026-11-23 to 2026-12-01; QVC's Today's Special Value was the
Diamonique Set of 5 Boxed Jewelry Gifts at 49.98 USD; the QVC Clearance Sale
collection held 8551 items; the Ninja blender showed its 8 newest of 918 written
reviews, 950 ratings averaging 4.67. Not available: review paging, HSN categories
and suggestions, unit counts, price history (poll and store the answers). Failed
calls and refused inputs are not charged; a not-found (an unknown item or link)
is charged.

### [Barnes & Noble](https://scavio.dev/docs/barnesandnoble-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Barnes & Noble API for Barnes & Noble (barnesandnoble.com, the US bookseller), US only, prices in USD: keyword search and collection pages with the site's sorts and filters (format, availability, price band, subject, age, language); one title by EAN or ISBN with publisher, pages, online stock flags, the member offer text as given, a short overview excerpt and one EAN per format; store pickup flags at the stores near a ZIP code, city or store number; stores near a place and one store's hours, holiday hours and services; search suggestions; the bestseller lists (Bestsellers, Bestselling Books, The New York Times Best Sellers, B&N Stores Bestsellers); the header navigation; and the deals pages. See the [Barnes & Noble API page](https://scavio.dev/barnesandnoble-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_barnesandnoble` | Keyword search (title, author, series, ISBN), 7 sorts and 6 filters: the 24 results the site shows with its own total and facets |
| `get_barnesandnoble_product` | One title by EAN / ISBN-13 or ISBN-10: price, original price, format, publisher, pages, online stock flags, rating, member offer text as given, a short overview excerpt (at most 300 characters) and one EAN per format |
| `get_barnesandnoble_store_availability` | Store pickup flags (eligible, available) for one title at the stores near a ZIP code, city or store number; no unit counts |
| `get_barnesandnoble_stores` | Stores near a ZIP code, a city and state or a point, with hours by day, holiday hours and services |
| `get_barnesandnoble_store` | One store by id, with its holiday hours line |
| `get_barnesandnoble_suggestions` | Search-box suggestions: up to 10 titles and subject topics with their collection path |
| `get_barnesandnoble_bestsellers` | A bestseller list: Bestsellers, Bestselling Books, The New York Times Best Sellers or B&N Stores Bestsellers |
| `get_barnesandnoble_category` | One collection by path or link, sorted and filtered like search (shelves for a page with no product list) |
| `get_barnesandnoble_categories` | The header navigation: departments, groups and links with the collection path each takes |
| `get_barnesandnoble_deals` | A deals page (Black Friday and Cyber Monday, Coupons & Deals, kids, eBooks, audiobooks) as its deal shelves |

Platform key `barnesandnoble`. Credits: 1 per call on every tool; `credits_used`
in the response is what was charged. Collection, bestseller, deal and navigation
pages take 8 to 35 seconds: allow a client timeout of at least 90 s.

US only, prices in USD. Search and collection pages give the 24 results the site
shows with its own total, and no page 2: narrow with sort and filters. price is
what Barnes & Noble charges a visitor now; member prices are not shown to visitors
and are not returned (member_offers carries the offer text only). overview is a
short excerpt of the publisher's copy, never book text. Store availability is the
site's own pickup flags, not unit counts; prices are national. Captured
2026-11-27: project hail mary gave 3101 results, the first the Deluxe Edition at
37 USD (on sale from 40); Project Hail Mary in hardcover was 32 USD, rated 4.6
from 287 ratings, with 6 formats; EAN 9780439023528 was available for pickup at
28 of 28 stores near ZIP 60611; ZIP 10001 had 44 stores nearby; the Black Friday
and Cyber Monday page held 21 shelves with 165 titles. Not available: review
text, member prices, unit counts, deeper result pages, price history (poll and
store the answers). Failed calls and refused inputs are not charged; a not-found
(an unknown EAN, collection or store) is charged.

### [Belk](https://scavio.dev/docs/belk-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Belk API for Belk (belk.com, the US Southern department store), US only, prices in USD: keyword search, category listings and deal listings (Doorbusters, Super Buys, Clearance, Sale Items, Today's Offers), 60 items a page in Belk's 7 sorts, filtered by brand, colour, size, sales promotion, coupon code, discount band, price range, free-pickup store and any facet; one product in full with every colour, size and variant and its online stock; one variant with its UPC, price type and Belk's sale end date, and optionally the price of every colour at that size; exact store stock for up to 5 variants at up to 10 stores; stores near a ZIP code and one store with this week's hours and pickup location; the department menu; and a product's 8 newest reviews. Prices are as belk.com shows them to visitors who are not signed in, Belk Rewards+ tier prices and coupons with Belk's own after-code price labeled as Belk gives them. See the [Belk API page](https://scavio.dev/belk-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_belk` | Keyword search: 60 items a page (pages 1 to 200), 7 sorts, brand, colour, size, sales promotion, coupon code, discount band, price range, pickup store and facet filters |
| `get_belk_category` | One category's products by path or link, sorted and filtered like search |
| `get_belk_deals` | Doorbusters, Super Buys, Clearance, Sale Items or Today's Offers, across Belk or inside one category |
| `get_belk_categories` | The department menu: 15 departments with their category tree and the path each takes |
| `get_belk_product` | One product by id or link: prices, price label, tier prices, coupons, promotions, rating, details, colours, sizes and every variant with its online units |
| `get_belk_variant` | One variant: UPC, orin, price type, original and sale price, sale end date, pickup and ship flags, coupons; optionally every colour's price at that size |
| `get_belk_store_availability` | Exact store units and status (in stock, limited, out of stock) for 1 to 5 variants at 1 to 10 stores |
| `get_belk_stores` | Every Belk store within about 150 miles of a US ZIP code, with regular and this week's hours |
| `get_belk_store` | One store by id: address, phone, coordinates, this week's hours and pickup location |
| `get_belk_reviews` | A product's 8 newest reviews with the review count (no reviewer names) |

Platform key `belk`. Credits: billed on actual cost, `credits_used` in the response is
what was charged: 2 per call; `get_belk_product` 2 for Belk's canonical product link and
4 when Belk redirects to it (an older link or a product id alone); `get_belk_variant` 4
with `include_color_prices`; `get_belk_store_availability` 1 per call when every orin is
given (from `get_belk_variant`), plus 2 per variant whose orin is looked up (3 for one
variant, up to 11 for five). Most calls take 2 to 15 seconds: allow a client timeout of
at least 90 s.

US only, prices in USD and national: the same in every store. Search, category and deal
listings show 60 items a page; Belk shows totals over 10,000 as "10,000+"
(`total_is_lower_bound`). Coupons carry Belk's own price with the code and end date as
Belk writes them, never computed. Store stock is Belk's exact unit count per store, with
1 to 5 units as limited; a wrong orin answers 0 at every store, so it is never guessed.
Reviews are the 8 newest only: no paging, sort or star filter. Captured 2026-11-27:
sweater gave 7193 results, the first the Vince Camuto Women's Dolman Sleeve Crew Neck
Sweater at 29.99 USD (original 69), a Doorbuster with 29 colours, 7 sizes and 147
variants; its size M variant was on sale until 2026-11-28; Women's Sweaters held 2334
items; Doorbusters across Belk showed 10,000+ items; ZIP 28202 listed 79 stores, the
nearest at 5.2 miles; one variant showed 2, 3 and 4 units at 3 stores; the menu held 15
departments and 728 nodes. Not available: review paging, Belk's weekly ad and coupon
pages, search suggestions, price history (poll and store the answers). Failed calls and
refused inputs are not charged; a not-found (an unknown product, variant, category or
store) is charged what it spent.

### [Abercrombie & Fitch](https://scavio.dev/docs/abercrombie-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Abercrombie & Fitch API for Abercrombie & Fitch Co. (abercrombie.com: Abercrombie & Fitch, abercrombie kids, YPB; hollisterco.com: Hollister, Gilly Hicks), chosen with `brand`, on 16 storefronts (US, Canada, UK, Europe in six languages, Hong Kong, Japan and worldwide): keyword search and category listings with the site's sorts and facet filters, the price and the member price the site shows to every visitor with its own label; one product with every color and every size SKU and the exact units shown online; exact store units per SKU at the stores near a US ZIP code or a point; stores near a place and one store's dated hours; each storefront's category tree; the banner offers with their terms; the 8 newest reviews of a product with the rating summary and fit; and search suggestions. See the [Abercrombie & Fitch API page](https://scavio.dev/abercrombie-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_abercrombie` | Keyword search, 48 a page, 6 sorts and facet filters, with total, total pages, sort options and facets |
| `get_abercrombie_product` | One product by product id: every color with every size (and length) SKU, online units, price, member price, fabric, care, measurements and the rating summary with fit |
| `get_abercrombie_store_stock` | Exact units per SKU (1 to 10 SKUs) at the stores near a US ZIP code or a point, with status available, backorderable or unavailable |
| `get_abercrombie_stores` | Stores near a US ZIP code or a point (up to 25), with address, phone, distance and this week's hours |
| `get_abercrombie_store` | One store by store number, with hours dated for the next 7 days |
| `get_abercrombie_category` | One category's products, 1 to 90 a page, 6 sorts and facet filters, with the site's social proof message |
| `get_abercrombie_categories` | One storefront's category tree: departments, categories (regular, clearance, featured) and sub-categories |
| `get_abercrombie_promotions` | The banner offers one storefront shows now, with their terms and dates as given |
| `get_abercrombie_reviews` | The 8 newest reviews of a product (us, ca, uk, eu, eu_de) with the rating summary, recommendations and fit; no reviewer names |
| `get_abercrombie_suggestions` | Search-box suggestions for a few letters |

Platform key `abercrombie`. Credits: 1 per call, `get_abercrombie_reviews` 2 when
called without the product `url` (one extra lookup); `credits_used` in the response
is what was charged. Most calls take 2 to 10 seconds; `get_abercrombie_reviews`
takes 15 to 60 s: allow a client timeout of at least 120 s.

`brand` is `anf` (default) or `hol`; `storefront` is `us` (default), `us_es`, `ca`,
`ca_fr`, `uk`, `eu`, `eu_de`, `eu_fr`, `eu_es`, `eu_it`, `eu_nl`, `am` (Hong Kong),
`am_zh`, `am_ja` (Japan), `wd` or `wd_es` (worldwide); `country` picks the ship-to
country on the eu and wd storefronts. On wd and wd_es prices are the site's own
conversion from USD into the ship-to country's currency, with `usd_price` alongside.
Stores cover the US (by ZIP code or point) and CA, GB, the European countries, JP,
HK, MO, CN and AE (by point). Prices are national, not per store. Mexico, Saudi
Arabia, Qatar, Indonesia and Taiwan are served by franchise partners' own sites and
are not offered; the eu storefronts price in EUR only. Captured 2026-11-27: baggy
jeans on the US Abercrombie & Fitch storefront gave 1219 results, the first the Baggy
Jean at 90 USD with a 67.50 USD member price labeled Black Friday Price, in 15 colors
and 480 SKUs, rated 4.8 from 3822 reviews; two of its SKUs near ZIP 10001 were in
stock at 10 stores, the nearest with 4 and 3 units; hoodie on Hollister worldwide
shipped to Australia gave 559 results in AUD; ZIP 43215 had 3 Hollister stores within
50 miles; the US storefront's Black Friday offer ran 2026-11-23 to 2026-11-30. Not
available: UPCs, deeper review pages or review sorts, store prices, price history
(poll and store the answers). Failed calls and refused inputs are not charged; a
not-found (an unknown product, category or store) is charged.

### [L.L.Bean](https://scavio.dev/docs/llbean-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

L.L.Bean API for L.L.Bean (llbean.com, the US outdoor apparel and gear retailer), on the US storefront (USD), the Canadian storefront llbean.ca (CAD) and the international storefront global.llbean.com for 12 countries in each country's own currency: keyword search, category and Sale lists, 48 a page, sorted and filtered by any facet; one product in full with every SKU's price, sale price and stock state (US) or the variant's price and offer text (Canada and international); exact store units per SKU at up to 20 US stores or every store; US stores near a ZIP code, a point or a city with 7 dated days of hours; written reviews with fit data, reviewer height and weight bands and rating statistics; L.L.Bean's own review summary; the standard delivery date to a US ZIP code; the department menu; and search suggestions. See the [L.L.Bean API page](https://scavio.dev/llbean-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_llbean` | Keyword search on us, ca or intl: 6 sorts, 48 a page, facet filters; a keyword the site sends to a category comes back with redirected_to and the sort, page and filters applied |
| `get_llbean_category` | One category by id on us, ca or intl, sorted and filtered like search |
| `get_llbean_categories` | The US department menu (11 departments, about 570 nodes), or one department with its children |
| `get_llbean_product` | One product: on us items, colors and every SKU with price, full price, sale price, stock flag and status as given; on ca and intl the variant's price, was price, availability and offer text |
| `get_llbean_store_stock` | Exact units per SKU at up to 20 US stores or every store, labeled with color, size and price when product_id is sent |
| `get_llbean_stores` | US stores near a ZIP code, a point or a city and state, by id or all, with type, pickup services and 7 dated days of hours |
| `get_llbean_reviews` | Written reviews in 4 sorts, up to 100 a page, filtered by stars, height or weight band or words, with fit data, rating statistics and UPCs per item; no reviewer names |
| `get_llbean_review_summary` | L.L.Bean's own summary of a product's reviews, as given |
| `get_llbean_delivery_estimate` | The standard delivery date of one item to a US ZIP code, as given |
| `get_llbean_suggestions` | Search-box suggestions on us or ca |
| `get_llbean_deals` | The Sale category on us, ca or intl, sorted and filtered like search; on us also by % Off (20 to 70 and up) |

Platform key `llbean`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Most calls take 2 to 15 seconds: allow a client
timeout of at least 120 s.

`market` is `us` (default), `ca` (CAD, English) or `intl` with a `country`: gb
(GBP), de, fr, nl (EUR), au (AUD), mx (MXN), ch (CHF), se (SEK), cn (CNY), br
(BRL), in (INR) or sg (SGD). Search, category, product and deals cover every
market; suggestions us and ca; store stock, stores, reviews, review summary,
delivery estimate and the department menu the US storefront. Prices are as
L.L.Bean shows them to a visitor who is not signed in: member and card prices
(L.L.Bean Rewards, L.L.Bean Mastercard) are never returned. Prices are national,
the same in every store and online. Store stock is the site's exact available
quantity per SKU per store. Reviews carry no reviewer names, nicknames or
locations. Captured 2026-11-27: fleece jacket gave 24 results on us, the first
Kids' Mountain Classic Fleece Anorak at 59.95 USD, and 73 on ca and intl gb, the
first Men's Fleece-Lined Flannel Shirt at 159 CAD and 110 GBP; the Boat and Tote,
Zip-Top was rated 4.8 from 9735 reviews with 97 SKUs from 34.99 to 69.95 USD; its
Medium item held 506 units at store 0040; ZIP 04032 gave 5 stores, the nearest at
0.13 miles; the Men's L.L.Bean Sweater Fleece Full-Zip Jacket had 1400 written
reviews (4402 ratings, average 4.67) and was 145 EUR on the international
storefront for Germany; Sale at 40% and up held 204 products. Not available: unit
counts, store stock, reviews and delivery dates on the Canadian and international
storefronts, end dates for sale items, price history (poll and store the answers).
Failed calls and refused inputs are not charged; a not-found (an unknown product,
item or category) is charged.

### [Sweetwater](https://scavio.dev/docs/sweetwater-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Sweetwater API for Sweetwater (sweetwater.com, the US online music instrument and pro audio retailer), US only, prices in USD: keyword search with the price now, retail price, rebates, special offers and units on hand, available and on order; category listings, 42 a page with the site's 7 sorts and facet filters; one product in full with was price, price drop, stock text, backorder date, shipping weight, dimensions and specs; the serial-numbered units of a guitar or bass with each unit's serial number, shipping weight and photos; customer reviews filtered by stars, sorted and paged; and the Deal Zone with its sale window and deal pages. See the [Sweetwater API page](https://scavio.dev/sweetwater-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_sweetwater` | Keyword search: 42 results in Sweetwater's relevance order with price, rebates and units on hand / available / on order; a keyword that opens a category answers that category's listing with sort and page applied |
| `get_sweetwater_category` | One category by id, path or link: 42 products a page, 7 sorts, facet filters and the facets to send back |
| `get_sweetwater_product` | One product by item id or link: price, was price, price drop, availability and stock text, backorder date, warehouse flags, shipping weight, return days, rating, dimensions and specs (open-box units by their own id) |
| `get_sweetwater_serial_units` | The serial-numbered units of one item: serial number, shipping weight, link and photos per unit, plus the Demo unit when there is one |
| `get_sweetwater_reviews` | Customer reviews filtered by stars, sorted newest, oldest, highest or lowest, up to 100 a page, with the star breakdown; no reviewer names |
| `get_sweetwater_deals` | The Deal Zone or one deal page, 42 a page with its 9 sorts: the sale window as given and the list of deal pages |

Platform key `sweetwater`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Most calls take 2 to 15 seconds: allow a client
timeout of at least 120 s.

US only, prices in USD. Free-text search shows 42 results in Sweetwater's
relevance order on one page (the site does not page or sort them); when the
keyword opens a category, sort and pages of 42 apply. Listings count at most
5,000 products (120 pages). Serial units are the instruments Sweetwater lists one
by one; an item sold without serial numbers has none. Captured 2026-11-27: boss
delay pedal gave 20 results, the first the Boss DD-8 Digital Delay Pedal at 168.88
USD (was 197.99) with 204 units available, rated 5 from 39 reviews; the Solidbody
Guitars category counted 5,000 products, from 149 USD sorted by price; the Fender
American Ultra II Stratocaster HSS in Ultraburst at 2359.99 USD listed 6 serial
units and a Demo unit at 1919.99; the Shure SM58 averaged 4.7 from 372 reviews;
the guitar deals page held 8,493 items under the Black Friday event to 2026-11-30.
Not available: Gear Exchange (used gear listings), store or warehouse unit counts
by location, price history (poll and store the answers). Failed calls and refused
inputs are not charged; a not-found (an unknown item, category or deal page) is
charged.

### [Argos](https://scavio.dev/docs/argos-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Argos API for Argos store stock, prices and reviews (argos.co.uk, UK, GBP): which Argos stores near a UK postcode can hand over one or more products (collect now, today, tomorrow, out of stock) and whether they can be delivered to a postcode, next to price, was price, offers and badges, plus search, categories, deal collections, product detail, reviews, Q&A and stores.

| Tool | Description |
|------|-------------|
| `search_argos` | Search Argos, 24 per page up to page 200: price, was price, save, offer text, badges, rating, seller (Argos or Trusted Seller); brand, seller, offers, colour, price, rating and facet filters; 4 sorts |
| `get_argos_product` | One product by id or link: EAN, badges with start / end dates, specs, variants, special offers, Nectar points, care plans, payment options, bundles, rating distribution, Q&A counts and the first 10 reviews; Trusted Seller items with the fields their page shows |
| `get_argos_store_stock` | 1 to 10 products at the Argos stores near a UK postcode (up to 10 stores, 50 miles): a collection state and time per store, plus delivery to a postcode (same day, next day, within N days) |
| `get_argos_stores` | Stores near a UK postcode, or one store by reference with opening hours, special hours and services |
| `get_argos_reviews` | One product's reviews, up to 100 per page, 5 sorts and a star filter, syndicated reviews flagged with their source, Argos's own AI review summary |
| `get_argos_questions` | One product's customer questions with answers (staff, brand or customer), up to 50 per page |
| `get_argos_categories` | Argos's department tree (14 departments) with category ids |
| `get_argos_category` | One category's products by category id, with the search filters and sorts |
| `get_argos_deals` | Deal collections: black_friday, clearance, special_offers (full lists), or top_100 (Argos's Top 100, 2 pages of 60) |
| `get_argos_suggestions` | Search suggestions for a partial query, with Argos's popularity weight |

Platform key `argos`. 2 credits per call on every tool. One store:
argos.co.uk, prices in GBP, no `country` input (Argos Ireland closed in 2023).

Store stock is availability, not unit counts: each store answers a
collection state per product (`collect_now`, `collect_today`,
`collect_tomorrow`, `collect_later`, `out_of_stock`, `not_available`) with
`available_from` and the site's message, and `delivery` answers `same_day`
(Fast Track), `next_day`, `later` (Argos's "Delivery within N days", with
`days`), `out_of_stock` or `not_available`; quote delivery from `state` and
`message`. `postcode` is where stores are searched; `delivery_postcode` (default
`postcode`) is where delivery is checked. Store types: `argos_store` (a
standalone Argos store), `inside_sainsburys` (an Argos counter inside a
Sainsbury's store), `collection_point` (a collect-only point, no shop).
Trusted Seller items are never stocked in stores (400).

Prices are numbers in GBP as Argos shows them: `price`, `was_price` (the
site's was price), `save` (computed by Scavio as `was_price - price`),
`offer_text` (the site's own words, e.g. Half Price) and `badges` as given
(e.g. `Black_Friday`, `price_guarantee`). `seller` is `argos` or
`trusted_seller` (Argos's marketplace; the page names no seller, so
`seller_name` is null there). Search, category and deals return 24 per page
(`total_pages` says how deep the list goes; Argos stops counting at 10,000,
flagged by `total_capped`); Tu Clothing items are left out
and counted in `tu_clothing_excluded`. Reviews: `newest` (default), `oldest`,
`most_helpful`, `highest_rating`, `lowest_rating`, `rating` star filter, up to
100 per page with every review reachable; reviewer names, locations, ages and
genders are never returned. Not available: unit counts, price history (poll
and store the answers), a brand directory (brand is a filter), Argos Ireland,
card or checkout prices, Argos Pay terms. Failed calls are not charged; a
not-found is charged.

### [Media Expert](https://scavio.dev/docs/mediaexpert-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Media Expert API for Media Expert Black Week prices and store stock (mediaexpert.pl, Poland, PLN): for any product the price, the old price, the EU Omnibus lowest price of the last 30 days and the code price with its code and dates, plus the stock indicator at the stores nearest a Polish city or postcode, search, categories, brands, promotions, outlet, marketplace sellers, reviews and stores.

| Tool | Description |
|------|-------------|
| `search_mediaexpert` | Search Media Expert, 30 per page (up to 50) up to page 100: price, old price, `omnibus_lowest_30d`, `code_price`, discount, rating, marketplace seller; 10 sorts; `redirected_to` when Media Expert answers a term with a category page |
| `get_mediaexpert_product` | One product by id or link: EANs, description, key attributes, specifications, variants, delivery and pickup labels, the product page's one-hour pickup label (per-store one-hour pickup comes from `get_mediaexpert_store_stock`), installments, seller with rating, rating summary, breadcrumbs, related products |
| `get_mediaexpert_store_stock` | One product's stock indicator at the up to 40 Media Expert stores nearest a Polish city, town or postcode: `stock_level`, `in_stock`, `collect_in_1h`, the in-store pickup day, distance and hours |
| `get_mediaexpert_stores` | Every Media Expert store (about 640), one city's stores, or one store's page with phone, events and alerts |
| `get_mediaexpert_reviews` | One product's reviews by sku, id or link, up to 100 per page, 6 sorts, star range and verified-purchase filters; verified purchase and promotional-campaign flags |
| `get_mediaexpert_category` | One category's products by path, with facet filters, sorts and paging |
| `get_mediaexpert_categories` | The category tree (24 departments, about 5,000 categories) or one subtree, with product counts |
| `get_mediaexpert_brands` | The brand directory (about 16,000 brands), by name or first letter |
| `get_mediaexpert_brand` | One brand's products, optionally inside a category, with filters, sorts and paging |
| `get_mediaexpert_promotions` | Promotion lists (Black Weeks included) or one list's products |
| `get_mediaexpert_outlet` | The outlet's groups, subgroups or products (ex-display, returned and end-of-line items) |
| `get_mediaexpert_seller` | A marketplace seller's profile, rating, categories and offers |
| `get_mediaexpert_suggestions` | Search suggestions for a partial query, with Media Expert's search counts |

Platform key `mediaexpert`. Billed on actual cost, 1 to 3 credits per call,
and `credits_used` reports each one: product, stores, brands, outlet groups,
promotion lists, reviews and suggestions cost 1; store stock and categories
cost 2; search costs 3 (Media Expert loads search lists lazily, so the rest of
the page takes one more lookup) or 1 when Media Expert answers the term with a
full category page; category, brand, promotion-list, outlet and seller product
lists cost 1 unsorted and 3 with a sort or a lazily loaded list. One store:
mediaexpert.pl, prices in PLN, no `country` input. Names, specifications,
labels and reviews come back in Polish, as Media Expert writes them.

Prices are numbers in PLN: `price`, `old_price` (Media Expert's struck-through
price), `omnibus_lowest_30d` (the lowest price of the last 30 days that Media
Expert shows next to a promotion, under the EU Omnibus Directive),
`code_price {price, code, valid_from, valid_to}` (the price with a discount
code), `discount_shown` (Media Expert's own figure) and `discount_percent`
(computed by Scavio). Store stock is Media Expert's stock indicator, a bucket
(seen: 0, 2, 9, 20), not a unit count, with `collect_in_1h` (Odbierz za
godzinę) and `order_to_store_day` when the item is not on the shelf. Send
`product_id`, not `offer_id`; marketplace items (sold and shipped by a
marketplace seller) are never stocked in stores (a charged 400). Lists stop
counting at 5,000 (`total_capped`); price sorts are Media Expert's own order,
which follows promotional and code prices, so re-sort a page for a strict
order. There is no price filter. Reviews carry `verified_purchase` and
`incentivized` (a review from a Media Expert promotional campaign); no
reviewer identity is returned. Not available: Q&A (Media Expert has none),
leaflets, price history (poll and store the answers), unit counts, checkout
prices, other countries or languages. Failed calls are not charged; a
not-found is charged.

### [Action](https://scavio.dev/docs/action-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Action API for Action (action.com), the European non-food discount store: this week's Action deals with their validity dates and week id, the same article's price on each of the 19 Action storefronts (one article number everywhere, priced per market), and the stores near a city or postcode with opening hours; plus search, products, categories, own brands, new arrivals, seasonal collections, suggestions, reviews and the shop.action.com webshop.

| Tool | Description |
|------|-------------|
| `search_action` | Search Action, 24 products a page with total and total_pages: price, `regular_price`, unit price, deal with validity dates, labels, rating; sorts relevance, price_asc, price_desc, newest; filters `category_filter`, `price_range`, `brand_filter`, `new_only` from the facets |
| `get_action_product` | One article in full on one market by article number or link: images, brand, long description, highlights, specifications, aisle, category, sustainability, hazards, related products |
| `get_action_products` | Up to 60 article numbers priced on one market in one call; codes the market does not sell come back in `not_sold` |
| `get_action_weekly_deals` | This week's deals on one market: `week_id` (e.g. Promo2026Week47), `valid_from` / `valid_to` (Wednesday to Tuesday), the regular price; Belgium adds Action Plus `loyalty_deals` |
| `get_action_category` | One category's products by path, with filters, sorts and paging |
| `get_action_categories` | The category tree on one market (15 departments, about 300 categories in 3 levels) |
| `get_action_brand` | One brand's products, with filters, sorts and paging |
| `get_action_brands` | Action's own brands (about 54 private labels, e.g. Max & More) |
| `get_action_new_arrivals` | New products on one market (about 200) |
| `get_action_collection` | One seasonal moment page (black-friday, kerst, sinterklaas, basics) |
| `get_action_suggestions` | Search suggestions, a category suggestion and up to 5 products for a partial query |
| `get_action_stores` | The 20 stores nearest a city, postcode or lat / lng (may cross borders: `country_code` per store), with address and 7 dated days of opening hours |
| `get_action_store` | One store by reference, link, slug or `store_id`: address, coordinates, 7 dated days of opening hours |
| `get_action_reviews` | One article's reviews on nl, de, fr or pl, up to 100 per call: scope `local` (that storefront's language), `international` or `all`; 5 sorts, star and text filters; no reviewer identity |
| `search_action_webshop` | Search the Action webshop (shop.action.com, nl-nl, nl-be, fr-be) or one webshop category: EAN, article number, online `stock_level`, `order_limit`, `shipping_cost` |
| `get_action_webshop_product` | One webshop product by EAN or link: online stock, order limits, shipping cost, release and end dates, supplier, the other webshop markets |

Platform key `action`. 1 credit per call on every tool (`get_action_store` by
`store_id` and `get_action_reviews` with scope `all` read two sources, still 1
credit). Markets: `country` nl (default), be, fr, lu, de, at, ch, it, es, pt,
pl, cz, sk, ro, hr, si, plus `language` for be (nl or fr) and ch (de, fr or
it). Prices are numbers in the market's currency (EUR; CHF, PLN, CZK, RON),
never converted, and titles and labels come back in the storefront's
language, as Action writes them (Dutch on the default nl storefront). Article
numbers are the same in every market and prices are set per market: price one
article on each market you report with one `get_action_products` call per
country.

Weekly deals run Wednesday to Tuesday with Action's validity label, ISO
`valid_from` / `valid_to` dates and the week id; the assortment changes every
week. Action does not publish store stock: the stores tools give the nearest
stores and their hours, no stock, and the webshop's `stock_level` is online
stock, not store stock. EANs come only from the webshop tools. Reviews exist on
nl, de, fr and pl only (other countries answer 400, not charged). Not
available: store stock, price history (poll and store the answers), leaflets,
checkout, other countries. Failed calls and refused inputs are not charged; a
not-found (an article the market does not sell, an unknown slug or EAN) is
charged.

### [HEMA](https://scavio.dev/docs/hema-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

HEMA API for HEMA (hema.com, the Dutch variety store): HEMA store stock, the sellable units HEMA's store service reports per store for up to 12 articles near a city or postcode, with the stock level (full, regular or limited), in the Netherlands, Belgium, France, Germany, Luxembourg and Austria; each article's dated price schedule with upcoming promotions as HEMA writes them (e.g. 2+1 gratis); the same article number priced per market; plus search, categories, new arrivals, sale, weekly offers, Christmas and Sinterklaas campaigns, suggestions, stores and HEMA's own product reviews.

| Tool | Description |
|------|-------------|
| `search_hema` | Search HEMA, 24 products a page with total and total_pages: price, `was_price`, `price_from`, `discount_percent` (computed by Scavio), `promotion`, online stock flags; sorts relevance, price_asc, price_desc, newest, best_selling; `filters` from the facets, `new_only`, `price_min`, `price_max`; `redirected_to` when HEMA sends a word to a landing page |
| `get_hema_product` | One article in full on one market by article number or link: EAN, colour / size variants with stock flags, `price_schedule` (dated prices, upcoming promotions included), `unit_price`, `online_stock`, `sellable_in_store`, `order_limit`, specifications |
| `get_hema_category` | One category's products by path, with filters, sorts and paging |
| `get_hema_categories` | The category menu on one market (13 to 18 departments, 3 levels) |
| `get_hema_new_arrivals` | HEMA's new collection on one market (about 550 to 1,100 products) |
| `get_hema_sale` | The sale page (nl) or outlet page (be, de); France has none |
| `get_hema_offers` | The weekly offers page (nl, be): HEMA's validity label as shown, the ISO `valid_to`, the offer week and the promotion cards with their product-list paths (no products on that page) |
| `get_hema_campaign` | A campaign page with its products and promotion texts: `christmas` (all markets), `sinterklaas` (nl, be) or a campaign slug |
| `get_hema_suggestions` | Search suggestions, categories and up to 5 products for a partial query |
| `get_hema_store_stock` | Up to 12 articles in the stores near a city, postcode or point (or across a country): per store `sellable_units`, `stock_level`, shelf locations, address, hours and distance; NL, BE, FR, DE, LU, AT |
| `get_hema_stores` | Every store of one country (about 570 nl, 111 be, 69 fr, 17 de, 5 at, 4 lu) or the ones near a place, with hours, special hours and services |
| `get_hema_store` | One store by id: address, hours, services, status, and one article's stock with `sku` |
| `get_hema_reviews` | One article's HEMA reviews, pages 1 to 5 (8, then 30 more a page), sorts newest or highest, star ratings vs text reviews; nl, fr and de read the Dutch pool, be its own; no reviewer identity |

Platform key `hema`. 1 credit per call on every tool. Markets: `country` nl
(default, www.hema.nl), be (plus `language` nl or fr), fr, de; lu and at only
on `get_hema_stores`, `get_hema_store` and `get_hema_store_stock` (elsewhere a
400, not charged). All prices are numbers in EUR; names, labels and promotion
texts come back in the market's language, as HEMA writes them (Dutch on the
default nl market). Article numbers are the same in every market and prices
are set per market: call once per country to compare one article. HEMA notes
that online prices can differ from store prices.

Store stock is the sellable units HEMA's store service reports per store and
its stock level, not a promise that the shelf has it. Promotions come as HEMA
writes them (2+1 gratis, 2+2 gratis) with their dated validity;
`discount_percent` is computed by Scavio from the was price. HEMA sells its
own brand: there is no brands tool. Not available: price history (poll and
store the answers), checkout or ordering, the photo service and cake ordering,
other countries (no UK or Spain). Failed calls and refused inputs are not
charged; a not-found (an article number HEMA does not have, an unknown store
id, a place the store finder cannot find) is charged.

### Carrefour

Carrefour grocery prices by store, promotions, Nutri-Score and stores (carrefour.fr, plus Argentina, Romania and Belgium for search and product).

| Tool | Description |
|------|-------------|
| `search_carrefour` | Search Carrefour by keyword, 30 items per page on carrefour.fr: price, unit price (per kg / L), promotion with `loyalty_only` and start / end dates, Nutri-Score, Eco-Score, rating, availability and marketplace seller; filter by brand, promotion, Nutri-Score, organic, Carrefour brands or price range; 6 sorts (price, unit price, top rated); `store` for one store's shelf prices; also Argentina, Romania and Belgium |
| `get_carrefour_product` | One product by EAN or URL: description, breadcrumb, ingredients, allergens, nutrition per 100 g and per portion, Nutri-Score, Eco-Score, the price block with unit price and promotion, marketplace seller and offers, and the rating distribution |
| `get_carrefour_reviews` | 1-50 verified-purchase reviews of one product (default 10), 4 sorts, star filter, offset paging; author as published (first name and last initial) |
| `get_carrefour_category` | A category (aisle) grid by URL or path (`/r/cremerie`), with the search filters, sorts and `store` |
| `get_carrefour_promotions` | Items on promotion: all, catalogue, immediate discounts, loyalty-card offers or the site's festive selection, optionally for one aisle |
| `get_carrefour_suggestions` | Search box suggestions and category suggestions for a partial query |
| `find_carrefour_stores` | Stores near a French postal code or a point (up to 20 per page), optionally with one service (drive, fuel station...): `store_ref` and `pickup_refs` for `store`, address, distance, today's hours, slug |
| `get_carrefour_store_availability` | Whether the stores around a postal code carry one product (EAN): yes / no per store, no price |
| `get_carrefour_store` | One store by slug or URL: services, weekly hours, drive hours, next pickup slots as shown, nearby stores and fuel prices per litre with update times at stores with a fuel station |

Platform key `carrefour`. 1 credit per call; search and product on Belgium
cost 2. Markets (`country`): fr (carrefour.fr, EUR, default, every tool), ar
(Argentina, ARS), ro (Romania, RON) and be (Belgium, EUR, `language` fr or
nl); ar, ro and be serve search and product only. Data comes back in the
market's language: French titles, labels and ingredients on fr. Without
`store` a price is carrefour.fr's national online price; pass a store ref from
`find_carrefour_stores` or `get_carrefour_store_availability` for that store's
shelf price and assortment (Nutella 400 g: 3.99 national, 3.69 at two stores,
4.61 at another). On multi-buy promotions ("Le 2ème à -50%") the prices
cover `quantity` items and `discounted_price` is null when the site does not
price the deal. Failed calls are not charged; a not-found (unknown product, store or
category) is a charged 404. No Q&A, printed leaflet, delivery-slot booking,
cart, loyalty account data or price history: to track prices, poll and store
your own. Spain, Italy, Poland, Brazil and the Middle East sites are not covered.

### Allegro

Allegro marketplace offers, every seller's price for one product, sellers, sold counts and auctions (allegro.pl, plus allegro.cz, allegro.sk and allegro.hu).

| Tool | Description |
|------|-------------|
| `search_allegro` | Search Allegro by keyword, 60 organic offers per page: price, price with delivery, condition, auction state, discount with `lowest_price_30d`, seller (super seller, positive feedback %, business or private), rating, `sold_count`, Allegro Smart!, sponsored / promoted `placement`; 8 sorts; filter by price, new / used, buy now / auction (pl), Smart! and deals (pl), optionally inside one category; exact `total` and every facet |
| `get_allegro_offer` | One offer (one seller's listing) by number or URL: price, original price and `lowest_price_30d` on a discount, price with delivery, stock, sold count, auction state (current price, minimum next bid, ends at, has bids), every parameter with GTIN and brand, description, delivery methods, returns, warranty, and the seller with `company_name` for business sellers |
| `get_allegro_product` | One catalogue product (groups many sellers' offers) by id or URL: brand, GTIN, parameters, `lowest_price` and `offer_count`, the featured (buy box) offer, sold count, rating with star distribution, review aspects and the first 20 reviews as shown on the page |
| `get_allegro_product_offers` | Every seller's offer for one product, 60 per page: price, price with delivery, condition, seller, Smart!, `is_featured` (buy box); sortable by price or price with delivery, filterable by condition, price and Smart! |
| `get_allegro_seller` | One seller's offers by login, with id, login, `is_business`, the categories the seller sells in (with a `slug` for `category`), search within the seller's offers and the search sorts and filters |
| `get_allegro_seller_feedback` | One seller's buyer ratings, 20 per page, newest first: summary (positive %, recommended / not recommended counts, member since, super seller) and each rating's comment, reasons, date and offers rated; no buyer identity |
| `get_allegro_category` | One category's offers by id or URL, with the search sorts and filters, an optional query, and the category's breadcrumb, subcategories or sibling categories |

Platform key `allegro`. 2 credits per call. Markets (`country`, every tool):
pl (allegro.pl, PLN, default), cz (allegro.cz, CZK), sk (allegro.sk, EUR) and
hu (allegro.hu, HUF); `buying_format` and `deals` are pl only (a 400
elsewhere). Titles, parameters and labels come back in the site's language:
Polish on pl. An offer is one seller's listing (`offer_id`); a catalogue
product (`product_id`) groups many sellers' offers, and
`get_allegro_product_offers` lists every seller's price for it, the
price-monitoring call. `lowest_price_30d` is the EU disclosure Allegro shows
next to a discount (the lowest price in the 30 days before it); it is null
without a discount and is not a price history. `sold_count` is null on
auctions and on cz, sk and hu offer pages. Allegro Lokalnie offers inside pl
results are marked `source: "allegro_lokalnie"`. sk and hu calls can take up
to about a minute, so allow a client timeout of at least 120 s. Failed calls
are not charged; a not-found (unknown offer, product, seller or category) is a
charged 404. No search suggestions, bidding, buying or checkout, Allegro
Lokalnie as its own source, Smart! account data, seller revenue, seller
addresses or tax ids, price history or reviews past the first 20: to track
prices, poll and store your own.

### [bol.com](https://scavio.dev/docs/bolcom-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

bol.com API for the Netherlands and Belgium (EUR): bol.com competitor prices from the buy box and the lowest-priced competing offers on a product, product lookup by id, link or EAN, sellers with ratings and public trader data, category, brand and seller listings, today's deals and promotions such as Black Friday lists.

| Tool | Description |
|------|-------------|
| `search_bolcom` | Search by keyword, up to page 10: each item with its buy-box offer (price, `reference_price` and its type, discount, seller, condition, delivery promise, labels), rating, brand, category and `sponsored` flag; 6 sorts (relevance, popularity, price, rating, wishlist); filter by price, condition (new, refurbished, second-hand), deals, Select deals, delivery (today, tomorrow, evening, sunday, free shipping), category, brand facet and any facet value |
| `get_bolcom_product` | One product by `product_id`, URL or EAN: EAN, specifications, category path, the buy box (price, reference price, seller with rating out of 10, shipping cost, delivery promise), `offer_count`, cheapest new, fastest new, cheapest second-hand and refurbished grades, rating with 1-5 distribution, bol's AI review topics and the first 10 reviews |
| `get_bolcom_offers` | The 10 lowest-priced offers on one product, lowest price first: price, condition (with refurbished grade or second-hand state), shipping cost, delivery promise, seller rating out of 10, plus counts by condition for all its offers; `has_more` when bol has more (no paging) |
| `get_bolcom_seller` | A seller's profile: rating out of 10 with up to four sub-ratings, positive %, review totals, product count and the public EU trader data (company, city, country, registration and VAT number; no street address) |
| `get_bolcom_seller_products` | The products a seller sells, paged and sorted, each with its buy box |
| `get_bolcom_category` | One category's products, paged (up to page 500), sorted and filtered like search, with the category breadcrumbs |
| `get_bolcom_brand` | One brand's products by `brand_id` or URL, paged and sorted |
| `get_bolcom_deals` | Today's day deal (with its `campaign_id`, its link on the asked storefront and end time) and the category deals |
| `get_bolcom_campaign` | The products of one promotion (a Black Friday list, the day deal) by `campaign_id` or URL, paged and sorted |

Platform key `bolcom`. 2 credits per call; `get_bolcom_product` by `ean` is
4 (a search plus the product page, billed on what it actually cost).
Storefronts (`country` + `language`, every tool): nl-nl (`country: "nl"`, the
default, Dutch), be-nl (`country: "be"`, Dutch) and be-fr (`country: "be"`,
`language: "fr"`, French), all EUR; `fr` with `nl` answers 400. Product, EAN,
category, seller and offer ids are the same on every storefront; prices,
offers and stock can differ between the Netherlands and Belgium. On be-fr
bol's own texts are French, some partner titles and the review topics stay
Dutch, and review texts are bol's translation (`is_translated`). `product_id` is a 16-digit STRING:
send it quoted, never as a JSON number. `reference_price_type` is `rrp` (the
supplier's recommended price) or `most_shown_price` (bol's most-shown
non-promotional price over the last 90 days), and `discount_percent` is
against it. `brand_facet_id` (the search / category filter, from the brand
facet) and `brand_id` (items' `brand.brand_id`, `get_bolcom_brand`) are
different id spaces. Search stops at page 10; sorting by anything but
relevance can narrow the result set, and price sorts follow bol's own order
(small inversions against the live buy-box price occur). Listing tools
(seller products, category, brand, campaign) default to popularity and do not
offer relevance; their pages run 1 to 500. List items carry no EAN; the offers
list returns the 10 lowest-priced offers (no paging) and does not mark the buy box (the product's `buy_box.offer_id` names it). Reviews are the first 10
as bol shows them, pooled across the product family, with no reviewer names.
Failed calls are not charged; a not-found is a charged 404. No search
suggestions, review paging, seller review texts, price history or 30-day
lowest price, pickup points, Select member prices or variant selector: to
track prices, poll and store your own.

### OLX

OLX Europe classifieds: used goods, cars, real estate and jobs, with sellers, category filters and similar ads (olx.pl, olx.ro, olx.pt, olx.bg, olx.ua, olx.kz and olx.uz). OLX Brasil, olx.in and other OLX-branded sites are not covered.

| Tool | Description |
|------|-------------|
| `search_olx` | Search by keyword and / or category, up to 50 ads per page (promoted ads interleaved on top of these, flagged `is_promoted` with `promoted_position`): price (with `original_value` / `original_currency` when the site converts it), salary for jobs, condition, params, location with ids, `created_at` / `refreshed_at`, OLX delivery, seller id; sort by relevance, newest or price; filter by price, condition, private / business seller, OLX delivery, photos, region / city / district with a radius and the category's own `filter_*` keys; `total` and `total_capped` |
| `get_olx_offer` | One ad by id or URL: full description, price, salary, every parameter, category breadcrumb, photos, location, dates, status, OLX delivery and the seller (id, `is_business`, `business_name` for businesses, `member_since`) |
| `get_olx_seller` | One seller by id: `is_business`, `business_name` (business sellers only), `member_since`, `active_ads`, `ads_url` |
| `get_olx_seller_ads` | One seller's live ads, with the search sorts and filters and an optional query |
| `get_olx_filters` | A category's filters ready for `filters` (rooms, area, year, mileage ...): key, kind (range or choice), `send_as`, values with ad counts, plus ad counts per region and subcategory (not kz or uz) |
| `get_olx_categories` | The category tree: top level with direct children, or one category's whole subtree, with active ad counts |
| `search_olx_locations` | City and district autocomplete with `city_id`, `district_id` and `region_id` for search |
| `get_olx_suggestions` | Search box suggestions, each with the category it is most searched in |
| `get_olx_similar` | The ads OLX recommends next to one ad (about 30), in the search item shape (not kz or uz) |

Platform key `olx`. 1 credit per call. Markets (`country`): pl (olx.pl, PLN,
default), ro (olx.ro, RON), pt (olx.pt, EUR), bg (olx.bg, EUR), ua (olx.ua,
UAH), kz (olx.kz, KZT) and uz (olx.uz, UZS) on every tool except
`get_olx_filters` and `get_olx_similar` (pl, ro, pt, bg, ua). Titles, params
and labels come back in the site's language: Polish on pl, Russian by default
on kz and uz; `language` (`kk` on kz, `uz` on uz) switches search, seller ads
and offer to Kazakh or Uzbek. `olx_delivery` is not available on kz and uz.
OLX lets anyone page through the first 1,000 results of a search only
(`total_capped`); kz and uz hide large totals (`total` null). `newest` orders
by last refresh (sellers can refresh an ad), not first posting. Discover a
category's `filter_*` keys with `get_olx_filters`, then pass them as
`filters`. When the site converts a price (olx.uz y.e. to UZS, EUR to RON on
ro, USD / EUR to UAH on ua), `price.value` is the converted figure and
`original_value` / `original_currency` keep what the seller entered. Private
sellers' names, phone numbers, emails, exact map positions, last-seen times
and car VINs are never returned, and phone numbers and emails in ad text are
replaced; `business_name` is set for business sellers only. Failed calls are
not charged; a not-found is a charged 404, and an ended ad answers the same
404 as a missing one ("not found or no longer active"). OLX shows no seller
ratings or reviews. No view counts, phone numbers, messaging, delivery prices,
checkout, average prices, notifications or price history: to watch for new
listings or track prices, poll `newest` and store your own.

### [Trendyol](https://scavio.dev/docs/trendyol-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Trendyol (Turkey's largest online marketplace, plus its international storefronts across Europe, the Gulf and Azerbaijan) product data: for one product, the buy-box seller and every other seller's price, seller score, the crossed-out price and Trendyol's lowest-price badge; search, category and brand grids, reviews, seller Q&A, seller stores, flash deals, coupons, top-100 rankings, search suggestions and delivery estimates.

| Tool | Description |
|------|-------------|
| `search_trendyol` | Search by keyword, 36 per page: price, original (crossed-out) price, discount, rrp, Plus price, lowest-price badge (day count), badges, rating, review count, favourites and orders (the site's rounded text), seller id, sponsored flag; 7 sorts; filter by price, brand, category, seller, rating, free shipping, rush delivery, discount, lowest-price badge, seller type, flash sale, coupon or any facet |
| `get_trendyol_product` | One product by content id or link: prices, variants with barcode, attributes, rating, favourite count, category rankings, the `buy_box` (seller name, score out of 10, badges, city, prices, free shipping, rush delivery) and `other_sellers` (every other seller's price, score, badges, lowest-price badge), promotions, installments, VAT and optionally the description |
| `get_trendyol_category` | A category's products by id or link (ids are the same on every market), with the search sorts and filters |
| `get_trendyol_brand` | A brand's products by id or link, with the search sorts and filters |
| `get_trendyol_reviews` | A product's reviews: rating histogram, review topics with positive / negative counts, sizes bought, Trendyol's own review summary, and reviews (rating, text, date, likes, masked author, verified buyer, seller, size, fit, photos); 5 sorts, star and photo filters, up to 50 per page |
| `get_trendyol_questions` | A product's answered seller questions with the seller's answer; askers not named |
| `get_trendyol_seller` | A seller's store profile (score out of 10, product count, followers, badges, average shipping time, question response time, ratings) and optionally its products as a grid |
| `get_trendyol_deals` | Flash deals (slots and the live or chosen slot's items) or Super Firsatlar super discounts (tr only) |
| `get_trendyol_coupons` | The collectable coupons on one product's listing, the buy box's or another seller's (`seller_id`): discount, minimum basket, valid until, issuer (tr only) |
| `get_trendyol_rankings` | A category's top-100 list: best_seller, most_favourited, most_rated or top_viewed, 20 per page (not on the English-language EU storefronts) |
| `get_trendyol_suggestions` | Search-box suggestions (keyword, category, brand, store) for a partial query |
| `get_trendyol_delivery` | Delivery estimate per seller listing for one variant: delivery window, ships by, cutoffs, rush delivery, carriers; a Turkish city / district narrows it (tr only) |

Platform key `trendyol`. Every tool costs 1 credit. Markets (`country`,
default `tr`) and languages (`language`, default the market's first): tr
(TRY; Turkish, English or Arabic), de and at (EUR; German), fr, be, hr, dk,
ee, fi, it, lv, lt, nl, pt, si, es, se and lu (EUR; English), bg (EUR;
Bulgarian or English), gr (EUR; Greek or English), sk (EUR; Slovak or
English), cz (CZK; Czech or English), hu (HUF; Hungarian or English), pl
(PLN; Polish or English), ro (RON; Romanian or English), rs (RSD; Serbian or
English), ua (UAH; Ukrainian or English), md (MDL; Romanian or English), ae
(AED; English or Arabic), sa (SAR; Arabic or English), qa, kw, om and bh
(QAR, KWD, OMR, BHD; Arabic or English) and az (AZN; Turkish). ge, kz, kg and
iq are served as the Turkish storefront and are not accepted; a market
Trendyol does not sell to answers 400 before anything is charged. Every tool
serves all 35 markets except `get_trendyol_deals` and `get_trendyol_coupons`
(tr only) and `get_trendyol_rankings` (not on the 15 English-language EU
storefronts fr, be, hr, dk, ee, fi, it, lv, lt, nl, pt, si, es, se and lu,
which have no ranking lists); `city_id` / `district_id` on delivery are tr only (Istanbul 133,
Sisli 54; there is no city list). The international storefronts have their
own price lists, not a currency conversion of the Turkish price (measured on 2
products on 2026-11-15), and their items are sold by Trendyol itself or by
other sellers (check `buy_box` and `other_sellers`). Trendyol's developer FAQ says the buy box is chosen by algorithm
metrics, not price alone, so compare `buy_box` with `other_sellers` rather
than assuming the buy box is the lowest price. `lowest_price_badge` is the
site's "lowest price of the last N days" tag (7, 10, 14, 30 or 90 days): a
day count, not a numeric 30-day lowest price, and there is no price history,
so poll to track changes. Search lists 36 per page and at most 138 pages, and
`total` stops counting at 100,000 (`total_capped`); sponsored cards are
flagged, kept and repeat across pages. Coupons belong to each seller's
listing: the buy box often has none while another seller has some. Reviews
carry the site's masked author only; no personal data beyond what the page
shows masked, and no seller e-mail, tax number or address. Failed calls are
not charged; a not-found is charged.

### [Kroger](https://scavio.dev/docs/kroger-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Kroger, QFC and Fred Meyer grocery data: product search, product detail, store-level prices, stores, category listings, weekly digital deals, digital coupons and search suggestions.

| Tool | Description |
|------|-------------|
| `search_kroger` | Search by keyword: price, list / promo price with end date, n-for deals, unit price, size, UPC, stock, SNAP, dietary info, rating (average, count, star distribution); `total` and the `store` that priced the results |
| `get_kroger_product` | One product by `product_url` or `upc`: nutrition, ingredients, allergens, description, images, country of origin, dimensions, store aisle, breadcrumbs |
| `get_kroger_prices` | Price, promo, stock, available quantity, aisle and fulfillment for up to 25 UPCs at one store you choose (`store_id`) |
| `find_kroger_stores` | Stores near a ZIP or city / address, or one by `store_id`: `location_id`, address, coordinates, hours, departments, pharmacy, fuel center, pickup, delivery, distance |
| `get_kroger_category` | A category listing by `/pl/` URL or `taxonomy_id`, in the search item shape |
| `get_kroger_deals` | This week's weekly digital deals (`deals_week` with its end date), in the search item shape |
| `get_kroger_coupons` | Digital coupons at one store (`store_id` or `zip`), 24 per page, filter by department or text: savings (amount in cents or percent), terms, tags, valid_for, clip_by and expiry dates |
| `get_kroger_suggestions` | Search box suggestions for a partial query |

Platform key `kroger`. 2 credits for `search_kroger` and `get_kroger_product`, 3
for `get_kroger_prices`, 1 for the rest. Banners (`banner`): `kroger` (kroger.com,
default), `qfc` (QFC, qfc.com: Washington and Oregon) and `fred_meyer` (Fred
Meyer, fredmeyer.com: the Pacific Northwest and Alaska, grocery plus general
merchandise, apparel and home). Other Kroger banners (Ralphs, King Soopers,
Fry's, Harris Teeter, Smith's...) are not supported yet. Prices are integer cents
(`price` 399 = $3.99) and differ by banner and by store. Search, product,
category and deals return the prices of a store the site chooses for the
request (shown in `store`, it can change between calls); for a specific store,
get a `location_id` from `find_kroger_stores` and pass it as `store_id` to
`get_kroger_prices`. QFC store ids start with 705, Fred Meyer ids with 701.
Search, category and deals serve the first page only (up to 24 products) with
no sort; `page` above 1 is a 400 and is not charged. Ratings are average, count
and star distribution; review text is not available. Fuel center locations are
returned, fuel prices are not. Coupons are listed, never clipped (no account).
The printed weekly ad circular is not available. Failed calls are not charged;
an unknown UPC or store id is a charged 404.

### [Publix](https://scavio.dev/docs/publix-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Publix grocery data by store: the weekly ad with BOGO deals, Extra Savings, digital coupons, the deli and bakery order-ahead menu (Pub Subs) with store prices, product search, category listings, nutrition facts and store locations.

| Tool | Description |
|------|-------------|
| `search_publix` | Search at one store by keyword, 48 per page: item code, title, brand, size, aisle, on-sale flag, promo (single, BOGO or multi-buy, with dates), price where Publix shows one, coupon flag; sort by name, popularity, savings or views; filter to on sale, BOGO or a brand; facets |
| `get_publix_product` | One product by item code at one store: the product card plus nutrition facts (every nutrient with amount, unit and % daily value) |
| `get_publix_category` | A category's products at one store by `category_url` or `category_id`, in the search item shape, with the search sorts and filters |
| `get_publix_categories` | The category tree (departments, categories, sub-categories) with ids for `get_publix_category` |
| `get_publix_weekly_ad` | The store's current weekly ad (about 700 items, about 230 BOGO): savings text, deal type (bogo, b2g1, multi, price, percent_off), price, bundle, department, ad start and end dates; filter by department, BOGO only or text |
| `get_publix_extra_savings` | The store's Extra Savings (temporary price reductions): amount saved, reduced price, minimum quantity and the period's dates |
| `get_publix_coupons` | The store's digital coupons (about 100-130): savings text, dollar value, minimum quantity, limit, dates and terms |
| `search_publix_savings` | One keyword across the store's weekly ad, Extra Savings and digital coupons, each item tagged with its `saving_type` |
| `get_publix_order_ahead` | The store's deli and bakery order-ahead menu with its prices: Pub Subs (`section` subs) or every sub, platter, cake and meal (`section` all, 60 per page), with lead time, serves and calories |
| `find_publix_stores` | Stores near a ZIP, in a city + state, or one by `store_id`: address, phone, 7 days of hours, departments, services, pharmacy phone and hours, coordinates, distance and `weekly_ad_break_day` |
| `get_publix_suggestions` | Search box suggestions for a partial query, plus up to 4 products with `store_id` |

Platform key `publix`. 1 credit per call. Every price tool is store-scoped: get
a `store_id` (the Publix store number, e.g. `"1614"` Miami, `"1825"` Atlanta)
from `find_publix_stores`; prices and promotions differ by store (a Publix
Chicken Tender Sub measured $12.09 in Miami and $11.99 in Atlanta). Publix does
not show regular shelf prices online: `price` is a number only for items on
promotion (weekly ad, BOGO, multi-buy, Extra Savings) and order-ahead items, and
null otherwise, never estimated. Multi-buys ("2 for $5.00") carry `bundle`
{quantity, price}. Weekly ads run Thursday to Wednesday in Florida and Wednesday
to Tuesday in Georgia and North Carolina (`weekly_ad_break_day` per store);
English ad only. Products are keyed by Publix item code, not UPC (Publix does not
publish UPCs, ingredients, allergens or reviews online). Coupons are listed,
never clipped (no account); no cart or ordering. Stores cover FL, GA, AL, SC,
NC, TN, VA and KY. Failed calls are not charged; an unknown item code or store
id is a charged 404.

### [IKEA](https://scavio.dev/docs/ikea-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

IKEA product data across 55 markets: IKEA prices by country for one article number, search, product detail, reviews, categories, deal lists, stores, stock by store, bulk item lookup and As-is (second-hand) offers.

| Tool | Description |
|------|-------------|
| `search_ikea` | Search by keyword: item number, name, type, design, price, previous price, discount, price tag (IKEA Family price, new lower price ...), rating, variants, last chance, category path; sort by price, newest, rating, name or popularity; filter by color, price range, category, new, last chance, IKEA Family price, best seller, store availability or any facet; facets, did-you-mean, related searches |
| `get_ikea_product` | One product by article number or product URL: price and previous price with dates, IKEA Family price, measurements, materials, care, packaging (packages, dimensions, weight), assembly PDFs, manuals, designer, variants, secondary ratings, 3 newest reviews |
| `get_ikea_reviews` | Rating, rating count, secondary ratings and the 20 most recent reviews, plus highlighted reviews with their country |
| `get_ikea_category` | A category's products by category id or URL, with the search sorts and filters |
| `get_ikea_categories` | The market's category tree (about 1,500 categories) with ids for `get_ikea_category` |
| `get_ikea_deals` | A deal list: new products, IKEA Family price, new lower price, last chance, lowest price, top seller, limited edition and more, with the search sorts and filters |
| `get_ikea_suggestions` | Search box suggestions for a partial query |
| `find_ikea_stores` | The market's stores and pick-up / plan-and-order points: store id, address, coordinates, opening hours, restaurant and Swedish Food Market hours; filter by text or sort by distance |
| `get_ikea_stock` | Stock level at one store (in stock high / low, out of stock) for up to 100 article numbers, plus home delivery to a postal code |
| `get_ikea_items` | Up to 100 article numbers on one market in one call, in the search item shape |
| `compare_ikea_prices` | One article number across 2 to 10 markets: name, price, previous price, price tag and URL per market, each in its own currency |
| `get_ikea_as_is` | One store's As-is offers (ex-display, returned and second-hand items): original price, offer prices, condition and discount reason |

Platform key `ikea`. 1 credit per call; `compare_ikea_prices` costs 1 credit
per market that answered. Markets (`country`, default `us`): search and product
cover 55 markets, the 50 ikea.com markets (us ca gb ie de at ch fr be nl dk se
no fi ee lv lt pl cz sk hu hr si rs ro pt es it il ae sa kw qa bh om jo eg ma in
my sg ph th jp kr au nz mx cl co) plus cn (ikea.cn), pr (Puerto Rico), do
(Dominican Republic), es_islands (Canary and Balearic islands, with `island`)
and is (Iceland). Category, deals, suggestions and items serve the 50 ikea.com
markets plus cn; reviews, categories, stores, stock and compare the 50 ikea.com
markets; As-is serves us, gb, de, fr, se, jp, nl, es, it, pl, au, ch and at.
Ukraine, Greece, Cyprus, Bulgaria, Hong Kong, Taiwan, Indonesia and Turkey are
not available. `language` picks one of the market's languages (ca en/fr, be
nl/fr/en, ch de/fr/it/en, us en/es ...); data comes in that language and prices
in the market's own currency, never converted. On 2026-11-13 KALLAX 80275887
was EUR 49.99 in de and nl, EUR 59.99 in fr and SEK 599 in se. Some markets
(us, ca, jp, au, kr, in, my, sg, ph ...) sell the same product under a
different article number, so `found` is false there. Reviews are the 20 most
recent the product page shows (no paging, sort or star filter). Ratings are
what each market's site shows: many markets share one pool (KALLAX: 8,241 in
Germany, Spain, Sweden), others have their own (France 2,760, Italy 1,887) and
some show none (Estonia, Latvia, Lithuania, Israel, Iceland). Stock is a level per store, not a quantity. A product or
reviews call can take up to about 100 seconds. Puerto Rico, Dominican Republic
and the islands return the first 40 search results only, and franchise products
(pr, do, es_islands, is) return basic detail. Failed calls are not charged; an
unknown article number, category or store id is a charged 404.

### [Wayfair](https://scavio.dev/docs/wayfair-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Wayfair product data for wayfair.com, wayfair.ca (English or French), wayfair.co.uk and wayfair.ie, plus the AllModern, Birch Lane, Joss & Main and Perigold sites: price, sale price, was price, badge, stock, options, specifications, ratings, reviews, ZIP delivery estimates and the current sale events.

| Tool | Description |
|------|-------------|
| `search_wayfair` | Search by keyword: sku, name, brand (id, name), price, sale price, was price, price label, discount percent, per-item price, badge, rating, review count, stock, open-box price, option counts, sponsored flag; sort by price or customer rating; filter by sale, closeout, open box, new arrivals, in stock, brand id, minimum rating, price range or any facet; a keyword that matches a category answers that category (`redirected_to`) |
| `get_wayfair_product` | One product by SKU or URL: prices, badge, limited-time deal, stock, max quantity, options with option ids, dimensions, specifications, features, images, documents, returns, rating, rating histogram, review summary, review aspects, the 5 reviews the page shows, and delivery estimates for a ZIP / postal code (us, ca) |
| `get_wayfair_category` | A category's products (48 per page) by category id or URL, with the search sorts and filters, plus the category breadcrumbs |
| `get_wayfair_deals` | The market's current sale events (event id, title, URL, image) |

Platform key `wayfair`. 1 credit per call. Markets (`country`, default `us`): us
(USD), ca (CAD; `language` en or fr), gb (GBP) and ie (EUR); Wayfair no longer
sells in Germany or Austria. `site` picks a US banner site (allmodern,
birchlane, jossandmain, perigold; search, product and category). Prices are in
the market's currency, never converted. `was_price` is Wayfair's strikethrough
price: Wayfair's terms state it is the manufacturer's suggested price or the
highest price Wayfair offered or sold the item at in the past, and its Sale
label means a discount against a price in the previous 90 days. Wayfair shows
no price history, so poll `price`, `sale_price`, `was_price` and `badge` to build
one. Option choices carry no price: call `get_wayfair_product` with `option_id`
for each option's price and stock. Reviews are the 5 the product page shows
(no paging). Keyword pages return 30 results (category pages 48) and totals are
approximate. `brand` takes brand ids, not names. ZIP delivery estimates are us
and ca only. Sale events are listed, not expanded: use `on_sale`, `closeout` or
`open_box` on search or category for products. Failed calls are not charged; an
unknown SKU or category is a charged 404.

### [Ashley Furniture](https://scavio.dev/docs/ashley-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Ashley Furniture product data for ashleyfurniture.com, plus search and product on Ashley's licensed storefronts in Canada, Mexico, the Philippines, Saudi Arabia and Turkey: price next to Ashley's Regular Price, badges, stock and delivery, specifications, ratings, the first 10 reviews, customer Q&A, category grids, deal events and stores.

| Tool | Description |
|------|-------------|
| `search_ashley` | Search by keyword: sku, name, brand, price, regular price, discount percent, color, size, badges (sale, clearance, doorbuster, hot buy ...), rating, review count, variants with their own prices, promotions; us: 48 per page with the exact total, sort by best sellers, price, newest, rating or name; licensed storefronts: up to 10 best matches with the handle for `get_ashley_product` |
| `get_ashley_product` | One product by item number or URL (licensed storefronts: by handle or URL): prices, badges, options, variants, set components with their own prices and stock, dimensions, materials, assembly, stock and delivery, nearest store, rating histogram, the first 10 reviews, customer photos and Q&A |
| `get_ashley_category` | A category's products (30 per page) by path or URL, sorted by best sellers, price, newest, rating or name and filtered by any facet or a price range |
| `get_ashley_deals` | The products of one deal event: Black Friday, clearance or Hot Buys, with the category sorts and filters |
| `get_ashley_stores` | Ashley stores near a latitude / longitude (10 to 100 miles): store id, name and URL |
| `get_ashley_store` | One store by store id or URL: address, phone, coordinates, opening hours, payment accepted, services, rating |

Platform key `ashley`. `search_ashley` and `get_ashley_product` cost 2 credits
on us and mx and 1 credit on ca, ph, sa and tr; the other four tools are us
only at 2 credits. Markets (`country`, default `us`): us (ashleyfurniture.com,
USD), ca (ashleyhomestore.ca, CAD), mx (store.ashleyfurniture.com.mx, MXN,
Spanish), ph (store.ashleyfurniture.ph, PHP), sa (store.ashley.sa, SAR,
English) and tr (ashleyturkiye.com, TRY, Turkish). Prices are in the market's
currency, never converted. `regular_price` is Ashley's own Regular Price,
which Ashley's terms define as its highest advertised price in store and
online, offered to customers using special long-term financing. Ashley prices
vary by region and there is no ZIP input: every us answer returns `priced_for`
(`zipcode`, `price_zone`), the ZIP and price zone Ashley priced that answer
for, so two calls can come back priced for different zones. Reviews are the
first 10 the product page shows plus the rating histogram (no review paging).
On the licensed storefronts search returns up to 10 matches (tr its first
results page) with no paging or sort, and product takes the `handle` from
search, not a sku. Search facets are informational: filter on
`get_ashley_category`. `get_ashley_stores` takes coordinates only (no ZIP or
city lookup) and lists stores alphabetically; call `get_ashley_store` for the
address and hours. Failed calls are not charged; an unknown item number,
category or store is a charged 404.

### [Maisons du Monde](https://scavio.dev/docs/maisonsdumonde-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Maisons du Monde (furniture and home decor) product data for France, Belgium (French or Dutch), Luxembourg, the Netherlands, Germany, Spain, Italy, Portugal and Switzerland (French, German or Italian): promo price next to the crossed-out price and discount per storefront, whether an item is sold by Maisons du Monde or a marketplace seller, product detail, pooled customer reviews, category grids, Black Friday and Seconde Chance deals, stores, store stock and marketplace sellers.

| Tool | Description |
|------|-------------|
| `search_maisonsdumonde` | Search by keyword, 40 per page with the exact total: id, name, collection, brand, price, was price (crossed out), discount percent, eco participation (fr), badges, rating, review count, sold by (Maisons du Monde or marketplace), sponsored flag; sort by price or rating; filter by price, discount, stock, rating, color, material, style, brand, seller or any facet |
| `get_maisonsdumonde_product` | One product by reference or URL: prices, stock with the online quantity, seller, variants, dimensions, materials, assembly, documents, review summary, Q&A and the same product's URL on every other market |
| `get_maisonsdumonde_category` | A category's products by hash or URL (the hash is the same on every market), with the search sorts and filters |
| `get_maisonsdumonde_deals` | Black Friday (every market while it runs), Seconde Chance (fr: used and returned items) or any category's discounted items |
| `get_maisonsdumonde_reviews` | A product's reviews, pooled across markets and translated into the request language: rating histogram, criteria scores, source market, brand replies; cursor paging |
| `get_maisonsdumonde_stores` | Up to 10 stores nearest a postcode: address, coordinates, distance, hours, click and collect |
| `get_maisonsdumonde_store` | One store by id or URL: address, phone, hours, services |
| `get_maisonsdumonde_availability` | One item's stock at one store (quantity, display model) plus the delivery options with the home delivery from-price |
| `get_maisonsdumonde_seller` | A marketplace seller's profile (rating, orders, member since, shipping, returns) and catalog |

Platform key `maisonsdumonde`. Every tool costs 1 credit. Markets (`country`,
default `fr`) and languages (`language`, default the market's first): fr
(French), be (French or Dutch), lu (French), nl (Dutch), de (German), es
(Spanish), it (Italian), pt (Portuguese), all in EUR, and ch (French, German or
Italian) in CHF. Search, product, category, deals and reviews serve all nine;
stores, store and availability serve fr, be, de, es, it, pt and ch (not nl or
lu); the marketplace (`get_maisonsdumonde_seller`, the `seller` and `sold_by`
filters) exists on fr, de, es and it. Prices are in the market's currency,
never converted, and can differ by market: measured on 2026-11-14 on about
170 discounted sofas, Luxembourg, the Netherlands, Germany, Spain, Italy and
Portugal matched France on every item, Belgium differed on 19, and Switzerland
is priced separately in CHF (round mirror 204172: 74.99, now 37.45 EUR on every
euro market; 91.90, now 45.95 CHF). Read each market you report. `was_price` is the crossed-out price shown next to a
discount; Maisons du Monde shows no 30-day lowest price and no price history,
so poll to track changes. Reviews are pooled across every market and shown
translated into the request language, with no star filter; a product with no
reviews is a charged 404. Home delivery is a from-price per product and market
(no postcode-exact cost). Store stock: `get_maisonsdumonde_stores` for the
store id, then `get_maisonsdumonde_availability` (Maisons du Monde items only,
not marketplace items). Search tiles carry `sold_by` but not the seller name
(the product has it). The German site does not sort keyword results, so a
sorted search on de comes back in relevance order with a note. No search
suggestions. Failed calls are not charged; a not-found is charged.

### [Williams-Sonoma](https://scavio.dev/docs/williamssonoma-product?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Williams-Sonoma API for the Williams-Sonoma, Inc. brands (Williams Sonoma, Pottery Barn, Pottery Barn Kids, Pottery Barn Teen, West Elm, Rejuvenation, Mark and Graham), chosen with `brand`: one product in full with every SKU's price, regular price, online stock state, delivery services and dimensions (US in USD; Williams Sonoma, Pottery Barn and West Elm in Canada in CAD); the fabric configurator of a made-to-order Pottery Barn piece; standard-delivery dates to a US ZIP code; online stock ranges per SKU; store pickup per SKU per store; stores near a ZIP code across every brand; the stores showing a furniture piece on their floor; each brand's category tree; Pottery Barn category listings; Williams Sonoma and Pottery Barn keyword search; the day's most searched terms; and Williams Sonoma customer reviews. See the [Williams-Sonoma API page](https://scavio.dev/williamssonoma-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `get_williamssonoma_product` | One product by brand + product id or link, us or ca: price range, regular price, on_sale, rating (Williams Sonoma), promotion messages, dimensions, materials, configurator base SKUs and up to 500 SKUs with price, stock state, delivery and pickup services |
| `get_williamssonoma_configurator` | The fabric configurator of a made-to-order Pottery Barn piece: price range across fabrics, production lead time, dimensions and every fabric with content, rub count and price tier |
| `get_williamssonoma_delivery_estimate` | Standard-delivery dates to a US ZIP code per SKU (a product, or up to 20 SKUs), with availability and the holiday order cutoff when published |
| `get_williamssonoma_stock` | Online stock ranges per SKU (available now, within 2 weeks; national) and the ZIP's regional in-stock states |
| `get_williamssonoma_store_pickup` | Pickup true or false per SKU at up to 10 stores, with the ship-to-store window (no unit counts) |
| `get_williamssonoma_stores` | Stores near a ZIP code or point across every brand with stores, with pickup codes, phone and this week's hours |
| `get_williamssonoma_floor_samples` | The stores showing one furniture piece on their floor, by distance |
| `get_williamssonoma_categories` | One brand's category tree (Sale and Black Friday included), top level or one subtree |
| `get_williamssonoma_category` | One Pottery Barn category listing in the site's 5 sorts: 20 products with price ranges, price type, facets |
| `search_williamssonoma` | Williams Sonoma or Pottery Barn keyword search: 20 products with total, facets and related searches |
| `get_williamssonoma_popular_searches` | The day's most searched terms on one brand, with counts as given |
| `get_williamssonoma_reviews` | Williams Sonoma customer reviews, newest first (8 on page 1, 30 on pages 2 to 5), with rating statistics (no reviewer names) |

Platform key `williamssonoma`. Credits: 1 per call, 5 on `search_williamssonoma` and
`get_williamssonoma_category`; `credits_used` in the response is what was charged.
Product pages take up to 50 s and search, category and reviews 15 to 60 s: allow a
client timeout of at least 150 s.

US in USD; `market` `ca` (CAD, English) serves product only, for Williams Sonoma,
Pottery Barn and West Elm. Each tool takes only the brands served on it: search
covers Williams Sonoma and Pottery Barn (West Elm search is not served), category
and the configurator Pottery Barn, reviews Williams Sonoma, and stores, store
pickup and floor samples every brand with stores (Mark and Graham has none). Prices
are the brand's online prices, the same at every ZIP code and store. Stock is a
national unit range, store pickup a yes or no per store. Search and category give
page 1 (20 products). Captured 2026-11-27: the WÜSTHOF Classic Chef's Knife had 19
SKUs from 99 to 200 USD (regular 135 to 200), rated 4.81 from 564 reviews; the
Pottery Barn Gabrielle Bergere Sofa (63") was 2319 USD (regular 2899) and its
configurator offered 50 fabrics from 1999 to 2899 USD; that sofa to ZIP 94103 was a
special order delivered 2027-02-26 to 2027-03-12 and on the floor at 9 stores; ZIP
60611 gave 10 stores across 6 brands within 25 miles; a West Elm rug on westelm.ca
ran 524 to 1274 CAD. Not available: unit counts per store, deeper search pages,
review sort or star filters, UPCs, price history (poll and store the answers).
Failed calls and refused inputs are not charged; a not-found (an unknown product or
category) is charged.

### [Bed Bath & Beyond](https://scavio.dev/docs/bedbathbeyond-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Bed Bath & Beyond API for Bed Bath & Beyond (bedbathandbeyond.com, the US online home goods store), US only, prices in USD: keyword search and category lists in the site's sorts, with sale price, compare-at price (MSRP or was), discount, promo badge, rating and sponsored tiles kept apart; category filters by attribute, price range, rating, brand, promotion and delivery speed; the department menu; one product with every in-stock option's price, sale window and exact online stock; the delivery date and shipping charge of an option to a ZIP code; customer reviews with sorts, a star filter and text search; customer questions and answers; the 333 stores of the Bed Bath & Beyond family (Bed Bath & Beyond / The Container Store, Kirkland's, The Container Store) near a ZIP code, a point or in a state; and the deals page with its sale countdown and doorbusters, plus the Black Friday, On Sale, Doorbusters and Holiday Brand Deals lists. See the [Bed Bath & Beyond API page](https://scavio.dev/bedbathbeyond-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_bedbathbeyond` | Keyword search (or a facet link from an earlier answer), 7 sorts, out-of-stock toggle, up to 84 pages: organic and sponsored items, facets, matching categories, the category or product a keyword redirects to |
| `get_bedbathbeyond_category` | One category by slug + category_id or link, 6 sorts, attribute, price range, rating, brand, promotion, fast delivery and expedited filters, with breadcrumbs and child categories |
| `get_bedbathbeyond_categories` | The department menu: departments, groups and links with the slug and category_id each takes |
| `get_bedbathbeyond_product` | One product by id or link: price, MSRP or was price, savings, rating histogram, specs, taxonomy and every in-stock option with price, sale window and exact online stock |
| `get_bedbathbeyond_delivery_estimate` | Delivery date, shipping charge and shipping levels of one option, for a quantity, to a US ZIP code |
| `get_bedbathbeyond_reviews` | Customer reviews, 4 sorts, star filter, text search, up to 50 a page, with the rating histogram; no reviewer names |
| `get_bedbathbeyond_questions` | Customer questions and answers, 20 questions a page; no screen names |
| `get_bedbathbeyond_stores` | Stores near a ZIP code or a point, in a state, or all of them, by banner, with hours, services and distance |
| `get_bedbathbeyond_deals` | The deals page (sale countdown, doorbuster grid) or a deal list (Black Friday, On Sale, Doorbusters, Holiday Brand Deals) with sorts and pages |

Platform key `bedbathbeyond`. Credits: 1 per call; 2 on `search_bedbathbeyond`,
`get_bedbathbeyond_category` and the deal lists of `get_bedbathbeyond_deals` (the
deals page is 1); a product is occasionally 2. `credits_used` in the response is
what was charged. Most calls take 2 to 25 seconds: allow a client timeout of at
least 90 s.

US only, prices in USD. Bed Bath & Beyond publishes online stock only: no store
stock and no store prices (stores answers locations, hours and services). The site
leaves out-of-stock options out of a product (original_option_count counts them
all); a product no longer sold answers in_stock false with no options. Lists serve
at most 84 pages; the price filter is left out of keyword facets (use category with
price_min and price_max). No UPC or GTIN is published; reviews and questions carry
no reviewer or screen names. Captured 2026-11-27: bath towels gave 7835 results,
the first the Superior Egyptian Cotton 6 Piece Towel Set from 63.98 USD against an
MSRP of 157.50 (59% off), rated 4.5 from 5165 reviews, 26 of its 49 options listed,
the Ash Grey set at 74.25 USD with 97 units in online stock; that option to ZIP
10001 shipped free on 2026-11-30; bedding/bedding-sets counted 4548 products; ZIP
75201 had 16 of the 333 stores within 50 miles; the deals page counted down to a
Black Friday Sale ending 2026-11-30 and the Doorbusters list held 1133 products.
Not available: store stock, store prices, UPCs, price history (poll and store the
answers). Failed calls and refused inputs are not charged; a not-found (an unknown
category) is charged.

### [Mercado Libre](https://scavio.dev/docs/mercadolibre-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Mercado Libre (and Mercado Livre in Brazil) product data for Mexico, Brazil, Argentina
and Colombia: listings, prices, sellers, reviews, buyer questions and category best
sellers, with no OAuth app to register.

| Tool | Description |
|------|-------------|
| `search_mercadolibre` | Listings by keyword or seller in mx, br, ar or co: price, list price, discount, installments, seller where shown, rating, units sold, free shipping and Full flags, sponsored flag; filters for condition, price range, minimum discount, free shipping, Full, official stores and interest-free installments; sort by relevance or price; about 48 per page |
| `get_mercadolibre_product` | One product or listing by URL, product_id or item_id: price, promotions, the buy-box seller with reputation, stock, shipping, star distribution, variations, specs, description, pictures, category |
| `get_mercadolibre_reviews` | 15 reviews per page with rating, text, original text when translated, date, likes, reviewer country and photos; filter by star rating |
| `get_mercadolibre_questions` | Buyer questions on a listing with the seller's answers and answer dates; page with `next_offset` |
| `get_mercadolibre_best_sellers` | The ranked top 20 in a category (mx, ar, co; not Brazil) |

2 credits per call; `get_mercadolibre_reviews` is 1. Search serves up to 42 pages
(about 2,000 results) per query, so slice by price range, condition or seller to reach
more, and sorts by relevance or price only. Units sold are lower bounds ("at least 500"),
not exact counts. Seller name appears on a search row only where Mercado Libre shows it;
`get_mercadolibre_product` returns the buy-box seller, and the list of every seller on a
product is not available. Mercado Libre may narrow a query on its own (Brazil and
Argentina can apply "new"); `auto_applied_filters` lists what it applied. Product,
reviews and questions take no `country`: the id prefix (MLM, MLB, MLA, MCO) or URL sets
it. Chile is not supported. A zero-result search is an empty, billed page; an unknown
product, item or seller nickname, or a listing with no questions, is a billed 404 that
says so.

### [KaBuM!](https://scavio.dev/docs/kabum-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

KaBuM! API for KaBuM! (kabum.com.br, the Brazilian computer and electronics retailer, part of Magalu), Brazil only, Portuguese text, prices in BRL: keyword search and category listings, up to 100 a page, sorted by KaBuM!'s order, price, most reviewed or newest and filtered by any facet, running offers, KaBuM!-sold or a price range; the departments and each department's category tree; one product in full with the card price, the Pix price, every payment plan, the running offer with its end time and units left, stock, specs and the seller (marketplace sellers with their business name, CNPJ and seller score); delivery options to a CEP; customer reviews with KaBuM!'s own summary; and the products of an offer campaign such as Black Friday. See the [KaBuM! API page](https://scavio.dev/kabum-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_kabum` | Keyword search: up to 100 a page (pages 1 to 500), 5 sorts, facet, price and offer filters |
| `get_kabum_category` | One category's products by path, sorted and filtered like search, with its breadcrumb |
| `get_kabum_categories` | The departments, or one department's category tree with the path each takes |
| `get_kabum_product` | One product by code or link: card and Pix prices, payment plans, offer, stock, specs and seller with score |
| `get_kabum_shipping` | Delivery options for one unit to a Brazilian CEP, with price and arrival date |
| `get_kabum_reviews` | Reviews newest or oldest first, up to 50 a page, by stars, with KaBuM!'s own summary (no reviewer names) |
| `get_kabum_offers` | The products of an offer campaign (blackfriday, ofertaskabum) with units left and sold |

Platform key `kabum`. Credits: 1 per call; `credits_used` in the response is what was
charged. Most calls take 2 to 15 seconds: allow a client timeout of at least 90 s.

Brazil only, prices in BRL as KaBuM! shows them to a visitor who is not signed in, never
a Prime-member price: `price` is the card price, `cash_price` the Pix (Brazil's instant
payment) / boleto price. A running offer carries its start, end and units left. Marketplace
sellers come with their business name, CNPJ, state and KaBuM!'s seller score. Captured
2026-11-27: cadeira gamer gave 648 results, the first the Cadeira Gamer Husky Storm 100 at
433.32 BRL card / 389.99 BRL Pix (list 588.78) with 35 offer units left and 1981 in stock,
rated 4.8; hardware/placa-de-video-vga held 459 products; delivery to CEP 01310-100 had 4
options from 34.59 BRL; the blackfriday campaign (2026-11-25 to 2026-11-30) held 620
products. Not available: Prime-member prices, store pickup, price history (poll and store
the answers). Failed calls and refused inputs are not charged; a not-found (an unknown
product, category, department or a campaign that is not running) is charged.

### [Magazine Luiza (Magalu)](https://scavio.dev/docs/magalu-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Magazine Luiza API for Magazine Luiza (magazineluiza.com.br, Magalu, the Brazilian retailer and marketplace), Brazil only, Portuguese text, prices in BRL: keyword search, category listings and deal selections (the daily deals and the Black Friday campaign selections), 40 items a page in the site's 8 sorts, filtered by brand, seller (Magalu or a marketplace seller), price range, minimum rating, Black Friday promotion and attribute facets, with the card price, the Pix price, coupons and each deal's timer; one product in full with every payment plan, coupons, the seller's business details and score, variants, specs and answered questions; a product's reviews with the star distribution, aspect ratings and Magalu's own summary; search suggestions; the physical stores in a state or city and one store's address, CEP and phone. Prices are as magazineluiza.com.br shows them to a visitor who is not signed in. See the [Magazine Luiza API page](https://scavio.dev/magalu-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_magalu` | Keyword search: 40 items a page (pages 1 to 25), 8 sorts, brand, seller, price range, minimum rating, Black Friday, promotion and attribute filters, sponsored cards flagged |
| `get_magalu_category` | One department or subcategory by path or link, sorted and filtered like search |
| `get_magalu_deals` | A deal selection (the daily deals or a campaign selection) with each card's deal timer and coupon |
| `get_magalu_product` | One product by id or link: card and Pix prices, every payment plan, coupons, deal timer, seller details and score, variants, specs and answered questions |
| `get_magalu_reviews` | A product's reviews in 4 sorts, up to 50 a page, with the star distribution, aspect ratings and Magalu's own summary (no reviewer names) |
| `get_magalu_suggestions` | Search suggestions for the start of a search, up to 10 |
| `get_magalu_stores` | The physical stores in one Brazilian state, optionally one city |
| `get_magalu_store` | One store by number or link: street address, city, state, CEP and phone |

Platform key `magalu`. Credits: 2 per call on every tool; `credits_used` in the response
is what was charged. Search, category, deal and product calls usually take 10 to 60
seconds (deal pages took up to 161 s on Black Friday 2026): allow a client timeout of
at least 180 s; reviews, suggestions and stores take 3 to 15 s.

Brazil only, prices in BRL: `price` is the card price, `pix_price` the price paid by
Pix (Brazil's instant payment), `list_price` the regular price when a lower one
applies. Coupons and deal timers (`deal_starts_at`, `deal_ends_at`) are returned as the
site gives them. Availability is the site's flag, never a unit count. Reviews have no
reviewer names and no star filter. Captured 2026-11-27: geladeira frost free counted
1000 results over 25 pages, the first the LG Frost Free Smart Inverse 462L at 3893.68
BRL by card or 3699 BRL by Pix, sold by Magalu and rated 4.8 from 1240 ratings; the
Geladeira Refrigerador subcategory held 616 products; the daily deals held 353 items,
one running to 2026-11-30 09:59 Brasilia time with a 30 BRL coupon; the state of Sao
Paulo listed 513 stores, 235 of them in the city. Not available: shipping by CEP,
store pickup, store stock, store hours and coordinates, the Full (fulfillment) filter,
GTINs, price history (poll and store the answers). Failed calls and refused inputs are
not charged; a not-found (an unknown product, category, selection or store) is charged.

### [Casas Bahia (with Extra and Ponto)](https://scavio.dev/docs/casasbahia-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Casas Bahia API for Casas Bahia (casasbahia.com.br, the Brazilian retailer of Grupo Casas Bahia) and its Extra (extra.com.br) and Ponto (pontofrio.com.br) storefronts, chosen with `site`, Brazil only, Portuguese text, prices in BRL: keyword search, category listings, deal collections and seller lists, 20 items a page in the storefront's 5 sorts, filtered by any facet value (brand, price band, discount band, rating, seller, features), own store only and a price range, with sponsored placements kept apart; one product in full with every seller, the price, the Pix price and discount, every installment plan, the store card plan, availability flags, specs, variants, the rating summary with the storefront's own review summary and the questions with their answers; and each storefront's category menu. See the [Casas Bahia API page](https://scavio.dev/casasbahia-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_casasbahia` | Keyword search on Casas Bahia, Extra or Ponto: 20 items a page (pages 1 to 500), 5 sorts, facet, own-store and price filters, sponsored placements apart |
| `get_casasbahia_category` | One category, deal collection or seller list by path or link, sorted and filtered like search |
| `get_casasbahia_product` | One product by SKU or link: price, list price, Pix price, installment plans, every seller, availability flags, specs, variants, rating summary and questions |
| `get_casasbahia_categories` | One storefront's category menu: groups, categories with the path each takes, featured departments and the top bar links |

Platform key `casasbahia`. Credits: 2 per call; `credits_used` in the response is what
was charged. Most calls take 10 to 60 seconds: allow a client timeout of at least 120 s.

Casas Bahia, Extra and Ponto share one catalog; each storefront's own-store price and
review counts can differ, so `site` decides them. Search, category and collection lists
carry no prices: read `get_casasbahia_product` with an item's `sku` for its price, Pix
price (Pix is Brazil's instant payment), installments and sellers. Listings count up to
10,000 results (`total_is_capped`); collections carry no start or end dates. Availability
is flags only, no unit counts; an out-of-stock product answers no price or sellers. Reviews
are the 3 on the product page plus the rating summary, no reviewer names. Captured
2026-11-27: geladeira frost free gave 1170 results over 59 pages plus 8 sponsored
placements, the first the Geladeira Frost Free Duplex Branca Consul - CRM40MB rated 4.83
from 105 reviews; Eletroportáteis sorted best selling counted 10,000+ products; the Smart
TV 55" TCL 55P755 rated 4.9 from 759 reviews with 99% recommending it and 135 questions;
the Casas Bahia menu listed 8 groups and 39 categories. Not available: prices on list
items, reviews past the page's 3, freight by CEP, store lists, unit counts, price history
(poll and store the answers). Failed calls and refused inputs are not charged; a not-found
(an unknown category, or a SKU the storefront answers with its not-found page) is charged.

### [Buscape + Zoom](https://scavio.dev/docs/buscape-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Buscape + Zoom API for Buscape and Zoom (buscape.com.br and zoom.com.br, Brazil's price comparison sites, one catalog with the same ids), chosen with `site`, Portuguese text, prices in BRL: keyword search, category and deal listings, up to 100 a page, sorted by relevance, price, rating or price drop and filtered by any facet, price range, category, marketplace or best-selling store; the category tree; one product with its specs, the offers on the page, the site's price tip, the editors' pros and cons and store reviews; every store offer for a product; up to 12 months of the daily lowest price; the lowest current price; campaign landings such as Black Friday; a store's coupons; freight estimates to a CEP; and search suggestions. See the [Buscape + Zoom API page](https://scavio.dev/buscape-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_buscape` | Keyword search: up to 100 a page (pages 1 to 1000), 5 sorts, facet, price, category, marketplace and store filters |
| `get_buscape_category` | One category's products by id or slug, sorted and filtered like search, with its breadcrumb |
| `get_buscape_categories` | The top-level branches, or one branch's categories with their ids |
| `get_buscape_product` | One product: specs, offers on the page, 40 days of prices, the site's price tip, editors' pros and cons, up to 10 store reviews |
| `get_buscape_offers` | Every store offer for a product, 4 sorts, by variant, up to 50 a page |
| `get_buscape_price_history` | The day's lowest price and its store for 40 days or 3 to 12 months |
| `get_buscape_lowest_price` | The lowest current price of a product, with its store and stock |
| `get_buscape_deals` | The deals list (competitiveness 0.8 and up), by category or keyword, sorted and filtered like search |
| `get_buscape_deal_landing` | One campaign landing (black-friday, oferta-do-dia-buscape, black-friday-zoom) with its sections |
| `get_buscape_store` | One store with its cashback and the coupons its page lists |
| `get_buscape_suggestions` | Search-box suggestions for what has been typed |
| `get_buscape_shipping` | Freight estimates per store offer to a Brazilian CEP, with the store's coupon promotions |

Platform key `buscape`. Credits: 1 per call; `credits_used` in the response is what
was charged. Most calls take 1 to 9 seconds; product, categories, deal landing and store
take 5 to 30 s, up to about 80 s when busy: allow a client timeout of at least 180 s.

Buscape and Zoom share one catalog and the same ids; `site` sets the site of the page
links returned. Store links and coupon links are not returned. Totals are capped at 10,000
(`total_capped`). The price tip, the editors' pros and cons and the store coupons are as
the site gives them. Captured 2026-11-27: geladeira gave 4053 results, the first the
Geladeira Brastemp BRM46MB from 2308 BRL across 5 stores, with 54 store offers; the iPhone
16 128GB was rated 4.8 from 6077 reviews with 22 offers from 6 stores and a regular_price
tip against a median of 4549 BRL, its 40-day lowest price running from 5057.99 down to
4299 BRL; a deals list held 305 items; the Black Friday landing held 6 sections; store 21
(KaBuM!) listed 100 coupons. Not available: store links, store ratings (the sites publish
none), review paging. Failed calls and refused inputs are not charged; a not-found (an
unknown product, category, store or landing, or a product with no offers) is charged.

### [Drogasil + Droga Raia](https://scavio.dev/docs/rdsaude-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Drogasil + Droga Raia API for Drogasil and Droga Raia (drogasil.com.br and drogaraia.com.br, the pharmacy chains of RD Saude), chosen with `site`, Brazil only, Portuguese text, prices in BRL: search by keyword, product code or EAN and category listings, 24, 36 or 48 a page, sorted by relevance or price and filtered by brand, own or partner store, highlight, pickup store, price range and any facet; the menu tree; one product with its price ladder (offers, quantity discounts, lab programs and payment discounts as given), variants, kits, the seller and the regulatory flags exactly as the site gives them; prices of up to 48 products in one call; store pickup yes or no at chosen stores; the stores near a CEP and the store locator (about 4,000 stores); customer reviews with the site's own summary; the deals (Oferta do Dia, % Especial, Black Friday, coupons); and search suggestions. See the [Drogasil + Droga Raia API page](https://scavio.dev/rdsaude-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_rdsaude` | Search by keyword, product code or EAN: 24, 36 or 48 a page, 3 sorts, brand, seller, highlight, pickup store, price and facet filters |
| `get_rdsaude_category` | One category's products by id or link, sorted and filtered like search |
| `get_rdsaude_categories` | The menu tree, three levels, with the ids category takes |
| `get_rdsaude_product` | One product by code or link: price, price ladder, variants, kit, seller and regulatory flags as given |
| `get_rdsaude_prices` | Current prices of up to 48 products in one call |
| `get_rdsaude_store_availability` | Store pickup yes or no for products at stores, up to 5 product x store checks |
| `get_rdsaude_stores` | The nearest stores (up to 6) of one banner to a Brazilian CEP, with hours and services |
| `search_rdsaude_stores` | The store locator by state, city, neighborhood or text, filtered by 24 hours, parking and Farmacia Popular |
| `get_rdsaude_reviews` | Reviews up to 50 a page by stars, with the site's own summary and tags (no reviewer names) |
| `get_rdsaude_deals` | Oferta do Dia, % Especial, Black Friday, the running coupons or one coupon's products |
| `get_rdsaude_suggestions` | Search-box suggestions and quick filters for what has been typed |

Platform key `rdsaude`. Credits: 1 per call; `credits_used` in the response is what
was charged. Most calls take 2 to 15 seconds, the menu and the store locator up to 35 s:
allow a client timeout of at least 120 s.

Prices are the site's default online price, a reference price that is the same at every
store; each banner has its own prices, category ids, stores and reviews. Store
availability is the site's own pickup yes or no, never a unit count. Regulatory and
prescription flags are returned exactly as the site gives them; no descriptions or
package-insert text. The site gives no start or end dates for deals. Captured 2026-11-27:
protetor solar on Drogasil gave 5583 results, the first the Protetor Solar Eucerin Oil
Control Sérum FPS 75 30ml at 84.99 BRL (list 119.90); the Kit Nivea Sun Protect & Hidrata
FPS 50 was 43.99 BRL (list 72.99); an Episol sunscreen powder on Droga Raia averaged 4.82
from 164 reviews and was available for pickup at 2 stores; CEP 01310-100 listed 6 Drogasil
stores; the coupon NIVEABRAND covered 195 products; the Droga Raia menu held 9 departments
and 379 categories. Not available: unit counts, per-store prices, price history (poll and
store the answers). Failed calls and refused inputs are not charged; a not-found (an
unknown product or category) is charged.

### [Reclame Aqui](https://scavio.dev/docs/reclameaqui-company-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Reclame Aqui API for Reclame Aqui (reclameaqui.com.br, Brazil's company complaint and reputation site), Portuguese text as published: the site's company search; one company's reputation for each of 5 periods (complaints, answered and solved percent, would do business again, consumer and final score, average answer time, the RA1000 to Not Recommended status), main problems, segment ranking and 6 months of reputation history; one company's complaints newest first with the site's tabs, category, product and problem filters, Black Friday purchases and a keyword, with the exact total; one complaint with its whole thread; complaints across every company that match some words; the 11 site-wide rankings; every ranked segment; and the best and worst companies of a segment. Consumer names and contact details are never returned. See the [Reclame Aqui API page](https://scavio.dev/reclameaqui-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_reclameaqui_companies` | The site's company search: id, shortname, reputation, final score, solved percent, 6-month complaints, CNPJ |
| `get_reclameaqui_company` | One company's reputation for 5 periods, main problems, segment ranking, reputation history and notice |
| `get_reclameaqui_complaints` | One company's complaints newest first: status tabs, category, product, problem, Black Friday and keyword filters, 5 or 10 a page |
| `get_reclameaqui_complaint` | One complaint with its whole thread: company answers, consumer replies and the final evaluation |
| `search_reclameaqui_complaints` | Complaints across every company that match some words, with the companies they are about |
| `get_reclameaqui_rankings` | The 11 site-wide ranking lists of 20 companies, or one of them |
| `get_reclameaqui_segments` | Every ranked segment under the 15 main segments |
| `get_reclameaqui_segment_ranking` | The best and worst companies of one segment, 10 a page |

Platform key `reclameaqui`. Credits: 1 per call; `get_reclameaqui_complaints` by
`shortname` 2 (the company id is looked up first; 3 if the search misses it and the
company page is read); `credits_used` in the response is what was charged. Allow a
client timeout of at least 120 s.

Brazil only, no prices. Consumer names, emails, IPs, user ids, phones and cities are never
returned (the consumer's state is); a consumer's name in a company's greeting is replaced
with [nome], and every answer carries a note that the text is as the consumer published it.
Complaint lists are newest first only and reach offset 500 per filter combination (51
pages of 10). Reclame Aqui's own API (RA API / Hugme) is paid and covers only a company's
own complaints. Captured 2026-11-27: nubank matched 6 companies; Nubank over 6 months had
56825 complaints, 100% answered, 93.2% solved, 81.5% would do business again, final score
8.8, RA1000, and 164495 resolved complaints; iphone quebrado matched 3774 complaints about
50 companies; Bancos Digitais ranked 40 companies best; the site ranked 165 segments under
15 main segments. Not available: consumer identities, complaint lists past offset 500,
other sort orders. Failed calls and refused inputs are not charged; a not-found (an unknown
company, complaint or segment) is charged.

### [Leroy Merlin](https://scavio.dev/docs/leroymerlin-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Leroy Merlin API for Leroy Merlin (the home improvement retailer of the ADEO group) in seven markets chosen with `country`: Brazil (leroymerlin.com.br, BRL, prices per price region) and Italy, Spain, Portugal, Poland, Romania and France (EUR, PLN, RON), in each market's language. Keyword search (not in France) and category listings, sorted, filtered and paged; Leroy Merlin Italia's offers page as a product list; one product in full with its price, discount, unit, specifications and marketplace offers, and in Brazil the region's store stock; exact units in store with the aisle and pickup for every store of a Brazil price region; stores near a place or point and one store's hours; product reviews with the rating summary; in Brazil a delivery quote to a CEP (postal code), the address for a CEP, the 28 price regions and the department tree; and search suggestions in Italy, Spain, Portugal and Poland. See the [Leroy Merlin API page](https://scavio.dev/leroymerlin-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_leroymerlin` | Keyword search in Brazil (by price region) and Italy, Spain, Portugal, Poland and Romania: sorted, filtered, paged, with promotion dates and Black Friday flags in Brazil |
| `get_leroymerlin_category` | One category's products by slug, path or link in any of the seven markets, sorted and paged, or a landing page's subcategories |
| `get_leroymerlin_offers` | Leroy Merlin Italia's offers page as a product list, with price validity dates as given |
| `get_leroymerlin_product` | One product by reference number or link: price, original price, unit, discount, installments, specifications, marketplace offers; in Brazil the region's store stock |
| `get_leroymerlin_store_stock` | Brazil: exact units, aisle and pickup for one product at every store of a price region (or one store) |
| `get_leroymerlin_stores` | Brazil: the store list by state, region or distance from a point; Europe (not Spain): up to 10 stores nearest a city, postcode or point |
| `get_leroymerlin_store` | One store: address, phone, coordinates, hours and special hours |
| `get_leroymerlin_reviews` | One page of a product's reviews with the rating summary (Brazil, Italy, Portugal, Poland, Romania); no reviewer names |
| `get_leroymerlin_shipping` | Brazil: standard, scheduled and express delivery cost and days to a CEP, and store pickup |
| `get_leroymerlin_cep` | Brazil: the street, district, city and state of a CEP |
| `get_leroymerlin_regions` | Brazil: the 28 price regions every priced Brazil call takes |
| `get_leroymerlin_categories` | Brazil: the department tree, or one category's subtree, 1 to 4 levels |
| `get_leroymerlin_suggestions` | Search-box suggestions in Italy, Spain, Portugal and Poland |

Platform key `leroymerlin`. Credits: billed on what the request spent in its market,
`credits_used` in the response is what was charged: Brazil 1 on every tool; Italy 1
(product and category pages 2); Romania 1; Spain, Portugal and Poland 2; France 5. Allow
a client timeout of at least 120 s, 240 s for Brazil search and category.

`country` is `br`, `it`, `es`, `pt`, `pl`, `ro` or `fr`; Brazil needs `region` for
every price (prices are set per price region, not per store). France has no keyword
search. European listings show 48 products a page, but Leroy Merlin's page carries full
details for the first products of each page only (18 of 48 in most markets, all 48 in
Romania): the rest come as ids in `other_products` for `get_leroymerlin_product`. Store
stock is Brazil only, as Leroy Merlin Brasil reports it. Captured 2026-11-27: furadeira in
grande_sao_paulo gave 401 results, the first a Philco cordless drill at 199.90 BRL; the
Wap WF 12K3.2 cordless drill was 129.90 BRL (original 149.90), in stock at 12 of the
region's 16 stores; one product in rio_de_janeiro held 469 units across 4 stores, 218 at
Rio Barra in the Eletricidade aisle; a delivery to CEP 01310-100 quoted 9.90 BRL standard
in 1 day and free pickup in 2 hours; an Italian impact drivers category held 358
products, full details for 10 of the first 48; the Italian offers page held 923
products; Milano listed 10 stores, the nearest at 9.4 km; an Italian product averaged
4.6 from 295 reviews. Not available: search in France, reviews in Spain and France,
store search in Spain, store stock outside Brazil, Ukraine and Greece, price history
(poll and store the answers). Failed calls and refused inputs are not charged; a
not-found (an unknown product, category or store) is charged what it spent.

### [Natura](https://scavio.dev/docs/natura-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Natura API for Natura (the Brazilian beauty brand of Natura &Co) on its own storefronts in Brazil, Argentina, Chile, Colombia, Mexico and Peru, chosen with `country`, text in each market's language, prices in its currency (BRL, ARS, CLP, COP, MXN, PEN): keyword search, category listings and the Black Friday campaign listing, up to 100 a page, in each market's own sorts and filtered by the site's refinements (brand, product type, gender, fragrance family, skin type) and a price range; the category menu; one product with its price, struck-through price, discount, installments, low-stock badge, shades, kit contents, ingredients and the 3 latest reviews; search suggestions; and the physical stores in Brazil by state, city, CEP prefix and store type. See the [Natura API page](https://scavio.dev/natura-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_natura` | Keyword search in one of six markets: up to 100 a page, the market's own sorts, refinement and price filters |
| `get_natura_category` | One category listing by id or /c/ link, sorted and filtered like search |
| `get_natura_categories` | The market's category menu with the id each category takes |
| `get_natura_product` | One product by id or link: price, list price, discount, installments, stock flag and low-stock badge, shades, kit contents, ingredients, rating and the 3 latest reviews (no names) |
| `get_natura_suggestions` | Search suggestions: products, brands, popular searches and categories |
| `get_natura_stores` | Brazil: the physical stores by state, city, CEP prefix and type (own, franchise, athena, kiosk) |
| `get_natura_deals` | The market's Black Friday campaign listing (natura-friday or promociones), with the campaign's dates as the page states them |

Platform key `natura`. Credits: 1 per call on every tool; `credits_used` in the response
is what was charged. Most calls take 2 to 30 seconds, up to a minute for pages of 100:
allow a client timeout of at least 120 s.

`country` is `br` (default), `ar`, `cl`, `co`, `mx` or `pe`. Prices are as Natura shows
them to a visitor who is not signed in: no consultant prices, no regional prices by CEP.
Not every market offers every sort (Mexico has no discount sort). Stock is a flag, never a
unit count. Captured 2026-11-27: perfume on br gave 522 results, the first the Deo Parfum
Ilia Flor de Laranjeira 50 ml at 99.95 BRL (list 199.90, 50% off); maquiagem held 964
products; the Deo Parfum Ilia Secreto 25 ml was 66.48 BRL (list 110.80) with the
ultimas unidades badge, rated 4.7 from 109 reviews; natura-friday held 4248 products, the
page stating the campaign runs 16 to 27 November 2026 with discounts extended to 30/11; the
Brazil store list held 1,093 stores, 102 in the city of Sao Paulo. Not available: full
review paging, store stock, regional prices, store coordinates and hours, Natura's US
store, price history (poll and store the answers). Failed calls and refused inputs are not
charged; a not-found (an unknown product or category) is charged.

### [O Boticario + Eudora](https://scavio.dev/docs/boticario-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

O Boticario API for O Boticario and Eudora (boticario.com.br and eudora.com.br, the beauty brands of Grupo Boticario), chosen with `brand`, Brazil only, Portuguese text, prices in BRL: keyword search, category and product-brand listings and the deal listings (Beauty Week, the site's Black Friday event, and the promotions hub), 36 a page in 7 sorts, filtered by product brand, line, category, rating, price and any facet, with the card price, the Pix price, deal badges and each item's countdown; the category menu; the promotion conditions with each campaign's dates and coupon codes; one product with its online stock count, datasheet, every shade and the review summary; current prices for up to 10 SKUs; reviews; the stores that offer pickup near a CEP; delivery and pickup for one product at a CEP; and search suggestions. See the [O Boticario API page](https://scavio.dev/boticario-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_boticario` | Keyword search on O Boticario or Eudora: 36 a page (pages 1 to 100), 7 sorts, product brand, line, category, rating, price and facet filters |
| `get_boticario_category` | One department, category or product-brand listing by path or link, sorted and filtered like search |
| `get_boticario_categories` | The category menu: departments, groups and links with the path each takes |
| `get_boticario_deals` | Beauty Week or the promotions hub, optionally one section, with each item's countdown end and deal badges |
| `get_boticario_promotions` | The promotion conditions page: each campaign's validity dates and coupon codes as written |
| `get_boticario_product` | One product by slug, link or SKU: card and Pix prices, online stock count, seller, datasheet, every shade / size, kit components and the review summary |
| `get_boticario_prices` | Current prices of up to 10 SKUs in one call |
| `get_boticario_reviews` | Reviews by SKU or for every shade together, up to 50 a page, 3 sorts, by stars (no reviewer names) |
| `get_boticario_stores` | The stores that offer pickup of online orders near a CEP, nearest first, with hours and pickup time |
| `get_boticario_pickup` | Delivery options and whether store pickup is offered for one product at a CEP |
| `get_boticario_suggestions` | Search suggestions: terms with their departments and up to 5 products |

Platform key `boticario`. Credits: 1 per call; search, category, categories, deals,
promotions and product cost 2 when the page needs a second route; prices cost 1 per 5
SKUs (ceil(skus / 5)). `credits_used` in the response is what was charged. Page tools
usually take 10 to 130 seconds (allow a client timeout of at least 240 s); the others 2 to
25 seconds (at least 90 s).

`brand` is `boticario` (default) or `eudora`. Prices are as the site shows them to a
visitor who is not signed in: `price` is the card price, `pix_price` the price paid by Pix
(Brazil's instant payment); page prices come from the site's own cache and can be up to
about 15 minutes old. Captured 2026-11-27: perfume on O Boticario gave 1823 results, the
first the Combo Lily Le Parfum at 434.80 BRL by card or 391.32 BRL by Pix; /perfumaria/
held 911 products; Beauty Week held 1216 items, one at 7.50 BRL (was 37.90) with a
countdown to 2026-11-28; the Base Liquida Cor 330 Make B. Mate Salicylic 30g was 59.90 BRL
(was 99.90) with 440 units in online stock, rated 4.88 from 3860 reviews; CEP 01310-100 had
348 pickup stores, the nearest 55 m away. Not available: per-store stock, which store
holds an order, loyalty prices, reviewer names, price history (poll and store the
answers). Failed calls and refused inputs are not charged; a not-found (an unknown
product, path or SKU) is charged what it spent.

### [Centauro](https://scavio.dev/docs/centauro-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Centauro API for Centauro (centauro.com.br, the sporting-goods retailer of Grupo SBF), Brazil only, Portuguese text, prices in BRL: keyword search, category listings and deal lists (the Black Friday hotsite, the outlet, Mega Oferta), 36 a page in the site's 4 sorts, filtered by brand, size, gender, sport, colour, discount band, promotion, a physical store's range and the seller (Centauro or a marketplace seller), with the price, the Pix price, badges and every colour; one product with every size's sku, price, seller and stock flag; delivery options and store pickup for one size to a CEP, store by store; the stores near a CEP; and search suggestions with the site's top searches. See the [Centauro API page](https://scavio.dev/centauro-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_centauro` | Keyword search: 36 a page (pages 1 to 278), 4 sorts, facet, brand, store and seller filters |
| `get_centauro_category` | One category by /nav/ path, link or facet value, sorted and filtered like search |
| `get_centauro_deals` | The Black Friday hotsite, the outlet, Mega Oferta or another hotsite slug, sorted and filtered like search |
| `get_centauro_product` | One product by product id (model + colour), model and colour, or link: every size with sku, price, Pix price, seller and stock flag, colours, specs and up to 3 reviews (no names) |
| `get_centauro_freight` | Delivery options and store pickup for one size to a CEP: cost, dates and which stores hold the size |
| `get_centauro_stores` | The physical stores near a CEP, by distance, with the store filter for search |
| `get_centauro_suggestions` | Search suggestions and the site's top searches |

Platform key `centauro`. Credits: 1 per call on every tool; `credits_used` in the response
is what was charged. Listings usually take 10 to 45 seconds (allow a client timeout of at
least 150 s); product, freight, stores and suggestions 2 to 20 seconds (at least 120 s).

Prices are as centauro.com.br shows them to a visitor who is not signed in; `pix_price` is
the price paid by Pix (Brazil's instant payment) where the site shows one. Sizes can differ
in price and seller (a Centauro offer and a brand seller can split them). Listing totals are
capped by the site at 10000 (`total_capped`). Stock is a flag per size and per store,
never a unit count. Captured 2026-11-27: tenis corrida reached the 10000 cap, the first the
Tenis Masculino adidas Super U at 389.99 BRL (list 599.99, 35% off); the Black Friday
hotsite held 9257 products; the Super U in BRANCO/PRETO ran from 389.99 to 599.99 BRL by
size, 11 of 12 sizes in stock; one size to CEP 01310-100 had free same-day store pickup
and 18 stores holding it; CEP 20040-002 in Rio de Janeiro listed 27 stores. Not available:
deal start and end dates (the site publishes none), the full review list, Q&A, unit counts,
price history (poll and store the answers). Failed calls and refused inputs are not
charged; a not-found (an unknown product, category, deal list or sku) is charged.

### [Enjoei](https://scavio.dev/docs/enjoei-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Enjoei API for Enjoei (enjoei.com.br, Brazil's second-hand fashion marketplace), Brazil only, Portuguese text, prices in BRL: keyword search and department, category and subcategory listings, 30 a page by cursor, in 4 sorts, filtered by brand, clothing, waist and shoe size, price, condition (new or used), listing age, store kind and discount, with the price, the price before the seller's discount, size, condition and shipping type; the category tree; one listing with its make-an-offer range, installments, sizes, brand, condition and photos; a seller's shop with its counters, rating and on-time delivery history; the shop's listings on sale, its sold listings and its buyer reviews; and search suggestions. Sellers appear by @handle only. See the [Enjoei API page](https://scavio.dev/enjoei-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_enjoei` | Listing search: 30 a page by cursor, 4 sorts, brand, size, price, condition, listing age, store kind and discount filters |
| `get_enjoei_category` | One department, category or subcategory by slug, optionally with keywords, sorted and filtered like search |
| `get_enjoei_categories` | The category tree, three levels, with the slugs each category takes |
| `get_enjoei_product` | One listing by id or link: price, list price, make-an-offer range, installments, sizes, brand, condition, photos and the seller's handle |
| `get_enjoei_shop` | A shop by handle: joined date, counters, rating, review count, on-time delivery history and average shipping time |
| `get_enjoei_shop_listings` | A shop's listings on sale, by cursor |
| `get_enjoei_shop_sold` | A shop's sold listings with the listed price, 40 a page, up to 50 pages |
| `get_enjoei_shop_reviews` | A shop's buyer reviews, all, positive or negative, with the star and feedback-tag summary (no reviewer names) |
| `get_enjoei_suggestions` | Search suggestions, with the department each narrows to |

Platform key `enjoei`. Credits: 1 per call on every tool; `credits_used` in the response
is what was charged. Search, category, shop listings and suggestions usually take 10 to 40
seconds, up to about two minutes (allow a client timeout of at least 180 s); the others 2
to 10 seconds (at least 60 s).

Prices are as enjoei.com.br shows them to a visitor who is not signed in: new-buyer coupons
and make-an-offer prices are not applied. Listings are paged by cursor (`next_cursor`) and
cover sellers who ship to all of Brazil; Enjoei's totals stop at 10000 (`total_capped`).
Seller names, avatars and cities are never returned, nor reviewer names. Captured
2026-11-27: vestido farm reached the 10000 cap, the first a used FARM linen midi dress at
199 BRL; a used FARM dress listed at 75 BRL (list 90) accepted offers from 45 to 74 BRL; the
shop utstore had 706 listings on sale and 1998 sold listings over 50 pages, rated 4.7 from
809 reviews. Not available: shipping quotes by CEP (they need a signed-in buyer), a colour
filter (put the colour in the query), product comments, a site-wide sold search, sold
dates, sold listings past 50 pages a shop, coupons, price history (poll and store the
answers). Failed calls and refused inputs are not charged; a not-found (an unknown product
or handle) is charged.

### [Atacadao](https://scavio.dev/docs/atacadao-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Atacadao API for Atacadao (atacadao.com.br, the Brazilian cash-and-carry wholesale chain of Grupo Carrefour Brasil), Brazil only, Portuguese text, prices in BRL: keyword search and category listings priced at the store you choose, up to 100 a page in the site's 8 sorts, filtered by category, brand, price range, collection and any facet, with the unit price, every quantity tier and the case size; one product by sku, EAN, product id or link with its tiers and whether the store sells it; the filter values with the store's own counts; the pickup stores near a CEP or a point; the store directory by state and city; one store in full with its services and payment methods; each store's current flyers as links; search suggestions with the top searches; and the department tree. See the [Atacadao API page](https://scavio.dev/atacadao-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_atacadao` | Keyword search at one store: up to 100 a page (pages 1 to 50), 8 sorts, category, brand, price, collection and facet filters |
| `get_atacadao_category` | One category by path or id at one store, sorted and filtered like search |
| `get_atacadao_product` | One product by sku, EAN, product id, slug or link at one store: price, quantity tiers, case size, EAN and whether the store sells it |
| `get_atacadao_stores_near` | The pickup stores near a CEP or a point, nearest first, with hours, and the stores serving that CEP |
| `get_atacadao_stores` | The store directory for a state, optionally a city: address, phone, hours and whether it sells online |
| `get_atacadao_store` | One store in full: services, payment methods, meal vouchers and its flyers |
| `get_atacadao_flyers` | One store's current flyers with validity dates and the PDF link |
| `get_atacadao_facets` | The filter values for a query or category at one store, with the store's counts |
| `get_atacadao_suggestions` | Search suggestions with search counts, and the site's top searches |
| `get_atacadao_categories` | The department tree with the path and id each category takes |

Platform key `atacadao`. Credits: 1 per call on every tool; `credits_used` in the response
is what was charged. Most calls take 2 to 20 seconds: allow a client timeout of at least
90 s.

Prices are the online prices of the store you choose with `store_id` (from
`get_atacadao_stores_near` or `get_atacadao_stores`); without one, the site's default
store (atacadaobr60, Vila Maria, Sao Paulo). `price` is the unit price for 1 unit and
`price_tiers` lists every quantity tier the store gives (the unit price drops at larger
quantities); there is no was-price. Items the chosen store does not sell are left out of
listings. Flyers are returned as links, not opened. Captured 2026-11-27: arroz at the
Tatuape store (atacadaobr340) matched 52 items, the first the Arroz Branco Camil Tipo 1 5kg
at 20.29 BRL; the Arroz Branco Namorado Tipo 1 5kg was 21.89 BRL for 1 unit and 21.39 BRL
each from 6; CEP 01310-100 had 33 pickup stores, the nearest 4.9 km away; Sao Paulo city
had 21 stores; the Tatuape store listed 6 Black Friday flyers. Not available: the business
(CNPJ) channel, store stock and unit counts, reviews, Q&A, price history (poll and store
the answers). Failed calls and refused inputs are not charged; a not-found (an unknown
product, category id or store) is charged.

### [Carrefour Brasil](https://scavio.dev/docs/carrefourbr-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Carrefour Brasil API for Carrefour Brasil (carrefour.com.br: the Mercado grocery site and the www marketplace), chosen with `site`, Brazil only, Portuguese text, prices in BRL, separate from Carrefour France (platform key `carrefour`): keyword or EAN search, category listings and collections (the themed and deal lists the site links to), 15 a page in the site's 8 sorts, filtered by any facet and a price range, with the price, list price, single-payment price, seller and stamps, sponsored placements kept apart; grocery prices for a region by CEP or pickup store; one product with every seller, payment-method prices and promotions as given; delivery and pickup options for one item to a CEP; the pickup stores; search suggestions with the top searches; the coupon page; and the department menu. See the [Carrefour Brasil API page](https://scavio.dev/carrefourbr-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_carrefourbr` | Keyword or EAN search: 15 a page (pages 1 to 50), 8 sorts, facet and price filters, regional prices by CEP or store on mercado |
| `get_carrefourbr_category` | One category by path or link, sorted and filtered like search |
| `get_carrefourbr_collection` | One collection (a themed or deal list) by id or link, sorted and filtered like search |
| `get_carrefourbr_product` | One product by item id or link: price, list price, single-payment price, every seller, payment-method prices, promotions, specs and variants |
| `get_carrefourbr_delivery` | Delivery and pickup options for one item from one seller to a CEP, with nearby pickup stores and their hours |
| `get_carrefourbr_stores` | The pickup stores, by state and city, with the store id that sets regional prices |
| `get_carrefourbr_suggestions` | Search suggestions: terms, suggested products and the site's top searches |
| `get_carrefourbr_coupons` | The coupon page: codes, values, expiry and rules as published |
| `get_carrefourbr_categories` | The department menu, 3 levels, with the path, filters or collection each entry takes |

Platform key `carrefourbr`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Calls usually take 2 to 25 seconds on mercado, up to about 50
on www: allow a client timeout of at least 120 s.

`site` is `mercado` (default, the grocery site) or `www` (non-food and the marketplace). On
mercado, `cep` or `store` gives that region's prices and assortment (`price_scope`
regional); without them, the site's default prices (`price_scope` national). www prices are
national. `spot_price` is the single-payment price; `payment_offers` are the site's prices
for one payment method, such as the Carrefour card or Pix (Brazil's instant payment).
Availability is a flag, never a unit count. Captured 2026-11-27: arroz on mercado at CEP
01310-100 matched 43 items; the rice category held 100 items, the first the Arroz Branco
Camil Tipo 1 5kg at 23.99 BRL; the Arroz Branco Longo-fino Tipo 1 Tio Joao 1 Kg was 6.59
BRL with a Carrefour card offer of 30% off; delivery to CEP 01310-100 cost 10.90 BRL in 2h,
with free pickup at a store 1.15 km away; Sao Paulo state had 68 pickup stores. Not
available: reviews and questions (the site has none), flyers, a store locator with hours
(the delivery tool lists nearby pickup stores with theirs), unit counts, price history
(poll and store the answers). Failed calls and refused inputs are not charged; a not-found
(an unknown item, category or collection, or an item the region does not sell) is charged.

### [Terabyteshop](https://scavio.dev/docs/terabyte-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Terabyteshop API for Terabyteshop (terabyteshop.com.br, Brazil's PC-parts store), Brazil only, Portuguese text, prices in BRL: keyword search, category and brand listings and the deal listings (Black Friday, open box, free shipping), 30 a page in the site's order or by price, filtered by sub-category and spec attributes, with the card price, the Pix price (Pix is Brazil's instant payment), the list price, installments, units sold and a running deal's end; one product with every card plan, warranty, the deal's units left, specs and the newest reviews; reviews by page; the active coupons with the products each covers; the site's top search terms; and the Full Custom PC builder's platforms, component groups and options. See the [Terabyteshop API page](https://scavio.dev/terabyte-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_terabyte` | Keyword search, up to 100 a page, sorted by Scavio on the returned page (the site's search ignores sorting) |
| `get_terabyte_product` | One product by id or link: card and Pix price, list price, every card plan, warranty, deal end and units left, specs, 5 newest reviews |
| `get_terabyte_reviews` | A product's reviews, newest first, 5 a page (no reviewer names) |
| `get_terabyte_category` | One category by path: 30 a page, site order or price, sub-category and spec filters |
| `get_terabyte_brand` | One brand's products in one category, by brand name or id |
| `get_terabyte_deals` | The Black Friday, open-box and free-shipping listings |
| `get_terabyte_coupons` | The active coupons, one coupon category's, or one code with the products it covers |
| `get_terabyte_trending_searches` | The site's top search terms with search counts and each term's top product |
| `get_terabyte_pc_builder` | The PC builder: platforms, component groups, and a group's options with availability per distribution center |

Platform key `terabyte`. Credits: 1 per call on every tool; `credits_used` in the response
is what was charged. Product, search and listings usually take 5 to 30 seconds, up to about
90 (allow a client timeout of at least 180 s); reviews, coupons, trending searches and the PC
builder 2 to 6 seconds (at least 60 s).

Prices are as terabyteshop.com.br shows them to a visitor who is not signed in. The site's
search ignores sorting, so `search_terabyte` sorts the returned page and a note says so.
PC builder prices are the builder's own and can differ from the product page. Captured
2026-11-27: rtx 5060 matched 162 products; the Gigabyte GS24F14 monitor was 549.99 BRL by
Pix and 647.05 by card, in a Black Friday offer ending 2026-11-30 with 6 units left; the
Black Friday listing held 6767 products; 11 coupons were active. Not available: shipping by
CEP (Terabyteshop quotes it in the cart), stores (it has none), stock unit counts, price
history (poll and store the answers). Failed calls and refused inputs are not charged; a
not-found (an unknown product, category, brand, code or platform) is charged.

### [Cobasi](https://scavio.dev/docs/cobasi-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Cobasi API for Cobasi (cobasi.com.br, the Brazilian pet store of Grupo Petz Cobasi), Brazil only, Portuguese text, prices in BRL: keyword search, category and brand listings and the deals page, 20 a page, sorted and filtered by any facet, with the price, the regular price and each size's SKU; one product with every size's price, price per kg and, when the product can be bought on subscription, the Compra Programada price; reviews and questions by page; pickup and delivery options for one SKU at a CEP; search suggestions; the store directory; and one store with its hours and services. See the [Cobasi API page](https://scavio.dev/cobasi-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_cobasi` | Keyword search: 20 a page, up to page 50, 4 sorts, facet filters |
| `get_cobasi_category` | One category by path, with its subcategories and facet counts |
| `get_cobasi_brand` | One brand's products by brand slug |
| `get_cobasi_deals` | The deals page: deal price next to the regular price |
| `get_cobasi_product` | One product by id or link: every size's price, EAN, price per measure, subscription price when offered, specs, rating |
| `get_cobasi_reviews` | A product's reviews, 4 a page, with the star summary (no reviewer names) |
| `get_cobasi_questions` | A product's questions with Cobasi's answers, 4 a page (no asker names) |
| `get_cobasi_availability` | Pickup stores and delivery options for one SKU at a CEP |
| `get_cobasi_suggestions` | Search suggestions, with the spelling Cobasi corrected |
| `get_cobasi_stores` | The store directory by state and city, with coordinates and services |
| `get_cobasi_store` | One store: address, phone, hours per weekday, grooming and vet hours, services |

Platform key `cobasi`. Credits: 1 per call on every tool; `credits_used` in the response is
what was charged. Listings, product, stores and store take 10 to 90 seconds (allow a client
timeout of at least 240 s); reviews, questions, availability and suggestions 2 to 6 seconds
(at least 60 s).

Prices are as cobasi.com.br shows them to a visitor who is not signed in. Availability is a
pickup or delivery flag, never a unit count. Captured 2026-11-27: racao golden matched 237
products; the Formula Natural Fresh Meat dog food was 59.99 BRL for 1 kg (list 74.99); its
SKU could be picked up at 11 stores near CEP 01310-100, ready in 45 minutes, or delivered for
7.90 BRL in 2 business days; the deals page held 1293 products; Cobasi listed 253 stores.
Not available: Pix prices, per-store prices or stock, marketplace sellers, deal validity
dates, price history (poll and store the answers). Failed calls and refused inputs are not
charged; a not-found (an unknown product, category, brand or store) is charged.

### [Netshoes](https://scavio.dev/docs/netshoes-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Netshoes API for Netshoes (netshoes.com.br, Brazil's sporting-goods store, part of Magalu), Brazil only, Portuguese text, prices in BRL: keyword search and list pages (such as the Black Friday sneakers), 100 or 45 a page in the site's 7 sorts, filtered by any facet; one product with every size, every seller's offer, the Pix price where a Pix promotion applies, specs and rating; every offer for one size; the online stock count for a size; delivery options to a CEP; reviews and questions by page; the daily deal; a marketplace seller's company data and rating; and the popular searches. See the [Netshoes API page](https://scavio.dev/netshoes-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_netshoes` | Keyword search: 100 a page, 7 sorts, brand, gender, size, seller, price and facet filters |
| `get_netshoes_list` | A list page by slug (tenis-black-friday by default), 45 a page, sorted and filtered like search |
| `get_netshoes_product` | One product by colour id, size sku or link: every size with EAN, price, Pix price and every seller's offer |
| `get_netshoes_offers` | Every seller's offer for one size, with installment plans |
| `get_netshoes_inventory` | The online stock count for one size and seller |
| `get_netshoes_shipping` | Delivery options for one size to a CEP, with the free-shipping threshold |
| `get_netshoes_reviews` | A product's reviews, 13 a page, by stars or with photos (no reviewer names) |
| `get_netshoes_questions` | A product's questions and answers, 10 a page (no asker names) |
| `get_netshoes_daily_deal` | The daily deal (Barato do Dia) with its start and end |
| `get_netshoes_seller` | A marketplace seller: company name, CNPJ, business address, products sold, rating |
| `get_netshoes_popular_searches` | The search box's popular searches |

Platform key `netshoes`. Credits: 1 per call on every tool; `credits_used` in the response
is what was charged. Search and list pages usually take 2 to 30 seconds (allow a client
timeout of at least 180 s); the others 2 to 15 seconds (at least 120 s).

Prices are as netshoes.com.br shows them to a visitor who is not signed in. `price` is the
card price; `pix_price` the Pix price where a Pix promotion applies. Shipping and inventory
use the size's buy-box offer, whose price can differ by a few reais from the price the
product tool shows. The daily deal carries no prices: send its product ids to the product
tool. Captured 2026-11-27: tenis corrida filtered to nike matched 214 products; the Adidas
Racer TR23 was 249.99 BRL (list 499.99) in 8 sizes, with 549 units of size 38 online and free
delivery to CEP 01310-100 in 3 days; tenis-black-friday held 736 products. Not available:
store stock, contacts of marketplace sellers, price history (poll and store the answers).
Failed calls and refused inputs are not charged; a not-found (an unknown product, sku, list
or seller) is charged.

### [Estante Virtual](https://scavio.dev/docs/estantevirtual-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Estante Virtual API for Estante Virtual (estantevirtual.com.br, Brazil's used and new book marketplace, part of Magalu), Brazil only, Portuguese text, prices in BRL: search by title, author or ISBN keywords, category and list pages (such as Black Friday), in the site's 6 sorts and filtered by used or new, author, publisher, year, seller city and price; the book for an ISBN; one book with its lowest used and new copy and its reviews; every copy of a book on sale, cheapest first, optionally with each copy's seller; one copy with the seller's condition notes; a delivery quote for a copy to a CEP; a sebo's (second-hand bookshop's) page, catalogue and buyer reviews; and the sebo directory by state and city. See the [Estante Virtual API page](https://scavio.dev/estantevirtual-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_estantevirtual` | Title, author or ISBN search: 44 a page, 6 sorts, used / new, author, publisher, year, city and price filters |
| `get_estantevirtual_isbn` | The book for an ISBN-10 or ISBN-13 (check digit verified), with ungrouped listings |
| `get_estantevirtual_book` | One book: lowest used and new price and copy, rating and reviews (no reviewer names) |
| `get_estantevirtual_copies` | Every copy of a book on sale, up to 50 a page, by price, year, publisher, city or seller |
| `get_estantevirtual_copy` | One copy: condition notes, invoice flag, price, seller, weight and size |
| `get_estantevirtual_shipping` | The lowest-cost delivery option for one copy to a CEP |
| `get_estantevirtual_seller` | A sebo or bookseller: shop name, private or business, city and state, rating, catalogue size and a page of books |
| `get_estantevirtual_seller_books` | A sebo's catalogue, searchable, 40 a page |
| `get_estantevirtual_seller_reviews` | A sebo's buyer reviews, 10 a page (no reviewer names) |
| `get_estantevirtual_sellers` | The sebo directory: the country, a state or a city, 30 a page |
| `get_estantevirtual_category` | One category by slug, sorted and filtered like search |
| `get_estantevirtual_list` | A list page by slug (black-friday by default), 42 a page |

Platform key `estantevirtual`. Credits: 1 per call, except `get_estantevirtual_copies` with
`sellers: true`, which reads each copy's seller and is billed ceil((1 + copies) / 5) credits
(10 copies = 3, 50 = 11); `credits_used` in the response is what was charged. Most calls take
2 to 30 seconds, up to 70 when the site is busy: allow a client timeout of at least 180 s.

Prices are as estantevirtual.com.br shows them to a visitor who is not signed in. A book is
every copy of one ISBN; a copy without an ISBN group is a listing. Sellers appear by shop
name with city and state only, and `seller_type` says private or business; reviewer names
are never returned. Captured 2026-11-27: dom casmurro matched 3915 books; ISBN 9788535914849
(1984, Companhia das Letras) had 198 used and 62 new copies, from 18 BRL used and 21.90 BRL
new; a delivery quote for one copy to CEP 01310-100 was 19.34 BRL in 9 days; Sao Paulo city
had 1258 sebos and booksellers. Not available: search suggestions, questions, stores, a
was-price, Pix prices, price history (poll and store the answers). Failed calls and refused
inputs are not charged; a not-found (an unknown book, copy, seller, category or list, or an
ISBN with no copy on sale) is charged.

### [C&A Brasil](https://scavio.dev/docs/cea-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

C&A Brasil API for C&A Brasil (cea.com.br, the Brazilian arm of the C&A fashion chain), Brazil only, Portuguese text, prices in BRL: keyword search, category, brand and promotion-collection listings, up to 24 a page in the site's 8 sorts, with the price, list price, Pix price (Pix is Brazil's instant payment), the best installment plan and every size's own price and capped online quantity; the filter values with their counts; search suggestions and the top searches; the department tree; one product with every size, each payment method's longest plan and specifications; the delivery quote for one size to a CEP, with the stores near it that can hand the size over; and the pickup points near a CEP, C&A stores and third-party pickup lockers. See the [C&A Brasil API page](https://scavio.dev/cea-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_cea` | Keyword search: up to 24 a page, pages 1 to 50, 8 sorts (price, best sellers, newest, discount, name) |
| `get_cea_category` | One department, category or subcategory by path, sorted like search |
| `get_cea_brand` | One brand's products by its Marcas filter value (C&A labels and partner brands) |
| `get_cea_deals` | One promotion collection by id, with list price, sale price and discount |
| `get_cea_facets` | The filter values with product counts for a query, category, brand or collection |
| `get_cea_suggestions` | Search-box completions with search counts, and the site's top searches |
| `get_cea_categories` | The department tree over three levels |
| `get_cea_product` | One product by id, size sku, slug or link: every size's price, Pix price and capped quantity, payment plans, specifications |
| `get_cea_shipping` | The delivery quote for one size to a CEP, with the nearby stores that can hand it over |
| `get_cea_stores` | The pickup points near a CEP: C&A stores and third-party pickup lockers, with hours |

Platform key `cea`. Credits: 1 per call on every tool; `credits_used` in the response is
what was charged. Listings usually take 5 to 100 seconds (allow a client timeout of at least
240 s); the others 2 to 15 seconds (at least 120 s).

Prices are as cea.com.br shows them to a visitor who is not signed in. `available_quantity`
is the site's capped online figure (a round 100, 10000 or 99999 means plenty, 0 none), not a
store's units. Collections are returned as ids only. The pickup points include third-party
lockers and counters (Clique Retire) next to the C&A stores. Captured 2026-11-27: vestido
matched 13549 products; an oversized cotton t-shirt was 99.99 BRL in 5 sizes, payable in 3
interest-free C&A Pay installments of 33.33; one size had free delivery to CEP 01310-100 in
6 business days and 5 nearby stores could hand it over; the CEP listed 18 pickup points, 17
C&A stores and 1 Clique Retire point. Not available: reviews (no texts, no aggregate), EAN
(the site leaves it empty), store unit counts, price history (poll and store the answers).
Failed calls and refused inputs are not charged; a not-found (an unknown product or sku) is
charged.

### [Lojas Renner](https://scavio.dev/docs/renner-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Lojas Renner API for Lojas Renner (lojasrenner.com.br, the Brazilian fashion retailer), Brazil only, Portuguese text, prices in BRL: keyword search, category listings and product lists (the list of every discounted product by default), 48 a page in the site's 8 sorts, filtered by category, seller, brand, size, colour, gender and the states with stock, with the price, list price, installments, the stock level the site lists and units sold in the last 15 days; one product with every colour and size and the site's per-size availability flags; the price and stock flags for one size; and the stores for a CEP's city or region. See the [Lojas Renner API page](https://scavio.dev/renner-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_renner` | Keyword search: 48 a page, pages 1 to 200, 8 sorts, refinement filters |
| `get_renner_category` | One category by navigation id or link, sorted and filtered like search |
| `get_renner_deals` | A product list: every discounted product by default, or another list by id or link |
| `get_renner_product` | One product: price, Cartao Renner and other-card installments, rating aggregate, colours and per-size availability flags |
| `get_renner_sku_price` | Price, installments and stock flags for one size |
| `get_renner_stores` | The stores for a CEP's city or region, with hours |

Platform key `renner`. Credits: 1 per call on every tool; `credits_used` in the response is
what was charged. Listings are slow at the source, usually 30 to 200 seconds (allow a client
timeout of at least 300 s); product, sku price and stores 5 to 30 seconds (at least 180 s).

Prices are as lojasrenner.com.br shows them to a visitor who is not signed in.
`installments` gives the Cartao Renner (store card) plan and the plan for other cards apart.
Listings carry the stock level the site lists per product; the product and sku price tools
give availability flags per size, not unit counts. Stores outside the CEP's state that the
site returns are left out with a note. Captured 2026-11-27: camiseta matched 9468 products;
the discounted-products list held 106896; a pair of trousers was 199.90 BRL (list 219.90), 6
interest-free Cartao Renner installments of 33.32, rated 4.4 from 21 reviews; CEP 01310-100
listed 5 stores. Not available: review texts (the rating is the aggregate only), shipping
quotes by CEP, search suggestions, deal start and end dates, store coordinates, price history
(poll and store the answers). Failed calls and refused inputs are not charged; a not-found
(an unknown product, sku, category or list) is charged.

### [Pichau](https://scavio.dev/docs/pichau-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Pichau API for Pichau (pichau.com.br, Brazil's PC-parts store), Brazil only, Portuguese text, prices in BRL: keyword search (a keyword the site sends to a category is followed and reported), category and brand listings and the deal listings (Black Friday, open box, any campaign), 36 a page in the site's order, by price or by name, filtered by the listing's own facets, with the card price, the Pix price (Pix is Brazil's instant payment), the list price, installments and a running promotion's units left and sold; one product with specs, EAN and warranty; the same page as a browser shows it after loading, with live promotion units, the FPS benchmarks shown on PCs and a prebuilt PC's or kit's component list; reviews by page; every card plan of a product; the coupons; the category menu; and search-box suggestions. See the [Pichau API page](https://scavio.dev/pichau-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_pichau` | Keyword search: 36 a page, 5 sorts, facet filters; `redirected_to` when the site sends the keyword to a category |
| `get_pichau_category` | One category by path, with its product count and breadcrumbs |
| `get_pichau_brand` | One brand's products by brand slug |
| `get_pichau_deals` | The Black Friday and open-box listings or another campaign, with each product's countdown |
| `get_pichau_product` | One product by url_key or link: card, Pix and list price, running offer with units left, specs, EAN, warranty |
| `get_pichau_product_live` | The product page after loading: live promotion units, FPS benchmarks, component lists of prebuilt PCs and kits |
| `get_pichau_reviews` | A product's reviews, 10 a page, by stars or with media (no reviewer names) |
| `get_pichau_installments` | Every card plan of a product, including the discounts on short plans |
| `get_pichau_coupons` | The coupons page: active and upcoming coupons |
| `get_pichau_categories` | The category menu, or every node with `all` |
| `get_pichau_suggestions` | What the search box suggests: terms with match counts, categories and up to 10 products |

Platform key `pichau`. Credits: 1 per call on every tool; `credits_used` in the response is
what was charged. Listings took 5 to 170 seconds in Black Friday week, product, coupons and
categories 5 to 60 seconds, product live and suggestions 30 to 160 seconds (the page is
loaded as a browser does): allow a client timeout of at least 240 s. Reviews and
installments by product id take 2 to 8 seconds (at least 60 s).

Prices are as pichau.com.br shows them to a visitor who is not signed in. `price` is the
card price, `pix_price` the Pix price. Stock is a status, plus a running promotion's units
left and sold. Captured 2026-11-27: rtx 5060 matched 1385 products; the Black Friday listing
held 1467; an INNO3D RTX 5060 card was 3159.99 BRL by Pix and 3717.64 by card (list
3835.28), in a Black Friday offer ending 2026-11-30 with 2 units left; a Pichau prebuilt PC
listed 22 component groups and FPS for 14 games; 18 coupons were active. Not available:
shipping by CEP (Pichau quotes it in the cart), stores, stock unit counts, the PC builder,
price history (poll and store the answers). Failed calls and refused inputs are not charged;
a not-found (an unknown product, category, brand or campaign) is charged.

### [Dafiti](https://scavio.dev/docs/dafiti-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Dafiti API for Dafiti (dafiti.com.br, the Brazilian fashion marketplace), Brazil only, Portuguese text, prices in BRL: keyword search, department, category and brand listings and the outlet, 48 a page plus the sponsored slots, in the site's 5 sorts, with the price, list price, Pix price (Pix is Brazil's instant payment), card price and whether a partner store sells the product; one product with every size, its stock, delivery type and the store that sells it, the other colours, specs and the rating aggregate; and every size of a product with its stock, faster. See the [Dafiti API page](https://scavio.dev/dafiti-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_dafiti` | Keyword search: 48 a page plus sponsored slots, 5 sorts |
| `get_dafiti_category` | One department or category by path or link, sorted like search |
| `get_dafiti_brand` | One brand's listing by the brand as the site writes it |
| `get_dafiti_deals` | The outlet: the site's own selection of discounted products |
| `get_dafiti_product` | One product by id, sku or link: prices, seller, every size with stock and delivery type, colours, specs |
| `get_dafiti_sizes` | Every size of one product with its stock, by sku (faster, for a stock check) |

Platform key `dafiti`. Credits: 1 per call on every tool; `credits_used` in the response is
what was charged. Listings are slow at the source, usually 15 to 160 seconds, and product 6
to 35 seconds (allow a client timeout of at least 240 s); sizes 2 to 15 seconds (at least
120 s).

Prices are as dafiti.com.br shows them to a visitor who is not signed in. Stock per size is
exact from 0 to 10 units; above that the site gives "more than 10" (`more_than_10`), not a
count. `delivery_type` is Dafiti's own stock, fulfillment (a partner store's stock delivered
by Dafiti) or drop shipping (sent by the partner store); marketplace sellers appear by store
name only. The site matches searches loosely, so a search with no close match can still list
related products. Captured 2026-11-27: vestido matched 19233 products; the outlet held 199;
an Asics Gel 1130 sneaker was 389.99 BRL by Pix (410.52 by card, list 699.99), 4 of 11 sizes
in stock, 5 units each of sizes 41 and 42. Not available: review texts, shipping quotes,
search suggestions, Dafiti Colombia, price history (poll and store the answers). Failed calls
and refused inputs are not charged; a not-found (an unknown product, sku, category or brand)
is charged.

### [Rakuten](https://scavio.dev/docs/rakuten-stores?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Rakuten API for Rakuten (rakuten.com, the cashback site, formerly Ebates) in the US (rakuten.com, USD), the UK (rakuten.co.uk, GBP) and Canada (rakuten.ca, CAD, English or French): every store's current cash back rate as Rakuten writes it, with the was rate when Rakuten has raised it, the in-store rate, category rates and terms; a store's coupons and deals; up to 100 stores' rates in one call for rate-change checks; store, brand and product search with Rakuten's product prices; the search box suggestions; category store lists; the Black Friday, Cyber Monday and coupon hub pages; and the card-linked in-store offers. See the [Rakuten API page](https://scavio.dev/rakuten-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `get_rakuten_stores` | The store directory with every store's current rate, 36 a page: US by category and sort (cash back, recommended, A to Z, Z to A), UK, and Canada by department and flag (increased, top, new, Canadian, buy now pay later) |
| `get_rakuten_store` | One store by slug, link or id: online and in-store rates, was rate, category rates, terms, posting time, free shipping, about, first coupons and review summary (no reviewer names); Canada adds special conditions and days to report |
| `get_rakuten_store_coupons` | Every coupon and deal one store has, 18 a page, with code (null on a deal), restriction and Rakuten's own tag (US, UK) |
| `get_rakuten_rates` | Current rates for up to 100 store ids in one call, in the order asked, with not_found (US, UK) |
| `search_rakuten` | Stores, coupons and products for a store, brand or product: top store, store lists, coupons and products with price, was price and the store's rate |
| `get_rakuten_suggestions` | The rakuten.com search box suggestions: stores with their rates, and product terms (US) |
| `get_rakuten_category` | Every store with Cash Back in one rakuten.com category, 36 a page; page 1 adds subcategories and the category page's featured sections (US) |
| `get_rakuten_deals` | The Black Friday, Cyber Monday or coupon hub page, or one store's own Black Friday page: stores, coupons and product deals by section (US) |
| `get_rakuten_in_store` | Rakuten's card-linked in-store cash back offers, 21 a page, with their terms (US) |

Platform key `rakuten`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Answers usually take a few seconds; allow a
client timeout of at least 240 s for a retried call.

Markets (`country`, default `us`): `us`, `gb` and `ca` (with `language` `en` or
`fr`) for stores, store and search; `us` and `gb` for store coupons and rates;
`us` only for suggestions, category, deals and in-store offers. Rakuten Japan is
not offered. Rates are as Rakuten writes them (rate_text) with the parsed amount,
type (percentage or fixed), up_to and tiered flags; elevated is true when Rakuten
shows a was rate. Rakuten publishes no end dates for cash back rates, and US and
UK coupons carry none: poll and store the answers to track changes. Rakuten's
shopping-trip links are never returned; page_path is the store's Rakuten page
path as a plain identifier. Captured 2026-11-26: the US directory sorted by cash
back held 3208 stores over 90 pages; Macy's was at 12% Cash Back (was 2%) online
plus 10 USD in-store, with 100 coupons and deals over 6 pages; Argos on
rakuten.co.uk was up to 0.82% Cashback; Best Buy on rakuten.ca in French was up to
6% (was 1%) with 25 category rates; a search for nike gave Nike as the top store
and 437925 products; Electronics held 258 stores; the in-store list held 84
offers. Not available: Rakuten Japan, account balances, adding an offer to an
account, rate history (poll and store the answers). Failed calls and refused
inputs are not charged; a not-found (an unknown store or category) is charged.

### [Booking.com](https://scavio.dev/docs/booking-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_booking` | Properties for a destination and stay: live nightly price, review score, room type |
| `get_booking_hotel` | One property in full: rooms and rate plans, facilities, house rules, policies, images |
| `get_booking_reviews` | Guest reviews with the score breakdown by category and Booking's own summary |

1 credit per call. Search returns 25 properties per page; `get_booking_hotel` and `get_booking_reviews` are single-shot.

### [Airbnb](https://scavio.dev/docs/airbnb-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_airbnb` | Stays with stay-total and per-night price, the full discount ledger, rating, coordinates |
| `get_airbnb_listing` | One listing in full: description, capacity, grouped amenities, host, house rules, rating breakdown |
| `get_airbnb_reviews` | Review bodies with per-review rating, date and reviewer profile |

1 credit per call. `search_airbnb` takes `page` XOR `cursor` - sending both is rejected, and `cursor` wins. 18 listings per page. `get_airbnb_reviews` pages with `limit` + `offset`.

### [Vrbo](https://scavio.dev/docs/vrbo-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Vrbo API for Vrbo (vrbo.com, Expedia Group's vacation rental site) in 20 vrbo.com market-languages: vacation-rental search by place or region id for your dates and guests, with the nightly price, the total for the stay, the was price, Vrbo's fees line and refund deadline, the guest rating and Premier Host badges, sorted and filtered as on Vrbo; one property in full with every amenity group, house rules, highlights, photos and what is nearby; and Vrbo's destination suggestions with the region id search takes. Vrbo's own API (Expedia Group's partner program) is for approved partners, not self-serve. See the [Vrbo API page](https://scavio.dev/vrbo-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_vrbo` | Search by `destination` or `region_id` with `check_in` / `check_out` (required, at most 90 nights), adults and children's ages; 5 sorts and Vrbo's filters (property type, amenity, house rule, pets, location type, Premier Host, minimum bedrooms); the first 50 results with nightly and stay-total price, was price, fees line, rating, badges, sponsored flag and coordinates; `partial` and `attempts` |
| `get_vrbo_property` | One property by id or link, read without dates: location, rating, highlights, space, every amenity group, house rules, important information, description, damage policy, host (Premier Host flag and languages only), photos, nearby places and the site's own default price |
| `get_vrbo_suggestions` | Destination suggestions for a partial place name: type, `region_id` (the input of search), names, coordinates, country |

Platform key `vrbo`. Credits: billed on what each call cost, `credits_used` in
the response is what was charged: 2 per call on `get_vrbo_property` and
`get_vrbo_suggestions`; `search_vrbo` 2 per attempt, 2 to 8 (usually 2 to 6).
Vrbo sometimes answers a search with a 3-result page; Scavio asks again, up to
4 attempts in all, and if 3 is all Vrbo gives it returns those 3 with
`partial: true`. Answers can take up to about 3 minutes: allow up to 4 minutes.

Markets (`market`, default `us`): `us` (USD), `en-gb` (GBP), `en-ca` and `fr-ca`
(CAD), `es-mx` (MXN), `pt-br` (BRL), `es-es`, `it-it`, `pt-pt`, `nl-nl`, `de-at`,
`el-gr`, `fi-fi` (EUR), `da-dk` (DKK), `sv-se` (SEK), `no-no` (NOK), `ja-jp` (JPY),
`en-sg` (SGD), `en-au` (AUD), `en-nz` (NZD), each in its own language and currency
(host-written titles and descriptions can stay in the host's language).
abritel.fr, fewo-direkt.de, stayz.com.au and bookabach.co.nz are separate sites
and are not covered. Search returns the first 50 results only (Vrbo's results
pages carry no further page): narrow with sort and filters. Prices are exactly
as Vrbo shows them for the requested dates; the property's `default_price` is
the site's own default stay, not a quote. Captured 2026-11-26: Destin, Florida
for 2027-01-15 to 2027-01-18 with 2 adults gave 50 of 394 matched properties,
the first at 264 USD a night (792 USD for 3 nights, all fees included) rated
9.6 from 89 reviews; property 1046285, a 1-bedroom beachfront condo in Destin,
rated 9.8 from 221 reviews with 85 photos. No host name, biography or photo is
returned. Not available: reviews, the availability calendar, dated prices on a
property (use search), results past the first 50, booking. Failed calls and
refused inputs are not charged; a not-found (an unknown property) is charged.

### [Expedia](https://scavio.dev/docs/expedia-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Expedia API for Expedia (expedia.com, Expedia Group's travel booking site) in 50 Expedia market-languages: hotel and stay search by place or region id for your dates and adults, with the large price as Expedia shows it, the nightly price, the total for the stay, the was price, Expedia's fees line, deal and scarcity badges, VIP Access and Member Price flags and the guest rating, sorted and filtered as on Expedia; one property page in full with every amenity group, fees, policies, what is nearby and FAQs; Expedia's price calendar for one property, the price Expedia shows for each day up to about 10 months ahead; and Expedia's destination suggestions with the region id search takes. See the [Expedia API page](https://scavio.dev/expedia-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_expedia` | Hotels and stays by destination or `region_id`, `check_in` and `check_out` (at most 28 nights), adults (one room), 4 sorts, star rating, amenity and guest rating filters; the top results of Expedia's first page with `matched_total` and `partial` |
| `get_expedia_property` | One property by id or path, read without dates: stars, address, rating, description, every amenity group, guest-liked lines, every fee and deposit line, policies, important information, what is nearby, FAQs and photos |
| `get_expedia_price_calendar` | The price Expedia shows for each day from today to about 10 months ahead (up to 302 days) for one property, labelled by Expedia "Lowest prices in the past 24 hours" |
| `get_expedia_suggestions` | Expedia's destination suggestions for a partial place name: cities, neighborhoods, points of interest and airports with the `region_id` search takes |

Platform key `expedia`. Credits: billed on what each call cost, `credits_used`
in the response is what was charged: 2 per call for most pages, 1 on some New
Zealand, Korea and Indonesia pages. Failed attempts and another market's page
are not charged. Answers can take up to about 4 minutes when Expedia answers
slowly: allow a client timeout of at least 250 s.

Markets (`market`, default `us`): `us`, `es-us`, `zh-us` (USD), `en-gb` (GBP),
`en-ie` (EUR), `en-ca` and `fr-ca` (CAD), `en-au` (AUD), `en-nz` (NZD), `de-de`,
`de-at`, `fr-fr`, `nl-be`, `fr-be`, `nl-nl`, `it-it`, `es-es`, `fi-fi` (EUR),
`de-ch` and `fr-ch` (CHF), `da-dk` (DKK), `sv-se` (SEK), `no-no` (NOK), `es-mx`
(MXN), `pt-br` (BRL), `es-ar` (ARS), `es-cl` (CLP), `es-co` (COP), `es-pe` (PEN),
`es-cr` (USD), `en-eg` (EGP), `ja-jp` and `en-jp` (JPY), `ko-kr` and `en-kr`
(KRW), `zh-tw` (TWD), `zh-hk`, `en-hk` and `zh-hans-hk` (HKD), `en-sg` (SGD),
`en-my` (MYR), `en-ph` (PHP), `id-id` and `en-id` (IDR), `th-th` and `en-th`
(THB), `vi-vn` (VND), `en-in` (INR), `en-ae` and `ar-ae` (AED), `ar-sa` (SAR),
each in its own language and currency. `get_expedia_property` and
`get_expedia_price_calendar` are not available in `en-gb`, `pt-br`, `zh-hk`,
`en-hk`, `zh-hans-hk`, `en-my` and `en-ph`: Expedia answers hotel pages there
with another country's site, so those markets are refused (not charged); search
and suggestions work there. Search returns the top results of Expedia's first
page: 3 on most requests (`partial: true`), up to 10 on some; no further page
can be fetched. Prices are exactly as Expedia shows them for the requested
dates. Captured 2026-11-26: Las Vegas, NV for 2027-01-20 to 2027-01-23 with 2
adults gave 10 of 24 matched properties, the first at 1297 USD for 3 nights
(326 USD nightly, was 1932) rated 8.8 from 12182 reviews; London on `en-gb`
gave 3 of 505 (`partial: true`), the first at 520 GBP for 3 nights; property
17117062 in New York had a price calendar of 241 days from 2026-11-26 to
2027-07-24, 232 of them with a price. Not available: rooms and rates on a
property page (use search for dated prices), review texts, results past
Expedia's first page, flights, cars, booking. Failed calls and refused inputs
are not charged; a not-found (an unknown property) is charged.

### [Tripadvisor](https://scavio.dev/docs/tripadvisor-locations?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `resolve_tripadvisor_location` | START HERE - resolve a place or business name to the `geo_id` / `location_id` pair |
| `search_tripadvisor` | Restaurants, hotels or attractions in a geo, TripAdvisor-ranked |
| `get_tripadvisor_location` | One location in full: rating histogram, sub-ratings, city ranking, amenities, first review page |
| `get_tripadvisor_reviews` | A page of reviews: rating, trip date and type, reviewer profile, management response |

2 credits per call. Start with `resolve_tripadvisor_location` for the `geo_id` / `location_id` pair everything else needs. Search returns 30 per page and a page past the last is a 404, not an empty result. Reviews return 15 per page for restaurants and 10 for hotels and attractions, so `category` must match the location's own type on any page past the first.

### [Yelp](https://scavio.dev/docs/yelp-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_yelp` | Businesses in Yelp's ranked order: rating, review count, price band, categories, hours |
| `get_yelp_business` | One business in full: per-star histogram, contact, hours, amenities, health inspections, Q&A |
| `get_yelp_reviews` | A page of reviews: rating, full text, author profile, photos, owner response |

2 credits per call. Yelp fixes the page size at 10. `get_yelp_business` already includes the first page of reviews at no extra cost. A review page past the last is a 404, not an empty result.

### [Zillow](https://scavio.dev/docs/zillow-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_zillow` | Listings in a region: price, beds, baths, living area, Zestimate, coordinates, days on market |
| `get_zillow_property` | Full listing: price and price history, Zestimate, tax history, RESO facts, schools, photos |
| `get_zillow_agent_reviews` | A Zillow AGENT's profile and reviews, specialties, licenses, service areas, sales counts |

1 credit per call. Only `search_zillow` paginates. `get_zillow_agent_reviews` is an AGENT profile, not a property.

### [Redfin](https://scavio.dev/docs/redfin-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_redfin` | Listings: price, price per sqft, beds, baths, living area, lot size, year built, photos |
| `get_redfin_property` | Full listing: Redfin Estimate, MLS fact sheet, price and tax history, schools, climate risk, comps |
| `get_redfin_market` | Market stats for a region: median list and sale price, sale-to-list ratio, days on market, compete score |

1 credit per call. `search_redfin` pages with `page` + `limit`, up to 350 listings per page; the other two are single-shot.

### [Realtor.com](https://scavio.dev/docs/realtor-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_realtor` | US listings for sale, pending, for rent or sold by location, radius or agent: price, beds, baths, sqft, lot, year built, garage, HOA, type, listed/sold/price-cut within N days, keywords in the listing text (all must match), new construction, foreclosure, open house; up to 200 per call |
| `get_realtor_property` | One property by id or URL: price and tax history, three value estimates with history and forecast, schools, flood/wildfire/noise risk, listing agent and office |
| `get_realtor_locations` | Autocomplete cities, counties, ZIPs, neighborhoods, schools and addresses, with the slug_id for market and the property_id for an address |
| `get_realtor_market` | Market stats for a city, county or ZIP: median list, sold and rent price, price per sqft, days on market, year-over-year and month-over-month change, by property type |
| `search_realtor_agents` | Agents by city, ZIP or name: rating, reviews, active listings and price range, homes sold last year, broker and office |
| `get_realtor_agent` | One agent's full profile with every review and four sub-ratings |

1 credit per call. `search_realtor` returns up to 200 listings per page (default 50) and
serves the first 10,000 results of a search (`page` x `page_size` <= 10,000); slice a big
area by price band, property type or radius to reach more. Sold prices are null in US
non-disclosure states (Texas, Utah, Wyoming and about nine others), while sold dates still
come back. An unknown property or agent id is a billed 404.

### [Rightmove](https://scavio.dev/docs/rightmove-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `get_rightmove_locations` | UK place, outcode, postcode or station to the `location_id` search and agents take |
| `search_rightmove` | UK property for sale or to rent: price (GBP), beds, baths, type, must-haves, exclusions, tenure, added within days, under offer, radius, furnishing, let type; 24-25 per page |
| `get_rightmove_property` | One listing in full: tenure and lease years, council tax band, service charge, ground rent, EPC, rooms, floorplans, flood risk, broadband, stations, agent |
| `get_rightmove_sold` | Sold prices for a town, outcode or postcode: 25 addresses per page, each with its sale history since 1995, plus the area's average price over the last year |
| `get_rightmove_sold_property` | One sold address: every sale with price, date, tenure, new-build flag and percent change, plus the archived last listing |
| `search_rightmove_agents` | Estate and letting agent branches for a location: phones, address, brand and company ids, profile URL |
| `get_rightmove_agent` | One branch by id or URL: address, phones, affiliations, listing counts and a teaser |

1 credit per call. Rightmove search has no keyword filter: match on the returned `summary`
and `key_features` instead. Paging caps per search: 42 pages for `search_rightmove`
(about 1,000 listings), 40 for `get_rightmove_sold`, 50 for `search_rightmove_agents`;
narrow by price band, type or a smaller area to reach more. Sold prices cover England and
Wales only (not Scotland or Northern Ireland). Live listings carry no price history, so use `get_rightmove_sold_property` for an
address's past sales. A removed listing or an unknown id is a billed 404.

### [Rent.com](https://scavio.dev/docs/rentcom-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Rent.com API for Rent.com (rent.com) and Apartment Guide (apartmentguide.com, the same rentals), the US rental listing sites run by Redfin: rentals by city and state, ZIP or neighborhood with the listed rent, rent by bed count, units available, rent specials and price drops; one rental in full with floor plans and their units, fees, pet policies, parking, amenities, office hours, lease terms, schools and walk score; the unit listings in one building; Rent.com's average rent per bed count with its year-on-year change and the monthly series it publishes; search-box suggestions; and the cities of a state.

| Tool | Description |
|------|-------------|
| `search_rentcom` | Search by city and state, ZIP or neighborhood: property type, beds, baths, monthly rent range, minimum square feet, pets, cheap / luxury, rent specials and up to 8 amenities; 6 sorts; 30 a page on rent.com, 50 on Apartment Guide (`site`); `total`, `available_units`, `pages`, `has_more` and the city's `average_rent` per bed count |
| `get_rentcom_listing` | One rental by id or link: floor plans with their units (rent, square feet, available date, deposit, floor), fees, pet policies, parking, amenities, office hours, rent specials, price drops, lease terms, income restrictions, schools, nearby places, walk score, photos and similar listings |
| `get_rentcom_building` | One building by building id or link: the separate unit listings at one address with their rents, photos and schools |
| `get_rentcom_rent_trends` | One city's current average rent per bed count (studio to 3 bedrooms) with its year-on-year change, listing count, the monthly series as Rent.com publishes it (`series_range`), the rent distribution and nearby cities and neighborhoods |
| `get_rentcom_suggestions` | Search-box suggestions for the start of a place or property name: places and listings with the ids the other tools take |
| `get_rentcom_cities` | The cities Rent.com links from a state page, A to Z, with the `city` value search and rent trends take |

Platform key `rentcom`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Answers can take up to about 10 seconds: allow up
to 4 minutes.

US only, rents in USD a month. `site` is `rent` (default) or `apartmentguide`:
Apartment Guide takes city and state (with one beds value) or zip, and page, as
its links do; every other search filter is Rent.com only (the same rentals).
Building, rent trends and cities read Rent.com. Captured 2026-11-26: 2-bed
apartments in Austin, TX by lowest price gave 1819 listings (20380 available
units) over 61 pages, the first Karnes House in West Campus from 624 USD a
month; Los Angeles, CA rent trends had 3275 listings and a series from 2024-04
to 2025-05 (13 months). The series is the one Rent.com publishes on the page and
can end well before today. No phone number, email or agent / landlord name is
returned; `management_company` is given only for listings a property manager
pays to list. Not available: rental applications or tours, price history
beyond the listed price drops, sold or for-sale homes. Failed calls and refused
inputs are not charged; a not-found (an unknown city, ZIP, neighborhood,
listing or building) is charged, and a page past the last one is an empty page
with a note (charged).

### [Trulia](https://scavio.dev/docs/trulia-neighborhood?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Trulia API for Trulia (trulia.com, Zillow Group's home and neighborhood site): one neighborhood with Trulia's "What Locals Say" survey results and safety statements, resident reviews, homes for sale and for rent with their price ranges, the commute, amenities, schools with GreatSchools ratings and Trulia's market snapshot; homes for sale, for rent or recently sold in a ZIP, city or neighborhood; one home or rental building in full with Zestimate, price and tax history, payment estimate, floor plans and fees; one school with its ratings and parent reviews; and place suggestions.

| Tool | Description |
|------|-------------|
| `get_trulia_neighborhood` | One neighborhood by location id or link: survey results and safety statements with percentages, resident reviews (up to 40 shown, totals cover all), facts, amenities, schools, outline, nearby neighborhoods, homes for sale and (default on) Trulia's market snapshot and median sale price history with their scope; `language` en or es |
| `search_trulia` | Homes for sale, for rent or recently sold in a ZIP, "City, ST" or "Neighborhood, City, ST": beds, baths, price, sqft and year-built ranges, HOA max, property types, keyword, pets (rentals), 7 sorts, 40 a page up to page 50; es on rental searches |
| `get_trulia_property` | One home by zpid or link, or one rental building by building_id or link: price, Zestimate and Rent Zestimate as Trulia shows them, home value and price history, taxes, features, payment estimate, the neighborhood's location id, and for buildings floor plans with units, fees, pet policy and special offers; es on buildings |
| `get_trulia_school` | One school by link, or school id and state: GreatSchools ratings, ratios, parent rating and reviews (no names), nearby schools and assigned homes |
| `get_trulia_suggestions` | Place and school suggestions with the `search_location`, location id and zpid the other tools take |

Platform key `trulia`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Answers can take up to about 15 seconds (a
neighborhood with its market snapshot): allow up to 4 minutes.

US only, prices in USD (monthly rent on rentals). Spanish (`language: es`) is
where Trulia publishes it: rental searches, buildings and neighborhoods; school
pages and suggestions are English. Survey results, safety statements and market
figures are Trulia's, as Trulia gives them; the market snapshot's `scope` says
whether it is the neighborhood's or the city's. Captured 2026-11-26: Upper East
Side, New York (location_id 85381) had 1480 survey responses, 94% saying it is
walkable to grocery stores, 277 resident reviews, 1885 homes for sale and an
October 2026 average sale price of $1.47M with a 98.2% sale-to-list ratio; homes
for sale in Austin, TX gave 2146 over 54 pages. No listing-agent names, phones,
emails or license numbers and no reviewer names are returned; brokerage company
names are. Not available: crime data (no longer on Trulia), agent profiles,
more than 50 pages of one search. Failed calls and refused inputs are not
charged; a not-found (an unknown zpid, building, neighborhood or school) is
charged.

### [StreetEasy](https://scavio.dev/docs/streeteasy-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

StreetEasy API for StreetEasy (streeteasy.com, Zillow Group's New York City real estate site, covering NYC's five boroughs and North New Jersey): homes for sale, rentals and past sales in any borough, neighborhood or North NJ city with StreetEasy's own filters and sorts, net effective rent and months free on rentals, one listing in full with its price changes, monthly charges, move-in fees and the unit's past listings, one building with its developer, policies, NYC building class and per-bedroom inventory, the building directory of an area, and the monthly market data StreetEasy publishes for New York City. StreetEasy publishes no public API for its listings. See the [StreetEasy API page](https://scavio.dev/streeteasy-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_streeteasy` | Homes for sale, rentals or past sales in an area (borough, neighborhood, NJ city or `nyc`): price, bedrooms, bathrooms, size, home type, sale type, year built, 24 amenity filters, pets, ZIP, by owner (rent), in contract (sale); 7 sorts, up to 100 pages; each card with its placement (organic, featured, sponsored), price, net effective rent, months free and the brokerage |
| `get_streeteasy_listing` | One listing by link, or by id with `listing_type` (sale or rent): price changes, monthly maintenance, taxes and common charges, estimated monthly payment, net effective rent, move-in and monthly fees, days on market, the unit's past listings and events, open houses, floor plans and StreetEasy's recent-listing prices for that bedroom count in the area |
| `get_streeteasy_building` | One building by slug or link: year built, floors, units, amenities, policies, developer, architect, manager, the deed owner when a business, NYC building class and districts, per-bedroom available and past listing counts with min / max price, its listed units, schools, transit and similar buildings |
| `get_streeteasy_buildings` | The building directory of an area, about 11 a page, optionally condo, coop or rental only: active sales and rentals, units, floors, year built, with the slug `get_streeteasy_building` takes |
| `get_streeteasy_market` | StreetEasy's published monthly NYC market data from 2010-01: sales (price index, inventory, sale-to-list ratio, recorded sales, median sale and asking price, days on market, share of price cuts) by home type, rentals (rental index, inventory, median asking rent, share of rent cuts) by bedrooms, for one area or every published area |

Platform key `streeteasy`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Answers can take up to about 40 seconds (a
search page): allow up to 4 minutes.

NYC's five boroughs and North New Jersey, prices in USD (rent per month on
rentals). Featured and sponsored cards come ahead of the organic results; the
sort orders the organic ones. `get_streeteasy_listing` by id needs
`listing_type` (sale for for-sale and sold listings, rent for rentals).
Captured 2026-11-26: rentals in Jersey City gave 2927 listings; a one-bedroom
at 99 Provost Street, Jersey City, was 4730 USD a month with a net effective
rent of 4336 USD (2 months free on a 24-month lease), where one-bedroom
rentals in the area had a median of 3865 USD across 381 listings; the median
sale price in Williamsburg was 1450000 USD in 2026-10. Market data covers New
York City only (New Jersey areas have no published series and are refused).
No agent or private landlord names, emails, phones or photos are returned; the
brokerage is. Not available: agent profiles, reviews (StreetEasy has none),
search suggestions, the Hamptons. Failed calls and refused inputs are not
charged; a not-found (an unknown listing, building or an area without a
published series) is charged.

### [RentCafe](https://scavio.dev/docs/rentcafe-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

RentCafe API for RentCafe (rentcafe.com, Yardi's US and Canada rental listing site): rental search in any US or Canadian city, ZIP code, neighborhood or state with RentCafe's filters and sorts, rents in USD or CAD, English or French pages; one listing in full with every floor plan, its fees and pet policy, amenities, category ratings and RentCafe's own renters summary; every unit of a floor plan with its base rent and move-in date; resident reviews; location and property suggestions; and the rent trends RentCafe publishes for US cities. See the [RentCafe API page](https://scavio.dev/rentcafe-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_rentcafe` | Apartments, houses, condos or townhomes by location, city + state or ZIP + state; ONE of beds, rent specials, short-term, furnished, utilities included or one of 19 amenities per search, plus price range and pet-friendly; 5 sorts, 25 a page, `pages` and `has_more` |
| `get_rentcafe_property` | One listing by link or slug: rent range, floor plans with their units and rents, policies (deposit, application and pet fees, pet policy), amenities, services, rating, category ratings, RentCafe's renters summary, reviews (no reviewer names), office hours, leasing office phone, management company |
| `get_rentcafe_floorplan_units` | Every unit of one floor plan (the property page shows up to 2): base rent, availability (Now or a date), size, specials, photos; `selected_unit` with `unit_id` |
| `get_rentcafe_reviews` | Resident reviews, 10 a page in RentCafe's order: rating, resident type, date, text; no reviewer names, no sort or star filter |
| `get_rentcafe_suggestions` | Places (with the `location` search takes) and properties (with the `property_id` reviews and floor plan units take) for a city, neighborhood, ZIP or property name |
| `get_rentcafe_rent_trends` | A US city's rent trends as RentCafe publishes them: average rent now and a year earlier, by bedroom type, budget shares, renter households, the most affordable and most expensive neighborhoods, compared cities |

Platform key `rentcafe`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Answers can take up to about 25 seconds:
allow up to 4 minutes.

Markets (`market`): `us` (USD) and `ca` (CAD), read from the location's state
or province when left out; `language` `fr` returns RentCafe's French pages
(French labels over the same listings, prices still in the market's currency).
RentCafe filters one of beds, rent specials, short-term, furnished, utilities
included or an amenity per search; a second one is refused with a 400, not
charged (price range, pet-friendly and sort combine with any). RentCafe pages
through about 15-20 pages of 25 at most: narrow with filters for more.
Captured 2026-11-26: 2-bedroom apartments in austin-tx gave 4228 listings;
toronto-on 8559 in CAD; Bridge At Indigo in Austin rents 1130 to 2880 USD
across 9 floor plans, rated 4 from 39 reviews; Austin, TX averaged 1643 USD on
the rent trends page (1664 a year earlier). Rent trends are US only (RentCafe
has no Canada rent trends pages); a city without one is a 404, not charged.
Reviews carry no reviewer names. Not available: tours, contact or application
forms, price alerts, price history (poll and store the answers). Failed calls
and refused inputs are not charged; a not-found (an unknown location, listing,
property id or floor plan) is charged.

### [Movoto](https://scavio.dev/docs/movoto-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Movoto API for Movoto (movoto.com, the US home search site owned by Lower): homes for sale, sold homes and rentals in any US city, ZIP code, county, neighborhood or school zone with Movoto's filters and 8 sorts, plus the area's market summary and snapshot; one home in full with price and tax history, features, schools with GreatSchools ratings, local scores, nearby homes and Movoto's area-based estimate; the market trends Movoto publishes for a city or ZIP code; place suggestions; and one school with its ratings, test scores and the homes zoned for it. See the [Movoto API page](https://scavio.dev/movoto-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_movoto` | Homes for sale, sold or rentals by city + state, ZIP, county + state, neighborhood + city + state or school zone; property types, bed, bath, price, size, lot, year-built, HOA and days-on-market ranges, garage, pool, sold window and for-sale flags (hide pending, open houses, price reduced, new listings, new construction, foreclosures), 8 sorts, 50 a page up to 99 pages; market summary, market snapshot and facet counts |
| `get_movoto_property` | One home by link or path: the card fields plus description, features, price history, tax history, Movoto's area-based estimate, key insights, schools, school districts, area trends, local scores, nearby sold / for-sale / new-construction / rental homes and photos |
| `get_movoto_market_trends` | The market trends Movoto publishes for a city or ZIP code: median list price, price per sqft, days on market, home size and inventory for today, one month ago and one year ago, by type, nearby places compared, and for ZIP codes Movoto's daily statistics |
| `get_movoto_suggestions` | Movoto's place suggestions (city, ZIP code, neighborhood, county, school) with listing counts and the search input for each |
| `get_movoto_school` | One school by link or path: GreatSchools rating, state rating, teacher-student ratio, test scores by grade and subject, district, the homes zoned for it and the search input for all of them, nearby schools |

Platform key `movoto`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Allow up to 4 minutes per answer.

US only, prices in USD (monthly rent on rentals). `sold_price` is null where
the sale price is not public (non-disclosure states such as Texas). The
`estimate` is Movoto's area-based estimate (the area's price per square foot
times the home's size), not an appraisal, and is not given for rentals.
Market trends cover today, one month ago and one year ago: Movoto publishes no
monthly series. Captured 2026-11-26: homes for sale in Austin, TX gave 5885
over 99 pages; 12901 Sherbourne St, Austin, TX 78729, a 4-bed single-family
home, was for sale at 649029 USD with a Movoto area-based estimate of 542780
USD; Los Angeles, CA had a median list price of 1049000 USD, down 4.6% year
over year, with 5037 active listings. No listing-agent names, phones, emails
or license numbers are returned; brokerage company names are. Not available:
street-address suggestions, parent school reviews, a monthly market series,
more than 99 pages of one search. Failed calls and refused inputs are not
charged; a not-found (an unknown place, listing or school) is charged, and a
page past the last one is an empty page with a note (charged).

### [HotPads](https://scavio.dev/docs/hotpads-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

HotPads API for HotPads (hotpads.com, Zillow Group's rental search site): apartments, houses, condos, townhomes, rooms, sublets and for-rent-by-owner listings in any US city, neighborhood, borough or ZIP code with HotPads' filters and sorts; one listing in full with floor plans and their units, pet policies, amenities, popularity and HotPads' comparison with area averages; the rent history HotPads publishes for a listing; the costs and fees the property manager lists; and location suggestions. See the [HotPads API page](https://scavio.dev/hotpads-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_hotpads` | Rentals in a US area (a suggestions `resource_id` or a place such as Austin, TX) by type, beds (exact or minimum), baths, rent, sqft, dogs or cats, in-unit laundry, parking or furnished and keywords, 4 sorts, 40 buildings a page; total units and buildings, lowest rent, the filters HotPads applied |
| `get_hotpads_listing` | One listing by link or building id: rent range, unit counts, price drops, description, lease terms, office hours, special offers, amenities, pet policies, floor plans with units, total monthly price, popularity, area comparison, schools, similar listings, photos and the price-history inputs |
| `get_hotpads_price_history` | The rent history HotPads publishes for a listing (listed for rent, price changed, listing removed) with price, price per sqft, change percent and source |
| `get_hotpads_fees` | The costs and fees the property manager lists: move-in and monthly totals, base rent, required and optional fees, usage fees |
| `get_hotpads_suggestions` | HotPads' location suggestions: areas with the `resource_id` search takes, and listings with the id the listing tool takes |

Platform key `hotpads`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Allow up to 4 minutes per answer.

US only (including DC and Puerto Rico), rents in USD a month; HotPads Canada
is not offered. `beds` is an exact count (0 is a studio) and `beds_min` a
minimum: send one. HotPads takes one pet type and one amenity per search. A
listing's rent history is available when its `price_history` is set (pass its
`listing_alias` and `model_id`). Captured 2026-11-26: for-rent-by-owner
listings in dallas-tx gave 775 units in 600 buildings over 15 pages, from 750
USD a month; Lincoln at Bankside in the Bronx, NY had 350 units across 54
floor plans at 2687 to 5667 USD a month; listing alias 5759ydyqtn49h had 22
rent-history events, the latest a price change to 2450 USD (down 18.3%).
Landlord and agent names, phones and emails are not returned;
`company_name` is given for property-managed listings. Not available:
applications, tours, contacting a landlord, homes for sale. Failed calls and
refused inputs are not charged; a not-found (an unknown area, listing, alias
or model id) is charged, and a page past the last one is an empty page with a
note.

### [Apartment List](https://scavio.dev/docs/apartmentlist-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Apartment List API for Apartment List (apartmentlist.com, the US rental search site): rentals in any US city, neighborhood or ZIP code with the rent range, rent by bed count, floor plans and their units with base and total price, units available and rent specials; one listing in full with fees, pet policies, parking, income and screening requirements, lease terms, office hours and its resident review summary; average rents by bed count with a listings summary and price histogram; the monthly rent report Apartment List publishes for a city; resident-review summaries for every listing in a city; and location suggestions. See the [Apartment List API page](https://scavio.dev/apartmentlist-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_apartmentlist` | Rentals in a city, neighborhood or ZIP code (a place slug, city with state, or ZIP), 20 a page up to page 250: beds, baths, rent range, move-in date, up to 10 amenities, occupancy types and 4 sorts (city or ZIP code only); `total_listings`, `total_units`, `pages`, listings with floor plans and units, and the place's rent summary |
| `get_apartmentlist_listing` | One listing by link or slug: floor plans with every unit's price, base price, total price and required fees, specials, fees, pet policies, parking, requirements, lease terms, amenities, office hours, phone (apartment communities only), review summary and the reviews the page shows |
| `get_apartmentlist_rent_report` | Apartment List's monthly rent report for a US city as it publishes it: median 1- and 2-bedroom rent, monthly and yearly growth, the 12-month trend for the city, state and nation, year-to-date growth and the metro table |
| `get_apartmentlist_market_summary` | Average rent by bed count and a listings summary (average and median price and size, property and unit counts, amenity shares, price histogram) for a place, optionally for some bed counts and amenities |
| `get_apartmentlist_review_summaries` | Resident-review summaries for every listing with reviews in a city, most reviewed first: ratings, rating count, best and worst rating and a snippet |
| `get_apartmentlist_suggestions` | Apartment List's location suggestions with the slugs the other tools take |

Platform key `apartmentlist`. Credits: 1 per call on every tool; `credits_used`
in the response is what was charged. Searches without filters answer fast;
filtered or sorted searches can take up to about 2 minutes: allow up to 4
minutes.

US only, rents in USD a month. Search takes one of `location` (a suggestions
slug: city, neighborhood or ZIP code), `city` with `state`, or `zip`. Filters
and sort apply to city and ZIP code searches; a neighborhood is listed in full,
in Apartment List's map order. A ZIP code is read under its city: the answer is
the city's listings inside the ZIP code's bounding box, and the summary is the
city's. Captured 2026-11-26: Austin, TX gave 2197 listings and 20223 units over
110 pages; 1-bedroom rentals in Chicago up to 2000 USD by lowest price gave 442
listings over 23 pages, the first from 660 USD a month; The Asher in Austin, TX
78717 had 377 units, 32 floor plans and 40 available units, from 1381 USD for 1
bedroom; Chicago's rent report had a median rent of 1723 USD for 1 bedroom and
1875 USD for 2, +3.37% on the year. The rent report is Apartment List's own rent
estimates as its monthly report publishes them (growth as a fraction). No
reviewer names are returned. Not available: tours or applications, price
history beyond the rent report, homes for sale. Failed calls and refused inputs
are not charged; a not-found (an unknown place, listing or a city without a rent
report) is charged.

### [Compass](https://scavio.dev/docs/compass-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Compass API for Compass (compass.com, the US real estate brokerage): homes for sale, rentals and homes sold in the last 90 days in any US city, ZIP code, neighborhood, county or school area, with price, beds, baths, size, status, the listing brand and open houses; one listing in full with pricing, dates, days on market, listing and sale history, details, schools, building, rental terms and tax; and Compass's search box suggestions with the area slugs search takes. See the [Compass API page](https://scavio.dev/compass-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_compass` | For sale, for rent or sold (last 90 days) in a Compass area slug; highest price, fewest beds, baths and sqft, property type, open house this weekend, coming soon, 3 sorts, 41 a page up to 9 pages; `total`, `reachable` (at most 369), the criteria as Compass applied them, nearby areas |
| `get_compass_listing` | One listing by link or id: pricing (listed, last asking, sold, price per sqft, monthly charges), dates, days on market, history with public-record sales, details, amenities, schools, building, rental terms, tax, parcel number, photos, brand and source MLS |
| `get_compass_suggestions` | Compass's search box suggestions: areas with the slug search takes, and listings with the id the listing tool takes (agent suggestions left out) |

Platform key `compass`. Credits: 2 per call on every tool; `credits_used` in
the response is what was charged. Allow up to 4 minutes per answer.

US only, prices in USD (monthly rent on rentals). Compass pages through the
first 369 results of a search (9 pages of 41): `total` is Compass's count and
`reachable` what can be paged, so narrow the search to reach more. Compass
does not apply a minimum price, a maximum bedroom count, year built or lot
size on its search pages, so those filters are refused. Captured 2026-11-26:
homes for sale in manhattan-ny up to 2000000 USD with 2 or more bedrooms gave
1219 (369 reachable); 77 Bleecker Street, Unit 121, Manhattan, NY 10012, a
2-bed, 2-bath home, was for sale at 1875000 USD after 24 days on market;
single-family homes sold in austin-tx in the last 90 days gave 1857. No agent
names, emails, phones, license numbers or photos are returned; the listing
brand (Compass, Corcoran, Coldwell Banker, Sotheby's International Realty) is.
Not available: agent profiles, results past the first 369 of a search, a
minimum price or maximum bedroom filter. Failed calls and refused inputs are
not charged; a not-found (an unknown area or listing) is charged.

### [AffordableHousing.com](https://scavio.dev/docs/affordablehousing-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

AffordableHousing.com API for AffordableHousing.com (affordablehousing.com, the US affordable and Section 8 rental site run by Affordable Housing Network): affordable and Section 8 rentals in any US state, city, county or ZIP code with the rent range, beds, Section 8 badge, income-restricted and government-listing flags; one listing in full with its models and units, fees, the utilities split between tenant and owner, amenities and accessibility; open Section 8 and public housing waiting lists nationwide or per state; one housing authority with its waiting list status, voucher count, programs, jurisdiction and public office contact; the housing authorities of a state; and place suggestions. See the [AffordableHousing.com API page](https://scavio.dev/affordablehousing-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_affordablehousing` | Affordable and Section 8 rentals in a state (required), city, county or ZIP code (with its city), 42 a page up to page 500: beds, baths, property type, rent range, pet friendly, Section 8, utilities included, age restricted, accessibility, 9 sorts; premium and spotlight listings first, the sort within each tier |
| `get_affordablehousing_listing` | One listing by link or id: rent range, models with their units and availability, subsidized units, fees (move-in, monthly and one-time totals, application and pet fees), utilities split, amenities, accessibility, photos and the business owner where marked |
| `get_affordablehousing_suggestions` | Place suggestions for a city, county or ZIP code with the inputs search takes |
| `get_affordablehousing_waiting_lists` | Open Section 8 and public housing waiting lists, nationwide or for one state, with program, agency, online application, status and the date opened |
| `get_affordablehousing_housing_authority` | One housing authority by link, or id with state: the agency's public office phone, fax and website, waiting list status and dates, voucher count, Section 8 inventory, programs, jurisdiction and its waiting lists |
| `get_affordablehousing_housing_authorities` | The housing authorities of a state as its state page lists them (the state's count and the first 14) |

Platform key `affordablehousing`. Credits: 2 per call on
`search_affordablehousing` and `get_affordablehousing_suggestions`, 1 on the
other four tools; `credits_used` in the response is what was charged. Allow up
to 4 minutes per answer.

US only, rents in USD a month, English. A ZIP code is searched within its city:
send `zip` with `city` and `state`; send `city` or `county`, not both, or
neither for the whole state. `section8_accepted` is the listing's badge for an
owner with experience with the Section 8 / Housing Choice Voucher program.
Captured 2026-11-26: Section 8 listings in Houston, TX gave 1183 over 29 pages,
the first a 1-bedroom apartment at 1000 USD a month; 753 waiting lists were open
nationwide, 50 in Texas; Somerville Housing Authority, Somerville, MA had its
waiting list open, 1193 vouchers and 12 waiting lists; Texas had 346 housing
authorities. Private landlords are never named and their contact details are
never returned; phone numbers and email addresses are cut out of listing text.
A housing authority's phone, fax and website are the agency's public office
contact; no staff contact details are returned. Not available: payment standard
or fair market rent numbers (the site explains them in text only), applications,
waiting list sign-up. Failed calls and refused inputs are not charged; a
not-found (an unknown listing or housing authority) is charged.

### [Lennar](https://scavio.dev/docs/lennar-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Lennar API for Lennar (lennar.com, the US homebuilder): new homes and communities in any Lennar market, state, city, point or map box with the price, the was price, beds, baths, square feet, homesite availability (quick move-in, under construction, coming soon, future release) and offer flags; one community in full with its plans, homesites, HOA fee, tax rate and sales center hours; one floor plan with its included features; one homesite with its closing cost incentive and estimated move-in date; master-planned communities; every market with its cities, feature codes and school districts; the market-wide promotion Lennar runs, offers and legal copy as shown; Lennar's payment calculator for a homesite; place suggestions and a link resolver. Built for new-home price tracking, incentive monitoring and market comparisons. See the [Lennar API page](https://scavio.dev/lennar-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_lennar` | Homes (homesites and floor plans) or communities (communities and master-planned communities) by market code, state, city, text, latitude + longitude with a radius, or a map box; beds, baths, price and square-foot filters, home types, community types, homesite availability, community status, feature codes and school filters; 7 sorts; 1-200 a page; `totals` for communities, plans and homesites |
| `get_lennar_community` | One community by community number: price range, homesite count, HOA fee, development fee, tax rate, deposit, sales center hours and office phone, schools, amenities, and every plan with its homesites |
| `get_lennar_plan` | One floor plan by community number + plan number: starting price and was price, beds, baths, square feet, garages, tour links, floor plan images, included features by category, its homesites |
| `get_lennar_home` | One homesite by lot id: price, was price, closing cost incentive and disclaimer, estimated move-in date, offer and its end date, estimated monthly payment, the plan and the community's HOA fee and tax rate |
| `get_lennar_master_planned` | One master-planned community by id with its communities, base prices and homesite counts |
| `get_lennar_markets` | Every state and metro market Lennar builds in (104 in 32 states, captured 2026-11-26) with the market codes the other tools take |
| `get_lennar_market` | One market by code: cities, the feature codes and school districts search filters on, phone and promotion link |
| `get_lennar_suggestions` | Lennar's place, community and plan suggestions for a few letters, each with the search input it stands for |
| `resolve_lennar_url` | What a lennar.com link or path is (community, plan, home or master-planned community) and its ids |
| `get_lennar_promotions` | The market-wide promotion for a market: offers, incentives and legal copy exactly as Lennar shows them, and the homesites it lists; null when none runs |
| `get_lennar_payment` | Lennar's payment calculator for a homesite with a down payment and an interest rate (a decimal): principal and interest, property tax, insurance, mortgage insurance, HOA and development fees |

Platform key `lennar`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. Answers usually arrive within about 15 seconds:
allow up to 4 minutes.

US only, prices in USD. Search needs a place (market code, state, city, text,
latitude + longitude, or a map box); `get_lennar_suggestions` returns each
place's search input and `get_lennar_market` the feature and school district
codes the filters take. `is_fallback` says Lennar had no exact match and shows
its fallback results. Captured 2026-11-26: homes in the Dallas / Ft. Worth
market (DAL) by lowest price gave 890 homesites (60 communities, 372 plans), the
first a move-in ready 1-bed, 661 sqft homesite in Princeton at 117499 USD;
Kresston in Montgomery, TX (comnum 22704) started at 339990 USD with 48
homesites across 7 plans, and its Melrose II homesite 22704535134 was 384990
USD, was 424990; Dallas / Ft. Worth ran "Black Friday Deals!" with an offer of
up to a $20,000 price reduction. Payment estimates are Lennar's calculator's
(Lennar Mortgage, LLC), not a quote. No sales consultant names are returned;
the sales office phone is Lennar's public business number. Not available:
price history (poll and store the answers), reservations or contact forms.
Failed calls and refused inputs are not charged; a not-found (an unknown
community, plan, homesite, master-planned community, market or link) is
charged.

### [Extra Space Storage](https://scavio.dev/docs/extraspace-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Extra Space Storage API for Extra Space Storage (extraspace.com, the US self-storage REIT): self-storage facilities near any US ZIP code, city, place or point with each facility's Starting at prices by size class, promotion, rating and the units its card highlights; one facility in full with every unit class, its in-store price and web rate, availability, features and promotions, plus Extra Space's own price stats per size; the Google reviews shown on a facility page, sorted, filtered by stars and paged; a US city's storage prices as Extra Space's city page gives them; and the cities Extra Space lists. See the [Extra Space Storage API page](https://scavio.dev/extraspace-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_extraspace` | Facilities near a ZIP code, "City, ST", place or point: up to 120, nearest first, filtered by climate control, drive-up, indoor, RV parking, enclosed vehicle storage, 24-hour access and unit sizes, sorted by distance or Starting at price; `did_you_mean` for an ambiguous place |
| `get_extraspace_facility` | One facility by id or link: hours, phones, rating, promotion, Starting at prices, price stats per category with historical values, and units with size, features, available count, promotions, in-store price and web rate (`include_unavailable` adds classes with nothing to rent now) |
| `get_extraspace_reviews` | The Google reviews shown on a facility page: 4 sorts, a star filter, up to 100 a page, the histogram and Extra Space's replies; no reviewer names |
| `get_extraspace_city_prices` | A US city's storage prices from Extra Space's city page: its own price sentences, price stats per size with store counts, and the city's facilities |
| `get_extraspace_locations` | The US cities Extra Space lists (about 1,700 in 44 states and DC), by state or name prefix, with the city and state `get_extraspace_city_prices` takes |

Platform key `extraspace`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. A facility answers within about 40 seconds;
city pages are large and can take up to about 3 minutes: allow up to 4 minutes.

US only, prices monthly in USD and labelled as the facility pages label them:
`in_store_price` (IN STORE) and `web_rate` (WEB RATE); a price Extra Space does
not give is null. Search lists up to 120 facilities near a place, nearest
first, with no further pages; filters and the price sort apply over that list.
The store number in a facility's name is not its `store_id`. Captured
2026-11-26: ZIP 90012 gave 120 facilities, the nearest 0.44 miles away starting
at 69 USD a month, rated 4.8 from 524 reviews; facility 1934 in Knoxville, TN
had 14 of 43 unit classes available, a 10' x 15' climate-controlled indoor unit
at 98 USD web rate against 172 in store, and 485 reviews; Extra Space's Dallas,
TX city page said 105 facilities near Dallas had 5' x 5' units starting at $7
and averaging $24 a month. No reviewer name is returned (Extra Space's replies
read [name] where they name one). Not available: reservations or rentals,
price history (poll and store the answers). Failed calls and refused
inputs are not charged; a not-found (an unknown facility, a place with no
match or a city without a page) is charged.

### [Public Storage](https://scavio.dev/docs/publicstorage-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Public Storage API for Public Storage (publicstorage.com, the largest US self-storage operator, now also in Canada): self-storage facilities near a US ZIP code, a Canadian postal code, a city or an address with each facility's distance, today's hours, starting price, features and its unit sizes with the In-Store Rent, the Online price, the promotion and the move-in cost; one facility in full with every unit price, hours, amenities and rating; and every customer review Public Storage shows for a US facility. See the [Public Storage API page](https://scavio.dev/publicstorage-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_publicstorage` | Facilities near a ZIP or postal code, a city or an address (or a search slug for page 2 and later), US or Canada, English or French: 3 sorts, filters (climate controlled, drive-up, 24/7 access, business, vehicle, RV or boat storage, a unit size), 9-19 facilities a page with their units and prices |
| `get_publicstorage_facility` | One facility by store id or link: phone, address, market area, rating and review count (US), office, access and rental support hours, amenities, payments accepted and every unit with In-Store Rent, Online price, promotion, move-in cost, admin fee and lock charge |
| `get_publicstorage_reviews` | Every customer review shown for one US facility, newest first, optionally one star rating: rating, date, source and text; no reviewer names |

Platform key `publicstorage`. Credits: 1 per call on every tool; `credits_used`
in the response is what was charged. Allow up to 4 minutes per answer.

Markets (`market`): `us` (default, USD, miles) and `ca` (Public Storage Canada,
CAD, km); `language` `fr` returns Public Storage Canada's French pages (the US
site is English only). Prices are the page's own per unit (In-Store Rent and
Online price); promotions are Public Storage's as given and can vary between
visits. A ZIP search pages through the slug page 1 returns; a city or a Canadian
place lists every facility on page 1. Captured 2026-11-26: ZIP 75201 by lowest
price gave 10 facilities on page 1 of 2, the first 0.5 miles away from 32 USD,
its 5'x5' unit at an In-Store Rent of 32 USD and an Online price of 16 USD (50%
off for 4 months); Toronto, ON gave 18 facilities, the first 3.3 km away from
106 CAD; store 2044 in Dallas was rated 4.7 from 422 reviews with 20 unit types;
store 2223 had 819 five-star reviews. Public Storage does not publish occupancy:
`units_left` is set only where the page says so. No reviewer names are
returned. Not available: reviews for Canadian facilities (their pages show
none), a review sort, reservations or move-in. Failed calls and refused inputs
are not charged; a not-found (an unknown place or store id) is charged.

### [U-Haul](https://scavio.dev/docs/uhaul-truck-quote?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

U-Haul API for U-Haul (uhaul.com, the US and Canada truck rental and self-storage company), US (USD, miles) and Canada (CAD, km), in English, Spanish (es.uhaul.com) or French (fr.uhaul.com): U-Haul's own truck rental rates for a one-way or in-town move on a given day, read from its public quote form, with availability, the days and distance a one-way rate includes, per-mile or per-km rates and the truck + labor estimate; locations near a place for truck rentals, trailer rentals, moving supplies or self-storage; one location with hours, payment and, in Canada, its own rate card; self-storage facilities near a place with starting rates and features, and one facility with every unit type, monthly rate and vacant units; U-Haul's own customer reviews of a location; place suggestions; and moving supplies prices by category or product. See the [U-Haul API page](https://scavio.dev/uhaul-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `get_uhaul_truck_quote` | Truck rates for one move (pickup, optional drop-off, date up to 330 days ahead): every truck with rate, availability, per-distance rate and dimensions, plus the truck + labor estimate. A price quote, never a reservation |
| `search_uhaul_locations` | Locations near a city, ZIP or postal code for truck rentals, trailer rentals, moving supplies or self-storage, 6 a page where U-Haul pages, with hours, services and distance |
| `get_uhaul_location` | One location by id or link: address, phone, hours, payment accepted, rating, and the Canadian rate card (day and per-km rates, daily / weekly / monthly plans) |
| `search_uhaul_storage` | Up to 18 self-storage facilities near a place, sorted by distance, starting rate or rating and filtered by features (climate control, indoor, drive up, portable, Rent Now, vehicle) |
| `get_uhaul_storage_facility` | One storage facility in full: every unit type with size, monthly rate, Rent Now or reserve, vacant units, promotions and hours |
| `get_uhaul_reviews` | U-Haul's own customer reviews of a location or facility, filtered by service (trucks, storage, U-Box) and stars, sorted and paged (no reviewer names) |
| `get_uhaul_suggestions` | U-Haul's place suggestions for the start of a city, ZIP or postal code: the values pickup, dropoff and near take |
| `get_uhaul_supplies` | Moving supplies prices by category or product link, USD or CAD: as-low-as bundle prices, single-item price and bundle detail |

Platform key `uhaul`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged. `get_uhaul_truck_quote` takes about 25 seconds:
allow a client timeout of at least 120 s.

The market follows the place: a US place answers in USD and miles, a Canadian
one in CAD and km (Canadian quotes also carry rate_with_fees as U-Haul shows
it). One-way rates are U-Haul's total for the truck on that route and date;
in-town rates are a base rate plus the per-mile or per-km rate. A quote is a
price, never a reservation: nothing is reserved and no pickup location is
returned, because U-Haul chooses it in its reservation step after a truck is
picked. Trailer, towing and U-Box quotes are not covered. US dealer pages list
'from' prices (listed_from_prices) that are not quotes. Captured 2026-11-27:
Dallas, TX to Austin, TX on 2026-12-11 included 2 days and 229 miles, 4 of 6
trucks available, the 10' Truck at 212 USD; an in-town Chicago quote listed the
8' Pickup Truck at 19.95 USD plus 1.59 USD a mile; Montreal, QC to Quebec City,
QC on fr.uhaul.com included 2 days and 306 km, the 10-foot truck at 395 CAD;
storage near Phoenix, AZ 85004 listed 18 facilities from 50 USD a month;
facility 741065 in Dallas held 43 unit types with 139 vacant units; the Medium
Moving Box was as low as 1.99 USD (3.21 CAD in Canada). Not available: trailer
and U-Box quotes, reservations, pickup locations on quotes, price history (poll
and store the answers). Failed calls and refused inputs are not charged; a
not-found (a move U-Haul will not quote, an unknown place, id, category or
product) is charged.

### [Indeed](https://scavio.dev/docs/indeed-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_indeed_jobs` | Job postings: title, employer, rating, location, salary range, job type, apply route |
| `get_indeed_job` | One posting in full: description text and HTML, structured salary, benefits, original ATS link |
| `get_indeed_company` | Employer profile: industry, HQ, size, revenue, CEO approval, per-category ratings, open roles |
| `get_indeed_company_reviews` | Employee reviews with per-category ratings, pros/cons, reviewer job title and location |

2 credits per call. Job search returns 10 postings per page, company reviews 20 per page. `get_indeed_job` and `get_indeed_company` are single-shot.

### [Glassdoor](https://scavio.dev/docs/glassdoor-companies?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `resolve_glassdoor_company` | START HERE - resolve a company name to the `employer_id` the other tools need |
| `get_glassdoor_company` | Employer profile: ratings, star distribution, CEO approval, size and revenue bands, awards |
| `get_glassdoor_reviews` | Up to three full reviews with per-axis scores and employer response, plus complete rating statistics |
| `get_glassdoor_salaries` | Salaries by job title: base-pay and total-pay percentiles P10-P90, sample counts, pay period |

2 credits per call. Start with `resolve_glassdoor_company` for the `employer_id`. Only `get_glassdoor_salaries` paginates (10 job titles per page; `page_count` is how many exist). `get_glassdoor_reviews` returns up to three full reviews plus complete rating statistics - it is not a paginated review feed.

### [Apple App Store](https://scavio.dev/docs/app-store-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_app_store` | Up to 200 fully-shaped apps - doubles as a bulk metadata fetch and a publisher lookup |
| `get_app_store_app` | Full listing: developer identity, price, all-time and current-version ratings, release notes, screenshots |
| `get_app_store_reviews` | A page of reviews: star rating, title, full text, author, and the app version reviewed |

1 credit per call. Reviews page 1-10 at 50 per page and stop hard at page 10: 500 reviews per storefront is Apple's anonymous ceiling, and you reach further by asking a different `country`. Search and app detail do not paginate.

### [Google Play](https://scavio.dev/docs/google-play-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_google_play` | Ranked apps: package name, developer, rating, install count, price and IAP range, screenshots |
| `get_google_play_app` | Full store listing: the real install count, star histogram, IAPs, permissions, Data safety table |
| `get_google_play_reviews` | A page of reviews: star score, full text, thumbs-up count, developer reply, app version |

2 credits per call - a separate namespace from `google` and not on the Google-exempt price. Reviews are cursor-paginated, and the cursor is opaque, single-use and encodes the sort as well as the position, so send it back with the same `sort` it came from. A cursor past the last review is a 404. Search and app detail do not paginate.

### [G2 Software Reviews](https://scavio.dev/docs/g2-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_g2_software` | Search B2B software: star rating, review count, vendor, categories; each row carries `product_id` |
| `get_g2_product` | Full profile: per-star histogram, pricing editions, feature groups, integrations, alternatives, AI pros/cons |
| `get_g2_reviews` | A page of reviews: rating, likes/dislikes, problems solved, reviewer firmographics, validated flags |

5 credits per call - the most expensive platform on Scavio. `search_g2_software` pages with `page` + `limit` (capped at 100 on our side); `get_g2_reviews` is fixed at 10 per page and paginates well past the 10 pages G2's own widget links to. `get_g2_product` is single-shot.

### [Capterra Software Reviews](https://scavio.dev/docs/capterra-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_capterra_software` | Search B2B software: 20 ranked products with rating, review count and paid-placement flag |
| `get_capterra_product` | Full profile: per-star histogram, four scored criteria, pricing table, features, plus 25 recent reviews |
| `get_capterra_reviews` | A page of reviews: overall plus five per-criterion scores, pros, cons, alternatives considered |

2 credits per call. Only `get_capterra_reviews` paginates: 25 per page, capped at page 100 - past it Capterra answers 200 with page one, so check what came back. `get_capterra_product` already includes the 25 most recent reviews.

### [Trustpilot](https://scavio.dev/docs/trustpilot-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_trustpilot` | Search businesses by keyword in one country: domain, TrustScore, stars, review count, categories, website, published email/phone/address; up to 100 per page |
| `get_trustpilot_business` | Full profile by domain or URL: rating distribution, review count per language, claimed and verification status, reply rate and days to reply, consumer alerts, AI summary and topics, similar businesses, 20 newest reviews |
| `get_trustpilot_reviews` | A page of 20 reviews filtered by stars, language, date range, topics, text, verified-only and with-replies; sorted by recency or relevance |
| `get_trustpilot_categories` | The category tree (22 top-level, 189 subcategories), or categories matching a name |
| `get_trustpilot_category` | Businesses ranked in a category by country: sort, minimum star rating (TrustScore rounded to stars, so 4 includes 3.8+), claimed profiles only; 20 per page |
| `get_trustpilot_review` | One review by its 24-character id, with the business it is about |

2 credits per call. `get_trustpilot_reviews` serves 10 pages of 20, so 200 reviews per
filter combination; to read more, slice into separate sets (each `stars` value, each
`language`, each `date_range`) rather than paging further. `total_filtered` with a
`date_range` doubles as review velocity. Email and phone appear only when the business
published them; the AI summary and topics only when Trustpilot has them for the chosen
`language` (default `en`). No TrustScore history. An unknown domain, category or review
id is a billed 404 that names what was not found.

### [Goodreads](https://scavio.dev/docs/goodreads-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Goodreads API for Goodreads (goodreads.com, Amazon's book community): book, list and quote search; one book in full by id, link or ISBN with its rating distribution, genres, series, awards, editions and Kindle price as Goodreads shows it; reader reviews with Goodreads' own sorts and star, language and edition filters; authors with their books and series; every edition of a work; Listopia lists, the lists a book is on and list search; quotes by words, tag or book; a genre's most shelved and most read books; and new releases by genre or month. Goodreads retired its official API (no new developer keys since 2020). See the [Goodreads API page](https://scavio.dev/goodreads-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_goodreads` | Books (by title, author or ISBN), Listopia lists or quotes, 20 a page up to page 100; `total` (exact counts only) or `total_text` as Goodreads words it; Goodreads search has no sort or field filter |
| `get_goodreads_book` | One book by `book_id`, link or ISBN: `work_id`, rating, rating distribution, reviews count and review languages, genres, series, format, pages, publisher, dates, ISBNs, ASIN, awards, places, characters, Kindle price (USD, as given) and the first 30 reviews |
| `get_goodreads_reviews` | Reader reviews of one book, 30 a page, sorted popular, newest or oldest, filtered by stars, language or this edition; up to 4 pages (120 reviews) of one view per call |
| `get_goodreads_suggestions` | The books Goodreads suggests for a typed title, author or ISBN |
| `get_goodreads_author` | One author: born, died, website, genres, bio, rating, ratings and reviews counts, works count, followers, top books and series |
| `get_goodreads_author_books` | Every book of one author, 30 a page, in Goodreads' order or by publication year, title, average rating or number of pages |
| `get_goodreads_series` | One series with every book in Goodreads' reading order, primary and total works |
| `get_goodreads_editions` | Every edition of one work (`work_id`), 10 a page, with Goodreads' six sorts: publisher, format, pages, ISBNs, ASIN, language, rating |
| `get_goodreads_list` | One Listopia list, 100 books a page in vote order, with score and votes (the list's creator is not returned) |
| `get_goodreads_book_lists` | The Listopia lists that contain one book, with the book's rank on each |
| `search_goodreads_lists` | Listopia lists whose title matches, 20 a page, with their top books |
| `get_goodreads_quotes` | Quotes by search words, by tag or from one book (`work_id`), with tags and likes |
| `get_goodreads_genre` | A genre's first 50 most shelved books (`popular`) or the books most read this week (`most_read`) |
| `get_goodreads_new_releases` | New releases Goodreads tags with a genre, or a month's (YYYY-MM) most popular releases across every genre, the first 15 Goodreads shows |

Platform key `goodreads`. Credits: 1 per call on every tool; `credits_used` in
the response is what was charged. Most answers arrive within a few seconds;
sorted, filtered or multi-page reviews take 15-60 s, up to about 2 minutes:
allow up to 4 minutes.

One global English site, no country or market. Captured 2026-11-26: dune gave
over 111k books, the first Dune by Frank Herbert (book_id 44767458), rated 4.29
from 1732454 ratings with 524 editions, 91243 reviews in 54 languages, a Hugo
Award winner in 1966 and a Kindle price of 9.99 USD; Brandon Sanderson (author_id
38550) had 464 works and 299148 followers; Best Books Ever (list_id 1) had 80344
books and 299515 voters. Reviews read up to 4 pages of 30 of one view per call,
since Goodreads has no jump to a deeper page; a book's `review_languages` lists
the language filter's values with counts. A genre is one page (Goodreads shows
visitors one page of a genre); a month's new releases are the first 15 on
Goodreads' page. Reviewer names, avatars and profile links are never returned
(profile links are cut out of review text), and a list's creator is not
returned; book authors are. Not available: user shelves and profiles, reading
challenges, groups, ratings history (poll and store the answers). Failed calls
and refused inputs are not charged; a not-found (an unknown book, ISBN, author,
genre, or a review language with no reviews) is charged.

### [ThriftBooks](https://scavio.dev/docs/thriftbooks-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

ThriftBooks API for ThriftBooks (thriftbooks.com, the US online used-book seller), prices in USD: keyword search or the whole catalog with the Bestsellers, Deals and New Releases presets, filters for format, condition, language, genre, price, collectible, signed, first edition and large print, and the site's 7 sorts; an ISBN lookup that returns the matched work and edition; a work's price for each format and condition (New, Like New, Very Good, Good, Acceptable) with quantity and copy details; one edition in full with its copies for sale; every edition of a work; customer reviews; and search suggestions. See the [ThriftBooks API page](https://scavio.dev/thriftbooks-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

| Tool | Description |
|------|-------------|
| `search_thriftbooks` | Keyword search or the whole catalog, presets bestsellers, deals and new_releases, 7 sorts, filters, up to 50 works a page with total, facets and each work's price range |
| `get_thriftbooks_isbn` | Look up an ISBN-10 or ISBN-13: work_id, edition_id and the work's format x condition price table, the matched edition's rows marked |
| `get_thriftbooks_work` | One work's format x condition table: price, list price, quantity and copy details per condition |
| `get_thriftbooks_edition` | One edition: ISBN, publisher, pages, list price, lowest new and used price, a short overview excerpt and its copies |
| `get_thriftbooks_copies` | Every copy for sale of one edition, one row per condition and copy type |
| `get_thriftbooks_editions` | All editions of a work, 25 a page, filtered by format and condition, 5 sorts |
| `get_thriftbooks_reviews` | Customer reviews of a work, 10 a page (no reviewer names) |
| `get_thriftbooks_suggestions` | Search-box title and author completions |

Platform key `thriftbooks`. Credits: 1 per call on every tool; `credits_used` in the
response is what was charged.

US storefront, USD, as a visitor who is not signed in sees it (no member or cart
prices). Prices are per condition: a work's table lists New, Like New, Very Good,
Good and Acceptable for each format, and a row with no copy for sale has price
null. A New quantity of 500 is the most ThriftBooks shows, so 500 means 500 or
more. Search pages up to 10000 results (page x page_size) and does not match
ISBNs: use `get_thriftbooks_isbn`. An edition's description is the short excerpt
the page gives (about 300 characters). Captured 2026-11-27: project hail mary gave
3 works, the first with 27 editions from 17.25 to 29.99 USD; ISBN 9780593135204
matched work 26830049 with 4 formats, the hardcover New at 23.92 USD (list 32)
with quantity 500; The Hunger Games (work 246187) had 33 editions in stock and 4
formats from 7.19 to 34.59 USD. Not available: price history (poll and store the
answers), seller accounts, checkout. Failed calls and refused inputs are not
charged; a not-found (an unknown ISBN, work or edition) is charged.

### [Google Ads Transparency](https://scavio.dev/docs/google-ads-advertisers?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `resolve_google_ads_advertiser` | START HERE - resolve a brand name or domain to the `advertiser_id` |
| `search_google_ads` | Every ad Google is running for one advertiser, with first/last seen dates and days actually run |
| `get_google_ads_creative` | One creative in full - the only tool carrying size variations, impression bucket and region breakdown |

1 credit per call. Start with `resolve_google_ads_advertiser` to turn a brand name or domain into an `advertiser_id`. `search_google_ads` is cursor-paginated at 100 ads per page - re-send the same filters alongside the cursor. `get_google_ads_creative` is the only tool carrying a creative's history, region breakdown and impression bucket.

### [Meta Ad Library](https://scavio.dev/docs/meta-ads-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_meta_ads` | Search the Meta Ad Library with full creative: ad copy, headline, CTA, media, platforms, run dates |
| `get_meta_ads_advertiser` | Every ad a Facebook Page is running, by numeric page id, with the same creative detail |
| `get_meta_ad` | One ad in full by archive id: creative, advertiser, run dates, platforms, political disclosure |

1 credit per call, and every cursor page is another credit: page 1 returns 30 ads, then 10 per page thereafter, so the cost of walking a whole query scales with depth. `search_meta_ads` and `get_meta_ads_advertiser` both cursor-paginate - walk `has_next_page`. `get_meta_ad` is single-shot.

### [SEC EDGAR](https://scavio.dev/docs/sec-edgar-lookup?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `resolve_sec_company` | START HERE - resolve a company name or ticker to the CIK everything else is keyed by |
| `get_sec_company` | Filer profile: legal and former names, SIC industry, EIN, LEI, fiscal year end, tickers |
| `get_sec_filings` | A page of one filer's filings: accession number, form, dates, 8-K item codes, document links |
| `get_sec_concept` | Every value a filer reported for one XBRL concept, newest first, with its source filing |
| `get_sec_facts` | The index of every XBRL concept a filer reports - use it to find what to ask `get_sec_concept` for |
| `search_sec_filings` | EDGAR full-text search, 2001-today, with facets by company, form, industry and state |

1 credit per call on the official free EDGAR JSON API. Start with `resolve_sec_company` to turn a name or ticker into a CIK. `get_sec_filings` pages with `page` + `limit`; `search_sec_filings` pages up to 100, because the index refuses a result window past 10,000.

### [Companies House](https://scavio.dev/docs/companies-house-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

| Tool | Description |
|------|-------------|
| `search_companies_house` | START HERE - search the UK register by name for the `company_number` |
| `get_companies_house_company` | Full register entry: status, type, dates, registered office, SIC codes, accounts due dates |
| `get_companies_house_officers` | Officers current and resigned: role, appointment and resignation dates, nationality, DOB |
| `get_companies_house_filing_history` | Filings most recent first: date, type code, description, link to the filed PDF |

1 credit per call on the official UK register. Start with `search_companies_house` for a `company_number`. Search returns 20 per page and is capped at page 50 - the register serves a 1000-result window per term whatever hit count it prints, then answers page 51 with a 416. Officers (35/page) and filing history have no upper page bound; past the last page they return an ordinary 200 with an empty list, which looks identical to having none.

### Account

| Tool | Description |
|------|-------------|
| `get_usage` | Check credit balance, plan, and usage stats |

---

## About Scavio

[Scavio](https://scavio.dev?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) is a unified [search API for AI agents](https://scavio.dev/search-api-for-ai-agents?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and a data API for developers. One key, structured JSON:

- [Google Search API](https://scavio.dev/google-search-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) — SERP results, news, images, maps, and knowledge graph
- [Extract](https://scavio.dev/docs/extract?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) — read any URL as Markdown, plain text or raw HTML
- [Company Enrich](https://scavio.dev/docs/company-enrich?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) — a business's emails, phones, socials and owner from its website or a Google Maps place_id
- [Amazon Product API](https://scavio.dev/amazon-product-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [Walmart Product API](https://scavio.dev/walmart-product-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) — product search and details, alongside [eBay](https://scavio.dev/docs/ebay-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Target](https://scavio.dev/docs/target-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Home Depot](https://scavio.dev/docs/home-depot-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and [Costco](https://scavio.dev/costco-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (per-warehouse prices, stock, gas prices, coupon book), and [Mercado Libre](https://scavio.dev/mercadolibre-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (Mexico, Brazil, Argentina and Colombia listings, sellers, reviews, questions and best sellers)
- [TikTok API](https://scavio.dev/tiktok-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Instagram API](https://scavio.dev/instagram-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Reddit API](https://scavio.dev/reddit-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [X API](https://scavio.dev/x-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [LinkedIn API](https://scavio.dev/linkedin-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), and [YouTube API](https://scavio.dev/youtube-transcript-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) — social and video data
- Travel and local — [Booking.com](https://scavio.dev/docs/booking-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Airbnb](https://scavio.dev/docs/airbnb-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Tripadvisor](https://scavio.dev/docs/tripadvisor-locations?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Yelp](https://scavio.dev/docs/yelp-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)
- Real estate — [Zillow](https://scavio.dev/docs/zillow-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Redfin](https://scavio.dev/docs/redfin-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Realtor.com](https://scavio.dev/realtor-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (listings, sold comps, market stats, agents), [Rightmove](https://scavio.dev/rightmove-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (UK listings, England and Wales sold prices since 1995, agents)
- Jobs and employer data — [Indeed](https://scavio.dev/docs/indeed-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Glassdoor](https://scavio.dev/docs/glassdoor-companies?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)
- Apps, software reviews and ad libraries — [App Store](https://scavio.dev/docs/app-store-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Google Play](https://scavio.dev/docs/google-play-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [G2](https://scavio.dev/docs/g2-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Capterra](https://scavio.dev/docs/capterra-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Trustpilot](https://scavio.dev/trustpilot-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) (business profiles, filtered reviews, category rankings), [Google Ads Transparency](https://scavio.dev/docs/google-ads-advertisers?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Meta Ad Library](https://scavio.dev/docs/meta-ads-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)
- Company filings — [SEC EDGAR](https://scavio.dev/docs/sec-edgar-lookup?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme), [Companies House](https://scavio.dev/docs/companies-house-search?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme)

Teams use it as a [SerpAPI alternative](https://scavio.dev/alternatives/serpapi?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) with structured multi-platform data — see [Tavily vs Scavio](https://scavio.dev/compare/tavily/vs-scavio?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) for a head-to-head comparison.

Get a free [Search API](https://scavio.dev/docs/search-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) key at [scavio.dev](https://scavio.dev?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme).

---

## License

[MIT](LICENSE)
