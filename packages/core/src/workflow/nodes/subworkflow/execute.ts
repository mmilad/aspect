import { findStartNode } from "../../graph/schema";
import type { WorkflowContextBag, WorkflowGraph } from "../../graph/types";
import { mapBagByMap } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

async function loadWorkflowRun() {
  const mod = await import("../../runtime/workflow");
  return mod.WorkflowRun;
}

function childBagFromParent(
  parent: WorkflowContextBag,
  childGraph: WorkflowGraph,
  workflowId: string,
  inputMap: Record<string, string> | undefined
): WorkflowContextBag {
  const start = findStartNode(childGraph);
  const mapped = mapBagByMap(inputMap, parent.keys);
  return {
    workflowId,
    cursor: start?.id ?? null,
    goal: parent.goal,
    keys: {
      goal: parent.goal,
      ...mapped
    },
    runId: parent.runId,
    status: "running"
  };
}

export async function executeSubworkflow(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const config = ctx.node.data.subworkflow;
  if (!config?.workflowId) {
    return ctx.fail(`Subworkflow ${ctx.node.id} requires subworkflow.workflowId.`);
  }
  if (!ctx.adapters.resolveSubworkflow) {
    return ctx.fail(`Subworkflow ${ctx.node.id}: adapters.resolveSubworkflow is required.`);
  }

  const childGraph = await ctx.adapters.resolveSubworkflow(config.workflowId);
  if (!childGraph) {
    return ctx.fail(`Subworkflow ${ctx.node.id}: could not resolve '${config.workflowId}'.`);
  }

  const WorkflowRun = await loadWorkflowRun();
  const childBag = childBagFromParent(ctx.bag, childGraph, config.workflowId, config.inputMap);
  const childRun = new WorkflowRun({
    graph: childGraph,
    bag: childBag,
    adapters: ctx.adapters,
    entities: ctx.entities,
    relations: ctx.relations
  });
  const childResult = await childRun.runUntilPause();

  if (childResult.kind !== "completed") {
    return ctx.fail(
      `Subworkflow ${ctx.node.id} did not complete (status=${childResult.kind}${
        childResult.message ? `: ${childResult.message}` : ""
      }).`
    );
  }

  const outputs = mapBagByMap(config.outputMap, childResult.bag.keys);
  if (Object.keys(outputs).length > 0) {
    const writes = ctx.getWrites();
    const outputKeys = Object.keys(outputs);
    const allDeclared = outputKeys.every((key) => writes.includes(key));
    if (allDeclared && writes.length > 0) {
      // Only use applyWrites when every output key is declared; still allow extra declared keys
      // by merging undeclared-safe path when writes don't cover exactly.
      const values: Record<string, unknown> = {};
      let missing = false;
      for (const key of writes) {
        if (key in outputs) {
          values[key] = outputs[key];
        } else if (key in ctx.bag.keys) {
          values[key] = ctx.bag.keys[key];
        } else {
          missing = true;
          break;
        }
      }
      if (!missing) {
        const applied = ctx.applyWrites(values);
        if (!applied.ok) {
          return ctx.fail(applied.error);
        }
      } else {
        ctx.bag = {
          ...ctx.bag,
          keys: {
            ...ctx.bag.keys,
            ...outputs
          }
        };
      }
    } else {
      ctx.bag = {
        ...ctx.bag,
        keys: {
          ...ctx.bag.keys,
          ...outputs
        }
      };
    }
  }

  return ctx.advance();
}
