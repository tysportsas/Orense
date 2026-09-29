import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getReport } from '@/lib/reports';
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

  return (
    <div>
      <Header email={user?.email ?? ''} role={role} />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h2 className="font-display font-bold text-3xl mb-6">Editar informe</h2>
        <DynamicForm initial={report.data} reportId={report.id} />
      </main>
    </div>
  );
}
