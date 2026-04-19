import { getSession } from "@/lib/auth";
import { sendNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { url } = (body ?? {}) as { url?: string };
  if (!url) return new Response("url required", { status: 400 });

  const result = await sendNotification({
    appriseUrl: url,
    title: "Access Control",
    body: "AppRise notification test from Access Control.",
    type: "info",
  });

  if (!result.ok) {
    return new Response(result.error ?? "Notification failed", { status: 502 });
  }

  return new Response(null, { status: 204 });
}
