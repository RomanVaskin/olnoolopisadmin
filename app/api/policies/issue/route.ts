import { NextResponse } from "next/server";
import { issueVkPolicy, type IssueVkPolicyInput } from "@/lib/issue-policy";

export const runtime = "nodejs";
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as (IssueVkPolicyInput & { policyType?: string }) | null;
  if (!body) return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  if (body.policyType !== "VK") return NextResponse.json({ error: "Сейчас поддерживается выпуск только полисов VK" }, { status: 400 });
  const participant = body.participant;
  const required = [body.applicationId, body.tournamentSlug, body.policyDate, body.policyStartDate, body.policyEndDate, body.sport, participant?.lastName, participant?.firstName, participant?.birthDate, participant?.passportSeries, participant?.passportNumber];
  if (!required.every(text) || !participant || typeof participant.middleName !== "string" || typeof body.insuranceAmount !== "number" || !Number.isFinite(body.insuranceAmount) || body.insuranceAmount <= 0) return NextResponse.json({ error: "Заполните обязательные поля участника, даты, спорт и положительную страховую сумму" }, { status: 400 });
  try { return NextResponse.json(await issueVkPolicy(body)); }
  catch (error) { const message = error instanceof Error ? error.message : "Не удалось выпустить полис"; const status = message.startsWith("Нет свободных") ? 409 : message.startsWith("Не найден PDF-шаблон") ? 503 : 500; return NextResponse.json({ error: message }, { status }); }
}
