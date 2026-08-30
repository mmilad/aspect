import type { AssistantBlock, AssistantProperty } from "./blocks";

export const ASSISTANT_TOPIC_BLOCKS: AssistantBlock[] = [
  { kind: "prose", path: "title" },
  { kind: "prose", path: "why" },
  {
    kind: "fields",
    fields: [
      { label: "Status", path: "status" },
      { label: "Weight", path: "weight" }
    ]
  },
  { kind: "ref", path: "entityId", label: "Graph" }
];

export const ASSISTANT_QUESTION_BLOCKS: AssistantBlock[] = [
  { kind: "prose", path: "text" },
  {
    kind: "fields",
    fields: [
      { label: "Status", path: "status" },
      { label: "Answer", path: "answer" },
      { label: "Topic", path: "topicId" }
    ]
  }
];

export const ASSISTANT_ITEM_VIEWS: Record<string, AssistantBlock[]> = {
  topic: ASSISTANT_TOPIC_BLOCKS,
  question: ASSISTANT_QUESTION_BLOCKS
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
      blocks: [{ kind: "prose", path: "summary.text" }]
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
    key: "questions",
    nav: "Questions",
    showWhen: "questions",
    view: {
      kind: "list",
      path: "questions",
      title: "text",
      sub: "answer",
      itemView: "question"
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
