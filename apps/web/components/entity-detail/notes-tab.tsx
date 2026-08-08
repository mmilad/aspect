import type { Entity } from "@projectplaner/core";
import { EntityListPanel } from "../entity-chrome";

interface NotesTabProps {
  notes: Entity[];
  references: Entity[];
  projectKey: string;
}

export function NotesTab({ notes, references, projectKey }: NotesTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <EntityListPanel title="Notes / entries" entities={notes} projectKey={projectKey} empty="No linked notes yet." />
      <EntityListPanel title="References" entities={references} projectKey={projectKey} empty="No linked references." />
    </div>
  );
}
