import { FileSearchPalette } from "@/components/files/FileSearchPalette";
import type { useFileSearchPalette } from "@/hooks/useFileSearchPalette";
import type { HostClient } from "@/lib/piHost";

/** Current-folder file search palette, wired to open file tabs. */
export function AppFileSearchPalette({
  palette,
  host,
  folder,
  openFile,
}: {
  palette: ReturnType<typeof useFileSearchPalette>;
  host: HostClient | null;
  folder: string | null;
  openFile: (folder: string, path: string) => void;
}) {
  return (
    <FileSearchPalette
      key={palette.opening}
      open={palette.open}
      onOpenChange={palette.setOpen}
      host={host}
      folder={folder}
      onFile={openFile}
    />
  );
}
