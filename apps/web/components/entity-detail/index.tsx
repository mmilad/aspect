import Link from "next/link";
import type { Entity } from "@projectplaner/core";
import { EntityHeader } from "../entity-chrome";
import { toEntityPreview } from "../../lib/entity-preview";
import { projectPaths } from "../../lib/project-paths";
import { cn } from "../../lib/utils";
import { readMetadataString, readMetadataStringList } from "../../lib/entity-metadata";
import type { EntityDetailData } from "../../lib/data";
import { OverviewTab } from "./overview-tab";
import { WorkTab } from "./work-tab";
import { RelationsTab } from "./relations-tab";
import { NotesTab } from "./notes-tab";
import { MetadataTab } from "./metadata-tab";

export const DETAIL_TABS = ["overview", "work", "relations", "notes", "metadata"] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];

export function isDetailTab(value: string | undefined): value is DetailTab {
  return DETAIL_TABS.includes(value as DetailTab);
}

interface EntityDetailProps {
  detail: EntityDetailData;
  tab: DetailTab;
}

export function EntityDetail({ detail, tab }: EntityDetailProps) {
  const { project, entity } = detail;
  const priority = readMetadataString(entity.metadata, "priority");
  const acceptanceCriteria = readMetadataStringList(entity.metadata, "acceptanceCriteria");
  const primary = detail.relations.find((item) => item.relation.isPrimary && item.direction === "outgoing");
  const dependencies = detail.relations.filter(
    (item) => item.direction === "outgoing" && (item.relation.type === "depends_on" || item.relation.type === "blocked_by")
  );
  const dependents = detail.relations.filter(
    (item) => item.direction === "incoming" && (item.relation.type === "depends_on" || item.relation.type === "blocked_by")
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <EntityHeader entity={toEntityPreview(entity)} extras={[priority]} showPath={false} />

      <div className="-mx-4 mt-5 overflow-x-auto border-y border-border px-4 sm:mx-0 sm:rounded-md sm:border sm:px-0">
        <nav className="flex min-w-max gap-1 p-1" aria-label="Entity detail sections">
          {DETAIL_TABS.map((item) => (
            <Link
              key={item}
              href={projectPaths.entity(project.key, entity.id, item)}
              className={cn(
                "rounded-md px-3 py-2 text-sm capitalize",
                tab === item ? "bg-teal-700 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-5">
        {tab === "overview" ? (
          <OverviewTab
            entity={entity}
            tags={detail.tags}
            primary={primary}
            projectKey={project.key}
            priority={priority}
            acceptanceCriteria={acceptanceCriteria}
          />
        ) : null}
        {tab === "work" ? (
          <WorkTab
            entity={entity}
            projectKey={project.key}
            relatedWork={detail.relatedWork}
            dependencies={dependencies}
            dependents={dependents}
            acceptanceCriteria={acceptanceCriteria}
            priority={priority}
            primary={primary}
          />
        ) : null}
        {tab === "relations" ? <RelationsTab relations={detail.relations} projectKey={project.key} /> : null}
        {tab === "notes" ? (
          <NotesTab notes={detail.notes} references={detail.references} projectKey={project.key} />
        ) : null}
        {tab === "metadata" ? <MetadataTab metadata={entity.metadata} /> : null}
      </div>
    </div>
  );
}

export type { Entity };
