import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

function waitKey(nodeId: string): string {
  return `__waitUntil_${nodeId}`;
}

export async function executeWait(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const wait = ctx.node.data.wait ?? {};
  const now = Date.now();

  if (wait.until) {
    const untilMs = Date.parse(wait.until);
    if (Number.isNaN(untilMs)) {
      return ctx.fail(`Wait ${ctx.node.id}: invalid until timestamp '${wait.until}'.`);
    }
    if (now >= untilMs) {
      return ctx.advance();
    }
    return {
      kind: "pending_user",
      bag: { ...ctx.bag, status: "waiting", cursor: ctx.node.id },
      nodeId: ctx.node.id,
      message: "Waiting"
    };
  }

  const delayMs = wait.delayMs;
  if (delayMs === undefined || delayMs === 0) {
    return ctx.advance();
  }

  if (delayMs < 0) {
    return ctx.fail(`Wait ${ctx.node.id}: delayMs must be >= 0.`);
  }

  const key = waitKey(ctx.node.id);
  const existing = ctx.read(key);
  if (typeof existing !== "number") {
    const until = now + delayMs;
    return {
      kind: "pending_user",
      bag: {
        ...ctx.bag,
        status: "waiting",
        cursor: ctx.node.id,
        keys: {
          ...ctx.bag.keys,
          [key]: until
        }
      },
      nodeId: ctx.node.id,
      message: "Waiting"
    };
  }

  if (now >= existing) {
    const keys = { ...ctx.bag.keys };
    delete keys[key];
    ctx.bag = { ...ctx.bag, keys, status: "running" };
    return ctx.advance();
  }

  return {
    kind: "pending_user",
    bag: { ...ctx.bag, status: "waiting", cursor: ctx.node.id },
    nodeId: ctx.node.id,
    message: "Waiting"
  };
}
