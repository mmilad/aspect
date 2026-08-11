import {
  resolveInputBindings,
  serializeShapeSlim,
  type BagShape,
  type WorkflowBagKeyContract,
  type WorkflowNode,
  type WorkflowNodeData
} from "@projectplaner/core";
import { FormLabel, GhostButton, TextInput } from "../../ui";
import { PropPicker } from "../../workflow-workspace/workflow-bag-panel";

function shapeLabel(shape: BagShape | undefined): string {
  if (!shape) {
    return "unknown";
  }
  return serializeShapeSlim(shape);
}

function requiredLabel(contract: WorkflowBagKeyContract | undefined): string {
  return contract?.required === false ? "optional" : "required";
}

function bagKeyOptions(view: Record<string, BagShape>): string[] {
  return Object.keys(view).sort();
}

function identityFromPorts(ports: string[]): Record<string, string> {
  return Object.fromEntries(ports.map((portId) => [portId, portId]));
}

export function BagPortsEditor({
  selected,
  bagView,
  onUpdateData
}: {
  selected: WorkflowNode;
  bagView: Record<string, BagShape>;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
}) {
  const inputs = selected.data.inputs ?? {};
  const inputPorts = Object.keys(inputs);
  const inputBindings = resolveInputBindings(selected);

  const outputContracts = selected.data.outputContracts ?? {};
  const outputPorts = Object.keys(outputContracts);
  const writeBindings =
    selected.data.writeBindings !== undefined
      ? { ...selected.data.writeBindings }
      : identityFromPorts(outputPorts);
  const boundPorts = Object.keys(writeBindings).filter((portId) => writeBindings[portId]?.trim());
  const unboundOutputs = outputPorts.filter((portId) => !boundPorts.includes(portId));

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

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Inputs
        </div>
        <p className="text-[11px] text-muted-foreground">
          Port types come from the preset/code. Bind each input port to an upstream bag key.
        </p>
        {inputPorts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No input ports on this node (defined in preset/code).
          </p>
        ) : (
          inputPorts.map((portId) => {
            const contract = inputs[portId];
            return (
              <div
                key={`in-${portId}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] items-end gap-1"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-zinc-700">port</div>
                  <div className="truncate font-mono text-xs text-zinc-800">{portId}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {shapeLabel(contract?.shape)} · {requiredLabel(contract)}
                  </div>
                </div>
                <PropPicker
                  label="bag key"
                  value={inputBindings[portId] ?? portId}
                  options={bagKeyOptions(bagView)}
                  onChange={(value) => patchInputBinding(portId, value)}
                />
                <span className="pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {requiredLabel(contract)}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Writes
        </div>
        <p className="text-[11px] text-muted-foreground">
          Name the bag key on the left; the right shows which output port fills it.
        </p>
        {boundPorts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {outputPorts.length === 0
              ? "No output ports on this node (defined in preset/code)."
              : "No write bindings — bag keys are not registered from this step."}
          </p>
        ) : (
          boundPorts.map((portId) => {
            const contract = outputContracts[portId];
            return (
              <div
                key={`out-${portId}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-1"
              >
                <FormLabel label="bag key">
                  <TextInput
                    value={writeBindings[portId] ?? portId}
                    onChange={(event) => {
                      patchWriteBindings({
                        ...writeBindings,
                        [portId]: event.target.value
                      });
                    }}
                  />
                </FormLabel>
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-zinc-700">sets</div>
                  <div className="truncate font-mono text-xs text-zinc-800">{portId}</div>
                  <div className="text-[10px] text-muted-foreground">{shapeLabel(contract?.shape)}</div>
                </div>
                <GhostButton
                  size="xs"
                  tone="danger"
                  onClick={() => {
                    const next = { ...writeBindings };
                    delete next[portId];
                    patchWriteBindings(next);
                  }}
                >
                  ×
                </GhostButton>
              </div>
            );
          })
        )}
        {unboundOutputs.length > 0 ? (
          <GhostButton
            size="xs"
            onClick={() => {
              const portId = unboundOutputs[0]!;
              patchWriteBindings({
                ...writeBindings,
                [portId]: portId
              });
            }}
          >
            + bind output
          </GhostButton>
        ) : null}
      </div>
    </div>
  );
}
