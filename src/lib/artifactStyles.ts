const LIBRARIES = ["tailwind", "daisyui"] as const;
export type Library = (typeof LIBRARIES)[number];

/** The libraries an artifact page asked for that the app ships; others are ignored. */
export function artifactLibraries(page: Record<string, unknown>): Library[] {
  const asked = Array.isArray(page.libraries) ? page.libraries : [];
  return LIBRARIES.filter((library) => asked.includes(library));
}

// Loaded on first use, so the compiler and daisyUI stay out of the app's first load.
let modules: ReturnType<typeof loadModules> | undefined;
const loadModules = () =>
  Promise.all([
    import("tailwindcss"),
    import("tailwindcss/index.css?raw"),
    import("daisyui"),
  ]);

// A compiler per page: build() keeps every candidate it has seen, so a shared one would grow.
async function compiler(daisyui: boolean) {
  modules ??= loadModules();
  const [{ compile }, { default: tailwindCss }, { default: daisy }] =
    await modules;
  const css = `@import "tailwindcss";${daisyui ? `@plugin "daisyui" { logs: false; }` : ""}`;
  return compile(css, {
    base: "/",
    loadStylesheet: async (id: string) => ({
      base: "/",
      path: id,
      content: tailwindCss,
    }),
    loadModule: async (id: string) => ({ base: "/", path: id, module: daisy }),
  });
}

/** CSS for the classes a page uses (scripts' too) from its libraries; daisyUI brings Tailwind. */
export async function libraryCss(
  html: string,
  libraries: Library[],
): Promise<string> {
  if (!libraries.length) return "";
  const tailwind = await compiler(libraries.includes("daisyui"));
  const words = html.replace(/data:[^"')\s]+/g, "").split(/[\s"'`<>]+/);
  return tailwind.build(words);
}
