import type { WorkflowBagKeyContract, WorkflowNodeData } from "@projectplaner/core";
import workflow from "@projectplaner/core/workflow";
import { nextUniqueName } from "../shared/names";
import { renameTemplateRoot } from "./rename-template-root";
import { canAuthorInputPorts, canAuthorOutputPorts } from "./port-policy";
import type { BagPortsEditorProps } from "./types";
import { identityFromPorts } from "./port-utils";

const { resolveInputBindings, normalizeNodePorts } = workflow.bag;

export function useBagPortActions({
  selected,
  onUpdateData,
  onRenameDataPort,
  onRemoveDataPort
}: BagPortsEditorProps) {
  const inputs = selected.data.inputs ?? {};
  const inputPorts = Object.keys(inputs);
  const inputBindings = resolveInputBindings(selected);
  const outputContracts = selected.data.outputContracts ?? {};
  const outputPorts = Object.keys(outputContracts);
  const writeBindings =
    selected.data.writeBindings !== undefined
      ? { ...selected.data.writeBindings }
      : identityFromPorts(outputPorts);

  function commitPorts(data: WorkflowNodeData) {
    const normalized = normalizeNodePorts({
      ...data,
      inputBindings: data.inputBindings ?? inputBindings,
      reads: [...new Set(Object.values(data.inputBindings ?? inputBindings))]
    });
    if (selected.type === "llm") {
      normalized.llm = {
        ...normalized.llm,
        inputKeys: Object.keys(normalized.inputs ?? {}),
        outputSchema: Object.keys(normalized.outputContracts ?? {})
      };
    }
    onUpdateData(normalized);
  }

  function patchInputBinding(portId: string, bagKey: string) {
    const next = { ...inputBindings, [portId]: bagKey };
    onUpdateData({
      inputBindings: next,
      reads: [...new Set(Object.values(next))]
    });
  }

  function patchWriteBindings(next: Record<string, string>) {
    const cleaned: Record<string, string> = {};
    for (const [portId, bagKey] of Object.entries(next)) {
      const trimmed = bagKey.trim();
      if (trimmed) {
        cleaned[portId] = trimmed;
      }
    }
    onUpdateData({
      writeBindings: cleaned,
      writes: [...new Set(Object.values(cleaned))]
    });
  }

  function patchInputContract(portId: string, contract: WorkflowBagKeyContract) {
    if (!canAuthorInputPorts(selected.type)) return;
    commitPorts({
      ...selected.data,
      inputs: { ...inputs, [portId]: contract }
    });
  }

  function patchOutputContract(portId: string, contract: WorkflowBagKeyContract) {
    if (!canAuthorOutputPorts(selected.type)) return;
    commitPorts({
      ...selected.data,
      outputContracts: { ...outputContracts, [portId]: contract }
    });
  }

  function renameInputPort(from: string, toRaw: string) {
    const to = toRaw.trim();
    if (!canAuthorInputPorts(selected.type) || !to || to === from || inputPorts.includes(to)) {
      return from;
    }
    const nextInputs = { ...inputs };
    nextInputs[to] = nextInputs[from] ?? { required: true, shape: { kind: "any" } };
    delete nextInputs[from];
    const nextBindings = { ...inputBindings, [to]: inputBindings[from] ?? from };
    delete nextBindings[from];
    const data = { ...selected.data, inputs: nextInputs, inputBindings: nextBindings };
    if (selected.type === "llm") {
      data.llm = { ...data.llm,
        systemPrompt: renameTemplateRoot(data.llm?.systemPrompt, from, to),
        instructions: renameTemplateRoot(data.llm?.instructions, from, to)
      };
    } else if (selected.type === "template") {
      data.template = renameTemplateRoot(data.template, from, to);
    }
    commitPorts(data);
    onRenameDataPort?.("in", from, to);
    return to;
  }

  function renameOutputPort(from: string, toRaw: string) {
    const to = toRaw.trim();
    if (!canAuthorOutputPorts(selected.type) || !to || to === from || outputPorts.includes(to)) {
      return from;
    }
    const nextContracts = { ...outputContracts };
    nextContracts[to] = nextContracts[from] ?? { required: true, shape: { kind: "any" } };
    delete nextContracts[from];
    const nextBindings = { ...writeBindings };
    if (from in writeBindings) nextBindings[to] = writeBindings[from]!;
    delete nextBindings[from];
    commitPorts({ ...selected.data, outputContracts: nextContracts, writeBindings: nextBindings });
    onRenameDataPort?.("out", from, to);
    return to;
  }

  function removeInputPort(portId: string) {
    if (!canAuthorInputPorts(selected.type)) return;
    const nextInputs = { ...inputs };
    delete nextInputs[portId];
    const nextBindings = { ...inputBindings };
    delete nextBindings[portId];
    commitPorts({ ...selected.data, inputs: nextInputs, inputBindings: nextBindings });
    onRemoveDataPort?.("in", portId);
  }

  function removeOutputPort(portId: string) {
    if (!canAuthorOutputPorts(selected.type)) return;
    const nextContracts = { ...outputContracts };
    delete nextContracts[portId];
    const nextBindings = { ...writeBindings };
    delete nextBindings[portId];
    commitPorts({ ...selected.data, outputContracts: nextContracts, writeBindings: nextBindings });
    onRemoveDataPort?.("out", portId);
  }

  function addInputPort() {
    if (!canAuthorInputPorts(selected.type)) return;
    const portId = nextUniqueName(inputPorts, "input");
    commitPorts({
      ...selected.data,
      inputs: { ...inputs, [portId]: { required: true, shape: { kind: "any" } } },
      inputBindings: { ...inputBindings, [portId]: portId }
    });
  }

  function addOutputPort() {
    if (!canAuthorOutputPorts(selected.type)) return;
    const portId = nextUniqueName(outputPorts, "output");
    commitPorts({
      ...selected.data,
      outputContracts: { ...outputContracts, [portId]: { required: true, shape: { kind: "any" } } },
      writeBindings: { ...writeBindings, [portId]: portId }
    });
  }

  return {
    inputs,
    inputPorts,
    inputBindings,
    outputContracts,
    outputPorts,
    writeBindings,
    patchInputBinding,
    patchWriteBindings,
    patchInputContract,
    patchOutputContract,
    renameInputPort,
    renameOutputPort,
    removeInputPort,
    removeOutputPort,
    addInputPort,
    addOutputPort
  };
}
