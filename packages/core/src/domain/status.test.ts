import { describe, expect, it } from "vitest";
import {
  deriveParentProcessStatus,
  migrateLegacyStatus,
  isStatusAllowedForType,
  defaultStatusForType
} from "./status";

describe("status model", () => {
  it("migrates legacy task and node statuses", () => {
    expect(migrateLegacyStatus("task", "todo")).toBe("planned");
    expect(migrateLegacyStatus("task", "doing")).toBe("in_progress");
    expect(migrateLegacyStatus("task", "done")).toBe("done");
    expect(migrateLegacyStatus("task", "todo", { disabled: true })).toBe("canceled");
    expect(migrateLegacyStatus("aspect", "in_work")).toBe("in_progress");
    expect(migrateLegacyStatus("aspect", "implemented")).toBe("done");
    expect(migrateLegacyStatus("aspect", "not_implemented")).toBe("in_planning");
    expect(migrateLegacyStatus("decision", "planned")).toBe("open");
    expect(migrateLegacyStatus("decision", "accepted")).toBe("accepted");
    expect(migrateLegacyStatus("question", "accepted")).toBe("answered");
  });

  it("validates status by type", () => {
    expect(isStatusAllowedForType("task", "planned")).toBe(true);
    expect(isStatusAllowedForType("task", "accepted")).toBe(false);
    expect(isStatusAllowedForType("decision", "open")).toBe(true);
    expect(isStatusAllowedForType("decision", "in_progress")).toBe(false);
    expect(defaultStatusForType("decision")).toBe("open");
    expect(defaultStatusForType("task")).toBe("planned");
  });

  it("derives parent status with in_progress floor", () => {
    expect(deriveParentProcessStatus(["planned", "planned"])).toBe("in_progress");
    expect(deriveParentProcessStatus(["done", "done"])).toBe("done");
    expect(deriveParentProcessStatus(["done", "planned"])).toBe("in_progress");
    expect(deriveParentProcessStatus(["canceled", "archived"])).toBe(null);
    expect(deriveParentProcessStatus(["planned"], "in_progress")).toBe("in_progress");
    expect(deriveParentProcessStatus(["done", "done"], "in_progress")).toBe("done");
    expect(deriveParentProcessStatus(["planned"], "done")).toBe("in_progress");
  });
});
