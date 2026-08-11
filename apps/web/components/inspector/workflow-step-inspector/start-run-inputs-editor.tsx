"use client";

import { useEffect, useState } from "react";
import {
  serializeShapeSlim,
  type BagShape,
  type WorkflowBagKeyContract,
  type WorkflowNode,
  type WorkflowNodeData
} from "@projectplaner/core";
import { FormLabel, GhostButton, Select, TextInput } from "../../ui";

const STRING: BagShape = { kind: "primitive", type: "string" };
const NUMBER: BagShape = { kind: "primitive", type: "number" };
const BOOLEAN: BagShape = { kind: "primitive", type: "boolean" };
const NULLABLE_STRING: BagShape = {
  kind: "union",
  options: [STRING, { kind: "primitive", type: "null" }]
};

type ShapePreset = "string" | "number" | "boolean" | "string|null";

function shapePreset(shape: BagShape | undefined): ShapePreset {
  if (!shape) {
    return "string";
  }
  const slim = serializeShapeSlim(shape);
  if (slim === "number") {
    return "number";
  }
  if (slim === "boolean") {
    return "boolean";
  }
  if (slim === "string|null") {
    return "string|null";
  }
  return "string";
}

function shapeFromPreset(preset: ShapePreset): BagShape {
  switch (preset) {
    case "number":
      return NUMBER;
    case "boolean":
      return BOOLEAN;
    case "string|null":
      return NULLABLE_STRING;
    default:
      return STRING;
  }
}

function contractsFromNode(selected: WorkflowNode): Record<string, WorkflowBagKeyContract> {
  const existing = selected.data.outputContracts ?? {};
  if (Object.keys(existing).length > 0) {
    return { ...existing };
  }
  const writes = selected.data.writes ?? [];
  const seeded: Record<string, WorkflowBagKeyContract> = {};
  for (const key of writes) {
    seeded[key] = {
      required: false,
      shape: key === "goal" ? STRING : STRING
    };
  }
  return seeded;
}

function syncStartOutputs(
  contracts: Record<string, WorkflowBagKeyContract>
): Pick<WorkflowNodeData, "outputContracts" | "writeBindings" | "writes"> {
  const writeBindings = Object.fromEntries(Object.keys(contracts).map((portId) => [portId, portId]));
  return {
    outputContracts: contracts,
    writeBindings,
    writes: Object.keys(writeBindings)
  };
}

function RunInputRow({
  portId,
  contract,
  onRename,
  onPatch,
  onRemove
}: {
  portId: string;
  contract: WorkflowBagKeyContract;
  onRename: (nextName: string) => void;
  onPatch: (patch: WorkflowBagKeyContract) => void;
  onRemove: () => void;
}) {
  const [draftName, setDraftName] = useState(portId);
  useEffect(() => {
    setDraftName(portId);
  }, [portId]);

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] items-end gap-1">
      <FormLabel label="name">
        <TextInput
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={() => onRename(draftName)}
        />
      </FormLabel>
      <FormLabel label="shape">
        <Select
          value={shapePreset(contract.shape)}
          onChange={(event) =>
            onPatch({
              ...contract,
              shape: shapeFromPreset(event.target.value as ShapePreset)
            })
          }
        >
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="string|null">string|null</option>
        </Select>
      </FormLabel>
      <label className="flex items-center gap-1 pb-1 text-[11px] text-zinc-700">
        <input
          type="checkbox"
          checked={contract.required === true}
          onChange={(event) =>
            onPatch({
              ...contract,
              required: event.target.checked,
              shape: contract.shape ?? STRING
            })
          }
        />
        req
      </label>
      <GhostButton size="xs" tone="danger" onClick={onRemove}>
        ×
      </GhostButton>
    </div>
  );
}

/** Author Start run inputs (= outputContracts published into the bag). */
export function StartRunInputsEditor({
  selected,
  onUpdateData
}: {
  selected: WorkflowNode;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const contracts = contractsFromNode(selected);
  const portIds = Object.keys(contracts);

  function commit(next: Record<string, WorkflowBagKeyContract>) {
    onUpdateData(syncStartOutputs(next));
  }

  function renamePort(from: string, toRaw: string) {
    const to = toRaw.trim();
    if (!to || to === from) {
      return;
    }
    if (to in contracts) {
      return;
    }
    const next: Record<string, WorkflowBagKeyContract> = {};
    for (const [portId, contract] of Object.entries(contracts)) {
      next[portId === from ? to : portId] = contract;
    }
    commit(next);
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Run inputs
      </div>
      <p className="text-[11px] text-muted-foreground">
        Declares bag keys the caller must supply when starting this workflow. Start has no upstream
        ports — these are the workflow inputs.
      </p>
      {portIds.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No run inputs yet.</p>
      ) : (
        portIds.map((portId) => (
          <RunInputRow
            key={portId}
            portId={portId}
            contract={contracts[portId]!}
            onRename={(nextName) => renamePort(portId, nextName)}
            onPatch={(patch) => commit({ ...contracts, [portId]: patch })}
            onRemove={() => {
              const next = { ...contracts };
              delete next[portId];
              commit(next);
            }}
          />
        ))
      )}
      <GhostButton
        size="xs"
        onClick={() => {
          let name = "input";
          let n = 1;
          while (name in contracts) {
            name = `input_${n}`;
            n += 1;
          }
          commit({
            ...contracts,
            [name]: { required: false, shape: STRING }
          });
        }}
      >
        + run input
      </GhostButton>
    </div>
  );
}
