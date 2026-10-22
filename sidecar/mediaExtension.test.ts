import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  truncate,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findVideo, loadAudio } from "./mediaExtension.ts";

describe("loadAudio and findVideo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "show-media-"));
  await writeFile(join(dir, "a.MP3"), "mp3 bytes");
  await writeFile(join(dir, "big.wav"), "");
  await truncate(join(dir, "big.wav"), 11 * 1024 * 1024);
  await writeFile(join(dir, "clip.mp4"), "mp4 bytes");
  const media = join(dir, "media");

  it("reads audio relative to the folder, by extension", async () => {
    expect(await loadAudio("a.MP3", dir)).toEqual({
      type: "audio",
      data: Buffer.from("mp3 bytes").toString("base64"),
      mimeType: "audio/mpeg",
    });
  });

  it("refuses other files, missing ones, folders and huge audio", async () => {
    expect(await loadAudio("clip.mp4", dir)).toMatch(/^Not a supported file/);
    expect(await loadAudio("gone.wav", dir)).toMatch(/^No such file/);
    expect(await loadAudio("big.wav", dir)).toMatch(
      /^Too large \(over 10 MB\)/,
    );
    expect(await findVideo(".", dir)).toMatch(/^Not a supported file/);
  });

  it("copies a video into the media folder, named by its content", async () => {
    const hash = createHash("sha256")
      .update("mp4 bytes")
      .digest("hex")
      .slice(0, 16);
    expect(await findVideo("@clip.mp4", dir, media)).toEqual({
      type: "video",
      path: join(media, `${hash}.mp4`),
      mimeType: "video/mp4",
    });
    expect(await readFile(join(media, `${hash}.mp4`), "utf8")).toBe(
      "mp4 bytes",
    );
    expect(await findVideo("gone.webm", dir, media)).toMatch(/^No such file/);
  });

  it("reuses the copy when the same video is shown again", async () => {
    await writeFile(join(dir, "same.mp4"), "mp4 bytes");
    const first = await findVideo("clip.mp4", dir, media);
    const second = await findVideo("same.mp4", dir, media);
    expect(second).toEqual(first);
    expect(await readdir(media)).toHaveLength(1);
  });
});
