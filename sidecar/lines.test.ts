// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createLineSplitter } from "./lines.ts";

function collect() {
  const lines: string[] = [];
  return { lines, splitter: createLineSplitter((l) => lines.push(l)) };
}

describe("createLineSplitter", () => {
  it("splits on LF and drops a trailing CR", () => {
    const { lines, splitter } = collect();
    splitter.push("a\r\nb\n");
    expect(lines).toEqual(["a", "b"]);
  });

  it("joins a line split across chunks", () => {
    const { lines, splitter } = collect();
    splitter.push('{"id":');
    splitter.push("1}\n");
    expect(lines).toEqual(['{"id":1}']);
  });

  it("keeps U+2028 inside a line, unlike readline", () => {
    const { lines, splitter } = collect();
    splitter.push('{"text":"a b"}\n');
    expect(lines).toEqual(['{"text":"a b"}']);
  });

  it("decodes a multi-byte character split across chunks", () => {
    const { lines, splitter } = collect();
    const bytes = Buffer.from("é\n");
    splitter.push(bytes.subarray(0, 1));
    splitter.push(bytes.subarray(1));
    expect(lines).toEqual(["é"]);
  });

  it("skips empty lines", () => {
    const { lines, splitter } = collect();
    splitter.push("\n\na\n");
    expect(lines).toEqual(["a"]);
  });

  it("flushes a final line without a newline on end", () => {
    const { lines, splitter } = collect();
    splitter.push("last");
    splitter.end();
    expect(lines).toEqual(["last"]);
  });

  it("emits nothing on end when the buffer is empty", () => {
    const { lines, splitter } = collect();
    splitter.push("a\n");
    splitter.end();
    expect(lines).toEqual(["a"]);
  });
});
