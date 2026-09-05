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
  sport?: string;
  insuranceAmount?: number;
  premium?: number;
  /** Имя файла PDF в каталоге generated/. По умолчанию `${policyNumber}.pdf`. Нужно, когда несколько заявок используют один и тот же номер полиса (sport613). */
  pdfFileName?: string;
}

const DEFAULT_PREMIUM = 78;

// Цвет динамического текста подобран под цвет печатного текста бланка vk.pdf (замер по пикселям: rgb(10,80,160)).
const TEMPLATE_TEXT_COLOR = rgb(10 / 255, 80 / 255, 160 / 255);

// Фон ячеек templates/vk.pdf: RGB (242, 242, 242), измерен по растру второй страницы.
const PREMIUM_MASK_COLOR = rgb(242 / 255, 242 / 255, 242 / 255);
// Отдельные маски значений сохраняют заголовок и границы всех 20 строк таблицы.
const PREMIUM_VALUE_MASK = { x: 545, y: 698, width: 23, height: 12, rowStep: 31.547, rowCount: 20 } as const;

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
  paymentDeadline: ["payment_deadline", "paymentDeadline", "Срок уплаты страховой премии"],
};

// Координаты подобраны по факсимильному растру templates/vk.pdf (150dpi) и проверены визуально на тестовом PDF.
const VK_COORDINATES = {
  page1: {
    policyNumber: { x: 345, y: 772, size: 9 },
    policyStartDate: { x: 374, y: 568, size: 5 },
    policyEndDate: { x: 416, y: 568, size: 5 },
    // "СТРАХОВАЯ ПРЕМИЯ" (цифрами/прописью) на первом листе не печатается.
    // "Порядок оплаты страховой премии: единовременно в сумме ___ руб. в срок до ___"
    // Динамическая сумма не выводится; текст строки остаётся в шаблоне.
    paymentDeadlineDate: { x: 277, y: 530, size: 6 },
    // "ДАТА ЗАКЛЮЧЕНИЯ ДОГОВОРА" внизу страницы
    contractDate: { x: 373, y: 60, size: 6 },
  },
  page2: {
    firstRow: {
      fullName: { x: 45, y: 706, size: 7, lineHeight: 8 },
      birthDate: { x: 143, y: 700, size: 7 },
      insuranceStart: { x: 307, y: 711, size: 7 },
      insuranceEnd: { x: 307, y: 703, size: 7 },
    },
  },
  page3: {
    contractDate: { x: 370, y: 805, size: 6 },
  },
} as const;

async function loadFont(): Promise<Uint8Array> {
  for (const candidate of FONT_CANDIDATES) { try { return await fs.readFile(candidate); } catch { /* try next */ } }
  throw new Error("Не найден шрифт с поддержкой кириллицы. Установите DejaVu Sans или задайте SPORTPOLIS_PDF_FONT");
}

function participantName(participant: VkParticipant): string { return [participant.lastName, participant.firstName, participant.middleName].filter(Boolean).join(" "); }
function safePolicyNumber(value: string): string { if (!/^VK[A-Za-z0-9._-]*$/.test(value)) throw new Error("Некорректный номер полиса VK"); return value; }
function safePdfFileName(value: string): string { if (!/^[A-Za-z0-9._-]+\.pdf$/.test(value)) throw new Error("Некорректное имя файла PDF"); return value; }

function drawFallback(pdf: PDFDocument, font: PDFFont, input: GenerateVkPolicyInput) {
  const page1 = pdf.getPage(0);
  const page1Fields = [
    [input.policyNumber, VK_COORDINATES.page1.policyNumber],
    [input.policyStartDate, VK_COORDINATES.page1.policyStartDate],
    [input.policyEndDate, VK_COORDINATES.page1.policyEndDate],
    // Страховая премия (цифрами/прописью) на первом листе не выводится.
    [input.policyDate, VK_COORDINATES.page1.paymentDeadlineDate],
    [input.policyDate, VK_COORDINATES.page1.contractDate],
  ] as const;
  for (const [text, coordinates] of page1Fields) page1.drawText(text, { ...coordinates, font, color: TEMPLATE_TEXT_COLOR });

  if (pdf.getPageCount() < 2) return;
  const page2 = pdf.getPage(1);
  const { fullName, birthDate, insuranceStart, insuranceEnd } = VK_COORDINATES.page2.firstRow;
  const participantNameLines = [input.participant.lastName, [input.participant.firstName, input.participant.middleName].filter(Boolean).join(" ")].join("\n");
  page2.drawText(participantNameLines, { ...fullName, font, color: TEMPLATE_TEXT_COLOR });
  page2.drawText(input.participant.birthDate, { ...birthDate, font, color: TEMPLATE_TEXT_COLOR });
  page2.drawText(input.policyStartDate, { ...insuranceStart, font, color: TEMPLATE_TEXT_COLOR });
  page2.drawText(input.policyEndDate, { ...insuranceEnd, font, color: TEMPLATE_TEXT_COLOR });
  if (pdf.getPageCount() >= 3) {
    pdf.getPage(2).drawText(input.policyDate, { ...VK_COORDINATES.page3.contractDate, font, color: TEMPLATE_TEXT_COLOR });
  }
}

function fillFormIfPresent(pdf: PDFDocument, font: PDFFont, input: GenerateVkPolicyInput): boolean {
  const form = pdf.getForm(); if (form.getFields().length === 0) return false;
  const values: Record<string, string> = { policyNumber: input.policyNumber, policyDate: input.policyDate, policyStartDate: input.policyStartDate, policyEndDate: input.policyEndDate, participantName: participantName(input.participant), birthDate: input.participant.birthDate, passport: `${input.participant.passportSeries} ${input.participant.passportNumber}`, sport: input.sport ?? "", insuranceAmount: String(input.insuranceAmount ?? 0), paymentDeadline: input.policyDate };
  let filled = 0;
  for (const [key, aliases] of Object.entries(FIELD_ALIASES)) for (const name of aliases) { try { form.getTextField(name).setText(values[key]); filled++; break; } catch { /* alias absent */ } }
  if (filled > 0) { form.updateFieldAppearances(font); form.flatten(); }
  return filled > 0;
}

export async function generateVkPolicy(rawInput: GenerateVkPolicyInput): Promise<PolicyGenerationResult> {
  const sport613Values = rawInput.tournamentSlug === "sport613" ? { policyStartDate: "06.09.2026", policyEndDate: "06.09.2026", premium: 78 } : {};
  const input: GenerateVkPolicyInput = { ...rawInput, ...sport613Values, premium: sport613Values.premium ?? rawInput.premium ?? DEFAULT_PREMIUM, sport: rawInput.sport ?? "", insuranceAmount: rawInput.insuranceAmount ?? 0 };
  const policyNumber = safePolicyNumber(input.policyNumber);
  const templatePath = path.join(process.cwd(), "templates", "vk.pdf");
  try { await fs.access(templatePath); } catch { throw new Error(`Не найден PDF-шаблон: ${templatePath}`); }
  const pdf = await PDFDocument.load(await fs.readFile(templatePath));
  if (pdf.getPageCount() === 0) throw new Error("PDF-шаблон VK не содержит страниц");
  pdf.registerFontkit(fontkit); const font = await pdf.embedFont(await loadFont(), { subset: true });
  if (!fillFormIfPresent(pdf, font, input)) drawFallback(pdf, font, input);
  if (pdf.getPageCount() >= 2) {
    const { x, y, width, height, rowStep, rowCount } = PREMIUM_VALUE_MASK;
    for (let row = 0; row < rowCount; row++) {
      pdf.getPage(1).drawRectangle({ x, y: y - row * rowStep, width, height, color: PREMIUM_MASK_COLOR });
    }
  }
  pdf.setTitle(`Полис ${policyNumber}`); pdf.setSubject(`VK, заявка ${input.applicationId}, турнир ${input.tournamentSlug}`);
  const fileName = safePdfFileName(input.pdfFileName ?? `${policyNumber}.pdf`);
  const generatedDir = path.join(process.cwd(), "generated"); await fs.mkdir(generatedDir, { recursive: true });
  const absolutePdfPath = path.join(generatedDir, fileName); const temporaryPath = `${absolutePdfPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, await pdf.save()); await fs.rename(temporaryPath, absolutePdfPath);
  return { pdfPath: path.posix.join("generated", fileName), absolutePdfPath, generatedAt: new Date().toISOString() };
}
