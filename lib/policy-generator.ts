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
}

const DEFAULT_PREMIUM = 78;

// Цвет динамического текста подобран под цвет печатного текста бланка vk.pdf (замер по пикселям: rgb(10,80,160)).
const TEMPLATE_TEXT_COLOR = rgb(10 / 255, 80 / 255, 160 / 255);

const ONES_MASCULINE = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

function numberBelowThousandToWords(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);
  if (remainder >= 10 && remainder <= 19) { parts.push(TEENS[remainder - 10]); }
  else {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    if (tens > 0) parts.push(TENS[tens]);
    if (ones > 0) parts.push(ONES_MASCULINE[ones]);
  }
  return parts.join(" ");
}

/** Прописью для целого рублёвого номинала (0–999). Премии VK-полиса не выходят за эти пределы. */
function rublesToWordsRu(value: number): string {
  if (value === 0) return "ноль";
  const words = numberBelowThousandToWords(Math.trunc(Math.abs(value)));
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatPremiumDigits(premium: number): string { return `${premium} руб. 00 коп.`; }
function formatPremiumWords(premium: number): string { return `${rublesToWordsRu(premium)} рублей 00 копеек`; }
/** Сумма для строки "...в сумме ___ руб. в срок до ___": после бланка уже напечатано "руб.", поэтому здесь только число. */
function formatPremiumAmountOnly(premium: number): string { return `${premium}`; }

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

// Координаты подобраны по факсимильному растру templates/vk.pdf (150dpi) и проверены визуально на тестовом PDF.
const VK_COORDINATES = {
  page1: {
    policyNumber: { x: 345, y: 772, size: 9 },
    policyStartDate: { x: 374, y: 568, size: 5 },
    policyEndDate: { x: 416, y: 568, size: 5 },
    // "СТРАХОВАЯ ПРЕМИЯ": строка "цифрами"
    premiumDigits: { x: 216, y: 547, size: 6 },
    // "СТРАХОВАЯ ПРЕМИЯ": строка "прописью"
    premiumWords: { x: 216, y: 540, size: 6 },
    // "Порядок оплаты страховой премии: единовременно в сумме ___ руб. в срок до ___"
    paymentAmount: { x: 207, y: 530, size: 5.5 },
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

function drawFallback(pdf: PDFDocument, font: PDFFont, input: GenerateVkPolicyInput) {
  const premium = input.premium ?? DEFAULT_PREMIUM;
  const page1 = pdf.getPage(0);
  const page1Fields = [
    [input.policyNumber, VK_COORDINATES.page1.policyNumber],
    [input.policyStartDate, VK_COORDINATES.page1.policyStartDate],
    [input.policyEndDate, VK_COORDINATES.page1.policyEndDate],
    [formatPremiumDigits(premium), VK_COORDINATES.page1.premiumDigits],
    [formatPremiumWords(premium), VK_COORDINATES.page1.premiumWords],
    [formatPremiumAmountOnly(premium), VK_COORDINATES.page1.paymentAmount],
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
  const values: Record<string, string> = { policyNumber: input.policyNumber, policyDate: input.policyDate, policyStartDate: input.policyStartDate, policyEndDate: input.policyEndDate, participantName: participantName(input.participant), birthDate: input.participant.birthDate, passport: `${input.participant.passportSeries} ${input.participant.passportNumber}`, sport: input.sport ?? "", insuranceAmount: String(input.insuranceAmount ?? 0), premium: String(input.premium), paymentDeadline: input.policyDate };
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
  pdf.setTitle(`Полис ${policyNumber}`); pdf.setSubject(`VK, заявка ${input.applicationId}, турнир ${input.tournamentSlug}`);
  const generatedDir = path.join(process.cwd(), "generated"); await fs.mkdir(generatedDir, { recursive: true });
  const absolutePdfPath = path.join(generatedDir, `${policyNumber}.pdf`); const temporaryPath = `${absolutePdfPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, await pdf.save()); await fs.rename(temporaryPath, absolutePdfPath);
  return { pdfPath: path.posix.join("generated", `${policyNumber}.pdf`), absolutePdfPath, generatedAt: new Date().toISOString() };
}
