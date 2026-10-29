import { describe, expect, it } from "vitest";
import { formatOutput, outputRecords, recordColumns } from "@/lib/outputFormat";

describe("outputRecords", () => {
  it("reads an array of objects", () => {
    expect(outputRecords('[{"a":1},{"b":2}]')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("reads one object as one record", () => {
    expect(outputRecords('{"a":1,"b":2}')).toEqual([{ a: 1, b: 2 }]);
  });

  it("finds the rows in an MCP result's text", () => {
    const inner = 'Rows:\n<data>\n[{"id":"x"}]\n</data>';
    expect(outputRecords(JSON.stringify({ result: inner }))).toEqual([
      { id: "x" },
    ]);
  });

  it("reads a JSON string's contents", () => {
    expect(outputRecords(JSON.stringify('[{"a":1}]'))).toEqual([{ a: 1 }]);
  });

  it("has none for plain text, empty arrays or arrays of other values", () => {
    expect(outputRecords("ok\ndone")).toBeUndefined();
    expect(outputRecords("[]")).toBeUndefined();
    expect(outputRecords("[1,2]")).toBeUndefined();
    expect(outputRecords('[{"a":1},[2]]')).toBeUndefined();
    expect(outputRecords("text\n[1]")).toBeUndefined();
    expect(outputRecords("{}")).toBeUndefined();
    expect(outputRecords("[{}]")).toBeUndefined();
  });

  it("takes no single object or JSON Lines out of text, only a line of rows", () => {
    expect(outputRecords('build\n{"level":"info"}\ndone')).toBeUndefined();
    expect(outputRecords('{"a":1}\n{"a":2}')).toBeUndefined();
    expect(outputRecords('ids:\n[1,2]\n[{"id":1}]')).toEqual([{ id: 1 }]);
  });

  it("has none when an integer would be rounded", () => {
    expect(outputRecords('[{"id":1234567890123456789}]')).toBeUndefined();
  });
});

describe("recordColumns", () => {
  it("lists every key once, in first-seen order", () => {
    expect(
      recordColumns([
        { a: 1, b: 2 },
        { c: 3, a: 4 },
      ]),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("formatOutput", () => {
  it("indents JSON", () => {
    expect(formatOutput('{"a":1,"b":[2]}')).toBe(
      '{\n  "a": 1,\n  "b": [\n    2\n  ]\n}',
    );
  });

  it("unwraps an object holding only a string, indenting JSON lines in it", () => {
    const inner = 'Rows:\n<data>\n[{"id":"x"}]\n</data>';
    expect(formatOutput(JSON.stringify({ result: inner }))).toBe(
      'Rows:\n<data>\n[\n  {\n    "id": "x"\n  }\n]\n</data>',
    );
  });

  it("unescapes a JSON string", () => {
    expect(formatOutput('"a\\nb"')).toBe("a\nb");
  });

  it("keeps an object with one non-string value as JSON", () => {
    expect(formatOutput('{"n":1}')).toBe('{\n  "n": 1\n}');
  });

  it("keeps a one-line field's key", () => {
    expect(formatOutput('{"error":"denied"}')).toBe(
      '{\n  "error": "denied"\n}',
    );
  });

  it("leaves log lines and integers a double would round as written", () => {
    const log = 'start\n{"level":"info","msg":"ready"}\n[1,2]';
    expect(formatOutput(log)).toBe(log);
    const big = '{"id":1234567890123456789}';
    expect(formatOutput(big)).toBe(big);
  });

  it("leaves plain text and broken JSON alone", () => {
    expect(formatOutput("ok\n42\n{not json")).toBe("ok\n42\n{not json");
  });
});
