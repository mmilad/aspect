import Link from "next/link";
import type { ProjectNode, ProjectPlanSnapshot } from "@projectplaner/core";
import { parseAgentProfile } from "@projectplaner/core";
import { projectPaths } from "../../lib/project-paths";
import styles from "./style.module.css";

export function AgentsSection({ snapshot }: { snapshot: ProjectPlanSnapshot }) {
  const agents = snapshot.nodes.filter((node): node is ProjectNode => node.type === "agent");
  if (agents.length === 0) return null;
  return (
    <section className={styles.section} aria-label="Agents">
      <div className={styles.heading}>Agents</div>
      <div className={styles.nav}>
        {agents.map(agent => {
          const profile = parseAgentProfile(agent.metadata);
          return (
            <Link key={agent.id} href={projectPaths.agentChat(snapshot.project.key, agent.id)} className={styles.link}>
              <span>
                <span className="block">{agent.title}</span>
                {profile.role ? <span className="block text-[10px] text-muted-foreground">{profile.role}</span> : null}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

