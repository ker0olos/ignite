import type { Plugin } from "vite";
import { type Overlay, originalOf, overrideFor } from "./modsOverlay.ts";

function splitQuery(id: string): [string, string] {
  const at = id.indexOf("?");
  return at < 0 ? [id, ""] : [id.slice(0, at), id.slice(at)];
}

/** Serves mods/ files in place of the repo files they override. */
export function modsVitePlugin(overlay: Overlay): Plugin {
  return {
    name: "mods-overlay",
    enforce: "pre",
    async resolveId(source, importer, options) {
      const opts = { ...options, skipSelf: true };
      const original = importer && originalOf(overlay, splitQuery(importer)[0]);
      // A mods/ file imports as if it sat where the original does; files
      // only mods/ has are found next to it instead.
      const resolved =
        (original && (await this.resolve(source, original, opts))) ||
        (await this.resolve(source, importer, opts));
      if (!resolved) return null;
      const [file, query] = splitQuery(resolved.id);
      const twin = overrideFor(overlay, file);
      return twin ? twin + query : resolved;
    },
    transform(code, id) {
      // Tailwind only scans the repo for class names.
      if (!splitQuery(id)[0].endsWith("/src/index.css")) return null;
      return `${code}\n@source ${JSON.stringify(overlay.mods)};\n`;
    },
    configureServer(server) {
      server.watcher.add(overlay.mods);
      // A new or deleted override changes what imports resolve to.
      const reload = (file: string) => {
        if (!originalOf(overlay, file)) return;
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    },
  };
}
