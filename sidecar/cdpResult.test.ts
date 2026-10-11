// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { savedBlobs } from "./cdpResult.ts";

const png = Buffer.alloc(3000, 7).toString("base64");

it("saves long base64 strings to files and names them instead", async () => {
  const out = (await savedBlobs(
    { data: png, nested: [{ body: png }], note: "short", n: 1 },
    "Page.captureScreenshot",
    undefined,
    "t1",
  )) as { data: string; nested: { body: string }[]; note: string; n: number };
  const file = /saved to (\S+)\]$/.exec(out.data)![1];
  expect(file).toMatch(/cdp-t1-0\.png$/);
  expect(readFileSync(file).equals(Buffer.alloc(3000, 7))).toBe(true);
  expect(out.data).toMatch(/^\[3 KB of base64 data/);
  expect(out.nested[0].body).toMatch(/cdp-t1-1\.png\]$/);
  expect(out).toMatchObject({ note: "short", n: 1 });
});

it("names files by the asked format, and leaves long plain text inline", async () => {
  const out = await savedBlobs(
    png,
    "Page.captureScreenshot",
    { format: "jpeg" },
    "t2",
  );
  expect(out).toMatch(/cdp-t2-0\.jpeg\]$/);
  const prose = "word ".repeat(1000);
  expect(await savedBlobs({ prose }, "Runtime.evaluate", {}, "t3")).toEqual({
    prose,
  });
  expect(await savedBlobs(png, "Network.getResponseBody", {}, "t4")).toMatch(
    /\.bin\]$/,
  );
});
