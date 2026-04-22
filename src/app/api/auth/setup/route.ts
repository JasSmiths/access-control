import {
  adminExists,
  createAdmin,
  hashPassword,
  issueSession,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (adminExists()) {
    auditLog({
      level: "debug",
      category: "auth",
      action: "auth.setup_rejected",
      message: "Admin setup rejected because an admin already exists.",
      request,
    });
    return new Response("Admin already exists", { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    auditLog({
      level: "debug",
      category: "auth",
      action: "auth.setup_invalid_json",
      message: "Admin setup failed: invalid JSON payload.",
      request,
    });
    return new Response("Invalid JSON", { status: 400 });
  }
  const { username, password } = (body ?? {}) as {
    username?: string;
    password?: string;
  };
  if (!username || typeof username !== "string" || username.trim().length < 3) {
    auditLog({
      level: "debug",
      category: "auth",
      action: "auth.setup_invalid_username",
      message: "Admin setup failed: invalid username.",
      request,
    });
    return new Response("Invalid username", { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    auditLog({
      level: "debug",
      category: "auth",
      action: "auth.setup_weak_password",
      message: "Admin setup failed: password too short.",
      request,
      actor: username.trim(),
    });
    return new Response("Password must be at least 8 characters", { status: 400 });
  }
  const hash = await hashPassword(password);
  createAdmin(username.trim(), hash);
  const row = getDb()
    .prepare("SELECT id, username FROM admin_users WHERE username = ?")
    .get(username.trim()) as { id: number; username: string };
  await issueSession(row.id, row.username);
  auditLog({
    level: "info",
    category: "auth",
    action: "auth.setup_success",
    message: `Admin setup completed for username "${row.username}".`,
    request,
    actor: row.username,
  });
  return Response.json({ ok: true });
}
