import type { Entity } from "@projectplaner/core";
import { DIRECT_AGENT_CAPABILITIES, parseAgentProfile } from "@projectplaner/core";
import { ToolbarLink } from "../ui";
import { projectPaths } from "../../lib/project-paths";
import { getDatabaseController } from "@projectplaner/db";
import { REGISTERED_AGENT_CAPABILITIES } from "@projectplaner/core";
import { AgentConfiguration } from "./agent-configuration";

function List({ title, values }: { title: string; values: string[] }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {values.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {values.map(value => <li key={value}>{value}</li>)}
        </ul>
      ) : <p className="text-sm text-muted-foreground">—</p>}
    </section>
  );
}

export async function AgentOverview({ entity, projectKey }: { entity: Entity; projectKey: string }) {
  const profile = parseAgentProfile(entity.metadata);
  const workflows = (await getDatabaseController().entities.list({ projectKey, type: "flow" })).map(flow => ({
    id: flow.id,
    key: typeof flow.metadata.presetKey === "string" ? flow.metadata.presetKey : null,
    title: flow.title
  }));
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-teal-200 bg-teal-50/60 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-teal-800">Agent profile · explicit runtime access</div>
        <h1 className="mt-1 text-xl font-semibold text-teal-950">{entity.title}</h1>
        <p className="mt-1 text-sm text-teal-900/80">{profile.role || "—"}</p>
      </div>
      <p className="text-sm text-muted-foreground">{DIRECT_AGENT_CAPABILITIES}</p>
      {profile.instructions ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instructions</h2>
          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{profile.instructions}</p>
        </section>
      ) : null}
      <List title="Responsibilities" values={profile.responsibilities} />
      <List title="Recurring activities" values={profile.recurringActivities} />
      <List title="Profile expertise" values={profile.capabilities} />
      <List title="Decision areas" values={profile.decisionAreas} />
      <List title="Candidate workflows" values={profile.candidateWorkflows} />
      <List title="Assigned workflows" values={profile.assignedWorkflowIds} />
      <AgentConfiguration
        agentId={entity.id}
        projectKey={projectKey}
        profile={profile}
        availableWorkflows={workflows}
        registeredCapabilities={[...REGISTERED_AGENT_CAPABILITIES]}
      />
      <List title="History" values={profile.history.map(item => typeof item === "string" ? item : JSON.stringify(item))} />
      <ToolbarLink href={projectPaths.agentChat(projectKey, entity.id)} size="xs">Open chat</ToolbarLink>
      <ToolbarLink href={projectPaths.graph(projectKey, entity.id)} size="xs">Open graph entity</ToolbarLink>
      <p className="font-mono text-xs text-muted-foreground">{entity.id}</p>
    </div>
  );
}

