import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifyToken } from "@/lib/auth-jwt";

// Next.js 16 renamed `middleware` to `proxy`. See AGENTS.md.
export async function proxy(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifyToken(cookie);
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

// Only guard app pages that require a browser session.
// API routes perform their own auth and should return API responses instead of
// being redirected to `/login` by the proxy layer.
// Root `/` is NOT matched here — it is handled by src/app/page.tsx which decides
// setup vs login vs dashboard.
export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|login|setup|$).*)",
  ],
};
