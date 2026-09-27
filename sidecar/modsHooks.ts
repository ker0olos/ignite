import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  type Overlay,
  originalOf,
  overrideFor,
} from "../shared/modsOverlay.ts";

const filePath = (url: string | undefined) =>
  url?.startsWith("file:") ? fileURLToPath(url) : null;

const beside = (importer: string, specifier: string) =>
  /^\.\.?\//.test(specifier) &&
  existsSync(resolve(dirname(importer), specifier));

/**
 * Makes Node load mods/ files in place of the repo files they override.
 * ponytail: pi loads extensions with jiti, so only an extension's entry file
 * (resolved in start.ts) can be overridden, not the files it imports.
 */
export function registerModsHooks(overlay: Overlay): void {
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const importer = filePath(context.parentURL);
      const original = importer && originalOf(overlay, importer);
      // A mods/ file imports as if it sat where the original does, except for
      // files next to it. Checked up front: Node caches a failed resolve.
      const parentURL =
        original && !beside(importer, specifier)
          ? pathToFileURL(original).href
          : context.parentURL;
      const result = nextResolve(specifier, { ...context, parentURL });
      const file = filePath(result.url);
      const twin = file && overrideFor(overlay, file);
      return twin ? { ...result, url: pathToFileURL(twin).href } : result;
    },
  });
}
