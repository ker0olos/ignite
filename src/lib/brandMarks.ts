/** A Simple Icons brand: its name, colour (hex without `#`) and 24px path. */
export type Brand = { title: string; hex: string; path: string };

// Words around a brand in server names (`clickup-mcp-server`), and names that are
// brands but here only say what the server does.
const FILLER = new Set([
  "mcp",
  "server",
  "remote",
  "official",
  "api",
  "search",
]);
const GENERIC = new Set(["local", "files", "shell", "here", "task"]);

let brands: Map<string, Brand> | undefined;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

// Separate modules from `simple-icons`, whose few presets the main bundle holds:
// importing that whole would pull all of it (several MB) in with them.
/** Loads every brand once, then tells subscribers. */
export function loadBrands() {
  loading ??= Promise.all([
    import("simple-icons/icons.json"),
    import("@iconify-json/simple-icons/icons.json"),
  ]).then(([data, set]) => {
    const icons: Record<string, { body: string }> = set.default.icons;
    brands = new Map();
    for (const { slug, title, hex } of data.default) {
      const path = /\bd="([^"]+)"/.exec(icons[slug]?.body ?? "")?.[1];
      if (path) brands.set(slug, { title, hex, path });
    }
    listeners.forEach((l) => l());
  });
  // A failed chunk load is tried again on the next lookup.
  loading.catch(() => (loading = undefined));
  return loading;
}

/** Calls `listener` once the brands have loaded. */
export function onBrandsLoaded(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Whether the brands have loaded. */
export const brandsLoaded = () => !!brands;

// Only the whole name is matched: a brand among other words is as often an
// ordinary word (`ram-monitor`, `note-taker`), and a wrong logo is worse than none.
/** A name's brand slug: its words but the filler, run together (`googleDriveMcp` → `googledrive`), when `isSlug` takes it. */
export function brandSlug(name: string, isSlug: (slug: string) => boolean) {
  const slug = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FILLER.has(w))
    .join("");
  return slug && !GENERIC.has(slug) && isSlug(slug) ? slug : undefined;
}

/** A server's Simple Icons brand, matched on its name; starts loading them the first time one is asked for. */
export function brandFor(server: string): Brand | undefined {
  if (!brands) {
    void loadBrands();
    return undefined;
  }
  const slug = brandSlug(server, (s) => brands!.has(s));
  return slug ? brands.get(slug) : undefined;
}
