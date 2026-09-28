# ignition

A native macOS app for working with AI coding agents, with a small, quiet
interface that keeps you in charge.

<p align="center">
  <img src="docs/conversation.png" alt="Ignition showing an agent adding dark mode to a project: file edits as diffs, a test run, and a summary" width="900">
</p>

## You make the calls

<p align="center">
  <img src="docs/questions.png" alt="The agent asking how people should sign in, with three options and their trade-offs, one question of three" width="900">
</p>

The agent doesn't guess. When a task leaves something open, it stops and asks,
with a few options and what each one costs, and marks the one it would pick.
Pick one or several, write your own answer, add a note under your pick, or
leave it to the agent. Turn off **Ask before deciding** in Settings and it
works on its own instead.

## Features

- **Your subscriptions.** Claude runs through your own Claude Code sign-in and
  ChatGPT through your Codex CLI sign-in, so you use the plans you already pay
  for. API keys work too.
- **Sandboxed by default.** Commands can only write inside the project, can't
  read your credentials and only reach package registries and git hosts.
  Anything risky waits for your OK.
- **Several projects at once.** Agents keep working in the background, and the
  sidebar shows which ones are waiting for you.
- **Bring your MCP servers.** Import the ones you already use in Claude Code,
  Cursor, Codex or Claude Desktop in a click.
- **Shared memory.** Works with [cmem](https://cmem.ai), so the agent remembers
  what it learned about a project, including what other agents learned.
- **Your editor's theme.** Any theme installed in VS Code, VSCodium, Cursor or
  Windsurf.

<p align="center">
  <img src="docs/settings.png" alt="Ignition settings, with Claude and ChatGPT connected" width="900">
</p>

## Requirements

- macOS
- [Node.js](https://nodejs.org) 22.18 or newer
- [Rust](https://rustup.rs)
- Xcode Command Line Tools: `xcode-select --install`

## Install

```sh
git clone https://github.com/ker0olos/ignition.git
cd ignition
npm install
npm run setup
```

Ignition is now in `~/Applications`. The first start takes a few minutes. It
updates itself each time it opens, and goes back to the last working version
if an update fails to start.

## Make it yours

Ignition is yours to reshape. Want a different look, a feature it's missing,
or an agent that works your way? Just ask the agent and it makes the change.
Your changes survive every update, so you keep getting new features without
losing your own. And if a change ever breaks
something, Ignition still opens and lets you know.

## Develop

`npm install`, then `npm run tauri dev`. This never updates itself and ignores
`~/.ignition/mods`. `npm run demo` opens two sample projects: one with a
finished conversation, and one where the agent is waiting on your answers.
