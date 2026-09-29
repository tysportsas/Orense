import { createClient } from '@/lib/supabase/server';
import { listAllReports } from '@/lib/reports';
import Header from '@/components/Header';
import CampogramaClient from '@/components/CampogramaClient';
import { normalizeRole } from '@/lib/auth';

export default async function CampogramaPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const role = normalizeRole(user?.app_metadata?.role);
  const reports = await listAllReports(supabase);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      <Header email={user?.email ?? ''} role={role} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="font-display font-bold text-3xl text-gray-900 mb-1">
            Campograma Táctico de Jugadores
          </h2>
          <p className="text-gray-500 text-sm">
            Mapa táctico de posiciones y filtrado por valoraciones deportivas de la Secretaría Técnica.
          </p>
        </div>
        <CampogramaClient initialReports={reports} />
      </main>
    </div>
  );
}
