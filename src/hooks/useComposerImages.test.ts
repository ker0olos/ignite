import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import type { ImageContent } from "../../shared/agentTypes";
import { useComposerImages } from "@/hooks/useComposerImages";
import { imageName, named } from "@/lib/images";
import { currentImageTarget } from "@/lib/imageTarget";

const image = (data: string): ImageContent => ({
  type: "image",
  data,
  mimeType: "image/png",
});

it("keeps the file name an image came from when it's marked up", () => {
  const { result } = renderHook(() => {
    const [images, setImages] = useState([
      named(image("QQ=="), "shot.png"),
      image("Qg=="),
    ]);
    return {
      images,
      ...useComposerImages(
        { current: null },
        "",
        () => {},
        images,
        setImages,
        () => {},
      ),
    };
  });
  act(() => result.current.replace(0, image("Qw==")));
  act(() => result.current.replace(1, image("RA==")));
  expect(result.current.images.map((i) => i.data)).toEqual(["Qw==", "RA=="]);
  expect(result.current.images.map(imageName)).toEqual(["shot.png", undefined]);
});

it("keeps the name an image comes to it with", () => {
  const remove = renderHook(() =>
    useComposerImages(
      { current: null },
      "",
      () => {},
      [],
      () => {},
      () => {},
    ),
  );
  const shown = currentImageTarget()!;
  const added = image("RQ==");
  shown.add(added, "artifact.png");
  expect(imageName(added)).toBe("artifact.png");
  remove.unmount();
});
