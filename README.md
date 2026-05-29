# opencode-jules

OpenCode plugin for [Jules](https://jules.google.com/) — Google's AI coding agent. Jules works **asynchronously** on your GitHub repos: reviewing PRs, implementing features, and fixing bugs — all in the background.

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

## License

Apache-2.0 — see [LICENSE](./LICENSE).
