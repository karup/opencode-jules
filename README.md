# opencode-jules

OpenCode plugin for [Jules](https://jules.google.com/) — Google's AI coding agent. Jules works **asynchronously** on your GitHub repos: reviewing PRs, implementing features, and fixing bugs — all in the background.

## Prerequisites

1. **Jules GitHub app** installed on your repos via [jules.google.com](https://jules.google.com)
2. **API key** from [Jules Settings → API](https://jules.google.com/settings/api)
3. **OpenCode** with Node.js >= 18

## Install

```bash
npm install opencode-jules
```

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-jules"]
}
```

Set your API key:

```bash
export JULES_API_KEY="your-api-key"  # or add to .env
```

Optionally, set a default source to avoid passing it every time:

```bash
export JULES_SOURCE="sources/github/owner/repo"  # or add to .env via .env.example
```

## Usage

Once the plugin and skill are loaded, trigger Jules from opencode:

```
/opencode-jules review PR 42          → Reviews a PR, creates an audit PR
/opencode-jules implement #23         → Reads issue 23, implements the feature
/opencode-jules fix login redirect    → Fixes a bug, creates a fix PR
/opencode-jules how is session 123?   → Checks progress of a background session
/opencode-jules what's running?       → Lists all active/inactive Jules sessions
```

## Tools registered

| Tool | Description |
|------|-------------|
| `jules_create` | Creates a new Jules session with a prompt and source |
| `jules_status` | Polls a session's progress, plan steps, and PR URL |
| `jules_list` | Lists recent sessions with titles and status |
| `jules_list_sources` | Lists available GitHub sources (repos) |

## Configuration

| Env var | Required | Description |
|---------|----------|-------------|
| `JULES_API_KEY` | Yes | API key from jules.google.com/settings/api |
| `JULES_SOURCE` | No | Default source name (e.g. `sources/github/owner/repo`). Can be set in `.env`. |

## License

Apache-2.0 — see [LICENSE](./LICENSE).
