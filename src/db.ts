import { DatabaseSync as DB } from "node:sqlite";

export function getDB(): DB {
  // Open SQLite database and ensure schema
  const db = new DB(Deno.env.get("DB_PATH") || "storyengine.sqlite");
  db.exec(`
    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      title TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      synopsis TEXT NOT NULL,
      description TEXT NOT NULL,
      intro TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db
}
