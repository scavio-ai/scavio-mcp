import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ApiError } from "./errors.js";

/**
 * The catch block every tool handler shares.
 *
 * This lived as a verbatim copy-paste inside each of the tool modules (plus an
 * inlined 32nd copy in usage.ts). At 11 files that was tolerable; at 33 it was
 * a guaranteed drift surface, so it lives here now and is imported.
 *
 * Two distinct error channels, deliberately:
 *  - 401 throws an McpError, because a bad key is a configuration fault the
 *    agent cannot recover from by retrying or rewording — the client should
 *    surface it to the human.
 *  - everything else returns `isError: true`, which the model can read and act
 *    on (back off on a 429, try another id on a 404) instead of the call
 *    blowing up the turn.
 */
export function handleApiError(err: unknown): never | { isError: true; content: { type: "text"; text: string }[] } {
  if (err instanceof ApiError) {
    if (err.status === 429) return { isError: true, content: [{ type: "text", text: "Rate limited. Wait and retry." }] };
    // The API's 402 body carries billing_url; the bare "Insufficient credits"
    // string used to be all the model saw, so it could not tell the user where
    // to go. Surface the link, and say that nothing needs reconfiguring.
    if (err.status === 402) {
      const url = err.billingUrl ?? "https://dashboard.scavio.dev/billing";
      return {
        isError: true,
        content: [{ type: "text", text: `Out of Scavio credits (402). Top up or upgrade at ${url}; the same key keeps working afterwards, no config change needed.` }],
      };
    }
    if (err.status === 401) throw new McpError(ErrorCode.InternalError, "Invalid SCAVIO_API_KEY. Check your configuration.");
    return { isError: true, content: [{ type: "text", text: `Scavio API error (${err.status}): ${err.message}` }] };
  }
  throw new McpError(ErrorCode.InternalError, String(err));
}
