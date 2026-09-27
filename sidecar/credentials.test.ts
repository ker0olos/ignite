// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Credential, CredentialStore } from "@earendil-works/pi-ai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { codexBackend, withCodexLogin } from "./credentials.ts";

// The same store pi uses for auth.json (see start.ts).
const { AuthStorage } = await import(
  new URL(
    "./core/auth-storage.js",
    import.meta.resolve("@earendil-works/pi-coding-agent"),
  ).href
);

let dir: string;
let codexPath: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "credentials-"));
  codexPath = join(dir, "codex-auth.json");
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const jwt = (exp: number) =>
  `h.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.s`;
const ACCESS = jwt(2_000_000_000);

const writeCodex = (tokens: object, extra: object = {}) =>
  writeFile(
    codexPath,
    JSON.stringify({ auth_mode: "chatgpt", tokens, ...extra }),
  );
const readCodexFile = async () =>
  JSON.parse(await readFile(codexPath, "utf-8"));

function stores() {
  const own: CredentialStore = AuthStorage.create(join(dir, "auth.json"));
  const codex: CredentialStore = AuthStorage.fromStorage(
    codexBackend(codexPath),
  );
  return { own, codex, ...withCodexLogin(own, codex) };
}

const refreshed: Credential = {
  type: "oauth",
  access: "new-access",
  refresh: "new-refresh",
  expires: 1,
  accountId: "acct",
};

describe("codexBackend", () => {
  it("reads the Codex CLI's ChatGPT login as pi's openai-codex credential", async () => {
    await writeCodex({
      access_token: ACCESS,
      refresh_token: "r1",
      account_id: "acct",
      id_token: "id",
    });
    const { codex } = stores();
    expect(await codex.read("openai-codex")).toEqual({
      type: "oauth",
      access: ACCESS,
      refresh: "r1",
      accountId: "acct",
      expires: 2_000_000_000_000,
    });
  });

  it("has nothing without a usable Codex login", async () => {
    expect(await stores().codex.read("openai-codex")).toBeUndefined();
    await writeFile(codexPath, "not json");
    expect(await stores().codex.read("openai-codex")).toBeUndefined();
    await writeCodex({ access_token: ACCESS });
    expect(await stores().codex.read("openai-codex")).toBeUndefined();
  });

  it("treats an unreadable token as expired", async () => {
    await writeCodex({ access_token: "opaque", refresh_token: "r1" });
    expect(await stores().codex.read("openai-codex")).toMatchObject({
      expires: 0,
    });
    await writeCodex({
      access_token: jwt("soon" as never),
      refresh_token: "r",
    });
    expect(await stores().codex.read("openai-codex")).toMatchObject({
      expires: 0,
    });
  });

  it("writes refreshed tokens back into Codex's file, keeping its other fields", async () => {
    await writeCodex(
      { access_token: ACCESS, refresh_token: "r1", id_token: "id" },
      { OPENAI_API_KEY: null },
    );
    await stores().codex.modify("openai-codex", async () => refreshed);
    const file = await readCodexFile();
    expect(file).toMatchObject({
      auth_mode: "chatgpt",
      OPENAI_API_KEY: null,
      tokens: {
        access_token: "new-access",
        refresh_token: "new-refresh",
        account_id: "acct",
        id_token: "id",
      },
    });
    expect(Date.parse(file.last_refresh)).not.toBeNaN();
  });

  it("keeps Codex's account id when pi's credential has none", async () => {
    await writeCodex({
      access_token: ACCESS,
      refresh_token: "r1",
      account_id: "acct",
    });
    await stores().codex.modify("openai-codex", async () => ({
      ...refreshed,
      accountId: undefined,
    }));
    expect((await readCodexFile()).tokens.account_id).toBe("acct");
  });

  it("leaves Codex's file alone when nothing changes or it's gone", async () => {
    await writeCodex({ access_token: ACCESS, refresh_token: "r1" });
    const before = await readFile(codexPath, "utf-8");
    await stores().codex.modify("openai-codex", async (c) => c);
    expect(await readFile(codexPath, "utf-8")).toBe(before);

    await rm(codexPath);
    await stores().codex.modify("openai-codex", async () => refreshed);
    await expect(readFile(codexPath)).rejects.toThrow();
  });

  it("serializes writes and survives a failed one", async () => {
    await writeCodex({ access_token: ACCESS, refresh_token: "r1" });
    const { codex } = stores();
    await expect(
      codex.modify("openai-codex", async () => {
        throw new Error("refresh failed");
      }),
    ).rejects.toThrow("refresh failed");
    await codex.modify("openai-codex", async () => refreshed);
    expect((await readCodexFile()).tokens.refresh_token).toBe("new-refresh");
  });
});

describe("withCodexLogin", () => {
  it("falls back to the Codex login for ChatGPT only", async () => {
    await writeCodex({ access_token: ACCESS, refresh_token: "r1" });
    const { store, usesCodex } = stores();
    expect(await usesCodex()).toBe(true);
    expect(await store.read("openai-codex")).toMatchObject({ refresh: "r1" });
    expect(await store.read("anthropic")).toBeUndefined();
    expect(await store.list()).toEqual([
      { providerId: "openai-codex", type: "oauth" },
    ]);
  });

  it("prefers the app's own sign-in", async () => {
    await writeCodex({ access_token: ACCESS, refresh_token: "r1" });
    const { store, own, usesCodex } = stores();
    await own.modify("openai-codex", async () => refreshed);
    expect(await usesCodex()).toBe(false);
    expect(await store.read("openai-codex")).toMatchObject({
      refresh: "new-refresh",
    });
    expect(await store.list()).toEqual([
      { providerId: "openai-codex", type: "oauth" },
    ]);
  });

  it("refreshes into Codex's file while borrowing its login", async () => {
    await writeCodex({ access_token: ACCESS, refresh_token: "r1" });
    const { store, own } = stores();
    await store.modify("openai-codex", async () => refreshed);
    expect((await readCodexFile()).tokens.refresh_token).toBe("new-refresh");
    expect(await own.read("openai-codex")).toBeUndefined();
  });

  it("keeps other providers in the app's own file", async () => {
    const { store, own } = stores();
    const key: Credential = { type: "api_key", key: "sk-x" };
    await store.modify("openai", async () => key);
    expect(await own.read("openai")).toEqual(key);
    await store.delete("openai");
    expect(await own.read("openai")).toBeUndefined();
  });

  it("never signs the Codex CLI out", async () => {
    await writeCodex({ access_token: ACCESS, refresh_token: "r1" });
    const { store } = stores();
    await store.delete("openai-codex");
    expect((await readCodexFile()).tokens.refresh_token).toBe("r1");
  });

  it("signs out of the app's own ChatGPT sign-in", async () => {
    const { store, own } = stores();
    await own.modify("openai-codex", async () => refreshed);
    await store.delete("openai-codex");
    expect(await own.read("openai-codex")).toBeUndefined();
  });
});
