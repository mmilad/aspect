import path from "node:path";
import { createDatabase, getProjectSnapshot, seedSelfPlanningProject } from "@projectplaner/db";

export async function loadProject(key = "PLAN") {
  const dbPath = process.env.PROJECTPLANER_DB_PATH ?? path.resolve(process.cwd(), "../../projectplaner.db");
  const db = createDatabase(dbPath);

  try {
    await seedSelfPlanningProject(db);
    return await getProjectSnapshot(db, key);
  } finally {
    db.close();
  }
}
