import type { WorkflowVariableRole } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

export const VARIABLE_ROLES: WorkflowVariableRole[] = [...workflow.graph.workflowVariableRoles];
