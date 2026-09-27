import { describe, expect, it } from "vitest";
import { signInFor } from "./claudeCodeMcpAuth.ts";

const url = "https://mcp.sentry.dev/mcp";
const keychain = (mcpOAuth: unknown) =>
  JSON.stringify({ claudeAiOauth: {}, mcpOAuth });

describe("signInFor", () => {
  it("converts Claude Code's sign-in to the adapter's format", () => {
    const saved = keychain({
      "sentry|1": {
        serverName: "sentry",
        serverUrl: url,
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: 1791709439205,
        scope: "org:read",
        issuer: "https://sentry.io",
        clientId: "cid",
        clientSecret: "cs",
        redirectUri: "http://localhost:1/callback",
        discoveryState: {},
      },
    });
    expect(signInFor(saved, url)).toEqual({
      serverUrl: url,
      tokens: {
        accessToken: "at",
        refreshToken: "rt",
        expiresAt: 1791709439,
        scope: "org:read",
        issuer: "https://sentry.io",
      },
      clientInfo: {
        clientId: "cid",
        clientSecret: "cs",
        redirectUris: ["http://localhost:1/callback"],
        issuer: "https://sentry.io",
      },
    });
  });

  it("keeps only the token when that's all there is", () => {
    const saved = keychain({ a: { serverUrl: url, accessToken: "at" } });
    expect(signInFor(saved, url)).toEqual({
      serverUrl: url,
      tokens: { accessToken: "at" },
    });
  });

  it("picks the freshest sign-in with a token for the URL", () => {
    const saved = keychain({
      old: { serverUrl: url, accessToken: "old", expiresAt: 1000 },
      new: { serverUrl: url, accessToken: "new", expiresAt: 5000 },
      empty: { serverUrl: url, expiresAt: 9000 },
      other: { serverUrl: "https://other", accessToken: "x", expiresAt: 9000 },
    });
    expect(signInFor(saved, url)?.tokens.accessToken).toBe("new");
  });

  it("finds nothing without a matching sign-in or readable keychain", () => {
    expect(signInFor(keychain({}), url)).toBeUndefined();
    expect(signInFor(JSON.stringify({}), url)).toBeUndefined();
    expect(signInFor("not json", url)).toBeUndefined();
    expect(signInFor(undefined, url)).toBeUndefined();
  });
});
