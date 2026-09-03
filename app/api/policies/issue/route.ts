import { NextResponse } from "next/server";
import { issueVkPolicy, type IssueVkPolicyInput } from "@/lib/issue-policy";

export const runtime = "nodejs";
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
const API_KEY = process.env.SPORTPOLIS_POLICY_API_KEY;
function authorized(request: Request): boolean { return !API_KEY || request.headers.get("x-api-key") === API_KEY; }

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Неверный API-ключ" }, { status: 401 });
  const body = await request.json().catch(() => null) as (IssueVkPolicyInput & { policyType?: string }) | null;
  if (!body) return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  if (body.policyType !== "VK") return NextResponse.json({ error: "Сейчас поддерживается выпуск только полисов VK" }, { status: 400 });
  const participant = body.participant;
  const required = [body.applicationId, body.tournamentSlug, body.policyDate, body.policyStartDate, body.policyEndDate, participant?.lastName, participant?.firstName, participant?.birthDate, participant?.passportSeries, participant?.passportNumber];
  if (!required.every(text) || !participant || typeof participant.middleName !== "string") return NextResponse.json({ error: "Заполните обязательные поля участника и даты" }, { status: 400 });
  try { return NextResponse.json(await issueVkPolicy({ ...body, sport: body.sport ?? "" })); }
  catch (error) { const message = error instanceof Error ? error.message : "Не удалось выпустить полис"; const status = message.startsWith("Нет свободных") ? 409 : message.startsWith("Не найден PDF-шаблон") ? 503 : 500; return NextResponse.json({ error: message }, { status }); }
}
