import fs from "node:fs/promises";
import path from "node:path";
import { generateVkPolicy, type GenerateVkPolicyInput } from "./policy-generator";
import { markPolicyNumberIssued, releasePolicyNumber, reserveNextPolicyNumber } from "./policy-pool";

export type IssueVkPolicyInput = Omit<GenerateVkPolicyInput, "policyNumber">;
export interface IssuePolicyResult { policyNumber: string; status: "issued"; pdfPath: string; }

export async function issueVkPolicy(input: IssueVkPolicyInput): Promise<IssuePolicyResult> {
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
