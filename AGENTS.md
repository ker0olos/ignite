# AGENTS.md

Guidance for contributors and AI coding agents working in this repo.
Tauri 2 + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Early prototype:
the UI shell works (folders, file tree, file viewer, settings, multi-window)
and the composer runs pi on the open folder, showing its conversation. For now it is run from source with
`pnpm run tauri dev`, not shipped as a built app; prioritise dev-mode behaviour
over release builds.

## Structure

```
src/                     React frontend (almost all logic lives here)
  main.tsx               Entry: sizes and shows the window, renders <App>
  App.tsx                Composes hooks, picks Welcome vs Workspace
  index.css              Tailwind + shadcn theme tokens, code-view styles
  shadcn.css             shadcn's variants and utilities (its package's tailwind.css), copied so the CLI isn't a dependency
  components/            UI only, one component per file; logic worth testing lives in lib/ or hooks/
    ui/                  shadcn/ui components (CLI-generated)
    app/                 Welcome screen (open and recent projects), Workspace layout, file tabs (beside the conversation or docked under it), pane handle,
                         Windows' window controls, the drop overlay, zoomable images and the markup editor (react-konva) for attached ones
    sidebar/             Title-bar strip, every folder (by name) with its conversations, file tree,
                         MCP sign-in warning banner, the update banner (installing, then restart)
    files/               Lazy directory tree (the shown conversation's worktree, once it has one), read-only syntax-highlighted file view, FileIcon (every file icon),
                         diff tabs whose lines take comments (gutter "+", comment box)
    command/             ⌘K command center: search box, results, preview (conversation details, file, folder)
    agent/               Conversation area wiring (recently shown conversations stay mounted, hidden), task composer
                         (which also answers the agent's questions; one strip of attachments: images, dropped files, diff comments), model/effort/approval menus, git status, trust prompt;
                         its completions menu (MentionRow, a `/command`'s argument chips and CommandHint)
    conversation/        Transcript rendering: messages (the user's edited in place), tool rows (with approve/deny) and their pieces,
                         generated images as a media card (MediaCard: model, prompt, size, mark up), generated videos likewise (VideoCard), generated audio as an AudioCard (waveform player); WorkingLine is the run's spinner, step and time,
                         and (with `show_thinking`) the newest sentence of the model's reasoning
    settings/            Settings dialog shell, its rows, and one items file per section
    memory/              The Memory settings' extras: search, type filters with counts, the folder's memories (each opens to its facts and files)
    lessons/             A lesson's tags (its folder, what brings it up), in Settings
    mcp/                 MCP server rows, add/edit dialog, preset and import UI, brand marks
    skills/              Skill and plugin rows, import UI from other apps
    providers/           Connect-a-provider screen: cards, sign-in/API-key forms, logos, the Claude card's fallback keys
    children/            Tabs for what runs under a conversation: a subagent's conversation, a background command's output, the user's interactive terminals
                         (one starting while its conversation's worktree is made)
    terminal/            TerminalSurface: text drawn as a read-only terminal (xterm)
    tasks/               Tasks view: the checklist, rows that open in place with their status card,
                         the new-task sheet (notes, images, subtasks, model and effort)
  hooks/
    useFolders.ts        Recent folders, this window's open projects and the shown one
    useProjects.ts       Each open project's and conversation's status (working, waiting, title);
                         ends closed projects' sessions
    useSettings.ts       settings.toml, synced across windows; applies theme
    useDrop.ts           Drag-and-drop onto the window: folders open, images and other files attach to the composer
    useTabs.ts           Open file tabs, beside the conversation or docked under it, kept per conversation (⌘W closes one)
    useTabDrag.ts        Dragging a tab by pointer: reorders it, or moves it to the other dock
    useConversationTabs.ts The shown conversation's tabs and the terminals: opening one (⌘P from its worktree),
                         dropping a closed conversation's, keeping the first message's with the conversation it starts
    useEditorOverlay.ts  The editor pane dragged past the conversation's minimum: drawn over it and the sidebar
    useSidebarWidth.ts   The sidebar's dragged width (localStorage), kept when the editor pane opens or closes
    useProviders.ts      Provider status, sign-in and sign-out via the pi host
    useConnectScreen.ts  When the connect screen shows (first launch, on request)
    useAgentSession.ts   The folder's shown pi session: conversation, send/stop, trust, model and effort, its worktree
    useStartedConversation.ts The conversation the folder's first message last started, for its tabs
    useStartingMessage.ts The folder's first message, shown as it's sent while its conversation starts (Stop hands it back)
    useTabHandoff.ts     The tabs opened while the folder's conversation was unknown, or before its first message,
                         go to the conversation it turns out to be (the latter's files to its worktree's copies)
    useWorktreeLayout.ts Where the folder's conversations' worktrees are (cached), so a conversation's root is
                         known before it opens (lib/worktreeLayout.ts: conversationRoot)
    useSessionSwitch.ts  Showing and closing the shown folder's conversations
    useSessionCache.ts   Every open conversation shown so far, kept current by its events; the one each folder shows
    useOlderRows.ts      A conversation draws its newest rows, older ones as the user scrolls up
    useComposerActions.ts Send, stop, model and effort; the first message starts a new conversation
    useComposerBegin.ts  That first message: the conversation opens, takes the choices made before it, then gets it
    useCompact.ts        `/compact`: compacts the shown conversation
    useFork.ts           `/fork`: forks the shown conversation, shows the fork, sends it the text after `/fork`
    useRewind.ts         Edits a user message of the shown conversation: rewinds to before it, sends the new text
    useMessageEdit.ts    One user message being edited in place: its text, ↵ sends, Esc cancels
    useForkWait.ts       Whether the shown conversation waits for a fork, so its composer takes no messages
    useMentions.ts       The composer's completions: `/skill` at the start, `@image1`, `@t1` and `@path` anywhere;
                         while a `/command`'s arguments are typed, its hint and the current one's values
    useDraftState.ts     A folder with no conversation: the models and effort it would start with
    useConversationList.ts Each folder's listed conversations, remembered across launches
    useConversationTags.ts Conversation tags by id, shared by all windows, kept after one closes; the sidebar's tag filter
    useConversations.ts  Every open folder's conversations for the sidebar: show, create, close, details
    useCommandCenter.ts  ⌘K / Ctrl+K opens the command center, optionally with a query;
                         ⌘P / Ctrl+P opens it on @files with no preview
    useCommandSearch.ts  The command center's results: debounced command_search, folders, @ suggestions
    useDetailsCache.ts   Session details fetched once each, for the command center preview
    useDiffComments.ts   A diff tab's comments, each straight into its conversation's message: add, edit, delete
    useCommentSelection.ts The rows a diff comment takes (pressed, dragged or shift-pressed) and its open box
    useCommentReveal.ts  A diff comment's card scrolled into view and flashed when its composer card is clicked
    useComposerComments.ts The diff comments in the composer's message: removing, sending, taking back from the queue
    useComposerSend.ts   Sending the composer's message (text, images, diff comments); stop hands queued ones back
    useOpenFile.ts       Opens a tab (file, diff, subagent…) in any folder or conversation, switching to it first
    useFileExists.ts     Whether a path exists, checked once; inline code links only to ones that do
    useXterm.ts          An xterm fitted to its element and themed like the app (read-only and interactive views)
    useTerminalSession.ts A terminal view's connection to the host: snapshot, live output, keystrokes
    useTerminalShortcut.ts ⌘J or ⌘T (Ctrl+J / Ctrl+T) opens a terminal tab; returns run-in-terminal
    useConversationShortcuts.ts ⌘1…⌘9 (Ctrl+1…9) show the sidebar's first nine conversation rows
    useRunInTerminal.ts  Run-in-terminal for assistant shell code blocks' Run button
    useAudioPlayer.ts    An audio element's playing, time and length; toggle and seek
    useWaveform.ts       A clip's waveform bars, decoded once with AudioContext
    useVideoUrl.ts       A video's blob URL: its file read once (or the demo's inline data); "missing" once it's gone
    useStreamedCall.ts   An artifact call's arguments while it's written, read a few times a second (useThrottled.ts)
    useDraftFrame.ts     Posts a draft artifact page into its frame, which updates it in place
    useBlockLang.ts      A code block's language: its fence's, or bash once an untagged one parses as shell
    useTerminalTabs.ts   The folders' running terminals for the sidebar; Stop ends one, closing its tab doesn't
    useGitStatus.ts      The shown conversation's repositories (branch, uncommitted, unpushed, pull request): cached
                         ones at once, read again in the background, then every 5s (1s while it opens)
    useGitRepoDetails.ts A repository's uncommitted files and unpushed commits, while its composer popover is open
    useBackgroundOutput.ts A background command's output, read again while it runs; stopping it
    useSessionEvents.ts  Applies session events and approval requests; answers approvals
    useQuestionDeck.ts   The agent's waiting questions the composer answers: step, each one's picks, text and images
                         (lib/questionDrafts.ts keeps them in localStorage until answered, so a reload shows them as left)
    useComposerQuestionKeys.ts Their keys: ⌥1…⌥9 pick from anywhere, ↑/↓ between options and the text, Space picks, ↵ or ⌘↩ on, ⌘N the text, ⌘⌫ skip
    useComposerDraft.ts  The composer's text and images: the question's while one shows, else the message's
    useMcpServers.ts     MCP servers in pi's mcp.json, with live status pushed by the sidecar
    useSkills.ts         The app's skills and plugins, and other apps' to import, while Settings is open
    useMemory.ts         The folder's memories while Settings is open: its latest, or a search's matches, of one type
    useAbout.ts          The commit the app runs from; Check for updates, reloading every window,
                         or (launcher) built in the background every 6h, then Restart
    useSettingsDialog.ts Settings open state, its first section, and what it fetches while open
    useInstalledThemes.ts The code and icon themes to pick from, scanned again on every open
    useLessons.ts        Every saved lesson, while Settings is open; removing one
    useReflector.ts      The reflector's points, while Settings is open; editing or removing one
    useFallbackKeys.ts   The fallback Anthropic API keys on the connect screen: add, remove, reorder
    useOpenedOnce.ts     Mounts a lazy dialog (Settings, command center) on first open; loads its code soon after startup
    useTextSize.ts       ⌘/Ctrl +, - and 0 resize message text
    useMaximized.ts      Whether the window is maximized, for WindowControls' maximize or restore
    useIconTheme.ts      The loaded icon theme every FileIcon draws with, and light or dark; useIconUrl.ts its images
    useRemoteAccess.ts   Main window: starts the remote access server, runs browsers' allowed Tauri calls
    useTasks.ts          The folder's tasks, pushed by the sidecar, with status from their conversations
    useTodos.ts          The open items of the folder's .todo files, read when the Tasks view shows
    useNewTaskSheet.ts   ⌘N / Ctrl+N opens the new-task sheet while the Tasks view shows
    useEmbeddedPage.ts   An HTML artifact page ready for its frame, once its libraries' CSS is built
    useFrameEscape.ts    Esc pressed in an artifact's frame, which closes its expanded view
    useMarkup.ts         An image's marks being drawn: tools, ink, selection, text, undo/redo;
                         useMarkupKeys.ts its shortcuts, useMarkupImage.ts loading and fitting the image,
                         useMarkupView.ts zooming and panning it
    useSpinnerFrame.ts   The working line's braille spinner frame (still under reduced motion); useNow.ts ticks its elapsed time
    useComposerImages.ts The composer's attached images, and marked-up ones added to it
    useComposerFocus.ts  Five times a second, the composer takes focus unless a text field, open menu or dialog, or selection has the user
    useComposerHistory.ts ↑ at the composer's start / ↓ at its end step through sent messages (all folders)
    useImageTarget.ts    The showing input (conversation, task sheet) marked-up images are added to
  lib/
    app.ts               APP_NAME, the single source of the app's name
    settings.ts          Settings type, defaults, TOML load/save
    composerSettings.ts  The composer's approval mode and whether new conversations start on Router, saved on change
    store.ts             App state (tauri-plugin-store) + cross-window sync
    files.ts             Directory listing and reading files for the viewer
    gitignore.ts         .gitignore matching for the file tree
    highlight.ts         Shiki highlighting with the chosen theme(s)
    codeThemes.ts        Theme types, built-ins, and grouping for the picker
    codeThemeDiscovery.ts Finds themes: Shiki bundle, VS Code-family editors, custom files
    codeThemeLoad.ts     Resolves a theme id to Shiki data, and imports an editor theme
    themePalette.ts      The theme's colors for inline code, success, warning and errors
    tabs.ts              Open/close logic for file tabs, and moving them between the two docks
    recent.ts            Recent-folders list logic
    conversationTags.ts  Conversation tags: splitting typed text, adding, removing, suggestions
    commandQuery.ts      Command center query: `@folder`, `@convos`/`@files`/`@folders`, result picks
    fileIcons.ts         Extension → monochrome icon (the Minimal icon theme)
    iconThemes.ts        VS Code icon themes: finding installed ones, loading one (fonts too), image URLs
    iconResolve.ts       A file's or folder's icon in a VS Code icon theme, in VS Code's lookup order
    iconThemeGroups.ts   Icon themes grouped for the picker
    openFolders.ts       The file tree's open folders, remembered (localStorage, newest 500)
    menu.ts              macOS menu bar
    inAppMenu.ts         On Windows and Linux the same items as an in-app menu (AppMenuButton), File first and
                         the app's menu last, and its shortcuts' key matching
    lifecycle.ts         Every confirmation, in the system's dialog (`confirmNative`): quitting, closing a window…
    piHost.ts            Starts the pi host sidecar; request/response client
    providerGroups.ts    Presents pi's providers as brands (Claude, ChatGPT)
    gitStatus.ts         Which of a conversation's repositories the composer shows, and their pull requests' state
    gitStatusCache.ts    Each conversation's last known repositories (localStorage, newest 200), shown before a read
    transcript.ts        Rebuilds the conversation from pi's session events
    streamBlocks.ts      A streamed message's blocks: text, thinking, tool calls (an artifact's JSON as it's written)
    sessionEntry.ts      A conversation as the app keeps it, built from what opening it returned
    sessionStateCache.ts Each conversation's last model and effort (localStorage, newest 200), shown while it opens
    routedMessage.ts     The first message while the router reads it, shown until pi adds it
    compaction.ts        Compaction in the conversation: running, then its summary; saved summaries
    rewind.ts            Editing user messages: which offer Edit (named, after the latest compaction), when (idle),
                         the conversation cut back to before one
    toolRows.ts          Conversation rows: folds runs of reads/searches/shell commands and of one read-only MCP tool's calls, parses edit diffs
    runError.ts          A run's error as shown: a Claude limit in Claude Code's words, without the bridge's prefix
    modelMenu.ts         Composer model menu: hand-picked featured models, the rest under More
    mcpServers.ts        MCP server form (lines to args/env/headers), status labels
    skills.ts            Skills settings text: counts
    memory.ts            Memory settings text: the switch's line, the type filters, relative times
    lessons.ts           A lesson's folder as its tag names it
    fallbackKeys.ts      Whether a provider card offers fallback keys (Claude, on a subscription)
    about.ts             About text: version line, update button states, the macOS About panel
    approvalPolicy.ts    Which tool calls wait for approval (Manual / Auto, paths outside the folder)
    gitPolicy.ts         Which git and gh tool calls run and which ask (commit and push for review)
    drop.ts              Sorts dropped paths: folders, images, small text files sent in full, others by path
    dropPreview.ts       While a drag hovers: which of four overlays (folder, image, file, both) and what letting go does
    userMessage.ts       A user message's typed text, images, attached files and diff comments, for its bubble
    gitDiff.ts           Unified diffs into diff lines; folding unchanged runs (never over a comment); stepping through changes
    diffTabs.ts          Diff tabs beside file tabs (encoded ids with the conversation that opened one, labels),
                         reading a git review
    diffComments.ts      Diff tabs' comments, in memory per conversation until sent or deleted
    diffCommentMessage.ts A diff comment's lines, and comments in file and line order as a message carries them
    dangerousCommands.ts Regex denylist of risky shell commands that Auto still asks about
    demo.ts              Demo mode (`pnpm run demo`): its folders, host, sidebar rows, scripted typing
    demoHost.ts          The demo's stand-in for the sidecar: scripted answers and replies, nothing runs
    demoAnswers.ts       The demo's providers, MCP servers, memory, version and files
    demoConversations.ts Every demo conversation (open and saved), with details and git diffs
    demoTranscript.ts    The dark mode conversation's work: edits whose diffs match demo/tempo
    demoDarkMode.ts      Its delivery through git: commit, push, pull request
    demoTempoWork.ts     Tempo's other conversations: a commit awaiting review, one still working
    demoGit.ts           Unified diffs and commit reviews for the demo
    demoQuestions.ts     The demo's second project, waiting on the agent's questions
    questionDrafts.ts    ask_user drafts in localStorage, one key per call, saved as typing pauses, a week at most
    questions.ts         ask_user answers being picked: options, a note or own answer, the call the composer answers
    tasks.ts             A task's status from its conversation, groups, the sheet's draft, pasted images
    runStep.ts           What a running conversation is doing now (its step, start time, elapsed text)
    runCommand.ts        Which code blocks Run offers for, and a block as terminal keystrokes
    shellDetect.ts       Whether an untagged code block is shell commands (tree-sitter bash, in the webview)
    media.ts             The media cards' data: show_image's, show_audio's and show_video's model and prompt (cards for
                         plain files too), their results, waveform bars, and each image edit's original, as shown
    mentions.ts          `/compact`, `/skill` and `@` completions: the token at the caret, options, sending a skill as `/skill:name`
    commandArgs.ts       A `/command`'s arguments from its `argument-hint`: the one the caret is in, its fixed values
    history.ts           The composer's sent messages, shared by all folders (localStorage, newest 100)
    queue.ts             Queued messages in the transcript; the composer's keys (↵ queues, ⇧⌘↵ sends the first now)
    markup.ts            Image markup marks: drawing them out, history, stroke sizes, shortcut keys
    demoHtml.ts          The page the dark mode conversation shows with show_artifact
    demoMedia.ts         The hero image conversation: an image generated, marked up, edited, then music and a voiceover
    demoAudio.ts         Its two clips, synthesised as WAV when the demo starts
    demoVideo.ts         The hero loop conversation: a 4 second video generated from the hero image (src/assets/demo/hero-loop.mp4)
    demoTasks.ts         The demo's tasks, following its conversations; demoTaskImages.ts draws their images
    artifact.ts          show_artifact's pages (and old show_html calls'); the HTML frame's policy and height;
                         drafts while the call is written (no scripts, no half-written tag)
    artifactDraft.ts     A draft's frame: a shell loaded once, each draft swapped into it in place
    artifactStyles.ts    A page's bundled libraries: Tailwind (and daisyUI) compiled for the classes it uses
    artifactIcons.ts     A page's `i-lucide-*` / `i-simple-icons-*` icons as CSS masks, only the ones it uses
    artifactCapture.ts   Mark up: an artifact page drawn as a PNG (HTML frames draw themselves, html-to-image,
                         with Google Fonts fetched for it)
    mcpToolCall.ts       Reads pi-mcp-adapter's tool calls (server, tool, arguments) for the conversation
    window.ts            Window sizing and New Window; on Windows no system title bar, the app's
                         WindowControls (minimize, maximize, close) in the top-right corner instead
    liveReload.ts        Reloads the page when the launcher starts serving Vite (a mod changed)
    paths.ts             basename / dirname / ~ shortening
    utils.ts             `cn` class-name helper (shadcn)
    remote.ts            In a browser (remote access): stands in for Tauri over a WebSocket to the sidecar
    remoteFirst.ts       Installs that stand-in before any other module loads (first import in main.tsx)
  test/                  Test setup, fake Tauri backends (fakeFs, fakeStore), shared shell command cases
sidecar/                 pi host: a Node process the app starts (node sidecar/main.ts)
  main.ts                Entry: turns on mods/ overrides, then loads start.ts
  start.ts               stdio wiring; pi's files live in ~/.ignite/pi
  extensionPaths.ts      The extensions conversations and subagents load, in order
  modsHooks.ts           Node resolve hooks that load mods/ files in place of the repo's
  host.ts                Request dispatch; createHost builds the handler
  hostTypes.ts           Shared types and HostContext; per-function context instead of closures
  hostAuth.ts            Provider sign-in (status, interaction, login)
  hostSession.ts         Open conversations, several per folder, kept running while hidden (sessionState, open, close, prompt)
  hostModels.ts          A conversation's model and effort requests: read, set (saved as defaults), Router's next message
  hostSend.ts            A message handed to pi: one at a time (each once pi holds the last), routed, checkpointed
  hostProjects.ts        Tells the app which open conversations are working or waiting (pushProjects)
  hostResume.ts          Resumes a run a reload or quit cut off: calls that may have run marked interrupted;
                         a call that waited on the user runs again, asking as before; agent continues
  resumeReplay.ts        Runs a cut-off message again: the model's answer replayed, finished or run calls blocked
  waitingCalls.ts        Each conversation's calls waiting on the user, and when (before running, asking, after a
                         sandboxed run), on disk (~/.ignite/pi/waiting)
  toolRuns.ts            Running tool calls' latest progress, so a conversation shown again catches up on them
  sessionStore.ts        pi's saved conversations per folder: the latest, new ids, the list
  search.ts              command_search: each folder's conversations and files, cached, ranked by shared/commandSearch.ts
  fileIndex.ts           A folder's files for search (git ls-files, else a capped walk)
  sessionRuntime.ts      Each session's own model runtime (passes its cwd to providers); saved model
  draftSession.ts        What a new conversation would start with (models, effort) before one exists
  worktrees.ts           Each agent's workspace: open, fork, close, sweep (one worktree, a folder of them, or shared); updateFolder
  worktreeCheckout.ts    One worktree of one repository: start point, create (fresh or saved), lock and owner, save and remove
  worktreeGroup.ts       A folder of repositories: the agent's copy of it, a worktree of each and its other files copied
  worktreeExtension.ts   Tells an agent in a worktree where it is and to deliver through a pull request
  worktreeGit.ts         Worktree paths, snapshots of a working state, folderOf / gitWritable
  worktreeClone.ts       Copy-on-write clones of the folder's ignored files into a worktree
  worktreeReady.ts       Each workspace's readiness (its ignored files cloned in), by path, shared with extensions
  doppler.ts             Doppler's folder settings in a worktree: a copy of its config naming the worktree too
  readyExtension.ts      Holds writes, commands, git and reads of missing files until the workspace is ready
  hostApproval.ts        Tool calls waiting for the user (askApproval, answerApproval, denyAll)
  hostAnswers.ts         Requests that get no response: prompt answers, approval answers, skip wait
  hostQueue.ts           Messages sent mid-run: stop takes them back; one taken back, moved up or sent now
  compactProgress.ts     `/compact`'s progress: the summary's tokens, read off pi's stream as it's written
  queuedImages.ts        Queued messages' images (pi's queue lists only text), forgotten once delivered
  hostTrust.ts           Saves a folder's trust and reloads its session (setTrust)
  hostRewind.ts          Edits a user message (`rewind`): its checkpoint restored, pi's leaf moved before it, the new text sent
  hostCheckpoint.ts      User messages' entry ids for the app, and their worktree checkpoints, saved as each starts
  checkpoints.ts         Checkpoints under refs/ignite/checkpoints/<id>/<entry>: take, keep, restore, drop
  hostFork.ts            Forks a conversation (new_session's `fork`): its file, its worktree's files, a note to the original;
                         closing a fork sends its report to the original, which carries on
  hostFollow.ts          Follows a conversation's session events: to the app if shown, run state, settling
  forks.ts               Forks' files, their reports (summaries since the last one) and the notes waiting for the original
  forkExtension.ts       Adds the notes waiting for a conversation (its forks' reports) to its next run
  trust.ts               pi's trust store (trust.json); "ask" only when the folder has .pi/ resources
  approvalExtension.ts   pi extension: asks the app before tool calls, blocks denied ones
  approvalAsk.ts         The channel calls wait on the user through (pi event bus to the host)
  askingLine.ts          git and gh calls ask in the order the agent made them, though each prepares its review in parallel
  toolReason.ts          `reason` on bash and MCP tools: the agent's why, shown on the approval prompt
  bashParser.ts          Parses bash (tree-sitter) into pipelines for the approval rules
  sandbox.ts             Auto's OS sandbox for bash: writable folders, hidden credentials, allowed hosts
  windowsSandbox.ts      The same on Windows (srt-win, alpha): per-folder grants, srt-win's argv as a Git Bash line
  approvalSettings.ts    `[approval]` read per tool call; which sandbox applies (Windows' only when turned on)
  bashExtension.ts       pi's bash with `background: true` (dev servers, watchers), and bash_stop to end them
  backgroundBash.ts      Background commands per conversation: their logs, stopping them with what they started
  bashWait.ts            bash_wait: the conversation runs again once its background commands all exit
  hostWait.ts            Wakes those conversations (a hidden message), or leaves a note while one waits on its fork
  skipWait.ts            Skip wait: the user cuts a bash call's `sleep` short (a `sleep` on PATH that exits 0), and it carries on
  runOutside.ts          Runs a bash call outside the sandbox once the user approved it
  shellEditsExtension.ts The files a bash command changed (working tree before and after), shown as edits;
                         an image as its two versions, compared with a dragged line
  ptyShell.ts            Shells in a PTY (node-pty): spawning, killing its tree, its output as screen text
  ptyBash.ts             Background commands' shell in a PTY: stdin from /dev/null, pagers off
  terminal.ts            The user's terminals: a login shell in a PTY (node-pty), mirrored in a headless xterm
  hostTerminal.ts        Opening one in the conversation's worktree (waiting until it's made); ending a closed
                         conversation's just before its worktree is removed; the worktree layout and ready requests
  terminalExtension.ts   terminal_read, and the terminals' new output added to each run;
                         tells the agent what the composer's `@` mentions name
  exploreExtension.ts    Tells the agent how to search the code before answering (parallel calls, follow the flow)
  bashSearch.ts          Bash commands that only search or read the folder's files, sent to grep and read instead
  editContext.ts         pi's edit, whose result shows the changed lines as they now read, numbered
  grepFiles.ts           pi's grep with `filesOnly`: matching files and their counts, not the lines
  readTools.ts           pi's read with numbered lines, 400 unless told otherwise, one definition by name (`symbol`)
                         and more files or ranges in the same call (`also`); `outline`
  readSections.ts        read's arguments as models write them (`"[310, 330]"` ranges), its line numbers
  outline.ts             A code file's definitions by line, a folder's files with their top-level ones, and one's lines
                         by name (tree-sitter tags queries: TS, JS, Python, Rust, Go)
  hostChildren.ts        Each conversation's subagents and background commands, for the sidebar
  sandboxAllow.ts        What the user always allows the sandbox (~/.ignite/sandbox.json): hosts, sockets, paths;
                         how the agent must write commands allowed outside
  blockedRun.ts          Whether a sandboxed bash result may have been blocked; ending its background copy
  sandboxNetwork.ts      The sandbox's network policy off its allowlist: public hosts only, reads only
  hostMcp.ts             MCP server lifecycle (rememberSignIns, servers, pushMcpServers, changeMcp)
  hostMcpCatalog.ts      MCP presets and imports (toServerName, target, mcpCatalog, addPreset, importServers)
  hostMcpSignIn.ts       MCP server sign-in (signOut, signIn, copySignIn), run in the MCP session
  mcpSession.ts          An in-memory session with only the MCP adapter: checks and sign-ins with no conversation open
  wire.ts                Session event wire form (toWireEvent, describeError)
  claudeCode.ts          The user's Claude Code login (`claude auth status/login`)
  appUpdate.ts           The app's own commit, and updating it: a launcher version stages the next one,
                         a clone pulls (`git pull --ff-only`, `pnpm install` if the lockfile changed)
  appBuild.ts            Launcher versions (~/.ignite/app/<commit>, worktrees of the user's clone): building one
                         (release binary, its packages linked, a frontend per set of mods)
  appPackages.ts         Packages installed once per lockfile (~/.ignite/packages/<hash>, with the pnpm
                         package.json pins, itself installed with npm if missing), linked as the clone's
                         and each version's node_modules, from pnpm's own store (the user's, shared); pruned with the versions
  appBinary.ts           A version's binary from CI's release for its src-tauri/ tree: refused when its
                         attestation shows binary.yml didn't build it from main, used with a warning
                         when GitHub or Sigstore can't be reached to check
  attestation.ts         That check without gh: GitHub's attestation API, Sigstore's signature check
  appPreflight.ts        Setup's checks before downloading: about 1 GB free and npm and GitHub in reach (skipped
                         when nothing needs downloading); a clone of a renamed repository follows its new name
  appRun.ts              Runs the build tools (pnpm, npm, Vite, cargo), their output in the error, setup's log, or
                         the terminal (--verbose); setup's steps
  appDoctor.ts           `npm run setup -- --check`: Node, git, pnpm, the packages, the version, the launcher, and
                         what takes space in ~/.ignite; reads only, so it runs before the packages are in
  appLinuxSandbox.ts     bubblewrap and socat, which Auto's sandbox needs on Linux: which are missing, the
                         package manager's command (through sudo) setup installs them with
  appLauncher.ts         The launcher setup adds: ~/Applications/Ignite.app, a Linux menu entry or a Start Menu
                         shortcut, each running launch.mjs with setup's PATH
  appSetup.ts            Setup's steps that need the packages: the Windows sandbox setting, whether Rust is needed
  appUninstall.ts        `npm run uninstall`: the launcher and what Ignite keeps to run (versions,
                         packages, pnpm); the user's conversations, settings and tasks stay unless `--all`
  appVersions.ts         The launcher's state (good, bad, next, restart), staging an update, pruning versions
  credentials.ts         pi's auth.json, falling back to the Codex CLI's ChatGPT login
  fallbackKeys.ts        Anthropic API keys a conversation falls back to when the Claude subscription runs out (~/.ignite/fallback-keys.json)
  fallback.ts            Knowing it ran out (claude-bridge's error), until when (its rate-limit header, else the error's time), the next key
  fallbackExtension.ts   Moves the conversation onto the next key and continues the run; back on the subscription after the reset
  lines.ts               LF-only JSONL splitting
  mcpConfig.ts           pi-mcp-adapter's mcp.json: read, edit servers, cached tool names
  mcpExtension.ts        Loads pi-mcp-adapter into each session with only the app's mcp.json
  mcpRetry.ts            MCP connects the network failed (fetch failed, ECONNRESET, DNS, 502/503/504),
                         tried again 3 times over 17s (parallel calls share one), then named as the network's;
                         a server in the adapter's backoff is connected once to learn why
  skillStore.ts          The app's skills and plugins (bundles of skills): list, on/off, remove, import;
                         the only skills sessions load besides the folder's own
  skillArgs.ts           A session's skills for the composer, with their `argument-hint` and `argument-descriptions`
  skills/                Built-in skills (code-review, security-review, design-references), loaded after the app's; a skill of the same name replaces one
  skillCatalog.ts        Other apps' skills to import: Claude Code, Codex, Cursor, ~/.agents, Claude Code plugins
  memory.ts              The memory's on/off setting; what the Memory settings show; cmem's import at start
  memoryDb.ts            The memory (~/.ignite/memory.db, node:sqlite): observations and summaries per folder, FTS5
  memorySearch.ts        Reading it: a folder's latest, full-text search, by id, around one
  memoryContext.ts       What a new conversation recalls: an index of the folder's latest memories
  memoryExtension.ts     The recalled index in the system prompt; memory_search, memory_get, memory_timeline
  memoryWriter.ts        After a run, the cheapest model writes down its observations and summary
  hostMemory.ts          Each conversation's run, written to the memory once it settles
  memoryImport.ts        Imports cmem's memories from its database (no worker), only what isn't in yet
  lessons.ts             Lessons from the agent's mistakes (~/.ignite/lessons.json): saving, the cap, which a tool call runs into
  lessonExtension.ts     lesson_add / lesson_remove; system_prompt lessons in the prompt, tool_call ones block their call
  lessonRegex.ts         Regex lessons: refusing too broad or slow ones on save (recheck), running one on a call
  hostLessons.ts         Settings' saved lessons: list and remove
  reflector.ts           After a run with the user's feedback, the cheapest model rewrites the reflector's points
  hostReflect.ts         The user's feedback on a run (replies, answers' notes, denials, rewinds), reflected on once it settles;
                         Settings' points: list, edit, remove
  reflectorExtension.ts  The reflector's points (~/.ignite/reflector.json), each beside its entry point's guidance
  askExtension.ts        ask_user: the agent asks the user multiple-choice questions, or works alone
  taskStore.ts           Each folder's tasks in ~/.ignite/tasks, written one at a time, pushed on change
  todoFile.ts            .todo files' open items (the folder's and its folders'), for the Tasks view; deleting one
  hostTasks.ts           Starts a task in a background conversation; answers the task extension
  taskExtension.ts       task_update for every conversation (plan before edits, joins the task list);
                         a Tasks-view task's autonomy and wrap-up phase
  taskAddTool.ts         task_add: any other conversation proposes tasks, added unstarted once approved
  taskSteps.ts           What waits for the plan (edits, writes, new subagents but explore ones),
                         whether it's planned (isPlanned), where bash may write until then
  router.ts              The router: a cheap model picks a new conversation's model and effort
  hostRoute.ts           Runs the router before a conversation's first message, or its next once Router is picked
  subagentExtension.ts   subagent tool: hands tasks to its model or a cheaper one from the same provider and talks with it
  subagentQueue.ts       Runs at most `max` subagents at once; the rest wait their turn
  subagentSession.ts     A subagent's session: talking to it and ending it (the 8 last used stay open)
  keepAwake.ts           Keeps the Mac from idle-sleeping (caffeinate) while an agent works
  hangWatch.ts           The page's heartbeats; 10s without one (visible, Mac awake) samples the app's
                         processes into ~/.ignite/hangs
  chrome.ts              Chrome over CDP: a headless one the app starts, or the user's own (port 9222) when asked
  chromeExtension.ts     chrome_* tools: tabs, screenshot, eval, navigate, raw CDP calls
  chromePage.ts          A tab's CDP calls: run JS, wait for load, screenshot
  cdpResult.ts           chrome_cdp's results with long base64 data (screenshots, PDFs) saved to files, not inlined
  taskTabs.ts            Which Chrome tabs a task may use: only its own, named by id
  webSearchExtension.ts  web_search: Claude Code's WebSearch (no WebFetch: it would fetch unsandboxed), run by Haiku
                         in the SDK's Claude Code on the user's login, 8 turns or 2 minutes; only when signed in
  adbExtension.ts        adb and adb_screenshot: Android devices, run outside the sandbox
  imageExtension.ts      show_image: shows the user an image file from any path in its tool row
                         and, in a task's conversation, on the task's card; one the agent generated
                         with its model and prompt, an edit naming the image it changed
  mediaExtension.ts      show_audio and show_video: an audio file (kept in the conversation, 10 MB at most) or a
                         video (kept as a copy in ~/.ignite/media, read by the app as it shows) to play, with its model and prompt
  artifactExtension.ts   show_artifact: HTML (sandboxed iframe) or markdown pages in its tool row, as tabs
  artifactGuide.ts       UI/UX rules for HTML pages, part of show_artifact's description
  artifactCheck.ts       Loads its HTML pages in the app's headless Chrome first; errors go back to the agent
  gitExtension.ts        git and gh tools: run outside the sandbox, ask for themselves, redirect bash's
  gitDelivery.ts         After a git or gh call: the user's folder fast-forwarded, a task's pull request recorded
  gitPush.ts             The git tool's `push: true` and `pr`: a commit that pushes its branch, and opens its pull request, in the same call
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
  testMemory.ts          A memory for tests, of folder /work/app
  remote.ts              Remote access: browsers share this sidecar; replies routed by id, events to all
  remoteServer.ts        Its HTTP server: proxies the UI from Vite, WebSocket; its links (network, Tailscale)
  types/                 Type shim for pi-mcp-adapter (its TypeScript fails our strict tsconfig)
demo/tempo/, demo/pantry/ Sample projects `pnpm run demo` opens (not built or tested here)
docs/                    README screenshots, taken in demo mode
shared/hostProtocol.ts   Messages between app and sidecar (used by both)
shared/auth.ts           A provider sign-in's prompts and events as they cross the wire
shared/validation.ts     Checks on typed API keys and MCP servers (used by both)
shared/fallbackKeys.ts   Fallback keys as the app sees them (last 4 characters only) and their requests
shared/agentTypes.ts     pi's messages and session events as they cross the wire
shared/conversations.ts  Saved conversations, their details, command search hits, titles (used by both)
shared/skills.ts         Skills, plugins and importable skills as they cross the wire, and their requests;
                         a skill's expanded message shown as the `/name` typed
shared/mcpCatalog.ts     MCP presets and other apps' servers the MCP settings offer
shared/mcpServers.ts     MCP servers as they cross the wire (re-exported by hostProtocol.ts)
shared/modelChoice.ts    Requests reading and choosing a conversation's model and effort, Router included
shared/terminal.ts       The user's terminals: requests, output events, terminal_read's name
shared/memory.ts         Memory kinds (cmem's), the Memory settings' status as it crosses the wire
shared/fuzzy.ts          Fuzzy match score for the command center (used by both)
shared/commandSearch.ts  Ranks conversations and files for the command center (sidecar and demo)
shared/adb.ts            The adb tool's arguments: its command, host paths, calls that never exit
shared/questions.ts      ask_user's questions and answers (used by both)
shared/tasks.ts          Tasks and the agent's updates to them (used by both)
shared/rewind.ts         Editing a user message: the request, what happened to its files
shared/queue.ts          Messages sent mid-run: how they wait, and taking one back (used by both)
shared/subagents.ts      The subagent tool's name, effort order and call details (used by both)
shared/shellEdits.ts     The files a bash call changed, as its result carries them (used by both)
shared/featuredModels.ts The model menu's featured (current generation) models, which the router picks from
shared/attachedFiles.ts  Dropped files in a message: `@path` with its text inline or only its path, and read back
shared/sentComments.ts   Diff comments in a message: `@path:lines`, the quoted lines, the comment, and read back
                         for its cards; a message as typed, without them (titles, queue)
shared/steps.ts          A tool call as a current step ("Editing src/app.ts"), for tasks and the working line
shared/git.ts            The git and gh tools' names, what a commit or push shows for review, the app's git
                         requests, and a folder's worktree layout
shared/modsOverlay.ts    Which repo file a mods/ file replaces (IGNITE_MODS)
shared/modsVitePlugin.ts The same overrides for the frontend, in Vite
shared/remote.ts         Remote access messages, the Tauri calls browsers may make, bytes over JSON
shared/grammars/         tree-sitter grammars (.wasm) and tags queries, copied from the tree-sitter-* packages
                         (LICENSE names the versions); to update one, copy its files from the new version
launcher/                How users run the app (not maintainers; see README)
  setup.mjs              `npm run setup`, on every platform: the sandbox's questions first (Windows' sandbox, Linux's bubblewrap and socat;
                         or --sandbox / --no-sandbox), the packages, the first
                         build, the launcher; its steps on screen, timed in ~/.ignite/launch/setup.log with everything else;
                         `--check` reports instead and changes nothing (sidecar/appDoctor.ts)
  uninstall.mjs          `npm run uninstall`: removes it, asking first (sidecar/appUninstall.ts)
  nodeCheck.mjs          Both scripts' first import: refuses a Node too old for the TypeScript they load
  launch.mjs             What they run: starts the newest built version with ~/.ignite/mods at once,
                         falls back to the last good version, then to no mods; again on restart
  serve.mjs              Serves its built frontend on :1420, or Vite (proxied) once a mod changes
  launch.sh, launch.ps1  Hand launchers from an older setup over to launch.mjs
.todo                    Planned work
src-tauri/               Rust shell: registers plugins, nothing else
  tauri.conf.json        App and main-window config
  dev-runner.sh          Runs `tauri dev` from a .app so Stage Manager shows the icon
  tauri.macos.conf.json  macOS-only config (the runner above); merged over tauri.conf.json
  icons/icon.svg         App icon source; after editing run `pnpm exec tauri icon src-tauri/icons/icon.svg`
                         and delete the android/, ios/ and 64x64.png it also writes
  capabilities/          Permissions the frontend may use
  tests/config.rs        Guards on the config (write scope, hidden window)
.github/workflows/ci.yml Build, typecheck, lint, format check, tests on macOS, for pull requests to main and pushes to it (main saves the Rust cache PRs restore)
.github/workflows/binary.yml Builds and attests the binary per platform once per src-tauri/ tree,
                         as pre-release `bin-<tree hash>` (sidecar/appBinary.ts downloads it)
.github/dependabot.yml   Daily PRs for new pi and pi-claude-bridge versions (new models arrive through them),
                         and @anthropic-ai's (sandbox-runtime, claude-agent-sdk)
```

Two places hold persisted data:

- **User settings** in `~/.ignite/settings.toml` (`lib/settings.ts`).
  Human-editable; add new options to the `Settings` type and `DEFAULT_SETTINGS`.
- **Themes:** the `theme` setting is `"system"` (GitHub Light/Dark following
  macOS) or a theme id. The chosen theme colours code, decides light or dark
  mode, and lends the app its colors for inline code (its strings), success,
  warning and errors (its terminal colors), where it sets them. Themes come from Shiki, from extensions installed in VS Code, VSCodium,
  Cursor or Windsurf, or from `~/.ignite/themes/*.json`. Picking an
  editor theme copies it (includes merged) into that folder and saves the
  copy's id, so uninstalling the editor later can't break it; the copy records
  `importedFrom`, and the picker lists it once. Never read other editors'
  settings; only their installed theme files.
- **Icon theme:** `icon_theme` is `"minimal"` (the app's Lucide glyphs, the
  default), or a VS Code file icon theme's id (`<publisher>.<name>/<id>`), found in the same
  VS Code-family editors' extensions or in `~/.ignite/icon-themes/` (each
  folder there an extension with a `package.json`). Read in place, not
  copied: one that's gone falls back to Minimal. Image and font icons both work.
- **Editor settings** (`[editor]` in settings.toml): `font_family` (CSS list,
  default Menlo) and `word_wrap` for the file viewer.
- **Conversation settings** (`[conversation]`): `show_thinking` (off by
  default) adds the newest sentence of the model's reasoning to the working
  line while it thinks; nothing of it stays. `ask_questions` (on by default)
  has the agent bring open decisions to the user with `ask_user`; off, the
  tool is dropped and the agent is told to decide alone. Read before each run.
  `model_router` (on by default) makes Router the default for new
  conversations: the model menu's Router item, picked like a model, turns it
  on, and picking a model turns it off. Settings doesn't show it.
  `text_size` (px, default 14, 10–24) sizes user and assistant messages only;
  ⌘/Ctrl +, - and 0 change it (`hooks/useTextSize.ts`).
- **Sidebar settings** (`[sidebar]`): `conversation_order` (`oldest_first` by
  default, or `newest_first`) orders each folder's conversations;
  `max_conversations_enabled` (off) collapses a folder after
  `max_conversations` (default 5, 1–20); `resizable_split` (on) lets the
  divider between conversations and files be dragged.
- **Files settings** (`[files]`, shown under Appearance): `hide_gitignored`
  (on by default) leaves .gitignore matches out of the file tree; `show_tree`
  (on by default) shows the file tree under the folders in the sidebar; off,
  the folders fill the column.
- **Composer settings** (`[composer]`, shown under Appearance): `git_status`
  (on by default) lists, after the approval menu, the conversation's
  repositories with uncommitted files, unpushed commits or an open pull
  request; off, nothing is read.
- **Memory settings** (`[memory]`): `enabled` (on by default; once `cmem`,
  still read) records what conversations do, recalls it in later ones and
  gives the agent the memory tools. Recording and recall check it before each
  run; the tools follow a reload.
- **Subagent settings** (`[subagents]`): `enabled` (on by default) gives
  the agent the `subagent` tool; `max` (default 2) caps how many of a
  conversation's run at once; it may start any number, and the rest queue
  (`sidecar/subagentQueue.ts`). Read before each run.
- **Mac settings** (shown under Mac, macOS only): `[mac] liquid_glass` (on
  by default) shows Liquid Glass in the sidebar. `[power]`: `keep_awake` (on
  by default) runs `caffeinate -i` while any folder's agent works, and ends it when
  every agent finishes or waits on the user (`sidecar/keepAwake.ts`).
  `keep_screen_awake` (off by default) adds `-d`, keeping the display on too.
- **Notification settings** (`[notifications]`): `enabled` (on by default)
  sends a system notification when a conversation finishes or starts waiting
  on the user, only while the app window isn't focused
  (`hooks/useNotifications.ts`). `sound` (on by default) plays a chime with
  it: macOS's Glass, the freedesktop theme's on Linux.
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
  git and gh included, runs as is. `windows_sandbox` (off, Windows only;
  `npm run setup` offers to turn it on) sandboxes bash there instead of asking
  for each command. The sidecar reads
  them on every tool call (`sidecar/approvalSettings.ts`).
- **Pane sizes** in the webview's `localStorage` (react-resizable-panels).
- **File tree's open folders** in the webview's `localStorage`
  (`file-tree-open`): absolute paths, so switching folders or relaunching
  keeps them open (`lib/openFolders.ts`).
- **Composer git status** in the webview's `localStorage` (`git-status`): each
  conversation's last known repositories, newest 200, so the composer shows them
  at once while they're read again (`lib/gitStatusCache.ts`).
- **Composer models** in the webview's `localStorage` (`session-state`): the
  newest models and each conversation's model and effort (newest 200), so the
  menus show at once while it opens (`lib/sessionStateCache.ts`).
- **Composer history** in the webview's `localStorage` (`composer-history`):
  the newest 100 sent messages, shared by every folder (`lib/history.ts`).
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
shows Approve / Deny, answered with `approval_answer`. bash takes a `reason` and every MCP tool requires one
(`sidecar/toolReason.ts`, dropped before the tool runs), shown above what the
call would run (its command, or an MCP call's arguments). A denied call returns
`{ block: true, reason }` to the model; stopping the run or closing the
folder denies what's waiting. A hidden folder's question waits until it's
shown again. When several calls wait, only the first shows its prompt (with
how many more wait behind it); the rest show their place in line and open
in turn, so nothing waits off screen. The `ask_user` tool (`sidecar/askExtension.ts`) uses the same
channel: its call waits as an approval and, once first in line, its questions
take over the composer (`useQuestionDeck`, `ComposerQuestion`): options above
the text box, whose text and images are a note on the picks, or the user's own
answer when none is picked, with mentions, images, dropped files and paste as usual (files go in that question's note, and the conversation's diff comments in the last answer's). Its row
says "Asking you · 1 of 2", and once answered lists the answers (from the
result's `details`). `approval_answer` carries the answers (declining leaves
the choice to the agent). The approval gate never asks about `ask_user` itself. **Manual** asks for every tool call (built-in,
MCP, everything); approved commands run as is. **Auto** asks for bash
commands on the denylist in `lib/dangerousCommands.ts`, for file tools
whose resolved path (symlinks followed) is outside the open folder, and for
MCP calls (`mcp`, `mcp__<server>` and direct tools, known by
the extension that registered them) unless the tool's name reads as a read
only (`get_list`, not `create_comment` or `query`; `lib/mcpToolCall.ts`). Every
other bash command runs without asking inside an OS sandbox
(`sidecar/sandbox.ts`, Anthropic's `@anthropic-ai/sandbox-runtime`: Seatbelt
on macOS, bubblewrap on Linux). It may write only in the folder, temp
folders and package caches, can't read credentials (`~/.ssh`, `~/.aws`,
keychains, auth files) and goes online through the runtime's proxy, which
runs in the sidecar: package registries and git hosts take any request,
other hosts only reads (GET, HEAD, OPTIONS; not a WebSocket's opening GET),
and only if their name resolves to public addresses, never an IP literal
or `localhost` (`sidecar/sandboxNetwork.ts`). The proxy decrypts those
hosts' HTTPS with its own CA to see the method (`readsOnly`, which reads
the allowlist live); a POST or upload gets a 403, and the run asks like any
block even when the client exited 0 (`sendRefused`). It guards against
mistakes, not exfiltration: a GET's URL carries data, and raw TCP (SOCKS)
reaches those hosts unfiltered. Commands run with
`pipefail`. When a command was blocked (it failed, or its output says so),
the same call asks the user before it ends; approved, the
extension runs it outside the sandbox and that output is the result, declined,
the model gets the sandbox's report. When the sandbox named what it blocked
(a host, Unix socket, or path read or written; never a credential, nor
one already on the list), the prompt also offers
**Always allow**, which adds it to `~/.ignite/sandbox.json`
(`sidecar/sandboxAllow.ts`, read before every command) and runs this one
outside. When what it hit can't be allowed (a credential, like a CLI's token
in the keychain), it offers instead the one program and subcommand the
command runs by name (`doppler run`), whichever process read it (doppler
reads through `security`): from then on, a command line whose every pipeline
(`$(…)` and `bash -c` included) starts with that command or a cd runs
outside the sandbox. Shells, interpreters, package runners and file tools
(`node`, `npm`, `xargs`, `cat`, `curl`, `security`…) are never offered.
The keychain goes through securityd, which the sandbox's report leaves out,
so a failed command whose CLI says it couldn't find its login in the keyring
also counts as blocked. While any commands are allowed this way, the system
prompt (read once per conversation, for its cache) lists them and says how to
write them. A blocked background command asks like any other; approved, its
sandboxed copy is ended before it runs outside. File tools may also use temp folders without asking, as
sandboxed bash can, and each conversation is told of its own scratchpad
(`$TMPDIR/ignite-scratchpad/<session id>`). Approving a denylisted command also runs it outside. Where the
sandbox can't start, Auto instead asks for bash commands naming absolute, `~`
or `..` paths outside the folder. On Windows (a denylist written for Unix)
Auto asks for every bash and PowerShell command, unless `[approval]
windows_sandbox` is on (off by default, Settings → Agent, Windows only;
`npm run setup` explains it and offers to turn it on):
then bash runs in sandbox-runtime's Windows sandbox (alpha,
`sidecar/windowsSandbox.ts`), set up with one UAC prompt by the first command
after it's turned on (turning it off and on again retries a declined one). Commands run as its `srt-sandbox` user, which can open
only what's granted: each folder a command ran in (write, from then until the
sidecar ends, so any later command may write there too), its worktree's git
files, the scratchpads, PATH folders under home and what's always allowed
(paths from the next start). A firewall rule lets it online only through the
same proxy. Blocked files show only as a permission error in the output
("Permission denied", "Access is denied", Node's EPERM), so the prompt to run
outside offers no "Always allow" for paths. Bash isn't kept read-only until
the work is planned (a deny there would block the folder's other running
commands too); edits and writes still wait for the plan. File
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
seconds. `bash_wait` (`sidecar/bashWait.ts`) takes one or more pids and
returns at once; when the last of them exits (a stopped one drops out), the host (`sidecar/hostWait.ts`) sends a hidden message with
each one's exit code and the end of its output that starts a new run (pi's
`sendCustomMessage` with `triggerTurn`, queued as a follow-up mid-run), so
the agent carries on instead of promising to report back. A conversation
waiting on its fork gets it as a fork note instead, with its next run.
`bash_stop` on the command, or Stop on the conversation, cancels the wake,
and a task isn't nudged to wrap up while it waits. The sandbox doesn't let commands listen on ports or reach local
services (the user's Chrome, the remote access server), so a dev server
fails there and asks to run outside. A conversation's background commands
end with it (not on a reload) and with the sidecar, on a signal too.

The sidebar lists each conversation's subagents and background commands
under it (`AgentStatus` in `shared/agentStatus.ts`, pushed on change).
Each opens as a tab beside the files (`lib/childTabs.ts`): a subagent's
whole conversation, rebuilt from its calls in the shown conversation, or a
command's output, read again each second while it runs. A finished row
leaves the sidebar, staying only while its tab is the active one.

The `git` and `gh` tools (`sidecar/gitExtension.ts`) run git and the GitHub
CLI outside the sandbox with the user's credentials, from an argument list
(no shell). They ask for themselves, so the approval extension skips them:
Manual asks for every call; Auto (`lib/gitPolicy.ts`) runs reads and local
work (status, diff, log, fetch, pull, clone, switch, add…) and asks for
anything else, for options that run a program or change git's config
(`-c`, `--upload-pack`, `rebase -x`, `git config` writes…), and for paths
outside the folder. A commit, push or `gh pr create` waits with a review: its changed files
(status, +/− counts) and message or commits, each file opening its diff in a
tab (`git_diff`). A diff tab's lines take comments (the gutter's "+", shift-click
or drag for a range), each saved straight into the composer's message of the
conversation that opened it (kept in memory, shown as cards beside its images),
and the message carries them as `@path:lines` mentions with the quoted
lines (`shared/sentComments.ts`), shown again as cards in the conversation. A commit called with `push: true` (on a branch) waits
once, its review naming the branch ("Commit and push to origin/<branch>"), then
runs `push -u origin <branch>`; other git options than `-C` are refused; a task's runs alone only when both would. A commit called
with `pr` (title, body, optional base and draft) also opens the pull request after the push, under that one approval (a push called with `pr`, for work already committed, likewise): its review adds the
pull request and the branch's earlier commits it holds, a task's always waits (declined, nothing is committed), and when gh can't read
the repository it's refused before committing. A branch whose pull request is already open (also when it opened while the call waited)
only commits and pushes, and the task records that pull request. When only opening it fails, the push still counts as delivered. A commit or push that continues a branch whose pull request
was merged (it holds that pull request's head commit but not its merge, none
is open, and no pull request targets the branch) is refused before it asks,
pointing the agent at a new branch from the default one
(`sidecar/gitMerged.ts`); when gh can't tell within 10 seconds, it goes ahead. The sandbox already refuses writes to `.git/config` and
`.git/hooks`; hooks can still live in the working tree (husky), so calls that
ran without asking run with hooks off. Bash commands that commit, push, pull,
fetch, clone or run gh are blocked with a pointer to the tools. Likewise, bash commands that only
search or read the folder's files (grep, rg, cat, sed, head, tail; no writes,
no paths outside it) are blocked with a pointer to the grep and read tools
(`sidecar/bashSearch.ts`), and an edit's result shows its changed lines,
numbered, so the agent doesn't search the file again before the next one.

The user's own terminals (`sidecar/terminal.ts`) run their login shell in
the shown conversation's worktree (`dir`; the folder before its first
message), listed under the folder, in a PTY, outside the sandbox: `terminal_open`
returns an id, keystrokes go in with `terminal_input`, and output comes back
as `terminal_data` events (`terminal_snapshot` restores a new view). Each
also feeds a headless xterm, so agents read the rendered screen, not escape
codes: before each run, what the folder's terminals printed since that
conversation last looked is added as a hidden message (like Claude Code's
`!`), and `terminal_read` reads them on demand. Agents can't type into them.
⌘J or ⌘T (Ctrl+J or Ctrl+T) opens a new one as a tab beside the conversation. While a
command runs in it, its tab and sidebar row are named by that command line
(the terminal's foreground process, read with `ps` after output; not on
Windows), and "Terminal" at the prompt. Closing the
tab ends its shell, in every layout; when a command still runs in it
(`terminal_close_idle`, checked afresh; always on Windows, which can't tell) a
dialog asks first, naming the command (`confirmCloseTerminal`). Stop on its
sidebar row ends one too. A folder's terminals are named by their place, oldest first (`t1`,
`t2`…, `name` in `TerminalInfo`), as the composer's `@`, `terminal_read` and
their tabs ("Terminal 1") call them; closing one renames those after it, so
the names always match the open tabs. Ids (`term-1`) stay fixed.

The composer completes `/` at the start of a message with the app's
`/compact` (pi's `compact()`: older messages become a summary, shown as a
divider that opens to it; text after it steers the summary; while it runs, a
bar fills as the summary streams) and the session's
skills (sent as pi's `/skill:name`, shown again as `/name`), `/fork` (below), and `@`
anywhere with the message's images (`@image1`) and dropped files (`@file1`), the folder's terminals
(`@t1`) and files (`@src/app.ts`). Mentions stay plain text; the system
prompt says what they name. Each `/` row shows its arguments as chips (a
skill's Claude Code `argument-hint` frontmatter, `[optional] <required>`),
and while they're typed a hint above the composer lights the current one,
with its line from the app's own `argument-descriptions` frontmatter (a list,
one per argument). A fixed-values argument (`[low|medium|high]`) lists its
values to pick with ↑/↓, none picked until one is typed, so ↵ still sends.
Esc hides the hint until another command's arguments start, and still
reaches the composer (stopping a run); a mention's list in the arguments
closes on its own.

`/fork` (or Fork in the composer's + menu, beside Whiteboard and Files) copies the conversation into a
new one (`new_session` with `fork`, `sidecar/hostFork.ts`): pi's `forkFrom` copies its
file, named after the text after `/fork` (its first message) or "Fork of …",
and a hidden message tells the copy it's a fork. Its worktree starts as a
snapshot of the original's files (its saved state when its worktree is gone),
detached at its commit; ignored files come from the folder as usual. A
conversation running, being routed or with messages queued can't be forked,
and a fork that fails to start deletes its copy. The fork is listed under
its original like a subagent (`forkOf`, kept in the sidebar's list), and
while it's open the original takes no messages (`waitingOnFork`: its
composer's controls are off and its working line says "Waiting for fork"). Closing the fork has the
cheapest priced model of the original's provider (the router's) summarize
what it did since its last report (`sidecar/forks.ts`), else its last reply
is used; the report is sent to the original as a message, so it carries on.
When the original isn't open, it opens in the background to take the report
(and closes with its folder). When another fork of it is open (or it can't
open), the report waits in `~/.ignite/pi/fork-notes/<id>.json`, like the note
that the fork was made, and joins its next run as a hidden message
(`sidecar/forkExtension.ts`). While the summary is written, the fork's last
reply waits there in its place, so a sidecar restart never drops a report.

Hovering one of the user's messages shows Edit, which edits it in place
(its images kept): ↵ rewinds the conversation to just before it and sends
the new text, Esc cancels. The app names each user message by pi's entry id
(`entryId`, on opening and in a `message_entry` event once pi saves it), and
`rewind` (`sidecar/hostRewind.ts`) moves pi's leaf to before that entry with
`navigateTree`, so the old branch stays in the file; a `rewound` event cuts the
app's transcript there. Only an idle conversation rewinds (not running,
routing, compacting, waiting on approval or a fork, nothing queued), only to
messages after its latest compaction, and never a subagent's. Editing the
first message retitles it (a fork keeps its name). Before each user message
runs, its worktree's tracked and untracked files are snapshot (moving no
branch) and kept under `refs/ignite/checkpoints/<session id>/<entry id>`
(`sidecar/checkpoints.ts`); a failed snapshot never fails the message.
Rewinding first restores that checkpoint's files (ignored ones stay, HEAD
too); a folder outside git rewinds only the conversation. A conversation's checkpoints go when its worktree is saved and
removed, and a fork keeps its own file and files when its original rewinds.

Tasks and conversations are one thing shown two ways. Every conversation
plans before it changes files: `task_update` lays out its subtasks and keeps
them current (only a conversation the user follows may remove them), and a conversation from the composer joins the Tasks view
then, as an `interactive` task (titled by its first message) that keeps
`ask_user`, the user's Chrome and git review as usual. Tasks started from
the Tasks view hand work to an agent that runs on its own. Start in
conversation (on an unstarted task or a `.todo` item) starts it as an
`interactive` one instead, sending the task as its first message and showing
the conversation. The Tasks view also
lists the open items of the `.todo` files in the folder and the folders
directly in it (`sidecar/todoFile.ts`: top-level list items under their `##`
section, struck-through, CLOSED, FIXED or DONE ones left out); Delete removes
its lines from the file; Add to tasks makes one an unstarted task, and it leaves the list once a task has its title.
Each folder's tasks live in `~/.ignite/tasks/` (`sidecar/taskStore.ts`,
one JSON file per folder, images inline). Starting one opens a conversation
in the background on the task's model and effort (never saved as defaults)
and sends it the title, notes, subtasks and images. `taskExtension.ts` gives
only that conversation autonomy: it drops `ask_user`, points its
`chrome_*` tools at the app's own Chrome, and adds a wrap-up phase: a run
that ends with subtasks open or no pull request gets one wrap-up message.
In every conversation, edits and writes are blocked until it has laid out
or confirmed the subtasks (`planned`), and only explore subagents start;
until then Auto's sandbox keeps the folder read-only for bash, but for what
git ignores that exists (caches, builds), and a bash call that ran outside it
and changed files tells the agent to plan first (its changes stand). Each tool call becomes its task's
step. Any conversation not started from the Tasks view can fill the list with `task_add`
(`sidecar/taskAddTool.ts`): its row shows the proposed tasks as cards, and
approving adds them unstarted. In a task, a commit and a plain push of its own branch run without
asking (`taskRunsAlone` in `lib/gitPolicy.ts`); `gh pr create` still waits
for review, shown on the task's card (the conversation's status carries the
waiting review). Approved, the pull request opens, its URL is saved and the
task is done. Declined, the task is marked `declined`, the agent is told to
stop and isn't nudged, and the card takes what to change and resumes the
conversation (`task_resume`). A task's status comes from its
conversation (`lib/tasks.ts`): working, waiting on the user, finished (to
review) once idle, done once its pull request opens or merges (seen by the
composer's git status), the user closes its conversation, or marks it.

With Model Router on (`[conversation] model_router`), before a conversation's
first message (a composer conversation's, or a Tasks-view task's as it starts)
`sidecar/hostRoute.ts`
asks the provider's cheapest model (`sidecar/router.ts`, `completeSimple` with
`cacheRetention: "none"`, so claude-bridge runs it in a separate Claude Code
process) for the model and effort the conversation runs on, choosing only
among the model menu's featured (current generation) models when the
provider has any (`shared/featuredModels.ts`). They're set
without saving them as defaults (the app reads them again when routing ends),
and later messages never change them, since a switch would throw away the
prompt cache, unless the user picks Router in the conversation's model menu
(`route_next`): its next idle message is routed the same way, with the
conversation's first message as context (`routeNext`, kept when Stop drops
that message), and the menu reads Router until then. A message too vague to judge (a bare link, "take a look") gets
the middle-ground model at high effort (on Claude, Sonnet), as the router's
prompt asks; a router that fails or times out keeps the user's default model
and effort, and with no priced model to call the cheapest, it doesn't run.
When it ends, a line above the first message says what it picked or kept.
Router is picked like a model, in the composer and the new-task sheet alike
(`components/agent/ModelChoices.tsx`): picking a model always makes it the
default for new conversations, at once (`save_default_model` where no
conversation is open, pi's `persist` otherwise), turns `model_router` off, and
turns the router off for that conversation (`userPickedModel`), so it picks
nothing, effort included; choosing Router takes the picked model back and
turns it on again. A task saves a model and effort only when the user picks
a model; one saved on Router is routed when it starts whatever the default
(also when its saved model is no longer available). Only the message's first 4,000 characters go
to the router.
Closing the conversation while it reads drops the message; showing it again
meanwhile shows the message being routed.
While it reads the message, the message already shows in the conversation
(`routing_start` carries it; `lib/routedMessage.ts`) and names it in the
sidebar, the working line shows Routing…, sending waits, and Stop hands the
message back.

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
`show_image` can put it on the task. Auto runs them without asking; Manual asks.

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
starts detached at the remote's default branch as last fetched (the
folder's HEAD without a remote), so the user's uncommitted work never ends
up in its commits; the remote is fetched in the background when the folder
shows and as each conversation starts, so a start never waits on the network. The folder's ignored files (`node_modules`, builds,
`.env`) are cloned copy-on-write (on APFS each whole with clonefile(2),
called through `osascript`, about ten times faster than `cp -c`'s file-by-file
walk, which stays the fallback; `--reflink` on Btrfs/XFS), so they cost almost
no disk until changed. That goes on in the background, one repository at a
time, and starts once the first reply streams (a big clone starves Claude
Code's start of the disk), a call needs the files, or after 10 seconds: the
conversation and its first message start at once, and only the calls that
need those files wait for them (`sidecar/readyExtension.ts`, subagents' too:
`write`, `edit`, `bash`, `git`, and a `read` of a file not there yet),
letting go if the run stops; removing the worktree waits for a clone that
started and skips one that hasn't (`sidecar/worktreeReady.ts`, by workspace
path). The app shows the first message as soon as it's sent, while the
worktree and session are made (`hooks/useStartingMessage.ts`). Where the filesystem can't clone (Windows,
ext4, other volumes), only ignored files are copied; ignored folders are
skipped and the agent installs and builds its own, since a copy costs their
full size and a link would let it write into the user's (Windows has no
sandbox to stop that). Doppler keys a folder's project and config by its
path, so shells in a worktree (the user's terminals, the agent's bash) get
`DOPPLER_CONFIG_DIR` at a copy of the user's config, written again as each
starts, in which the folder's settings (and its parents', which Doppler
applies by prefix) also name the worktree (`sidecar/doppler.ts`, in
`~/.ignite/doppler`, out of the sandbox's reach, deleted with the worktree); Doppler
prints a line on stderr saying it uses it. There's no "apply": work reaches the folder through
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
A folder that isn't a repository but holds some (`~/Projects/app` with
`server/` and `web/`) gets a copy per conversation at the same kind of path
(`sidecar/worktreeGroup.ts`): each repository with a commit in it is its own
worktree, saved and brought back like one, and the folder's other files are
copied in afresh (the agent's changes to them aren't kept): its loose files
(links to files too) before the session opens, as pi reads the folder's CLAUDE.md then, and its
loose folders with the clones. Other folders
outside git (or with no commit yet) are shared instead. The composer's
repository popover tags which, beside the branch (or "No branch yet"): the
conversation's own worktree, or (a warning) the user's own checkout.
Trust, saved conversations and memories stay keyed by the folder (`folderOf`).
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
(pinned 6.0.0), loaded into every session by `sidecar/mcpExtension.ts` with
the app's `mcp.json` as its whole config, so it never reads `~/.config/mcp`,
a project's `.mcp.json` or other apps' MCP configs. Servers connect on first
use (one with no cached tools starts as a session opens, only to list them);
the model reaches them through the adapter's `mcp` and `mcp__<server>` tools.
It never sees pi's own MCP API (`withoutPiMcp`), so calls don't nest as
`mcp__<server>__<tool>`. Saving a change reloads the session (after the current run), and a
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

The agent remembers what conversations did (`~/.ignite/memory.db`,
`node:sqlite` with an FTS5 index), in the shape
[cmem](https://cmem.ai) (claude-mem) keeps: observations typed `bugfix`,
`feature`, `refactor`, `change`, `discovery`, `decision`, `security_alert`,
`security_note` or `sensitive`, each with a title, subtitle, facts,
narrative, concepts and files, and each run's summary (request, investigated,
learned, completed, next steps, notes), all keyed by folder. Once a run
settles, `sidecar/hostMemory.ts` hands it to `sidecar/memoryWriter.ts`: the
cheapest priced model of the conversation's provider (the router's) reads it,
with the titles the conversation already recorded, and writes what's worth
knowing later, one call per run (a run past half the model's window, at most
400,000 characters, takes a call per chunk, keeping the last one's summary); `<private>` text, the memory
tools and plan or lesson calls are left out. A new conversation's system
prompt (read once, for its cache) gets an index of its folder's 50 latest
observations and 10 latest summaries, one line each (id, time, mark, title)
by day, within 10,000 characters (`sidecar/memoryContext.ts`). The agent
reads one in full with `memory_get`, finds older ones with `memory_search`
(every word, by stem and prefix, then any word; by kind and date) and sees
the work around one with `memory_timeline`; the index goes in as the `memory`
prompt section (`systemPromptOptions.sections`), since claude-bridge passes
Claude Code only pi's sections, never text an extension adds to the prompt.
Subagents get none of it. The Memory settings section turns it on or off
and lists the folder's latest memories, searched (as `memory_search` does)
and filtered by type (with each type's count), each opening to its facts and
files. cmem is only a compatibility layer: each sidecar start quietly imports
what isn't in yet from `~/.claude-mem/claude-mem.db` (`sidecar/memoryImport.ts`,
read only, no worker; nothing shows it): each session maps to the folder it
was worked in, else its project's usual one (an Ignite worktree's to its
folder), and a type of the model's own becomes `change`, so Claude Code's
memories keep coming in while cmem records them there.

Separately from its memory, the agent keeps lessons from its own mistakes
(`sidecar/lessonExtension.ts`, `~/.ignite/lessons.json`). The system prompt
tells it to call `lesson_add` whenever it's corrected or promises to do
something differently; lessons save without asking, for every folder or only
this one, at most 30 per scope. Replacing one (`replaces`) or removing one
(`lesson_remove`) asks the user first, and reaches only lessons that apply in
the folder. A `system_prompt` lesson is listed in the system prompt (read once
per conversation). A `tool_call` lesson names an exact tool (`git`, `bash`,
`mcp__github`, or an MCP tool like `create_issue`) and is checked on that
tool's calls, before approval: with `match`, plain text (3+ characters) in the
call's argument values joined by spaces (`reason` left out), or with
`regex: true` a JavaScript regex (`s` flag, so `.` crosses lines), a matching
call is always blocked with the lesson as the reason. A `bash` lesson may take
`background` (true or false) to apply only to background or foreground calls. A regex is checked once,
on save (`sidecar/lessonRegex.ts`): refused when it's invalid, matches empty
or ordinary text (it would block every call), or `recheck` (loaded only then)
finds it worse than quadratic or can't tell; a quadratic one is marked and
tried on a call's first 4,000 characters only, a linear one on all of it.
Without `match`, the tool's first
call in each conversation is held once so the agent reads it. Subagents get
the same checks.

Settings → Lessons lists every saved lesson
(where it applies, how often it came up) and removes one.

The reflector (`sidecar/reflector.ts`) has one job: making the agent work the
way this user wants, from their feedback, over time. Lessons stay as they are
(mistakes, appended and enforced); the reflector keeps its own points in
`~/.ignite/reflector.json` (`shared/reflector.ts`): how the user wants the
agent to report, ask, plan, deliver and delegate, each tied to an entry
point. `sidecar/hostReflect.ts` collects the feedback in a run: the user's
messages after the conversation's first (not the ones the app sends as theirs:
a task's wrap-up, a fork's report), what they wrote answering `ask_user` (a
note or their own answer; a bare pick is a choice for the task), calls they
denied or wrote over (not a declined `ask_user`, `task_add`, lesson change or
run outside the sandbox) and rewinds (with what they dropped; the new message
is the run's). When a run with any settles, the cheapest priced model of its
provider (the router's) reads it with the points and the run's last 15,000
characters, and either keeps them (the usual case: task-only choices, project
facts and single tool mistakes teach nothing here) or replies with the points
it keeps, changes (a left-out entry point stays), adds (with an entry point and
the kind of feedback that taught it) or drops. A point it leaves out stays, so
only an explicit drop removes one; at most 10 per entry point, a new one
merged into the one it sharpens. A hand-edited file's broken points are
skipped when read. They're written at once, one
reflection (or Settings edit) at a time, with no prompt to the user.
`sidecar/reflectorExtension.ts` (loaded after the extensions it adds to) reads
them once per conversation, for its cache, and puts each beside its entry
point's guidance: `asking` in the `questions` section (only while `ask_user`
is active), `planning` in `plan` (a task's `task`), `delivering` in
`worktree` (the git guidance), `delegating` in `subagents`, and `always` in a
`reflector` section of its own; a point whose section the conversation lacks
is left out. Each new or changed point records the conversation it was
learned in. Settings → Reflector lists them like lessons: where each is read
(its entry point), and what taught it, in which conversation (a link that
opens it) and how long ago; it edits one in place (then the user's own, with
no conversation) and removes one.

Claude subscriptions run through the user's own Claude Code via the
`pi-claude-bridge` extension (pi provider `claude-bridge`), because Anthropic
bills pi's direct Claude sign-in to extra usage. See the skill's auth.md.
When the subscription runs out mid-run (claude-bridge's "Claude quota
exceeded" error), `sidecar/fallbackExtension.ts` moves the conversation onto
the user's fallback Anthropic API keys (added in the connect screen's Claude
card while it's on a subscription, kept owner-only in
`~/.ignite/fallback-keys.json`; the app only ever sees their last 4
characters), in order: in `agent_before_settle` it drops the failed reply from
the model's context, sets the key as the session runtime's runtime key (over
the event bus to `start.ts`), switches to the same model on the API
(`claude-bridge/claude-opus-5-5` to `anthropic/claude-opus-5-5`) and
continues the run; a key that's spent, refused or throttled (`keyFailed`, not
a transient or request error) moves on to the next. The limit's reset comes
from the rejected window's `anthropic-ratelimit-unified-reset` header the
bridge sends just before the error (not while overage still serves it), else
the error's "resets 6:30 PM", else an hour; it's shared by every conversation
(`globalThis`) and saved with the conversation's state (a `ignite.fallback`
custom entry, so a reopened one keeps its key). The first message after the
reset goes back to the subscription and drops the runtime key, so it doesn't
linger in the model menu or background calls. Subagents started meanwhile get
the conversation's key (they run on its provider) but don't fall back
themselves. The first call on a key sends the whole conversation uncached.
Off the subscription, a reply claude-bridge marked aborted after its tool call
ran (a run stopped mid-tool) goes back as pi saved it (`answeredAsSaved`), so
its results aren't orphaned. ChatGPT signs in
automatically with the Codex CLI's login (`~/.codex/auth.json`) when the app
has none of its own; token refreshes are written back to that file.

## Users and mods

Users run the app through `launcher/` (README "Install"), and maintainers run
`pnpm run tauri dev`. For users, `IGNITE_MODS` points at `~/.ignite/mods`:
a file there replaces the file at the same path under `src/`, `sidecar/` or
`shared/` (Vite through `shared/modsVitePlugin.ts`, Node through
`sidecar/modsHooks.ts`), so their changes never conflict with upstream.
Without the variable nothing changes.

- `sidecar/main.ts` only turns the overrides on, then loads `start.ts`. Keep
  it that way; anything it imports statically can't be modded.
- Load sibling files through `import.meta.resolve`, not `import.meta.dirname`,
  so they are still found when the importing file is a mod.
- The launcher runs versions it built (`sidecar/appBuild.ts`): a release
  binary without Tauri's custom-protocol feature, so it loads localhost:1420,
  where `launcher/serve.mjs` serves the version's frontend, built with the
  mods (`vite build`, a few seconds, once per set of mods). When a mod changes
  it serves Vite instead, and the page reloads onto it
  (`lib/liveReload.ts`), so mods hot-reload as in dev. The binary is rebuilt
  only when `src-tauri/` changed, and then downloaded from CI's release when
  its build attestation checks out (`sidecar/attestation.ts`, no `gh` needed;
  when the check can't run it's used with a warning), else built locally. Updates are built beside the running
  version, never in place: a running sidecar loads extensions from its files.
- The launcher counts a start as good once `reportHealthy()` (`lib/health.ts`)
  writes `IGNITE_HEALTH_FILE`, after the sidecar answers. Keep that call on
  the startup path, or every update looks broken and gets rolled back.

## Commands

- Dev app: `pnpm run tauri dev` (frontend hot-reloads; `src-tauri/` changes relaunch)
- Demo for screenshots: `pnpm run demo` opens `demo/tempo` and `demo/pantry`
  with the sidecar replaced by a scripted host (`lib/demoHost.ts`): made-up
  providers, models, conversations, search and git reviews. The composer types
  a fixed prompt whatever the keys, and sending gets a fixed reply. Nothing
  runs or is saved, so clearing sessions or app state never loses it.
  `demoConversations.test.ts` keeps its diffs in line with the files in
  `demo/tempo`.
- Verify before finishing any change: `pnpm run check` (tsc, ESLint, clippy,
  Prettier, rustfmt, Vitest, cargo test). CI runs the same steps.
- Commits run `.githooks/pre-commit` (`lint:js`: oxlint, ESLint, knip; and the
  format check), which `pnpm install` turns on through `prepare`. Clippy is left
  to CI. `--no-verify` skips it.
- Tests only: `pnpm run test`; watch mode: `pnpm run test:watch`
- Find untested branches: `pnpm run coverage`
- Auto-format: `pnpm run format`
- Add a UI primitive: `pnpm dlx shadcn@latest add <name>`
- Add a Tauri plugin: `pnpm run tauri add <plugin>` (wires the package, Cargo, `lib.rs` and a default permission)

## Testing

- **What to test:** any logic with branches or failure paths, especially code
  that talks to Tauri. Every `if`/`else`, fallback and error path should have a
  test that would fail if it broke. There is no coverage percentage target;
  use `pnpm run coverage` to spot branches nothing reaches.
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
- **No dead code:** knip (`knip.json`, part of `pnpm run lint`) fails on
  unused files, exports and dependencies. Export only what another file
  uses; a file loaded by path (like the sidecar's extensions) is listed
  there as an entry.
- **Size limits are enforced** by oxlint (`.oxlintrc.json`, part of `pnpm run
lint`): one component per file, files ≤250 lines, functions ≤120 lines,
  complexity ≤10, nesting ≤4. Split code instead of raising a limit or adding
  to the exemption list.
- **Confirmations are native.** Every "Are you sure?" (remove, discard, close,
  quit…) goes through `confirmNative` in `lib/lifecycle.ts`, the system's
  dialog. Never a shadcn `Dialog`/`AlertDialog` for a yes/no question.
- **Menus are shadcn.** Every menu, picker and dropdown uses a shadcn component
  (`Select`, `DropdownMenu`, …; add missing ones with `pnpm dlx shadcn@latest add`).
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
2. Run `pnpm run test`. `src/lib/app.test.ts` fails for each file that still
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
- The sidebar shows Liquid Glass (`tauri-plugin-liquid-glass`, vibrancy before
  macOS 26) through a transparent window, following `[mac] liquid_glass`.
  `setGlass` marks `<html>` with `glass` only while it's there, and only then
  does the page go transparent (`glass:` variant); panes that must stay
  opaque say `glass:bg-background`.
  The glass takes light or dark from the window, so the theme sets it too,
  and its tint from the shown code theme's sidebar (else editor) background
  at 40% strength (`glassTint`), in the Sidebar material.
  Only the desktop workspace and the welcome screen (`data-glass`) let it
  through; other screens stay opaque. Dialogs render outside them, so
  Settings and the ⌘K command center are frosted instead (CSS blur, the
  `frosted:` variant, any time the window has glass). Only macOS windows are transparent: `tauri.macos.conf.json`
  repeats the whole main window, since platform configs merge-patch and
  replace the `windows` array (`window.test.ts` keeps the copies equal).
