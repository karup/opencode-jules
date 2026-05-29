import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { config as dotenvConfig } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JULES_BASE = "https://jules.googleapis.com/v1alpha";

function getKey() {
  return process.env.JULES_API_KEY || process.env.jules_api || "";
}

function getDefaultSource() {
  return process.env.JULES_SOURCE || "";
}

async function julesRequest(method, path, body) {
  const key = getKey();
  if (!key) {
    return {
      error: {
        status: 0,
        body: "JULES_API_KEY is not set. Add it to your .env file or export it in your shell.",
      },
    };
  }

  const url = `${JULES_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": key,
  };
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);

  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text();
      return { error: { status: res.status, body: text } };
    }
    return res.json().catch(() => ({ status: "empty" }));
  } catch (err) {
    return {
      error: {
        status: 0,
        body: `Network error: ${err.message}`,
      },
    };
  }
}

export default async ({ directory }) => {
  dotenvConfig({ path: join(directory, ".env") });

  return {
    config: (cfg) => {
      const skillsPath = join(__dirname, "skills");
      if (!cfg.skills) cfg.skills = {};
      if (!cfg.skills.paths) cfg.skills.paths = [];
      if (!cfg.skills.paths.includes(skillsPath)) {
        cfg.skills.paths.push(skillsPath);
      }
    },

    "shell.env": async (_input, output) => {
      if (process.env.JULES_API_KEY) {
        output.env.JULES_API_KEY = process.env.JULES_API_KEY;
      }
      if (process.env.JULES_SOURCE) {
        output.env.JULES_SOURCE = process.env.JULES_SOURCE;
      }
    },

    tool: {
      jules_create: tool({
        description:
          "Delegates work to Jules (Google's AI coding agent) as a background task. " +
          "Jules will work asynchronously on a GitHub repo. Use this for PR reviews, " +
          "feature implementation, bug fixes, or any coding task you want done in the " +
          "background. Returns a session ID you can poll with jules_status.",
        args: {
          prompt: tool.schema
            .string()
            .describe(
              "Detailed instructions for Jules. Be specific about what to " +
              "check, review, implement, or fix. Include file paths, acceptance " +
              "criteria, and any technical constraints."
            ),
          source: tool.schema
            .string()
            .optional()
            .describe(
              'GitHub source name (e.g. "sources/github/owner/repo"). ' +
              "Defaults to the JULES_SOURCE env var if set. Run jules_list_sources " +
              "to see available sources."
            ),
          branch: tool.schema
            .string()
            .optional()
            .describe(
              "Base branch to work from (e.g. 'main' or 'master'). " +
              "Omit to use the repo's default branch."
            ),
          title: tool.schema
            .string()
            .optional()
            .describe("Short descriptive title for the session."),
          automationMode: tool.schema
            .enum(["AUTO_CREATE_PR"])
            .optional()
            .describe(
              "Set to AUTO_CREATE_PR to have Jules automatically create a pull request. " +
              "Omit for no automation."
            ),
          requirePlanApproval: tool.schema
            .boolean()
            .optional()
            .describe(
              "If true, Jules will ask for plan approval before starting work."
            ),
        },
        async execute(args, context) {
          const { prompt, source, branch, title, automationMode, requirePlanApproval } = args;
          const src = source || getDefaultSource();
          if (!src) {
            return "Error: No source provided. Pass 'source' or set JULES_SOURCE env var. " +
              "Use jules_list_sources to see available sources.";
          }

          const body = {
            prompt,
            sourceContext: {
              source: src,
              githubRepoContext: {},
            },
          };
          if (branch) body.sourceContext.githubRepoContext.startingBranch = branch;
          if (title) body.title = title;
          if (automationMode) body.automationMode = automationMode;
          if (requirePlanApproval) body.requirePlanApproval = true;

          const result = await julesRequest("POST", "/sessions", body);
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          const id = result.id || result.name?.split("/").pop() || "?";
          return JSON.stringify({
            sessionId: id,
            title: result.title || "(no title)",
            prompt: (result.prompt || "").slice(0, 100) + "...",
            status: "created",
            poll: `Call jules_status({ sessionId: "${id}" }) to check progress.`,
          }, null, 2);
        },
      }),

      jules_status: tool({
        description:
          "Checks progress of a background Jules session. Returns current activities, " +
          "plan steps, completion status, and any PR URL if one was created.",
        args: {
          sessionId: tool.schema
            .string()
            .describe("The Jules session ID returned by jules_create."),
          pageToken: tool.schema
            .string()
            .optional()
            .describe("Page token for paginating activities (from a previous jules_status response)."),
        },
        async execute(args) {
          const { sessionId, pageToken } = args;
          const actsQs = new URLSearchParams();
          actsQs.set("pageSize", "20");
          if (pageToken) actsQs.set("pageToken", pageToken);
          const [session, activities] = await Promise.all([
            julesRequest("GET", `/sessions/${sessionId}`),
            julesRequest("GET", `/sessions/${sessionId}/activities?${actsQs.toString()}`),
          ]);

          if (session.error) {
            return `Jules API error (${session.error.status}): ${session.error.body}`;
          }

          const progress = [];
          if (activities.error) {
            progress.push(`[WARNING] Could not fetch activities: ${activities.error.body}`);
          }

          let prUrl = null;
          let completed = false;

          if (session.outputs) {
            for (const out of session.outputs) {
              if (out.pullRequest) prUrl = out.pullRequest.url;
            }
          }

          if (activities.activities) {
            for (const act of activities.activities) {
              if (act.sessionCompleted) completed = true;
              if (act.planGenerated) {
                progress.push("[PLAN]");
                for (const step of act.planGenerated.plan.steps || []) {
                  progress.push(`  ${step.index || "?"}. ${step.title}`);
                }
              }
              if (act.progressUpdated) {
                const status = act.progressUpdated.title || act.progressUpdated.description || "";
                if (status) progress.push(`[WORKING] ${status}`);
              }
            }
          }

          return JSON.stringify({
            sessionId,
            title: session.title || "(no title)",
            completed,
            prUrl,
            progress: progress.slice(-15),
            activityCount: activities.activities?.length || 0,
            nextPageToken: activities.nextPageToken || null,
          }, null, 2);
        },
      }),

      jules_list: tool({
        description:
          "Lists recent Jules sessions. Use to see all background tasks and their IDs.",
        args: {
          pageSize: tool.schema
            .number()
            .int()
            .optional()
            .describe("Number of sessions to list (max 100, default 30)."),
          pageToken: tool.schema
            .string()
            .optional()
            .describe("Page token from a previous jules_list response for pagination."),
        },
        async execute(args) {
          const { pageSize, pageToken } = args;
          const params = new URLSearchParams();
          if (pageSize) params.set("pageSize", pageSize);
          if (pageToken) params.set("pageToken", pageToken);
          const qs = params.toString();
          const result = await julesRequest("GET", `/sessions${qs ? "?" + qs : ""}`);
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          if (!result.sessions) return "No Jules sessions found.";
          return JSON.stringify({
            sessions: result.sessions.map((s) => ({
              sessionId: s.id || s.name?.split("/").pop() || "?",
              title: s.title || "(no title)",
              prompt: (s.prompt || "").slice(0, 80),
              prUrl:
                s.outputs?.find((o) => o.pullRequest)?.pullRequest?.url || null,
            })),
            nextPageToken: result.nextPageToken || null,
          }, null, 2);
        },
      }),

      jules_list_sources: tool({
        description:
          "Lists available GitHub sources (repos) connected to Jules. " +
          "Call this first to discover source names for jules_create.",
        args: {
          pageSize: tool.schema
            .number()
            .int()
            .optional()
            .describe("Number of sources to return (max 100, default 30)."),
          pageToken: tool.schema
            .string()
            .optional()
            .describe("Page token from a previous jules_list_sources response."),
          filter: tool.schema
            .string()
            .optional()
            .describe('Filter expression (e.g. "name=sources/github-owner-repo").'),
        },
        async execute(args) {
          const { pageSize, pageToken, filter } = args;
          const params = new URLSearchParams();
          if (pageSize) params.set("pageSize", pageSize);
          if (pageToken) params.set("pageToken", pageToken);
          if (filter) params.set("filter", filter);
          const qs = params.toString();
          const result = await julesRequest("GET", `/sources${qs ? "?" + qs : ""}`);
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          if (!result.sources) return "No sources found. Install the Jules GitHub app first.";
          return JSON.stringify({
            sources: result.sources.map((s) => ({
              name: s.name,
              repo: `${s.githubRepo?.owner}/${s.githubRepo?.repo}`,
              defaultBranch: s.githubRepo?.defaultBranch?.displayName || "?",
            })),
            nextPageToken: result.nextPageToken || null,
          }, null, 2);
        },
      }),

      jules_delete: tool({
        description:
          "Cancels and deletes a Jules session. The session must be in a state that " +
          "allows deletion (not actively running).",
        args: {
          sessionId: tool.schema
            .string()
            .describe("The Jules session ID to delete."),
        },
        async execute(args) {
          const { sessionId } = args;
          const result = await julesRequest("DELETE", `/sessions/${sessionId}`);
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          return JSON.stringify({ sessionId, deleted: true }, null, 2);
        },
      }),

      jules_message: tool({
        description:
          "Sends a message from the user to an active Jules session. " +
          "Use this to provide feedback, answer questions, or give additional " +
          "instructions while Jules is working.",
        args: {
          sessionId: tool.schema
            .string()
            .describe("The Jules session ID to send a message to."),
          prompt: tool.schema
            .string()
            .describe("The message to send to Jules."),
        },
        async execute(args) {
          const { sessionId, prompt } = args;
          const result = await julesRequest("POST", `/sessions/${sessionId}:sendMessage`, { prompt });
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          return JSON.stringify({ sessionId, sent: true }, null, 2);
        },
      }),

      jules_approve: tool({
        description:
          "Approves a pending plan in a Jules session. Only needed when the session " +
          "was created with requirePlanApproval=true.",
        args: {
          sessionId: tool.schema
            .string()
            .describe("The Jules session ID to approve the plan for."),
        },
        async execute(args) {
          const { sessionId } = args;
          const result = await julesRequest("POST", `/sessions/${sessionId}:approvePlan`, {});
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          return JSON.stringify({ sessionId, approved: true }, null, 2);
        },
      }),

      jules_activity: tool({
        description:
          "Gets a single activity from a Jules session by ID. Returns full activity " +
          "details including artifacts like code changes (git patches), bash output, " +
          "or media files.",
        args: {
          sessionId: tool.schema
            .string()
            .describe("The Jules session ID."),
          activityId: tool.schema
            .string()
            .describe("The activity ID to fetch."),
        },
        async execute(args) {
          const { sessionId, activityId } = args;
          const result = await julesRequest("GET", `/sessions/${sessionId}/activities/${activityId}`);
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          return JSON.stringify({
            id: result.id,
            originator: result.originator,
            description: result.description,
            createTime: result.createTime,
            planGenerated: result.planGenerated || null,
            planApproved: result.planApproved || null,
            userMessaged: result.userMessaged || null,
            agentMessaged: result.agentMessaged || null,
            progressUpdated: result.progressUpdated || null,
            sessionCompleted: result.sessionCompleted || null,
            sessionFailed: result.sessionFailed || null,
            artifacts: result.artifacts || [],
          }, null, 2);
        },
      }),

      jules_get_source: tool({
        description:
          "Gets detailed information about a single source (GitHub repo) including " +
          "all available branches. Use this to discover branch names before creating " +
          "a session.",
        args: {
          sourceName: tool.schema
            .string()
            .describe(
              "The source resource name (e.g. 'sources/github-owner-repo') or just " +
              "the source ID (e.g. 'github-owner-repo')."
            ),
        },
        async execute(args) {
          const { sourceName } = args;
          const name = sourceName.startsWith("sources/") ? sourceName : `sources/${sourceName}`;
          const result = await julesRequest("GET", `/${encodeURIComponent(name)}`);
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          return JSON.stringify({
            name: result.name,
            repo: `${result.githubRepo?.owner}/${result.githubRepo?.repo}`,
            isPrivate: result.githubRepo?.isPrivate,
            defaultBranch: result.githubRepo?.defaultBranch?.displayName || "?",
            branches: (result.githubRepo?.branches || []).map((b) => b.displayName),
          }, null, 2);
        },
      }),
    },
  };
};
