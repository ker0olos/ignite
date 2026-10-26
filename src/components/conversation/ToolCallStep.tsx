import type { ToolProps } from "@/components/conversation/shared";
import { ToolCallBody } from "@/components/conversation/ToolCallBody";
import { ToolCallHead } from "@/components/conversation/ToolCallHead";
import { ToolRowFrame } from "@/components/conversation/ToolRowFrame";
import { useStreamedCall } from "@/hooks/useStreamedCall";
import { BADGE_CLASSES, callReason, toolBadge } from "@/lib/toolLabels";
import { cn } from "@/lib/utils";

/** One step under a shared tile: a dot on the line in the tile's column, the call beside it (`titled` under Explore, where tools differ). */
export function ToolCallStep({
  last,
  titled,
  ...props
}: ToolProps & { last: boolean; titled: boolean }) {
  const { call, run } = props;
  const shown = useStreamedCall(call);
  const why = run?.approval ? "" : callReason(call);
  return (
    <div className="relative">
      {!last && (
        <span
          aria-hidden
          className="absolute top-3 -bottom-6 left-[14.5px] w-px bg-foreground/12"
        />
      )}
      <ToolRowFrame
        tile={
          <span className="relative z-[1] flex w-[30px] shrink-0 justify-center pt-[7px]">
            <span
              className={cn(
                "size-[7px] rounded-full ring-[3px] ring-background",
                BADGE_CLASSES[(!run?.cancelled && toolBadge(run)) || "ok"],
              )}
            />
          </span>
        }
        head={
          <>
            <ToolCallHead
              call={shown}
              run={run}
              folder={props.folder}
              grouped={!titled}
            />
            {why && <p className="text-[13.5px] text-foreground/85">{why}</p>}
          </>
        }
      >
        <ToolCallBody {...props} shown={shown} />
      </ToolRowFrame>
    </div>
  );
}
