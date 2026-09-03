"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PolicyNumber, PolicyStatus, PolicyType } from "@/lib/policy-pool";
import TestVkIssue from "./test-vk-issue";

type Counts = { total: number; available: number; reserved: number; issued: number };
const empty: Counts = { total: 0, available: 0, reserved: 0, issued: 0 };
const labels: Record<PolicyStatus, string> = { available: "Свободен", reserved: "Зарезервирован", issued: "Выпущен" };

export default function Dashboard({ showTestIssue }: { showTestIssue: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<PolicyNumber[]>([]);
  const [recent, setRecent] = useState<PolicyNumber[]>([]);
  const [stats, setStats] = useState<Record<string, Counts>>({ VK: empty, VI: empty });
  const [type, setType] = useState(""); const [status, setStatus] = useState(""); const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false); const [testOpen, setTestOpen] = useState(false); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const query = new URLSearchParams(); if (type) query.set("type", type); if (status) query.set("status", status); if (search.trim()) query.set("search", search.trim());
    const [listResponse, statsResponse, recentResponse] = await Promise.all([fetch(`/api/policy-numbers?${query}`), fetch("/api/policy-numbers/stats"), fetch("/api/policy-numbers?status=issued")]);
    if (listResponse.status === 401 || statsResponse.status === 401 || recentResponse.status === 401) { router.replace("/login"); return; }
    const list = await listResponse.json(); const recentList = await recentResponse.json(); setItems(list.items ?? []); setRecent((recentList.items ?? []).slice(0, 5)); setStats(await statsResponse.json()); setLoading(false);
  }, [type, status, search, router]);
  useEffect(() => { const timer = setTimeout(load, 200); return () => clearTimeout(timer); }, [load]);

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }
  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
      <header className="flex items-center justify-between border-b border-black/15 pb-6"><div className="text-xs font-semibold tracking-[0.22em]">OLNOO INSURANCE</div><button onClick={logout} className="text-sm underline underline-offset-4">Выйти</button></header>
      <div className="mt-12 flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
        <div><h1 className="text-4xl font-medium tracking-[-0.04em] sm:text-6xl">Управление полисами</h1><p className="mt-4 text-base text-black/55">Пулы страховых номеров и выпущенные полисы</p></div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">{showTestIssue && <button onClick={() => setTestOpen(true)} className="border border-black px-6 py-3 text-sm font-medium">Тестовый выпуск VK</button>}<button onClick={() => setImportOpen(true)} className="bg-black px-6 py-3 text-sm font-medium text-white">Загрузить номера</button></div>
      </div>
      <section className="mt-12 grid gap-4 md:grid-cols-2">{(["VK", "VI"] as PolicyType[]).map((pool) => <StatCard key={pool} title={pool} counts={stats[pool] ?? empty} />)}</section>
      <section className="mt-16">
        <div className="flex flex-col gap-4 border-b border-black pb-5 lg:flex-row lg:items-end lg:justify-between"><h2 className="text-2xl font-medium">Номера полисов</h2><div className="grid gap-3 sm:grid-cols-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск" aria-label="Поиск" className="border border-black/20 px-3 py-2 text-sm outline-none focus:border-black" />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Тип" className="border border-black/20 bg-white px-3 py-2 text-sm"><option value="">Все типы</option><option>VK</option><option>VI</option></select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Статус" className="border border-black/20 bg-white px-3 py-2 text-sm"><option value="">Все статусы</option><option value="available">Свободен</option><option value="reserved">Зарезервирован</option><option value="issued">Выпущен</option></select>
        </div></div>
        <PolicyTable items={items} loading={loading} />
      </section>
      <RecentPolicies items={recent} />
      {importOpen && <ImportModal close={() => setImportOpen(false)} imported={load} />}
      {testOpen && <TestVkIssue close={() => setTestOpen(false)} issued={load} />}
    </main>
  );
}

function StatCard({ title, counts }: { title: string; counts: Counts }) { return <article className="border border-black/15 p-6 sm:p-8"><h2 className="text-3xl font-semibold">{title}</h2><dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4">{[["Всего", counts.total], ["Свободно", counts.available], ["Зарезервировано", counts.reserved], ["Выпущено", counts.issued]].map(([label, value]) => <div key={label}><dt className="text-xs text-black/50">{label}</dt><dd className="mt-2 text-3xl tabular-nums">{value}</dd></div>)}</dl></article>; }

function PolicyTable({ items, loading }: { items: PolicyNumber[]; loading: boolean }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[1050px] border-collapse text-left text-sm"><thead><tr className="border-b border-black/15 text-xs text-black/50">{["Номер", "Тип", "Статус", "Турнир", "Участник", "Application ID", "Дата выпуска", "PDF"].map((h) => <th key={h} className="px-3 py-4 font-medium first:pl-0">{h}</th>)}</tr></thead><tbody>
    {items.map((item) => <tr key={item.id} className="border-b border-black/10"><td className="py-4 pr-3 font-medium">{item.policy_number}</td><td className="px-3 py-4">{item.policy_type}</td><td className="px-3 py-4">{labels[item.status]}</td><td className="px-3 py-4">{item.tournament_slug ?? "—"}</td><td className="px-3 py-4">{item.participant_name ?? "—"}</td><td className="px-3 py-4">{item.application_id ?? "—"}</td><td className="px-3 py-4">{item.issued_at ? new Date(item.issued_at).toLocaleDateString("ru-RU") : "—"}</td><td className="px-3 py-4">{item.status === "issued" && item.pdf_path ? <a href={`/api/policies/${encodeURIComponent(item.policy_number)}/pdf`} className="underline underline-offset-4">Скачать PDF</a> : "—"}</td></tr>)}
    {!loading && items.length === 0 && <tr><td colSpan={8} className="py-16 text-center text-black/45">Номера не найдены</td></tr>}{loading && <tr><td colSpan={8} className="py-16 text-center text-black/45">Загрузка…</td></tr>}
  </tbody></table></div>;
}

function RecentPolicies({ items }: { items: PolicyNumber[] }) {
  return <section className="mt-16 pb-12"><h2 className="border-b border-black pb-5 text-2xl font-medium">Последние выпущенные полисы</h2><div>{items.map((item) => <div key={item.id} className="grid gap-2 border-b border-black/10 py-4 text-sm sm:grid-cols-[1.2fr_2fr_1.5fr_1fr_auto] sm:items-center"><strong>{item.policy_number}</strong><span>{item.participant_name ?? "—"}</span><span>{item.tournament_slug ?? "—"}</span><span>{item.issued_at ? new Date(item.issued_at).toLocaleDateString("ru-RU") : "—"}</span><span>{item.pdf_path ? <a href={`/api/policies/${encodeURIComponent(item.policy_number)}/pdf`} className="underline underline-offset-4">Скачать PDF</a> : "—"}</span></div>)}{items.length === 0 && <p className="py-10 text-sm text-black/45">Выпущенных полисов пока нет</p>}</div></section>;
}

function ImportModal({ close, imported }: { close: () => void; imported: () => Promise<void> }) {
  const [pool, setPool] = useState<"VK" | "VI">("VK"); const [numbers, setNumbers] = useState(""); const [result, setResult] = useState<{ added: number; duplicates: number; rejected: number } | null>(null); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setPending(true); setError(""); const response = await fetch("/api/policy-numbers/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ policyType: pool, numbers }) }); const body = await response.json(); if (response.ok) { setResult(body); await imported(); } else setError(body.error ?? "Ошибка импорта"); setPending(false); }
  return <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true"><div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto bg-white p-6 sm:p-9"><div className="flex items-start justify-between"><div><h2 className="text-3xl font-medium">Загрузить номера</h2><p className="mt-2 text-sm text-black/50">Один страховой номер в строке</p></div><button onClick={close} className="p-1 text-2xl" aria-label="Закрыть">×</button></div>
    <form onSubmit={submit} className="mt-8"><label className="text-sm font-medium">Пул</label><div className="mt-2 flex gap-2">{(["VK", "VI"] as const).map((value) => <button key={value} type="button" onClick={() => { setPool(value); setResult(null); }} className={`border border-black px-5 py-2 text-sm ${pool === value ? "bg-black text-white" : "bg-white"}`}>{value}</button>)}</div>
      <label htmlFor="numbers" className="mt-6 block text-sm font-medium">Номера</label><textarea id="numbers" value={numbers} onChange={(e) => { setNumbers(e.target.value); setResult(null); }} required rows={11} placeholder={`${pool}1234567890\n${pool}1234567891`} className="mt-2 w-full resize-y border border-black/20 p-4 font-mono text-sm outline-none focus:border-black" />
      {error && <p className="mt-3 text-sm">{error}</p>}{result && <div className="mt-5 grid grid-cols-3 border border-black/15 p-4 text-sm"><div><span className="block text-black/50">Добавлено</span><strong className="mt-1 block text-2xl">{result.added}</strong></div><div><span className="block text-black/50">Дубликатов</span><strong className="mt-1 block text-2xl">{result.duplicates}</strong></div><div><span className="block text-black/50">Отклонено</span><strong className="mt-1 block text-2xl">{result.rejected}</strong></div></div>}
      <button disabled={pending} className="mt-6 w-full bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "Импорт…" : "Импортировать"}</button>
    </form></div></div>;
}
