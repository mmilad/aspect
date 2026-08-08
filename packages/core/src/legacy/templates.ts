import type { JsonRecord, NodeType, ProjectNode } from "../domain/types";

export interface FieldDescriptor {
  key: string;
  label: string;
}

const templates: Record<NodeType, FieldDescriptor[]> = {
  project: [
    { key: "purpose", label: "Purpose" },
    { key: "principles", label: "Principles" },
    { key: "nonGoals", label: "Non-goals" }
  ],
  aspect: [
    { key: "statement", label: "Statement" },
    { key: "why", label: "Why" },
    { key: "affectedByTasks", label: "Affected by tasks" },
    { key: "evidence", label: "Evidence" },
    { key: "implementationSignal", label: "Implementation signal" }
  ],
  entry: [
    { key: "purpose", label: "Purpose" },
    { key: "startsAt", label: "Starts at" },
    { key: "leadsTo", label: "Leads to" }
  ],
  area: [
    { key: "purpose", label: "Purpose" },
    { key: "responsibilities", label: "Responsibilities" }
  ],
  surface: [
    { key: "purpose", label: "Purpose" },
    { key: "visibleElements", label: "Visible elements" },
    { key: "actions", label: "Actions" },
    { key: "states", label: "States" }
  ],
  feature: [
    { key: "purpose", label: "Purpose" },
    { key: "userValue", label: "User value" },
    { key: "behavior", label: "Behavior" },
    { key: "inputs", label: "Inputs" },
    { key: "outputs", label: "Outputs" },
    { key: "nonGoals", label: "Non-goals" }
  ],
  flow: [
    { key: "trigger", label: "Trigger" },
    { key: "steps", label: "Steps" },
    { key: "success", label: "Success" },
    { key: "failure", label: "Failure" }
  ],
  decision: [
    { key: "context", label: "Context" },
    { key: "options", label: "Options" },
    { key: "decision", label: "Decision" },
    { key: "rationale", label: "Rationale" },
    { key: "consequences", label: "Consequences" }
  ],
  question: [
    { key: "context", label: "Context" },
    { key: "answerCriteria", label: "Answer criteria" },
    { key: "answer", label: "Answer" }
  ],
  reference: [
    { key: "kind", label: "Kind" },
    { key: "url", label: "URL" },
    { key: "summary", label: "Summary" }
  ],
  task_group: [
    { key: "goal", label: "Goal" },
    { key: "acceptanceShape", label: "Acceptance shape" }
  ]
};

const fallback: FieldDescriptor[] = [
  { key: "purpose", label: "Purpose" },
  { key: "notes", label: "Notes" }
];

export function getNodeTemplate(type: string): FieldDescriptor[] {
  return (templates as Record<string, FieldDescriptor[]>)[type] ?? fallback;
}

export function readTemplateValue(node: ProjectNode, key: string): string {
  const value = (node.metadata as JsonRecord)[key];
  if (Array.isArray(value)) {
    return value.join("\n");
  }

  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return JSON.stringify(value, null, 2);
}
