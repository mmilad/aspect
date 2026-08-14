import type { DatabaseSync } from "node:sqlite";

export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec("BEGIN");
  try {
    const result = run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function transactionAsync<T>(db: DatabaseSync, run: () => Promise<T>): Promise<T> {
  db.exec("BEGIN");
  try {
    const result = await run();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
