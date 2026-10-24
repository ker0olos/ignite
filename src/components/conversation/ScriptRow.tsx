import type { ToolProps } from "@/components/conversation/shared";
import { ScriptDone } from "@/components/conversation/ScriptDone";
import { ScriptHeader } from "@/components/conversation/ScriptHeader";
import { ToolView } from "@/components/conversation/ToolView";
import { scriptStatus, scriptSummary, tokenFooter } from "@/lib/scriptRows";
import { resultText } from "@/lib/toolLabels";

/** A script call: its header, then the calls it made as rows joined by a line through their tiles, and what it sent the agent. */
export function ScriptRow({ call, run, tools = {}, ...rest }: ToolProps) {
  const status = scriptStatus(run, tools);
  const steps = run?.nested ?? [];
  const output = resultText(run?.result);
  const footer = status === "done" ? tokenFooter(output, run) : null;
  return (
    <div data-tool-row>
      <div className="relative flex flex-col gap-5">
        {(steps.length > 0 || status === "done") && (
          <span
            aria-hidden
            className="absolute top-[26px] bottom-[30px] left-[14.5px] w-px bg-foreground/12"
          />
        )}
        <ScriptHeader
          call={call}
          status={status}
          summary={scriptSummary(status, run, tools)}
        />
        {steps.map((step) => (
          <ToolView
            key={step.id}
            {...rest}
            call={step}
            run={tools[step.id]}
            tools={tools}
          />
        ))}
        {status === "done" && <ScriptDone text={output} />}
      </div>
      {footer && (
        <p className="mt-[18px] text-xs text-muted-foreground/[.73]">
          {footer}
        </p>
      )}
    </div>
  );
}
