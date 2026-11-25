# Scavio MCP Server

![GitHub Repo stars](https://img.shields.io/github/stars/scavio-ai/scavio-mcp?style=social)
![License](https://img.shields.io/github/license/scavio-ai/scavio-mcp)

[Scavio](https://scavio.dev?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) is a unified [Web Search API](https://scavio.dev/docs/search-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and MCP server that gives AI agents web search, page extraction, and structured data from e-commerce, social, travel, jobs, real-estate, app-store, ad-library and company-filing sources. 881 tools across 110 platforms plus Extract, Company Enrich, map, crawl and batch, one API key.

**The 22 platforms added in 0.13.0 are opt-in.** Registering all 881 tools puts ~1772KB of tool definitions — roughly 90k tokens — into every session before you type anything. So the default is the platform set 0.12.x already had, plus Extract and Company Enrich: 143 tools, 114KB. Upgrading never removes a tool you were using. Everything else is one env var away: see [Choosing which tools load](#choosing-which-tools-load).

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

Scavio exposes 881 tools. Loading all of them costs ~1772KB of `tools/list` —
roughly 90k tokens of context in every session before the user has said anything,
and more tools than some clients will accept at all. So the server registers a
curated subset by default and lets you pick the rest. The sizes below are
measured, not estimated: `npm run toolslist` reproduces them.

`SCAVIO_PLATFORMS` is a comma-separated allowlist of platform keys:

| Value | Registers |
|-------|-----------|
| *(unset)* or `default` | Every platform 0.12.x had, plus `extract` and `company` — **143 tools, 114KB** |
| `all` | every platform — **881 tools, ~1772KB** |
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
`target`, `homedepot`, `costco`, `heb`, `kroger`, `publix`, `ikea`, `wayfair`, `ashley`, `maisonsdumonde`, `decathlon`, `specs`, `lowes`, `acehardware`, `tractorsupply`, `michaels`, `nike`, `staples`, `samsclub`, `canadiantire`, `sportchek`, `marks`, `dollargeneral`, `dollartree`, `discounttire`, `vevor`, `nellis`, `sephora`, `ulta`, `dermstore`, `aldi`, `instacart`, `microcenter`, `walgreens`, `cvs`, `wholefoods`, `harborfreight`, `autozone`, `oreilly`, `petsmart`, `petco`, `iherb`, `chewy`, `menards`, `nordstrom`, `nordstromrack`, `bestbuy`, `tcgplayer`, `nintendo`, `hm`, `zara`, `uniqlo`, `asos`, `fashionnova`, `vinted`, `mercari`, `depop`, `poshmark`, `offerup`, `thredup`, `macys`, `saks`, `kohls`, `jcpenney`, `dicks`, `footlocker`, `fanatics`, `argos`, `mediaexpert`, `action`, `hema`, `carrefour`, `allegro`, `bolcom`, `olx`, `trendyol`, `mercadolibre`, `tiktok-shop`, `booking`, `airbnb`,
`tripadvisor`, `yelp`, `zillow`, `redfin`, `realtor`, `rightmove`, `indeed`, `glassdoor`,
`appstore`, `googleplay`, `g2`, `capterra`, `trustpilot`, `googleads`, `metaads`, `sec`, `companieshouse`

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
| `get_home_depot_category` | Home Depot Canada only: one category or collection page by `category_id`, priced at a store |
| `get_home_depot_categories` | Home Depot Canada only: the department tree and the current event and collection pages |
| `get_home_depot_stock` | Home Depot Canada only: exact units of one item at every store near a postal code or city, no prices |
| `get_home_depot_store` | Home Depot Canada only: one store with address, services, 7 dated days of hours and nearby stores |
| `get_home_depot_suggestions` | Home Depot Canada only: search-box keyword suggestions |

US (homedepot.com, the default): 2 credits per call. Search page size is fixed at 12 and cannot be changed. Reviews return 30 per page; `total_pages` is the last page that exists and asking past it is a 404.

**Home Depot Canada** (homedepot.ca, The Home Depot's Canadian store: 182 stores in 10 provinces): pass `country: "ca"` to `search_home_depot`, `get_home_depot_product` and `get_home_depot_reviews`; the five Canada-only tools need no country. 1 credit per call on every Canada tool. Prices in CAD as Home Depot Canada gives them; `language: "fr"` returns French names and links (same ids and prices). Search and category take `store_id` (default store 7274; `data.store` says which), 1-40 products a page, the sorts `best_match`, `price_low`, `price_high` and `top_rated` (`top_sellers` is a 400 for Canada), facet `filters` (from `include_facets`) and `deals` (`special_buy`, `new_lower_price`, `savings`). Every product carries `store_units` (exact units at that store) and aisle / bay.

Prices can differ by store (lumber does; the tools, Christmas tree and fridge sampled had one price everywhere), and the online price can differ from a store's price. `get_home_depot_product` with `store_id` returns `price` as that store's price (`price_source: "store"`) and `online_price` beside it. Captured 2026-11-25: the 2-inch x 4-inch x 8-ft SPF Premium Stud (1000112108) at store 7128 (ST-HENRI, QC) at 4.14 CAD with 2858 units in aisle 19, bay 001, and an `online_price` of 6.58. When Home Depot Canada has no store record for an item that exists, `get_home_depot_product` returns the online price with `store_price_returned: false`, and `get_home_depot_stock` answers an unbilled 502.

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

### Sephora

| Tool | Description |
|------|-------------|
| `search_sephora` | Search sephora.com (US): price, list and sale price, rating, review count, bestseller/new/exclusive flags, category facets; `zip` for same-day eligibility |
| `get_sephora_category` | Products in a category, same fields as search, with subcategories, parent category and breadcrumbs |
| `get_sephora_product` | One product: every shade or size with price, stock, ingredients and pickup/same-day eligibility, plus a review summary with pro and con sentiment counts |

`search_sephora` and `get_sephora_category` are 1 credit per call, `get_sephora_product` 2.
`get_sephora_product` takes a result's `url` (faster) or
`product_id` (e.g. `"P510799"`). The review summary and sentiment counts come
with no review text.

### Ulta Beauty

| Tool | Description |
|------|-------------|
| `search_ulta` | Search Ulta Beauty: list and sale price, discount, promo text, rating, review count, badge, variant count |
| `get_ulta_category` | Products in a category (e.g. `/shop/makeup/lips/lipstick`), same fields as search |
| `get_ulta_product` | One product by URL: price, GTIN, ingredients, every shade or size variant, ship/pickup/same-day eligibility, five most recent reviews |
| `get_ulta_stores` | One shade or size at the 10 stores nearest a ZIP: in stock or out of stock per store, hours, distance |

1 credit per call. `get_ulta_stores` takes a result's `product_id` and `sku_id`
plus a ZIP. Ulta publishes in stock / out of stock per store, not unit counts.

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

1 credit per call. There is no store locator: the store number is on every
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
| `search_bestbuy` | Search bestbuy.com (US), 18 organic products per page: SKU, model, price, regular price, savings, on-sale flag, deal badge, condition, rating, review count, seller type; filter by brand, on sale, clearance, open box or a price range; sort by best match, best selling, best discount, price, rating or newest; plus the filter sidebar with counts |
| `get_bestbuy_product` | One product by SKU or URL: UPC, model, every open-box offer by condition (fair, good, excellent) with its price and savings against new and against the regular price, financing, the full specification table, the AI review summary, features, images and manuals |
| `get_bestbuy_reviews` | First-party Best Buy reviews, 20 per page, sorted or filtered to one star rating, with the star histogram, recommended percent and the most mentioned pros and cons with mention counts |
| `get_bestbuy_category` | Browse a category (`abcat...`) or merchandised deals page (`pcmcat...`) by id or URL, 18 per page, with the same filters and sorts as search |
| `get_bestbuy_deals` | Today's Deal of the Day and the more-deals row, up to 15 products with live prices |
| `get_bestbuy_stores` | Best Buy stores near a US ZIP, up to 15, with dated opening hours for the next 35 days |
| `get_bestbuy_availability` | Store pickup status of one SKU at up to 8 stores (nearest a ZIP or given store ids): in_stock, limited, ship_to_store, out_of_stock, not_available_for_pickup or unknown, with the pickup date |
| `get_bestbuy_suggestions` | The bestbuy.com search-box autocomplete, each term with its categories and SKUs |
| `get_bestbuy_prices` | Current price, regular price, savings, deal badge and deal end for up to 15 SKUs in one call |

Platform key `bestbuy`. 2 credits per call; `get_bestbuy_category` is 3 on a
`pcmcat` page, `get_bestbuy_deals` 3, `get_bestbuy_stores` and
`get_bestbuy_suggestions` 1, and `get_bestbuy_availability` 2 flat for up to 8
stores. `get_bestbuy_prices` is 2 per call whatever the number of SKUs (up to
15). US site only. Product, reviews and availability take `sku` or `url`;
availability takes exactly one of `zip` or `store_ids`, and `min_price` and
`max_price` go together. Availability is store pickup status, not unit counts:
Best Buy publishes a quantity only when it shows "only N left" (`limited`), so
`quantity` is null for `in_stock`. Availability takes 5-20s. An unknown SKU is
a 404 and is not billed.

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
