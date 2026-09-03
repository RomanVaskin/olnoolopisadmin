import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, validSession } from "@/lib/auth";

// Машинные эндпоинты выпуска/скачивания VK-полиса вызываются из другого
// проекта (sportpolis) без cookie-сессии дашборда — у них своя проверка
// SPORTPOLIS_POLICY_API_KEY внутри самого роута.
function isPolicyServiceRoute(pathname: string): boolean {
  return pathname === "/api/policies/issue" || (pathname.startsWith("/api/policies/") && pathname.endsWith("/pdf"));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/") || isPolicyServiceRoute(pathname)) return NextResponse.next();
  if (validSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
