/**
 * MCP sign-ins Claude Code saved, so importing its URL servers doesn't ask to
 * sign in again. It keeps them in its keychain item under `mcpOAuth`.
 */
import { execFile } from "node:child_process";

/** A sign-in in pi-mcp-adapter's stored format (its `AuthEntry`). */
export interface AdapterAuth {
  serverUrl: string;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    scope?: string;
    issuer?: string;
  };
  clientInfo?: {
    clientId: string;
    clientSecret?: string;
    redirectUris?: string[];
    issuer?: string;
  };
}

type Json = Record<string, unknown>;

const text = (value: unknown) =>
  typeof value === "string" && value ? value : undefined;

function buildTokens(best: Json, issuer?: string): AdapterAuth["tokens"] {
  return {
    accessToken: best.accessToken as string,
    ...(text(best.refreshToken) && { refreshToken: text(best.refreshToken) }),
    // Claude Code saves milliseconds, the adapter seconds.
    ...(typeof best.expiresAt === "number" && {
      expiresAt: Math.floor(best.expiresAt / 1000),
    }),
    ...(text(best.scope) && { scope: text(best.scope) }),
    ...(issuer && { issuer }),
  };
}

function buildClientInfo(
  best: Json,
  issuer?: string,
): AdapterAuth["clientInfo"] | undefined {
  const clientId = text(best.clientId);
  if (!clientId) return undefined;
  const redirectUri = text(best.redirectUri);
  const clientSecret = text(best.clientSecret);
  return {
    clientId,
    ...(clientSecret && { clientSecret }),
    // Without these the adapter takes the client for a config stub and drops it.
    ...(redirectUri && { redirectUris: [redirectUri] }),
    ...(issuer && { issuer }),
  };
}

/**
 * The sign-in Claude Code saved for `url`, from its keychain item's JSON:
 * the freshest one with a token, since a URL can be signed in more than once.
 */
export function signInFor(
  keychain: string | undefined,
  url: string,
): AdapterAuth | undefined {
  let saved: unknown;
  try {
    saved = JSON.parse(keychain ?? "");
  } catch {
    return undefined;
  }
  const all = (saved as Json | null)?.mcpOAuth;
  if (!all || typeof all !== "object") return undefined;
  const expiry = (e: Json) =>
    typeof e.expiresAt === "number" ? e.expiresAt : Infinity;
  const [best] = Object.values(all as Record<string, Json>)
    .filter((e) => e?.serverUrl === url && text(e.accessToken))
    .sort((a, b) => expiry(b) - expiry(a));
  if (!best) return undefined;
  const issuer = text(best.issuer);
  const clientInfo = buildClientInfo(best, issuer);
  return {
    serverUrl: url,
    tokens: buildTokens(best, issuer),
    ...(clientInfo && { clientInfo }),
  };
}

/** Claude Code's keychain item, or undefined if it's missing or access is refused. */
export function readClaudeCodeKeychain(): Promise<string | undefined> {
  return new Promise((resolve) =>
    execFile(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      (error, stdout) => resolve(error ? undefined : stdout.trim()),
    ),
  );
}
