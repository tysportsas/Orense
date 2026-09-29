import Link from 'next/link';
import Header from '@/components/Header';
import { normalizeRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = normalizeRole(user?.app_metadata?.role);

  return (
    <div>
      <Header email={user?.email ?? ''} role={role} />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#0f3a22]">Administración</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-[#0f3a22]">Usuarios y roles</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Las cuentas y sus roles se administran en Supabase. El rol se guarda en App Metadata y no se puede cambiar desde el perfil del usuario.
        </p>

        <section className="mt-8 rounded-xl border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-bold text-[#0f3a22]">Asignar un rol</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>En Supabase, abre Authentication y selecciona el usuario.</li>
            <li>En App Metadata, asigna `role` con uno de los valores de abajo.</li>
            <li>Guarda y pide al usuario que vuelva a iniciar sesión para renovar sus permisos.</li>
          </ol>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-sm text-gray-100">{`{"role":"admin"}`}</pre>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ['admin', 'Acceso completo, importación y borrado.'],
            ['scout', 'Consulta, creación y edición de informes.'],
            ['viewer', 'Solo consulta de jugadores, dashboard y campograma.']
          ].map(([name, description]) => (
            <article key={name} className="rounded-xl border border-line bg-surface p-4">
              <h2 className="font-semibold text-[#0f3a22]">{name}</h2>
              <p className="mt-2 text-sm text-muted">{description}</p>
            </article>
          ))}
        </section>

        <Link href="/" className="mt-8 inline-block text-sm font-semibold text-[#0f3a22] underline">
          Volver a jugadores
        </Link>
      </main>
    </div>
  );
}
