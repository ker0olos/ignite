import { StringDecoder } from "node:string_decoder";

/**
 * Splits a byte stream into lines on LF only, dropping a trailing CR. Unlike
 * Node's readline it does not split on U+2028/U+2029, which JSON strings may
 * contain. Multi-byte characters split across chunks are decoded correctly.
 */
export function createLineSplitter(onLine: (line: string) => void) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";

  function emit(chunk: string) {
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (line) onLine(line);
      newline = buffer.indexOf("\n");
    }
  }

  return {
    push: (chunk: Buffer | string) =>
      emit(typeof chunk === "string" ? chunk : decoder.write(chunk)),
    /** Flushes a final line with no trailing newline. */
    end: () => {
      emit(decoder.end());
      const last = buffer.replace(/\r$/, "");
      buffer = "";
      if (last) onLine(last);
    },
  };
}
