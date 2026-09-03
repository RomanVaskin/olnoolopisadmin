import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont, rgb } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

export interface VkParticipant {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
}

export interface GenerateVkPolicyInput {
  applicationId: string;
  tournamentSlug: string;
  policyNumber: string;
  policyDate: string;
  policyStartDate: string;
  policyEndDate: string;
  participant: VkParticipant;
  sport: string;
  insuranceAmount: number;
  premium?: number;
}

const DEFAULT_PREMIUM = 78;

export interface PolicyGenerationResult {
  pdfPath: string;
  absolutePdfPath: string;
  generatedAt: string;
}

const FONT_CANDIDATES = [process.env.SPORTPOLIS_PDF_FONT, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/Library/Fonts/Arial Unicode.ttf"].filter((value): value is string => Boolean(value));
const FIELD_ALIASES: Record<string, string[]> = {
  policyNumber: ["policy_number", "policyNumber", "Номер полиса"], policyDate: ["policy_date", "policyDate", "Дата полиса"],
  policyStartDate: ["policy_start_date", "policyStartDate", "Дата начала"], policyEndDate: ["policy_end_date", "policyEndDate", "Дата окончания"],
  participantName: ["participant_name", "participantName", "ФИО"], birthDate: ["birth_date", "birthDate", "Дата рождения"],
  passport: ["passport", "Паспорт"], sport: ["sport", "Вид спорта"], insuranceAmount: ["insurance_amount", "insuranceAmount", "Страховая сумма"],
  premium: ["premium", "Страховая премия"], paymentDeadline: ["payment_deadline", "paymentDeadline", "Срок уплаты страховой премии"],
};

const VK_COORDINATES = {
  page1: {
    policyNumber: { x: 290, y: 776, size: 8 },
    policyStartDate: { x: 374, y: 568, size: 5.5 },
    policyEndDate: { x: 416, y: 568, size: 5.5 },
    policyDate: { x: 373, y: 58, size: 6 },
    // Черновая оценка: не подтверждена визуально (PDF не анализировался), требует проверки на тестовом PDF.
    premium: { x: 373, y: 82, size: 6 },
    paymentDeadline: { x: 373, y: 70, size: 6 },
  },
  page2: {
    firstRow: {
      fullName: { x: 45, y: 711, size: 5.5, lineHeight: 7 },
    },
  },
} as const;

async function loadFont(): Promise<Uint8Array> {
  for (const candidate of FONT_CANDIDATES) { try { return await fs.readFile(candidate); } catch { /* try next */ } }
  throw new Error("Не найден шрифт с поддержкой кириллицы. Установите DejaVu Sans или задайте SPORTPOLIS_PDF_FONT");
}

function participantName(participant: VkParticipant): string { return [participant.lastName, participant.firstName, participant.middleName].filter(Boolean).join(" "); }
function safePolicyNumber(value: string): string { if (!/^VK[A-Za-z0-9._-]*$/.test(value)) throw new Error("Некорректный номер полиса VK"); return value; }

function drawFallback(pdf: PDFDocument, font: PDFFont, input: GenerateVkPolicyInput) {
  const page1 = pdf.getPage(0);
  const page1Fields = [
    [input.policyNumber, VK_COORDINATES.page1.policyNumber],
    [input.policyStartDate, VK_COORDINATES.page1.policyStartDate],
    [input.policyEndDate, VK_COORDINATES.page1.policyEndDate],
    [input.policyDate, VK_COORDINATES.page1.policyDate],
    [String(input.premium), VK_COORDINATES.page1.premium],
    [input.policyDate, VK_COORDINATES.page1.paymentDeadline],
  ] as const;
  for (const [text, coordinates] of page1Fields) page1.drawText(text, { ...coordinates, font, color: rgb(0, 0, 0) });

  if (pdf.getPageCount() < 2) return;
  const page2 = pdf.getPage(1);
  const { fullName } = VK_COORDINATES.page2.firstRow;
  const name = [input.participant.lastName, [input.participant.firstName, input.participant.middleName].filter(Boolean).join(" ")].filter(Boolean).join("\n");
  page2.drawText(name, { ...fullName, font, color: rgb(0, 0, 0) });
}

function fillFormIfPresent(pdf: PDFDocument, font: PDFFont, input: GenerateVkPolicyInput): boolean {
  const form = pdf.getForm(); if (form.getFields().length === 0) return false;
  const values: Record<string, string> = { policyNumber: input.policyNumber, policyDate: input.policyDate, policyStartDate: input.policyStartDate, policyEndDate: input.policyEndDate, participantName: participantName(input.participant), birthDate: input.participant.birthDate, passport: `${input.participant.passportSeries} ${input.participant.passportNumber}`, sport: input.sport, insuranceAmount: String(input.insuranceAmount), premium: String(input.premium), paymentDeadline: input.policyDate };
  let filled = 0;
  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) for (const name of aliases) { try { form.getTextField(name).setText(values[key]); filled++; break; } catch { /* alias absent */ } }
  if (filled > 0) { form.updateFieldAppearances(font); form.flatten(); }
  return filled > 0;
}

export async function generateVkPolicy(rawInput: GenerateVkPolicyInput): Promise<PolicyGenerationResult> {
  const input: GenerateVkPolicyInput = { ...rawInput, premium: rawInput.premium ?? DEFAULT_PREMIUM };
  const policyNumber = safePolicyNumber(input.policyNumber);
  const templatePath = path.join(process.cwd(), "templates", "vk.pdf");
  try { await fs.access(templatePath); } catch { throw new Error(`Не найден PDF-шаблон: ${templatePath}`); }
  const pdf = await PDFDocument.load(await fs.readFile(templatePath));
  if (pdf.getPageCount() === 0) throw new Error("PDF-шаблон VK не содержит страниц");
  pdf.registerFontkit(fontkit); const font = await pdf.embedFont(await loadFont(), { subset: true });
  if (!fillFormIfPresent(pdf, font, input)) drawFallback(pdf, font, input);
  pdf.setTitle(`Полис ${policyNumber}`); pdf.setSubject(`VK, заявка ${input.applicationId}, турнир ${input.tournamentSlug}`);
  const generatedDir = path.join(process.cwd(), "generated"); await fs.mkdir(generatedDir, { recursive: true });
  const absolutePdfPath = path.join(generatedDir, `${policyNumber}.pdf`); const temporaryPath = `${absolutePdfPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, await pdf.save()); await fs.rename(temporaryPath, absolutePdfPath);
  return { pdfPath: path.posix.join("generated", `${policyNumber}.pdf`), absolutePdfPath, generatedAt: new Date().toISOString() };
}
