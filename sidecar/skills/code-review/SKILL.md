---
name: code-review
description: Review the current changes, or a given pull request, branch, commit range or path, for correctness bugs, and report only the findings that hold up, ranked by severity. Takes an optional level first (low, medium or high; medium by default). Use when the user asks for a code review, to check a diff, or to look for bugs before merging.
---

# Code review

Review code for bugs a careful senior engineer would block a merge on. The
goal is a short list of real problems, not a long list of opinions.

You coordinate the review. Fresh subagents (the `subagent` tool, on your own
model and effort) find candidates and check them, so each one judges the code
without this conversation's assumptions. Start them without `explore`, which
has no git and runs on a cheaper model, and leave out `model` and `effort` so
they use yours. Give each a `description` like "Find: line by line" or
"Verify: promptCache.ts:86". Don't change any files unless the user asks you
to fix what you found.

## Level

The first word after `/code-review` may be a level; the rest names the target.

| Level            | Recipe                                                                |
| ---------------- | --------------------------------------------------------------------- |
| low              | one careful pass yourself, no subagents → at most 4 findings          |
| medium (default) | finders → one verifier per candidate → at most 8 findings             |
| high             | finders → recall-biased verify → sweep for gaps → at most 12 findings |

Without the `subagent` tool (turned off), do every
angle below yourself, in this context, one after another, then check each
candidate against the code before keeping it. Say in the report that the
review ran in a single pass.

## Phase 0: Gather the diff

With no target, review the uncommitted changes plus the current branch's
commits that aren't on the default branch (`git diff <default>...HEAD` and
`git diff HEAD`).

- A number or pull request URL: read it with the `gh` tool
  (`pr view <n>`, `pr diff <n>`).
- A branch or commit range: diff it against its merge base with the `git`
  tool (`diff <base>...<branch>`).
- A path: review those files as they are now, not a diff.

If there is nothing to review, say so and stop.

## Phase 1: Find candidates

Start the finders in one turn, so they run at the same time: between 2 and 6
depending on the diff's size, splitting the angles below among them. A small
diff can give one finder several angles.

Each finder's message must stand alone, since it can't see this conversation:
the diff (or, for a large one, the exact `git diff` command that produces it
and the changed files), its angles copied in full from below, and this
instruction: "Read every hunk and the whole function around it. Return up to
6 candidates (8 at high), each with `file`, `line`, a one-line summary and a
concrete failure scenario: the input or state, and the wrong output, crash or
data loss it leads to. Don't pad; return none if you find none."

- **A. Line by line.** Read every hunk and its enclosing function; bugs in
  unchanged lines of a touched function count. For every line ask what input,
  state, timing or platform makes it wrong: inverted or wrong conditions,
  off-by-one, null or undefined, missing `await`, falsy zero, copy-paste with
  the wrong variable, an error swallowed in a catch, unescaped regex.
- **B. Removed behaviour.** For every line the diff deletes or replaces, name
  the invariant it enforced and find where the new code enforces it. If
  nowhere, that's a candidate: a removed guard, a dropped error path, a
  narrowed validation, a deleted test that covered a real case.
- **C. Across files.** For each changed function, grep its callers and check
  each call site against a new precondition, return shape, exception, or
  ordering. Check callees too: does another change in the diff make a call
  unsafe?
- **D. Language pitfalls.** The classic traps of the diff's language and
  framework: `==` coercion, closures capturing loop variables, React effects
  and stale state, mutable defaults, SQL or shell injection, path traversal,
  time zones, float equality.
- **E. State and failure.** Races, ordering assumptions, missing cleanup,
  leaks, retries, partial failure that loses data, secrets in logs or output.
  For a wrapper, cache or proxy: every method must reach the wrapped object,
  not loop back through a registry.
- **F. Tests.** Tests that don't test what they claim, pass for the wrong
  reason, or no longer cover a branch the diff changed.

## Phase 2: Verify

Merge candidates that point at the same line and mechanism, keeping the one
with the most concrete failure scenario. Then give each remaining candidate
to one verifier, a new subagent, all in one turn so they run at the same
time. Never hand a candidate back to a finder to judge.

The verifier gets the diff, the files involved and the candidate, and returns
exactly one of:

- **CONFIRMED**: it can name the input or state that triggers it and the wrong
  output or crash. Quote the line.
- **PLAUSIBLE**: the mechanism is real, the trigger is uncertain (timing,
  environment, configuration). State what would confirm it.
- **REFUTED**: factually wrong (the code doesn't say that), provably impossible
  (a type, constant or invariant rules it out), or already guarded. Quote the
  line that proves it.

At high, add: "PLAUSIBLE by default. Don't refute a candidate as speculative
when the state is realistic: a race, null on a rare but reachable path, a
falsy zero, an unexcluded boundary, a partial failure, a pattern that lost an
anchor."

Keep CONFIRMED and PLAUSIBLE; drop REFUTED.

## Phase 3: Sweep for gaps (high only)

One more new finder gets the diff and the verified
list, and looks only for defects not on it: code moved or extracted that
dropped a guard, setup and teardown that don't match in tests, flipped
defaults, a lock or scope that shrank. Up to 8 more candidates, verified as in
Phase 2.

## Report

List the findings, most severe first, within the level's cap. For each one:

- **file:line**: one sentence naming the defect. Mark it "plausible" when
  that was the verdict.
- How it fails: the concrete input or state and what goes wrong.
- The fix, in a sentence or a few lines of code.

If nothing survived, say the review found no bugs and name what was checked.
Don't pad the report.
