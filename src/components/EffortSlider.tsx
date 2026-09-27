import { useEffect, useRef, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import type { ThinkingLevel } from "../../shared/hostProtocol";
import { effortColor, nearestStep, resist } from "@/lib/effortSlider";
import { EFFORT_LABELS } from "@/lib/modelMenu";

const WIDTH = 176;
const DRAG = { tension: 700, friction: 32 };
const SETTLE = { tension: 520, friction: 16 };

/** Effort as a draggable slider with a detent at each level pi offers. */
export function EffortSlider({
  levels,
  value,
  onChange,
}: {
  levels: ThinkingLevel[];
  value: ThinkingLevel;
  onChange: (level: ThinkingLevel) => void;
}) {
  const steps = levels.length;
  const index = Math.max(0, levels.indexOf(value));
  const at = (i: number) => (i / (steps - 1)) * WIDTH;
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [{ x }, api] = useSpring(() => ({ x: at(index), config: SETTLE }));

  useEffect(() => {
    if (!dragging.current) void api.start({ x: at(index), config: SETTLE });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, steps]);

  const follow = (clientX: number) => {
    const raw = clientX - track.current!.getBoundingClientRect().left;
    void api.start({ x: resist(raw, WIDTH, steps), config: DRAG });
    setPreview(nearestStep(raw, WIDTH, steps));
  };

  const commit = (i: number) => {
    void api.start({ x: at(i), config: SETTLE });
    if (i !== index) onChange(levels[i]);
  };

  const color = x.to((v) => effortColor(v / WIDTH));
  const shown = preview ?? index;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Effort"
      aria-valuemin={0}
      aria-valuemax={steps - 1}
      aria-valuenow={index}
      aria-valuetext={EFFORT_LABELS[value]}
      className="group/effort flex cursor-grab touch-none flex-col gap-2 px-2 pt-1.5 pb-2.5 outline-none select-none active:cursor-grabbing"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        follow(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && follow(e.clientX)}
      onPointerUp={(e) => {
        if (!dragging.current) return;
        dragging.current = false;
        setPreview(null);
        const raw = e.clientX - track.current!.getBoundingClientRect().left;
        commit(nearestStep(raw, WIDTH, steps));
      }}
      onPointerCancel={() => {
        dragging.current = false;
        setPreview(null);
        commit(index);
      }}
      onKeyDown={(e) => {
        const step = {
          ArrowRight: 1,
          ArrowUp: 1,
          ArrowLeft: -1,
          ArrowDown: -1,
        }[e.key];
        if (!step) return;
        // Keeps the menu from moving focus between items.
        e.preventDefault();
        e.stopPropagation();
        commit(Math.min(steps - 1, Math.max(0, index + step)));
      }}
    >
      <div className="flex items-baseline justify-between text-[13px]">
        <span className="text-muted-foreground">Effort</span>
        <span>{EFFORT_LABELS[levels[shown]]}</span>
      </div>
      <div
        ref={track}
        className="relative my-1.5 h-1 rounded-full bg-muted"
        style={{ width: WIDTH }}
      >
        {levels.map((level, i) => (
          <span
            key={level}
            className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/40"
            style={{ left: at(i) }}
          />
        ))}
        <animated.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: x.to((v) => Math.max(0, v)), background: color }}
        />
        <animated.div
          className="absolute top-1/2 size-3 rounded-full shadow-sm ring-2 ring-popover group-focus-visible/effort:ring-ring"
          style={{ x: x.to((v) => v - 6), y: "-50%", background: color }}
        />
      </div>
    </div>
  );
}
