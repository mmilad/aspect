import { resolveWorkflowLlmSystemPrompt } from "../../llm-defaults";
import { resolveLlmNodeFormat } from "../../llm-format";
import { resolveLlmOutputContracts } from "../../llm-outputs";
import {
  pickBagByInputPorts,
  resolveInputBindings,
  derivedReads
} from "../../ports";
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

  const formatResolved = await resolveLlmNodeFormat({
    format: llm.format,
    schemaKey: llm.schemaKey,
    adapters: ctx.adapters
  });
  if (!formatResolved.ok) {
    return ctx.fail(`LLM node ${ctx.node.id}: ${formatResolved.error}`);
  }
  if (formatResolved.format === "json_schema") {
    const { keys } = resolveLlmOutputContracts(ctx.node);
    if (keys.length === 0) {
      return ctx.fail(
        `LLM node ${ctx.node.id} with schemaKey needs a write port for the JSON response.`
      );
    }
  }

  // Port ids (templates + pending_llm.reads are port-keyed).
  const portIds =
    llm.inputKeys && llm.inputKeys.length > 0
      ? llm.inputKeys
      : Object.keys(ctx.node.data.inputs ?? {}).length > 0
        ? Object.keys(ctx.node.data.inputs ?? {})
        : (ctx.node.data.reads ?? []);

  const inputBindings = resolveInputBindings(ctx.node);
  const bagKeysForSlim = portIds.map((portId) => inputBindings[portId] ?? portId);
  const portReads = pickBagByInputPorts(ctx.node, ctx.bag.keys, portIds);
  // Template fill: expose both port ids and bag keys so {{title}} works either way.
  const templateKeys: Record<string, unknown> = { ...ctx.bag.keys, ...portReads };
  const shapesByBagKey = slimShapesForReads(ctx.graph, ctx.node.id, bagKeysForSlim).keys;
  const shapes: Record<string, string> = {};
  for (const portId of portIds) {
    const bagKey = inputBindings[portId] ?? portId;
    shapes[portId] = shapesByBagKey[bagKey] ?? "unknown";
  }
  const templateOpts = {
    keys: templateKeys,
    allowedKeys: [...new Set([...portIds, ...derivedReads(ctx.node), ...Object.keys(ctx.bag.keys)])],
    shapes: { ...shapesByBagKey, ...shapes }
  };
  const renderedSystem = renderBagTemplate(resolveWorkflowLlmSystemPrompt(llm.systemPrompt), templateOpts);
  const rendered = renderBagTemplate(instructions, templateOpts);
  const warnings = [...renderedSystem.warnings, ...rendered.warnings];

  const { keys: outputSchema, outputs: contracts } = resolveLlmOutputContracts(ctx.node);
  const outputs: NonNullable<WorkflowLlmPending["outputs"]> = {};
  for (const [key, contract] of Object.entries(contracts)) {
    outputs[key] = {
      shape: contract.shape,
      required: contract.required,
      slim: serializeShapeSlim(contract.shape)
    };
  }

  const resolved = formatResolved.resolved;

  return {
    kind: "pending_llm",
    bag: { ...ctx.bag, status: "pending_llm", cursor: ctx.node.id },
    nodeId: ctx.node.id,
    message: "LLM step requires external completion.",
    llm: {
      nodeId: ctx.node.id,
      systemPrompt: renderedSystem.text,
      instructions: rendered.text,
      reads: portReads,
      shapes,
      outputSchema,
      outputs,
      tools: llm.tools ?? [],
      format: formatResolved.format,
      ...(formatResolved.schemaKey ? { schemaKey: formatResolved.schemaKey } : {}),
      ...(resolved
        ? {
            jsonSchema: resolved.schema,
            jsonSchemaVersion: resolved.version,
            ...(resolved.id ? { jsonSchemaId: resolved.id } : {})
          }
        : {}),
      ...(warnings.length > 0 ? { warnings } : {})
    }
  };
}
