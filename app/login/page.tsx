// app/login/page.tsx
//
// Única puerta de entrada a la aplicación. No hay pantalla de "crear
// cuenta": las cuentas de cada observador las crea un administrador
// desde el panel de Supabase (ver supabase/schema.sql, punto 5).

'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : error.message === 'Email not confirmed'
          ? 'El correo aún no está confirmado. Pide al administrador que lo confirme en el panel de Supabase.'
          : `Error: ${error.message}`
      );
      return;
    }
    router.replace(params.get('next') || '/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-surface border border-line rounded-2xl shadow-sm p-8"
      >
        <div className="flex items-center gap-3 mb-1">
          <img src="/orense-crest.png" alt="Escudo de Orense S.C." className="h-10 w-auto" />
          <div>
            <h1 className="font-display font-bold text-2xl leading-none text-green">SECRETARÍA TÉCNICA</h1>
            <p className="text-sm text-muted">Orense SC, Scouting</p>
          </div>
        </div>
        <p className="text-sm text-muted mt-4 mb-6">
          Ingresa con las credenciales que te dio la Secretaría Técnica.
        </p>

        <label className="block text-sm font-medium mb-1" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 rounded-lg border border-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-turf"
          placeholder="observador@orense.ec"
        />

        <label className="block text-sm font-medium mb-1" htmlFor="password">
          Contraseña
        </label>
        <div className="relative mb-5">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-turf"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? (
              /* Ojo abierto (visible) */
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              /* Ojo tachado (oculto) */
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.05-3.41M6.53 6.53A9.97 9.97 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.423 5.357M3 3l18 18" />
              </svg>
            )}
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-green text-white font-semibold py-2.5 hover:brightness-110 disabled:opacity-60"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="text-xs text-muted mt-5">
          ¿No tienes cuenta o olvidaste tu contraseña? Pídele a la Secretaría Técnica que te cree un
          acceso o te restablezca la contraseña desde el panel de Supabase.
        </p>
      </form>
    </div>
  );
}
