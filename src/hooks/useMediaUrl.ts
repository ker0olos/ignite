import { useEffect, useState } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import { base64Bytes } from "@/lib/audio";

type Media = { mimeType: string; path?: string; data?: string };

// ponytail: blob URLs live for the session; revoke on conversation close if memory matters.
const urls = new Map<string, Promise<string>>();

function load(media: Media, key: string) {
  let url = urls.get(key);
  if (!url) {
    url = (
      media.path
        ? readFile(media.path)
        : Promise.resolve(base64Bytes(media.data ?? ""))
    )
      .then((bytes) =>
        URL.createObjectURL(
          new Blob([bytes as Uint8Array<ArrayBuffer>], {
            type: media.mimeType,
          }),
        ),
      )
      .catch(() => {
        urls.delete(key);
        return "missing";
      });
    urls.set(key, url);
  }
  return url;
}

/** A playable URL for a clip: a blob of its file or inline data, read once per session; "missing" if unreadable, undefined while reading. */
// ponytail: reads the whole file into memory; stream it through Tauri's asset protocol if videos get huge.
export function useMediaUrl(media: Media | undefined): string | undefined {
  const key = media?.path ?? media?.data;
  const [made, setMade] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!media || !key) return;
    let live = true;
    void load(media, key).then((url) => live && setMade({ key, url }));
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return made && made.key === key ? made.url : undefined;
}
