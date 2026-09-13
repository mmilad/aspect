import type { KnowledgeScope, KnowledgeScopeKind } from "./types";

const scopeKinds = new Set<KnowledgeScopeKind>(["global", "personal", "project", "agent", "session"]);

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Return a precise validation error for a knowledge ownership scope. */
export function knowledgeScopeError(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "scope must be an object.";
  const scope = value as Partial<KnowledgeScope>;
  if (!scopeKinds.has(scope.kind as KnowledgeScopeKind)) {
    return "scope.kind must be global, personal, project, agent, or session.";
  }
  if (scope.kind === "personal" && !nonEmptyString(scope.ownerId)) return "scope.ownerId is required for a personal scope.";
  if (scope.kind === "project" && !nonEmptyString(scope.projectKey)) return "scope.projectKey is required for a project scope.";
  if (scope.kind === "agent" && !nonEmptyString(scope.agentId)) return "scope.agentId is required for an agent scope.";
  if (scope.kind === "session" && !nonEmptyString(scope.sessionId)) return "scope.sessionId is required for a session scope.";
  return undefined;
}

/** Validate and preserve a workflow-provided knowledge scope. */
export function parseKnowledgeScope(value: unknown): KnowledgeScope | undefined {
  return knowledgeScopeError(value) === undefined ? value as KnowledgeScope : undefined;
}
