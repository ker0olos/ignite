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
  components/            UI only, one component per file; logic worth testing lives in lib/ or hooks/
    ui/                  shadcn/ui components (CLI-generated)
    app/                 Welcome screen (open and recent projects), Workspace layout, file tabs, pane handle
    sidebar/             Title-bar strip + file tree, MCP sign-in warning banner
    files/               Lazy directory tree, read-only syntax-highlighted file view
    agent/               Conversation area wiring, task composer, model/effort/approval menus, trust prompt
    conversation/        Transcript rendering: messages, thinking, tool rows (with approve/deny, or the
                         agent's questions) and their pieces
    settings/            Settings dialog shell, its rows, and one items file per section
    memory/              Recent cmem observations for the Memory settings
    mcp/                 MCP server rows, add/edit dialog, preset and import UI, brand marks
    providers/           Connect-a-provider screen: cards, sign-in/API-key forms, logos
  hooks/
    useFolders.ts        Recent folders, this window's open projects and the shown one
    useProjects.ts       Each open project's status (working, waiting); ends closed ones' sessions
    useSettings.ts       settings.toml, synced across windows; applies theme
    useFolderDrop.ts     Drag-and-drop folders onto the window
    useTabs.ts           Open file tabs, reset per folder (⌘W closes one)
    useProviders.ts      Provider status, sign-in and sign-out via the pi host
    useConnectScreen.ts  When the connect screen shows (first launch, on request)
    useAgentSession.ts   The folder's pi session: conversation, send/stop, trust, model and effort
    useSessionEvents.ts  Applies session events and approval requests; answers approvals
    useMcpServers.ts     MCP servers in pi's mcp.json, with live status pushed by the sidecar
    useMemory.ts         cmem's status and the folder's recent memories, while Settings is open
    useAbout.ts          The commit the app runs from; Check for updates, reloading every window
    useSettingsDialog.ts Settings open state, its first section, and what it fetches while open
  lib/
    app.ts               APP_NAME, the single source of the app's name
    settings.ts          Settings type, defaults, TOML load/save
    store.ts             App state (tauri-plugin-store) + cross-window sync
    files.ts             Directory listing and reading files for the viewer
    gitignore.ts         .gitignore matching for the file tree
    highlight.ts         Shiki highlighting with the chosen theme(s)
    codeThemes.ts        Theme types, built-ins, and grouping for the picker
    codeThemeDiscovery.ts Finds themes: Shiki bundle, VS Code-family editors, custom files
    codeThemeLoad.ts     Resolves a theme id to Shiki data, and imports an editor theme
    tabs.ts              Open/close logic for file tabs
    recent.ts            Recent-folders list logic
    fileIcons.ts         Extension → monochrome icon
    menu.ts              macOS menu bar
    lifecycle.ts         Confirm before quitting or closing a window
    piHost.ts            Starts the pi host sidecar; request/response client
    providerGroups.ts    Presents pi's providers as brands (Claude, ChatGPT)
    transcript.ts        Rebuilds the conversation from pi's session events
    toolRows.ts          Conversation rows: folds runs of reads/searches/shell commands, parses edit diffs
    modelMenu.ts         Composer model menu: hand-picked featured models, the rest under More
    mcpServers.ts        MCP server form (lines to args/env/headers), status labels
    memory.ts            Memory settings text: cmem status line, relative times
    about.ts             About text: version line, update button states, the macOS About panel
    approvalPolicy.ts    Which tool calls wait for approval (Manual / Auto, paths outside the folder)
    gitPolicy.ts         Which git and gh tool calls run and which ask (commit and push for review)
    gitDiff.ts           Unified diffs into diff lines; stepping through their changes
    diffTabs.ts          Diff tabs beside file tabs (encoded ids, labels), reading a git review
    dangerousCommands.ts Regex denylist of risky shell commands that Auto still asks about
    demo.ts              Demo mode (`npm run demo`): its folder, model state, shown session
    demoTranscript.ts    The demo's fixed conversation
    demoQuestions.ts     The demo's second project, waiting on the agent's questions
    questions.ts         ask_user answers being picked: options, own answer, per-option notes
    mcpToolCall.ts       Reads pi-mcp-adapter's tool calls (server, tool, arguments) for the conversation
    window.ts            Window sizing and New Window
    paths.ts             basename / dirname / ~ shortening
    utils.ts             `cn` class-name helper (shadcn)
  test/                  Test setup, fake Tauri backends (fakeFs, fakeStore), shared shell command cases
sidecar/                 pi host: a Node process the app starts (node sidecar/main.ts)
  main.ts                Entry: turns on mods/ overrides, then loads start.ts
  start.ts               stdio wiring; pi's files live in ~/.ignition/pi
  modsHooks.ts           Node resolve hooks that load mods/ files in place of the repo's
  host.ts                Request dispatch; createHost builds the handler
  hostTypes.ts           Shared types and HostContext; per-function context instead of closures
  hostAuth.ts            Provider sign-in (status, interaction, login)
  hostSession.ts         One session per open folder, kept running while hidden (sessionState, setModel, open, close, prompt)
  hostProjects.ts        Tells the app which open folders are working or waiting (pushProjects)
  hostApproval.ts        Tool calls waiting for the user (askApproval, answerApproval, denyAll)
  hostTrust.ts           Saves a folder's trust and reloads its session (setTrust)
  trust.ts               pi's trust store (trust.json); "ask" only when the folder has .pi/ resources
  approvalExtension.ts   pi extension: asks the app before tool calls, blocks denied ones
  bashParser.ts          Parses bash (tree-sitter) into pipelines for the approval rules
  sandbox.ts             Auto's OS sandbox for bash: writable folders, hidden credentials, allowed hosts
  hostMcp.ts             MCP server lifecycle (rememberSignIns, servers, pushMcpServers, changeMcp)
  hostMcpCatalog.ts      MCP presets and imports (toServerName, target, mcpCatalog, addPreset, importServers)
  hostMcpSignIn.ts       MCP server sign-in (signOut, signIn, usableServer, copySignIn)
  wire.ts                Session event wire form (toWireEvent, describeError)
  claudeCode.ts          The user's Claude Code login (`claude auth status/login`)
  appUpdate.ts           The app's own commit, and updating it (`git pull --ff-only`, `npm ci` if the lockfile changed)
  credentials.ts         pi's auth.json, falling back to the Codex CLI's ChatGPT login
  lines.ts               LF-only JSONL splitting
  mcpConfig.ts           pi-mcp-adapter's mcp.json: read, edit servers, cached tool names
  mcpExtension.ts        Loads pi-mcp-adapter into each session with only the app's mcp.json
  cmem.ts           cmem: finds its worker, the app's on/off setting, recent observations
  cmemExtension.ts  Records sessions in cmem and adds its recalled context to the prompt
  askExtension.ts        ask_user: the agent asks the user multiple-choice questions, or works alone
  subagentExtension.ts   subagent tool: hands tasks to a smaller model from the same provider and talks with it
  keepAwake.ts           Keeps the Mac from idle-sleeping (caffeinate) while an agent works
  gitExtension.ts        git and gh tools: run outside the sandbox, ask for themselves, redirect bash's
  gitRun.ts              Runs git and gh with prompts, pagers and (unless approved) hooks off
  gitReview.ts           A commit's or push's changed files and commits; one file's diff (git_diff)
  ghReview.ts            What `gh pr create` would open: title, branches, GitHub's compare of them
  headlessUI.ts          The UI context bound to sessions: declines prompts, passes errors to the app
  mcpCatalog.ts          One-click MCP presets, and other apps' MCP servers to import
  claudeCodeMcpAuth.ts   Claude Code's saved MCP sign-ins, copied when its URL servers are imported
  testMcpServer.ts       A one-tool stdio MCP server for tests
  types/                 Type shim for pi-mcp-adapter (its TypeScript fails our strict tsconfig)
demo/tempo/, demo/pantry/ Sample projects `npm run demo` opens (not built or tested here)
docs/                    README screenshots, taken in demo mode
shared/hostProtocol.ts   Messages between app and sidecar (used by both)
shared/agentTypes.ts     pi's messages and session events as they cross the wire
shared/questions.ts      ask_user's questions and answers (used by both)
shared/subagents.ts      The subagent tool's name, effort order and call details (used by both)
shared/git.ts            The git and gh tools' names and what a commit or push shows for review
shared/modsOverlay.ts    Which repo file a mods/ file replaces (IGNITION_MODS)
shared/modsVitePlugin.ts The same overrides for the frontend, in Vite
launcher/                How users run the app (not maintainers; see README)
  setup.sh               `npm run setup`: makes ~/Applications/Ignition.app
  launch.sh              What that app runs: update, start with ~/.ignition/mods,
                         fall back to the last good version, then to no mods
.todo                    Planned work
src-tauri/               Rust shell: registers plugins, nothing else
  tauri.conf.json        App and main-window config
  dev-runner.sh          Runs `tauri dev` from a .app so Stage Manager shows the icon
  tauri.macos.conf.json  macOS-only config (the runner above); merged over tauri.conf.json
  icons/icon.svg         App icon source; after editing run `npx tauri icon src-tauri/icons/icon.svg`
                         and delete the android/, ios/ and 64x64.png it also writes
  capabilities/          Permissions the frontend may use
  tests/config.rs        Guards on the config (write scope, hidden window)
.github/workflows/ci.yml Build, typecheck, lint, format check, tests on macOS, for pull requests to main
```

Two places hold persisted data:

- **User settings** in `~/.ignition/settings.toml` (`lib/settings.ts`).
  Human-editable; add new options to the `Settings` type and `DEFAULT_SETTINGS`.
- **Themes:** the `theme` setting is `"system"` (GitHub Light/Dark following
  macOS) or a theme id. The chosen theme colours code and decides light or dark
  mode. Themes come from Shiki, from extensions installed in VS Code, VSCodium,
  Cursor or Windsurf, or from `~/.ignition/themes/*.json`. Picking an
  editor theme copies it (includes merged) into that folder and saves the
  copy's id, so uninstalling the editor later can't break it; the copy records
  `importedFrom`, and the picker lists it once. Never read other editors'
  settings; only their installed theme files.
- **Editor settings** (`[editor]` in settings.toml): `font_family` (CSS list,
  default Menlo) and `word_wrap` for the file viewer.
- **Conversation settings** (`[conversation]`): `show_thinking` shows the
  model's reasoning rows (off by default). `ask_questions` (on by default)
  has the agent bring open decisions to the user with `ask_user`; off, the
  tool is dropped and the agent is told to decide alone. Read before each run.
- **Memory settings** (`[memory]`): `cmem` (on by default) records
  sessions in cmem, recalls its memories and gives the agent cmem's search
  tools. Recording checks it before each run; the tools follow a reload.
- **Subagent settings** (`[subagents]`): `enabled` (on by default) gives
  the agent the `subagent` tool; `max` (default 2) caps how many one
  conversation may start. Read before each run.
- **Power settings** (`[power]`): `keep_awake` (on by default, macOS only)
  runs `caffeinate -i` while any folder's agent works, and ends it when
  every agent finishes or waits on the user (`sidecar/keepAwake.ts`).
- **Approval settings** (`[approval]`): `mode`, `"auto"` (default) or
  `"manual"`, set from the composer. The sidecar reads it on every tool call.
- **Pane sizes** in the webview's `localStorage` (react-resizable-panels).
- **pi's own files** in `~/.ignition/pi`: credentials (`auth.json`),
  `settings.json`, where pi keeps the last chosen model and effort as the
  default for new sessions, and `sessions/`, one JSONL conversation per
  folder that reopening the folder continues, and `trust.json`, pi's
  per-folder project trust decisions. The model list and each model's effort levels
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
pi has no approval prompts of its own. `sidecar/approvalExtension.ts` (loaded
last into every session) handles `tool_call`: `lib/approvalPolicy.ts` decides
whether the call waits, the question goes to the host over pi's event bus
(`app/approval`) and on to the app as `approval_request`, and the tool row
shows Approve / Deny, answered with `approval_answer`. A denied call returns
`{ block: true, reason }` to the model; stopping the run or closing the
folder denies what's waiting. A hidden folder's question waits until it's
shown again. The `ask_user` tool (`sidecar/askExtension.ts`) uses the same
channel: its call waits as an approval, the row shows its questions, and
`approval_answer` carries the answers (declining leaves the choice to the
agent). The approval gate never asks about `ask_user` itself. **Manual** asks for every tool call (built-in,
MCP, everything); approved commands run as is. **Auto** asks for bash
commands on the denylist in `lib/dangerousCommands.ts` and for file tools
whose resolved path (symlinks followed) is outside the open folder. Every
other bash command runs without asking inside an OS sandbox
(`sidecar/sandbox.ts`, Anthropic's `@anthropic-ai/sandbox-runtime`: Seatbelt
on macOS, bubblewrap on Linux). It may write only in the folder, temp
folders and package caches, can't read credentials (`~/.ssh`, `~/.aws`,
keychains, auth files) and reaches only package registries and git hosts
through the runtime's proxy, which runs in the sidecar. When a failed command
was blocked, the extension appends the sandbox's report and tells the model
to rerun it unchanged; the rerun asks the user, and if approved runs outside
the sandbox. Approving a denylisted command also runs it outside. Where the
sandbox can't start, Auto instead asks for bash commands naming absolute, `~`
or `..` paths outside the folder. On Windows (no sandbox, and a denylist
written for Unix) Auto asks for every bash and PowerShell command; file
tools compare Windows paths (drive letters, backslashes, any case). Bash commands are parsed first
(`sidecar/bashParser.ts`, tree-sitter's bash grammar): the rules check each
pipeline's real words and redirects, including code run by `bash -c`,
`eval`, `$(…)` or a heredoc fed to a shell, so quoted text and other heredocs
aren't mistaken for commands. A line that doesn't parse is checked as raw
text. The denylist is a guard against mistakes; the sandbox is the boundary,
and it covers bash only (file tools and MCP servers run unsandboxed).

The `git` and `gh` tools (`sidecar/gitExtension.ts`) run git and the GitHub
CLI outside the sandbox with the user's credentials, from an argument list
(no shell). They ask for themselves, so the approval extension skips them:
Manual asks for every call; Auto (`lib/gitPolicy.ts`) runs reads and local
work (status, diff, log, fetch, pull, clone, switch, add…) and asks for
anything else, for options that run a program or change git's config
(`-c`, `--upload-pack`, `rebase -x`, `git config` writes…), and for paths
outside the folder. A commit, push or `gh pr create` waits with a review: its changed files
(status, +/− counts) and message or commits, each file opening its diff in a
tab (`git_diff`). The sandbox already refuses writes to `.git/config` and
`.git/hooks`; hooks can still live in the working tree (husky), so calls that
ran without asking run with hooks off. Bash commands that commit, push, pull,
fetch, clone or run gh are blocked with a pointer to the tools.

The `subagent` tool (`sidecar/subagentExtension.ts`) lets the agent start
another pi session on a task: a smaller model from its own provider (cheaper
per output token in pi's catalog; claude-bridge models are priced by their
`anthropic` listing), at an effort below its own (both checked, not just
suggested). The host
opens it in memory (`openSubagent` in `start.ts`) with only the bridge and
approval extensions, so its tool calls wait for approval like the main
agent's and show inside the subagent's tool row, rebuilt from the call's
`details.messages`. Its final reply is the tool result; the main agent
answers a subagent's question, or gives it more work, by calling the tool
again with its id. Subagents end with their session and aren't restored
after a reload.

Sessions open with the project untrusted, so a folder's own `.pi/`
extensions, skills and settings never load unasked. When a folder has some
and pi's trust store has no decision, `open_session` reports `trust: "ask"`
and the conversation shows a trust prompt once; the answer is saved with
`set_trust` in `trust.json`, and trusting reloads the session (after the
current run) with the folder's resources.

MCP servers come from [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter)
(pinned 2.38.0), loaded into every session by `sidecar/mcpExtension.ts` with
the app's `mcp.json` as its whole config, so it never reads `~/.config/mcp`,
a project's `.mcp.json` or other apps' MCP configs. Servers connect on first
use; the model reaches them through the adapter's `mcp` and `mcp__<server>`
tools. Saving a change reloads the session (after the current run), and a
URL server that was just added, imported or edited connects once, so one that
needs OAuth shows "Needs sign-in" (with a Sign in button running the adapter's
`/mcp-auth`) during setup rather than when the agent first needs it. Status
comes from the adapter's event-bus channel; see the skill's mcp.md.
Settings offers presets (the adapter's list plus a few of ours) and imports
servers already set up in Claude Code (user, this folder's local scope,
`.mcp.json`), Cursor, Codex and Claude Desktop. Those files are only read,
when the MCP settings load; importing copies the entry into the app's mcp.json.

When [cmem](https://cmem.ai) (claude-mem, also used by Codex, Cursor and
other agents) is installed and its worker is running,
`sidecar/cmemExtension.ts` does what its agent hooks do, over the worker's
local HTTP API (port from `~/.claude-mem/worker.pid`): each prompt, tool
result and finished run is recorded under platform `ignition`, and the
folder's recalled context (from every agent, not just this app) is appended
to the system prompt. The Memory settings section turns it on or off
(`[memory] cmem`), shows its status and previews the folder's latest memories. It honours
`CLAUDE_MEM_EXCLUDED_PROJECTS`, which the worker itself doesn't check.
While it's on, `mcpExtension.ts` also adds cmem's own MCP server (`cmem`,
`mcp-server.cjs` beside the running worker's script, so any agent's install
works) to the adapter's config: eager, with `search`, `timeline` and
`get_observations` as direct tools. It isn't in mcp.json, so the MCP page
doesn't list it; toggling the setting sends `memory_changed`, which reloads
the session like an MCP change.

Claude subscriptions run through the user's own Claude Code via the
`pi-claude-bridge` extension (pi provider `claude-bridge`), because Anthropic
bills pi's direct Claude sign-in to extra usage. See the skill's auth.md. ChatGPT signs in
automatically with the Codex CLI's login (`~/.codex/auth.json`) when the app
has none of its own; token refreshes are written back to that file.

## Users and mods

Users run the app through `launcher/` (README "Install"), and maintainers run
`npm run tauri dev`. For users, `IGNITION_MODS` points at `~/.ignition/mods`:
a file there replaces the file at the same path under `src/`, `sidecar/` or
`shared/` (Vite through `shared/modsVitePlugin.ts`, Node through
`sidecar/modsHooks.ts`), so their changes never conflict with upstream.
Without the variable nothing changes.

- `sidecar/main.ts` only turns the overrides on, then loads `start.ts`. Keep
  it that way; anything it imports statically can't be modded.
- Load sibling files through `import.meta.resolve`, not `import.meta.dirname`,
  so they are still found when the importing file is a mod.
- The launcher counts a start as good once `reportHealthy()` (`lib/health.ts`)
  writes `IGNITION_HEALTH_FILE`, after the sidecar answers. Keep that call on
  the startup path, or every update looks broken and gets rolled back.

## Commands

- Dev app: `npm run tauri dev` (frontend hot-reloads; `src-tauri/` changes relaunch)
- Demo for screenshots: `npm run demo` opens `demo/tempo` with a fixed
  conversation (`lib/demoTranscript.ts`) instead of a pi session. No sign-in,
  nothing runs or is saved, so clearing sessions or app state never loses it.
  `demo.test.ts` keeps its diffs in line with the files in `demo/tempo`.
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
- **One UI component per file, grouped by feature.** Every distinct piece of
  UI (chat box, model menu, file tree, a settings section, a tool row…) is its
  own component in its own file under `components/<feature>/`, so it can be
  edited without touching its neighbours. A parent composes children and
  passes props; it never inlines a child's markup. No private helper
  components either: every component gets its own file. New features follow
  this from the start.
- **Size limits are enforced** by oxlint (`.oxlintrc.json`, part of `npm run
lint`): one component per file, files ≤250 lines, functions ≤120 lines,
  complexity ≤10, nesting ≤4. Split code instead of raising a limit or adding
  to the exemption list.
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
