'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { signedPhotoUrl, type PlayerRow } from '@/lib/reports';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Avatar({ nombre, foto }: { nombre: string; foto: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (foto) {
      const supabase = createClient();
      signedPhotoUrl(supabase, foto).then((u) => alive && setUrl(u));
    }
    return () => {
      alive = false;
    };
  }, [foto]);
  const initials = nombre
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join('');
  if (url) return <img src={url} alt="" className="w-11 h-14 object-cover rounded-lg flex-none" />;
  return (
    <span className="w-11 h-14 rounded-lg bg-surface2 border border-line grid place-items-center font-display font-bold text-muted flex-none">
      {initials}
    </span>
  );
}

export default function PlayersList({ initialPlayers }: { initialPlayers: PlayerRow[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return initialPlayers;
    return initialPlayers.filter((p) => p.nombre?.toLowerCase().includes(n) || p.club?.toLowerCase().includes(n));
  }, [q, initialPlayers]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por jugador o club"
        className="w-full max-w-sm mb-4 rounded-lg border border-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-turf"
      />

      {filtered.length === 0 && (
        <div className="border border-dashed border-line rounded-2xl p-10 text-center text-muted">
          {initialPlayers.length === 0 ? (
            <>
              <h3 className="font-display font-bold text-2xl text-ink mb-1">Todavía no hay informes</h3>
              <p className="mb-4">Cuando registres el primero, aparecerá aquí para todo el equipo.</p>
              <Link href="/reports/new" className="inline-block rounded-full bg-green text-white px-5 py-2 font-semibold">
                Crear el primer informe
              </Link>
            </>
          ) : (
            'Sin resultados para esa búsqueda.'
          )}
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((p) => (
          <article
            key={p.player_key}
            className="bg-surface border border-line rounded-xl p-3 flex items-center gap-3 flex-wrap"
          >
            <Avatar nombre={p.nombre} foto={p.foto} />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-xl">{p.nombre}</div>
              <div className="text-sm text-muted">{[p.categoria, p.club].filter(Boolean).join(', ')}</div>
              <div className="text-sm text-muted">
                {p.n_informes} informe{p.n_informes === 1 ? '' : 's'}, último el {fmtDate(p.last_report_at)}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/players/${encodeURIComponent(p.player_key)}`}
                className="rounded-full bg-green text-white px-4 py-2 text-sm font-semibold"
              >
                Tablero
              </Link>
              <Link
                href={`/reports/new?nombre=${encodeURIComponent(p.nombre)}`}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold"
              >
                Nuevo informe
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
