import { compileWorkflow, isCompiledWorkflow } from "../compile";
import type { CompiledStep, CompiledWorkflow } from "../types";
import type { WorkflowGraph } from "../../../workflow";
import type { PromptRenderOptions, WorkflowPromptInput } from "./types";

function formatParams(params: Record<string, unknown>): string {
  try {
    return JSON.stringify(params);
  } catch {
    return String(params);
  }
}

function stepLine(step: CompiledStep, index: number): string | null {
  switch (step.kind) {
    case "goal":
      return null;
    case "instruction":
      return `${index}. ${step.text}`;
    case "function": {
      const hint = step.resultHint ? ` — ${step.resultHint}` : "";
      return `${index}. Call function \`${step.name}\` with params ${formatParams(step.params)}${hint}`;
    }
    case "write":
      return `${index}. Call function \`${step.action}\` with params ${formatParams(step.args)}`;
    case "llm": {
      const tools =
        step.tools && step.tools.length > 0
          ? ` (allowed tools: ${step.tools.map((t) => `\`${t}\``).join(", ")})`
          : "";
      return `${index}. ${step.instructions}${tools}`;
    }
    case "constraint":
      return `${index}. ${step.text}`;
    case "branch": {
      const thenPart = step.whenTrue ? `, then ${step.whenTrue}` : "";
      const elsePart = step.whenFalse ? `; otherwise ${step.whenFalse}` : "";
      return `${index}. If \`${step.condition}\`${thenPart}${elsePart}`;
    }
    case "loop":
      return `${index}. Loop${step.note ? `: ${step.note}` : ""} (reserved)`;
    case "subworkflow":
      return `${index}. Run subworkflow \`${step.workflowRef}\` (reserved)`;
    default:
      return null;
  }
}

function collectLlmReadKeys(compiled: CompiledWorkflow): string[] {
  const keys = new Set<string>();
  for (const step of compiled.steps) {
    if (step.kind === "llm") {
      for (const key of step.inputKeys ?? []) {
        keys.add(key);
      }
    }
  }
  return [...keys];
}

function resolveCompiled(input: WorkflowPromptInput, opts: PromptRenderOptions): CompiledWorkflow {
  if (isCompiledWorkflow(input)) {
    if (opts.goal || opts.title) {
      return {
        ...input,
        goal: opts.goal ?? input.goal,
        title: opts.title ?? input.title
      };
    }
    return input;
  }
  return compileWorkflow(input as WorkflowGraph, {
    goal: opts.goal,
    title: opts.title
  });
}

/**
 * Render a playbook-style prompt: ordered steps with named functions and params.
 */
export function renderWorkflowPrompt(
  input: WorkflowPromptInput,
  opts: PromptRenderOptions = {}
): string {
  const compiled = resolveCompiled(input, opts);
  const goal = opts.goal ?? compiled.goal ?? "{{goal}}";
  const lines: string[] = [];

  if (compiled.title || opts.title) {
    lines.push(`Workflow: ${opts.title ?? compiled.title}`);
    lines.push("");
  }

  lines.push(`You need to: ${goal}`);
  lines.push("");

  let stepIndex = 1;
  for (const step of compiled.steps) {
    if (step.kind === "goal") {
      continue;
    }
    const line = stepLine(step, stepIndex);
    if (line) {
      lines.push(line);
      stepIndex += 1;
    }
  }

  if (!opts.omitFunctionsAppendix && compiled.functions.length > 0) {
    lines.push("");
    lines.push("Available functions:");
    for (const fn of compiled.functions) {
      const desc = fn.description ? ` — ${fn.description}` : "";
      lines.push(`- \`${fn.name}\`${desc}`);
    }
  }

  if (opts.bag) {
    const readKeys = collectLlmReadKeys(compiled);
    if (readKeys.length > 0) {
      const slice: Record<string, unknown> = {};
      for (const key of readKeys) {
        if (key in opts.bag.keys) {
          slice[key] = opts.bag.keys[key];
        }
      }
      lines.push("");
      lines.push("Context (declared LLM reads only):");
      lines.push(JSON.stringify(slice, null, 2));
    }
  }

  lines.push("");
  lines.push("Follow the steps in order. Prefer the named functions and parameters above instead of inventing new tools.");

  return lines.join("\n");
}
