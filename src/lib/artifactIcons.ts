type Icon = { body: string; width?: number; height?: number };
type IconSet = {
  icons: Record<string, Icon>;
  aliases?: Record<string, { parent: string }>;
  width?: number;
  height?: number;
};

// Loaded only when a page uses one; Simple Icons alone is several MB.
const SETS: Record<string, () => Promise<IconSet>> = {
  lucide: () =>
    import("@iconify-json/lucide/icons.json").then((m) => m.default),
  "simple-icons": () =>
    import("@iconify-json/simple-icons/icons.json").then((m) => m.default),
};

const ICON_CLASS = /\bi-(lucide|simple-icons)-([a-z0-9]+(?:-[a-z0-9]+)*)/g;

function iconRule(set: IconSet, prefix: string, name: string) {
  const icon = set.icons[name] ?? set.icons[set.aliases?.[name]?.parent ?? ""];
  if (!icon) return "";
  const width = icon.width ?? set.width ?? 16;
  const height = icon.height ?? set.height ?? 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${icon.body}</svg>`;
  const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}") no-repeat center / 100% 100%`;
  return `.i-${prefix}-${name}{display:inline-block;width:1em;height:1em;vertical-align:-0.125em;background-color:currentColor;-webkit-mask:${mask};mask:${mask}}`;
}

/** Whether a page uses any `i-lucide-*` or `i-simple-icons-*` class. */
export const usesIcons = (html: string) => new RegExp(ICON_CLASS).test(html);

// The components layer, so Tailwind utilities (`size-6`) and the page's own CSS override it.
/** CSS for the icon classes a page uses, each a 1em icon in the text's color. */
export async function iconCss(html: string): Promise<string> {
  const wanted = new Map<string, Set<string>>();
  for (const [, prefix, name] of html.matchAll(ICON_CLASS)) {
    if (!wanted.has(prefix)) wanted.set(prefix, new Set());
    wanted.get(prefix)!.add(name);
  }
  if (!wanted.size) return "";
  const rules = await Promise.all(
    [...wanted].map(async ([prefix, names]) => {
      const set = await SETS[prefix]();
      return [...names].map((name) => iconRule(set, prefix, name)).join("");
    }),
  );
  return `@layer components{${rules.join("")}}`;
}
