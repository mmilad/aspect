import type { AssistantBlock, AssistantProperty } from "./blocks";

export const ASSISTANT_TOPIC_BLOCKS: AssistantBlock[] = [
  { kind: "prose", path: "title" },
  { kind: "prose", path: "why" },
  { kind: "ref", path: "entityId", label: "Graph" }
];

export const ASSISTANT_ITEM_VIEWS: Record<string, AssistantBlock[]> = {
  topic: ASSISTANT_TOPIC_BLOCKS
};

export const ASSISTANT_CATALOG: AssistantProperty[] = [
  {
    key: "transcript",
    nav: "Chat",
    view: { kind: "transcript" }
  },
  {
    key: "summary",
    nav: "Summary",
    showWhen: "summary.text",
    view: {
      kind: "detail",
      blocks: [
        { kind: "prose", path: "summary.text" },
        { kind: "chips", path: "summary.settled", label: "Settled" },
        { kind: "chips", path: "summary.open", label: "Open" }
      ]
    }
  },
  {
    key: "currentTopic",
    nav: "Current topic",
    showWhen: "currentTopic",
    view: {
      kind: "detail",
      blocks: [
        { kind: "prose", path: "currentTopic.title" },
        { kind: "prose", path: "currentTopic.why" },
        { kind: "ref", path: "currentTopic.entityId", label: "Graph" }
      ]
    }
  },
  {
    key: "topics",
    nav: "Topics",
    showWhen: "topics",
    view: {
      kind: "list",
      path: "topics",
      title: "title",
      sub: "why",
      itemView: "topic"
    }
  },
  {
    key: "context",
    nav: "Context",
    showWhen: ["context.flowId", "context.nodeId", "context.entityId"],
    view: {
      kind: "detail",
      blocks: [
        {
          kind: "fields",
          fields: [
            { label: "Project", path: "context.projectKey" },
            { label: "Flow", path: "context.flowId" },
            { label: "Node", path: "context.nodeId" },
            { label: "Entity", path: "context.entityId" }
          ]
        },
        { kind: "ref", path: "context.entityId", label: "Open entity" }
      ]
    }
  }
];

export function propertyByKey(key: string): AssistantProperty | undefined {
  return ASSISTANT_CATALOG.find((property) => property.key === key);
}
