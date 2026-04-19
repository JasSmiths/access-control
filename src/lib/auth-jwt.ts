// Token verification helpers. Safe to import from proxy.ts — no DB access here.
import { jwtVerify } from "jose";
import { SESSION_COOKIE_NAME as BRAND_SESSION_COOKIE_NAME } from "./brand";

export const SESSION_COOKIE_NAME = BRAND_SESSION_COOKIE_NAME;

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET env var is missing or too short");
  }
  return new TextEncoder().encode(s);
}

export type SessionPayload = { userId: number; username: string };

export async function verifyToken(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = Number(payload.sub);
    const username = String(payload.u ?? "");
    if (!Number.isFinite(userId) || !username) return null;
    return { userId, username };
  } catch {
    return null;
  }
}

export function jwtSecret(): Uint8Array {
  return secret();
}
