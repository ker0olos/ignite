import { readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { IMAGE_TYPES } from "../shared/agentTypes.ts";
import { validRange, type GitImages } from "../shared/git.ts";
import { gitBlob, gitOr } from "./worktreeGit.ts";

// Both versions cross the wire as base64, so a huge one isn't shown.
const MAX_BYTES = 20 * 1024 * 1024;

/** The object prefixes a range compares (`HEAD:`, `:` for the index); null after: the working tree. */
async function sides(repo: string, range: string) {
  if (range === "HEAD") return ["HEAD:", null] as const;
  if (range === "staged") return ["HEAD:", ":"] as const;
  const one = /^(\w+)\^!$/.exec(range);
  if (one) return [`${one[1]}^:`, `${one[1]}:`] as const;
  const [, a, three, b] = /^(\w+)\.\.(\.?)(\w+)$/.exec(range) ?? [];
  const base = three ? (await gitOr(repo, ["merge-base", a, b]))?.trim() : a;
  if (!base) throw new Error(`Couldn't find where ${range} starts.`);
  return [`${base}:`, `${b}:`] as const;
}

async function onDisk(file: string) {
  const size = await stat(file).then(
    (s) => s.size,
    () => Infinity,
  );
  return size <= MAX_BYTES ? readFile(file) : null;
}

const image = (bytes: Buffer | null, mimeType: string) =>
  bytes?.length
    ? { type: "image" as const, data: bytes.toString("base64"), mimeType }
    : undefined;

/** An image's version before and after a review's range; one is missing when it's added, deleted or too large. */
export async function fileImages(
  repo: string,
  range: string,
  path: string,
): Promise<GitImages> {
  if (!validRange(range) || range.startsWith("gh:"))
    throw new Error(`Can't show images for ${range}.`);
  const mimeType = IMAGE_TYPES[extname(path).toLowerCase()];
  const file = join(repo, path);
  if (!mimeType || relative(repo, file).startsWith(".."))
    throw new Error(`${path} isn't an image in this repository.`);
  const [was, now] = await sides(repo, range);
  const [before, after] = await Promise.all([
    gitBlob(repo, `${was}${path}`, MAX_BYTES),
    now === null ? onDisk(file) : gitBlob(repo, `${now}${path}`, MAX_BYTES),
  ]);
  return { before: image(before, mimeType), after: image(after, mimeType) };
}
