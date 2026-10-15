import { useEffect, useState } from "react";

// Markdown remounts its code blocks on each render, so answers outlive them.
// ponytail: grows with every untagged block seen; an LRU if that ever matters.
const known = new Map<string, boolean>();

/** A code block's language: its fence's, else "bash" once an untagged block parses as shell commands. */
export function useBlockLang(
  lang: string | undefined,
  code: string,
): string | undefined {
  const [shell, setShell] = useState(() => known.get(code) ?? false);

  useEffect(() => {
    if (lang !== undefined) return;
    let cancelled = false;
    // tree-sitter loads with the first untagged block, not with the app.
    import("@/lib/shellDetect")
      .then((m) => m.looksLikeShell(code))
      .then((yes) => {
        known.set(code, yes);
        if (!cancelled) setShell(yes);
      });
    return () => {
      cancelled = true;
    };
  }, [lang, code]);

  return lang ?? (shell ? "bash" : undefined);
}
