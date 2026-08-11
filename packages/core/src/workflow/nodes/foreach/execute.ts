import { findStartNode } from "../../graph/schema";
import type { WorkflowContextBag } from "../../graph/types";
import { mapBagByMap } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

async function loadWorkflowRun() {
  const mod = await import("../../runtime/workflow");
  return mod.WorkflowRun;
}

function collectValue(bag: WorkflowContextBag, from: string | string[] | undefined): unknown {
  if (!from) {
    return undefined;
  }
  if (typeof from === "string") {
    return bag.keys[from];
  }
  const obj: Record<string, unknown> = {};
  for (const key of from) {
    obj[key] = bag.keys[key];
  }
  return obj;
}

async function runSubworkflowBody(
  ctx: NodeExecuteContext,
  item: unknown,
  index: number,
  body: {
    workflowId: string;
    inputMap?: Record<string, string>;
    outputMap?: Record<string, string>;
  },
  itemKey: string,
  indexKey: string
): Promise<{ ok: true; bag: WorkflowContextBag } | { ok: false; error: string }> {
  if (!ctx.adapters.resolveSubworkflow) {
    return { ok: false, error: `Foreach ${ctx.node.id}: adapters.resolveSubworkflow is required.` };
  }
  const childGraph = await ctx.adapters.resolveSubworkflow(body.workflowId);
  if (!childGraph) {
    return {
      ok: false,
      error: `Foreach ${ctx.node.id}: could not resolve '${body.workflowId}'.`
    };
  }

  const start = findStartNode(childGraph);
  const mapped = mapBagByMap(body.inputMap, {
    ...ctx.bag.keys,
    [itemKey]: item,
    [indexKey]: index
  });
  const childBag: WorkflowContextBag = {
    workflowId: body.workflowId,
    cursor: start?.id ?? null,
    goal: ctx.bag.goal,
    keys: {
      goal: ctx.bag.goal,
      [itemKey]: item,
      [indexKey]: index,
      ...mapped
    },
    runId: ctx.bag.runId,
    status: "running"
  };

  const WorkflowRun = await loadWorkflowRun();
  const childRun = new WorkflowRun({
    graph: childGraph,
    bag: childBag,
    adapters: ctx.adapters,
    entities: ctx.entities,
    relations: ctx.relations
  });
  const result = await childRun.runUntilPause();
  if (result.kind !== "completed") {
    return {
      ok: false,
      error: `Foreach item ${index} subworkflow did not complete (${result.kind}${
        result.message ? `: ${result.message}` : ""
      }).`
    };
  }

  const outputs = mapBagByMap(body.outputMap, result.bag.keys);
  return {
    ok: true,
    bag: {
      ...result.bag,
      keys: {
        ...result.bag.keys,
        ...outputs
      }
    }
  };
}

async function runSubgraphBody(
  ctx: NodeExecuteContext,
  item: unknown,
  index: number,
  body: { entryNodeId: string; exitNodeId: string },
  itemKey: string,
  indexKey: string,
  maxStepsPerItem: number
): Promise<{ ok: true; bag: WorkflowContextBag } | { ok: false; error: string }> {
  const WorkflowRun = await loadWorkflowRun();
  const bag: WorkflowContextBag = {
    ...ctx.bag,
    keys: {
      ...ctx.bag.keys,
      [itemKey]: item,
      [indexKey]: index
    },
    cursor: body.entryNodeId,
    status: "running",
    error: undefined
  };

  if (body.entryNodeId === body.exitNodeId) {
    return { ok: true, bag };
  }

  const run = new WorkflowRun({
    graph: ctx.graph,
    bag,
    adapters: ctx.adapters,
    entities: ctx.entities,
    relations: ctx.relations
  });

  for (let step = 0; step < maxStepsPerItem; step += 1) {
    if (run.bag.cursor === body.exitNodeId) {
      return { ok: true, bag: run.bag };
    }
    const result = await run.step();
    if (result.kind === "failed") {
      return { ok: false, error: result.message ?? `Foreach item ${index} failed.` };
    }
    if (result.kind !== "advanced") {
      return {
        ok: false,
        error: `Foreach item ${index} paused unexpectedly (${result.kind}).`
      };
    }
    if (run.bag.cursor === body.exitNodeId) {
      return { ok: true, bag: run.bag };
    }
  }

  return {
    ok: false,
    error: `Foreach item ${index} exceeded maxSteps before reaching exit '${body.exitNodeId}'.`
  };
}

export async function executeForeach(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const config = ctx.node.data.foreach;
  if (!config?.itemsFrom || !config.body) {
    return ctx.fail(`Foreach ${ctx.node.id} requires foreach.itemsFrom and foreach.body.`);
  }

  const items = ctx.read(config.itemsFrom);
  if (!Array.isArray(items)) {
    return ctx.fail(`Foreach ${ctx.node.id}: bag.${config.itemsFrom} must be an array.`);
  }

  const itemKey = config.itemKey ?? "item";
  const indexKey = config.indexKey ?? "index";
  const failureMode = config.failureMode ?? "fail";
  const collected: unknown[] = [];
  const maxStepsPerItem = 50;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    let outcome: { ok: true; bag: WorkflowContextBag } | { ok: false; error: string };

    if (config.body.type === "subworkflow") {
      outcome = await runSubworkflowBody(ctx, item, index, config.body, itemKey, indexKey);
    } else if (config.body.type === "subgraph") {
      outcome = await runSubgraphBody(
        ctx,
        item,
        index,
        config.body,
        itemKey,
        indexKey,
        maxStepsPerItem
      );
    } else {
      return ctx.fail(`Foreach ${ctx.node.id}: unsupported body type.`);
    }

    if (!outcome.ok) {
      if (failureMode === "continue") {
        continue;
      }
      return ctx.fail(outcome.error);
    }

    if (config.collect) {
      collected.push(collectValue(outcome.bag, config.collect.from));
    }
  }

  if (config.collect) {
    const as = config.collect.as;
    const writes = ctx.getWrites();
    if (writes.includes(as)) {
      const applied = ctx.applyWrites({ [as]: collected });
      if (!applied.ok) {
        return ctx.fail(applied.error);
      }
    } else {
      ctx.bag = {
        ...ctx.bag,
        keys: {
          ...ctx.bag.keys,
          [as]: collected
        }
      };
    }
  }

  return ctx.advance();
}
