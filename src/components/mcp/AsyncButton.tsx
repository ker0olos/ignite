import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** An outline button that disables itself until its own request settles. */
export function AsyncButton({
  onClick,
  className,
  children,
}: {
  onClick: () => Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("shrink-0", className)}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await onClick();
        setPending(false);
      }}
    >
      {children}
    </Button>
  );
}
