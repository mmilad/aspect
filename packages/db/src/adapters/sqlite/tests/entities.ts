import type { DatabaseSync } from "node:sqlite";
import { sqliteStorage } from "../index";
import { domainStorage } from "../../../services";
import type { Operations } from "../../../contracts/entities";
const entities = (db: DatabaseSync) => domainStorage(sqliteStorage(db)).entities;
export default {
  get: (db: DatabaseSync, ...args: Parameters<Operations["get"]>) => entities(db).get(...args),
  list: (db: DatabaseSync, ...args: Parameters<Operations["list"]>) => entities(db).list(...args),
  create: (db: DatabaseSync, ...args: Parameters<Operations["create"]>) => entities(db).create(...args),
  update: (db: DatabaseSync, ...args: Parameters<Operations["update"]>) => entities(db).update(...args),
  remove: (db: DatabaseSync, ...args: Parameters<Operations["remove"]>) => entities(db).remove(...args)
};
