import { useState } from "react";
import { FallbackKeyForm } from "@/components/providers/FallbackKeyForm";
import { FallbackKeyRow } from "@/components/providers/FallbackKeyRow";
import { OptionRow } from "@/components/providers/OptionRow";
import type { Option } from "@/components/providers/ConnectProviders";
import type { useFallbackKeys } from "@/hooks/useFallbackKeys";

const ADD: Option = {
  provider: "anthropic",
  method: "api_key",
  label: "Add a fallback API key",
  hint: "Pay per token",
  connectedLabel: "",
};

/** API keys the agent switches to, in order, when the Claude plan runs out. */
export function FallbackKeys({
  fallback,
}: {
  fallback: ReturnType<typeof useFallbackKeys>;
}) {
  const { keys, error, add, remove, move } = fallback;
  const [adding, setAdding] = useState(false);

  return (
    <>
      <div className="mt-3">
        <h3 className="text-[13px] font-medium">Fallback API keys</h3>
        <p className="text-xs text-muted-foreground">
          Used in order when your Claude plan runs out, until it resets.
        </p>
      </div>
      {keys?.map((info, i) => (
        <FallbackKeyRow
          key={info.id}
          info={info}
          first={i === 0}
          last={i === keys.length - 1}
          reorderable={keys.length > 1}
          onMove={(by) => void move(info.id, by)}
          onRemove={() => void remove(info.id)}
        />
      ))}
      {adding ? (
        <FallbackKeyForm
          onCancel={() => setAdding(false)}
          onSave={async (key) => {
            await add(key);
            setAdding(false);
          }}
        />
      ) : (
        <OptionRow
          option={ADD}
          disabled={false}
          onClick={() => setAdding(true)}
        />
      )}
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
