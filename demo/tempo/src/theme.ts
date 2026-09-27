export type Theme = "system" | "light" | "dark";

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
let chosen: Theme = "system";

/** Shows the page in the chosen theme; "system" follows the OS. */
export function applyTheme(theme: Theme) {
  chosen = theme;
  const dark = theme === "dark" || (theme === "system" && systemDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

// Follow the OS live while the choice is "system".
systemDark.addEventListener("change", () => applyTheme(chosen));
