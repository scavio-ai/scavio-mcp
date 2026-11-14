# Scavio MCP Server

![GitHub Repo stars](https://img.shields.io/github/stars/scavio-ai/scavio-mcp?style=social)
![License](https://img.shields.io/github/license/scavio-ai/scavio-mcp)

[Scavio](https://scavio.dev?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) is a unified [Web Search API](https://scavio.dev/docs/search-api?utm_source=npm-mcp&utm_medium=package&utm_campaign=readme) and MCP server that gives AI agents web search, page extraction, and structured data from e-commerce, social, travel, jobs, real-estate, app-store, ad-library and company-filing sources. 520 tools across 76 platforms plus Extract, Company Enrich, map, crawl and batch, one API key.

**The 22 platforms added in 0.13.0 are opt-in.** Registering all 520 tools puts ~741KB of tool definitions — roughly 90k tokens — into every session before you type anything. So the default is the platform set 0.12.x already had, plus Extract and Company Enrich: 143 tools, 114KB. Upgrading never removes a tool you were using. Everything else is one env var away: see [Choosing which tools load](#choosing-which-tools-load).

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

Scavio exposes 520 tools. Loading all of them costs ~741KB of `tools/list` —
roughly 90k tokens of context in every session before the user has said anything,
and more tools than some clients will accept at all. So the server registers a
curated subset by default and lets you pick the rest. The sizes below are
measured, not estimated: `npm run toolslist` reproduces them.

`SCAVIO_PLATFORMS` is a comma-separated allowlist of platform keys:

| Value | Registers |
|-------|-----------|
| *(unset)* or `default` | Every platform 0.12.x had, plus `extract` and `company` — **143 tools, 114KB** |
| `all` | every platform — **520 tools, ~741KB** |
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
`target`, `homedepot`, `costco`, `heb`, `kroger`, `publix`, `ikea`, `wayfair`, `decathlon`, `specs`, `lowes`, `samsclub`, `canadiantire`, `dollargeneral`, `sephora`, `ulta`, `aldi`, `microcenter`, `walgreens`, `cvs`, `wholefoods`, `harborfreight`, `petsmart`, `petco`, `iherb`, `chewy`, `menards`, `nordstrom`, `nordstromrack`, `bestbuy`, `tcgplayer`, `vinted`, `macys`, `saks`, `kohls`, `jcpenney`, `dicks`, `footlocker`, `fanatics`, `carrefour`, `allegro`, `olx`, `mercadolibre`, `tiktok-shop`, `booking`, `airbnb`,
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
when no page names one, and `data.pages_read[]`. An owner is only returned when
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
| `search_home_depot` | Search Home Depot: price, brand and model, ratings, per-store pickup/delivery |
| `get_home_depot_product` | Full item detail: pricing, media, spec table, dimensions, documents, return policy |
| `get_home_depot_reviews` | Full review bodies, rating distribution, per-attribute ratings, seller responses |

2 credits per call. Search page size is fixed at 12 and cannot be changed. Reviews return 30 per page; `total_pages` is the last page that exists and asking past it is a 404.

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

### Sam's Club

| Tool | Description |
|------|-------------|
| `search_sams_club` | Search Sam's Club: price, was price, savings, unit price, Instant Savings, rating, stock, fulfillment, aisle |
| `get_sams_club_product` | One item: online and club shelf price, Instant Savings, rating histogram, specifications, per-method stock and aisle; `club_id` for a specific club |
| `get_sams_club_clubs` | Clubs near a ZIP: club_id, address, coordinates, distance, phone, hours, services |
| `get_sams_club_savings` | Every Instant Savings item: offer amount, end date, purchase limit, channels |
| `get_sams_club_category` | Products in a category, same fields as search; clearance is category `1150109` |
| `get_sams_club_reviews` | Review bodies, 10 per page, with average rating and 1-5 star breakdown |

1 credit per call. Search, savings and category use a nearby club chosen by
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
