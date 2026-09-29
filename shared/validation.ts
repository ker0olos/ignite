import type { McpServerConfig } from "./hostProtocol.ts";

/**
 * pi interprets stored keys: a leading `!` runs a shell command and `$NAME`
 * reads an env var. A key typed by the user must stay literal, so refuse
 * those (real provider keys never contain them). Returns a message, or null.
 */
export function apiKeyProblem(key: string): string | null {
  const trimmed = key.trim();
  if (!trimmed) return "Enter an API key.";
  if (trimmed.startsWith("!") || trimmed.includes("$")) {
    return "That doesn't look like an API key.";
  }
  if (/\s/.test(trimmed)) return "API keys can't contain spaces.";
  return null;
}

/**
 * Checks a server before it is saved; `taken` holds the other servers' names.
 * Names become part of tool names, so they stay simple. Returns a message, or
 * null.
 */
export function mcpServerProblem(
  name: string,
  config: McpServerConfig,
  taken: readonly string[],
): string | null {
  if (!name) return "Enter a name.";
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    return "Use only letters, numbers, - and _ in the name.";
  }
  if (taken.includes(name)) return `There is already a server named ${name}.`;
  if (config.type === "stdio") {
    return config.command.trim() ? null : "Enter a command.";
  }
  return URL.canParse(config.url) &&
    ["http:", "https:"].includes(new URL(config.url).protocol)
    ? null
    : "Enter an http:// or https:// URL.";
}
