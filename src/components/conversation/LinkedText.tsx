import { openUrl } from "@tauri-apps/plugin-opener";
import { splitLinks } from "@/lib/links";

/** Plain text with its URLs clickable, opening in the browser. */
export function LinkedText({ text }: { text: string }) {
  return splitLinks(text).map((part, i) =>
    part.url ? (
      <a
        key={i}
        href={part.text}
        className="underline decoration-current/40 underline-offset-2 hover:decoration-current"
        onClick={(e) => {
          e.preventDefault();
          openUrl(part.text).catch(() => {});
        }}
      >
        {part.text}
      </a>
    ) : (
      part.text
    ),
  );
}
