import { Kbd } from "@/components/agent/Kbd";
import { basename } from "@/lib/paths";
import { isMac } from "@/lib/window";

const MOD = isMac() ? "⌘" : "Ctrl+";
const SHORTCUTS = [
  ["Search everything", "K"],
  ["Open a file", "P"],
  ["New terminal", "1"],
] as const;

/** The empty area doubles as the title bar, so it drags the window. */
export function EmptyConversation({ folder }: { folder: string }) {
  return (
    <div
      data-tauri-drag-region
      className="always-bounce flex h-full flex-col items-center justify-center gap-4 px-4 text-muted-foreground"
    >
      {/* The app icon's bolt. */}
      <svg
        viewBox="21 6 24 52"
        aria-hidden
        className="pointer-events-none h-10 w-[22px]"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      >
        <path d="M37 8L23 33h10v-7z" />
        <path d="M33 26h10L27 56l6-23z" opacity={0.7} />
      </svg>
      <p className="pointer-events-none text-center text-xl tracking-tight text-foreground">
        What should we build in {basename(folder)}?
        <span className="ml-0.5 inline-block h-[1.1em] w-0.5 animate-caret bg-foreground align-[-0.18em] motion-reduce:animate-none" />
      </p>
      <ul className="pointer-events-none flex w-56 flex-col gap-2 text-[13px]">
        {SHORTCUTS.map(([label, key]) => (
          <li key={key} className="flex items-center justify-between">
            {label}
            <Kbd>
              {MOD}
              {key}
            </Kbd>
          </li>
        ))}
      </ul>
    </div>
  );
}
