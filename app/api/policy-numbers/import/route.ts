import { NextResponse } from "next/server";
import { importPolicyNumbers, type PolicyType } from "@/lib/policy-pool";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { policyType?: PolicyType; numbers?: string } | null;
  if (!body || !["VK", "VI"].includes(body.policyType ?? "") || typeof body.numbers !== "string") {
    return NextResponse.json({ error: "Передайте policyType (VK или VI) и numbers" }, { status: 400 });
  }
  return NextResponse.json(importPolicyNumbers(body.numbers, body.policyType!));
}
