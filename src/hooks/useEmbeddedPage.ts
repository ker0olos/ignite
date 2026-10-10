import { useEffect, useMemo, useState } from "react";
import { embeddedPage } from "@/lib/artifact";
import { iconCss, usesIcons } from "@/lib/artifactIcons";
import { libraryCss, type Library } from "@/lib/artifactStyles";

/** An HTML artifact page for its frame with its libraries' and icons' CSS; the last one while a new one builds. */
export function useEmbeddedPage(html: string, libraries: Library[]) {
  const key = libraries.join(",");
  const plain = !key && !usesIcons(html);
  const immediate = useMemo(
    () => (plain ? embeddedPage(html) : undefined),
    [plain, html],
  );
  const [built, setBuilt] = useState<string>();
  useEffect(() => {
    if (plain) return;
    let cancelled = false;
    // A page whose CSS fails to build still shows, without it.
    void Promise.all([
      libraryCss(html, libraries).catch(() => ""),
      iconCss(html).catch(() => ""),
    ]).then((css) => {
      if (!cancelled) setBuilt(embeddedPage(html, css.join("")));
    });
    return () => {
      cancelled = true;
    };
    // `key` stands for `libraries`, a new array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, key, plain]);
  return immediate ?? built;
}
