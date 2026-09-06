"use client";

import { Button, FormLabel, Input } from "../../../ui";
import { PropPicker } from "../../../workflow-workspace/workflow-bag-panel";
import { RequiredToggle, ShapeSelect, requiredLabel, shapeLabel } from "../shared";
import { canAuthorInputPorts, canAuthorOutputPorts } from "./port-policy";
import { bagKeyOptions } from "../shared/bag-options";
import type { BagPortsEditorProps } from "./types";
import { useBagPortActions } from "./use-bag-port-actions";

export function BagPortsEditor(props: BagPortsEditorProps) {
  const { selected, bagView } = props;
  const {
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
  } = useBagPortActions(props);

  const canAuthorInputs = canAuthorInputPorts(selected.type);
  const canAuthorOutputs = canAuthorOutputPorts(selected.type);
  const boundPorts = Object.keys(writeBindings).filter((portId) => writeBindings[portId]?.trim());
  const unboundOutputs = outputPorts.filter((portId) => !boundPorts.includes(portId));
  const displayedOutputPorts = canAuthorOutputs ? outputPorts : boundPorts;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Inputs
        </div>
        <p className="text-[11px] text-muted-foreground">
          {canAuthorInputs ? "Edit input ports and bind them to upstream bag keys." : "Input ports are defined by code/configuration. Bind them to upstream bag keys."}
        </p>
        {inputPorts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {canAuthorInputs ? "No input ports yet." : "No input ports on this node (defined in preset/code)."}
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
                  {canAuthorInputs ? (
                    <Input
                      key={`rename-in-${portId}`}
                      className="font-mono text-xs"
                      defaultValue={portId}
                      onBlur={(event) => { event.target.value = renameInputPort(portId, event.target.value); }}
                    />
                  ) : (
                    <div className="truncate font-mono text-xs text-zinc-800">{portId}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {shapeLabel(contract?.shape)} - {requiredLabel(contract)}
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
                {canAuthorInputs ? (
                  <div className="col-span-3 flex items-center gap-2">
                    <ShapeSelect
                      shape={contract?.shape}
                      onChange={(shape) => patchInputContract(portId, { ...(contract ?? {}), shape })}
                    />
                    <RequiredToggle
                      checked={contract?.required !== false}
                      onChange={(required) => patchInputContract(portId, { ...(contract ?? {}), required })}
                    />
                    <Button size="xs" variant="danger" onClick={() => removeInputPort(portId)}>
                      remove
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        {canAuthorInputs ? (
          <Button size="xs" variant="outline" onClick={addInputPort}>
            + input port
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Writes
        </div>
        <p className="text-[11px] text-muted-foreground">
          {canAuthorOutputs ? "Edit output ports and the bag keys they fill." : "Output ports are defined by code/configuration. Choose the bag keys they fill."}
        </p>
        {displayedOutputPorts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            {outputPorts.length === 0
              ? canAuthorOutputs
                ? "No output ports yet."
                : "No output ports on this node (defined in preset/code)."
              : "No write bindings - bag keys are not registered from this step."}
          </p>
        ) : (
          displayedOutputPorts.map((portId) => {
            const contract = outputContracts[portId];
            return (
              <div
                key={`out-${portId}`}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-1"
              >
                <FormLabel label="bag key">
                  <Input
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
                  {canAuthorOutputs ? (
                    <Input
                      key={`rename-out-${portId}`}
                      className="font-mono text-xs"
                      defaultValue={portId}
                      onBlur={(event) => { event.target.value = renameOutputPort(portId, event.target.value); }}
                    />
                  ) : (
                    <div className="truncate font-mono text-xs text-zinc-800">{portId}</div>
                  )}
                  <div className="text-[10px] text-muted-foreground">{shapeLabel(contract?.shape)}</div>
                </div>
                <Button
                  size="xs"
                  variant="danger"
                  onClick={() => {
                    if (canAuthorOutputs) {
                      removeOutputPort(portId);
                    } else {
                      const next = { ...writeBindings };
                      delete next[portId];
                      patchWriteBindings(next);
                    }
                  }}
                >
                  {canAuthorOutputs ? "remove" : "x"}
                </Button>
                {canAuthorOutputs ? (
                  <div className="col-span-3 flex items-center gap-2">
                    <ShapeSelect
                      shape={contract?.shape}
                      onChange={(shape) => patchOutputContract(portId, { ...(contract ?? {}), shape })}
                    />
                    <RequiredToggle
                      checked={contract?.required !== false}
                      onChange={(required) => patchOutputContract(portId, { ...(contract ?? {}), required })}
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
        {unboundOutputs.length > 0 ? (
          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              const portId = unboundOutputs[0]!;
              patchWriteBindings({
                ...writeBindings,
                [portId]: portId
              });
            }}
          >
            + bind output
          </Button>
        ) : null}
        {canAuthorOutputs ? (
          <Button size="xs" variant="outline" onClick={addOutputPort}>
            + output port
          </Button>
        ) : null}
      </div>
    </div>
  );
}
