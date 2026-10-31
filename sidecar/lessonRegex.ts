/** Lessons whose `match` is a regex: checking one before it's saved, and running it on a call. */
import { createRequire } from "node:module";

type Check = (typeof import("recheck"))["checkSync"];

// Loaded only when a regex lesson is saved: it's a large bundle, and lessons load in every session.
const require = createRequire(import.meta.url);
const recheck: Check = (...args) =>
  (require("recheck") as typeof import("recheck")).checkSync(...args);

// A quadratic regex runs on at most this much of a call's text, so it stays fast.
const QUADRATIC_CHARS = 4_000;
// Text no lesson should block: a regex matching it would block every call of its tool.
const ORDINARY = "abc 123";

const compiled = new Map<string, RegExp | null>();

/** `pattern` compiled once, `.` crossing lines as commands do; null when it isn't a regex. */
function compile(pattern: string): RegExp | null {
  if (!compiled.has(pattern)) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(pattern, "s");
    } catch {
      // Not a regex: it never matches.
    }
    compiled.set(pattern, re);
  }
  return compiled.get(pattern)!;
}

/** Why `pattern` can't be a lesson's regex at all (invalid, or matching any call); null when it can. Quick. */
export function regexFlaw(pattern: string): string | null {
  try {
    new RegExp(pattern, "s");
  } catch (error) {
    return `\`match\` isn't a valid regex: ${(error as Error).message}`;
  }
  const re = compile(pattern)!;
  if (re.test("") || re.test(ORDINARY))
    return "`match` would block every call: it matches empty or ordinary text. Make it name the mistake.";
  return null;
}

/**
 * Whether `pattern` runs in linear or quadratic time on long text, or why it
 * could hang the sidecar (and every conversation with it). Up to 2 seconds.
 */
export function regexSpeed(
  pattern: string,
  check: Check = recheck,
): { quadratic: boolean } | string {
  const result = check(pattern, "s", { timeout: 2_000 });
  if (result.status === "safe") return { quadratic: false };
  if (result.status === "unknown")
    return `\`match\` couldn't be checked for speed (${result.error.kind}). Write a simpler regex.`;
  const { complexity } = result;
  if (complexity.type === "polynomial" && complexity.degree <= 2)
    return { quadratic: true };
  return "`match` could hang on a long call (nested repeats like `(a+)+`). Write a simpler regex.";
}

/** How often regex `pattern` matches call text `text`; a `quadratic` one sees only its start. */
export function regexCount(
  pattern: string,
  text: string,
  quadratic?: boolean,
): number {
  const re = compile(pattern);
  if (!re) return 0;
  const seen = quadratic ? text.slice(0, QUADRATIC_CHARS) : text;
  return seen.match(new RegExp(re.source, "gs"))?.length ?? 0;
}
