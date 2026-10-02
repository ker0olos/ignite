---
name: code-review
description: Review the current changes, or a given pull request, branch, commit range or path, for correctness bugs, and report only the findings that hold up, ranked by severity. Use when the user asks for a code review, to check a diff, or to look for bugs before merging.
---

# Code review

Review code for bugs a careful senior engineer would block a merge on. The
goal is a short list of real problems, not a long list of opinions.

## 1. Find what to review

The text after `/code-review` names the target. With none, review the
uncommitted changes plus the current branch's commits that aren't on the
default branch.

- A number or pull request URL: read it with the `gh` tool
  (`pr view <n>`, `pr diff <n>`).
- A branch or commit range: diff it against its merge base with the `git`
  tool (`diff <base>...<branch>`).
- A path: review those files as they are now, not a diff.

If there is nothing to review, say so and stop.

## 2. Read for understanding first

For each changed file, read enough around the diff to know what the code is
meant to do: the whole changed function, its callers, the types it uses, and
the tests that cover it. A diff read in isolation produces false alarms.

## 3. Look for defects

Focus on what makes the program wrong:

- Logic errors: inverted conditions, off-by-one, wrong operator, missed case.
- State: stale values, races, ordering assumptions, missing cleanup, leaks.
- Edge inputs: empty, null or undefined, zero, very large, unicode, concurrent calls.
- Errors: swallowed failures, wrong fallbacks, a failure path that loses data.
- Contracts: a changed signature or behaviour whose callers weren't updated.
- Security at trust boundaries: injection, path traversal, unchecked input,
  secrets in logs or output.
- Tests that don't test what they claim to, or that pass for the wrong reason.

Skip style, naming and formatting unless they hide a bug. Mention a clear
simplification or reuse of existing code only when it is significant.

## 4. Verify every finding

Before reporting a finding, try to prove it wrong. Trace the real code path,
check that a guard elsewhere doesn't already handle it, and where it's cheap,
confirm it by running the code or a test. Keep a finding only if you can state
a concrete input or state that leads to wrong output, a crash, or data loss.
Mark one you believe but couldn't fully confirm as "plausible".

## 5. Report

List the findings, most severe first. For each one:

- **file:line**: one sentence naming the defect.
- How it fails: the concrete input or state and what goes wrong.
- The fix, in a sentence or a few lines of code.

If nothing survives verification, say the review found no bugs and name what
you checked. Don't pad the report, and don't change any files unless the user
asks you to fix what you found.
