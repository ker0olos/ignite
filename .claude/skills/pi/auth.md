# pi auth (1.0.0)

Paths: `CA` = `node_modules/@earendil-works/pi-coding-agent`,
`AI` = `CA/node_modules/@earendil-works/pi-ai`.

## ModelRuntime: the one object for models and credentials

`CA/dist/core/model-runtime.d.ts`. Exported from the package root.

```ts
const runtime = await ModelRuntime.create({
  authPath, // default <agentDir>/auth.json
  credentials, // OR any pi-ai CredentialStore (e.g. a Keychain one)
  modelsPath, // models.json, or null
  allowModelNetwork, // default false; catalog refresh from pi.dev
  signal,
});
```

| Need               | Call                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Providers / models | `getProviders()`, `getProvider(id)`, `getModels(id?)`, `getModel(id, modelId)`                                                                                                |
| Usable models      | `getAvailable(id?)` (async), `getAvailableSnapshot()` (sync)                                                                                                                  |
| Is it connected?   | `checkAuth(id) → {type:"api_key"\|"oauth", source?} \| undefined`, `getProviderAuthStatus(id) → {configured, source?, label?}`, `isUsingOAuth(id)`, `isUsingSubscription(id)` |
| Connect            | `login(id, "oauth" \| "api_key", interaction) → Credential`                                                                                                                   |
| Disconnect         | `logout(id)` (does **not** revoke at the provider or unset env vars)                                                                                                          |
| Temporary key      | `setRuntimeApiKey(id, key)` / `removeRuntimeApiKey(id)` (not persisted)                                                                                                       |
| Stored entries     | `listCredentials()`                                                                                                                                                           |
| Direct calls       | `completeSimple(model, ctx, {maxTokens, signal})`, `stream…`                                                                                                                  |

`login`/`logout`/runtime keys re-sync the model snapshot; if the credential is
saved but sync fails they throw `CredentialSynchronizationError`.

## AuthInteraction: how a login talks to the UI

`AI/dist/auth/types.d.ts:98-165`.

```ts
interface AuthInteraction {
  signal?: AbortSignal; // honored: aborting cancels the login
  prompt(p: AuthPrompt): Promise<string>; // reject on cancel
  notify(e: AuthEvent): void;
}
type AuthPrompt = { signal? } & (
  | { type: "text" | "secret" | "manual_code"; message; placeholder? }
  | { type: "select"; message; options: { id; label; description? }[] } // resolve with the id
);
type AuthEvent =
  | { type: "auth_url"; url; instructions? } // host must open the browser
  | {
      type: "device_code";
      userCode;
      verificationUri;
      intervalSeconds?;
      expiresInSeconds?;
    }
  | { type: "progress"; message }
  | { type: "info"; message; links? };
```

A `manual_code` prompt races the local callback server. When the browser
callback wins, the prompt's own `signal` aborts: dismiss the paste field then.

## Providers we support

| Provider id    | Auth                                                  | Notes                      |
| -------------- | ----------------------------------------------------- | -------------------------- |
| `anthropic`    | `oauth` (Claude Pro/Max, `isSubscription`), `api_key` | Same slot for both         |
| `openai-codex` | `oauth` only (ChatGPT Plus/Pro)                       | No API key, no env var     |
| `openai`       | `api_key`                                             | Separate models from Codex |

Default models (`CA/dist/core/model-resolver.js:10-16`, not exported):
anthropic `claude-opus-4-8`, openai `gpt-5.5`, openai-codex `gpt-5.5`.
Model lists: `AI/dist/providers/data/{anthropic,openai,openai-codex}.json`.

### Claude Pro/Max OAuth (`AI/dist/auth/oauth/anthropic.js`)

- Callback server `127.0.0.1:53692/callback` (host via `PI_OAUTH_CALLBACK_HOST`);
  redirect URI `http://localhost:53692/callback`.
- **Port busy → login rejects with EADDRINUSE** before any `auth_url`. Show it.
- Emits `auth_url`, then a `manual_code` prompt racing the callback.
- Paste accepts a full redirect URL, `code#state` (what claude.ai shows), a
  `code=` query, or a bare code.
- Stored: `{type:"oauth", refresh, access, expires}`; `expires` has a 5 min margin.
- Requests with an OAuth token (`sk-ant-oat…`) are sent as Claude Code
  (headers, betas, "You are Claude Code…" system prefix).

### ChatGPT (Codex) OAuth (`AI/dist/auth/oauth/openai-codex.js`)

- First a `select` prompt: `"browser"` or `"device_code"`.
- Browser: callback `127.0.0.1:1455/auth/callback`; a busy port silently falls
  back to manual paste. Same paste formats.
- Device code: `device_code` event, verify at `https://auth.openai.com/codex/device`,
  15 minute timeout.
- Stored credential includes `accountId` from the JWT; login fails with
  "Failed to extract accountId from token" without it.

## API keys

- `login(id, "api_key", …)` prompts for a `secret` and stores it **unvalidated**.
- Stored as `{type:"api_key", key, env?}`. Value interpretation
  (`CA/dist/core/resolve-config-value.js`): `!cmd` runs a shell command (10 s
  timeout, cached); `$NAME`/`${NAME}` interpolate; `$$` and `$!` escape. Plain
  strings are literal.
- Precedence: runtime key > stored credential > env vars. Once a credential
  is stored, env vars are ignored. Env: `ANTHROPIC_AUTH_TOKEN`,
  `ANTHROPIC_OAUTH_TOKEN`, `ANTHROPIC_API_KEY`; `OPENAI_API_KEY`.

## Validating a connection

No validate API. Presence: `checkAuth`. Live: `completeSimple` with a tiny
`maxTokens`. It does not throw: failures come back as an `AssistantMessage`
with `stopReason: "error"` and `errorMessage`. Codex retries failed calls
(up to ~7 s) unless the error is a usage limit. `ModelsError.code`
(`"auth" | "oauth" | …`) tells refresh failures (re-login fixes) from others.

## Storage

- `<agentDir>/auth.json`, created `0600` (dir `0700`), `proper-lockfile` locks,
  OAuth refresh inside a locked read-modify-write (refresh < 5 min to expiry).
- No keychain support. A custom `CredentialStore` (`read`, `list`, `modify`,
  `delete`) passed as `ModelRuntime.create({ credentials })` can add one.
- `readStoredCredential(providerId, authPath?)` is the only exported reader.

## Claude subscriptions: use Claude Code, not pi's Claude sign-in

Verified (Sept 2026): with pi's `anthropic` OAuth, Anthropic rejects every
request with `400 "Third-party apps now draw from your extra usage, not your
plan limits"` unless the account has extra usage. pi warns about this itself
(`warnings.anthropicExtraUsage`). Requests made through Anthropic's own Claude
Code / Agent SDK still count against the plan (Claude Help Center, "Use the
Claude Agent SDK with your Claude plan").

So the app runs Claude on the user's own Claude Code login through the
`pi-claude-bridge` extension (pinned; loaded per session in `sidecar/start.ts`
via `additionalExtensionPaths`). It registers pi provider `claude-bridge`
(models like `claude-bridge/claude-opus-5-5`); pi still runs the tools.

- The app's `claude-code` "provider" is `claude auth status` / `claude auth
login` (`sidecar/claudeCode.ts`). When Claude Code is installed, the Claude
  card offers only that sign-in; pi's `anthropic` OAuth is the fallback.
- The bridge lists its models even when Claude Code is signed out; the host
  hides them then.
- Never sign the user out of Claude Code from the app.
- `ANTHROPIC_API_KEY` in the environment redirects Claude Code away from the
  subscription (bridge README). The bridge's config lives at
  `<agentDir>/claude-bridge.json` (`provider.plan: "max"` enables 1M Opus).
- Anthropic doesn't allow third-party products to offer claude.ai login
  without approval; fine for personal use, revisit before distributing.

## ChatGPT: borrowing the Codex CLI's login

OpenAI bills pi's own `openai-codex` sign-in to the ChatGPT plan, so this is
only to skip a sign-in. `sidecar/credentials.ts` passes pi a CredentialStore
(`ModelRuntime.create({ credentials })`): the app's auth.json (pi's own
`AuthStorage`, loaded by file path since it isn't exported), falling back to
`~/.codex/auth.json` for `openai-codex` via an `AuthStorageBackend` adapter.

- A refresh rotates the refresh token, so refreshed tokens are written back
  into Codex's file (other fields kept); never keep a private copy.
- Signing out never deletes Codex's login; the UI hides Disconnect
  (`ProviderStatus.viaCodex`).
- An app sign-in of its own wins over the Codex login.

## Extension providers and the initial model

`createAgentSession` picks the model (saved session, then settings default)
before extensions register providers, so a saved `claude-bridge/*` model comes
back as "unknown". `sidecar/start.ts` re-picks it with `session.setModel` once
the session exists.
