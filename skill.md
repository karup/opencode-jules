---
name: jules
description: Delegates any coding task to Jules (Google's AI coding agent) to work asynchronously in the background. Use when the user says /jules, or asks to delegate work, send to Jules, background task, review PR, implement feature, fix bug via Jules. Determines whether the task is a review or feature and configures the session accordingly.
---

# Jules — Background AI Coding Agent

Delegates work to Jules (Google's AI coding agent) via REST API. Jules works **asynchronously** — creates its own branch, implements changes or reviews code, and creates a PR with results. Use `/jules` for any coding task you want done in the background.

## When to use /jules

- Reviewing a PR or branch ("/jules review PR 42")
- Implementing a feature ("/jules implement #23")
- Fixing a bug ("/jules fix the login redirect bug")
- Any coding task where async background work is acceptable

For **PR reviews**, Jules creates a review PR with audit findings.
For **feature/bug work**, Jules implements changes and creates a feature PR.

## Workflow

### Step 1 — Gather context

**If the user references a PR:** `gh pr view <number>` to get the branch, title, and description.

**If the user references an issue:** `gh issue view <number>` to get the full description and acceptance criteria.

**If the user describes the task directly:** capture the instructions verbatim and add any known technical context.

**If unsure what branch the task is about:** ask the user.

### Step 2 — Determine mode

**Review mode** — use when the user says "review", "audit", "check", "PR", or references a branch to review.

**Feature mode** — use when the user says "implement", "fix", "build", "add", "create", or references an issue number.

### Step 3 — Build the prompt

**For reviews:**

```
Review the code in <branch> against the default/base branch. Check for:
- Bugs and logic errors
- Security vulnerabilities (token/auth handling, input validation)
- Missing tests or test coverage gaps
- Missing type safety or incorrect types
- Violations of project conventions and style guides
- Duplicate or extractable code
- Concurrency issues (race conditions, missing guards)
- Missing error handling

Be thorough and specific. Include file paths and line numbers in findings.
```

**For features:**

```
Implement the following feature:

<full issue description or user instructions>

Follow the project's conventions for code style, testing, and branch naming.
Include tests where appropriate.
```

### Step 4 — Discover the source

If this is the first call: use `jules_list_sources` to find available repos.

If `JULES_SOURCE` env var is set, use it directly. Otherwise, find the matching source from the list.

### Step 5 — Call `jules_create`

```json
{
  "prompt": "<constructed prompt from step 3>",
  "source": "<source name from step 4>",
  "branch": "<default branch or master>",
  "title": "<short descriptive title>",
  "automationMode": "AUTO_CREATE_PR"
}
```

### Step 6 — Report to user

Report the session ID:

```
Jules session <sessionId> started — <title>.
Check progress anytime by asking — no special command needed.
```

### Step 7 — Follow-up

When user asks for status: `jules_status({ sessionId })`. Report progress, completion state, and PR URL.

When user asks to list active sessions: `jules_list({ pageSize: 10 })`. Show a table with titles and PR URLs.

## Examples

```
/jules review PR 42
→ Jules reviewing feat/login-fix. Session: 12345...

/jules implement #23
→ Reads issue 23, builds prompt, starts Jules session.

/jules fix the login redirect bug
→ Builds prompt with bug details, starts Jules session.

/jules how is session 12345 doing?
→ Step 4/7: Analyzing auth service... No PR yet.

/jules what sessions are running?
→ 3 active sessions: review 42 (PR #43), fix login (working)...
```
