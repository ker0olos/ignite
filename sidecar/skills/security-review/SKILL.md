---
name: security-review
description: Review the current changes, or a given pull request, branch, commit range or path, for security vulnerabilities, and report only exploitable findings, ranked by severity. Use when the user asks for a security review or audit, or to check changes for vulnerabilities before merging.
---

# Security review

Find vulnerabilities an attacker could actually use. The goal is a short list
of exploitable problems, not a checklist of best practices.

## 1. Find what to review

The text after `/security-review` names the target. With none, review the
uncommitted changes plus the current branch's commits that aren't on the
default branch.

- A number or pull request URL: read it with the `gh` tool
  (`pr view <n>`, `pr diff <n>`).
- A branch or commit range: diff it against its merge base with the `git`
  tool (`diff <base>...<branch>`).
- A path: review those files as they are now, not a diff.

If there is nothing to review, say so and stop.

## 2. Map where untrusted input comes in

Before judging the diff, learn the code's trust boundaries: who can call it
(anyone on the network, a signed-in user, an admin, only local code), where
outside data enters (requests, files, environment, other processes, model
output), and what it can reach (shell, database, filesystem, network,
secrets). Follow each changed path from input to where it is used.

## 3. Look for vulnerabilities

- Injection: shell commands, SQL, template, HTML/JS (XSS), path traversal,
  unsafe deserialization, building code or queries from strings.
- Access: missing or bypassable authentication or authorization checks, one
  user reaching another's data (IDOR), privilege escalation.
- Secrets: credentials in code, logs, errors, URLs or client bundles; tokens
  that never expire or are compared unsafely.
- Crypto: home-made schemes, weak or misused algorithms, predictable
  randomness where it must be secret.
- Network: SSRF, open redirects, CORS that trusts any origin, TLS checks off.
- Files and processes: writing outside an intended folder, following
  symlinks, unsafe temporary files, running programs with input-controlled
  arguments.
- Dependencies: a new package that is unmaintained, typo-squatted, or pulls
  in code that runs on install.

Skip denial of service through resource exhaustion, missing rate limits,
generic hardening advice and theoretical issues with no path from input.

## 4. Verify every finding

Before reporting a finding, try to prove it wrong. Trace the input from where
an attacker controls it to where it does harm, and check that no validation,
escaping, framework default or permission check stops it on the way. Keep a
finding only if you can describe the attacker, the input they send and what
they gain. Mark one you believe but couldn't fully confirm as "plausible".

## 5. Report

List the findings, most severe first, each rated high, medium or low:

- **file:line**: one sentence naming the vulnerability.
- Exploit: who the attacker is, what they send, and what they get.
- The fix, in a sentence or a few lines of code.

If nothing survives verification, say the review found no vulnerabilities and
name the boundaries you checked. Don't pad the report, and don't change any
files unless the user asks you to fix what you found.
