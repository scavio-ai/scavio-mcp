type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function stripEmpty(val: JsonValue): JsonValue | undefined {
  if (val === null || val === undefined || val === "") return undefined;

  if (Array.isArray(val)) {
    const filtered = val.map(stripEmpty).filter((v) => v !== undefined) as JsonValue[];
    return filtered.length ? filtered : undefined;
  }

  if (typeof val === "object") {
    const out: Record<string, JsonValue> = {};
    let hasKey = false;
    for (const [k, v] of Object.entries(val)) {
      const clean = stripEmpty(v as JsonValue);
      if (clean !== undefined) {
        out[k] = clean;
        hasKey = true;
      }
    }
    return hasKey ? out : undefined;
  }

  return val;
}

export function trimResponse(data: unknown): { content: [{ type: "text"; text: string }] } {
  const trimmed = stripEmpty(data as JsonValue) ?? {};
  return { content: [{ type: "text", text: JSON.stringify(trimmed) }] };
}
