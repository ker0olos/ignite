/** One row of tool output read as data: a JSON object's fields. */
export type OutputRecord = Record<string, unknown>;

/** JSON in `text`, or undefined when it isn't JSON or holds an integer a double would round. */
function parseJson(text: string): unknown {
  if (!/^\s*["[{]/.test(text)) return undefined;
  let lossy = false;
  try {
    const value: unknown = JSON.parse(text, (_key, v: unknown) => {
      if (typeof v === "number" && Number.isInteger(v)) {
        lossy ||= !Number.isSafeInteger(v);
      }
      return v;
    });
    return lossy ? undefined : value;
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function isRecord(value: unknown): value is OutputRecord {
  return isObject(value) && !Array.isArray(value);
}

function isRecordList(value: unknown): value is OutputRecord[] {
  return (
    Array.isArray(value) &&
    value.every(isRecord) &&
    value.some((r) => Object.keys(r).length > 0)
  );
}

/** The text an object wraps as its only field, like an MCP server's `{"result": "…"}`; a one-line field stays JSON. */
function wrappedText(value: object): string | undefined {
  if (Array.isArray(value)) return undefined;
  const values = Object.values(value);
  const only = values.length === 1 ? values[0] : undefined;
  return typeof only === "string" && only.includes("\n") ? only : undefined;
}

// Only rows are spread out: a log line or JSON Lines output keeps its lines.
function prettyLines(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const value = parseJson(line);
      return isRecordList(value) ? JSON.stringify(value, null, 2) : line;
    })
    .join("\n");
}

/** Tool output made readable: JSON indented, a JSON string or wrapped text unescaped, a line of rows in text indented. */
export function formatOutput(text: string): string {
  const value = parseJson(text);
  if (typeof value === "string") return formatOutput(value);
  if (!isObject(value)) return prettyLines(text);
  const inner = wrappedText(value);
  return inner === undefined
    ? JSON.stringify(value, null, 2)
    : formatOutput(inner);
}

/** The records tool output holds (a JSON object, or an array of objects alone or on a line of text), if any. */
export function outputRecords(text: string): OutputRecord[] | undefined {
  const value = parseJson(text);
  if (typeof value === "string") return outputRecords(value);
  if (isObject(value)) {
    const inner = wrappedText(value);
    if (inner !== undefined) return outputRecords(inner);
    if (isRecordList(value)) return value;
    return isRecord(value) && Object.keys(value).length ? [value] : undefined;
  }
  for (const line of text.split("\n")) {
    const found = parseJson(line);
    if (isRecordList(found)) return found;
  }
  return undefined;
}

/** A record's columns: every key, in the order they first appear. */
export function recordColumns(records: OutputRecord[]): string[] {
  return [...new Set(records.flatMap((r) => Object.keys(r)))];
}
