# AGENTS.md

Guidance for contributors and AI coding agents working in this repo.
Tauri 2 + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Early prototype:
the UI shell works (folders, file tree, file viewer, settings, multi-window)
and the composer runs pi on the open folder, showing its conversation. For now it is run from source with
`npm run tauri dev`, not shipped as a built app; prioritise dev-mode behaviour
over release builds.

## Structure

```
src/                     React frontend (almost all logic lives here)
  main.tsx               Entry: sizes and shows the window, renders <App>
  App.tsx                Composes hooks, picks Welcome vs Workspace
  index.css              Tailwind + shadcn theme tokens, code-view styles
  components/            UI only; logic worth testing lives in lib/ or hooks/
    ui/                  shadcn/ui components (CLI-generated)
    Welcome.tsx          Screen when no folder is open
    Workspace.tsx        Open-folder layout: resizable sidebar, agent panel, file tabs
    Sidebar.tsx          Title-bar strip + file tree
    FileTree.tsx         Lazy directory tree
    FileView.tsx         Read-only, syntax-highlighted file
    AgentPanel.tsx       Conversation + task composer
    Conversation.tsx     Renders the transcript: messages, thinking, tool rows
    SettingsDialog.tsx   Settings modal
    McpServers.tsx       MCP server rows (status, switch, remove) and the add/edit form
    ConnectProviders.tsx Full-window screen to connect Claude / ChatGPT
    ProviderLogos.tsx    Claude and OpenAI marks (LobeHub Icons, MIT)
  hooks/
    useFolders.ts        Recent folders + this window's open folder
    useSettings.ts       settings.toml, synced across windows; applies theme
    useFolderDrop.ts     Drag-and-drop folders onto the window
    useTabs.ts           Open file tabs, reset per folder (⌘W closes one)
    useProviders.ts      Provider status, sign-in and sign-out via the pi host
    useConnectScreen.ts  When the connect screen shows (first launch, on request)
    useAgentSession.ts   The folder's pi session: conversation, send/stop, model and effort
    useMcpServers.ts     MCP servers in pi's mcp.json, with live status pushed by the sidecar
  lib/
    app.ts               APP_NAME, the single source of the app's name
    settings.ts          Settings type, defaults, TOML load/save
    store.ts             App state (tauri-plugin-store) + cross-window sync
    files.ts             Directory listing and reading files for the viewer
    gitignore.ts         .gitignore matching for the file tree
    highlight.ts         Shiki highlighting with the chosen theme(s)
    codeThemes.ts        Theme discovery (Shiki, VS Code-family editors, custom files) and loading
    tabs.ts              Open/close logic for file tabs
    recent.ts            Recent-folders list logic
    fileIcons.ts         Extension → monochrome icon
    menu.ts              macOS menu bar
    lifecycle.ts         Confirm before quitting or closing a window
    piHost.ts            Starts the pi host sidecar; request/response client
    providerGroups.ts    Presents pi's providers as brands (Claude, ChatGPT)
    transcript.ts        Rebuilds the conversation from pi's session events
    modelMenu.ts         Composer model menu: hand-picked featured models, the rest under More
    mcpServers.ts        MCP server form (lines to args/env/headers), status labels
    mcpToolCall.ts       Reads pi-mcp-adapter's tool calls (server, tool, arguments) for the conversation
    window.ts            Window sizing and New Window
    paths.ts             basename / dirname / ~ shortening
    utils.ts             `cn` class-name helper (shadcn)
  test/                  Test setup and fake Tauri backends (fakeFs, fakeStore)
sidecar/                 pi host: a Node process the app starts (node sidecar/main.ts)
  main.ts                stdio wiring; pi's files live in ~/.unnamed-harness/pi
  host.ts                Handles requests against pi's ModelRuntime and AgentSession (tested with fakes)
  claudeCode.ts          The user's Claude Code login (`claude auth status/login`)
  credentials.ts         pi's auth.json, falling back to the Codex CLI's ChatGPT login
  lines.ts               LF-only JSONL splitting
  mcpConfig.ts           pi-mcp-adapter's mcp.json: read, edit servers, cached tool names
  mcpExtension.ts        Loads pi-mcp-adapter into each session with only the app's mcp.json
  testMcpServer.ts       A one-tool stdio MCP server for tests
  types/                 Type shim for pi-mcp-adapter (its TypeScript fails our strict tsconfig)
shared/hostProtocol.ts   Messages between app and sidecar (used by both)
shared/agentTypes.ts     pi's messages and session events as they cross the wire
.todo                    Planned work (tool approval prompts, project trust, MCP sign-in)
src-tauri/               Rust shell: registers plugins, nothing else
  tauri.conf.json        App and main-window config
  dev-runner.sh          Runs `tauri dev` from a .app so Stage Manager shows the icon
  capabilities/          Permissions the frontend may use
  tests/config.rs        Guards on the config (write scope, hidden window)
.github/workflows/ci.yml Build, typecheck, lint, format check, tests on macOS
```

Two places hold persisted data:

- **User settings** in `~/.unnamed-harness/settings.toml` (`lib/settings.ts`).
  Human-editable; add new options to the `Settings` type and `DEFAULT_SETTINGS`.
- **Themes:** the `theme` setting is `"system"` (GitHub Light/Dark following
  macOS) or a theme id. The chosen theme colours code and decides light or dark
  mode. Themes come from Shiki, from extensions installed in VS Code, VSCodium,
  Cursor or Windsurf, or from `~/.unnamed-harness/themes/*.json`. Picking an
  editor theme copies it (includes merged) into that folder and saves the
  copy's id, so uninstalling the editor later can't break it; the copy records
  `importedFrom`, and the picker lists it once. Never read other editors'
  settings; only their installed theme files.
- **Editor settings** (`[editor]` in settings.toml): `font_family` (CSS list,
  default Menlo) and `word_wrap` for the file viewer.
- **Pane sizes** in the webview's `localStorage` (react-resizable-panels).
- **pi's own files** in `~/.unnamed-harness/pi`: credentials (`auth.json`),
  `settings.json`, where pi keeps the last chosen model and effort as the
  default for new sessions, and `sessions/`, one JSONL conversation per
  folder that reopening the folder continues. The model list and each model's effort levels
  always come from pi; the app never hard-codes them. `mcp.json` holds the
  MCP servers in pi-mcp-adapter's documented format (`mcpServers`, optional
  `settings`); Settings edits it and keeps fields it doesn't show. The adapter
  caches tool lists in `mcp-cache.json`; OAuth tokens for MCP servers (if any)
  go to the OS keychain.
- **App state** in `state.json` in the app data folder (`lib/store.ts`): recent
  folders (shared by all windows) and the main window's last open folder.

## The agent (pi)

The harness drives [pi](https://github.com/earendil-works/pi)
(`@earendil-works/pi-coding-agent`, pinned 0.87.1), run as a Node sidecar.
Before touching agent or provider-credential code, read the project skill in
`.claude/skills/pi/` (SKILL.md, then auth.md, host.md, sessions.md or mcp.md). The
old `@mariozechner/*` packages and most online material describe an older,
incompatible API.

The app only renders: pi does the work and the sidecar forwards its session
events (`toWireEvent`), which `lib/transcript.ts` turns into the conversation.
pi runs its tools (read, bash, edit, write) without asking; approval prompts
are planned in `.todo`.

MCP servers come from [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter)
(pinned 2.38.0), loaded into every session by `sidecar/mcpExtension.ts` with
the app's `mcp.json` as its whole config, so it never reads `~/.config/mcp`,
a project's `.mcp.json` or other apps' MCP configs. Servers connect on first
use; the model reaches them through the adapter's `mcp` and `mcp__<server>`
tools. Saving a change reloads the session (after the current run). Status
comes from the adapter's event-bus channel; see the skill's mcp.md.

Claude subscriptions run through the user's own Claude Code via the
`pi-claude-bridge` extension (pi provider `claude-bridge`), because Anthropic
bills pi's direct Claude sign-in to extra usage. See the skill's auth.md. ChatGPT signs in
automatically with the Codex CLI's login (`~/.codex/auth.json`) when the app
has none of its own; token refreshes are written back to that file.

## Commands

- Dev app: `npm run tauri dev` (frontend hot-reloads; `src-tauri/` changes relaunch)
- Verify before finishing any change: `npm run check` (tsc, ESLint, clippy,
  Prettier, rustfmt, Vitest, cargo test). CI runs the same steps.
- Tests only: `npm run test`; watch mode: `npm run test:watch`
- Find untested branches: `npm run coverage`
- Auto-format: `npm run format`
- Add a UI primitive: `npx shadcn@latest add <name>`
- Add a Tauri plugin: `npm run tauri add <plugin>` (wires npm, Cargo, `lib.rs` and a default permission)

## Testing

- **What to test:** any logic with branches or failure paths, especially code
  that talks to Tauri. Every `if`/`else`, fallback and error path should have a
  test that would fail if it broke. There is no coverage percentage target;
  use `npm run coverage` to spot branches nothing reaches.
- **Where logic goes:** keep it out of components. Put it in `lib/` (plain
  functions) or `hooks/`, where it can be tested without rendering UI.
- **Faking Tauri:** tests run in jsdom with `@tauri-apps/api/mocks`.
  `src/test/fakeFs.ts` fakes the fs plugin from a map of paths;
  `src/test/fakeStore.ts` fakes the store (broadcasting changes like the real
  one) and the folder picker. Hooks are tested with `renderHook`.
- **Module state:** modules that read the window label, open the store or
  cache at import time must be imported fresh per test (`vi.resetModules()`
  then `await import(...)`); see `useFolders.test.ts` or `gitignore.test.ts`.
- **Tests beside code:** `foo.ts` is tested in `foo.test.ts` next to it.
- **Rust:** `src-tauri/tests/` holds integration tests. Add unit tests next to
  any Rust logic that is added later.

## Conventions

- **Logic goes in TypeScript.** Prefer an official Tauri plugin's JS API over a
  custom Rust command. `src-tauri/src/lib.rs` should stay plugin registration only.
- **Permissions are explicit.** Any new Tauri API call needs its permission in
  `src-tauri/capabilities/default.json`; missing ones fail silently at runtime.
  Write access must stay scoped to the settings folder (enforced by a test).
- **Layout of `src/`:** screens and pieces in `components/`, stateful logic in
  `hooks/`, non-React helpers in `lib/`. Do not hand-edit `components/ui/`
  beyond small fixes; it is shadcn-generated.
- **Menus are shadcn.** Every menu, picker and dropdown uses a shadcn component
  (`Select`, `DropdownMenu`, …; add missing ones with `npx shadcn@latest add`).
  Never a native `<select>` or a hand-rolled popup.
- **Styling:** Tailwind v4 with shadcn tokens (`bg-background`, `text-muted-foreground`,
  `bg-sidebar`, …). No hard-coded colors. Interface text is 13px (`text-[13px]`)
  to match macOS.
- **Comments:** sparse; only for non-obvious constraints. Exported functions get
  a one-line doc comment. Deliberate shortcuts are marked `ponytail:` with
  their limit and upgrade path.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org)
  (`feat(scope): …`, `fix(scope): …`). CI must pass.

## Renaming the app

The name is a placeholder. To rename:

1. Change `APP_NAME` in `src/lib/app.ts`.
2. Run `npm run test`. `src/lib/app.test.ts` fails for each file that still
   has the old name: `package.json`, `src-tauri/Cargo.toml`,
   `src-tauri/tauri.conf.json` (product name, identifier, window title),
   `index.html`, and the settings folder in `src-tauri/capabilities/default.json`.
3. Update README.md. The Rust library is named `app_lib` on purpose, so no Rust
   code changes.

Changing the identifier moves the app data folder, so saved recent folders
start empty; the settings folder moves with the name.

## macOS gotchas (learned the hard way)

- `window.setTitle()` resets `trafficLightPosition`, and there is no runtime API
  to re-apply it. Do not change window titles.
- `maximize()` and the `maximized` config zoom over Stage Manager's strip.
  Window size is set in `lib/window.ts` from the monitor work area instead.
- The store plugin's `onKeyChange`/`onChange` filter by a per-webview resource
  id and miss changes from other windows. Use `onStoreChange` in `lib/store.ts`.
- The menu bar is global. Only the focused window may call `setAppMenu`,
  otherwise menu actions run in the wrong window.
- Setting a custom app menu drops the default Edit menu; keep the Edit items or
  copy/paste stops working (tested in `menu.test.ts`).
- Quit and Close Window are custom menu items, not the predefined `Quit` /
  `CloseWindow` ones, which act immediately and skip the confirmation dialog.
  ⌘W closes the active file tab and only falls through to the window when no
  tab is open. Quitting from the Dock still skips confirmation.
- New windows are created from `NEW_WINDOW_OPTIONS` in `lib/window.ts`, which
  must mirror the main window in `tauri.conf.json` (tested in `window.test.ts`).
