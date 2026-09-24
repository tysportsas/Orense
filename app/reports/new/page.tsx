import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getObservedPlayersOptions } from '@/lib/reports';
import Header from '@/components/Header';
import DynamicForm from '@/components/DynamicForm';

export default async function NewReportPage({
  searchParams
}: {
  searchParams: { nombre?: string };
}) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const observedPlayers = await getObservedPlayersOptions(supabase);

  // Si viene con parametro nombre, intentar buscar la data previa de ese jugador
  let initial = searchParams.nombre ? { nombre: searchParams.nombre } : {};
  if (searchParams.nombre && observedPlayers.length > 0) {
    const found = observedPlayers.find(
      (p) => p.nombre.toLowerCase().trim() === searchParams.nombre?.toLowerCase().trim()
    );
    if (found) {
      initial = { ...found.latestData };
    }
  }

  return (
    <div>
      <Header email={user.email ?? ''} />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h2 className="font-display font-bold text-3xl mb-6">Nuevo informe</h2>
        <DynamicForm initial={initial} observedPlayers={observedPlayers} />
      </main>
    </div>
  );
}
