# Scavio MCP Server - LLM Installation Guide

Scavio is a unified search API for AI agents: Google (SERP, AI Mode, Maps, Shopping, Flights, Hotels, News, Trends), YouTube, Amazon, Walmart, TikTok, Instagram, and Reddit. 46 tools, one API key.

## Prerequisites

1. A Scavio API key. The user must sign up at https://dashboard.scavio.dev (free, 50 signup credits, no credit card) and create a key on the API Keys page. Keys start with `sk_live_` or `sk_test_`.
2. For local (stdio) installation: Node.js 20 or later.

Ask the user for their API key before configuring. Never invent or reuse a placeholder key.

## Option A: Remote server (recommended, no installation)

Configure an HTTP MCP server:

- URL: `https://mcp.scavio.dev/mcp`
- Transport: streamable HTTP
- Header: `x-api-key: <USER_API_KEY>`

Cline `cline_mcp_settings.json` entry:

```json
{
  "mcpServers": {
    "scavio": {
      "type": "http",
      "url": "https://mcp.scavio.dev/mcp",
      "headers": {
        "x-api-key": "USER_API_KEY_HERE"
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
        "SCAVIO_API_KEY": "USER_API_KEY_HERE"
      }
    }
  }
}
```

## Verify the installation

Call the `get_usage` tool. A successful response returns the account plan and credit balance. If it returns 401, the API key is wrong or missing.

## Troubleshooting

- 401 Unauthorized: key missing/typo. Remote uses the `x-api-key` header; local uses the `SCAVIO_API_KEY` env var.
- 402 Insufficient credits: the account is out of credits; top up at https://dashboard.scavio.dev/billing.
- 429 Rate limited: the plan's concurrency limit was hit; retry after a moment.
- Local server exits immediately: check Node.js >= 20 (`node --version`).
