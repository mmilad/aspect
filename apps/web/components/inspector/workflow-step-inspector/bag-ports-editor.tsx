import {
  nullable,
  serializeShapeSlim,
  type BagShape,
  type WorkflowBagKeyContract,
  type WorkflowNode,
  type WorkflowNodeData
} from "@projectplaner/core";
import { FormLabel, GhostButton, Select, TextInput } from "../../ui";

const SHAPE_PRESETS: Array<{ value: string; label: string; shape: BagShape }> = [
  { value: "unknown", label: "unknown", shape: { kind: "unknown" } },
  { value: "any", label: "any", shape: { kind: "any" } },
  { value: "string", label: "string", shape: { kind: "primitive", type: "string" } },
  { value: "number", label: "number", shape: { kind: "primitive", type: "number" } },
  { value: "boolean", label: "boolean", shape: { kind: "primitive", type: "boolean" } },
  { value: "null", label: "null", shape: { kind: "primitive", type: "null" } },
  {
    value: "string|null",
    label: "string|null",
    shape: nullable({ kind: "primitive", type: "string" })
  },
  { value: "Entity", label: "Entity", shape: { kind: "ref", ref: "Entity" } },
  {
    value: "Entity[]",
    label: "Entity[]",
    shape: { kind: "array", items: { kind: "ref", ref: "Entity" } }
  },
  {
    value: "RankedTaskCandidate[]",
    label: "RankedTaskCandidate[]",
    shape: { kind: "array", items: { kind: "ref", ref: "RankedTaskCandidate" } }
  }
];

function shapeToPreset(shape: BagShape | undefined): string {
  if (!shape) {
    return "unknown";
  }
  const slim = serializeShapeSlim(shape);
  const match = SHAPE_PRESETS.find((preset) => serializeShapeSlim(preset.shape) === slim);
  return match?.value ?? slim;
}

function presetToShape(value: string): BagShape {
  return SHAPE_PRESETS.find((preset) => preset.value === value)?.shape ?? { kind: "unknown" };
}

function PortRow({
  portKey,
  contract,
  onChangeKey,
  onChangeContract,
  onRemove
}: {
  portKey: string;
  contract: WorkflowBagKeyContract;
  onChangeKey: (next: string) => void;
  onChangeContract: (next: WorkflowBagKeyContract) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-1">
      <FormLabel label="key">
        <TextInput value={portKey} onChange={(event) => onChangeKey(event.target.value.trim())} />
      </FormLabel>
      <FormLabel label="shape">
        <Select
          value={shapeToPreset(contract.shape)}
          onChange={(event) =>
            onChangeContract({
              ...contract,
              shape: presetToShape(event.target.value)
            })
          }
        >
          {SHAPE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </Select>
      </FormLabel>
      <FormLabel label="req">
        <Select
          value={contract.required === false ? "optional" : "required"}
          onChange={(event) =>
            onChangeContract({
              ...contract,
              required: event.target.value !== "optional"
            })
          }
        >
          <option value="required">yes</option>
          <option value="optional">no</option>
        </Select>
      </FormLabel>
      <GhostButton size="xs" tone="danger" onClick={onRemove}>
        ×
      </GhostButton>
    </div>
  );
}

export function BagPortsEditor({
  selected,
  onUpdateData
}: {
  selected: WorkflowNode;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const reads = selected.data.reads ?? [];
  const writes = selected.data.writes ?? [];
  const inputs = { ...(selected.data.inputs ?? {}) };
  const outputs = { ...(selected.data.outputContracts ?? {}) };

  function syncReads(nextReads: string[], nextInputs: Record<string, WorkflowBagKeyContract>) {
    onUpdateData({ reads: nextReads, inputs: nextInputs });
  }

  function syncWrites(nextWrites: string[], nextOutputs: Record<string, WorkflowBagKeyContract>) {
    onUpdateData({ writes: nextWrites, outputContracts: nextOutputs });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Input ports
        </div>
        <p className="text-[11px] text-muted-foreground">
          Bag keys this step reads. Config fields (e.g. llm.instructions) are separate.
        </p>
        {reads.map((key) => (
          <PortRow
            key={`in-${key}`}
            portKey={key}
            contract={inputs[key] ?? { required: true, shape: { kind: "unknown" } }}
            onChangeKey={(next) => {
              if (!next || next === key) {
                return;
              }
              const nextReads = reads.map((item) => (item === key ? next : item));
              const nextInputs = { ...inputs };
              nextInputs[next] = nextInputs[key] ?? { required: true, shape: { kind: "unknown" } };
              delete nextInputs[key];
              syncReads(nextReads, nextInputs);
            }}
            onChangeContract={(contract) => {
              syncReads(reads, { ...inputs, [key]: contract });
            }}
            onRemove={() => {
              const nextInputs = { ...inputs };
              delete nextInputs[key];
              syncReads(
                reads.filter((item) => item !== key),
                nextInputs
              );
            }}
          />
        ))}
        <GhostButton
          size="xs"
          onClick={() => {
            let name = "input";
            let i = 1;
            while (reads.includes(name)) {
              name = `input${i}`;
              i += 1;
            }
            syncReads([...reads, name], {
              ...inputs,
              [name]: { required: true, shape: { kind: "primitive", type: "string" } }
            });
          }}
        >
          Add input
        </GhostButton>
      </div>
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Output ports
        </div>
        <p className="text-[11px] text-muted-foreground">
          Bag keys this step writes. No separate update-bag node — writes are the bag API.
        </p>
        {writes.map((key) => (
          <PortRow
            key={`out-${key}`}
            portKey={key}
            contract={outputs[key] ?? { required: true, shape: { kind: "unknown" } }}
            onChangeKey={(next) => {
              if (!next || next === key) {
                return;
              }
              const nextWrites = writes.map((item) => (item === key ? next : item));
              const nextOutputs = { ...outputs };
              nextOutputs[next] = nextOutputs[key] ?? { required: true, shape: { kind: "unknown" } };
              delete nextOutputs[key];
              syncWrites(nextWrites, nextOutputs);
            }}
            onChangeContract={(contract) => {
              syncWrites(writes, { ...outputs, [key]: contract });
            }}
            onRemove={() => {
              const nextOutputs = { ...outputs };
              delete nextOutputs[key];
              syncWrites(
                writes.filter((item) => item !== key),
                nextOutputs
              );
            }}
          />
        ))}
        <GhostButton
          size="xs"
          onClick={() => {
            let name = "output";
            let i = 1;
            while (writes.includes(name)) {
              name = `output${i}`;
              i += 1;
            }
            syncWrites([...writes, name], {
              ...outputs,
              [name]: { required: true, shape: { kind: "primitive", type: "string" } }
            });
          }}
        >
          Add output
        </GhostButton>
      </div>
    </div>
  );
}
