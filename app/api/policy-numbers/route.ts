import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PolicyNumber } from "@/lib/policy-pool";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const status = request.nextUrl.searchParams.get("status");
  const search = request.nextUrl.searchParams.get("search")?.trim();
  const where: string[] = [];
  const params: string[] = [];
  if (type && ["VK", "VI", "SYS"].includes(type)) { where.push("policy_type = ?"); params.push(type); }
  if (status && ["available", "reserved", "issued"].includes(status)) { where.push("status = ?"); params.push(status); }
  if (search) {
    where.push("(policy_number LIKE ? OR participant_name LIKE ? OR tournament_slug LIKE ? OR application_id LIKE ?)");
    const query = `%${search}%`;
    params.push(query, query, query, query);
  }
  const sql = `SELECT * FROM policy_numbers ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC`;
  const items = db.prepare(sql).all(...params) as PolicyNumber[];
  return NextResponse.json({ items, total: items.length });
}
