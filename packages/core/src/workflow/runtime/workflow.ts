import type { Entity, EntityRelation, JsonRecord } from "../../domain/types";
import {
  shouldStrictValidateInputs,
  shouldStrictValidateOutputs,
  validateNodeInputs,
  validateNodeOutputs
} from "../contracts";
import {
  applyBagWrites,
  findNode,
  findStartNode,
  getNodeWrites,
  outgoingByKind
} from "../graph/schema";
import type { WorkflowContextBag, WorkflowGraph } from "../graph/types";
import { resolveLlmOutputContracts } from "../llm-outputs";
import { getNodeModel } from "../nodes/registry";
import { mapPortValuesToBag } from "../ports";
import { validateValueAgainstShape } from "../shapes";
import type { WorkflowAdapters } from "./adapters";
import { advanceCursor, fail } from "./helpers";
import type { NodeExecuteContext, WorkflowStepResult } from "./types";

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

  async step(opts?: {
    llmWrites?: Record<string, unknown>;
    userRoute?: string;
  }): Promise<WorkflowStepResult> {
    let bag = { ...this._bag, keys: { ...this._bag.keys } };

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

    if (node.type === "end" || node.type === "error_end") {
      const result: WorkflowStepResult = {
        kind: "completed",
        bag: {
          ...bag,
          cursor: null,
          status: node.type === "error_end" ? "failed" : "completed",
          error: node.type === "error_end" ? "Workflow ended in error." : undefined
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
      const bagWrites = mapPortValuesToBag(node, opts.llmWrites);
      const applied = applyBagWrites(bag, Object.keys(bagWrites), bagWrites);
      if (!applied.ok) {
        const result = this.contractFailure(bag, node.id, applied.error);
        this._bag = result.bag;
        return result;
      }
      if (shouldStrictValidateOutputs(node)) {
        const outCheck = validateNodeOutputs(node, applied.bag);
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
      const inCheck = validateNodeInputs(node, bag);
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
        const applied = applyBagWrites(ctx.bag, getNodeWrites(node), values);
        if (applied.ok) {
          ctx.bag = applied.bag;
        }
        return applied;
      },
      read(key: string) {
        return ctx.bag.keys[key];
      },
      getWrites() {
        return getNodeWrites(node);
      }
    };

    const result = await model.execute(ctx);
    if (result.kind === "advanced" && shouldStrictValidateOutputs(node)) {
      const outCheck = validateNodeOutputs(node, result.bag);
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

    return last ?? fail(this._bag, this._bag.cursor, "Workflow exceeded maxSteps.");
  }
}

export function workflowGraphFromMetadata(metadata: JsonRecord): WorkflowGraph | null {
  const graph = metadata.graph;
  if (!graph || typeof graph !== "object") {
    return null;
  }
  return graph as WorkflowGraph;
}
