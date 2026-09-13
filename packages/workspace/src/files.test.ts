import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listWorkspaceFiles, readWorkspaceFile, writeWorkspaceFile } from "./files";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe("managed workspace file access", () => {
  it("lists and reads relative files with a byte limit", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "projectplaner-files-"));
    temporaryRoots.push(root);
    await fs.mkdir(path.join(root, "src"));
    await fs.writeFile(path.join(root, "src", "app.ts"), "hello world", "utf8");
    expect(await listWorkspaceFiles(root, { recursive: true })).toEqual({
      entries: [
        { path: "src", kind: "directory" },
        { path: "src/app.ts", kind: "file", bytes: 11 }
      ]
    });
    expect(await readWorkspaceFile(root, { path: "src/app.ts", maxBytes: 5 })).toMatchObject({
      path: "src/app.ts", content: "hello", bytes: 5, truncated: true, encoding: "utf8"
    });
  });

  it("rejects paths that escape the workspace", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "projectplaner-files-"));
    temporaryRoots.push(root);
    await expect(readWorkspaceFile(root, { path: "../outside.txt" })).rejects.toMatchObject({ code: "invalid_input" });
    await expect(listWorkspaceFiles(root, { path: path.resolve(root, "other") })).rejects.toMatchObject({ code: "invalid_input" });
  });

  it("writes new files atomically and requires explicit overwrite", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "projectplaner-files-"));
    temporaryRoots.push(root);
    await fs.mkdir(path.join(root, "src"));
    await expect(writeWorkspaceFile(root, { path: "src/app.ts", content: "one" })).resolves.toMatchObject({
      path: "src/app.ts", bytes: 3, created: true, overwritten: false
    });
    await expect(writeWorkspaceFile(root, { path: "src/app.ts", content: "two" })).rejects.toMatchObject({ code: "conflict" });
    await expect(writeWorkspaceFile(root, { path: "src/app.ts", content: "two", overwrite: true })).resolves.toMatchObject({
      path: "src/app.ts", bytes: 3, created: false, overwritten: true
    });
    await expect(fs.readFile(path.join(root, "src/app.ts"), "utf8")).resolves.toBe("two");
  });
});
