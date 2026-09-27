'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  clearAccessSession,
  DEFAULT_ACCESS_PERMISSIONS,
  getCurrentAccessSession,
  isAdminUnlocked,
  type AccessPermissions
} from '@/lib/access';
import { createClient } from '@/lib/supabase/client';

export default function Header({ email, role = 'viewer' }: { email: string; role?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [permissions, setPermissions] = useState<AccessPermissions>(DEFAULT_ACCESS_PERMISSIONS);

  useEffect(() => {
    const access = getCurrentAccessSession();
    setPermissions(access?.permissions ?? DEFAULT_ACCESS_PERMISSIONS);
  }, [pathname]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut().catch(() => undefined);
    clearAccessSession();
    router.replace('/login');
    router.refresh();
  }

  const tab = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm font-semibold ${
        pathname === href ? 'bg-white/15 text-white' : 'text-white/80 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );

  const canViewPlayers = permissions.players;
  const canViewDashboard = permissions.dashboard;
  const canViewCampograma = permissions.campograma;
  const canCreateReports = permissions.reports;
  const canImportReports = permissions.import;
  const canSeeAdmin = role === 'admin' || isAdminUnlocked();

  return (
    <header className="bg-[#0f3a22] text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <img src="/orense-crest.png" alt="Escudo de Orense S.C." className="h-10 w-auto" />
          <div>
            <h1 className="font-display font-bold text-xl leading-none">Secretaría Técnica</h1>
            <p className="text-xs text-white/70">Orense SC</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          {canViewPlayers && tab('/', 'Jugadores')}
          {canViewDashboard && tab('/dashboard', 'Dashboard')}
          {canViewCampograma && tab('/campograma', 'Campograma')}
          {canCreateReports && tab('/reports/new', 'Nuevo informe')}
          {canImportReports && tab('/reports/import', 'Importar')}
          {canSeeAdmin && tab('/admin', 'Admin')}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/70 hidden sm:inline">{email || 'Acceso autorizado'}</span>
          <button
            onClick={signOut}
            className="px-3 py-1.5 rounded-full border border-white/30 hover:bg-white/10"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
