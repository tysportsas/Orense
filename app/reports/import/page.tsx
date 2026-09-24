import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Header from '@/components/Header';
import ImportReportsClient from '@/components/ImportReportsClient';

export default async function ImportPage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      <Header email={user.email ?? ''} />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="font-display font-bold text-3xl text-gray-900 mb-1">
            Importar Base de Datos de Jugadores
          </h2>
          <p className="text-gray-500 text-sm">
            Carga masivamente informes y jugadores ya valorados desde archivos CSV o JSON.
          </p>
        </div>
        <ImportReportsClient />
      </main>
    </div>
  );
}
