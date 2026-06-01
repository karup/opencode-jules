# opencode-jules

OpenCode **REST** plugin for [Jules](https://jules.google.com/) — Google's AI coding agent — via the **REST API**. Jules works **asynchronously** on your GitHub repos: reviewing PRs, implementing features, and fixing bugs — all in the background.

> **REST API + API key** — no MCP server, no SDK, no binaries. Just an API key in `.env` and the plugin in `opencode.json`.

## Prerequisites

1. **Jules GitHub app** installed on your repos via [jules.google.com](https://jules.google.com)
2. **API key** from [Jules Settings → API](https://jules.google.com/settings/api)
3. **OpenCode** with Node.js >= 18

## Install

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-jules"]
}
```

Set your API key (copy `.env.example` to `.env` in your project root):

```bash
cp .env.example .env
# Edit .env with your API key
```

The plugin loads `.env` from the project root automatically. You can also export vars in your shell:

```bash
export JULES_API_KEY="your-api-key"
export JULES_SOURCE="sources/github/owner/repo"  # optional default
```

### Skill loading workaround

If the `/opencode-jules` skill does not appear after restart, add the skill path explicitly to `opencode.json`:

```json
{
  "plugin": ["opencode-jules"],
  "skills": {
    "paths": [".opencode/node_modules/opencode-jules/skills"]
  }
}
```

## Usage

Once the plugin and skill are loaded, trigger Jules from opencode:

```
/opencode-jules review PR 42           → Reviews a PR, creates an audit PR
/opencode-jules implement #23          → Reads issue 23, implements the feature
/opencode-jules fix login redirect     → Fixes a bug, creates a fix PR
/opencode-jules how is session 123?    → Checks progress of a background session
/opencode-jules what's running?        → Lists all active/inactive Jules sessions
/opencode-jules cancel session 123     → Deletes a session
/opencode-jules tell session 123 to add tests → Sends feedback to an active session
/opencode-jules approve plan session 123      → Approves a pending plan
```

### Example session

```
tell opencode-jules to do a review of the main branch for this repo

→ Skill "opencode-jules"
- Thought: The user wants me to have Jules review the main branch (main) of the repo. Let me first discover the source, then create a review session.
⚙ jules_list_sources
+ Thought: 933ms
⚙ jules_create [prompt=Review the code in the main branch. Check for:
- Bugs and logic errors
- Security vulnerabilities (token/auth handling, input validation)
- Missing tests or test coverage gaps
- Missing type safety or incorrect types
- Violations of project conventions and style guides
- Duplicate or extractable code
- Concurrency issues (race conditions, missing guards)
- Missing error handling
Be thorough and specific. Include file paths and line numbers in findings., source=sources/github/owner/repo, branch=main, title=Code review of repo main branch, automationMode=AUTO_CREATE_PR]
+ Thought: 4ms
Jules session a1b2c3d4 started — Code review of repo main branch.
Jules will review the main branch for bugs, security issues, missing tests, type safety, and more, then create a PR with findings. Ask me anytime to check progress.```
```

## Tools registered

| Tool | Endpoint | Description |
|------|----------|-------------|
| `jules_create` | `POST /sessions` | Create a new Jules session |
| `jules_status` | `GET /sessions/{id}` + activities | Check session progress, plan steps, PR URL |
| `jules_list` | `GET /sessions` | List recent sessions |
| `jules_delete` | `DELETE /sessions/{id}` | Cancel and delete a session |
| `jules_message` | `POST /sessions/{id}:sendMessage` | Send feedback or instructions to an active session |
| `jules_approve` | `POST /sessions/{id}:approvePlan` | Approve a pending plan |
| `jules_activity` | `GET /sessions/{id}/activities/{actId}` | Get one activity with artifacts (git patches, bash output, media) |
| `jules_list_sources` | `GET /sources` | List available GitHub repos |
| `jules_get_source` | `GET /sources/{id}` | Get source details with all branches |

## Configuration

| Env var | Required | Description |
|---------|----------|-------------|
| `JULES_API_KEY` | Yes | API key from jules.google.com/settings/api |
| `JULES_SOURCE` | No | Default source name (e.g. `sources/github/owner/repo`). Can be set in `.env`. |

## Why opencode-jules vs @google/jules-mcp

| | `@google/jules-mcp` (MCP) | `opencode-jules` (this plugin) |
|---|---|---|
| Protocol | MCP server process | **REST API + API key** |
| Install | MCP config + binary/server | **One line in `opencode.json`** |
| Runtime | Requires running server process | **No server — HTTP calls** |
| API coverage | Limited by MCP toolkit | **All 9 REST endpoints** |
| Auth | MCP auth flow | **API key from `.env`** |
| Skill | None | **`/opencode-jules` with help, setup, workflows** |
| Env support | N/A | **Auto-loads `.env` + `shell.env` hook** |

## License

Apache-2.0 — see [LICENSE](./LICENSE).
