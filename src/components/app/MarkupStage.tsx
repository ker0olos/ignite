import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useRef, type RefObject } from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import { MarkupMark } from "@/components/app/MarkupMark";
import type { useMarkup } from "@/hooks/useMarkup";
import type { useMarkupView } from "@/hooks/useMarkupView";

type Point = { x: number; y: number };
type PointerEv = KonvaEventObject<PointerEvent>;

/**
 * The image and its marks, fitted by `fit` and zoomed by `view`. One pointer
 * draws; two touches pinch-zoom and pan. `layer` holds only the image and
 * marks, so it exports as the marked-up image.
 */
export function MarkupStage({
  image,
  fit,
  markup,
  view,
  layer,
}: {
  image: HTMLImageElement;
  fit: number;
  markup: ReturnType<typeof useMarkup>;
  view: ReturnType<typeof useMarkupView>;
  layer: RefObject<Konva.Layer | null>;
}) {
  const touches = useRef(new Map<number, Point>());
  const { scale, x, y } = view.view;

  const onImage = (e: PointerEv) =>
    e.target.getStage()?.getRelativePointerPosition();
  const onScreen = (e: PointerEv): Point => {
    const box = e.currentTarget.getStage()!.container().getBoundingClientRect();
    return { x: e.evt.clientX - box.left, y: e.evt.clientY - box.top };
  };
  const pair = () => [...touches.current.values()] as [Point, Point];

  const down = (e: PointerEv) => {
    // Captured, a stroke follows the pointer off the image and back until release.
    (e.evt.target as Element).setPointerCapture(e.evt.pointerId);
    touches.current.set(e.evt.pointerId, onScreen(e));
    if (touches.current.size > 1) return markup.cancel();
    const p = onImage(e);
    if (p) markup.begin(p);
  };
  const move = (e: PointerEv) => {
    const id = e.evt.pointerId;
    if (touches.current.size === 2 && touches.current.has(id)) {
      const from = pair();
      touches.current.set(id, onScreen(e));
      return view.pinch(from, pair());
    }
    const p = onImage(e);
    if (p && markup.draft) markup.extend(p);
  };
  const up = (e: PointerEv) => {
    touches.current.delete(e.evt.pointerId);
    markup.end();
  };

  return (
    <Stage
      width={image.naturalWidth * fit}
      height={image.naturalHeight * fit}
      scaleX={fit * scale}
      scaleY={fit * scale}
      x={x}
      y={y}
      className={
        markup.tool === "text"
          ? "touch-none cursor-text"
          : "touch-none cursor-crosshair"
      }
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onWheel={(e) => {
        e.evt.preventDefault();
        const at = e.target.getStage()?.getPointerPosition();
        if (at) view.wheel(e.evt, at);
      }}
    >
      <Layer ref={layer} listening={false}>
        <KonvaImage image={image} />
        {markup.marks.map((mark) => (
          <MarkupMark key={mark.id} mark={mark} />
        ))}
        {markup.draft && <MarkupMark mark={markup.draft} />}
      </Layer>
    </Stage>
  );
}
