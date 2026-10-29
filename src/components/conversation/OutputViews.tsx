import { useState } from "react";
import { OutputFields } from "@/components/conversation/OutputFields";
import { OutputTable } from "@/components/conversation/OutputTable";
import { OutputText } from "@/components/conversation/OutputText";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OutputRecord } from "@/lib/outputFormat";

type View = "table" | "fields" | "raw";

/** JSON records in tool output, switchable between a table, one record's fields and the raw text. */
export function OutputViews({
  text,
  records,
}: {
  text: string;
  records: OutputRecord[];
}) {
  const [view, setView] = useState<View>(
    records.length > 1 ? "table" : "fields",
  );
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground">
          {records.length} {records.length === 1 ? "row" : "rows"}
        </span>
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as View)}
          className="ml-auto"
        >
          <TabsList className="group-data-horizontal/tabs:h-6">
            {(["table", "fields", "raw"] as const).map((v) => (
              <TabsTrigger key={v} value={v} className="px-2 text-xs">
                {v[0].toUpperCase() + v.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {view === "table" && <OutputTable records={records} />}
      {view === "fields" && <OutputFields records={records} />}
      {view === "raw" && <OutputText text={text} />}
    </div>
  );
}
