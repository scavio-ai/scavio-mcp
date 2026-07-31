# Scavio MCP Server

![GitHub Repo stars](https://img.shields.io/github/stars/scavio-ai/scavio-mcp?style=social)
![License](https://img.shields.io/github/license/scavio-ai/scavio-mcp)

[Scavio](https://scavio.dev) is a unified [Web Search API](https://scavio.dev/docs/search-api) and MCP server that connects AI agents to Google, YouTube, Amazon, Walmart, TikTok, Instagram, Reddit, X, LinkedIn, and TikTok Shop. 99 tools for web search, product lookup, video discovery, and social media data through a single [Search API](https://scavio.dev/docs/search-api) endpoint.

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

## Available Tools

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

### [Amazon Product API](https://scavio.dev/docs/amazon-api)

| Tool | Description |
|------|-------------|
| `search_amazon` | Search product listings across 22 marketplaces (no sort option) |
| `get_amazon_product` | Get full product details by ASIN |
| `get_amazon_offers` | List every seller offering an ASIN, with buy-box winner |

### [Walmart API](https://scavio.dev/docs/walmart-api)

| Tool | Description |
|------|-------------|
| `search_walmart` | Search product listings with price and delivery filters |
| `get_walmart_product` | Get full product details by product ID |

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

### [Reddit API](https://scavio.dev/docs/reddit-api)

| Tool | Description |
|------|-------------|
| `search_reddit` | Search Reddit posts by query with sort and pagination |
| `get_reddit_post` | Get a full post with threaded comments by URL |
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

Every LinkedIn tool costs 1 credit. Take a vanity handle, slug or id, or a full
LinkedIn URL.

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

### Account

| Tool | Description |
|------|-------------|
| `get_usage` | Check credit balance, plan, and usage stats |

---

## About Scavio

[Scavio](https://scavio.dev) is a unified [search API for AI agents](https://scavio.dev/search-api-for-ai-agents) and a data API for developers. One key, structured JSON, no scraping or proxies:

- [Google Search API](https://scavio.dev/google-search-api) — SERP results, news, images, maps, and knowledge graph
- [Amazon Product API](https://scavio.dev/amazon-product-api) and [Walmart Product API](https://scavio.dev/walmart-product-api) — product search and details
- [TikTok API](https://scavio.dev/tiktok-api), [Instagram API](https://scavio.dev/instagram-api), [Reddit API](https://scavio.dev/reddit-api), [X API](https://scavio.dev/x-api), [LinkedIn API](https://scavio.dev/linkedin-api), and [YouTube API](https://scavio.dev/youtube-transcript-api) — social and video data

Teams use it as a [SerpAPI alternative](https://scavio.dev/alternatives/serpapi) with structured multi-platform data — see [Tavily vs Scavio](https://scavio.dev/compare/tavily/vs-scavio) for a head-to-head comparison.

Get a free [Search API](https://scavio.dev/docs/search-api) key at [scavio.dev](https://scavio.dev).

---

## License

[MIT](LICENSE)
