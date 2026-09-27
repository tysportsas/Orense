'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { findAccessCodeByCredentials, setActiveAccessSession } from '@/lib/access';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const access = findAccessCodeByCredentials(username, password);
    if (!access) {
      setError('El usuario o la contraseña no coinciden con una credencial autorizada.');
      return;
    }

    setActiveAccessSession(access);
    router.push('/');
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#eef1eb] px-4 py-10 text-[#0f3a22]">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[28px] border border-[#dfe7df] bg-[#f7f8f5] shadow-[0_18px_50px_rgba(15,58,34,0.08)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden bg-[#0f3a22] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(160,213,183,0.2),_transparent_35%)]" />
          <div className="relative z-10">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm">
                <span className="font-display text-2xl font-black">O</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">Orense SC</p>
                <h2 className="font-display text-2xl font-bold leading-none">Método de Scouting</h2>
              </div>
            </div>

            <div className="max-w-sm space-y-5">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">Acceso autorizado</p>
              <h1 className="font-display text-5xl font-black leading-none">
                Observa.
                <br />
                Analiza.
                <br />
                Decide.
              </h1>
              <p className="text-base text-emerald-50/80">
                Panel seguro para usuarios autorizados del equipo con permisos configurados por administración.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">Acceso</p>
              <p className="mt-1 text-lg font-semibold">Usuarios autorizados</p>
            </div>
            <div className="rounded-full bg-emerald-400/20 px-3 py-1 text-sm font-semibold text-emerald-100">
              Online
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-[#f4f6f2] p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0f3a22]/60">Bienvenido</p>
              <h2 className="mt-2 font-display text-4xl font-black text-[#0f3a22]">Iniciar sesión</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block text-sm font-semibold text-[#0f3a22]">
                Usuario
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#d7e0d7] bg-white px-4 py-3 text-base outline-none transition focus:border-[#0f3a22] focus:ring-2 focus:ring-[#0f3a22]/10"
                  placeholder="Ej.: daniel.arango"
                />
              </label>

              <label className="block text-sm font-semibold text-[#0f3a22]">
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#d7e0d7] bg-white px-4 py-3 text-base outline-none transition focus:border-[#0f3a22] focus:ring-2 focus:ring-[#0f3a22]/10"
                  placeholder="Ingresá tu contraseña"
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#0f3a22] px-4 py-3 text-base font-bold text-white shadow-[0_12px_24px_rgba(15,58,34,0.2)] transition hover:bg-[#123f2b]"
              >
                Entrar a la app
              </button>
            </form>

            {error && (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-[#dfe7df] bg-white/70 px-4 py-3 text-sm text-[#0f3a22]/75">
              <span>¿Necesitás acceso administrativo?</span>
              <Link href="/admin" className="font-bold text-[#0f3a22] underline decoration-2 underline-offset-4">
                Panel admin
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
