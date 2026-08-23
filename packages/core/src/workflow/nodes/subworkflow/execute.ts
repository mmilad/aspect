import { cloneContextBag } from "../../graph/frame";
import { findStartNode } from "../../graph/schema";
import type { WorkflowContextBag, WorkflowGraph } from "../../graph/types";
import { mapBagByMap } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

const SUBRUNS_KEY = "__subruns";

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

function readStash(bag: WorkflowContextBag, nodeId: string): WorkflowContextBag | null {
  const raw = bag.keys[SUBRUNS_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const stashed = (raw as Record<string, unknown>)[nodeId];
  if (!stashed || typeof stashed !== "object") {
    return null;
  }
  return stashed as WorkflowContextBag;
}

function writeStash(
  bag: WorkflowContextBag,
  nodeId: string,
  childBag: WorkflowContextBag | null
): WorkflowContextBag {
  const previous =
    typeof bag.keys[SUBRUNS_KEY] === "object" &&
    bag.keys[SUBRUNS_KEY] !== null &&
    !Array.isArray(bag.keys[SUBRUNS_KEY])
      ? { ...(bag.keys[SUBRUNS_KEY] as Record<string, unknown>) }
      : {};
  if (childBag) {
    previous[nodeId] = cloneContextBag(childBag);
  } else {
    delete previous[nodeId];
  }
  return {
    ...bag,
    keys: {
      ...bag.keys,
      [SUBRUNS_KEY]: previous
    }
  };
}

async function applyMappedOutputs(
  ctx: NodeExecuteContext,
  outputMap: Record<string, string> | undefined,
  childKeys: Record<string, unknown>
): Promise<WorkflowStepResult | null> {
  const outputs = mapBagByMap(outputMap, childKeys);
  if (Object.keys(outputs).length === 0) {
    return null;
  }
  const writes = ctx.getWrites();
  const outputKeys = Object.keys(outputs);
  const allDeclared = outputKeys.every((key) => writes.includes(key));
  if (allDeclared && writes.length > 0) {
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
    }
  }
  ctx.bag = {
    ...ctx.bag,
    keys: {
      ...ctx.bag.keys,
      ...outputs
    }
  };
  return null;
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
  const stashed = readStash(ctx.bag, ctx.node.id);
  const childRun = new WorkflowRun({
    graph: childGraph,
    bag: stashed
      ? cloneContextBag(stashed)
      : childBagFromParent(ctx.bag, childGraph, config.workflowId, config.inputMap),
    adapters: ctx.adapters,
    entities: ctx.entities,
    relations: ctx.relations
  });

  let childResult: WorkflowStepResult;
  if (stashed && (ctx.llmWrites || ctx.userRoute)) {
    childResult = await childRun.step({
      llmWrites: ctx.llmWrites,
      userRoute: ctx.userRoute
    });
    if (childResult.kind === "advanced") {
      childResult = await childRun.runUntilPause();
    }
  } else {
    childResult = await childRun.runUntilPause();
  }

  if (childResult.kind === "pending_llm" || childResult.kind === "pending_user") {
    const bag = writeStash(
      { ...ctx.bag, status: childResult.kind, cursor: ctx.node.id },
      ctx.node.id,
      childResult.bag
    );
    return {
      kind: childResult.kind,
      bag,
      nodeId: ctx.node.id,
      llm: childResult.llm,
      message: childResult.message
    };
  }

  if (childResult.kind !== "completed") {
    return ctx.fail(
      `Subworkflow ${ctx.node.id} did not complete (status=${childResult.kind}${
        childResult.message ? `: ${childResult.message}` : ""
      }).`
    );
  }

  ctx.bag = writeStash(ctx.bag, ctx.node.id, null);
  const mapped = await applyMappedOutputs(ctx, config.outputMap, childResult.bag.keys);
  if (mapped) {
    return mapped;
  }
  return ctx.advance();
}
