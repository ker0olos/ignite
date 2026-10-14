import { createElement } from "react";
import { useIconTheme } from "@/hooks/useIconTheme";
import { useIconUrl } from "@/hooks/useIconUrl";
import { minimalIcon } from "@/lib/fileIcons";
import { themedIcon } from "@/lib/iconThemes";
import { cn } from "@/lib/utils";

/** A file's or folder's icon from the chosen icon theme, else the app's own glyph. */
export function FileIcon({
  name,
  kind = "file",
  className,
}: {
  name: string;
  kind?: "file" | "folder" | "openFolder";
  className?: string;
}) {
  const { theme, light } = useIconTheme();
  const icon = theme && themedIcon(theme, name, kind, light);
  const image = icon && "image" in icon ? icon.image : undefined;
  const url = useIconUrl(image);

  if (image && url !== null) {
    return url ? (
      <img src={url} alt="" draggable={false} className={className} />
    ) : (
      <span className={className} />
    );
  }
  if (icon && "glyph" in icon) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center leading-none",
          className,
        )}
        style={{
          fontFamily: icon.family,
          fontSize: icon.size,
          color: icon.color,
        }}
      >
        {icon.glyph}
      </span>
    );
  }
  return createElement(minimalIcon(name, kind), { className });
}
