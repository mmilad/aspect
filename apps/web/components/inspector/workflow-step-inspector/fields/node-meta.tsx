"use client";

import type { WorkflowNode } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";

const { getNodeModel } = workflow.nodes;

export function NodeMeta({ selected }: { selected: WorkflowNode }) {
  const model = getNodeModel(selected.type);
  const execInputs = model.execInputs?.(selected) ?? ["in"];
  const execOutputs = model.execOutputs?.(selected) ?? ["then"];
  const inputDescriptions = model.execInputDescriptions?.(selected) ?? {};
  const outputDescriptions = model.execOutputDescriptions?.(selected) ?? {};

  if (!model.description && execInputs.length === 0 && execOutputs.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-2 text-[11px] text-zinc-700">
      {model.description ? <div className="leading-snug">{model.description}</div> : null}
      <div className="mt-2 grid gap-1">
        {execInputs.map((pin) => (
          <div key={`in:${pin}`}>
            <span className="font-mono text-zinc-900">in:{pin}</span>
            {inputDescriptions[pin] ? <span> - {inputDescriptions[pin]}</span> : null}
          </div>
        ))}
        {execOutputs.map((pin) => (
          <div key={`out:${pin}`}>
            <span className="font-mono text-zinc-900">out:{pin}</span>
            {outputDescriptions[pin] ? <span> - {outputDescriptions[pin]}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
