import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
import { spawn } from "node:child_process";
import { runGit, sanitizeRemote } from "./git";

function child() {
  return Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() });
}
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe("Git process boundaries", () => {
  it("disables prompts and redacts authentication diagnostics", async () => {
    const process = child(); vi.mocked(spawn).mockReturnValue(process as never);
    const result = runGit(["clone", "--", "https://example.com/repo", "destination"], "C:/repo");
    const rejected = expect(result).rejects.toMatchObject({ code: "authentication", message: expect.not.stringContaining("secret") });
    process.stderr.write("Authentication failed at https://secret@example.com/repo"); process.emit("close", 128);
    await rejected;
    expect(spawn).toHaveBeenCalledWith("git", expect.arrayContaining(["clone", "--", "https://example.com/repo"]), expect.objectContaining({ shell: false, windowsHide: true,
      env: expect.objectContaining({ GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" }) }));
    expect(sanitizeRemote("https://secret@example.com/repo")).toBe("Configured remote (URL hidden)");
  });
  it("reports missing Git without exposing the raw error", async () => {
    const process = child(); vi.mocked(spawn).mockReturnValue(process as never);
    const result = runGit(["init"], "C:/repo");
    const rejected = expect(result).rejects.toMatchObject({ code: "git_missing" });
    process.emit("error", Object.assign(new Error("secret"), { code: "ENOENT" }));
    await rejected;
  });
  it("terminates timed-out Git and reports a retryable timeout", async () => {
    vi.useFakeTimers();
    const process = child(); vi.mocked(spawn).mockReturnValue(process as never);
    const result = runGit(["clone"], "C:/repo", { timeoutMs: 20 });
    const rejected = expect(result).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(20);
    expect(process.kill).toHaveBeenCalledWith("SIGKILL");
    process.emit("close", 1); await rejected;
  });
});
