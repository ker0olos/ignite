// Apart from paths.ts, which the sidecar loads: importing app.ts there would loop through a mod of app.ts that uses paths.ts.
import { APP_NAME } from "./app";

const SCRATCHPAD = new RegExp(
  `^([^\\\\/]*=)?.*?[\\\\/]${APP_NAME}-scratchpad[\\\\/][^\\\\/]+(?:[\\\\/](.*))?$`,
);

/** A path inside a conversation's scratchpad: what leads it (`D=`) and its path inside ("" for the scratchpad itself), else undefined. */
export function inScratchpad(text: string) {
  const match = SCRATCHPAD.exec(text);
  return match ? { lead: match[1] ?? "", rest: match[2] ?? "" } : undefined;
}
