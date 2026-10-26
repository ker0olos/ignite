import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

/** The app's on/off switch: a dot on a thin line, like the marks joining grouped tool calls; on slides the dot across and fills the line. */
export function RailSwitch({
  className,
  ...props
}: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full outline-none after:absolute after:-inset-x-2 after:-inset-y-2 focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        // The line, behind the dot.
        "before:absolute before:inset-x-1 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:rounded-full before:bg-input before:transition-colors data-checked:before:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="relative block size-3 translate-x-0.5 rounded-full bg-card shadow-[inset_0_0_0_2px_var(--muted-foreground)] transition-[translate,background-color,box-shadow] data-checked:translate-x-[22px] data-checked:bg-primary data-checked:shadow-[0_0_0_3px_var(--card)] motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}
