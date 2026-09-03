import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sportpolis_admin_session";

function password(): string {
  return process.env.SPORTPOLIS_ADMIN_PASSWORD ?? "";
}

export function isAuthConfigured(): boolean {
  return password().length > 0;
}

export function validPassword(candidate: string): boolean {
  const expected = Buffer.from(password());
  const actual = Buffer.from(candidate);
  return expected.length > 0 && expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function sessionToken(): string {
  return createHmac("sha256", password()).update("sportpolis-admin-session-v1").digest("hex");
}

export function validSession(candidate?: string): boolean {
  if (!candidate || !isAuthConfigured()) return false;
  const expected = Buffer.from(sessionToken());
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
