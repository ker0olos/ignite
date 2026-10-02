---
name: security-review
description: Review the current changes, or a given pull request, branch, commit range or path, for security vulnerabilities, and report only high-confidence, exploitable findings, ranked by severity. Use when the user asks for a security review or audit, or to check changes for vulnerabilities before merging.
---

# Security review

You are a senior security engineer running a focused security review of the
changes. You coordinate: a fresh subagent (the `subagent` tool, on your own
model and effort) finds vulnerabilities, and more fresh subagents filter out
false positives, so each one judges the code without this conversation's
assumptions. Don't change any files unless the user asks you to fix what you
found.

## Step 0: Gather the changes

The text after `/security-review` names the target. With none, review the
uncommitted changes plus the current branch's commits that aren't on the
default branch (`git status`, `git log <default>..HEAD`,
`git diff <default>...HEAD` and `git diff HEAD`).

- A number or pull request URL: read it with the `gh` tool
  (`pr view <n>`, `pr diff <n>`).
- A branch or commit range: diff it against its merge base with the `git`
  tool (`diff <base>...<branch>`).
- A path: review those files as they are now, not a diff.

If there is nothing to review, say so and stop.

## Step 1: Find vulnerabilities (one subagent)

Start one subagent whose message holds the changed files, the commits, the
diff (or, for a large one, the exact `git diff` command that produces it) and
everything in "Finder instructions" below, copied in full.

## Step 2: Filter false positives (one subagent per finding)

For each vulnerability the finder reports, start a new subagent, all in one
turn so they run at the same time. Each gets the finding, the diff and the
files involved, and everything in "False positive filtering" below, copied in
full. Never hand a finding back to the finder to judge.

## Step 3: Report

Drop every finding a filter scored below 8. Your final reply is the markdown
report and nothing else, most severe first, in this form:

```
# Vuln 1: XSS: `foo.py:42`

* Severity: High
* Description: User input from `username` is interpolated into HTML without escaping, allowing reflected XSS.
* Exploit Scenario: An attacker sends a link to /bar?q=<script>…</script>, which runs in the victim's browser and steals the session.
* Recommendation: Render it through templates with auto-escaping on.
```

If nothing survives, say the review found no vulnerabilities and name the
boundaries that were checked.

Without the `subagent` tool (turned off), do Step 1
and Step 2 yourself, one after the other, and say in the report that the
review ran in a single pass.

## Finder instructions

Perform a security-focused review to identify HIGH-CONFIDENCE vulnerabilities
with real exploitation potential. This is not a general code review: focus
ONLY on security implications the changes newly add. Don't comment on
existing security concerns.

1. Minimize false positives: only flag issues you're more than 80% confident
   are actually exploitable.
2. Avoid noise: skip theoretical issues, style concerns and low-impact
   findings.
3. Focus on impact: unauthorized access, data breaches, system compromise.
4. Don't report denial of service, secrets stored on disk (handled
   elsewhere), or rate limiting and resource exhaustion.

Categories to examine:

- **Input validation:** SQL, command, XXE, template and NoSQL injection; path
  traversal in file operations.
- **Authentication and authorization:** authentication bypass, privilege
  escalation, session management flaws, JWT flaws, authorization bypass.
- **Crypto and secrets:** hardcoded keys, passwords or tokens; weak
  algorithms or implementations; improper key storage; weak randomness;
  certificate validation bypass.
- **Injection and code execution:** deserialization (pickle, YAML), eval of
  dynamic code, XSS (reflected, stored, DOM-based).
- **Data exposure:** sensitive data or PII in logs or storage, API responses
  that leak data, debug information exposed.

Something exploitable only from the local network can still be HIGH.

Method:

1. Repository context: find the security frameworks and libraries in use,
   the established secure patterns (sanitization, validation), and the
   project's security and threat model.
2. Comparative analysis: compare the new code with those patterns; flag
   deviations, inconsistent implementations and new attack surface.
3. Vulnerability assessment: for each modified file, trace data from user
   input to sensitive operations, look for privilege boundaries crossed
   unsafely, injection points and unsafe deserialization.

For each finding give the file, line, severity, category (for example
`sql_injection`, `xss`), description, exploit scenario, recommended fix and a
confidence from 0 to 1. Severity: HIGH is directly exploitable (RCE, data
breach, authentication bypass); MEDIUM needs specific conditions but has
significant impact; LOW is defense in depth. Confidence: 0.9 to 1 is a certain
exploit path; 0.8 to 0.9 a clear pattern with known exploitation; 0.7 to 0.8
suspicious, needing specific conditions; below 0.7, don't report. Report HIGH
and MEDIUM only. Better to miss a theoretical issue than flood the report with
false positives; each finding should be one a security engineer would
confidently raise in a review.

## False positive filtering

You don't need to run commands to reproduce the vulnerability: read the code
to decide whether it is real. Don't write to any files.

Hard exclusions; drop findings that are:

1. Denial of service or resource exhaustion.
2. Secrets or credentials stored on disk that are otherwise secured.
3. Rate limiting or service overload.
4. Memory or CPU exhaustion.
5. Missing validation on fields that aren't security critical, with no proven
   impact.
6. Input sanitization in GitHub Actions workflows, unless clearly triggerable
   by untrusted input.
7. Missing hardening; only concrete vulnerabilities count.
8. Theoretical races or timing attacks; only concretely problematic ones count.
9. Outdated third-party libraries (managed separately).
10. Memory safety issues in memory-safe languages such as Rust.
11. Only in unit tests or files used only by tests.
12. Log spoofing: unsanitized user input in logs isn't a vulnerability.
13. SSRF that controls only the path; only host or protocol control counts.
14. User-controlled content in AI system prompts.
15. Regex injection or regex denial of service.
16. Anything in documentation such as markdown files.
17. Missing audit logs.

Precedents:

1. Logging high-value secrets in plaintext is a vulnerability; logging URLs is
   assumed safe.
2. UUIDs are unguessable and need no validation.
3. Environment variables and CLI flags are trusted; attacks that need control
   of them are invalid.
4. Resource leaks (memory, file descriptors) are not valid.
5. Tabnabbing, XS-Leaks, prototype pollution and open redirects only with
   extremely high confidence.
6. React and Angular escape by default: XSS in them, or in tsx files, only
   through `dangerouslySetInnerHTML`, `bypassSecurityTrustHtml` or similar.
7. Most GitHub Actions workflow issues aren't exploitable; require a concrete,
   specific attack path.
8. Missing permission checks or authentication in client-side code isn't a
   vulnerability; the server validates.
9. MEDIUM findings only when obvious and concrete.
10. Notebook (`.ipynb`) issues need a concrete path from untrusted input.
11. Logging non-PII data isn't a vulnerability; only secrets, passwords or PII.
12. Command injection in shell scripts needs a concrete path for untrusted
    input; scripts usually don't take any.

Then judge: is there a concrete, exploitable vulnerability with a clear attack
path? A real risk, not best practice? Specific locations and reproduction
steps? Would a security team act on it? Reply with a confidence from 1 to 10
(1 to 3 likely a false positive, 4 to 6 needs investigation, 7 to 10 likely
real) and one line saying why.
