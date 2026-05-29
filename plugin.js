// Jules AI Coding Agent — OpenCode plugin
// Integrates Jules REST API (jules.googleapis.com) for async code reviews,
// feature work, and bug fixes.
//
// Configuration:
//   JULES_API_KEY — required, from https://jules.google.com/settings#api
//   JULES_SOURCE  — optional default GitHub source (e.g. sources/github/owner/repo)
//
// See https://developers.google.com/jules/api for full API reference.

const JULES_BASE = "https://jules.googleapis.com/v1alpha";

export const JulesPlugin = async () => {
  function getKey() {
    return process.env.JULES_API_KEY || "";
  }

  function getDefaultSource() {
    return process.env.JULES_SOURCE || "";
  }

  async function julesRequest(method, path, body) {
    const url = `${JULES_BASE}${path}`;
    const headers = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getKey(),
    };
    const init = { method, headers };
    if (body) init.body = JSON.stringify(body);
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text();
      return { error: { status: res.status, body: text } };
    }
    return res.json().catch(() => ({ status: "empty" }));
  }

  return {
    tool: {
      jules_create: {
        description:
          "Delegates work to Jules (Google's AI coding agent) as a background task. " +
          "Jules will work asynchronously on a GitHub repo. Use this for PR reviews, " +
          "feature implementation, bug fixes, or any coding task you want done in the " +
          "background. Returns a session ID you can poll with jules_status.",
        parameters: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "Detailed instructions for Jules. Be specific about what to " +
                "check, review, implement, or fix. Include file paths, acceptance " +
                "criteria, and any technical constraints.",
            },
            source: {
              type: "string",
              description:
                'GitHub source name (e.g. "sources/github/owner/repo"). ' +
                "Defaults to the JULES_SOURCE env var if set. Run jules_list_sources " +
                "to see available sources.",
            },
            branch: {
              type: "string",
              description:
                "Base branch to work from (e.g. 'main' or 'master'). " +
                "Omit to use the repo's default branch.",
            },
            title: {
              type: "string",
              description: "Short descriptive title for the session.",
            },
            automationMode: {
              type: "string",
              enum: ["AUTO_CREATE_PR", "NONE"],
              description:
                "Whether Jules should auto-create a PR. " +
                "Use AUTO_CREATE_PR to get results as a pull request.",
              default: "NONE",
            },
            requirePlanApproval: {
              type: "boolean",
              description:
                "If true, Jules will ask for plan approval before starting work.",
              default: false,
            },
          },
          required: ["prompt", "source"],
        },
        execute: async (args) => {
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
          if (automationMode && automationMode !== "NONE") body.automationMode = automationMode;
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
      },

      jules_status: {
        description:
          "Checks progress of a background Jules session. Returns current activities, " +
          "plan steps, completion status, and any PR URL if one was created.",
        parameters: {
          type: "object",
          properties: {
            sessionId: {
              type: "string",
              description: "The Jules session ID returned by jules_create.",
            },
          },
          required: ["sessionId"],
        },
        execute: async (args) => {
          const { sessionId } = args;
          const [session, activities] = await Promise.all([
            julesRequest("GET", `/sessions/${sessionId}`),
            julesRequest("GET", `/sessions/${sessionId}/activities?pageSize=20`),
          ]);

          if (session.error) {
            return `Jules API error (${session.error.status}): ${session.error.body}`;
          }

          const progress = [];
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
          }, null, 2);
        },
      },

      jules_list: {
        description:
          "Lists recent Jules sessions. Use to see all background tasks and their IDs.",
        parameters: {
          type: "object",
          properties: {
            pageSize: {
              type: "integer",
              description: "Number of sessions to list (max 20).",
              default: 10,
            },
          },
        },
        execute: async (args) => {
          const { pageSize } = args;
          const result = await julesRequest("GET", `/sessions?pageSize=${pageSize || 10}`);
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          if (!result.sessions) return "No Jules sessions found.";
          return JSON.stringify(
            result.sessions.map((s) => ({
              sessionId: s.id || s.name?.split("/").pop() || "?",
              title: s.title || "(no title)",
              prompt: (s.prompt || "").slice(0, 80),
              prUrl:
                s.outputs?.find((o) => o.pullRequest)?.pullRequest?.url || null,
            })),
            null,
            2
          );
        },
      },

      jules_list_sources: {
        description:
          "Lists available GitHub sources (repos) connected to Jules. " +
          "Call this first to discover source names for jules_create.",
        parameters: {
          type: "object",
          properties: {},
        },
        execute: async () => {
          const result = await julesRequest("GET", "/sources");
          if (result.error) {
            return `Jules API error (${result.error.status}): ${result.error.body}`;
          }
          if (!result.sources) return "No sources found. Install the Jules GitHub app first.";
          return JSON.stringify(
            result.sources.map((s) => ({
              name: s.name,
              repo: `${s.githubRepo?.owner}/${s.githubRepo?.repo}`,
              defaultBranch: s.githubRepo?.defaultBranch?.displayName || "?",
            })),
            null,
            2
          );
        },
      },
    },
  };
};
