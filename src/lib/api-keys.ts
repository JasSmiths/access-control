import "server-only";
import crypto from "node:crypto";
import { getDb } from "./db";

export type ApiKeyRecord = {
  id: number;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

function hasColumn(table: string, column: string): boolean {
  const cols = getDb().prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function hasTable(table: string): boolean {
  const row = getDb()
    .prepare("SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { x: number } | undefined;
  return !!row;
}

function resolveLegacyAdminId(userId: number, username?: string): number | null {
  if (!hasTable("admin") || !hasColumn("api_keys", "admin_id")) {
    return null;
  }

  const direct = getDb()
    .prepare("SELECT id FROM admin WHERE id = ?")
    .get(userId) as { id: number } | undefined;
  if (direct) return direct.id;

  if (!username) return null;

  const byUsername = getDb()
    .prepare("SELECT id FROM admin WHERE username = ?")
    .get(username) as { id: number } | undefined;
  return byUsername?.id ?? null;
}

export function createApiKey(userId: number, username?: string) {
  const token = `cha_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = hashKey(token);
  const keyPrefix = token.slice(0, 12);
  const legacyAdminId = resolveLegacyAdminId(userId, username);

  const result =
    legacyAdminId !== null
      ? getDb()
          .prepare(
            `INSERT INTO api_keys (admin_user_id, admin_id, key_prefix, key_hash)
             VALUES (?, ?, ?, ?)`
          )
          .run(userId, legacyAdminId, keyPrefix, keyHash)
      : getDb()
          .prepare(
            `INSERT INTO api_keys (admin_user_id, key_prefix, key_hash)
             VALUES (?, ?, ?)`
          )
          .run(userId, keyPrefix, keyHash);

  return {
    id: Number(result.lastInsertRowid),
    token,
    keyPrefix,
  };
}

export function listApiKeys(userId: number): ApiKeyRecord[] {
  return getDb()
    .prepare(
      `SELECT id, key_prefix, created_at, last_used_at, revoked_at
         FROM api_keys
        WHERE admin_user_id = ?
        ORDER BY created_at DESC`
    )
    .all(userId) as ApiKeyRecord[];
}

export function verifyApiKey(token: string) {
  const keyHash = hashKey(token);
  const row = getDb()
    .prepare(
      `SELECT id, admin_user_id, key_prefix, revoked_at
         FROM api_keys
        WHERE key_hash = ?
        LIMIT 1`
    )
    .get(keyHash) as
    | { id: number; admin_user_id: number; key_prefix: string; revoked_at: string | null }
    | undefined;

  if (!row || row.revoked_at) return null;
  getDb()
    .prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?")
    .run(row.id);
  return row;
}

export function revokeApiKey(userId: number, keyId: number): boolean {
  const result = getDb()
    .prepare(
      `UPDATE api_keys
          SET revoked_at = datetime('now')
        WHERE id = ? AND admin_user_id = ? AND revoked_at IS NULL`
    )
    .run(keyId, userId);
  return result.changes > 0;
}
