import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { getDb } from "./db";
import {
  SESSION_COOKIE_NAME,
  jwtSecret,
  verifyToken,
  type SessionPayload,
} from "./auth-jwt";

export { SESSION_COOKIE_NAME, type SessionPayload };

const SEVEN_DAYS = 60 * 60 * 24 * 7;

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export type AdminUser = {
  id: number;
  username: string;
  password_hash: string;
  active: number;
};

export async function issueSession(userId: number, username: string) {
  const token = await new SignJWT({ sub: String(userId), u: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SEVEN_DAYS,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE_NAME)?.value);
}

export function adminExists(): boolean {
  const row = getDb().prepare("SELECT 1 AS x FROM admin_users LIMIT 1").get();
  return !!row;
}

export function getAdminByUsername(username: string): AdminUser | undefined {
  return getDb()
    .prepare("SELECT id, username, password_hash, active FROM admin_users WHERE username = ?")
    .get(username) as AdminUser | undefined;
}

export function createAdmin(username: string, passwordHash: string) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO admin_users (username, password_hash, active, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)`
    )
    .run(username, passwordHash, now, now);
}

export function updateAdminPassword(userId: number, passwordHash: string) {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      "UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?"
    )
    .run(passwordHash, now, userId);
}

export function listAdminUsers(): Array<{
  id: number;
  username: string;
  active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}> {
  return getDb()
    .prepare(
      `SELECT id, username, active, created_at, updated_at, last_login_at
         FROM admin_users
        ORDER BY username ASC`
    )
    .all() as Array<{
    id: number;
    username: string;
    active: number;
    created_at: string;
    updated_at: string;
    last_login_at: string | null;
  }>;
}

export function getAdminById(userId: number): AdminUser | undefined {
  return getDb()
    .prepare("SELECT id, username, password_hash, active FROM admin_users WHERE id = ?")
    .get(userId) as AdminUser | undefined;
}

export function updateAdminActive(userId: number, active: boolean) {
  const db = getDb();
  const target = db
    .prepare("SELECT id, active FROM admin_users WHERE id = ?")
    .get(userId) as { id: number; active: number } | undefined;

  if (!target) return { ok: false as const, reason: "not_found" as const };
  if (target.active === (active ? 1 : 0)) return { ok: true as const, changed: false };

  if (!active) {
    const activeCount = (
      db.prepare("SELECT COUNT(*) AS n FROM admin_users WHERE active = 1").get() as { n: number }
    ).n;
    if (activeCount <= 1) {
      return { ok: false as const, reason: "last_active_admin" as const };
    }
  }

  db.prepare("UPDATE admin_users SET active = ?, updated_at = ? WHERE id = ?").run(
    active ? 1 : 0,
    new Date().toISOString(),
    userId
  );
  return { ok: true as const, changed: true };
}

export function markAdminLogin(userId: number) {
  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE admin_users SET last_login_at = ?, updated_at = ? WHERE id = ?")
    .run(now, now, userId);
}
