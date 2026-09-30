import { useEffect, useState } from "react";
import { fitScale } from "@/lib/markup";

/**
 * The image loaded for drawing on, and how far it's scaled to fit `box` (see
 * `fitScale`); 0 until both are known.
 */
export function useMarkupImage(
  src: string,
  vector: boolean,
  box: { width: number; height: number },
) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => live && setImage(img);
    img.src = src;
    return () => {
      live = false;
    };
  }, [src]);

  const scale =
    image && box.width && box.height
      ? fitScale(
          { width: image.naturalWidth, height: image.naturalHeight },
          box,
          vector,
        )
      : 0;
  return { image, scale };
}
