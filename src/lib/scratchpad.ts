// Apart from paths.ts, which the sidecar loads: importing app.ts there would loop through a mod of app.ts that uses paths.ts.
import { APP_NAME } from "./app";

const SCRATCHPAD = new RegExp(
  `[\\\\/]${APP_NAME}-scratchpad[\\\\/][^\\\\/]+(?:[\\\\/](.*))?$`,
);

/** A path inside a conversation's scratchpad as relative to it ("." for the scratchpad itself), else undefined. */
export function inScratchpad(path: string) {
  const match = SCRATCHPAD.exec(path);
  return match ? match[1] || "." : undefined;
}
