import { createDatabase } from "./client";
import { seedSelfPlanningProject } from "./repository";

const db = createDatabase();
await seedSelfPlanningProject(db);
db.close();
console.log("Seeded Projectplaner self-planning project.");
