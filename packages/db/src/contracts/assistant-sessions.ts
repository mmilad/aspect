import type { AssistantSession, AssistantSessionRecord, AssistantSessionStatus } from "@projectplaner/core/assistant";
export type AssistantSessionRow = AssistantSessionRecord;
export type { AssistantSession, AssistantSessionRecord, AssistantSessionStatus };
export interface Operations {
  get(id: string): Promise<AssistantSessionRecord | null>;
  list(projectKey: string, options?: {
    includeArchived?: boolean;
  }): Promise<AssistantSessionRecord[]>;
  getOrCreateActive(projectKey: string): Promise<AssistantSessionRecord>;
  create(projectKey: string): Promise<AssistantSessionRecord>;
  save(id: string, session: AssistantSession): Promise<AssistantSessionRecord>;
  archive(id: string): Promise<AssistantSessionRecord>;
}
