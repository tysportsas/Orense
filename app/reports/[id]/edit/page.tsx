import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getReport, listAllReports, playerPhotoFrom } from '@/lib/reports';
import Header from '@/components/Header';
import DynamicForm from '@/components/DynamicForm';
import { normalizeRole } from '@/lib/auth';

export default async function EditReportPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const role = normalizeRole(user?.app_metadata?.role);
  const report = await getReport(supabase, params.id);
  if (!report) notFound();

  let initial = report.data;
  if (!initial.foto && !initial.foto_url) {
    const photo = playerPhotoFrom(await listAllReports(supabase), initial);
    initial = { ...initial, ...photo };
  }

  return (
    <div>
      <Header email={user?.email ?? ''} role={role} />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h2 className="font-display font-bold text-3xl mb-6">Editar informe</h2>
        <DynamicForm initial={initial} reportId={report.id} />
      </main>
    </div>
  );
}
