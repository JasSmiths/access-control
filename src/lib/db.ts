import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

declare global {
  // eslint-disable-next-line no-var
  var __crestHouseAccessDb: Database.Database | undefined;
}

function resolveDbPath(): string {
  const p = process.env.DATABASE_PATH;
  if (p && p.length > 0) return p;
  return path.resolve(process.cwd(), "data", "crest-house-access.db");
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    (db.prepare("SELECT filename FROM schema_migrations").all() as { filename: string }[])
      .map((r) => r.filename)
  );

  const migrationsDir = path.resolve(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (filename) VALUES (?)").run(file);
    });
    tx();
  }

  reconcileLegacyAuthSchema(db);
}

function hasTable(db: Database.Database, name: string): boolean {
  const row = db
    .prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { x: number } | undefined;
  return !!row;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function reconcileLegacyAuthSchema(db: Database.Database) {
  if (!hasTable(db, "admin_users")) {
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

  if (hasTable(db, "admin")) {
    const hasUsers = (
      db.prepare("SELECT COUNT(*) AS n FROM admin_users").get() as { n: number }
    ).n;
    if (hasUsers === 0) {
      db.exec(`
        INSERT INTO admin_users (username, password_hash, active, created_at, updated_at)
        SELECT username, password_hash, 1, created_at, updated_at
        FROM admin;
      `);
    }
  }

  if (hasTable(db, "api_keys")) {
    const hasAdminUserId = hasColumn(db, "api_keys", "admin_user_id");
    if (!hasAdminUserId) {
      db.exec("ALTER TABLE api_keys ADD COLUMN admin_user_id INTEGER;");
    }

    const hasLegacyAdminId = hasColumn(db, "api_keys", "admin_id");
    if (hasLegacyAdminId) {
      db.exec(`
        UPDATE api_keys
        SET admin_user_id = admin_id
        WHERE admin_user_id IS NULL;
      `);
    }
  }
}

function open(): Database.Database {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__crestHouseAccessDb) {
    globalThis.__crestHouseAccessDb = open();
  }
  return globalThis.__crestHouseAccessDb;
}
