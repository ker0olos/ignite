import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  forgetWaiting,
  markWaiting,
  readWaiting,
  unmarkWaiting,
} from "./waitingCalls.ts";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "waiting-"));
  process.env.PI_CODING_AGENT_DIR = dir;
});
afterEach(() => {
  delete process.env.PI_CODING_AGENT_DIR;
  rmSync(dir, { recursive: true, force: true });
});

it("keeps each conversation's waiting calls until they settle", () => {
  markWaiting("a", "t1", "before");
  markWaiting("a", "t2", "ran");
  markWaiting("b", "t3", "asking");
  expect(readWaiting("a")).toEqual({ t1: "before", t2: "ran" });
  unmarkWaiting("a", "t1");
  unmarkWaiting("a", "gone");
  expect(readWaiting("a")).toEqual({ t2: "ran" });
  unmarkWaiting("a", "t2");
  expect(readWaiting("a")).toEqual({});
  forgetWaiting("b");
  expect(readWaiting("b")).toEqual({});
});

it("reads a missing or damaged file as nothing waiting", () => {
  expect(readWaiting("none")).toEqual({});
  mkdirSync(join(dir, "waiting"));
  writeFileSync(join(dir, "waiting", "bad.json"), "{");
  expect(readWaiting("bad")).toEqual({});
});
