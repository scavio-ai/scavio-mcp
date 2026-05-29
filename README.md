# Scavio MCP Server

![GitHub Repo stars](https://img.shields.io/github/stars/scavio-ai/scavio-mcp?style=social)
![License](https://img.shields.io/github/license/scavio-ai/scavio-mcp)

An MCP server that connects AI agents to Google, YouTube, Amazon, Walmart, and TikTok. 19 tools for web search, product lookup, video discovery, and social media analysis through a single HTTP endpoint.

## Remote MCP Server

Connect directly to Scavio's remote MCP server without any local installation:

```
https://mcp.scavio.dev/mcp
```

Pass your API key via the `x-api-key` header. Get your key at [scavio.dev](https://scavio.dev).

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
      "type": "http",
      "url": "https://mcp.scavio.dev/mcp",
      "headers": {
        "x-api-key": "YOUR_SCAVIO_API_KEY"
      }
    }
  }
}
```

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

### Google

| Tool | Description |
|------|-------------|
| `search_google` | Web search with structured results, news, images, maps, and knowledge graph |

### YouTube

| Tool | Description |
|------|-------------|
| `search_youtube` | Search videos, channels, and playlists |
| `get_youtube_metadata` | Get video metadata including title, views, likes, and duration |

### Amazon

| Tool | Description |
|------|-------------|
| `search_amazon` | Search product listings with price and sort filters |
| `get_amazon_product` | Get full product details by ASIN |

### Walmart

| Tool | Description |
|------|-------------|
| `search_walmart` | Search product listings with price and delivery filters |
| `get_walmart_product` | Get full product details by product ID |

### TikTok

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

### Account

| Tool | Description |
|------|-------------|
| `get_usage` | Check credit balance, plan, and usage stats |

---

## License

[MIT](LICENSE)
