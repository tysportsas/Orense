// app/page.tsx
//
// Server Component: para llegar aquí, el middleware ya comprobó que hay
// una sesión válida de Supabase. Si no la hay, nunca se renderiza esto —
// la persona ya fue redirigida a /login antes de que este código corra.

import { createClient } from '@/lib/supabase/server';
import { listPlayers } from '@/lib/reports';
import Header from '@/components/Header';
import PlayersList from '@/components/PlayersList';
import { normalizeRole } from '@/lib/auth';

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const role = normalizeRole(user?.user_metadata?.role);
  const players = await listPlayers(supabase);

  return (
    <div>
      <Header email={user?.email ?? ''} role={role} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <h2 className="font-display font-bold text-3xl mb-1">Jugadores observados</h2>
        <p className="text-muted mb-6">
          {players.length} jugador{players.length === 1 ? '' : 'es'} en la base compartida del equipo.
        </p>
        <PlayersList initialPlayers={players} />
      </main>
    </div>
  );
}
