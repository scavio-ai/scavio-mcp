import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Read from package.json rather than a literal. The literal drifted to five
 * minor versions behind npm, and it is the version every client is handed
 * during `initialize` and in the User-Agent of every API call. src/lib/ and
 * dist/lib/ are both two levels under the package root, so this resolves
 * identically under tsx and under node dist/index.js.
 */
export const SERVER_VERSION: string = (
  JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json"), "utf8"),
  ) as { version: string }
).version;
