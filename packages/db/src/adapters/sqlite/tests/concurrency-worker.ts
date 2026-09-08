import { createDatabaseController } from "../../../controller";
const db = createDatabaseController({path: process.argv[2], skipPresets: process.argv[3] !== "bootstrap"});
try {
  if (process.argv[3] === "bootstrap") await db.projects.list();
  else {
    const created = await Promise.all(Array.from({length: 6}, (_, i) => db.entities.create({
      projectKey: "PLAN", type: "feature", title: `${process.pid}-${i}`
    })));
    console.log(JSON.stringify(created.map(result => result.entity.key)));
  }
} finally { await db.shutdown(); }
