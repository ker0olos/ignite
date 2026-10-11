/** A raw CDP result for the model: long base64 data (screenshots, PDFs, bodies) saved to files instead of inlined. */
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { APP_NAME } from "../src/lib/app.ts";

/** Shorter strings stay inline. */
const MIN_BLOB = 2048;
const BASE64 = /^[A-Za-z0-9+/\r\n]+={0,2}$/;

const EXTENSION: Record<string, string> = {
  "Page.captureScreenshot": "png",
  "Page.printToPDF": "pdf",
};

/** `value` with each long base64 string written to a temp file and replaced by a note naming it. */
export async function savedBlobs(
  value: unknown,
  method: string,
  params: Record<string, unknown> | undefined,
  id: string,
): Promise<unknown> {
  let n = 0;
  const ext =
    (params?.format as string | undefined) ?? EXTENSION[method] ?? "bin";
  const walk = async (v: unknown): Promise<unknown> => {
    if (typeof v === "string" && v.length >= MIN_BLOB && BASE64.test(v)) {
      const file = join(tmpdir(), `${APP_NAME}-cdp-${id}-${n++}.${ext}`);
      await writeFile(file, Buffer.from(v, "base64"));
      return `[${Math.round((v.length * 3) / 4 / 1024)} KB of base64 data, saved to ${file}]`;
    }
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === "object") {
      const entries = await Promise.all(
        Object.entries(v).map(async ([k, x]) => [k, await walk(x)] as const),
      );
      return Object.fromEntries(entries);
    }
    return v;
  };
  return walk(value);
}
