# Scavio MCP Server

![GitHub Repo stars](https://img.shields.io/github/stars/scavio-ai/scavio-mcp?style=social)
![License](https://img.shields.io/github/license/scavio-ai/scavio-mcp)

[Scavio](https://scavio.dev) is a unified [Web Search API](https://scavio.dev/docs/search-api) and MCP server that connects AI agents to Google, YouTube, Amazon, Walmart, TikTok, Instagram, Reddit, Twitter, and LinkedIn. 95 tools for web search, product lookup, video discovery, and social media data through a single [Search API](https://scavio.dev/docs/search-api) endpoint.

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
| `search_amazon` | Search product listings with price and sort filters |
| `get_amazon_product` | Get full product details by ASIN |

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

### [Twitter API](https://scavio.dev/docs/twitter-api)

| Tool | Description |
|------|-------------|
| `search_twitter` | Search tweets and people by keyword |
| `get_tweet` | Get full details for a single tweet |
| `get_tweet_comments` | Get replies to a tweet (ranked or chronological) |
| `get_tweet_retweeters` | List users who retweeted a tweet |
| `get_twitter_user` | Get a user's profile by handle |
| `get_twitter_user_tweets` | List a user's tweets |
| `get_twitter_user_replies` | List a user's tweets and replies |
| `get_twitter_user_media` | List a user's media tweets |
| `get_twitter_user_followers` | List a user's followers |
| `get_twitter_user_followings` | List accounts a user follows |
| `get_twitter_trending` | Get trending topics for a country |

### [LinkedIn API](https://scavio.dev/docs/linkedin-api)

| Tool | Description |
|------|-------------|
| `get_linkedin_person` | Get a member's full profile |
| `get_linkedin_person_about` | Get a member's about/overview metadata |
| `get_linkedin_person_posts` | List a member's recent posts |
| `get_linkedin_person_contact` | Get a member's public contact info |
| `get_linkedin_company` | Get a company's profile |
| `get_linkedin_company_posts` | List a company's recent posts |
| `get_linkedin_company_people` | List people who work at a company |
| `get_linkedin_company_jobs` | List a company's open job listings |
| `search_linkedin_people` | Search for people by name, title, company, or school |
| `search_linkedin_jobs` | Search for jobs by keyword |
| `search_linkedin_posts` | Search for posts by keyword |
| `get_linkedin_job` | Get full details for a job listing |
| `get_linkedin_post` | Get full details for a single post |
| `get_linkedin_post_comments` | Get comments on a post |

### Account

| Tool | Description |
|------|-------------|
| `get_usage` | Check credit balance, plan, and usage stats |

---

## About Scavio

[Scavio](https://scavio.dev) is a unified [search API for AI agents](https://scavio.dev/search-api-for-ai-agents) and a data API for developers. One key, structured JSON, no scraping or proxies:

- [Google Search API](https://scavio.dev/google-search-api) — SERP results, news, images, maps, and knowledge graph
- [Amazon Product API](https://scavio.dev/amazon-product-api) and [Walmart Product API](https://scavio.dev/walmart-product-api) — product search and details
- [TikTok API](https://scavio.dev/tiktok-api), [Instagram API](https://scavio.dev/instagram-api), [Reddit API](https://scavio.dev/reddit-api), [Twitter API](https://scavio.dev/twitter-api), [LinkedIn API](https://scavio.dev/linkedin-api), and [YouTube API](https://scavio.dev/youtube-transcript-api) — social and video data

Teams use it as a [SerpAPI alternative](https://scavio.dev/alternatives/serpapi) with structured multi-platform data — see [Tavily vs Scavio](https://scavio.dev/compare/tavily/vs-scavio) for a head-to-head comparison.

Get a free [Search API](https://scavio.dev/docs/search-api) key at [scavio.dev](https://scavio.dev).

---

## License

[MIT](LICENSE)
