# pi auth (0.87.1)

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

## Claude subscription billing notice

pi's own wording (`CA/dist/modes/interactive/interactive-mode.js:140`), shown
when `anthropic` uses OAuth: "Anthropic subscription auth is active.
Third-party harness usage draws from extra usage and is billed per token, not
your Claude plan limits. Manage extra usage at https://claude.ai/settings/usage."
Setting: `warnings.anthropicExtraUsage` (default true). This is pi's claim
about Anthropic's billing, not something we have verified, and the user has
seen it contradicted. The app deliberately shows no billing note; don't add one.
