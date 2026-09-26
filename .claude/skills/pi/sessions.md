# Sessions, tools and safety (0.87.1)

`CA` = `node_modules/@earendil-works/pi-coding-agent`.

## Agent dir

`$PI_CODING_AGENT_DIR` or `~/.pi/agent`. Contains `auth.json`,
`settings.json`, `models.json`, `models-store.json` (catalog cache),
`trust.json`, `keybindings.json`, `sessions/`, `extensions/`, `skills/`,
`prompts/`, `themes/`, `AGENTS.md`, `SYSTEM.md`, `APPEND_SYSTEM.md`.
Settings: global `settings.json` deep-merged under project `.pi/settings.json`.

## Sessions

- File: `<agentDir>/sessions/--<cwd, leading / removed, / \ : → ->--/<timestamp>_<uuid>.jsonl`.
  Override: `--session-dir` > `PI_CODING_AGENT_SESSION_DIR` > `sessionDir` setting.
- JSONL tree: header `{type:"session", version:3, id, timestamp, cwd, parentSession?}`,
  then entries `{type, id, parentId, timestamp, …}` (`message`, `model_change`,
  `thinking_level_change`, `compaction`, `branch_summary`, `custom`,
  `custom_message`, `label`, `session_info`, `usage`, `context_edit`).
- `SessionManager`: `create`, `open`, `continueRecent`, `inMemory`, `forkFrom`,
  `findById`, async `list(cwd, dir?)` / `listAll(dir?)` →
  `SessionInfo {path, id, cwd, name?, created, modified, messageCount, firstMessage, …}`.
  `getDefaultSessionDir(cwd, agentDir?)`.
- RPC has no list command: list with `SessionManager.list` (SDK) or by reading
  the folder; resume with `switch_session` or `--session`.
- SDK session replacement (new/switch/fork/import) lives on
  `AgentSessionRuntime`; `runtime.session` changes afterwards: re-subscribe.
- Since 0.87 the `SessionManager` is authoritative for context; assigning
  `agent.state.messages` does not replace history.

## Tools

- Built-ins: `read, bash, powershell, edit, write, grep, find, ls`.
  Default active: `read, bash, edit, write` (setting `defaultTools`).
- SDK: `tools: string[]` allowlist, `excludeTools`, `noTools: "all" | "builtin"`,
  `customTools: [defineTool({...})]`. RPC: `--tools`, `--no-tools`,
  `--no-builtin-tools`. Tools must truncate their own output.

## Permissions and trust

- **pi has no approval prompts.** Tools run with the user's rights in `cwd`.
  Gate with an extension: `pi.on("tool_call", e => ({ block: true, reason }))`,
  asking the user via `ctx.ui.confirm` (becomes an RPC `extension_ui_request`).
  First `block` wins. Mutating `event.input` modifies the call.
- **Project trust** (0.79+): project `.pi/` settings, extensions, skills,
  prompts, themes and `.agents/skills` load only when trusted. RPC can't
  prompt: pass `--approve` / `--no-approve` or they are skipped. The SDK path
  defaults to trusted. `AGENTS.md` / `CLAUDE.md` load regardless.
- pi's own advice (`docs/security.md`): real isolation needs a container/VM;
  trust and transcripts are not a security boundary.

## Context loaded for a cwd

- `AGENTS.md` (or `CLAUDE.md`) from the agent dir, then one per directory from
  `/` down to `cwd`.
- `.pi/SYSTEM.md` replaces and `APPEND_SYSTEM.md` appends to the system prompt.
- Skills (agentskills.io format, `name` + `description` required) from the
  agent dir, `~/.agents/skills`, `.pi/skills`, `.agents/skills` up to the git
  root, packages and settings. Only descriptions enter the prompt.

## Compaction

Automatic when context tokens exceed `contextWindow - reserveTokens`
(settings `compaction.{enabled, reserveTokens: 16384, keepRecentTokens: 20000}`),
or on `compact`. Older messages are summarized into a `compaction` entry;
cuts never split a tool result.
