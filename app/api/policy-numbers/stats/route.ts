import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = db.prepare(`SELECT policy_type, status, COUNT(*) AS count FROM policy_numbers GROUP BY policy_type, status`).all() as Array<{ policy_type: string; status: string; count: number }>;
  const stats: Record<string, { total: number; available: number; reserved: number; issued: number }> = {};
  for (const type of ["VK", "VI", "SYS"]) stats[type] = { total: 0, available: 0, reserved: 0, issued: 0 };
  for (const row of rows) { stats[row.policy_type][row.status as "available" | "reserved" | "issued"] = row.count; stats[row.policy_type].total += row.count; }
  return NextResponse.json(stats);
}
