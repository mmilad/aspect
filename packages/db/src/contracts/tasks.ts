export interface CreateTaskInput {
  projectKey: string;
  title: string;
  description: string;
  status?: "in_planning" | "planned" | "in_progress" | "done" | "canceled" | "archived";
  priority: "low" | "medium" | "high" | "critical";
  acceptanceCriteria: string[];
  targetType: "aspect" | "feature";
  targetId: string;
  linkType: "affects" | "implements" | "validates" | "investigates";
  skipRollup?: boolean;
}
export interface Operations {
  create(input: CreateTaskInput): Promise<{
    id: string;
    key: string;
  }>;
}
