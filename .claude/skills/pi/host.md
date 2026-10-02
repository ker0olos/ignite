# Hosting pi (1.0.0)

`CA` = `node_modules/@earendil-works/pi-coding-agent`.

## Two ways to drive pi

1. **RPC mode** — a child process speaking JSONL on stdin/stdout. Best for
   the agent loop itself. Entry: `node CA/dist/bundle/rpc-entry.js [flags]`
   (same as `pi --mode rpc`). No auth commands.
2. **SDK** — in-process in our own Node script: `ModelRuntime`,
   `createAgentSession`, `createAgentSessionRuntime`. Needed for login/logout.
   `runRpcMode(runtime)` lets our script speak the same RPC protocol while
   controlling auth, tools and inline extensions in code:
   `main(["--mode","rpc", …], { extensionFactories: [myExtension] })`.

Useful flags: `--offline`, `--no-session` / `--session <path|id>` /
`--session-dir`, `-c`, `--model provider/id[:thinking]`, `--thinking`,
`--tools a,b`, `--no-tools`, `--no-builtin-tools`, `-e ext`,
`--no-extensions`, `--no-skills`, `--no-context-files`, `--approve` /
`--no-approve` (project trust). Env: `PI_CODING_AGENT_DIR`, `PI_OFFLINE`,
`PI_TELEMETRY=0`, `PI_SKIP_VERSION_CHECK`.

Spawn with `cwd` = the project folder (it decides tool paths, session
folder, AGENTS.md and project resources). Closing stdin shuts pi down.

## Framing

- Strict JSONL split on `\n` only; strip a trailing `\r`. **No Node readline.**
- Stdout is protocol only; everything else (including extension console
  output) is redirected to stderr. Treat stderr as a log.
- Commands may carry `id`; responses echo it; events never have one.
- Response: `{id?, type:"response", command, success, data?|error?}`.
  Parse errors: `command:"parse"`.

## Commands (`CA/dist/modes/rpc/rpc-types.d.ts`)

| Command                                                                      | Payload → data                                                                                                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `prompt`                                                                     | `message, images?, streamingBehavior?: "steer"\|"followUp"` → none (accepted, not finished; fails while streaming unless `streamingBehavior`) |
| `steer` / `follow_up`                                                        | `message, images?`                                                                                                                            |
| `abort`, `clear_queue`                                                       | — / `{steering, followUp}`                                                                                                                    |
| `get_state`                                                                  | → `{model?, thinkingLevel, isStreaming, isCompacting, sessionFile?, sessionId, sessionName?, messageCount, …}`                                |
| `get_messages`, `get_entries {since?}`, `get_tree`                           | history                                                                                                                                       |
| `get_available_models`, `set_model {provider, modelId}`                      | only models whose provider has auth                                                                                                           |
| `set_thinking_level {level}`                                                 | `off\|minimal\|low\|medium\|high\|xhigh\|max`                                                                                                 |
| `compact {customInstructions?}`                                              | → `CompactionResult`                                                                                                                          |
| `bash {command, excludeFromContext?}`                                        | streams `bash_execution_update`                                                                                                               |
| `new_session`, `switch_session {sessionPath}`, `fork {entryId}`, `clone`     | session changes                                                                                                                               |
| `get_session_stats`                                                          | tokens, cost, context usage                                                                                                                   |
| `get_commands`, `set_session_name`, `export_html`, `get_last_assistant_text` | misc                                                                                                                                          |

## Events

`agent_start`, `agent_end {messages, willRetry}`, **`agent_settled`** (use as
"done"), `turn_start`, `turn_end`, `message_start {message}`,
`message_update {usage, assistantMessageEvent}` (**delta-only**),
`message_end {message}` (authoritative), `tool_execution_start {toolCallId, toolName, args}`,
`tool_execution_update {partialResult}` (accumulated: replace, don't append),
`tool_execution_end {result, isError}`, `queue_update`, `compaction_start/end`,
`auto_retry_start/end`, `entry_appended`, `session_info_changed`,
`thinking_level_changed`, `extension_error`.

`assistantMessageEvent.type`: `text_start|text_delta|text_end`,
`thinking_start|thinking_delta|thinking_end`, `toolcall_start {id, toolName}`,
`toolcall_delta`, `toolcall_end`, `done`, `error`.

LLM errors surface as an assistant message with `stopReason: "error" | "aborted"`
and `errorMessage`.

## Extension UI dialogs over RPC

pi asks the host only when an extension calls `ctx.ui.*`:
`{type:"extension_ui_request", id, method, …}` with `select`, `confirm`,
`input`, `editor` (blocking) or `notify`, `setStatus`, `setWidget`,
`setTitle`, `set_editor_text` (fire-and-forget). Answer with
`{type:"extension_ui_response", id, value | confirmed | cancelled:true}`.
Dialogs with `timeout` auto-resolve to their default.

## Packaging the sidecar

`CA/dist/bundle/` is nearly self-contained (~8 MB). Also needs
`@earendil-works/chord` (static import) and optionally `photon-node` (image
resize, falls back if missing). Needs a Node >= 22.19 runtime. For now the
app runs in dev mode and uses the system `node`; a GUI app's PATH may not
include it, so resolve node explicitly.

`RpcClient` (exported) is a Node-only reference client; it spawns bare `node`
with a relative default `cliPath`: pass an absolute one.

## Network

In RPC mode the only startup call is the model catalog refresh from pi.dev
(15 s timeout); `--offline` / `PI_OFFLINE` skips it. Version check and
install telemetry only run in interactive mode. `PI_OFFLINE` disables the
catalog even when set to `"0"`.
