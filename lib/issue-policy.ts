import fs from "node:fs/promises";
import path from "node:path";
import { generateVkPolicy, type GenerateVkPolicyInput } from "./policy-generator";
import { markPolicyNumberIssued, releasePolicyNumber, reserveNextPolicyNumber } from "./policy-pool";

export type IssueVkPolicyInput = Omit<GenerateVkPolicyInput, "policyNumber">;
export interface IssuePolicyResult { policyNumber: string; status: "issued"; pdfPath: string; }

// sport613: все участники получают один и тот же номер полиса, поэтому обычный policy pool
// (уникальный policy_number в БД) здесь не подходит — номер выпускается вне пула, а каждой
// заявке присваивается собственный файл PDF.
export const SPORT613_TOURNAMENT_SLUG = "sport613";
export const SPORT613_VK_POLICY_NUMBER = "VK400457156";

/** Суффикс имени файла на основе applicationId: небезопасные символы заменяются на "-". */
export function sport613VkPdfFileName(applicationId: string): string {
  const suffix = applicationId.trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!suffix) throw new Error("Некорректный applicationId");
  return `${SPORT613_VK_POLICY_NUMBER}-${suffix}.pdf`;
}

async function issueSport613VkPolicy(input: IssueVkPolicyInput): Promise<IssuePolicyResult> {
  const pdfFileName = sport613VkPdfFileName(input.applicationId);
  await generateVkPolicy({ ...input, policyNumber: SPORT613_VK_POLICY_NUMBER, pdfFileName });
  return {
    policyNumber: SPORT613_VK_POLICY_NUMBER,
    status: "issued",
    pdfPath: `/api/policies/${encodeURIComponent(SPORT613_VK_POLICY_NUMBER)}/pdf?applicationId=${encodeURIComponent(input.applicationId)}`,
  };
}

export async function issueVkPolicy(input: IssueVkPolicyInput): Promise<IssuePolicyResult> {
  if (input.tournamentSlug === SPORT613_TOURNAMENT_SLUG) return issueSport613VkPolicy(input);
  const name = [input.participant.lastName, input.participant.firstName, input.participant.middleName].filter(Boolean).join(" ");
  const policy = reserveNextPolicyNumber("VK", input.applicationId, input.tournamentSlug, name);
  if (policy.status === "issued") {
    if (!policy.pdf_path) throw new Error("Полис выпущен, но путь к PDF отсутствует");
    await fs.access(path.join(process.cwd(), "generated", `${policy.policy_number}.pdf`));
    return { policyNumber: policy.policy_number, status: "issued", pdfPath: `/api/policies/${encodeURIComponent(policy.policy_number)}/pdf` };
  }
  try {
    const generated = await generateVkPolicy({ ...input, policyNumber: policy.policy_number });
    markPolicyNumberIssued(policy.policy_number, generated.pdfPath);
    return { policyNumber: policy.policy_number, status: "issued", pdfPath: `/api/policies/${encodeURIComponent(policy.policy_number)}/pdf` };
  } catch (error) {
    releasePolicyNumber(policy.policy_number);
    await fs.unlink(path.join(process.cwd(), "generated", `${policy.policy_number}.pdf`)).catch(() => undefined);
    throw error;
  }
}
