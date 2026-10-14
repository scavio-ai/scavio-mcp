import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ScavioClient } from "../lib/client.js";
import { handleApiError } from "../lib/tool-error.js";
import { trimResponse } from "../lib/trim-response.js";

// Shapes mirror backend/src/routes/ai-chat.ts field for field (names, regexes,
// max lengths). Both tools return the same response shape, so an agent that
// compares assistants parses one schema.
//
// No zod `.default()` anywhere in this file. The MCP SDK applies a zod default
// BEFORE the handler runs, so a defaulted field is posted on every call whether
// the model set it or not. Defaults are documented in the describe text and
// left for the backend to apply.
//
// Answers take 10-40s. The client sets no fetch deadline of its own, so these
// calls are not cut off before the API answers.

const SHAPE =
  "Returns answer.markdown (the full answer with inline citation links), sources[] (cited pages), " +
  "search_queries[] and shopping[] (products the answer recommends, in order).";

export function registerChatgptTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "chatgpt_prompt",
    `Ask ChatGPT a prompt and get the answer it gives a user: the full Markdown answer, every page it cites (url, title, publisher, date), the web searches it ran, and the products it recommended. Use for AI visibility and brand monitoring: what does ChatGPT recommend for "best CRM for agencies", is a brand mentioned, which competitors and which pages it cites. ${SHAPE} Each call is a fresh answer; takes 10-40s. 2 credits; failed prompts are free.`,
    {
      prompt: z.string().min(1).max(1024)
        .describe("The prompt, up to 1024 characters. Phrase it the way a buyer would ask."),
      model: z.string().regex(/^[a-z0-9][a-z0-9.\-]{0,39}$/, "model must be a model id such as auto").optional()
        .describe("Model to answer with. Default 'auto', the model ChatGPT picks by default."),
      country: z.string().regex(/^[A-Za-z]{2}$/, "country must be a 2-letter country code").optional()
        .describe("2-letter country code the answer is localized for, e.g. 'gb'. Default 'us'."),
      include_html: z.boolean().optional()
        .describe("Also return the answer as HTML in answer.html. Default false; leave off unless HTML is needed."),
    },
    async (params) => {
      try {
        return trimResponse(await getClient().post("/api/v1/chatgpt/prompt", params));
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}

export function registerGeminiTools(server: McpServer, getClient: () => ScavioClient) {
  server.tool(
    "gemini_prompt",
    `Ask Google Gemini a prompt and get the answer it gives a user: the full Markdown answer, the URLs it cites, and the products it recommended. Use for AI visibility and brand monitoring alongside chatgpt_prompt: what does Gemini recommend for a buyer's question, is a brand mentioned, which sites it cites. ${SHAPE} Gemini sources carry the URL only; search_queries is always empty. Each call is a fresh answer; takes 10-40s. 5 credits; failed prompts are free.`,
    {
      prompt: z.string().min(1).max(4000)
        .describe("The prompt, up to 4000 characters. Phrase it the way a buyer would ask."),
    },
    async (params) => {
      try {
        return trimResponse(await getClient().post("/api/v1/gemini/prompt", params));
      } catch (err) {
        return handleApiError(err);
      }
    },
  );
}
