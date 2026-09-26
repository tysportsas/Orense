import { createClient } from '@/lib/supabase/server';
import { listAllReports } from '@/lib/reports';
import Header from '@/components/Header';
import ReportsDashboardClient from '@/components/ReportsDashboardClient';
import { normalizeRole } from '@/lib/auth';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const role = normalizeRole(user?.user_metadata?.role);
  const reports = await listAllReports(supabase);

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      <Header email={user?.email ?? ''} role={role} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="font-display font-bold text-3xl text-gray-900 mb-1">
            Dashboard Principal-Secretaría Técnica
          </h2>
          <p className="text-gray-500 text-sm">
            Consolidado general de informes de scouting, métricas y filtrado rápido del equipo.
          </p>
        </div>
        <ReportsDashboardClient initialReports={reports} />
      </main>
    </div>
  );
}
