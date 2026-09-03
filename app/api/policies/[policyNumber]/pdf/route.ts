import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ policyNumber: string }> }) {
  const { policyNumber } = await params;
  const policy = db.prepare("SELECT policy_number, status, pdf_path FROM policy_numbers WHERE policy_number = ?").get(policyNumber) as { policy_number: string; status: string; pdf_path: string | null } | undefined;
  if (!policy || policy.status !== "issued" || !policy.pdf_path) return NextResponse.json({ error: "Выпущенный полис с PDF не найден" }, { status: 404 });
  if (!/^VK[A-Za-z0-9._-]*$/.test(policy.policy_number)) return NextResponse.json({ error: "Некорректный номер полиса" }, { status: 400 });
  const filePath = path.join(process.cwd(), "generated", `${policy.policy_number}.pdf`);
  try { const file = await fs.readFile(filePath); return new NextResponse(file, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${policy.policy_number}.pdf"`, "cache-control": "private, no-store" } }); }
  catch { return NextResponse.json({ error: "PDF-файл отсутствует" }, { status: 404 }); }
}
