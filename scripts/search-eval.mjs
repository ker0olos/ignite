#!/usr/bin/env node
// Asks the agent questions about this repo through the real sidecar and scores
// whether its answer names the right files. `node scripts/search-eval.mjs [label] [count]`
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const root = join(import.meta.dirname, "..");
const label = process.argv[2] ?? "run";
const questions = JSON.parse(
  readFileSync(join(import.meta.dirname, "search-eval.json"), "utf8"),
).slice(0, Number(process.argv[3] ?? Infinity));
const TIMEOUT_MS = Number(process.env.EVAL_TIMEOUT_MS ?? 5 * 60_000);

const sidecar = spawn("node", ["sidecar/main.ts"], {
  cwd: root,
  stdio: ["pipe", "pipe", "inherit"],
});
// A Mac asleep mid-run stalls every request; keep it awake while the sidecar lives.
if (process.platform === "darwin") {
  spawn("caffeinate", ["-i", "-w", String(sidecar.pid)], { stdio: "ignore" });
}
const pending = new Map();
const listeners = new Set();
let nextId = 1;
const send = (msg) => sidecar.stdin.write(`${JSON.stringify(msg)}\n`);
const request = (msg) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    send({ ...msg, id });
  });
const ready = new Promise((resolve) =>
  listeners.add((msg) => msg.type === "ready" && resolve()),
);
createInterface({ input: sidecar.stdout }).on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.type === "response") {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.ok) p?.resolve(msg.data);
    else p?.reject(new Error(msg.error));
  } else if (msg.type === "approval_request") {
    // Read-only eval: nothing that needs the user runs.
    send({
      type: "approval_answer",
      toolCallId: msg.request.toolCallId,
      approved: false,
    });
  }
  for (const l of listeners) l(msg);
});

/** Tool calls a subagent made, from its call's details. */
const innerCalls = (details) =>
  (details?.messages ?? [])
    .filter((m) => m.role === "assistant")
    .flatMap((m) => m.content.filter((b) => b.type === "toolCall"))
    .map((b) => b.name);

/** The assistant's tokens, cost and latest text, added to `r`. */
function addReply(r, message) {
  const u = message.usage;
  r.tokens += u?.totalTokens ?? 0;
  r.cost += u?.cost?.total ?? 0;
  const text = message.content.filter((b) => b.type === "text");
  if (text.length) r.answer = text.map((b) => b.text).join("\n");
}

/** One session event's turns, tool calls and replies, added to `r`. */
function record(r, e) {
  const count = (name) => (r.tools[name] = (r.tools[name] ?? 0) + 1);
  if (e.type === "turn_end") r.turns++;
  if (e.type === "tool_execution_start") count(e.toolName);
  if (e.type !== "message_end") return;
  if (e.message.role === "assistant") addReply(r, e.message);
  for (const name of innerCalls(e.message.details)) count(`sub:${name}`);
}

async function ask({ q, expect }) {
  const started = Date.now();
  const { session } = await request({ type: "new_session", cwd: root });
  const r = { q, turns: 0, tools: {}, tokens: 0, cost: 0, answer: "" };
  const done = new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      listeners.delete(on);
      resolve();
    };
    // A stalled provider can ignore the abort; close_session ends it anyway.
    const timer = setTimeout(() => {
      r.timedOut = true;
      request({ type: "abort", session }).catch(() => {});
      setTimeout(finish, 10_000);
    }, TIMEOUT_MS);
    const on = (msg) => {
      if (msg.session !== session) return;
      if (msg.type === "session_error") r.error = msg.error;
      if (msg.event) record(r, msg.event);
      if (
        (msg.event?.type === "agent_end" && !msg.event.willRetry) ||
        r.error
      ) {
        finish();
      }
    };
    listeners.add(on);
  });
  await request({
    type: "prompt",
    session,
    text: `${q}\n\nAnswer with the file paths (and lines) that show it.`,
  });
  await done;
  await request({ type: "close_session", cwd: root, session });
  r.seconds = Math.round((Date.now() - started) / 1000);
  r.missing = expect.filter((path) => !r.answer.includes(path));
  return r;
}

await ready;
const results = [];
for (const [i, question] of questions.entries()) {
  const r = await ask(question);
  results.push(r);
  const calls = Object.values(r.tools).reduce((a, b) => a + b, 0);
  console.log(
    `${i + 1}/${questions.length} ${r.missing.length ? "MISS" : "ok  "} ` +
      `${r.seconds}s ${r.turns} turns ${calls} calls ${r.tokens} tokens` +
      (r.missing.length ? `  missing ${r.missing.join(", ")}` : "") +
      (r.error ? `  error ${r.error}` : ""),
  );
}
sidecar.stdin.end();

const sum = (f) => results.reduce((a, r) => a + f(r), 0);
const out = join(tmpdir(), `ignite-search-eval-${label}.json`);
writeFileSync(out, JSON.stringify(results, null, 2));
console.log(
  `\n${label}: ${sum((r) => (r.missing.length ? 0 : 1))}/${results.length} found, ` +
    `${sum((r) => r.seconds)}s, ${sum((r) => r.turns)} turns, ` +
    `${sum((r) => r.tokens)} tokens, $${sum((r) => r.cost).toFixed(2)}\n` +
    `Details: ${out}`,
);
