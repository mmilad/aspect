import { DEFAULT_PROJECT_KEY } from "./session";

/** One-time onboarding for new agents — not a graph search. */
export function orientBriefing() {
  return {
    project: { key: DEFAULT_PROJECT_KEY },
    purpose: "Local graph-first planning store. Aspects are meaning anchors; features and tasks attach to them.",
    rules: [
      "Serialize all Projectplaner tool calls (no parallel DB tools).",
      "Prefer the smallest truthful Aspect or Feature before creating new anchors.",
      "Every task must link to an Aspect or Feature (targetEntityId).",
      "Writes must include reason (durable narrative for the next agent).",
      "When a mutation preset is seeded (create_task, delete_aspect, …), use run_workflow instead of create_entity/update_entity.",
      "Delete means archive (status=archived); never hard-delete.",
      "Archived entities are excluded from default search/list/graph; use get_entity or includeArchived to recover.",
      "run_workflow may return pending_llm — resume with the same runId and llmWrites.",
      "Use search for relevant context; use next_work (or run_workflow key=next_work) to pick eligible tasks.",
      "relatedTo means entities with an outgoing link targeting that id — not 'everything under a parent'. A Feature that contains children will not list those children via relatedTo on the parent; search by title, open the child, or use pnpm plan orient. For task work, scope next_work to the leaf Feature (or Aspect) tasks implement/affect.",
      "Relations are directed: parent contains→child is outgoing on the parent and incoming on the child. Do not duplicate reverse contains edges.",
      "Leave narrative.proposal / openQuestions when useful; use packet_write for execution handoffs."
    ],
    tools: {
      search:
        "Relevance search (titles, summaries; narrative fields when present). relatedTo = outgoing links to that id.",
      next_work:
        "Eligible tasks ranked by work score. relatedTo scopes to tasks with outgoing affects/implements/validates/investigates to that Aspect/Feature (leaf ids, not contains-parents).",
      get_entity: "Compact entity + narrative by default.",
      list_entities:
        "Filtered list only (type / optional text filter — not ranked search). relatedTo = outgoing links to that id.",
      create_entity: "Create node; requires reason. Blocked when matching create_* preset is seeded.",
      update_entity: "Update node; requires reason. Blocked when matching update_*/delete_* preset is seeded.",
      create_relation: "Link two entities (directed; contains/implements/affects/…).",
      run_workflow: "Start/resume a workflow by preset key or flow id (Cursor/Codex resume via llmWrites).",
      packet_read: "Read orientation packets on an entity.",
      packet_write: "Write handoff packet; requires state+next; also stamps target narrative."
    },
    next: "Call search with a short work-area query, or next_work if you need an eligible task. For shell/feature trees, prefer leaf Feature ids or title search over relatedTo on a contains-parent."
  };
}
