import { isAuthConfigured } from "@/lib/auth";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <section className="w-full max-w-md border border-black/15 p-7 sm:p-10">
        <div className="mb-10 text-xs font-semibold tracking-[0.22em]">OLNOO INSURANCE</div>
        <h1 className="text-4xl font-medium tracking-tight">Вход</h1>
        <p className="mt-3 text-sm text-black/55">Административная панель управления полисами</p>
        {!isAuthConfigured() ? <p className="mt-8 border border-black p-4 text-sm">Задайте SPORTPOLIS_ADMIN_PASSWORD в окружении и перезапустите сервер.</p> : <LoginForm />}
      </section>
    </main>
  );
}
