const LINE_SUFFIX = /(?::\d+){1,2}$/;
const URI_SCHEME = /^[A-Za-z][\w+.-]*:/;
const WINDOWS_PATH = /^[A-Za-z]:[\\/]/;

/** Returns whether `text` looks like a file path rather than ordinary code. */
export function looksLikeFilePath(text: string) {
  const path = trimFilePath(text);
  if (!path || /\s/.test(path)) return false;
  if (path.startsWith("file://")) return true;
  if (URI_SCHEME.test(path) && !WINDOWS_PATH.test(path)) return false;
  if (isAbsolutePath(path) || path.startsWith("./") || path.startsWith("../")) {
    return true;
  }
  return (
    path.includes("/") || /(?:^|\/)[^/.][^/]*\.[A-Za-z][\w-]{0,15}$/.test(path)
  );
}

/** Converts a file reference into an absolute path, relative to `folder` when needed. */
export function filePathTarget(folder: string, text: string) {
  const path = trimFilePath(text);
  if (path.startsWith("file://")) return fileUrlPath(path);
  if (isAbsolutePath(path)) return normalizePath(path);
  return normalizePath(`${folder}/${path.replace(/^\.\//, "")}`);
}

/** True when `path` belongs to `folder`. */
export function isInsideFolder(folder: string, path: string) {
  const root = normalizePath(folder);
  const target = normalizePath(path);
  return target === root || target.startsWith(`${root}/`);
}

function trimFilePath(text: string) {
  return text.trim().replace(LINE_SUFFIX, "");
}

function isAbsolutePath(path: string) {
  return path.startsWith("/") || WINDOWS_PATH.test(path);
}

function fileUrlPath(path: string) {
  try {
    const pathname = decodeURIComponent(new URL(path).pathname);
    return pathname.replace(/^\/([A-Za-z]:\/)/, "$1");
  } catch {
    return path;
  }
}

function normalizePath(path: string) {
  const slash = path.replaceAll("\\", "/");
  const drive = slash.match(/^[A-Za-z]:/)?.[0] ?? "";
  const absolute = slash.startsWith("/") || !!drive;
  const rest = drive ? slash.slice(drive.length) : slash;
  const parts = rest
    .split("/")
    .reduce<string[]>((acc, part) => normalizePart(acc, part, absolute), []);
  const prefix = drive || (absolute ? "/" : "");
  return `${prefix}${parts.join("/")}` || fallbackPath(prefix, absolute);
}

function normalizePart(parts: string[], part: string, absolute: boolean) {
  if (!part || part === ".") return parts;
  if (part !== "..") return [...parts, part];
  if (parts.length && parts.at(-1) !== "..") return parts.slice(0, -1);
  return absolute ? parts : [...parts, part];
}

function fallbackPath(prefix: string, absolute: boolean) {
  return absolute ? prefix : ".";
}
