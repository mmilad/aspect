import { describe, expect, it } from "vitest";
import assistant from "./index";
import { parseMessage } from "./parse";

const { emptySession, merge, parseSession, titleFromSession, views } = assistant;

describe("assistant session", () => {
  it("preserves workflow run links while accepting legacy messages", () => {
    expect(parseMessage({ id: "msg_old", role: "assistant", content: "old", createdAt: "now" })).toEqual({
      id: "msg_old", role: "assistant", content: "old", createdAt: "now"
    });
    expect(parseMessage({ id: "msg_new", role: "assistant", content: "new", createdAt: "now", workflowRunId: "run_1" })).toEqual({
      id: "msg_new", role: "assistant", content: "new", createdAt: "now", workflowRunId: "run_1"
    });
  });

  it("parses empty and round-trips defaults", () => {
    const session = parseSession({}, "PLAN");
    expect(session).toEqual(emptySession("PLAN"));
    expect(views.visibleNav(session).map((item) => item.key)).toEqual(["transcript"]);
  });

  it("migrates legacy currentTopic, topic weights, and summary chips into questions", () => {
    const session = parseSession(
      {
        summary: { text: "First picture", open: ["scope"], settled: ["Inspect vs Assistant"] },
        currentTopic: { id: "t1", title: "Shell", why: "pane jobs" },
        topics: [
          { id: "t1", title: "Shell" },
          { id: "t2", title: "Catalog" }
        ]
      },
      "PLAN"
    );

    expect(session.summary).toEqual({ text: "First picture" });
    expect(session.topics.map((topic) => ({ id: topic.id, status: topic.status, weight: topic.weight }))).toEqual([
      { id: "t1", status: "active", weight: 1 },
      { id: "t2", status: "active", weight: 0.5 }
    ]);
    expect(session.questions.map((question) => ({ text: question.text, status: question.status }))).toEqual([
      { text: "scope", status: "open" },
      { text: "Inspect vs Assistant", status: "answered" }
    ]);
    expect(views.visibleNav(session).map((item) => item.key)).toEqual([
      "transcript",
      "summary",
      "topics",
      "questions"
    ]);
  });

  it("merges summary rewrite and unique topics without deleting omitted ones", () => {
    let session = emptySession("PLAN");
    session = merge(session, {
      summary: { text: "First picture" },
      topics: [{ id: "t1", title: "Shell", why: "pane jobs", status: "active", weight: 1 }],
      questions: [{ id: "q1", text: "scope", status: "open" }]
    });
    session = merge(session, {
      summary: { text: "Rewritten" },
      topics: [{ id: "t1", title: "Shell", why: "updated" }, { id: "t2", title: "Catalog" }],
      questions: [{ id: "q1", text: "scope", status: "answered", answer: "pane-only" }]
    });

    expect(session.summary?.text).toBe("Rewritten");
    expect(session.topics.find((topic) => topic.id === "t1")?.why).toBe("updated");
    expect(session.topics.map((topic) => topic.id).sort()).toEqual(["t1", "t2"]);
    expect(session.questions).toHaveLength(1);
    expect(session.questions[0]?.status).toBe("answered");
    expect(titleFromSession(session)).toBe("Rewritten");
  });

  it("assigns topic ids when missing, sorts by status then weight, and lights context on entityId", () => {
    let session = emptySession("PLAN");
    session = merge(session, {
      topics: [
        { title: "Parked old", status: "parked", weight: 0.9 },
        { title: "Nav", status: "active", weight: 0.4 },
        { title: "Hot", status: "active", weight: 0.8 }
      ]
    });
    expect(session.topics[0]?.id).toMatch(/^topic_/);
    expect(session.topics.map((topic) => topic.title)).toEqual(["Hot", "Nav", "Parked old"]);

    session = merge(session, { context: { entityId: "node_app" } });
    expect(views.visibleNav(session).some((item) => item.key === "context")).toBe(true);
  });

  it("applies a context pack as the next standing picture and parks omitted topics", () => {
    const { applyContextPack, commitAssistantTurn, parseContextPack } = assistant;
    let session = emptySession("PLAN");
    session = merge(session, {
      summary: { text: "Auth" },
      topics: [{ id: "t_auth", title: "Auth", status: "active", weight: 1 }],
      questions: [{ id: "q_scope", text: "What is in scope?", status: "open" }],
      context: { entityId: "old_entity" }
    });

    const pack = parseContextPack({
      summary: { text: "Graph inspect" },
      topics: [
        { id: "t_graph", title: "Graph inspect", status: "active", weight: 1 },
        { id: "t_auth", title: "Auth", status: "parked", weight: 0.2 }
      ],
      questions: [
        {
          id: "q_scope",
          text: "What is in scope?",
          status: "answered",
          answer: "inspect the graph"
        }
      ],
      context: { projectKey: "PLAN" }
    });
    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    const standing = applyContextPack(session, pack);
    expect(standing.summary?.text).toBe("Graph inspect");
    expect(standing.topics.map((topic) => topic.id)).toEqual(["t_graph", "t_auth"]);
    expect(standing.topics[1]?.status).toBe("parked");
    expect(standing.questions[0]?.status).toBe("answered");
    expect(standing.context.entityId).toBeUndefined();
    expect(standing.messages).toEqual(session.messages);

    const omitted = applyContextPack(session, {
      ...pack,
      topics: pack.topics.filter((topic) => topic.id === "t_graph")
    });
    expect(omitted.topics.find((topic) => topic.id === "t_auth")?.status).toBe("parked");
    expect(omitted.questions).toHaveLength(1);

    const committed = commitAssistantTurn(session, "Look at the graph", pack, "Switching focus.", "run_1");
    expect(committed.messages.map((item) => item.content)).toEqual([
      "Look at the graph",
      "Switching focus."
    ]);
    expect(committed.messages[1]?.workflowRunId).toBe("run_1");
    expect(committed.summary?.text).toBe("Graph inspect");
    expect(titleFromSession(committed)).toBe("Graph inspect");
  });

  it("accepts an empty summary from the v2 context-pack schema", () => {
    const pack = assistant.parseContextPack({
      summary: { text: "" },
      topics: [],
      questions: [],
      context: { projectKey: "PLAN" }
    });

    expect(pack).toEqual({
      summary: { text: "" },
      topics: [],
      questions: [],
      context: { projectKey: "PLAN" }
    });
  });

  it("clamps topic weights to 0–1", () => {
    const session = parseSession(
      {
        topics: [{ id: "t1", title: "Overflow", status: "active", weight: 4 }]
      },
      "PLAN"
    );
    expect(session.topics[0]?.weight).toBe(1);
  });
});
