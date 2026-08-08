import { RelationList, type RelationListItem } from "../entity-chrome";

interface RelationsTabProps {
  relations: RelationListItem[];
  projectKey: string;
}

export function RelationsTab({ relations, projectKey }: RelationsTabProps) {
  const outgoing = relations.filter((item) => item.direction === "outgoing");
  const incoming = relations.filter((item) => item.direction === "incoming");
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RelationList title="Outgoing" items={outgoing} projectKey={projectKey} />
      <RelationList title="Incoming" items={incoming} projectKey={projectKey} />
    </div>
  );
}
