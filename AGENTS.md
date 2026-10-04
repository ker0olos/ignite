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
    app/                 Welcome screen (open and recent projects), Workspace layout, file tabs, pane handle,
                         zoomable images and the markup editor (react-konva) for attached ones
    sidebar/             Title-bar strip, every folder (by name) with its conversations, file tree,
                         MCP sign-in warning banner
    files/               Lazy directory tree, read-only syntax-highlighted file view
    command/             ⌘K command center: search box, results, preview (conversation details, file, folder)
    agent/               Conversation area wiring, task composer, model/effort/approval menus, git status, trust prompt
    conversation/        Transcript rendering: messages, thinking, tool rows (with approve/deny, or the
                         agent's questions) and their pieces; WorkingLine is the run's spinner, step and time
    settings/            Settings dialog shell, its rows, and one items file per section
    memory/              Recent cmem observations for the Memory settings
    mcp/                 MCP server rows, add/edit dialog, preset and import UI, brand marks
    skills/              Skill and plugin rows, import UI from other apps
    providers/           Connect-a-provider screen: cards, sign-in/API-key forms, logos
    children/            Tabs for what runs under a conversation: a subagent's conversation, a background command's output, the user's interactive terminals
    terminal/            TerminalSurface: text drawn as a read-only terminal (xterm)
    tasks/               Tasks view: the checklist, rows that open in place with their status card,
                         the new-task sheet (notes, images, subtasks, model and effort)
  hooks/
    useFolders.ts        Recent folders, this window's open projects and the shown one
    useProjects.ts       Each open project's and conversation's status (working, waiting, title);
                         ends closed projects' sessions
    useSettings.ts       settings.toml, synced across windows; applies theme
    useFolderDrop.ts     Drag-and-drop folders onto the window
    useTabs.ts           Open file tabs, reset per folder (⌘W closes one)
    useProviders.ts      Provider status, sign-in and sign-out via the pi host
    useConnectScreen.ts  When the connect screen shows (first launch, on request)
    useAgentSession.ts   The folder's shown pi session: conversation, send/stop, trust, model and effort
    useSessionSwitch.ts  Showing and closing the shown folder's conversations
    useSessionCache.ts   Each folder's last known conversation, or none; which one events apply to
    useComposerActions.ts Send, stop, model and effort; the first message starts a new conversation
    useCompact.ts        `/compact`: compacts the shown conversation
    useMentions.ts       The composer's completions: `/skill` at the start, `@image1`, `@t1` and `@path` anywhere
    useDraftState.ts     A folder with no conversation: the models and effort it would start with
    useConversationList.ts Each folder's listed conversations, remembered across launches
    useConversationTags.ts Conversation tags by id, shared by all windows, kept after one closes; the sidebar's tag filter
    useConversations.ts  Every open folder's conversations for the sidebar: show, create, close, details
    useCommandCenter.ts  ⌘K / Ctrl+K opens the command center, optionally with a query;
                         ⌘P / Ctrl+P opens it on @files with no preview
    useCommandSearch.ts  The command center's results: debounced command_search, folders, @ suggestions
    useDetailsCache.ts   Session details fetched once each, for the command center preview
    useOpenFile.ts       Opens a tab (file, diff, subagent…) in any folder, switching to it first
    useXterm.ts          An xterm fitted to its element and themed like the app (read-only and interactive views)
    useTerminalSession.ts A terminal view's connection to the host: snapshot, live output, keystrokes
    useTerminalShortcut.ts ⌘1 / Ctrl+1 opens a terminal tab; returns run-in-terminal
    useRunInTerminal.ts  Run-in-terminal for assistant shell code blocks' Run button
    useTerminalTabs.ts   A closed tab's shell ends; a folder shown again reopens its shells' tabs
    useGitStatus.ts      The shown conversation's repositories (branch, uncommitted, unpushed, pull request), read every 5s
    useGitRepoDetails.ts A repository's uncommitted files and unpushed commits, while its composer popover is open
    useBackgroundOutput.ts A background command's output, read again while it runs; stopping it
    useClearedChildren.ts  Finished subagents and background commands cleared from the sidebar
    useSessionEvents.ts  Applies session events and approval requests; answers approvals
    useQuestionKeys.ts   The agent's questions from the keyboard: ↑/↓ between answers, ⌘N own answer, ⌘↩ on, ⌘⌫ skip
    useMcpServers.ts     MCP servers in pi's mcp.json, with live status pushed by the sidecar
    useSkills.ts         The app's skills and plugins, and other apps' to import, while Settings is open
    useMemory.ts         cmem's status and the folder's recent memories, while Settings is open
    useAbout.ts          The commit the app runs from; Check for updates, reloading every window
    useSettingsDialog.ts Settings open state, its first section, and what it fetches while open
    useTextSize.ts       ⌘/Ctrl +, - and 0 resize message text
    useRemoteAccess.ts   Main window: starts the remote access server, runs browsers' allowed Tauri calls
    useTasks.ts          The folder's tasks, pushed by the sidecar, with status from their conversations
    useNewTaskSheet.ts   ⌘N / Ctrl+N opens the new-task sheet while the Tasks view shows
    useMarkup.ts         An image's marks being drawn: tools, ink, selection, text, undo/redo;
                         useMarkupKeys.ts its shortcuts, useMarkupImage.ts loading and fitting the image,
                         useMarkupView.ts zooming and panning it
    useSpinnerFrame.ts   The working line's braille spinner frame (still under reduced motion); useNow.ts ticks its elapsed time
    useImageTarget.ts    The showing input (conversation, task sheet) marked-up images are added to
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
    conversationTags.ts  Conversation tags: splitting typed text, adding, removing, suggestions
    commandQuery.ts      Command center query: `@folder`, `@convos`/`@files`/`@folders`, result picks
    fileIcons.ts         Extension → monochrome icon
    menu.ts              macOS menu bar
    lifecycle.ts         Confirm before quitting or closing a window
    piHost.ts            Starts the pi host sidecar; request/response client
    providerGroups.ts    Presents pi's providers as brands (Claude, ChatGPT)
    gitStatus.ts         Which of a conversation's repositories the composer shows, and their pull requests' state
    transcript.ts        Rebuilds the conversation from pi's session events
    compaction.ts        Compaction in the conversation: running, then its summary; saved summaries
    toolRows.ts          Conversation rows: folds runs of reads/searches/shell commands, parses edit diffs
    modelMenu.ts         Composer model menu: hand-picked featured models, the rest under More
    mcpServers.ts        MCP server form (lines to args/env/headers), status labels
    skills.ts            Skills settings text: counts
    memory.ts            Memory settings text: cmem status line, relative times
    about.ts             About text: version line, update button states, the macOS About panel
    approvalPolicy.ts    Which tool calls wait for approval (Manual / Auto, paths outside the folder)
    gitPolicy.ts         Which git and gh tool calls run and which ask (commit and push for review)
    gitDiff.ts           Unified diffs into diff lines; stepping through their changes
    diffTabs.ts          Diff tabs beside file tabs (encoded ids, labels), reading a git review
    dangerousCommands.ts Regex denylist of risky shell commands that Auto still asks about
    demo.ts              Demo mode (`npm run demo`): its folders, host, sidebar rows, scripted typing
    demoHost.ts          The demo's stand-in for the sidecar: scripted answers and replies, nothing runs
    demoAnswers.ts       The demo's providers, MCP servers, memory, version and files
    demoConversations.ts Every demo conversation (open and saved), with details and git diffs
    demoTranscript.ts    The dark mode conversation's work: edits whose diffs match demo/tempo
    demoDarkMode.ts      Its delivery through git: commit, push, pull request
    demoTempoWork.ts     Tempo's other conversations: a commit awaiting review, one still working
    demoGit.ts           Unified diffs and commit reviews for the demo
    demoQuestions.ts     The demo's second project, waiting on the agent's questions
    questions.ts         ask_user answers being picked: options, own answer, per-option notes
    tasks.ts             A task's status from its conversation, groups, the sheet's draft, pasted images
    runStep.ts           What a running conversation is doing now (its step, start time, elapsed text)
    runCommand.ts        Which code blocks Run offers for, and a block as terminal keystrokes
    mentions.ts          `/compact`, `/skill` and `@` completions: the token at the caret, options, sending a skill as `/skill:name`
    queue.ts             Queued messages in the transcript; the composer's keys (↵ queues, ⇧⌘↵ sends the first now)
    markup.ts            Image markup marks: drawing them out, history, stroke sizes, shortcut keys
    demoHtml.ts          The page the dark mode conversation embeds with show_html
    demoTasks.ts         The demo's tasks, following its conversations; demoTaskImages.ts draws their images
    mcpToolCall.ts       Reads pi-mcp-adapter's tool calls (server, tool, arguments) for the conversation
    window.ts            Window sizing and New Window
    paths.ts             basename / dirname / ~ shortening
    utils.ts             `cn` class-name helper (shadcn)
    remote.ts            In a browser (remote access): stands in for Tauri over a WebSocket to the sidecar
    remoteFirst.ts       Installs that stand-in before any other module loads (first import in main.tsx)
  test/                  Test setup, fake Tauri backends (fakeFs, fakeStore), shared shell command cases
sidecar/                 pi host: a Node process the app starts (node sidecar/main.ts)
  main.ts                Entry: turns on mods/ overrides, then loads start.ts
  start.ts               stdio wiring; pi's files live in ~/.ignite/pi
  modsHooks.ts           Node resolve hooks that load mods/ files in place of the repo's
  host.ts                Request dispatch; createHost builds the handler
  hostTypes.ts           Shared types and HostContext; per-function context instead of closures
  hostAuth.ts            Provider sign-in (status, interaction, login)
  hostSession.ts         Open conversations, several per folder, kept running while hidden (sessionState, setModel, open, close, prompt)
  hostProjects.ts        Tells the app which open conversations are working or waiting (pushProjects)
  hostResume.ts          Resumes a run a reload or quit cut off: pending calls marked not run, agent continues
  sessionStore.ts        pi's saved conversations per folder: the latest, new ids, the list
  search.ts              command_search: each folder's conversations and files, cached, ranked by shared/commandSearch.ts
  fileIndex.ts           A folder's files for search (git ls-files, else a capped walk)
  sessionRuntime.ts      Each session's own model runtime (passes its cwd to providers); saved model
  draftSession.ts        What a new conversation would start with (models, effort) before one exists
  worktrees.ts           Each agent's git worktree: start point, open, save and remove, sweep; updateFolder
  worktreeExtension.ts   Tells an agent in a worktree where it is and to deliver through a pull request
  worktreeGit.ts         Worktree paths, snapshots of a working state, folderOf / gitWritable
  worktreeClone.ts       Copy-on-write clones of the folder's ignored files into a worktree
  hostApproval.ts        Tool calls waiting for the user (askApproval, answerApproval, denyAll)
  hostQueue.ts           Messages sent mid-run: stop takes them back; one taken back, moved up or sent now
  compactProgress.ts     `/compact`'s progress: the summary's tokens, read off pi's stream as it's written
  queuedImages.ts        Queued messages' images (pi's queue lists only text), forgotten once delivered
  hostTrust.ts           Saves a folder's trust and reloads its session (setTrust)
  trust.ts               pi's trust store (trust.json); "ask" only when the folder has .pi/ resources
  approvalExtension.ts   pi extension: asks the app before tool calls, blocks denied ones
  bashParser.ts          Parses bash (tree-sitter) into pipelines for the approval rules
  sandbox.ts             Auto's OS sandbox for bash: writable folders, hidden credentials, allowed hosts
  bashExtension.ts       pi's bash with `background: true` (dev servers, watchers), and bash_stop to end them
  backgroundBash.ts      Background commands per conversation: their logs, stopping them with what they started
  ptyShell.ts            Shells in a PTY (node-pty): spawning, killing its tree, its output as screen text
  ptyBash.ts             Background commands' shell in a PTY: stdin from /dev/null, pagers off
  terminal.ts            The user's terminals: a login shell in a PTY (node-pty), mirrored in a headless xterm
  terminalExtension.ts   terminal_read, and the terminals' new output added to each run;
                         tells the agent what the composer's `@` mentions name
  exploreExtension.ts    Tells the agent how to search the code before answering (parallel calls, follow the flow)
  grepFiles.ts           pi's grep with `filesOnly`: matching files and their counts, not the lines
  readTools.ts           pi's read showing 400 lines unless told otherwise; `outline`
  outline.ts             A code file's definitions by line (tree-sitter tags queries: TS, JS, Python, Rust, Go)
  hostChildren.ts        Each conversation's subagents and background commands, for the sidebar
  sandboxAllow.ts        What the user always allows the sandbox (~/.ignite/sandbox.json): hosts, sockets, paths
  hostMcp.ts             MCP server lifecycle (rememberSignIns, servers, pushMcpServers, changeMcp)
  hostMcpCatalog.ts      MCP presets and imports (toServerName, target, mcpCatalog, addPreset, importServers)
  hostMcpSignIn.ts       MCP server sign-in (signOut, signIn, copySignIn), run in the MCP session
  mcpSession.ts          An in-memory session with only the MCP adapter: checks and sign-ins with no conversation open
  wire.ts                Session event wire form (toWireEvent, describeError)
  claudeCode.ts          The user's Claude Code login (`claude auth status/login`)
  appUpdate.ts           The app's own commit, and updating it (`git pull --ff-only`, `npm ci` if the lockfile changed)
  credentials.ts         pi's auth.json, falling back to the Codex CLI's ChatGPT login
  lines.ts               LF-only JSONL splitting
  mcpConfig.ts           pi-mcp-adapter's mcp.json: read, edit servers, cached tool names
  mcpExtension.ts        Loads pi-mcp-adapter into each session with only the app's mcp.json
  skillStore.ts          The app's skills and plugins (bundles of skills): list, on/off, remove, import;
                         the only skills sessions load besides the folder's own
  skills/                Built-in skills (code-review, security-review), loaded after the app's; a skill of the same name replaces one
  skillCatalog.ts        Other apps' skills to import: Claude Code, Codex, Cursor, ~/.agents, Claude Code plugins
  cmem.ts           cmem: finds its worker, the app's on/off setting, recent observations
  cmemExtension.ts  Records sessions in cmem and adds its recalled context to the prompt
  askExtension.ts        ask_user: the agent asks the user multiple-choice questions, or works alone
  taskStore.ts           Each folder's tasks in ~/.ignite/tasks, written one at a time, pushed on change
  hostTasks.ts           Starts a task in a background conversation; answers the task extension
  taskExtension.ts       task_update, and a task conversation's plan, work and wrap-up phases
  taskAddTool.ts         task_add: any other conversation proposes tasks, added unstarted once approved
  taskSteps.ts           Which tools change files (CHANGES_FILES), held until a task is planned
  subagentExtension.ts   subagent tool: hands tasks to its model or a cheaper one from the same provider and talks with it
  subagentQueue.ts       Runs at most `max` subagents at once; the rest wait their turn
  subagentSession.ts     A subagent's session: talking to it and ending it (the 8 last used stay open)
  keepAwake.ts           Keeps the Mac from idle-sleeping (caffeinate) while an agent works
  chrome.ts              Chrome over CDP: a headless one the app starts, or the user's own (port 9222) when asked
  chromeExtension.ts     chrome_* tools: tabs, screenshot, eval, navigate, raw CDP calls
  chromePage.ts          A tab's CDP calls: run JS, wait for load, screenshot
  taskTabs.ts            Which Chrome tabs a task may use: only its own, named by id
  adbExtension.ts        adb and adb_screenshot: Android devices, run outside the sandbox
  imageExtension.ts      show_image: shows the user an image file from any path in its tool row
                         and, in a task's conversation, on the task's card
  htmlExtension.ts       show_html: embeds an HTML page in its tool row, in a sandboxed iframe
  gitExtension.ts        git and gh tools: run outside the sandbox, ask for themselves, redirect bash's
  gitPush.ts             The git tool's `push: true`: a commit that pushes its branch in the same call
  gitMerged.ts           Refuses a commit or push on a branch whose pull request was already merged
  gitRun.ts              Runs git and gh with prompts, pagers and (unless approved) hooks off
  gitReview.ts           A commit's or push's changed files and commits; one file's diff (git_diff)
  gitPlace.ts            A review's repository (origin owner/name, else folder name) and branch
  gitStatus.ts           The repositories a conversation's git calls and edits touched, and what isn't committed, pushed or merged
  gitUntracked.ts        New files git doesn't track yet: listed as added, and their whole-file diffs
  ghReview.ts            What `gh pr create` would open: title, branches, GitHub's compare of them
  headlessUI.ts          The UI context bound to sessions: declines prompts, passes errors to the app
  mcpPresets.ts          One-click MCP presets (the adapter's and ours)
  mcpCatalog.ts          Other apps' MCP servers to import
  claudeCodeMcpAuth.ts   Claude Code's saved MCP sign-ins, copied when its URL servers are imported
  testMcpServer.ts       A one-tool stdio MCP server for tests
  remote.ts              Remote access: browsers share this sidecar; replies routed by id, events to all
  remoteServer.ts        Its HTTP server: proxies the UI from Vite, WebSocket; its links (network, Tailscale)
  types/                 Type shim for pi-mcp-adapter (its TypeScript fails our strict tsconfig)
demo/tempo/, demo/pantry/ Sample projects `npm run demo` opens (not built or tested here)
docs/                    README screenshots, taken in demo mode
shared/hostProtocol.ts   Messages between app and sidecar (used by both)
shared/validation.ts     Checks on typed API keys and MCP servers (used by both)
shared/agentTypes.ts     pi's messages and session events as they cross the wire
shared/conversations.ts  Saved conversations, their details, command search hits (used by both)
shared/skills.ts         Skills, plugins and importable skills as they cross the wire, and their requests;
                         a skill's expanded message shown as the `/name` typed
shared/mcpCatalog.ts     MCP presets and other apps' servers the MCP settings offer
shared/mcpServers.ts     MCP servers as they cross the wire (re-exported by hostProtocol.ts)
shared/terminal.ts       The user's terminals: requests, output events, terminal_read's name
shared/memory.ts         cmem status and observations as they cross the wire
shared/fuzzy.ts          Fuzzy match score for the command center (used by both)
shared/commandSearch.ts  Ranks conversations and files for the command center (sidecar and demo)
shared/adb.ts            The adb tool's arguments: its command, host paths, calls that never exit
shared/questions.ts      ask_user's questions and answers (used by both)
shared/tasks.ts          Tasks and the agent's updates to them (used by both)
shared/queue.ts          Messages sent mid-run: how they wait, and taking one back (used by both)
shared/subagents.ts      The subagent tool's name, effort order and call details (used by both)
shared/steps.ts          A tool call as a current step ("Editing src/app.ts"), for tasks and the working line
shared/git.ts            The git and gh tools' names and what a commit or push shows for review
shared/modsOverlay.ts    Which repo file a mods/ file replaces (IGNITE_MODS)
shared/modsVitePlugin.ts The same overrides for the frontend, in Vite
shared/remote.ts         Remote access messages, the Tauri calls browsers may make, bytes over JSON
launcher/                How users run the app (not maintainers; see README)
  setup.sh               `npm run setup`: makes ~/Applications/Ignite.app
  launch.sh              What that app runs: update, start with ~/.ignite/mods,
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
.github/workflows/ci.yml Build, typecheck, lint, format check, tests on macOS, for pull requests to main and pushes to it (main saves the Rust cache PRs restore)
.github/dependabot.yml   Daily PRs for new pi and pi-claude-bridge versions (new models arrive through them)
```

Two places hold persisted data:

- **User settings** in `~/.ignite/settings.toml` (`lib/settings.ts`).
  Human-editable; add new options to the `Settings` type and `DEFAULT_SETTINGS`.
- **Themes:** the `theme` setting is `"system"` (GitHub Light/Dark following
  macOS) or a theme id. The chosen theme colours code and decides light or dark
  mode. Themes come from Shiki, from extensions installed in VS Code, VSCodium,
  Cursor or Windsurf, or from `~/.ignite/themes/*.json`. Picking an
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
  `text_size` (px, default 14, 10–24) sizes user and assistant messages only;
  ⌘/Ctrl +, - and 0 change it (`hooks/useTextSize.ts`).
- **Sidebar settings** (`[sidebar]`): `conversation_order` (`oldest_first` by
  default, or `newest_first`) orders each folder's conversations;
  `max_conversations_enabled` (off) collapses a folder after
  `max_conversations` (default 5, 1–20); `resizable_split` (off) lets the
  divider between conversations and files be dragged.
- **Composer settings** (`[composer]`, shown under Appearance): `git_status`
  (on by default) lists, after the approval menu, the conversation's
  repositories with uncommitted files, unpushed commits or an open pull
  request; off, nothing is read.
- **Memory settings** (`[memory]`): `cmem` (on by default) records
  sessions in cmem, recalls its memories and gives the agent cmem's search
  tools. Recording checks it before each run; the tools follow a reload.
- **Subagent settings** (`[subagents]`): `enabled` (on by default) gives
  the agent the `subagent` tool; `max` (default 2) caps how many of a
  conversation's run at once; it may start any number, and the rest queue
  (`sidecar/subagentQueue.ts`). Read before each run.
- **Power settings** (`[power]`): `keep_awake` (on by default, macOS only)
  runs `caffeinate -i` while any folder's agent works, and ends it when
  every agent finishes or waits on the user (`sidecar/keepAwake.ts`).
  `keep_screen_awake` (off by default) adds `-d`, keeping the display on too.
- **Remote settings** (`[remote]`): `enabled` (off by default) and `port`
  (4280). The main window's sidecar serves the UI to any browser that
  reaches the port, with no password; when Tailscale is connected (a
  100.64/10 address), Settings also shows its link. Their Tauri calls run in
  the main window, limited to `REMOTE_COMMANDS` (`shared/remote.ts`).
- **Chrome settings** (`[chrome]`): `enabled` (on by default) gives the
  agent the `chrome_*` tools; `disabled_tools` lists ones it doesn't get
  (`shared/chrome.ts`). Read before each run (`sidecar/chromeSettings.ts`).
- **Approval settings** (`[approval]`): `mode`, `"auto"` (default) or
  `"manual"`, set from the composer. `full_access` (off by default, Settings →
  Agent) makes Auto ask for nothing and drops the sandbox: every tool call,
  git and gh included, runs as is. The sidecar reads both on every tool call.
- **Pane sizes** in the webview's `localStorage` (react-resizable-panels).
- **pi's own files** in `~/.ignite/pi`: credentials (`auth.json`),
  `settings.json`, where pi keeps the last chosen model and effort as the
  default for new sessions, and `sessions/`, one JSONL file per
  conversation. A folder can have several open at once, each keyed by pi's
  session id and listed under its folder in the sidebar (the list is kept
  in state.json, and one starts again when clicked). Showing a folder shows
  its last shown conversation, or an empty one: a session starts only with
  its first message. A reopened one shows from its file (`read_session`)
  while its session starts. Closing one keeps its file, and the ⌘K
  command center (a folder's History button opens it filtered to that
  folder) reopens it. And `trust.json`, pi's
  per-folder project trust decisions. The model list and each model's effort levels
  always come from pi; the app never hard-codes them. `mcp.json` holds the
  MCP servers in pi-mcp-adapter's documented format (`mcpServers`, optional
  `settings`); Settings edits it and keeps fields it doesn't show. The adapter
  caches tool lists in `mcp-cache.json`; OAuth tokens for MCP servers (if any)
  go to the OS keychain.
- **App state** in `state.json` in the app data folder (`lib/store.ts`): recent
  folders (shared by all windows), the main window's last open folder, and
  conversation tags (`conversation_tags`, by conversation id, shared by all
  windows and kept after a conversation closes).

## The agent (pi)

The harness drives [pi](https://github.com/earendil-works/pi)
(`@earendil-works/pi-coding-agent`, pinned 1.0.0), run as a Node sidecar.
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
through the runtime's proxy, which runs in the sidecar. Commands run with
`pipefail`. When a command was blocked (it failed, or its output says so),
the same call asks the user before it ends; approved, the
extension runs it outside the sandbox and that output is the result, declined,
the model gets the sandbox's report. When the sandbox named what it blocked
(a host, Unix socket, or path read or written; never a credential, nor
one already on the list), the prompt also offers
**Always allow**, which adds it to `~/.ignite/sandbox.json`
(`sidecar/sandboxAllow.ts`, read before every command) and runs this one
outside. Approving a denylisted command also runs it outside. Where the
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

Background commands run in a PTY (`sidecar/ptyBash.ts`), like the user's
terminal, so programs color and format their output as they would there;
stdin is `/dev/null` and pagers are `cat`, so nothing waits on input. The
agent gets their first output as a headless xterm renders it (`screenText`),
and the log keeps the raw stream for their tab. Other bash calls stay on
pi's pipes: a terminal would alter what the agent reads (tabs, trailing
spaces) and become the controlling tty, so password prompts would wait.

`bash` takes `background: true` for commands that don't exit (`npm run
dev`, watchers): `sidecar/bashExtension.ts` overrides pi's bash tool, so
approval and the sandbox treat it like any command. It returns after 5
seconds with the output so far, the pid and a log file in the temp folder;
`bash_stop` ends it with everything it started (the sandbox only lets a
process signal its own sandbox), killing it if it hasn't exited after 3
seconds. The sandbox doesn't let commands listen on ports or reach local
services (the user's Chrome, the remote access server), so a dev server
fails there and asks to run outside. A conversation's background commands
end with it (not on a reload) and with the sidecar, on a signal too.

The sidebar lists each conversation's subagents and background commands
under it (`AgentStatus` in `shared/agentStatus.ts`, pushed on change).
Each opens as a tab beside the files (`lib/childTabs.ts`): a subagent's
whole conversation, rebuilt from its calls in the shown conversation, or a
command's output, read again each second while it runs. Finished rows can
be cleared; which were is kept in the window's localStorage.

The `git` and `gh` tools (`sidecar/gitExtension.ts`) run git and the GitHub
CLI outside the sandbox with the user's credentials, from an argument list
(no shell). They ask for themselves, so the approval extension skips them:
Manual asks for every call; Auto (`lib/gitPolicy.ts`) runs reads and local
work (status, diff, log, fetch, pull, clone, switch, add…) and asks for
anything else, for options that run a program or change git's config
(`-c`, `--upload-pack`, `rebase -x`, `git config` writes…), and for paths
outside the folder. A commit, push or `gh pr create` waits with a review: its changed files
(status, +/− counts) and message or commits, each file opening its diff in a
tab (`git_diff`). A commit called with `push: true` (on a branch) waits
once, its review naming the branch ("Commit and push to origin/<branch>"), then
runs `push -u origin <branch>`; other git options than `-C` are refused; a task's runs alone only when both would. A commit or push that continues a branch whose pull request
was merged (it holds that pull request's head commit but not its merge, none
is open, and no pull request targets the branch) is refused before it asks,
pointing the agent at a new branch from the default one
(`sidecar/gitMerged.ts`); when gh can't tell within 10 seconds, it goes ahead. The sandbox already refuses writes to `.git/config` and
`.git/hooks`; hooks can still live in the working tree (husky), so calls that
ran without asking run with hooks off. Bash commands that commit, push, pull,
fetch, clone or run gh are blocked with a pointer to the tools.

The user's own terminals (`sidecar/terminal.ts`) run their login shell in
the folder (not a worktree) in a PTY, outside the sandbox: `terminal_open`
returns an id, keystrokes go in with `terminal_input`, and output comes back
as `terminal_data` events (`terminal_snapshot` restores a new view). Each
also feeds a headless xterm, so agents read the rendered screen, not escape
codes: before each run, what the folder's terminals printed since that
conversation last looked is added as a hidden message (like Claude Code's
`!`), and `terminal_read` reads them on demand. Agents can't type into them.
⌘1 (Ctrl+1) opens a new one as a tab beside the conversation; closing the
tab ends its shell.

The composer completes `/` at the start of a message with the app's
`/compact` (pi's `compact()`: older messages become a summary, shown as a
divider that opens to it; text after it steers the summary; while it runs, a
bar fills as the summary streams) and the session's
skills (sent as pi's `/skill:name`, shown again as `/name`), and `@`
anywhere with the message's images (`@image1`), the folder's terminals
(`@t1`) and files (`@src/app.ts`). Mentions stay plain text; the system
prompt says what they name.

Tasks (the sidebar's Tasks view) hand work to an agent that runs on its own.
Each folder's tasks live in `~/.ignite/tasks/` (`sidecar/taskStore.ts`,
one JSON file per folder, images inline). Starting one opens a conversation
in the background on the task's model and effort (never saved as defaults)
and sends it the title, notes, subtasks and images. `taskExtension.ts` gives
only that conversation `task_update`, drops `ask_user`, points its
`chrome_*` tools at the app's own Chrome, and runs it in phases: edits and writes are blocked until it has laid
out or confirmed the subtasks (`planned`), each tool call becomes its step,
and a run that ends with subtasks open or no pull request gets one wrap-up
message. Any other conversation can fill the list with `task_add`
(`sidecar/taskAddTool.ts`): its row shows the proposed tasks as cards, and
approving adds them unstarted. In a task, a commit and a plain push of its own branch run without
asking (`taskRunsAlone` in `lib/gitPolicy.ts`); `gh pr create` still waits
for review, shown on the task's card (the conversation's status carries the
waiting review). Approved, the pull request opens, its URL is saved and the
task is done. Declined, the task is marked `declined`, the agent is told to
stop and isn't nudged, and the card takes what to change and resumes the
conversation (`task_resume`). A task's status comes from its
conversation (`lib/tasks.ts`): working, waiting on the user, finished (to
review) once idle or closed, done once its pull request opens or the user
marks it.

The `chrome_*` tools (`sidecar/chromeExtension.ts`) drive Chrome over the
DevTools protocol from the sidecar. By default they start a headless Chrome
on port 9333 with its own profile in `~/.ignite/chrome` (Chrome refuses
debugging on the default profile), so testing never adds windows or a Dock
icon; it ends with the sidecar that started it. Only when a page needs a login the agent can't complete there does it
pass `user_chrome: true`, attaching to the user's own Chrome on port 9222
(chrome://inspect's "Allow remote debugging" toggle, or
`--remote-debugging-port`) with its real logins; if that port doesn't
answer, the tool tells the agent to ask the user to turn the toggle on.
Each kind has one connection shared by all sessions, kept on `globalThis`
since extensions load afresh per session, because Chrome asks "Allow?" per
connection. A task's conversation always
uses the app's own Chrome, never the user's,
and may act freely in it, but only in tabs it opened, named by id
(`sidecar/taskTabs.ts`; browser-wide `chrome_cdp` calls are refused).
Other conversations never pick or list a task's tabs, and their browser-wide
calls run only in the user's Chrome. Each screenshot is also saved to a temp file, so
`show_image` can put it on the task. Auto runs them without asking, like MCP
tools; Manual asks.

The `adb` and `adb_screenshot` tools (`sidecar/adbExtension.ts`) run adb
from an argument list outside the sandbox, which can't reach adb's server
(localhost:5037). Auto asks only when `push`, `pull`, `install`, `backup`,
`restore` or `bugreport` names a path on this computer outside the folder
(`shared/adb.ts`); Manual asks for every call. `adb shell` with no command and
a streaming `logcat` are refused, and a call stops after 2 minutes. adb is found on PATH, else in `ANDROID_HOME`,
`ANDROID_SDK_ROOT` or the default SDK folders.

The `subagent` tool (`sidecar/subagentExtension.ts`) lets the agent start
another pi session on a task: its own model or one from its provider no
dearer per output token in pi's catalog (claude-bridge models are priced by
their `anthropic` listing), at its effort or lower (both checked, not just
suggested). The built-in `/code-review` skill uses it the way Claude Code's
does: fresh finders per angle, one verifier per candidate; `/security-review`
likewise: one finder, then one false-positive filter per finding. The host
opens it in memory (`openSubagent` in `start.ts`) with only the bridge and
approval extensions, so its tool calls wait for approval like the main
agent's and show inside the subagent's tool row, rebuilt from the call's
`details.messages`. With `explore: true` it gets only read, grep, find, ls and outline and replies with
findings and file:line references, keeping searches out of the main
conversation. Its final reply is the tool result; the main agent
answers a subagent's question, or gives it more work, by calling the tool
again with its id. Subagents end with their session and aren't restored
after a reload.

Each agent (conversation) works in its own git worktree, under
`~/.ignite/worktrees/<repo>-<hash>/<session id>` (`sidecar/worktrees.ts`),
so agents in one folder never edit each other's files or the user's. It
starts detached at the remote's default branch, freshly fetched (the
folder's HEAD without a remote), so the user's uncommitted work never ends
up in its commits. The folder's ignored files (`node_modules`, builds,
`.env`) are cloned copy-on-write (`cp -c` on APFS, `--reflink` on
Btrfs/XFS, so they cost almost no disk until changed) while pi loads, and
the first prompt waits for them. Where the filesystem can't clone (Windows,
ext4, other volumes), only ignored files are copied; ignored folders are
skipped and the agent installs and builds its own, since a copy costs their
full size and a link would let it write into the user's (Windows has no
sandbox to stop that). There's no "apply": work reaches the folder through
git. `sidecar/worktreeExtension.ts` tells the agent to deliver on a branch
of its own, pushed with a pull request, and after a successful push or
`gh pr merge` the git tools fast-forward the user's folder (`git pull
--ff-only`, `updateFolder`), leaving it alone when that isn't clean; the
tool result tells the agent which. Ending a conversation (closing it or
its folder, quitting) saves its state as a commit under
`refs/ignite/sessions/<id>` and removes the worktree; reopening the
conversation brings it back. Worktrees are locked with the sidecar's pid,
and each sidecar start sweeps (saves and removes) those whose process is
gone; on Windows that also retries a worktree whose files were held open.
Folders outside git (or with no commit yet) are shared instead.
Trust, saved conversations and cmem stay keyed by the folder (`folderOf`).
Each session also has its own model runtime (`sidecar/sessionRuntime.ts`):
pi-claude-bridge registers one provider per session, and a shared runtime
sent every session's Claude calls through one of them, in `process.cwd()`.

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

Skills are the app's own, in `~/.ignite/pi/skills` (standalone) and
`~/.ignite/pi/plugins/<plugin>/` (a plugin is only a bundle of skills, no
code); which are off is kept in `skills.json` (`sidecar/skillStore.ts`).
pi would also load `~/.agents/skills`; the loader's `skillsOverride` keeps
only the folder's project skills (once trusted) and the app's that are on.
pi already loads skills lazily (only descriptions enter the prompt).
Settings imports skills from Claude Code (its skills folder and installed
plugins' skills), Codex, Cursor and `~/.agents/skills` by copying them
(symlinks followed); other apps' files are only read. Changes reload the
sessions, like an MCP change.

When [cmem](https://cmem.ai) (claude-mem, also used by Codex, Cursor and
other agents) is installed and its worker is running,
`sidecar/cmemExtension.ts` does what its agent hooks do, over the worker's
local HTTP API (port from `~/.claude-mem/worker.pid`): each prompt, tool
result and finished run is recorded under platform `ignite`, and the
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
`npm run tauri dev`. For users, `IGNITE_MODS` points at `~/.ignite/mods`:
a file there replaces the file at the same path under `src/`, `sidecar/` or
`shared/` (Vite through `shared/modsVitePlugin.ts`, Node through
`sidecar/modsHooks.ts`), so their changes never conflict with upstream.
Without the variable nothing changes.

- `sidecar/main.ts` only turns the overrides on, then loads `start.ts`. Keep
  it that way; anything it imports statically can't be modded.
- Load sibling files through `import.meta.resolve`, not `import.meta.dirname`,
  so they are still found when the importing file is a mod.
- The launcher counts a start as good once `reportHealthy()` (`lib/health.ts`)
  writes `IGNITE_HEALTH_FILE`, after the sidecar answers. Keep that call on
  the startup path, or every update looks broken and gets rolled back.

## Commands

- Dev app: `npm run tauri dev` (frontend hot-reloads; `src-tauri/` changes relaunch)
- Demo for screenshots: `npm run demo` opens `demo/tempo` and `demo/pantry`
  with the sidecar replaced by a scripted host (`lib/demoHost.ts`): made-up
  providers, models, conversations, search and git reviews. The composer types
  a fixed prompt whatever the keys, and sending gets a fixed reply. Nothing
  runs or is saved, so clearing sessions or app state never loses it.
  `demoConversations.test.ts` keeps its diffs in line with the files in
  `demo/tempo`.
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
  UI (composer, model menu, file tree, a settings section, a tool row…) is its
  own component in its own file under `components/<feature>/`, so it can be
  edited without touching its neighbours. A parent composes children and
  passes props; it never inlines a child's markup. No private helper
  components either: every component gets its own file. New features follow
  this from the start.
- **No dead code:** knip (`knip.json`, part of `npm run lint`) fails on
  unused files, exports and dependencies. Export only what another file
  uses; a file loaded by path (like the sidecar's extensions) is listed
  there as an entry.
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
- **One name per thing (hard rule).** A talk between the user and an agent is a
  **conversation**: in UI text, aria labels, settings titles and keys, docs,
  comments and new identifiers. Never "chat", "convo" or "thread". "session"
  is only pi's term, for pi's session objects and ids in code; the user never
  reads it. The same holds for every other term: use the name the code and
  this file already use (folder, not project or workspace; task; subagent;
  background command; terminal), and grep before naming something new.
  Settings search `keywords` may list synonyms, since users type them. The
  one exception: the command center's `@convos` filter, kept short to type.
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
