import { getSession, hashPassword, listAdminUsers, createAdmin } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const users = listAdminUsers().map((u) => ({
    id: u.id,
    username: u.username,
    active: !!u.active,
    created_at: u.created_at,
    updated_at: u.updated_at,
    last_login_at: u.last_login_at,
  }));
  return Response.json({ users });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { username, password } = (body ?? {}) as {
    username?: string;
    password?: string;
  };

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return new Response("Username must be at least 3 characters", { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return new Response("Password must be at least 8 characters", { status: 400 });
  }

  const trimmed = username.trim();
  const hash = await hashPassword(password);
  try {
    createAdmin(trimmed, hash);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("UNIQUE") || error.message.includes("constraint"))
    ) {
      return new Response("Username already exists", { status: 409 });
    }
    throw error;
  }

  auditLog({
    level: "info",
    category: "auth",
    action: "auth.admin_user_created",
    message: `Admin user ${trimmed} created by ${session.username}.`,
    request,
    actor: session.username,
    details: { username: trimmed },
  });

  return Response.json({ ok: true });
}
