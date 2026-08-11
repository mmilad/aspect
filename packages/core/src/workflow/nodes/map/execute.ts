import { applyBagWrites } from "../../graph/schema";
import { projectMapFields } from "../../runtime/helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "../../runtime/types";

export async function executeMap(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const map = ctx.node.data.map;
  if (!map?.from || !map.as || !map.fields?.length) {
    return ctx.fail("Map node requires map.from, map.as, and map.fields.");
  }
  const source = ctx.read(map.from);
  const mode = map.mode ?? (Array.isArray(source) ? "array" : "object");
  let value: unknown;
  if (mode === "array") {
    if (!Array.isArray(source)) {
      return ctx.fail(`Map ${ctx.node.id}: bag.${map.from} must be an array when mode=array.`);
    }
    value = source.map((item) => projectMapFields(item, map.fields));
  } else {
    if (typeof source !== "object" || source === null || Array.isArray(source)) {
      return ctx.fail(`Map ${ctx.node.id}: bag.${map.from} must be an object when mode=object.`);
    }
    value = projectMapFields(source, map.fields);
  }
  const applied = applyBagWrites(ctx.bag, [map.as], { [map.as]: value });
  if (!applied.ok) {
    return ctx.fail(applied.error);
  }
  ctx.bag = applied.bag;
  return ctx.advance();
}
