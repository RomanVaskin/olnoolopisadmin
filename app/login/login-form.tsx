"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: data.get("password") }) });
    if (response.ok) router.replace("/");
    else { const body = await response.json(); setError(body.error ?? "Не удалось войти"); setPending(false); }
  }
  return (
    <form onSubmit={submit} className="mt-8">
      <label htmlFor="password" className="text-sm font-medium">Пароль</label>
      <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required className="mt-2 w-full border border-black/25 px-4 py-3 outline-none focus:border-black" />
      {error && <p className="mt-3 text-sm" role="alert">{error}</p>}
      <button disabled={pending} className="mt-5 w-full bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50">{pending ? "Вход…" : "Войти"}</button>
    </form>
  );
}
