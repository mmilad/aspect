"use client";

import {
  listShapePaths,
  workflowNodeTypes,
  type BagShape,
  type WorkflowMapField,
  type WorkflowNode,
  type WorkflowNodeData,
  type WorkflowNodeType
} from "@projectplaner/core";
import { FormLabel, GhostButton, Select, TextArea, TextInput } from "../../ui";
import { PropPicker, WorkflowBagPanel } from "../workflow-bag-panel";

interface WorkflowNodeInspectorProps {
  selected: WorkflowNode | null;
  bagView: Record<string, BagShape>;
  onUpdateData: (patch: Partial<WorkflowNodeData>) => void;
  onUpdateType: (type: WorkflowNodeType) => void;
  onDelete: () => void;
}

function bagKeyOptions(view: Record<string, BagShape>): string[] {
  return Object.keys(view).sort();
}

function pathOptionsForKey(view: Record<string, BagShape>, key: string): string[] {
  return listShapePaths(view[key]);
}

export function WorkflowNodeInspector({
  selected,
  bagView,
  onUpdateData,
  onUpdateType,
  onDelete
}: WorkflowNodeInspectorProps) {
  const highlight =
    selected?.type === "foreach"
      ? [selected.data.foreach?.itemKey ?? "item", selected.data.foreach?.indexKey ?? "index"]
      : [];

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-border bg-white p-3">
      <div className="mb-3">
        <WorkflowBagPanel view={bagView} highlightKeys={highlight} />
      </div>
      {!selected ? (
        <p className="text-sm text-muted-foreground">
          Select a step to edit title, reads/writes, control config, and execution policy.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Node</div>
            <div className="font-mono text-xs text-zinc-700">{selected.id}</div>
          </div>
          <FormLabel label="Type">
            <Select value={selected.type} onChange={(event) => onUpdateType(event.target.value as WorkflowNodeType)}>
              {workflowNodeTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </FormLabel>
          <FormLabel label="Title">
            <TextInput value={selected.data.title} onChange={(event) => onUpdateData({ title: event.target.value })} />
          </FormLabel>
          <FormLabel label="Reads (comma)">
            <TextInput
              value={(selected.data.reads ?? []).join(", ")}
              onChange={(event) =>
                onUpdateData({
                  reads: event.target.value
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean)
                })
              }
            />
          </FormLabel>
          <FormLabel label="Writes (comma)">
            <TextInput
              value={(selected.data.writes ?? []).join(", ")}
              onChange={(event) =>
                onUpdateData({
                  writes: event.target.value
                    .split(",")
                    .map((part) => part.trim())
                    .filter(Boolean)
                })
              }
            />
          </FormLabel>
          {selected.type === "llm" ? (
            <FormLabel label="LLM instructions">
              <TextArea
                className="min-h-28"
                value={selected.data.llm?.instructions ?? ""}
                onChange={(event) =>
                  onUpdateData({
                    llm: {
                      ...(selected.data.llm ?? {}),
                      instructions: event.target.value,
                      inputKeys: selected.data.reads ?? selected.data.llm?.inputKeys,
                      outputSchema: selected.data.writes ?? selected.data.llm?.outputSchema
                    }
                  })
                }
              />
            </FormLabel>
          ) : null}
          {selected.type === "tool" ? (
            <>
              <FormLabel label="Tool name">
                <TextInput
                  value={selected.data.tool?.name ?? ""}
                  onChange={(event) =>
                    onUpdateData({
                      tool: {
                        ...(selected.data.tool ?? { name: "" }),
                        name: event.target.value
                      }
                    })
                  }
                />
              </FormLabel>
              <PropPicker
                label="Arg from bag (first mapping value)"
                value={Object.values(selected.data.tool?.argsFromBag ?? {})[0] ?? ""}
                options={bagKeyOptions(bagView)}
                onChange={(value) => {
                  const keys = Object.keys(selected.data.tool?.argsFromBag ?? {});
                  const argName = keys[0] ?? "value";
                  onUpdateData({
                    tool: {
                      ...(selected.data.tool ?? { name: "" }),
                      argsFromBag: { ...(selected.data.tool?.argsFromBag ?? {}), [argName]: value }
                    }
                  });
                }}
              />
            </>
          ) : null}
          {selected.type === "transform" ? (
            <PropPicker
              label="Filter from"
              value={selected.data.auto?.filter?.from ?? ""}
              options={bagKeyOptions(bagView)}
              onChange={(value) =>
                onUpdateData({
                  auto: {
                    ...(selected.data.auto ?? {}),
                    filter: {
                      ...(selected.data.auto?.filter ?? { from: value }),
                      from: value
                    }
                  }
                })
              }
            />
          ) : null}
          {selected.type === "branch" ? (
            <PropPicker
              label="Branch on (bag key)"
              value={selected.data.branch?.on ?? ""}
              options={bagKeyOptions(bagView)}
              onChange={(value) => onUpdateData({ branch: { on: value } })}
            />
          ) : null}
          {selected.type === "switch" ? (
            <>
              <PropPicker
                label="Switch on (bag key)"
                value={selected.data.switch?.on ?? ""}
                options={bagKeyOptions(bagView)}
                onChange={(value) =>
                  onUpdateData({
                    switch: {
                      on: value,
                      cases: selected.data.switch?.cases,
                      defaultLabel: selected.data.switch?.defaultLabel ?? "default"
                    }
                  })
                }
              />
              <FormLabel label="Default route label">
                <TextInput
                  value={selected.data.switch?.defaultLabel ?? "default"}
                  onChange={(event) =>
                    onUpdateData({
                      switch: {
                        on: selected.data.switch?.on,
                        cases: selected.data.switch?.cases,
                        defaultLabel: event.target.value || "default"
                      }
                    })
                  }
                />
              </FormLabel>
            </>
          ) : null}
          {selected.type === "foreach" ? (
            <>
              <PropPicker
                label="Items from"
                value={selected.data.foreach?.itemsFrom ?? ""}
                options={bagKeyOptions(bagView)}
                onChange={(value) =>
                  onUpdateData({
                    foreach: {
                      itemsFrom: value,
                      body: selected.data.foreach?.body ?? {
                        type: "subworkflow",
                        workflowId: ""
                      },
                      failureMode: selected.data.foreach?.failureMode ?? "fail",
                      collect: selected.data.foreach?.collect
                    }
                  })
                }
              />
              <FormLabel label="Body subworkflow id">
                <TextInput
                  value={
                    selected.data.foreach?.body?.type === "subworkflow"
                      ? selected.data.foreach.body.workflowId
                      : ""
                  }
                  onChange={(event) =>
                    onUpdateData({
                      foreach: {
                        itemsFrom: selected.data.foreach?.itemsFrom ?? "",
                        body: { type: "subworkflow", workflowId: event.target.value },
                        failureMode: selected.data.foreach?.failureMode ?? "fail",
                        collect: selected.data.foreach?.collect
                      }
                    })
                  }
                />
              </FormLabel>
              <FormLabel label="Failure mode">
                <Select
                  value={selected.data.foreach?.failureMode ?? "fail"}
                  onChange={(event) =>
                    onUpdateData({
                      foreach: {
                        itemsFrom: selected.data.foreach?.itemsFrom ?? "",
                        body: selected.data.foreach?.body ?? { type: "subworkflow", workflowId: "" },
                        failureMode: event.target.value as "fail" | "continue",
                        collect: selected.data.foreach?.collect
                      }
                    })
                  }
                >
                  <option value="fail">fail</option>
                  <option value="continue">continue</option>
                </Select>
              </FormLabel>
            </>
          ) : null}
          {selected.type === "map" ? (
            <>
              <PropPicker
                label="Map from"
                value={selected.data.map?.from ?? ""}
                options={bagKeyOptions(bagView)}
                onChange={(value) =>
                  onUpdateData({
                    map: {
                      from: value,
                      as: selected.data.map?.as ?? "projected",
                      mode: selected.data.map?.mode ?? "array",
                      fields: selected.data.map?.fields ?? []
                    },
                    writes: selected.data.writes?.includes(selected.data.map?.as ?? "projected")
                      ? selected.data.writes
                      : [...(selected.data.writes ?? []), selected.data.map?.as ?? "projected"]
                  })
                }
              />
              <FormLabel label="Write as">
                <TextInput
                  value={selected.data.map?.as ?? ""}
                  onChange={(event) =>
                    onUpdateData({
                      map: {
                        from: selected.data.map?.from ?? "",
                        as: event.target.value,
                        mode: selected.data.map?.mode,
                        fields: selected.data.map?.fields ?? []
                      },
                      writes: [event.target.value]
                    })
                  }
                />
              </FormLabel>
              <FormLabel label="Mode">
                <Select
                  value={selected.data.map?.mode ?? "array"}
                  onChange={(event) =>
                    onUpdateData({
                      map: {
                        from: selected.data.map?.from ?? "",
                        as: selected.data.map?.as ?? "projected",
                        mode: event.target.value as "array" | "object",
                        fields: selected.data.map?.fields ?? []
                      }
                    })
                  }
                >
                  <option value="array">array</option>
                  <option value="object">object</option>
                </Select>
              </FormLabel>
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-zinc-700">Fields</div>
                {(selected.data.map?.fields ?? []).map((field, index) => (
                  <div key={`${field.as}-${index}`} className="grid grid-cols-2 gap-1">
                    <PropPicker
                      label="from"
                      value={field.from}
                      options={pathOptionsForKey(bagView, selected.data.map?.from ?? "")}
                      onChange={(value) => {
                        const fields = [...(selected.data.map?.fields ?? [])] as WorkflowMapField[];
                        fields[index] = { ...fields[index], from: value };
                        onUpdateData({
                          map: {
                            from: selected.data.map?.from ?? "",
                            as: selected.data.map?.as ?? "projected",
                            mode: selected.data.map?.mode,
                            fields
                          }
                        });
                      }}
                    />
                    <FormLabel label="as">
                      <TextInput
                        value={field.as}
                        onChange={(event) => {
                          const fields = [...(selected.data.map?.fields ?? [])] as WorkflowMapField[];
                          fields[index] = { ...fields[index], as: event.target.value };
                          onUpdateData({
                            map: {
                              from: selected.data.map?.from ?? "",
                              as: selected.data.map?.as ?? "projected",
                              mode: selected.data.map?.mode,
                              fields
                            }
                          });
                        }}
                      />
                    </FormLabel>
                  </div>
                ))}
                <GhostButton
                  size="xs"
                  onClick={() =>
                    onUpdateData({
                      map: {
                        from: selected.data.map?.from ?? "",
                        as: selected.data.map?.as ?? "projected",
                        mode: selected.data.map?.mode ?? "array",
                        fields: [
                          ...(selected.data.map?.fields ?? []),
                          { from: pathOptionsForKey(bagView, selected.data.map?.from ?? "")[0] ?? "id", as: "field" }
                        ]
                      }
                    })
                  }
                >
                  Add field
                </GhostButton>
              </div>
            </>
          ) : null}
          {selected.type === "join" ? (
            <>
              <FormLabel label="Join mode">
                <Select
                  value={
                    typeof selected.data.join?.mode === "object"
                      ? `count:${selected.data.join.mode.count}`
                      : (selected.data.join?.mode ?? "all")
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.startsWith("count:")) {
                      onUpdateData({
                        join: {
                          ...(selected.data.join ?? {}),
                          mode: { count: Number(value.slice(6)) || 1 }
                        }
                      });
                      return;
                    }
                    onUpdateData({
                      join: {
                        ...(selected.data.join ?? {}),
                        mode: value as "all" | "any"
                      }
                    });
                  }}
                >
                  <option value="all">all</option>
                  <option value="any">any</option>
                  <option value="count:1">count:1</option>
                  <option value="count:2">count:2</option>
                </Select>
              </FormLabel>
              <FormLabel label="Remaining arms">
                <Select
                  value={selected.data.join?.remaining ?? "cancel_remaining"}
                  onChange={(event) =>
                    onUpdateData({
                      join: {
                        ...(selected.data.join ?? {}),
                        remaining: event.target.value as "cancel_remaining" | "ignore_remaining"
                      }
                    })
                  }
                >
                  <option value="cancel_remaining">cancel_remaining</option>
                  <option value="ignore_remaining">ignore_remaining</option>
                </Select>
              </FormLabel>
            </>
          ) : null}
          {selected.type === "subworkflow" ? (
            <FormLabel label="Workflow id">
              <TextInput
                value={selected.data.subworkflow?.workflowId ?? ""}
                onChange={(event) =>
                  onUpdateData({
                    subworkflow: {
                      ...(selected.data.subworkflow ?? { workflowId: "" }),
                      workflowId: event.target.value
                    }
                  })
                }
              />
            </FormLabel>
          ) : null}
          {selected.type === "wait" ? (
            <FormLabel label="Delay ms">
              <TextInput
                value={String(selected.data.wait?.delayMs ?? "")}
                onChange={(event) =>
                  onUpdateData({
                    wait: { delayMs: Number(event.target.value) || 0 }
                  })
                }
              />
            </FormLabel>
          ) : null}
          {selected.type === "tool" || selected.type === "llm" || selected.type === "write" ? (
            <>
              <FormLabel label="Timeout ms">
                <TextInput
                  value={String(selected.data.executionPolicy?.timeoutMs ?? "")}
                  onChange={(event) =>
                    onUpdateData({
                      executionPolicy: {
                        ...(selected.data.executionPolicy ?? {}),
                        timeoutMs: Number(event.target.value) || undefined
                      }
                    })
                  }
                />
              </FormLabel>
              <FormLabel label="Idempotency key from">
                <TextInput
                  value={selected.data.executionPolicy?.idempotencyKeyFrom ?? ""}
                  onChange={(event) =>
                    onUpdateData({
                      executionPolicy: {
                        ...(selected.data.executionPolicy ?? {}),
                        idempotencyKeyFrom: event.target.value || undefined
                      }
                    })
                  }
                />
              </FormLabel>
              <FormLabel label="On exhausted">
                <Select
                  value={selected.data.executionPolicy?.onExhausted ?? "fail_run"}
                  onChange={(event) =>
                    onUpdateData({
                      executionPolicy: {
                        ...(selected.data.executionPolicy ?? {}),
                        onExhausted: event.target.value as "error_edge" | "fail_run"
                      }
                    })
                  }
                >
                  <option value="fail_run">fail_run</option>
                  <option value="error_edge">error_edge</option>
                </Select>
              </FormLabel>
            </>
          ) : null}
          {selected.type !== "start" ? (
            <GhostButton size="xs" tone="danger" onClick={onDelete}>
              Delete node
            </GhostButton>
          ) : null}
        </div>
      )}
    </aside>
  );
}
