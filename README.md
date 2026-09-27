# ignition

A native macOS app for working with AI coding agents.

<p align="center">
  <img src="docs/conversation.png" alt="Ignition showing an agent adding dark mode to a project: file edits as diffs, a test run, and a summary" width="900">
</p>

Open a folder, describe a task, and watch the agent work: every file it reads,
every change it makes and every command it runs shows up in the conversation
as it happens.

- **Your subscriptions.** Sign in with Claude or ChatGPT, or use an API key.
- **You decide what runs.** In Auto, commands run in a sandbox that keeps them
  inside the project, and anything risky waits for your OK. In Manual, you
  approve every step.
- **Your tools.** Add MCP servers in a click, or import the ones you already
  use in Claude Code, Cursor, Codex or Claude Desktop.
- **Memory.** Works with [cmem](https://cmem.ai), so the agent remembers what
  it learned about a project, across sessions and other agents.
- **Feels at home on a Mac.** Your editor's color theme, a file tree and viewer,
  multiple windows.

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

Updates skip a clone with local edits or commits, so rather than editing it,
copy the file you want to change into `~/.ignition/mods` at the same path and
edit the copy there, or ask the agent to. Updates never touch your copies. If Ignition fails to start with
them, it starts without them and tells you.

## Develop

`npm install`, then `npm run tauri dev`. This never updates itself and ignores `~/.ignition/mods`. `npm run demo` opens a sample
project with a finished conversation.
