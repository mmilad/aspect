import { describe, expect, it } from "vitest";
import { ASSISTANT_ROLE_MANIFEST, serializeAssistantRoleManifest } from "./role";

describe("Assistant role manifest", () => {
  it("defines the reserved Assistant role and its boundaries", () => {
    expect(ASSISTANT_ROLE_MANIFEST).toMatchObject({
      version: 1,
      kind: "assistant",
      identity: "Projectplaner Assistant"
    });
    expect(ASSISTANT_ROLE_MANIFEST.capabilities).toEqual(expect.arrayContaining([
      "read_project_context",
      "inspect_active_agents",
      "ask_focused_questions",
      "delegate_to_registered_specialists",
      "resume_delegated_work"
    ]));
    expect(ASSISTANT_ROLE_MANIFEST.restrictions).toEqual(expect.arrayContaining([
      "do_not_write_project_data",
      "do_not_use_arbitrary_tools",
      "do_not_invent_facts_or_capabilities",
      "do_not_claim_unconfirmed_actions_or_outcomes"
    ]));
  });

  it("serializes deterministically without runtime state", () => {
    const first = serializeAssistantRoleManifest();
    const second = serializeAssistantRoleManifest();
    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual(ASSISTANT_ROLE_MANIFEST);
    expect(first).not.toContain("runId");
    expect(first).not.toContain("projectKey");
  });
});
