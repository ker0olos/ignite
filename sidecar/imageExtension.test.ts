import { mkdtemp, truncate, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resultImages } from "../shared/agentTypes.ts";
import type { Task } from "../shared/tasks.ts";
import { loadImage, shownText } from "./imageExtension.ts";

describe("loadImage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "show-image-"));
  await writeFile(join(dir, "a.PNG"), "png bytes");
  await writeFile(join(dir, "big.jpg"), "");
  await truncate(join(dir, "big.jpg"), 21 * 1024 * 1024);

  it("reads an image relative to the folder, by extension", async () => {
    expect(await loadImage("a.PNG", dir)).toEqual({
      type: "image",
      data: Buffer.from("png bytes").toString("base64"),
      mimeType: "image/png",
    });
  });

  it("drops a leading @ and expands ~, as pi's tools do", async () => {
    expect(await loadImage("@a.PNG", dir)).toMatchObject({ type: "image" });
    expect(await loadImage("~/no-such-ignite-image.png", dir)).toBe(
      `No such file: ${join(homedir(), "no-such-ignite-image.png")}`,
    );
  });

  it("refuses other files, missing ones and huge ones", async () => {
    expect(await loadImage("/etc/hosts", dir)).toMatch(/^Not an image/);
    expect(await loadImage("gone.png", dir)).toMatch(/^No such file/);
    expect(await loadImage("big.jpg", dir)).toMatch(/^Too large/);
  });
});

describe("shownText", () => {
  const image = { type: "image" as const, data: "abc", mimeType: "image/png" };
  const task = (shown: string[]) =>
    ({ shown: shown.map((data) => ({ ...image, data, name: "x" })) }) as Task;

  it("says shown outside a task, or once it's on the card", () => {
    expect(shownText(null, image)).toBe("Shown to the user.");
    expect(shownText(task(["old", "abc"]), image)).toBe("Shown to the user.");
  });

  it("says when the task couldn't keep it", () => {
    expect(shownText(task(["old"]), image)).toMatch(/too big to add/);
    expect(shownText({} as Task, image)).toMatch(/too big to add/);
  });
});

describe("resultImages", () => {
  const image = { type: "image" as const, data: "x", mimeType: "image/png" };

  it("collects content images and show_image's detail", () => {
    expect(resultImages(undefined)).toEqual([]);
    expect(resultImages({ content: [image] })).toEqual([image]);
    expect(
      resultImages({
        content: [{ type: "text", text: "" }],
        details: { image },
      }),
    ).toEqual([image]);
    expect(resultImages({ content: [], details: { image: "no" } })).toEqual([]);
  });
});
