---
name: opencode-jules
description: Delegates any coding task to Jules (Google's AI coding agent) to work asynchronously in the background. Use when the user says /opencode-jules, or asks to delegate work, send to Jules, background task, review PR, implement feature, fix bug via Jules. Determines whether the task is a review or feature and configures the session accordingly.
---

# Jules — Background AI Coding Agent

Delegates work to Jules (Google's AI coding agent) via REST API. Jules works **asynchronously** — creates its own branch, implements changes or reviews code, and creates a PR with results. Use `/opencode-jules` for any coding task you want done in the background.

## When to use /opencode-jules

- Reviewing a PR or branch ("/opencode-jules review PR 42")
- Implementing a feature ("/opencode-jules implement #23")
- Fixing a bug ("/opencode-jules fix the login redirect bug")
- Any coding task where async background work is acceptable

For **PR reviews**, Jules creates a review PR with audit findings.
For **feature/bug work**, Jules implements changes and creates a feature PR.

## Help & Setup

When the user says any of these patterns, respond with the matching section below — do NOT start a Jules session:

- `/opencode-jules help` or `/opencode-jules` (with no task) → general help
- `/opencode-jules help setup` or `/opencode-jules setup` → setup guide
- `/opencode-jules help commands` or `/opencode-jules commands` → full command list

### General help

Respond with:

```
Jules is Google's AI coding agent that works asynchronously on GitHub repos —
reviewing PRs, implementing features, and fixing bugs. Create a session,
walk away, get a PR when it's done.

Available tools:
  jules_create          → Start a new task
  jules_status          → Check progress
  jules_list            → List all sessions
  jules_delete          → Cancel a session
  jules_message         → Send feedback to active session
  jules_approve         → Approve a pending plan
  jules_activity        → Get code changes / artifacts
  jules_list_sources    → List available repos
  jules_get_source      → Get repo details + branches

Try /opencode-jules help setup to get started.
Try /opencode-jules help commands for detailed usage.
```

### Setup guide

Respond with:

```
1. Get an API key: https://jules.google.com/settings/api
2. Create .env in your project root:
     cp .opencode/node_modules/opencode-jules/.env.example .env
     # Edit .env and set JULES_API_KEY=your-key
   (Or just run: export JULES_API_KEY="your-key")
3. Add the plugin to opencode.json:
     { "plugin": ["opencode-jules"] }
4. If the /opencode-jules skill doesn't appear after restart, add:
     { "skills": { "paths": [".opencode/node_modules/opencode-jules/skills"] } }
5. Restart opencode.
6. Run /opencode-jules list sources → to see connected repos.
7. (Optional) Set JULES_SOURCE in .env as your default repo.
Ready! Try /opencode-jules implement a simple test to verify.
```

### Full command list

Respond with:

| Tool | Args | Description |
|------|------|-------------|
| jules_create | prompt, source*, branch, title, automationMode, requirePlanApproval | Start a new task (*required) |
| jules_status | sessionId, pageToken | Check progress + view plan |
| jules_list | pageSize, pageToken | List all sessions |
| jules_delete | sessionId | Cancel a session |
| jules_message | sessionId, prompt | Send feedback to Jules |
| jules_approve | sessionId | Approve pending plan |
| jules_activity | sessionId, activityId | View code changes / artifacts |
| jules_list_sources | pageSize, pageToken, filter | List connected repos |
| jules_get_source | sourceName | Get repo details + branches |

## Available Tools

| Tool | Description |
|------|-------------|
| `jules_create` | Create a new session with a prompt and source |
| `jules_status` | Check session progress, plan steps, PR URL |
| `jules_list` | List recent sessions |
| `jules_delete` | Cancel and delete a session |
| `jules_message` | Send feedback or instructions to an active session |
| `jules_approve` | Approve a pending plan (when requirePlanApproval was set) |
| `jules_activity` | Get a single activity with artifacts (git patches, bash output, media) |
| `jules_list_sources` | List available GitHub repos |
| `jules_get_source` | Get details for a single source including all branches |

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

Use `jules_get_source({ sourceName: "..." })` to see all available branches for a specific repo.

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

**When user asks for status:** `jules_status({ sessionId })`. Report progress, completion state, and PR URL.

**When user asks to list active sessions:** `jules_list({ pageSize: 10 })`. Show a table with titles and PR URLs.

**When user wants to cancel:** `jules_delete({ sessionId })`. Confirm deletion.

**When user wants to send feedback to an active session:** `jules_message({ sessionId, prompt: "..." })`. Useful when Jules asks questions or needs clarification.

**When user needs to approve a plan:** `jules_approve({ sessionId })`. Only needed if the session was created with `requirePlanApproval: true`.

**When user wants to see detailed activity (with code changes):** `jules_activity({ sessionId, activityId })`. Returns git patches, bash output, and media files from a specific activity.

## Examples

```
/opencode-jules review PR 42
→ Jules reviewing feat/login-fix. Session: 12345...

/opencode-jules implement #23
→ Reads issue 23, builds prompt, starts Jules session.

/opencode-jules fix the login redirect bug
→ Builds prompt with bug details, starts Jules session.

/opencode-jules how is session 12345 doing?
→ Step 4/7: Analyzing auth service... No PR yet.

/opencode-jules what sessions are running?
→ 3 active sessions: review 42 (PR #43), fix login (working)...

/opencode-jules cancel session 12345
→ Deletes the session.

/opencode-jules tell session 12345 to also add integration tests
→ Sends a message to the active Jules session.

/opencode-jules approve plan for session 12345
→ Approves the pending plan so Jules can start working.

/opencode-jules show me the code changes from activity act2 in session 12345
→ Fetches and displays the git patch from the activity.
```
