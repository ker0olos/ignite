import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Credential, CredentialStore } from "@earendil-works/pi-ai";

const CODEX = "openai-codex";

type LockResult<T> = { result: T; next?: string };

/** pi's AuthStorageBackend: raw auth.json text in, new text out. */
export type AuthBackend = {
  withLock<T>(fn: (current: string | undefined) => LockResult<T>): T;
  withLockAsync<T>(
    fn: (current: string | undefined) => Promise<LockResult<T>>,
  ): Promise<T>;
};

type CodexAuth = {
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    account_id?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/** Seconds-since-epoch `exp` of a JWT, in milliseconds; 0 if unreadable. */
function jwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function readCodex(path: string): CodexAuth | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return undefined;
  }
}

/** The Codex CLI's login as pi's auth.json text: one openai-codex entry, or none. */
function toPi(codex: CodexAuth | undefined): string {
  const t = codex?.tokens;
  if (!t?.access_token || !t.refresh_token) return "{}";
  return JSON.stringify({
    [CODEX]: {
      type: "oauth",
      access: t.access_token,
      refresh: t.refresh_token,
      accountId: t.account_id,
      expires: jwtExpiry(t.access_token),
    },
  });
}

// Codex's tokens with pi's refreshed ones merged in, or undefined if unchanged.
function rotatedTokens(
  credential: Credential | undefined,
  codex: CodexAuth | undefined,
): CodexAuth["tokens"] | undefined {
  if (credential?.type !== "oauth" || !codex) return undefined;
  const tokens = codex.tokens ?? {};
  const changed =
    credential.access !== tokens.access_token ||
    credential.refresh !== tokens.refresh_token;
  if (!changed) return undefined;
  return {
    ...tokens,
    access_token: credential.access,
    refresh_token: credential.refresh,
    account_id:
      (credential.accountId as string | undefined) ?? tokens.account_id,
  };
}

/**
 * Lets pi use the Codex CLI's ChatGPT login in ~/.codex/auth.json as its
 * openai-codex credential. A refresh rotates the refresh token, so pi's new
 * tokens are written back into Codex's file; otherwise one of the two apps
 * would be signed out. Codex's other fields are kept.
 */
export function codexBackend(path: string): AuthBackend {
  let chain: Promise<unknown> = Promise.resolve();

  function apply<T>({ result, next }: LockResult<T>): T {
    const credential = next
      ? (JSON.parse(next) as Record<string, Credential>)[CODEX]
      : undefined;
    const codex = readCodex(path);
    const tokens = rotatedTokens(credential, codex);
    if (tokens && codex) {
      writeFileSync(
        path,
        JSON.stringify(
          { ...codex, tokens, last_refresh: new Date().toISOString() },
          null,
          2,
        ),
        { mode: 0o600 },
      );
    }
    return result;
  }

  return {
    withLock: (fn) => apply(fn(toPi(readCodex(path)))),
    // ponytail: serialized within this process only; Codex itself and other
    // windows' sidecars don't share the lock. Refreshes are rare (days apart).
    withLockAsync(fn) {
      const run = chain.then(async () =>
        apply(await fn(toPi(readCodex(path)))),
      );
      chain = run.catch(() => {});
      return run;
    },
  };
}

/**
 * Whether an app's command is on PATH. A login borrowed from another app counts
 * only while it's installed: its files outlive an uninstall.
 */
export function commandInstalled(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = execFile(command, ["--version"], { timeout: 10_000 }, (e) =>
      resolve((e as NodeJS.ErrnoException | null)?.code !== "ENOENT"),
    );
    child.stdin?.end();
  });
}

/**
 * The app's own credentials, falling back to the Codex CLI's login for
 * openai-codex when the app has none and Codex is installed. Signing out
 * never touches Codex.
 */
export function withCodexLogin(
  own: CredentialStore,
  codex: CredentialStore,
  installed = commandInstalled("codex"),
) {
  const usesCodex = async () =>
    !(await own.read(CODEX)) &&
    (await installed) &&
    !!(await codex.read(CODEX));

  const store: CredentialStore = {
    read: async (id, options) =>
      (await own.read(id, options)) ??
      (id === CODEX && (await installed) ? codex.read(id, options) : undefined),
    list: async (options) => {
      const mine = await own.list(options);
      if (mine.some((c) => c.providerId === CODEX)) return mine;
      if (!(await installed)) return mine;
      return [...mine, ...(await codex.list(options))];
    },
    modify: async (id, fn, options) =>
      id === CODEX && (await usesCodex())
        ? codex.modify(id, fn, options)
        : own.modify(id, fn, options),
    delete: async (id, options) => {
      if (id === CODEX && (await usesCodex())) return;
      await own.delete(id, options);
    },
  };
  return { store, usesCodex };
}
