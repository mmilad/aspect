import { pickBagKeys } from "../../graph/schema";
import { resolveWorkflowLlmSystemPrompt } from "../../llm-defaults";
import { resolveLlmOutputContracts } from "../../llm-outputs";
import { slimShapesForReads, serializeShapeSlim } from "../../shapes";
import { renderBagTemplate } from "../../template";
import type { NodeExecuteContext, WorkflowLlmPending, WorkflowStepResult } from "../../runtime/types";

export async function executeLlm(ctx: NodeExecuteContext): Promise<WorkflowStepResult> {
  const llm = ctx.node.data.llm ?? {};
  let instructions = llm.instructions ?? "";
  if (!instructions && llm.instructionRef) {
    instructions = (await ctx.adapters.resolveInstruction?.(llm.instructionRef)) ?? "";
  }
  if (!instructions.trim()) {
    return ctx.fail(`LLM node ${ctx.node.id} requires instructions or instructionRef.`);
  }

  const inputKeys = llm.inputKeys ?? ctx.node.data.reads ?? [];
  const { keys: outputSchema, outputs: contracts } = resolveLlmOutputContracts(ctx.node);
  const reads = pickBagKeys(ctx.bag, inputKeys);
  const shapes = slimShapesForReads(ctx.graph, ctx.node.id, inputKeys).keys;
  const templateOpts = {
    keys: ctx.bag.keys,
    allowedKeys: inputKeys,
    shapes
  };
  const renderedSystem = renderBagTemplate(resolveWorkflowLlmSystemPrompt(llm.systemPrompt), templateOpts);
  const rendered = renderBagTemplate(instructions, templateOpts);
  const warnings = [...renderedSystem.warnings, ...rendered.warnings];

  const outputs: NonNullable<WorkflowLlmPending["outputs"]> = {};
  for (const [key, contract] of Object.entries(contracts)) {
    outputs[key] = {
      shape: contract.shape,
      required: contract.required,
      slim: serializeShapeSlim(contract.shape)
    };
  }

  return {
    kind: "pending_llm",
    bag: { ...ctx.bag, status: "pending_llm", cursor: ctx.node.id },
    nodeId: ctx.node.id,
    message: "LLM step requires external completion.",
    llm: {
      nodeId: ctx.node.id,
      systemPrompt: renderedSystem.text,
      instructions: rendered.text,
      reads,
      shapes,
      outputSchema,
      outputs,
      tools: llm.tools ?? [],
      ...(warnings.length > 0 ? { warnings } : {})
    }
  };
}
