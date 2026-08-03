import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./migrate";

let loadedEnv = false;

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separator = trimmed.indexOf("=");
  if (separator === -1) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();
  let value = trimmed.slice(separator + 1).trim();
  if (!key) {
    return null;
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

function normalizeEnvValue(key: string, value: string, envFile: string): string {
  if (key === "PROJECTPLANER_DB_PATH" && value && !path.isAbsolute(value)) {
    return path.resolve(path.dirname(envFile), value);
  }

  return value;
}

function findEnvFiles(startDir: string): string[] {
  const files: string[] = [];
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, ".env");
    if (fs.existsSync(candidate)) {
      files.unshift(candidate);
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return files;
    }
    current = parent;
  }
}

function loadEnv(): void {
  if (loadedEnv) {
    return;
  }
  loadedEnv = true;

  for (const file of findEnvFiles(process.cwd())) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (parsed && process.env[parsed[0]] === undefined) {
        process.env[parsed[0]] = normalizeEnvValue(parsed[0], parsed[1], file);
      }
    }
  }
}

function defaultDatabasePath(): string {
  loadEnv();
  return process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "projectplaner.db");
}

export function createDatabase(dbPath = defaultDatabasePath()) {
  const sqlite = new DatabaseSync(dbPath);
  runMigrations(sqlite);
  return sqlite;
}
