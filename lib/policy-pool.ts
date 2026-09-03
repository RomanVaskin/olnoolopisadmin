import { db } from "./db";

export type PolicyType = "VK" | "VI" | "SYS";
export type PolicyStatus = "available" | "reserved" | "issued";

export interface PolicyNumber {
  id: number;
  policy_number: string;
  policy_type: PolicyType;
  status: PolicyStatus;
  application_id: string | null;
  tournament_slug: string | null;
  participant_name: string | null;
  reserved_at: string | null;
  issued_at: string | null;
  pdf_path: string | null;
  created_at: string;
}

export interface ImportResult { added: number; duplicates: number; rejected: number; }

export function importPolicyNumbers(input: string | string[], policyType: PolicyType): ImportResult {
  const lines = (Array.isArray(input) ? input : input.split(/\r?\n/)).map((v) => v.trim()).filter(Boolean);
  const unique = new Set<string>();
  let duplicates = 0;
  let rejected = 0;
  for (const value of lines) {
    if (!value.startsWith(policyType)) { rejected++; continue; }
    if (unique.has(value)) { duplicates++; continue; }
    unique.add(value);
  }
  const insert = db.prepare("INSERT OR IGNORE INTO policy_numbers (policy_number, policy_type) VALUES (?, ?)");
  let added = 0;
  db.transaction(() => {
    for (const value of unique) {
      const result = insert.run(value, policyType);
      if (result.changes) added++; else duplicates++;
    }
  })();
  return { added, duplicates, rejected };
}

export const reserveNextPolicyNumber = db.transaction((policyType: PolicyType, applicationId: string, tournamentSlug?: string | null, participantName?: string | null): PolicyNumber => {
  const existing = db.prepare(`SELECT * FROM policy_numbers WHERE policy_type = ? AND application_id = ? AND status IN ('reserved', 'issued') ORDER BY id LIMIT 1`).get(policyType, applicationId) as PolicyNumber | undefined;
  if (existing) return existing;

  const next = db.prepare("SELECT id FROM policy_numbers WHERE policy_type = ? AND status = 'available' ORDER BY id LIMIT 1").get(policyType) as { id: number } | undefined;
  if (!next) throw new Error(`Нет свободных номеров типа ${policyType}`);

  const now = new Date().toISOString();
  const updated = db.prepare(`UPDATE policy_numbers SET status = 'reserved', application_id = ?, tournament_slug = ?, participant_name = ?, reserved_at = ? WHERE id = ? AND status = 'available'`).run(applicationId, tournamentSlug ?? null, participantName ?? null, now, next.id);
  if (updated.changes !== 1) throw new Error("Не удалось зарезервировать номер");
  return db.prepare("SELECT * FROM policy_numbers WHERE id = ?").get(next.id) as PolicyNumber;
});

export const markPolicyNumberIssued = db.transaction((policyNumber: string, pdfPath?: string | null): PolicyNumber => {
  const result = db.prepare(`UPDATE policy_numbers SET status = 'issued', issued_at = ?, pdf_path = ? WHERE policy_number = ? AND status = 'reserved'`).run(new Date().toISOString(), pdfPath ?? null, policyNumber);
  if (result.changes !== 1) throw new Error("Номер не найден или не зарезервирован");
  return db.prepare("SELECT * FROM policy_numbers WHERE policy_number = ?").get(policyNumber) as PolicyNumber;
});

export const releasePolicyNumber = db.transaction((policyNumber: string): boolean => {
  const result = db.prepare(`UPDATE policy_numbers SET status = 'available', application_id = NULL, tournament_slug = NULL, participant_name = NULL, reserved_at = NULL WHERE policy_number = ? AND status = 'reserved'`).run(policyNumber);
  return result.changes === 1;
});

export function getPolicyNumberForApplication(applicationId: string, policyType: PolicyType): PolicyNumber | null {
  return (db.prepare(`SELECT * FROM policy_numbers WHERE application_id = ? AND policy_type = ? AND status IN ('reserved', 'issued') ORDER BY id LIMIT 1`).get(applicationId, policyType) as PolicyNumber | undefined) ?? null;
}
