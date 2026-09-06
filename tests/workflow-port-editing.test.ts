import { describe, expect, it, vi } from "vitest";
import type { WorkflowNode } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";
import { useBagPortActions } from "../apps/web/components/inspector/workflow-step-inspector/ports/use-bag-port-actions";
import { canAuthorInputPorts, canAuthorOutputPorts } from "../apps/web/components/inspector/workflow-step-inspector/ports/port-policy";
import { renameTemplateRoot } from "../apps/web/components/inspector/workflow-step-inspector/ports/rename-template-root";
import { renameDataPortEdges, removeDataPortEdges } from "../apps/web/components/workflow-workspace/data-port-edges";
import { encodeHandle, type FlowRfEdge } from "../apps/web/components/workflow-workspace/rf-adapters";

function setup(type: WorkflowNode["type"] = "llm") {
  const selected: WorkflowNode = { id: "node", type, position: { x: 0, y: 0 }, data: {
    title: "Example", inputs: { value: { required: true } }, inputBindings: { value: "upstream" }, reads: ["upstream"],
    outputContracts: { result: { required: true } }, writeBindings: { result: "saved" }, writes: ["saved"],
    llm: { inputKeys: ["value"], outputSchema: ["result"], instructions: "{{value.name}}", systemPrompt: "{{ @value }}" },
    template: "Value {{value.name}}"
  } };
  const rename = vi.fn(); const remove = vi.fn(); const update = vi.fn((patch) => { selected.data = { ...selected.data, ...patch }; });
  const actions = () => useBagPortActions({ selected, bagView: {}, onUpdateData: update, onRenameDataPort: rename, onRemoveDataPort: remove });
  return { selected, actions, rename, remove, update };
}

describe("workflow port editing", () => {
  it("limits authoring to LLM ports and template inputs", () => {
    for (const type of workflow.nodes.workflowNodeTypes) {
      expect(canAuthorInputPorts(type)).toBe(type === "llm" || type === "template");
      expect(canAuthorOutputPorts(type)).toBe(type === "llm");
    }
    const h = setup("math");
    expect(h.actions().renameInputPort("value", "amount")).toBe("value");
    h.actions().removeInputPort("value"); h.actions().addOutputPort();
    expect(h.update).not.toHaveBeenCalled();
  });

  it("removes the last input without resurrecting legacy reads", () => {
    const h = setup(); h.actions().removeInputPort("value");
    expect(h.selected.data).toMatchObject({ inputs: {}, inputBindings: {}, reads: [], llm: { inputKeys: [] } });
    expect(h.selected.data.llm?.instructions).toBe("{{value.name}}");
    expect(h.remove).toHaveBeenCalledWith("in", "value");
    expect(workflow.bag.normalizeNodePorts({ title: "Legacy", reads: ["legacy"] }).inputBindings).toEqual({ legacy: "legacy" });
  });

  it("preserves other bindings and synchronizes catalogs through add/remove", () => {
    const h = setup(); h.actions().addInputPort(); h.actions().removeInputPort("value");
    expect(h.selected.data.reads).toEqual(["input1"]);
    expect(h.selected.data.llm?.inputKeys).toEqual(["input1"]);
    h.actions().addOutputPort(); h.actions().removeOutputPort("result");
    expect(h.selected.data.writeBindings).toEqual({ output1: "output1" });
    expect(h.selected.data.llm?.outputSchema).toEqual(["output1"]);
    h.actions().removeOutputPort("output1");
    expect(h.selected.data.writes).toEqual([]);
    expect(h.selected.data.llm?.outputSchema).toEqual([]);
  });

  it("renames ports while preserving bindings and updating inline references", () => {
    const h = setup(); expect(h.actions().renameInputPort("value", " amount ")).toBe("amount");
    expect(h.selected.data.inputBindings).toEqual({ amount: "upstream" });
    expect(h.selected.data.llm).toMatchObject({ inputKeys: ["amount"], instructions: "{{amount.name}}", systemPrompt: "{{ @amount }}" });
    h.actions().renameOutputPort("result", "answer");
    expect(h.selected.data.writeBindings).toEqual({ answer: "saved" });
    expect(h.selected.data.llm?.outputSchema).toEqual(["answer"]);
    expect(h.rename).toHaveBeenCalledWith("out", "result", "answer");
    const template = setup("template"); template.actions().renameInputPort("value", "item");
    expect(template.selected.data.template).toBe("Value {{item.name}}");
  });

  it("returns the original displayed name for empty, duplicate and unchanged edits", () => {
    const h = setup(); h.selected.data.inputs!.other = {};
    for (const name of ["", "  ", "other", "value"]) expect(h.actions().renameInputPort("value", name)).toBe("value");
    expect(h.actions().renameOutputPort("result", " ")).toBe("result");
    expect(h.update).not.toHaveBeenCalled(); expect(h.rename).not.toHaveBeenCalled();
  });

  it("resolves shape warnings through preserved bag bindings after rename", () => {
    const h = setup();
    const shape = { kind: "primitive" as const, type: "string" as const };
    h.selected.data.inputs!.value!.shape = shape;
    h.actions().renameInputPort("value", "amount");
    const producer: WorkflowNode = { id: "start", type: "start", position: { x: 0, y: 0 }, data: {
      title: "Start", writes: ["upstream"], outputContracts: { upstream: { required: true, shape } }
    } };
    expect(workflow.bag.warnShapeMismatches({ version: workflow.nodes.WORKFLOW_SCHEMA_VERSION,
      nodes: [producer, h.selected], edges: [{ id: "exec", source: "start", target: "node", kind: "next" }]
    })).toEqual([]);
  });

  it("preserves unrelated text and special blocks when rewriting tokens", () => {
    expect(renameTemplateRoot("value {{value}} {{ value.name }} {{@value.id}} {{values}} {{@reads}} {{@shapes}}", "value", "item"))
      .toBe("value {{item}} {{ item.name }} {{@item.id}} {{values}} {{@reads}} {{@shapes}}");
    expect(renameTemplateRoot("{{@reads}} {{reads}}", "reads", "items")).toBe("{{@reads}} {{items}}");
  });

  it("renames/removes only matching data edges in either direction", () => {
    for (const direction of ["in", "out"] as const) {
      const edge: FlowRfEdge = { id: "data", source: "node", target: "node", sourceHandle: encodeHandle("out", "value", "data"), targetHandle: encodeHandle("in", "value", "data"), data: { kind: "data" } };
      const exec: FlowRfEdge = { ...edge, id: "exec", data: { kind: "next" } };
      const unrelated: FlowRfEdge = { ...edge, id: "other", source: "elsewhere", target: "elsewhere" };
      const edges = [edge, exec, unrelated];
      const renamed = renameDataPortEdges(edges, "node", direction, "value", "amount");
      expect(renamed[0]?.[direction === "in" ? "targetHandle" : "sourceHandle"]).toBe(encodeHandle(direction, "amount", "data"));
      expect(renamed.slice(1)).toEqual([exec, unrelated]);
      expect(removeDataPortEdges(renamed, "node", direction, "amount")).toEqual([exec, unrelated]);
    }
  });
});
