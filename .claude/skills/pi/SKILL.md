---
name: pi
description: How this app embeds and drives the pi coding agent (@earendil-works/pi-coding-agent 0.87.x) — auth and provider login (Claude Pro/Max, ChatGPT/Codex, API keys) via ModelRuntime, running pi as a Node sidecar over RPC, sessions, events, tools, permissions and project trust. Use before writing or reviewing any code that talks to pi, adds agent features, or touches provider credentials.
---

# pi in this app

pi is the agent this app is a harness for. It runs as a **Node sidecar**: the
web view can't host it (OAuth logins need `node:http`, tools need a real
filesystem and shell). The app talks to the sidecar; the sidecar uses pi.

## Package facts

- Package: `@earendil-works/pi-coding-agent` **0.87.1** (pinned). The old
  `@mariozechner/pi-coding-agent` is deprecated; its docs (and most blog posts
  and community skills) describe a different API. Don't copy from them.
- Repo: github.com/earendil-works/pi · docs: pi.dev/docs/latest
- Node **>= 22.19**. ESM only. Nested deps (`pi-ai`, `pi-agent-core`, `pi-tui`,
  `chord`) live in `node_modules/@earendil-works/pi-coding-agent/node_modules/`.
- Exports: `"."` (SDK) and `"./rpc-entry"` (`pi --mode rpc` launcher). Deep
  imports are blocked.
- **Source of truth**, in this order: the shipped `.d.ts` files, the bundled
  `docs/`, then `CHANGELOG.md`. Docs drift from code; when they disagree,
  trust the `.d.ts`.

## Layers

| Package           | Provides                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pi-ai`           | Providers, model catalog, streaming, **auth** (`ProviderAuth`, OAuth flows, `CredentialStore`)                                                                |
| `pi-agent-core`   | Bare agent loop: tools, turns, events. No files, sessions or auth storage                                                                                     |
| `pi-coding-agent` | Built-in tools, `AgentSession`, sessions (JSONL tree), compaction, `ModelRuntime`, resource loading (AGENTS.md, skills, extensions), RPC/print/json/TUI modes |

## References (read the one you need)

- [auth.md](auth.md) — `ModelRuntime`, login/logout, `AuthInteraction`, the
  Claude and Codex OAuth flows, API keys, `auth.json`, and why Claude
  subscriptions go through Claude Code (`pi-claude-bridge`).
- [host.md](host.md) — running pi as a sidecar: RPC framing, commands,
  events, extension UI dialogs, the SDK alternative, packaging, network.
- [sessions.md](sessions.md) — sessions, agent dir, tools, permissions,
  project trust, context files, compaction.

## Traps (each has bitten someone)

1. **`AuthStorage` / `ModelRegistry.create` are gone** (0.80.8). Use
   `ModelRuntime`; pass it to `createAgentSession({ modelRuntime })`.
2. **No auth over RPC.** Login/logout must go through the SDK
   (`ModelRuntime.login`) in our own Node code, not the `pi --mode rpc` protocol.
3. **One credential per provider.** A Claude subscription login and an
   Anthropic API key both use the `anthropic` slot and replace each other.
4. **Codex has no API-key auth.** `openai-codex` is subscription-only; an
   OpenAI API key belongs to the separate `openai` provider (different models).
5. **The host opens the browser.** OAuth flows only emit an `auth_url` event.
6. **RPC framing is LF-only JSONL.** Never Node `readline` (splits on
   U+2028/2029). Stdout is protocol only; stderr is logs.
7. **`message_update` is delta-only** (0.84). Rebuild the message from deltas,
   then replace it with `message_end.message`. "Done" is `agent_settled`.
8. **`prompt` success means "accepted"**, not finished. Errors arrive as events.
9. **No permission prompts in pi.** Gate tools with an extension `tool_call`
   handler; don't overwrite `agent.beforeToolCall`.
10. **API key strings are interpreted.** `!cmd` runs a shell command; `$VAR` /
    `${VAR}` interpolate. Store user-typed keys so they stay literal.
11. **The `tools` option is a name allowlist** (`string[]`), not tool objects,
    whatever older examples show.
