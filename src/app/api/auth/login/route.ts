import { getAdminByUsername, issueSession, markAdminLogin, verifyPassword } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    auditLog({
      level: "warn",
      category: "auth",
      action: "auth.login_invalid_json",
      message: "Login failed: invalid JSON payload.",
      request,
    });
    return new Response("Invalid JSON", { status: 400 });
  }
  const { username, password } = (body ?? {}) as {
    username?: string;
    password?: string;
  };
  if (!username || !password) {
    auditLog({
      level: "warn",
      category: "auth",
      action: "auth.login_missing_credentials",
      message: "Login failed: missing credentials.",
      request,
      details: { usernameProvided: !!username, passwordProvided: !!password },
    });
    return new Response("Missing credentials", { status: 400 });
  }
  const admin = getAdminByUsername(username.trim());
  if (!admin) {
    auditLog({
      level: "warn",
      category: "auth",
      action: "auth.login_failed",
      message: `Login failed for username "${username}".`,
      request,
      actor: username,
    });
    return new Response("Invalid credentials", { status: 401 });
  }
  const ok = await verifyPassword(password, admin.password_hash);
  if (!ok || !admin.active) {
    auditLog({
      level: "warn",
      category: "auth",
      action: "auth.login_failed",
      message: `Login failed for username "${username}".`,
      request,
      actor: username,
    });
    return new Response("Invalid credentials", { status: 401 });
  }
  await issueSession(admin.id, admin.username);
  markAdminLogin(admin.id);
  auditLog({
    category: "auth",
    action: "auth.login_success",
    message: `Login succeeded for username "${admin.username}".`,
    request,
    actor: admin.username,
  });
  return Response.json({ ok: true });
}
