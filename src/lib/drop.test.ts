import { describe, expect, it } from "vitest";
import { sortDrop } from "@/lib/drop";
import { imageName } from "@/lib/images";

const bytes = (text: string) => new TextEncoder().encode(text);

const fakeFs = (files: Record<string, Uint8Array | "dir">) => ({
  stat: async (path: string) => {
    const f = files[path];
    if (!f) throw new Error("missing");
    return { isDirectory: f === "dir", size: f === "dir" ? 0 : f.length };
  },
  read: async (path: string) => files[path] as Uint8Array,
});

describe("sortDrop", () => {
  it("opens folders, attaches images, and sends small text files in full", async () => {
    const fs = fakeFs({
      "/p/app": "dir",
      "/p/shot.PNG": new Uint8Array([137, 80]),
      "/p/notes.txt": bytes("hello"),
    });
    const dropped = await sortDrop(
      ["/p/app", "/p/shot.PNG", "/p/notes.txt"],
      fs,
    );
    expect(dropped.folders).toEqual(["/p/app"]);
    expect(dropped.images).toEqual([
      {
        image: { type: "image", data: "iVA=", mimeType: "image/png" },
        name: "shot.PNG",
      },
    ]);
    expect(imageName(dropped.images[0].image)).toBe("shot.PNG");
    expect(dropped.files).toEqual([{ path: "/p/notes.txt", text: "hello" }]);
  });

  it("sends a binary, non-UTF-8 or large file by its path, and skips one it can't read", async () => {
    const fs = fakeFs({
      "/p/a.pdf": new Uint8Array([37, 80, 0, 1]),
      "/p/latin1.txt": new Uint8Array([0xe9, 0x41]),
      "/p/big.log": bytes("x".repeat(200_001)),
    });
    const dropped = await sortDrop(
      ["/p/a.pdf", "/p/latin1.txt", "/p/big.log", "/p/gone.txt"],
      fs,
    );
    expect(dropped.files).toEqual([
      { path: "/p/a.pdf" },
      { path: "/p/latin1.txt" },
      { path: "/p/big.log" },
    ]);
    expect(dropped.folders).toEqual([]);
  });

  it("sends text in full only up to the drop's total, the rest by path, in drop order", async () => {
    const big = bytes("x".repeat(190_000));
    const fs = fakeFs({
      "/a.txt": big,
      "/b.txt": big,
      "/c.txt": big,
      "/d.txt": bytes("hi"),
    });
    const dropped = await sortDrop(
      ["/a.txt", "/b.txt", "/c.txt", "/d.txt"],
      fs,
    );
    expect(dropped.files.map((f) => [f.path, f.text !== undefined])).toEqual([
      ["/a.txt", true],
      ["/b.txt", true],
      ["/c.txt", false],
      ["/d.txt", false],
    ]);
  });
});
