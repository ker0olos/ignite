# Ignite

**The only AI coding app you'll need.** Hand off work, draw on what's wrong,
review the pull request.

A desktop app for running AI coding agents on your projects, several at
once. Made for macOS; and others.

<p align="center">
  <img src="docs/conversation.png" alt="Ignite, an AI coding agent app: an agent that added dark mode pushes its commit and opens a GitHub pull request, its four changed files listed with their line counts, and one file's diff open beside the conversation" width="32%">
  <img src="docs/tasks.png" alt="The Tasks view: one task needs you, one runs on its own with an annotated screenshot attached, its subtasks checked off as it edits src/timer.ts, three are up next and three are done" width="32%">
  <img src="docs/markup.png" alt="Drawing on a screenshot of a timer app: a dashed ellipse around 25:00 and the note 'was 11:32!', with the markup toolbar's pen, highlighter, arrow, box, ellipse, text, colours and Add to new task" width="32%">
</p>
<p align="center">
  <img src="docs/questions.png" alt="The agent asking how people should sign in, in the composer: three options with their trade-offs and ⌥1 to ⌥3 shortcuts, a box to write your own answer, and Let the agent decide" width="32%">
  <img src="docs/subagents.png" alt="Two subagents checking a recipes API in parallel while npm run dev runs as a background command, its live output open in a tab beside the conversation" width="32%">
  <img src="docs/artifact.png" alt="The agent showing a screenshot of the timer app in dark mode and a live, clickable preview page of both colour palettes inside the conversation" width="32%">
</p>
<p align="center">
  <img src="docs/mcp.png" alt="Open GitHub issues fetched through the GitHub MCP server, shown as a table, and three of them proposed as tasks waiting for approval" width="32%">
  <img src="docs/settings.png" alt="Ignite settings on the Providers section, with Claude and ChatGPT connected through their subscriptions" width="32%">
</p>

## Features

### Run many agents

- **Parallel conversations.** Each works in its own git worktree, so agents
  never touch each other's work or yours. Its `node_modules`, builds and
  `.env` are copy-on-write clones, ready at once.
- **Tasks.** Write one, attach screenshots, start it. The agent plans,
  works on its own and brings back a pull request.
- **Subagents and background commands** run in parallel, their output a tab
  away.
- **Model Router** picks each conversation's model and effort from its first
  message.

### Review and steer

- **Pull requests** with every diff a click away. Comment on any line to send
  it to the agent. Your folder updates when it merges.
- **Draw on any image or page**, yours or the agent's, to show what you mean.
- **Questions.** On an open decision the agent asks, with options and their
  trade-offs.
- **Edit an earlier message** to rewind the conversation and its files, or
  `/fork` to try another path.

### Tools

- **Terminal** beside the conversation (⌘J). Agents read it, and shell code
  in a reply runs there in one click.
- **Chrome.** Agents test pages in a headless Chrome, or yours when a page
  needs your logins, and search the web.
- **Live pages and screenshots** right in the conversation.
- **⌘K** searches every conversation, file and project; **⌘P** opens a file;
  `/` and `@` for skills, files and terminals.

### Learns

- **Memory** of what earlier conversations did in a folder (imports
  [cmem](https://cmem.ai)).
- **Lessons** from its mistakes, enforced on later tool calls.

### Setup

- **Your subscriptions:** Claude and ChatGPT through your Claude Code and
  Codex sign-ins. API keys work too.
- **Sandboxed** commands ([below](#sandbox)), or full access and nothing asks.
- **One-click import** of skills and MCP servers from Claude Code, Codex,
  Cursor and Claude Desktop.
- **Any theme** from VS Code, VSCodium, Cursor or Windsurf.
- **From your phone:** Settings → Remote, then scan the QR code.

## Sandbox

In Auto mode, shell commands run without asking inside an OS sandbox
([sandbox-runtime](https://github.com/anthropics/sandbox-runtime): Seatbelt
on macOS, bubblewrap on Linux; on Windows every command asks unless you turn
on its alpha sandbox). Inside it, commands:

- write only in the project, its scratchpad and package caches
- can't read your credentials
- may only read from public websites (package registries and git hosts take
  any request)

A blocked command asks before running outside. Risky commands, edits outside
the project, MCP changes, commits and pushes always ask.

## Install

You need [Node.js](https://nodejs.org) 22.18 or newer.

```sh
git clone https://github.com/ker0olos/ignite.git && cd ignite
npm run setup
```

Ignite opens when setup finishes, and lives in `~/Applications` on macOS, your
app menu on Linux, or the Start Menu on Windows. It updates itself.

`npm run uninstall` removes
Ignite and keeps your conversations.

## Make it yours

Every component and function in Ignite is yours to change. Ask its agent to
rework any part of it to fit how you work: the message box, the sidebar, how
tools are approved, how the agent itself runs. Your changes survive every
update, and if one breaks something, Ignite still opens and tells you.

## Develop

`pnpm install`, then `pnpm run tauri dev`, which never updates itself and
ignores `~/.ignite/mods`. `pnpm run demo` opens two sample projects with
scripted conversations and tasks; no agent runs and nothing is saved.
