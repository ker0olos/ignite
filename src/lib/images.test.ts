import { describe, expect, it } from "vitest";
import { fakeFs } from "@/test/fakeFs";
import { imageUrl, pastedImages, pickImages, toImage } from "./images";

const PNG = new Uint8Array([137, 80, 78, 71]);

describe("images", () => {
  it("encodes bytes as base64", () => {
    const image = toImage(PNG, "image/png");
    expect(image).toEqual({
      type: "image",
      data: "iVBORw==",
      mimeType: "image/png",
    });
    expect(imageUrl(image)).toBe("data:image/png;base64,iVBORw==");
  });

  it("encodes images larger than one chunk", () => {
    const big = new Uint8Array(0x8000 * 2 + 3).fill(65);
    expect(atob(toImage(big, "image/png").data)).toBe("A".repeat(big.length));
  });

  it("reads picked files with their type", async () => {
    fakeFs({ "/a/shot.PNG": PNG, "/a/photo.jpg": PNG }, (cmd) =>
      cmd === "plugin:dialog|open" ? ["/a/shot.PNG", "/a/photo.jpg"] : null,
    );
    const images = await pickImages();
    expect(images.map((i) => i.mimeType)).toEqual(["image/png", "image/jpeg"]);
  });

  it("attaches nothing when the picker is cancelled", async () => {
    fakeFs({}, () => null);
    expect(await pickImages()).toEqual([]);
  });

  it("keeps only images from a paste", async () => {
    const files = [
      new File([PNG], "shot.png", { type: "image/png" }),
      new File(["hi"], "notes.txt", { type: "text/plain" }),
    ];
    const images = await pastedImages({ files } as unknown as DataTransfer);
    expect(images).toEqual([toImage(PNG, "image/png")]);
  });
});
