import type { LlmAdapter, LlmCompleteInput } from "./types";

export type FixtureEntry = {
  /** Match workflow preset key or flow id (optional). */
  workflowKey?: string;
  /** Match pending node id (optional). */
  nodeId?: string;
  /** Exact instructions substring match (optional). */
  instructionsIncludes?: string;
  llmWrites: Record<string, unknown>;
};

export type FixtureAdapterOptions = {
  fixtures: FixtureEntry[];
};

function matches(entry: FixtureEntry, input: LlmCompleteInput): boolean {
  if (entry.workflowKey && entry.workflowKey !== input.workflowKey) {
    return false;
  }
  if (entry.nodeId && entry.nodeId !== input.pending.nodeId) {
    return false;
  }
  if (entry.instructionsIncludes && !input.pending.instructions.includes(entry.instructionsIncludes)) {
    return false;
  }
  return true;
}

/** Deterministic adapter for tests — no live model. */
export class FixtureLlmAdapter implements LlmAdapter {
  private readonly fixtures: FixtureEntry[];

  constructor(options: FixtureAdapterOptions) {
    this.fixtures = options.fixtures;
  }

  async complete(input: LlmCompleteInput): Promise<Record<string, unknown>> {
    const hit = this.fixtures.find((entry) => matches(entry, input));
    if (!hit) {
      throw new Error(
        `No fixture for workflowKey=${input.workflowKey ?? "?"} nodeId=${input.pending.nodeId ?? "?"}`
      );
    }
    return { ...hit.llmWrites };
  }
}

export function fixtureAdapterFromJson(entries: FixtureEntry[]): FixtureLlmAdapter {
  return new FixtureLlmAdapter({ fixtures: entries });
}
