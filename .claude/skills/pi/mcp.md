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
  `sidecar/main.ts` gives each session its own `createEventBus()` through
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
