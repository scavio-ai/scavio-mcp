# Scavio MCP Server

![GitHub Repo stars](https://img.shields.io/github/stars/scavio-ai/scavio-mcp?style=social)
![License](https://img.shields.io/github/license/scavio-ai/scavio-mcp)

[Scavio](https://scavio.dev) is a unified [Web Search API](https://scavio.dev/docs/search-api) and MCP server that gives AI agents web search, page extraction, and structured data from e-commerce, social, travel, jobs, real-estate, app-store, ad-library and company-filing sources. 191 tools across 32 platforms, one API key.

**The 22 platforms added in 0.13.0 are opt-in.** Registering all 191 tools puts 262KB of tool definitions — roughly 70k tokens — into every session before you type anything. So the default is the surface 0.12.x already had, plus Extract: 106 tools, 102KB. Upgrading never removes a tool you were using. Everything else is one env var away: see [Choosing which tools load](#choosing-which-tools-load).

## Remote MCP Server

Connect directly to Scavio's remote MCP server without any local installation:

```
https://mcp.scavio.dev/mcp
```

Pass your API key via the `x-api-key` header. Get your key at [scavio.dev](https://scavio.dev).

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

Requires Node.js 20+. Get your API key at [scavio.dev](https://scavio.dev).

---

## Install

### Claude Code

```bash
claude mcp add scavio --transport http --url https://mcp.scavio.dev/mcp --header "x-api-key: YOUR_SCAVIO_API_KEY"
```

### Claude Desktop

Add to `claude_desktop_config.json` (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

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

Scavio exposes 191 tools. Loading all of them costs 262KB of `tools/list` —
roughly 70k tokens of context in every session before the user has said anything,
and more tools than some clients will accept at all. So the server registers a
curated subset by default and lets you pick the rest. The sizes below are
measured, not estimated: `npm run toolslist` reproduces them.

`SCAVIO_PLATFORMS` is a comma-separated allowlist of platform keys:

| Value | Registers |
|-------|-----------|
| *(unset)* | Everything 0.12.x had, plus `extract` — **106 tools, 102KB** |
| `all` | every platform — **191 tools, 262KB** |
| `extract,sec,g2` | just those platforms — 11 tools, 20KB |
| `default,walmart,metaads` | the default set plus two more — 58 tools |
| `none` | no platform tools, only `get_usage` |

Keys are matched case- and punctuation-insensitively, so `meta-ads`, `metaads`
and `META_ADS` are the same thing, and `twitter` resolves to `x`. An unknown key
is logged to stderr and skipped rather than failing the server.

`get_usage` always registers — it is free, and it is what every install guide
tells you to call to check the server works.

**Platform keys:** `extract`, `google`, `youtube`, `tiktok`, `instagram`,
`reddit`, `x`, `linkedin`, `threads`, `kuaishou`, `amazon`, `walmart`, `ebay`,
`target`, `homedepot`, `tiktok-shop`, `booking`, `airbnb`, `tripadvisor`,
`yelp`, `zillow`, `redfin`, `indeed`, `glassdoor`, `appstore`, `googleplay`,
`g2`, `capterra`, `googleads`, `metaads`, `sec`, `companieshouse`

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
plus Extract — every tool you were using still loads, and the context cost is
unchanged. Walmart grew from 2 tools to 7, so the count moves 100 → 106.

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

### [Extract](https://scavio.dev/docs/extract)

| Tool | Description |
|------|-------------|
| `extract_url` | Read any web page and return it as clean Markdown, plain text, or raw HTML |

Extract is tier-priced by the `mode` parameter, not flat: `normal` (plain fetch)
and `advanced` (full JavaScript rendering) cost 1 credit, `ultra` (residential
proxy, for hard bot walls) costs 2. Start at `normal` and escalate only when the
content comes back empty or blocked. You are billed only on a successful
extraction — a dead link, a bot wall or a timeout costs nothing. There is no
pagination: the whole page comes back in one call.

### [Google Search API](https://scavio.dev/docs/search-api)

| Tool | Description |
|------|-------------|
| `search_google` | Web search (v2) with organic results, ads, and AI Overview |
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

### [YouTube Data API](https://scavio.dev/docs/youtube-api)

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

Credit cost varies: `get_youtube_transcript` costs 8, `get_youtube_streams` 3,
`search_youtube` and `search_youtube_shorts` 2, and every other YouTube tool 1.
`get_youtube_related` accepts a cursor but never returns one, so treat it as a
single page.

### [Amazon Product API](https://scavio.dev/docs/amazon-api)

| Tool | Description |
|------|-------------|
| `search_amazon` | Search product listings across 22 marketplaces (no sort option) |
| `get_amazon_product` | Get full product details by ASIN |
| `get_amazon_offers` | List every seller offering an ASIN, with buy-box winner |
| `get_amazon_options` | List the supported marketplaces and their country codes (free) |

### [Walmart API](https://scavio.dev/docs/walmart-api)

| Tool | Description |
|------|-------------|
| `search_walmart` | Search product listings with price and delivery filters |
| `get_walmart_product` | Get full product details by product ID |
| `get_walmart_reviews` | Customer reviews with ratings, text, author, date and the rating breakdown |
| `get_walmart_category` | Products within a category, same product shape as search |
| `get_walmart_offers` | The buy-box offer for a product: price, seller, condition, buy-box flag |
| `get_walmart_seller` | Marketplace seller storefront: name, rating, Pro Seller badge, business details |
| `get_walmart_seller_products` | A seller's catalogue; `total_count` is the real size |

Walmart is priced by the `domain` parameter, not at a flat rate: `com` (US,
default) and `ca` cost 1 credit, `com.mx` costs 2. Only `search_walmart` and
`get_walmart_category` accept `domain`, so only those two can cost 2 — the other
five are always 1. The id-keyed tools are US-only, because walmart.ca product
pages cannot be fetched.

Two shapes to plan for. `get_walmart_offers` returns the buy-box winner only —
Walmart server-renders just that one offer, so expect a single row even when
`total_offer_count` is higher. And `get_walmart_seller_products` is capped at
roughly the first 40 items with no page or cursor parameter; read `total_count`
to know you are looking at a slice. Both seller tools need the NUMERIC
`seller_catalog_id` from a product, search or offers response — the GUID-form
`seller_id` in those same responses 404s.

### [TikTok API](https://scavio.dev/docs/tiktok-api)

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

### [Instagram API](https://scavio.dev/docs/instagram-api)

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

Instagram is priced per endpoint, not at a flat rate: `get_instagram_user_posts`
costs 2, `get_instagram_post` and `get_instagram_comment_replies` cost 8, and the
other nine tools cost 10. The 10-credit endpoints hedge two upstream providers and
bill both legs, which is what the price reflects.

### [Reddit API](https://scavio.dev/docs/reddit-api)

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

Every Reddit tool costs 1 credit. Two things to know: `search_reddit` takes a query
and a cursor only - there is no sort or post-type filter, results come back in
relevance order - and `get_reddit_post` returns a flat post object with no comments,
so call `get_reddit_post_comments` with the post id for those. Reddit is the slowest
platform here, typically 5-15 seconds per call.

### [X API](https://scavio.dev/docs/x-search)

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

`get_x_user_tweets`, `get_x_user_replies` and `get_x_user_media` return a
`next_cursor` but no `has_more`, so page until the cursor is absent or the timeline
comes back empty.

### [LinkedIn API](https://scavio.dev/docs/linkedin-person)

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

The upstream provider retired the datasets behind member contact info, the
company employee directory, per-company job listings, people search and post
search, so those five tools were removed. `get_linkedin_company` still returns a
small sample of featured employees, and `search_linkedin_jobs` with a company
name substitutes for per-company listings.

### [TikTok Shop API](https://scavio.dev/docs/tiktok-shop-search)

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
product page upstream) - exact prices come from `search_tiktok_shop`,
`get_tiktok_shop_shop_products` and `get_tiktok_shop_category_products`. And only about 44% of the
product IDs returned by search resolve on `get_tiktok_shop_product` (11 of 25 measured), because
upstream has no detail data for the rest. That miss is signalled by the HTTP 404 status, not by any
field in the response body, and it is a normal outcome rather than an error to retry - the tool
returns it as a plain result with `status: "no_detail_data"` so agents skip the product instead of
looping. For an id that will not resolve, `get_tiktok_shop_product_reviews` is often still usable:
across 8 measured ids that failed on detail, 8 of 8 returned HTTP 200 on reviews and 7 of 8 returned
at least one review.

### [Threads](https://scavio.dev/docs/threads-profile)

| Tool | Description |
|------|-------------|
| `get_threads_profile` | Profile details for a Threads user, by `user_id` or `username` |
| `get_threads_user_posts` | A user's Threads posts, cursor-paginated |
| `get_threads_user_replies` | A user's replies, cursor-paginated |
| `get_threads_post` | A single post by id or threads.net URL |
| `get_threads_post_comments` | Replies to a post, cursor-paginated |
| `search_threads_users` | Profiles matching a name or handle - the only search Threads exposes |

Threads is priced by how you address a user, not per endpoint: 2 credits when you pass `user_id`, 4 credits when you pass `username`. Only `get_threads_profile`, `get_threads_user_posts` and `get_threads_user_replies` accept a username; the other three are always 2. Prefer `user_id` - a handle buys a second upstream lookup.

### [Kuaishou (China)](https://scavio.dev/docs/kuaishou-profile)

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

### [eBay](https://scavio.dev/docs/ebay-search)

| Tool | Description |
|------|-------------|
| `search_ebay` | Search live or SOLD listings: price, condition, bids, shipping, seller feedback |
| `get_ebay_product` | One listing in full: price, condition, images, item specifics, shipping, returns, auction state |
| `get_ebay_seller` | Seller profile card: store name, feedback score, items sold, followers, location |

1 credit per call. `get_ebay_seller` is a profile card and cannot enumerate a catalogue - list a seller's inventory with `search_ebay` and `seller` set and no keyword. `sold: true` searches completed listings that actually sold; on that view eBay publishes no headline count, so `total_results` is null. `per_page` accepts only 60, 120 or 240.

### [Target](https://scavio.dev/docs/target-search)

| Tool | Description |
|------|-------------|
| `search_target_products` | Search Target.com: prices, ratings, badges and promotions |
| `get_target_category` | Products in a category, same shape as search plus the breadcrumb |
| `get_target_product` | Product details by TCIN: price, images, specifications, variants, fulfillment |
| `get_target_reviews` | Reviews with the rating breakdown, per-attribute averages and guest photos |

1 credit per call. `get_target_product` and `get_target_reviews` are single-shot; search and category page with `page` + `count`.

### [Home Depot](https://scavio.dev/docs/home-depot-search)

| Tool | Description |
|------|-------------|
| `search_home_depot` | Search Home Depot: price, brand and model, ratings, per-store pickup/delivery |
| `get_home_depot_product` | Full item detail: pricing, media, spec table, dimensions, documents, return policy |
| `get_home_depot_reviews` | Full review bodies, rating distribution, per-attribute ratings, seller responses |

2 credits per call. Search page size is fixed at 12 and cannot be changed. Reviews return 30 per page; `total_pages` is the last page that exists and asking past it is a 404.

### [Booking.com](https://scavio.dev/docs/booking-search)

| Tool | Description |
|------|-------------|
| `search_booking` | Properties for a destination and stay: live nightly price, review score, room type |
| `get_booking_hotel` | One property in full: rooms and rate plans, facilities, house rules, policies, images |
| `get_booking_reviews` | Guest reviews with the score breakdown by category and Booking's own summary |

1 credit per call. Search returns 25 properties per page; `get_booking_hotel` and `get_booking_reviews` are single-shot.

### [Airbnb](https://scavio.dev/docs/airbnb-search)

| Tool | Description |
|------|-------------|
| `search_airbnb` | Stays with stay-total and per-night price, the full discount ledger, rating, coordinates |
| `get_airbnb_listing` | One listing in full: description, capacity, grouped amenities, host, house rules, rating breakdown |
| `get_airbnb_reviews` | Review bodies with per-review rating, date and reviewer profile |

1 credit per call. `search_airbnb` takes `page` XOR `cursor` - sending both is rejected, and `cursor` wins. 18 listings per page. `get_airbnb_reviews` pages with `limit` + `offset`.

### [Tripadvisor](https://scavio.dev/docs/tripadvisor-locations)

| Tool | Description |
|------|-------------|
| `resolve_tripadvisor_location` | START HERE - resolve a place or business name to the `geo_id` / `location_id` pair |
| `search_tripadvisor` | Restaurants, hotels or attractions in a geo, TripAdvisor-ranked |
| `get_tripadvisor_location` | One location in full: rating histogram, sub-ratings, city ranking, amenities, first review page |
| `get_tripadvisor_reviews` | A page of reviews: rating, trip date and type, reviewer profile, management response |

2 credits per call. Start with `resolve_tripadvisor_location` for the `geo_id` / `location_id` pair everything else needs. Search returns 30 per page and a page past the last is a 404, not an empty result. Reviews return 15 per page for restaurants and 10 for hotels and attractions, so `category` must match the location's own type on any page past the first.

### [Yelp](https://scavio.dev/docs/yelp-search)

| Tool | Description |
|------|-------------|
| `search_yelp` | Businesses in Yelp's ranked order: rating, review count, price band, categories, hours |
| `get_yelp_business` | One business in full: per-star histogram, contact, hours, amenities, health inspections, Q&A |
| `get_yelp_reviews` | A page of reviews: rating, full text, author profile, photos, owner response |

2 credits per call. Yelp fixes the page size at 10. `get_yelp_business` already includes the first page of reviews at no extra cost. A review page past the last is a 404, not an empty result.

### [Zillow](https://scavio.dev/docs/zillow-search)

| Tool | Description |
|------|-------------|
| `search_zillow` | Listings in a region: price, beds, baths, living area, Zestimate, coordinates, days on market |
| `get_zillow_property` | Full listing: price and price history, Zestimate, tax history, RESO facts, schools, photos |
| `get_zillow_agent_reviews` | A Zillow AGENT's profile and reviews, specialties, licenses, service areas, sales counts |

1 credit per call. Only `search_zillow` paginates. `get_zillow_agent_reviews` is an AGENT profile, not a property.

### [Redfin](https://scavio.dev/docs/redfin-search)

| Tool | Description |
|------|-------------|
| `search_redfin` | Listings: price, price per sqft, beds, baths, living area, lot size, year built, photos |
| `get_redfin_property` | Full listing: Redfin Estimate, MLS fact sheet, price and tax history, schools, climate risk, comps |
| `get_redfin_market` | Market stats for a region: median list and sale price, sale-to-list ratio, days on market, compete score |

1 credit per call. `search_redfin` pages with `page` + `limit`, up to 350 listings per page; the other two are single-shot.

### [Indeed](https://scavio.dev/docs/indeed-search)

| Tool | Description |
|------|-------------|
| `search_indeed_jobs` | Job postings: title, employer, rating, location, salary range, job type, apply route |
| `get_indeed_job` | One posting in full: description text and HTML, structured salary, benefits, original ATS link |
| `get_indeed_company` | Employer profile: industry, HQ, size, revenue, CEO approval, per-category ratings, open roles |
| `get_indeed_company_reviews` | Employee reviews with per-category ratings, pros/cons, reviewer job title and location |

2 credits per call. Job search returns 10 postings per page, company reviews 20 per page. `get_indeed_job` and `get_indeed_company` are single-shot.

### [Glassdoor](https://scavio.dev/docs/glassdoor-companies)

| Tool | Description |
|------|-------------|
| `resolve_glassdoor_company` | START HERE - resolve a company name to the `employer_id` the other tools need |
| `get_glassdoor_company` | Employer profile: ratings, star distribution, CEO approval, size and revenue bands, awards |
| `get_glassdoor_reviews` | Up to three full reviews with per-axis scores and employer response, plus complete rating statistics |
| `get_glassdoor_salaries` | Salaries by job title: base-pay and total-pay percentiles P10-P90, sample counts, pay period |

1 credit per call. Start with `resolve_glassdoor_company` for the `employer_id`. Only `get_glassdoor_salaries` paginates (10 job titles per page; `page_count` is how many exist). `get_glassdoor_reviews` returns up to three full reviews plus complete rating statistics - it is not a paginated review feed.

### [Apple App Store](https://scavio.dev/docs/app-store-search)

| Tool | Description |
|------|-------------|
| `search_app_store` | Up to 200 fully-shaped apps - doubles as a bulk metadata fetch and a publisher lookup |
| `get_app_store_app` | Full listing: developer identity, price, all-time and current-version ratings, release notes, screenshots |
| `get_app_store_reviews` | A page of reviews: star rating, title, full text, author, and the app version reviewed |

1 credit per call. Reviews page 1-10 at 50 per page and stop hard at page 10: 500 reviews per storefront is Apple's anonymous ceiling, and you reach further by asking a different `country`. Search and app detail do not paginate.

### [Google Play](https://scavio.dev/docs/google-play-search)

| Tool | Description |
|------|-------------|
| `search_google_play` | Ranked apps: package name, developer, rating, install count, price and IAP range, screenshots |
| `get_google_play_app` | Full store listing: the real install count, star histogram, IAPs, permissions, Data safety table |
| `get_google_play_reviews` | A page of reviews: star score, full text, thumbs-up count, developer reply, app version |

2 credits per call - a separate namespace from `google` and not on the Google-exempt price. Reviews are cursor-paginated, and the cursor is opaque, single-use and encodes the sort as well as the position, so send it back with the same `sort` it came from. A cursor past the last review is a 404. Search and app detail do not paginate.

### [G2 Software Reviews](https://scavio.dev/docs/g2-search)

| Tool | Description |
|------|-------------|
| `search_g2_software` | Search B2B software: star rating, review count, vendor, categories; each row carries `product_id` |
| `get_g2_product` | Full profile: per-star histogram, pricing editions, feature groups, integrations, alternatives, AI pros/cons |
| `get_g2_reviews` | A page of reviews: rating, likes/dislikes, problems solved, reviewer firmographics, validated flags |

5 credits per call - the most expensive platform on Scavio. `search_g2_software` pages with `page` + `limit` (capped at 100 on our side); `get_g2_reviews` is fixed at 10 per page and paginates well past the 10 pages G2's own widget links to. `get_g2_product` is single-shot.

### [Capterra Software Reviews](https://scavio.dev/docs/capterra-search)

| Tool | Description |
|------|-------------|
| `search_capterra_software` | Search B2B software: 20 ranked products with rating, review count and paid-placement flag |
| `get_capterra_product` | Full profile: per-star histogram, four scored criteria, pricing table, features, plus 25 recent reviews |
| `get_capterra_reviews` | A page of reviews: overall plus five per-criterion scores, pros, cons, alternatives considered |

2 credits per call. Only `get_capterra_reviews` paginates: 25 per page, capped at page 100 - past it Capterra answers 200 with page one, so check what came back. `get_capterra_product` already includes the 25 most recent reviews.

### [Google Ads Transparency](https://scavio.dev/docs/google-ads-advertisers)

| Tool | Description |
|------|-------------|
| `resolve_google_ads_advertiser` | START HERE - resolve a brand name or domain to the `advertiser_id` |
| `search_google_ads` | Every ad Google is running for one advertiser, with first/last seen dates and days actually run |
| `get_google_ads_creative` | One creative in full - the only tool carrying size variations, impression bucket and region breakdown |

1 credit per call. Start with `resolve_google_ads_advertiser` to turn a brand name or domain into an `advertiser_id`. `search_google_ads` is cursor-paginated at 100 ads per page - re-send the same filters alongside the cursor. `get_google_ads_creative` is the only tool carrying a creative's history, region breakdown and impression bucket.

### [Meta Ad Library](https://scavio.dev/docs/meta-ads-search)

| Tool | Description |
|------|-------------|
| `search_meta_ads` | Search the Meta Ad Library with full creative: ad copy, headline, CTA, media, platforms, run dates |
| `get_meta_ads_advertiser` | Every ad a Facebook Page is running, by numeric page id, with the same creative detail |
| `get_meta_ad` | One ad in full by archive id: creative, advertiser, run dates, platforms, political disclosure |

1 credit per call, and every cursor page is another credit: page 1 returns 30 ads, then 10 per page thereafter, so the cost of walking a whole query scales with depth. `search_meta_ads` and `get_meta_ads_advertiser` both cursor-paginate - walk `has_next_page`. `get_meta_ad` is single-shot.

### [SEC EDGAR](https://scavio.dev/docs/sec-edgar-lookup)

| Tool | Description |
|------|-------------|
| `resolve_sec_company` | START HERE - resolve a company name or ticker to the CIK everything else is keyed by |
| `get_sec_company` | Filer profile: legal and former names, SIC industry, EIN, LEI, fiscal year end, tickers |
| `get_sec_filings` | A page of one filer's filings: accession number, form, dates, 8-K item codes, document links |
| `get_sec_concept` | Every value a filer reported for one XBRL concept, newest first, with its source filing |
| `get_sec_facts` | The index of every XBRL concept a filer reports - use it to find what to ask `get_sec_concept` for |
| `search_sec_filings` | EDGAR full-text search, 2001-today, with facets by company, form, industry and state |

1 credit per call on the official free EDGAR JSON API. Start with `resolve_sec_company` to turn a name or ticker into a CIK. `get_sec_filings` pages with `page` + `limit`; `search_sec_filings` pages up to 100, because the index refuses a result window past 10,000.

### [Companies House](https://scavio.dev/docs/companies-house-search)

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

[Scavio](https://scavio.dev) is a unified [search API for AI agents](https://scavio.dev/search-api-for-ai-agents) and a data API for developers. One key, structured JSON, no scraping or proxies:

- [Google Search API](https://scavio.dev/google-search-api) — SERP results, news, images, maps, and knowledge graph
- [Extract](https://scavio.dev/docs/extract) — read any URL as Markdown, plain text or raw HTML
- [Amazon Product API](https://scavio.dev/amazon-product-api) and [Walmart Product API](https://scavio.dev/walmart-product-api) — product search and details, alongside [eBay](https://scavio.dev/docs/ebay-search), [Target](https://scavio.dev/docs/target-search) and [Home Depot](https://scavio.dev/docs/home-depot-search)
- [TikTok API](https://scavio.dev/tiktok-api), [Instagram API](https://scavio.dev/instagram-api), [Reddit API](https://scavio.dev/reddit-api), [X API](https://scavio.dev/x-api), [LinkedIn API](https://scavio.dev/linkedin-api), and [YouTube API](https://scavio.dev/youtube-transcript-api) — social and video data
- Travel and local — [Booking.com](https://scavio.dev/docs/booking-search), [Airbnb](https://scavio.dev/docs/airbnb-search), [Tripadvisor](https://scavio.dev/docs/tripadvisor-locations), [Yelp](https://scavio.dev/docs/yelp-search)
- Real estate — [Zillow](https://scavio.dev/docs/zillow-search), [Redfin](https://scavio.dev/docs/redfin-search)
- Jobs and employer data — [Indeed](https://scavio.dev/docs/indeed-search), [Glassdoor](https://scavio.dev/docs/glassdoor-companies)
- Apps, software reviews and ad libraries — [App Store](https://scavio.dev/docs/app-store-search), [Google Play](https://scavio.dev/docs/google-play-search), [G2](https://scavio.dev/docs/g2-search), [Capterra](https://scavio.dev/docs/capterra-search), [Google Ads Transparency](https://scavio.dev/docs/google-ads-advertisers), [Meta Ad Library](https://scavio.dev/docs/meta-ads-search)
- Company filings — [SEC EDGAR](https://scavio.dev/docs/sec-edgar-lookup), [Companies House](https://scavio.dev/docs/companies-house-search)

Teams use it as a [SerpAPI alternative](https://scavio.dev/alternatives/serpapi) with structured multi-platform data — see [Tavily vs Scavio](https://scavio.dev/compare/tavily/vs-scavio) for a head-to-head comparison.

Get a free [Search API](https://scavio.dev/docs/search-api) key at [scavio.dev](https://scavio.dev).

---

## License

[MIT](LICENSE)
