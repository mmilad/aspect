export type AgentConfig = {
  /** Projectplaner HTTP API base URL (no trailing slash). */
  apiBaseUrl: string;
  /** Default project key for workflow runs. */
  projectKey: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AgentConfig {
  const raw = env.PROJECTPLANER_API_BASE_URL?.trim() || "http://127.0.0.1:3000";
  return {
    apiBaseUrl: raw.replace(/\/$/, ""),
    projectKey: env.PROJECTPLANER_PROJECT_KEY?.trim() || "PLAN"
  };
}
