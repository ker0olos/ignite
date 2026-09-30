import { Arrow, Ellipse, Line, Rect, Text } from "react-konva";
import { MARKUP_FONT, TEXT_SCALE, type Mark } from "@/lib/markup";

/** A mark's drawing, from its own origin; its group places it on the image. */
export function MarkupShape({ mark }: { mark: Mark }) {
  const { kind, color, size, points, width, height } = mark;
  const stroke = {
    stroke: color,
    strokeWidth: size,
    lineCap: "round" as const,
    lineJoin: "round" as const,
  };
  switch (kind) {
    case "pen":
      return <Line points={points} tension={0.4} {...stroke} />;
    case "highlighter":
      return <Line points={points} tension={0.4} {...stroke} opacity={0.35} />;
    case "arrow":
      return (
        <Arrow
          points={points}
          fill={color}
          pointerLength={size * 4}
          pointerWidth={size * 4}
          {...stroke}
        />
      );
    case "rect":
      return (
        <Rect
          x={Math.min(0, width)}
          y={Math.min(0, height)}
          width={Math.abs(width)}
          height={Math.abs(height)}
          cornerRadius={size}
          {...stroke}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          x={width / 2}
          y={height / 2}
          radiusX={Math.abs(width) / 2}
          radiusY={Math.abs(height) / 2}
          {...stroke}
        />
      );
    case "text":
      return (
        <Text
          text={mark.text}
          fill={color}
          fontSize={size * TEXT_SCALE}
          fontFamily={MARKUP_FONT}
          fontStyle="bold"
          lineHeight={1.2}
        />
      );
  }
}
