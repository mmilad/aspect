import type { Entity, EntityRelation, JsonRecord } from "../../domain/types";
import {
  shouldStrictValidateInputs,
  shouldStrictValidateOutputs,
  validateNodeInputs,
  validateNodeOutputs
} from "../bag/contracts";
import {
  applyBagWrites,
  cloneContextBag,
  copyEndOutputs,
  findNode,
  findStartNode,
  getNodeWrites,
  initFrameFromRunInputs,
  outgoingByKind,
  usesPinFrame,
  writeOutputPins
} from "../graph/schema";
import type { WorkflowContextBag, WorkflowGraph } from "../graph/types";
import { resolveLlmOutputContracts } from "../llm/llm-outputs";
import { getNodeModel } from "../nodes/registry";
import type { WorkflowNode } from "../nodes/_shared/types";
import { mapPortValuesToBag } from "../bag/ports";
import { validateValueAgainstShape } from "../bag/shapes";
import type { WorkflowAdapters } from "./adapters";
import { advanceCursor, fail } from "./helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "./types";
import { resolveDataInput } from "../graph/frame";

function pinOutputPorts(node: WorkflowNode): string[] {
  const model = getNodeModel(node.type);
  if (model.dataOutputs) {
    return model.dataOutputs(node);
  }
  return Object.keys(node.data.outputContracts ?? {});
}

export class WorkflowRun {
  private _bag: WorkflowContextBag;
  private readonly graph: WorkflowGraph;
  private readonly adapters: WorkflowAdapters;
  private readonly entities: Entity[];
  private readonly relations: EntityRelation[];

  constructor(input: {
    graph: WorkflowGraph;
    bag: WorkflowContextBag;
    adapters?: WorkflowAdapters;
    entities?: Entity[];
    relations?: EntityRelation[];
  }) {
    this.graph = input.graph;
    this._bag = input.bag;
    this.adapters = input.adapters ?? {};
    this.entities = input.entities ?? [];
    this.relations = input.relations ?? [];
  }

  get bag(): WorkflowContextBag {
    return this._bag;
  }

  private contractFailure(bag: WorkflowContextBag, nodeId: string, error: string): WorkflowStepResult {
    const node = findNode(this.graph, nodeId);
    if (node?.data.executionPolicy?.onExhausted === "error_edge") {
      const errorEdge = outgoingByKind(this.graph, nodeId, "error")[0];
      if (errorEdge) {
        return {
          kind: "advanced",
          bag: { ...bag, cursor: errorEdge.target, status: "running", error },
          nodeId: errorEdge.target,
          message: error
        };
      }
    }
    return fail(bag, nodeId, error);
  }

  private visitLimitFor(node: WorkflowNode, bag: WorkflowContextBag): number | undefined {
    const policy = node.data.executionPolicy;
    if (!policy) {
      return undefined;
    }
    if (policy.maxVisitsFrom) {
      const raw = bag.frame?.inputs[policy.maxVisitsFrom] ?? bag.keys[policy.maxVisitsFrom];
      if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) {
        return raw;
      }
      return policy.maxVisits;
    }
    return policy.maxVisits;
  }

  private enterNode(bag: WorkflowContextBag, node: WorkflowNode): { ok: true; bag: WorkflowContextBag } | { ok: false; result: WorkflowStepResult } {
    const visits = { ...(bag.visits ?? {}) };
    const visit = (visits[node.id] ?? 0) + 1;
    const limit = this.visitLimitFor(node, bag);
    const history = bag.history ?? [];
    const nextBag: WorkflowContextBag = {
      ...bag,
      visits: { ...visits, [node.id]: visit },
      history: [
        ...history,
        {
          seq: history.length + 1,
          nodeId: node.id,
          visit,
          createdAt: new Date().toISOString()
        }
      ]
    };

    if (limit !== undefined && visit > limit) {
      return {
        ok: false,
        result: this.contractFailure(
          nextBag,
          node.id,
          `Node ${node.id} exceeded executionPolicy.maxVisits (${limit}).`
        )
      };
    }

    return { ok: true, bag: nextBag };
  }

  async step(opts?: {
    llmWrites?: Record<string, unknown>;
    userRoute?: string;
  }): Promise<WorkflowStepResult> {
    let bag = cloneContextBag(this._bag);

    if (usesPinFrame(this.graph) && !bag.frame) {
      bag = { ...bag, frame: initFrameFromRunInputs(this.graph, bag) };
    }

    if (!bag.cursor) {
      const start = findStartNode(this.graph);
      if (!start) {
        const result = fail(bag, null, "Workflow has no start node.");
        this._bag = result.bag;
        return result;
      }
      bag = { ...bag, cursor: start.id, status: "running" };
    }

    const cursor = bag.cursor;
    if (!cursor) {
      const result = fail(bag, null, "Workflow has no cursor.");
      this._bag = result.bag;
      return result;
    }

    const node = findNode(this.graph, cursor);
    if (!node) {
      const result = fail(bag, cursor, `Unknown cursor node: ${cursor}`);
      this._bag = result.bag;
      return result;
    }

    if (node.type === "get" || node.type === "reroute") {
      const result = fail(bag, cursor, `${node.type === "get" ? "Get" : "Reroute"} ${node.id} is not an executable step.`);
      this._bag = result.bag;
      return result;
    }

    const isResume = (node.type === "llm" && Boolean(opts?.llmWrites)) || (node.type === "gate" && Boolean(opts?.userRoute));
    if (!isResume) {
      const entered = this.enterNode(bag, node);
      if (!entered.ok) {
        this._bag = entered.result.bag;
        return entered.result;
      }
      bag = entered.bag;
    }

    if (node.type === "end" || node.type === "error_end") {
      const completedBag =
        node.type === "end" && usesPinFrame(this.graph) ? copyEndOutputs(this.graph, bag, node) : bag;
      const result: WorkflowStepResult = {
        kind: "completed",
        bag: {
          ...completedBag,
          cursor: null,
          status: node.type === "error_end" ? "failed" : "completed",
          error: node.type === "error_end" ? "Workflow ended in error." : undefined,
          keys: {
            ...completedBag.keys,
            ...(completedBag.frame?.outputs ?? {})
          }
        },
        nodeId: node.id,
        message: node.type === "error_end" ? "Workflow ended in error." : "Workflow completed."
      };
      this._bag = result.bag;
      return result;
    }

    if (node.type === "llm" && opts?.llmWrites) {
      const { outputs } = resolveLlmOutputContracts(node);
      for (const [key, contract] of Object.entries(outputs)) {
        if (!(key in opts.llmWrites)) {
          if (contract.required) {
            const result = this.contractFailure(bag, node.id, `Missing declared LLM write key: ${key}`);
            this._bag = result.bag;
            return result;
          }
          continue;
        }
        const check = validateValueAgainstShape(opts.llmWrites[key], contract.shape);
        if (!check.ok) {
          const result = this.contractFailure(
            bag,
            node.id,
            `LLM write '${key}' failed shape check: ${check.error}`
          );
          this._bag = result.bag;
          return result;
        }
      }
      const applied = usesPinFrame(this.graph)
        ? { ok: true as const, bag: writeOutputPins(this.graph, bag, node, opts.llmWrites) }
        : applyBagWrites(bag, Object.keys(mapPortValuesToBag(node, opts.llmWrites)), mapPortValuesToBag(node, opts.llmWrites));
      if (!applied.ok) {
        const result = this.contractFailure(bag, node.id, applied.error);
        this._bag = result.bag;
        return result;
      }
      if (shouldStrictValidateOutputs(node)) {
        const outCheck = validateNodeOutputs(node, applied.bag, this.graph);
        if (!outCheck.ok) {
          const result = this.contractFailure(applied.bag, node.id, outCheck.error);
          this._bag = result.bag;
          return result;
        }
      }
      const result = await advanceCursor(this.graph, applied.bag, node.id);
      this._bag = result.bag;
      return result;
    }

    if (node.type === "gate" && opts?.userRoute) {
      const result = await advanceCursor(
        this.graph,
        { ...bag, status: "running" },
        node.id,
        opts.userRoute
      );
      this._bag = result.bag;
      return result;
    }

    if (shouldStrictValidateInputs(node)) {
      const inCheck = validateNodeInputs(node, bag, this.graph);
      if (!inCheck.ok) {
        const result = this.contractFailure(bag, node.id, inCheck.error);
        this._bag = result.bag;
        return result;
      }
    }

    const model = getNodeModel(node.type);
    if (!model.execute) {
      const result = fail(bag, node.id, `Unsupported node type: ${node.type}`);
      this._bag = result.bag;
      return result;
    }

    const self = this;
    const pinGraph = usesPinFrame(this.graph);
    const ctx: NodeExecuteContext = {
      graph: this.graph,
      node,
      bag,
      adapters: this.adapters,
      entities: this.entities,
      relations: this.relations,
      llmWrites: opts?.llmWrites,
      userRoute: opts?.userRoute,
      fail(error: string) {
        return fail(ctx.bag, node.id, error);
      },
      advance(routeLabel?: string) {
        return advanceCursor(self.graph, ctx.bag, node.id, routeLabel);
      },
      applyWrites(values: Record<string, unknown>) {
        if (pinGraph) {
          const declared = pinOutputPorts(node);
          for (const key of Object.keys(values)) {
            if (declared.length > 0 && !declared.includes(key)) {
              return { ok: false, error: `Undeclared write key: ${key}` };
            }
          }
          for (const key of declared) {
            const required = node.data.outputContracts?.[key]?.required !== false;
            if (required && !(key in values)) {
              return { ok: false, error: `Missing declared write key: ${key}` };
            }
          }
          ctx.bag = writeOutputPins(self.graph, ctx.bag, node, values);
          if (node.type === "start" && ctx.bag.frame) {
            ctx.bag = {
              ...ctx.bag,
              frame: {
                ...ctx.bag.frame,
                inputs: { ...ctx.bag.frame.inputs, ...values }
              }
            };
          }
          return { ok: true, bag: ctx.bag };
        }
        const applied = applyBagWrites(ctx.bag, getNodeWrites(node), values);
        if (applied.ok) {
          ctx.bag = applied.bag;
        }
        return applied;
      },
      read(key: string) {
        if (pinGraph) {
          return resolveDataInput(self.graph, ctx.bag, node, key);
        }
        return ctx.bag.keys[key];
      },
      getWrites() {
        return pinGraph ? pinOutputPorts(node) : getNodeWrites(node);
      }
    };

    const result = await model.execute(ctx);
    if (result.kind === "advanced" && shouldStrictValidateOutputs(node)) {
      const outCheck = validateNodeOutputs(node, result.bag, this.graph);
      if (!outCheck.ok) {
        const failed = this.contractFailure(result.bag, node.id, outCheck.error);
        this._bag = failed.bag;
        return failed;
      }
    }
    this._bag = result.bag;
    return result;
  }

  async runUntilPause(maxSteps = 50): Promise<WorkflowStepResult> {
    let last: WorkflowStepResult | null = null;

    for (let i = 0; i < maxSteps; i += 1) {
      last = await this.step();
      if (last.kind !== "advanced") {
        return last;
      }
    }

    const result = fail(this._bag, this._bag.cursor, `Workflow exceeded maxSteps (${maxSteps}).`);
    this._bag = result.bag;
    return result;
  }
}

export function workflowGraphFromMetadata(metadata: JsonRecord): WorkflowGraph | null {
  const graph = metadata.graph;
  if (!graph || typeof graph !== "object") {
    return null;
  }
  return graph as WorkflowGraph;
}
