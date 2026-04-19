import {
  getAdminById,
  getSession,
  hashPassword,
  updateAdminPassword,
  verifyPassword,
} from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    auditLog({
      level: "warn",
      category: "auth",
      action: "auth.password_change_unauthorized",
      message: "Password change rejected: no active session.",
      request,
    });
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    auditLog({
      level: "warn",
      category: "auth",
      action: "auth.password_change_invalid_json",
      message: "Password change failed: invalid JSON payload.",
      request,
      actor: session.username,
    });
    return new Response("Invalid JSON", { status: 400 });
  }
  const { current, next } = (body ?? {}) as {
    current?: string;
    next?: string;
  };
  if (!current || !next || next.length < 8) {
    auditLog({
      level: "warn",
      category: "auth",
      action: "auth.password_change_invalid_input",
      message: "Password change failed: invalid input.",
      request,
      actor: session.username,
    });
    return new Response("Password must be at least 8 characters", { status: 400 });
  }
  const admin = getAdminById(session.userId);
  if (!admin) return new Response("Admin user not found", { status: 404 });
  const ok = await verifyPassword(current, admin.password_hash);
  if (!ok) {
    auditLog({
      level: "warn",
      category: "auth",
      action: "auth.password_change_failed",
      message: "Password change failed: current password incorrect.",
      request,
      actor: session.username,
    });
    return new Response("Current password incorrect", { status: 401 });
  }
  const hash = await hashPassword(next);
  updateAdminPassword(admin.id, hash);
  auditLog({
    category: "auth",
    action: "auth.password_change_success",
    message: "Password updated successfully.",
    request,
    actor: session.username,
  });
  return Response.json({ ok: true });
}
