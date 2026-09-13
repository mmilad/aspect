import { defaultDatabasePath, defaultDatabaseUrl } from "./environment";
import { migrateSqliteToPostgres } from "./adapters/postgres/migrate";

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const sourcePath = option("source") ?? defaultDatabasePath();
const databaseUrl = option("database-url") ?? defaultDatabaseUrl();

if (!databaseUrl) {
  throw new Error("Set PROJECTPLANER_DATABASE_URL or pass --database-url=<url>.");
}

const counts = await migrateSqliteToPostgres({ sourcePath, databaseUrl });
console.log(JSON.stringify({ sourcePath, counts }, null, 2));
