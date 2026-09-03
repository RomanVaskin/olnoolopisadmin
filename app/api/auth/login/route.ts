import { NextResponse } from "next/server";
import { isAuthConfigured, SESSION_COOKIE, sessionToken, validPassword } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isAuthConfigured()) return NextResponse.json({ error: "SPORTPOLIS_ADMIN_PASSWORD не настроен" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || !validPassword(body.password)) return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken(), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return response;
}
