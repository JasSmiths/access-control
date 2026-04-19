#!/usr/bin/env node
// Idempotent SQL migration runner. Invoked at container start.
// Reads migrations/*.sql in lexical order, applies any not yet recorded in schema_migrations.

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH || "/app/data/crest-house-access.db";
const migrationsDir = path.resolve(process.cwd(), "migrations");

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const applied = new Set(
  db.prepare("SELECT filename FROM schema_migrations").all().map((r) => r.filename)
);

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let ran = 0;
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  const tx = db.transaction(() => {
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)").run(file);
  });
  try {
    tx();
    console.log(`[migrate] applied ${file}`);
    ran += 1;
  } catch (err) {
    console.error(`[migrate] FAILED ${file}:`, err);
    process.exit(1);
  }
}

function hasTable(name) {
  const row = db
    .prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return !!row;
}

function hasColumn(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

function reconcileLegacyAuthSchema() {
  if (!hasTable("admin_users")) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE,
        password_hash TEXT    NOT NULL,
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
        last_login_at TEXT
      );
    `);
  }

  if (hasTable("admin")) {
    const hasUsers = db.prepare("SELECT COUNT(*) AS n FROM admin_users").get().n;
    if (hasUsers === 0) {
      db.exec(`
        INSERT INTO admin_users (username, password_hash, active, created_at, updated_at)
        SELECT username, password_hash, 1, created_at, updated_at
        FROM admin;
      `);
      console.log("[migrate] migrated legacy admin row(s) into admin_users");
    }
  }

  if (hasTable("api_keys")) {
    const hasAdminUserId = hasColumn("api_keys", "admin_user_id");
    if (!hasAdminUserId) {
      db.exec("ALTER TABLE api_keys ADD COLUMN admin_user_id INTEGER;");
      console.log("[migrate] added api_keys.admin_user_id");
    }

    const hasLegacyAdminId = hasColumn("api_keys", "admin_id");
    if (hasLegacyAdminId) {
      db.exec(`
        UPDATE api_keys
        SET admin_user_id = admin_id
        WHERE admin_user_id IS NULL;
      `);
      console.log("[migrate] backfilled api_keys.admin_user_id from admin_id");
    }
  }
}

reconcileLegacyAuthSchema();
console.log(`[migrate] ${ran} new migration(s), ${files.length} total.`);
db.close();
