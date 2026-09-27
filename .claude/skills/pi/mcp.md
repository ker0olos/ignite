# MCP servers (pi-mcp-adapter 2.38.0)

`AD` = `node_modules/pi-mcp-adapter`. It ships TypeScript source (`AD/index.ts`,
loaded by pi's extension loader) plus compiled `AD/dist/` for the public
subpaths (`./types`, `./config`, `./metadata-cache`, `./oauth`). Peer range
covers pi-ai 0.84 to 0.87. README is the reference; `AD/types.ts` and
`AD/index.ts` win when it disagrees.

## Why this adapter

Checked Sept 2026 against the other pi MCP extensions on npm
(`pi-mcp-client`, `@ian-pascoe/pi-mcp`, forks). It is the most used and
maintained, declares pi 0.87 support, has an isolated programmatic config
mode, a versioned status channel on pi's event bus, a `disabled` flag, and a
`/mcp reconnect` command. It proxies tools (`mcp` search/call, one
`mcp__<server>` per server, `mcpScript`) instead of registering every MCP tool,
so servers cost little context.

## How the app loads it

- `sidecar/mcpExtension.ts` is added to `additionalExtensionPaths` (next to
  pi-claude-bridge). It reads `<agentDir>/mcp.json` and calls
  `createMcpAdapter({ config: { mcpServers, settings } })(pi)`.
- Passing `config` makes the adapter skip all its file sources:
  `~/.config/mcp/mcp.json`, `~/.agents/mcp*.json`, `<agentDir>/mcp.json` merging,
  project `.mcp.json` / `.pi/mcp.json`, and `imports` of other apps' configs
  (Cursor, Claude Code, Claude Desktop, Codex, ...). Only `claudePlugins` is
  still read in this mode, so the wrapper passes `mcpServers` and `settings`
  only. `main.test.ts` proves a shared and a project config are never started.
- The extension factory reads the file on every load; `session.reload()`
  applies saved changes. The host defers the reload to `agent_settled` while
  pi is running.
- The adapter writes only in the agent dir (`mcp-cache.json`,
  `mcp-npx-cache.json`, `mcp-onboarding.json`), the OS keychain (OAuth) and
  temp files for oversized output. URL installs by the model are refused in
  programmatic mode.

## Config format (`mcp.json`)

```json
{
  "mcpServers": {
    "local": {
      "command": "npx",
      "args": ["-y", "pkg"],
      "env": { "K": "${K}" }
    },
    "remote": {
      "url": "https://x/mcp",
      "headers": { "Authorization": "Bearer ${T}" }
    },
    "off": { "command": "x", "disabled": true }
  },
  "settings": {}
}
```

Values interpolate `${VAR}` / `$env:VAR`; a leading `!` in `env`, `headers`
or `bearerToken` runs a shell command. Other per-server fields (`lifecycle`,
`includeTools`, `directTools`, `auth`, ...) are kept by the app's editor.

## Status and tools

- `pi.events` channel `"pi-mcp-adapter/status/v1"` (`MCP_STATUS_EVENT`) carries
  `{ servers: [{ name, status, toolCount, disabled, ... }] }` with status
  `connected | cached | failed | needs-auth | not-connected | disabled`.
  `sidecar/start.ts` gives each session its own `createEventBus()` through
  `DefaultResourceLoader({ eventBus })` and forwards snapshots to the host.
- No error text is in the snapshot; failures only go to stderr
  (`MCP: Failed to connect to <name>: ...`).
- Servers with valid cached metadata start deferred: no snapshot until
  first use, which the app shows as idle. Servers without metadata connect
  at session start to fetch it.
- Tool names come from the cache: `loadMetadataCache()` and
  `isServerCacheValid(entry, definition)` from `pi-mcp-adapter/metadata-cache`
  (plain JS, importable from the host). The cache path follows
  `PI_CODING_AGENT_DIR`.
- Reconnect: `session.prompt("/mcp reconnect <name>")`. Extension commands
  run immediately, even while streaming, and add nothing to the conversation.

## Lifecycle traps

1. **Extensions only start after `session.bindExtensions(...)`.** Without it
   there is no `session_start`, and the adapter stays uninitialized until a
   command or tool call.
2. **`reload()` re-emits `session_start` only if a binding was set**
   (uiContext, command actions, shutdown handler or `onError`). The app binds
   `onError`.
3. **`session.dispose()` does not emit `session_shutdown`**, so MCP server
   processes would outlive the session. Emit it first:
   `session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" })`.
4. **The adapter reads `ctx.ui.theme` on reload**, which throws until pi's
   `initTheme()` has run; the sidecar calls `initTheme("dark")` at start.
5. **Don't bind a `uiContext`** unless the app answers dialogs: with one,
   `hasUI` turns on and the adapter asks for approvals, elicitation and
   sampling through `ctx.ui`.
6. **Its TypeScript fails strict `tsc`** (parameter properties, unused
   imports). `tsconfig.sidecar.json` maps `pi-mcp-adapter` to
   `sidecar/types/pi-mcp-adapter.d.ts`; update the shim on upgrades.

## Presets and imports (`sidecar/mcpCatalog.ts`)

- Presets: `KNOWN_SERVER_PRESETS` from `pi-mcp-adapter/config` (public
  subpath) plus our own few (Playwright pinned, Sentry, Supabase, Linear with
  `auth: "oauth"`). OAuth presets show "Needs sign-in" once checked; the row's Sign
  in button signs in.
- Imports: the adapter's own import readers (`extractServers`, `IMPORT_PATHS`)
  aren't exported and skip Claude Code's per-folder servers, so the app reads
  the files itself: `~/.claude.json` (`mcpServers` and
  `projects[<cwd>].mcpServers`), `<cwd>/.mcp.json`, `~/.cursor/mcp.json`,
  `<cwd>/.cursor/mcp.json`, `~/.codex/config.toml` (`[mcp_servers.*]`,
  `http_headers`), Claude Desktop's config. Only command/args/env or
  url/headers are kept; the adapter's `url` covers both Streamable HTTP and
  SSE, so Claude Code's `type` is dropped. Names are made safe for tool names
  (`[A-Za-z0-9_-]`) on import.
- A URL server imported from Claude Code also gets Claude Code's sign-in:
  `/app-mcp-copy-sign-in <name>` reads its keychain item (`Claude
Code-credentials`, `mcpOAuth`, matched by `serverUrl`, `expiresAt` in ms)
  and saves it with the adapter's `saveAuthEntry`, unless the server already
  has one. A refused keychain or no match leaves it needing sign-in. Both
  apps share the refresh token, so a server that rotates them may sign one
  of them out.
- The app passes the open folder as `cwd` with `mcp_catalog` / `mcp_import`
  rather than relying on the session, so the answer never races a folder
  switch.

## Setup check and sign-in

- Servers stay `lazy`. After a URL server is added, imported or edited the
  host sends the adapter's `/mcp reconnect <name>` once (not while pi runs),
  so its real status (connected, needs-auth, failed) shows during setup.
  Local command servers are never started this way.
- Sign in runs our own command, `/app-mcp-sign-in <name>`, registered by
  `sidecar/mcpExtension.ts`. It calls the adapter's `authenticate()` (not a
  public export; loaded by file path, which only pi's extension loader can do
  since Node won't strip types under node_modules) with
  `openAuthorizationUrl` sending the page over pi's event bus
  (`app/mcp-auth-url`) to the app, which opens it with Tauri's opener. The
  adapter's own `/mcp-auth` launches the browser itself through the `open`
  package, which loses the URL when the sidecar runs under the app (Chrome
  opens with no tab). Failures are reported with `ctx.ui.notify(..., "error")`,
  which the headless UI in `start.ts` turns into an `extension_error`.
- With a fake `HOME` the keychain can't be read, so a check reports `failed`
  instead of `needs-auth`; test sign-in flows with the real home.

## The app's name on sign-in pages

The adapter names its host from pi's rebranding manifest (`piConfig.name` in
`$PI_PACKAGE_DIR/package.json`, falling back to "pi"): the OAuth client it
registers ("Pi Coding Agent" by default) and the "return to pi" callback page.
pi itself reads its themes, docs and assets from `PI_PACKAGE_DIR`, so it can't
point at our folder for good. `asApp()` in `sidecar/mcpExtension.ts` writes
`<agentDir>/branding/package.json` with `piConfig.name = APP_TITLE`, points
`PI_PACKAGE_DIR` at it only while a sign-in runs, and sets
`<APP_TITLE>_CODING_AGENT_DIR` so the renamed adapter still finds the agent dir.
A server registered before this keeps its old client name until its sign-in is
cleared.

## Removing a server deletes its sign-in

The adapter keeps OAuth tokens and client registrations in the macOS keychain
(service `pi-mcp-adapter.oauth`) keyed by server **name**, so a server removed
and re-added under the same name would silently sign back in. Removing a server
first runs our `/app-mcp-sign-out <name>` (the adapter's `removeAuth`). With no
folder open, or if it fails, the name waits in memory and is signed out when
the next folder opens. The adapter logs with `console.log`, so `start.ts` sends
console output to stderr to keep stdout protocol-only.
