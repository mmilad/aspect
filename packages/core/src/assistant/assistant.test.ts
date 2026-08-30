import { describe, expect, it } from "vitest";
import assistant from "./index";

const { emptySession, merge, parseSession, titleFromSession, views } = assistant;

describe("assistant session", () => {
  it("parses empty and round-trips defaults", () => {
    const session = parseSession({}, "PLAN");
    expect(session).toEqual(emptySession("PLAN"));
    expect(views.visibleNav(session).map((item) => item.key)).toEqual(["transcript"]);
  });

  it("merges summary rewrite, current topic, and unique topics", () => {
    let session = emptySession("PLAN");
    session = merge(session, {
      summary: { text: "First picture", open: ["scope"] },
      currentTopic: { id: "t1", title: "Shell", why: "pane jobs" },
      topics: [{ id: "t2", title: "Catalog" }]
    });
    session = merge(session, {
      summary: { text: "Rewritten", settled: ["Inspect vs Assistant"] },
      currentTopic: { id: "t1", title: "Shell", why: "updated" },
      topics: [{ id: "t2", title: "Catalog" }]
    });

    expect(session.summary?.text).toBe("Rewritten");
    expect(session.summary?.settled).toEqual(["Inspect vs Assistant"]);
    expect(session.currentTopic?.why).toBe("updated");
    expect(session.topics.map((topic) => topic.id).sort()).toEqual(["t1", "t2"]);
    expect(titleFromSession(session)).toBe("Rewritten");
    expect(views.visibleNav(session).map((item) => item.key)).toEqual([
      "transcript",
      "summary",
      "currentTopic",
      "topics"
    ]);
  });

  it("assigns topic ids when missing and lights context on entityId", () => {
    let session = emptySession("PLAN");
    session = merge(session, { currentTopic: { title: "Nav" } });
    expect(session.currentTopic?.id).toMatch(/^topic_/);
    expect(session.topics).toHaveLength(1);

    session = merge(session, { context: { entityId: "node_app" } });
    expect(views.visibleNav(session).some((item) => item.key === "context")).toBe(true);
  });

  it("applies a context pack as the next standing picture and commits the turn", () => {
    const { applyContextPack, commitAssistantTurn, parseContextPack } = assistant;
    let session = emptySession("PLAN");
    session = merge(session, {
      summary: { text: "Auth" },
      currentTopic: { id: "t_auth", title: "Auth" },
      context: { entityId: "old_entity" }
    });

    const pack = parseContextPack({
      summary: { text: "Graph inspect" },
      currentTopic: { id: "t_graph", title: "Graph inspect" },
      topics: [
        { id: "t_auth", title: "Auth" },
        { id: "t_graph", title: "Graph inspect" }
      ],
      context: { projectKey: "PLAN" },
      topicChanged: true
    });
    expect(pack).not.toBeNull();
    if (!pack) {
      return;
    }

    const standing = applyContextPack(session, pack);
    expect(standing.summary?.text).toBe("Graph inspect");
    expect(standing.currentTopic?.title).toBe("Graph inspect");
    expect(standing.context.entityId).toBeUndefined();
    expect(standing.messages).toEqual(session.messages);

    const committed = commitAssistantTurn(session, "Look at the graph", pack, "Switching focus.");
    expect(committed.messages.map((item) => item.content)).toEqual([
      "Look at the graph",
      "Switching focus."
    ]);
    expect(committed.summary?.text).toBe("Graph inspect");
    expect(titleFromSession(committed)).toBe("Graph inspect");
  });
});
