import { Group } from "react-konva";
import { MarkupShape } from "@/components/app/MarkupShape";
import type { Mark } from "@/lib/markup";

/** One mark on the image, drawn from where it started. */
export function MarkupMark({ mark }: { mark: Mark }) {
  return (
    <Group x={mark.x} y={mark.y} listening={false}>
      <MarkupShape mark={mark} />
    </Group>
  );
}
