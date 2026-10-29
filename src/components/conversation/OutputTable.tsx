import { useState } from "react";
import { OutputValue } from "@/components/conversation/OutputValue";
import { recordColumns, type OutputRecord } from "@/lib/outputFormat";

const SHOWN = 10;

/** Records as a table, the first rows with a button for the rest. */
export function OutputTable({ records }: { records: OutputRecord[] }) {
  const [all, setAll] = useState(false);
  const columns = recordColumns(records);
  const rows = all ? records : records.slice(0, SHOWN);
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-max min-w-full text-[12px]">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="bg-muted/50 px-3 py-1.5 text-left font-medium whitespace-nowrap text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((record, i) => (
              <tr key={i} className="border-t">
                {columns.map((column) => (
                  <td
                    key={column}
                    className="max-w-80 truncate px-3 py-1.5 whitespace-nowrap"
                  >
                    <OutputValue value={record[column]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length < records.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          … +{records.length - rows.length}{" "}
          {records.length - rows.length === 1 ? "row" : "rows"}
        </button>
      )}
    </div>
  );
}
