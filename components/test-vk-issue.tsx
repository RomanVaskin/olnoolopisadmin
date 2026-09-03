"use client";

import { FormEvent, useState } from "react";

interface Result { policyNumber: string; status: "issued"; pdfPath: string; }

export default function TestVkIssue({ close, issued }: { close: () => void; issued: () => Promise<void> }) {
  const [pending, setPending] = useState(false); const [error, setError] = useState(""); const [result, setResult] = useState<Result | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setResult(null); const data = new FormData(event.currentTarget);
    const response = await fetch("/api/policies/issue", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      applicationId: data.get("applicationId"), tournamentSlug: "sport613", policyType: "VK", policyDate: data.get("policyDate"), policyStartDate: data.get("policyStartDate"), policyEndDate: data.get("policyEndDate"), sport: data.get("sport"), insuranceAmount: 100000,
      participant: { lastName: data.get("lastName"), firstName: data.get("firstName"), middleName: data.get("middleName"), birthDate: data.get("birthDate"), passportSeries: data.get("passportSeries"), passportNumber: data.get("passportNumber") },
    }) });
    const body = await response.json(); if (response.ok) { setResult(body); await issued(); } else setError(body.error ?? "Ошибка выпуска"); setPending(false);
  }
  const inputClass = "mt-1 w-full border border-black/20 px-3 py-2 text-sm outline-none focus:border-black";
  return <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/30 sm:items-center sm:p-5" role="dialog" aria-modal="true"><div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto bg-white p-6 sm:p-9"><div className="flex justify-between"><div><h2 className="text-3xl font-medium">Тестовый выпуск VK</h2><p className="mt-2 text-sm text-black/50">Локальная проверка · sport613 · 100 000 ₽</p></div><button onClick={close} className="p-1 text-2xl" aria-label="Закрыть">×</button></div>
    <form onSubmit={submit} className="mt-7 grid gap-4 sm:grid-cols-3">
      <Field name="applicationId" label="Application ID" required className={inputClass} /><Field name="lastName" label="Фамилия" required className={inputClass} /><Field name="firstName" label="Имя" required className={inputClass} /><Field name="middleName" label="Отчество" className={inputClass} /><Field name="birthDate" label="Дата рождения" required className={inputClass} /><Field name="passportSeries" label="Серия паспорта" required className={inputClass} /><Field name="passportNumber" label="Номер паспорта" required className={inputClass} /><Field name="sport" label="Вид спорта" required className={inputClass} />
      <Field name="policyDate" label="Дата полиса" required defaultValue="05.09.2026" className={inputClass} /><Field name="policyStartDate" label="Начало" required defaultValue="05.09.2026" className={inputClass} /><Field name="policyEndDate" label="Окончание" required defaultValue="05.09.2026" className={inputClass} />
      {error && <p className="sm:col-span-3 border border-black p-3 text-sm" role="alert">{error}</p>}{result && <div className="sm:col-span-3 border border-black/15 p-4 text-sm">Полис <strong>{result.policyNumber}</strong> выпущен. <a href={result.pdfPath} className="ml-2 underline underline-offset-4">Скачать PDF</a></div>}
      <button disabled={pending} className="bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50 sm:col-span-3">{pending ? "Формирование…" : "Выпустить тестовый полис"}</button>
    </form></div></div>;
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) { return <label className="text-sm font-medium">{label}<input {...props} /></label>; }
