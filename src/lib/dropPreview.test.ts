import { describe, expect, it } from "vitest";
import { dropPreview, peekDrop } from "@/lib/dropPreview";

const peek = (
  folders: string[],
  images: string[] = [],
  files: string[] = [],
) => ({
  folders,
  images,
  files,
});

describe("dropPreview", () => {
  it("opens folders, naming one, two, or two and how many more", () => {
    expect(dropPreview(peek(["app"]))).toEqual({
      kind: "folder",
      title: "Open folder",
      detail: "app will be added to your folders.",
    });
    expect(dropPreview(peek(["app", "web"]))?.detail).toBe(
      "app and web will be added to your folders.",
    );
    expect(dropPreview(peek(["a", "b", "c", "d"]))).toMatchObject({
      title: "Open folders",
      detail: "a, b and 2 more will be added to your folders.",
    });
  });

  it("attaches images, naming one and counting more", () => {
    expect(dropPreview(peek([], ["shot.png"]))).toEqual({
      kind: "image",
      title: "Attach image",
      detail: "shot.png will be attached to this conversation.",
    });
    expect(dropPreview(peek([], ["a.png", "b.png"]))).toMatchObject({
      kind: "image",
      title: "Attach images",
      detail: "2 images will be attached to this conversation.",
    });
  });

  it("counts images among other files as files", () => {
    expect(dropPreview(peek([], [], ["report.pdf"]))).toMatchObject({
      kind: "file",
      title: "Attach file",
      detail: "report.pdf will be attached to this conversation.",
    });
    expect(dropPreview(peek([], ["a.png"], ["report.pdf"]))).toMatchObject({
      kind: "file",
      title: "Attach files",
      detail: "2 files will be attached to this conversation.",
    });
  });

  it("says both for folders with files or images", () => {
    expect(dropPreview(peek(["app"], ["a.png"], ["b.txt"]))).toEqual({
      kind: "mixed",
      title: "Open folder, attach files",
      detail:
        "app will be added to your folders.\n2 files will be attached to this conversation.",
    });
    expect(dropPreview(peek(["a", "b"], ["x.png"]))?.title).toBe(
      "Open folders, attach image",
    );
  });

  it("leaves out what the input showing can't take, and shows nothing when that's all", () => {
    const takesImages = { images: true, files: false };
    expect(
      dropPreview(peek([], ["a.png"], ["b.txt"]), takesImages),
    ).toMatchObject({
      kind: "image",
      detail: "a.png will be attached to this conversation.",
    });
    expect(dropPreview(peek([], [], ["b.txt"]), takesImages)).toBeNull();
    const nothing = { images: false, files: false };
    expect(dropPreview(peek(["app"], ["a.png"]), nothing)?.kind).toBe("folder");
    expect(dropPreview(peek([]))).toBeNull();
  });
});

describe("peekDrop", () => {
  it("sorts paths by name into folders, images and files, skipping one it can't stat", async () => {
    const isDir = async (p: string) => {
      if (p === "/gone") throw new Error("missing");
      return p === "/p/app";
    };
    expect(
      await peekDrop(["/p/app", "/p/Shot.JPG", "/p/notes.txt", "/gone"], isDir),
    ).toEqual({ folders: ["app"], images: ["Shot.JPG"], files: ["notes.txt"] });
  });
});
