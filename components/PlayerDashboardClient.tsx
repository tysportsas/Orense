'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { signedPhotoUrl, getReport, updateReport } from '@/lib/reports';
import RadarChart from './RadarChart';
import PositionPitch from './PositionPitch';

interface MatchCard {
  id: string;
  lv?: string;
  partido?: string;
  fpartidoLabel: string;
  categoria?: string;
  club?: string;
  observador?: string;
  link1?: string;
  link2?: string;
  val_partido: string;
  val_proy: string;
  valoracion?: string;
  avg: number | null;
}

interface Group {
  id: string;
  title: string;
  series: { id: string; label: string; axes: { label: string; value: number; text: string }[]; nivel?: string }[];
}

function Badge({ v }: { v?: string }) {
  if (!v) return null;
  const n = v.charAt(0);
  const label = v.replace(/^\d\./, '');
  return <span className={`badge v${n}`}>{label.charAt(0) + label.slice(1).toLowerCase()}</span>;
}

function matchTitle(value?: string) {
  const title = String(value ?? '').trim();
  return !title || /^\d+(?:[.,]\d+)?$/.test(title) ? 'Sin partido' : title;
}

function validExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function externalLinkLabel(value: string, fallback: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('transfermarkt')) return 'Transfermarkt';
    if (host.includes('besoccer')) return 'BeSoccer';
    return host || fallback;
  } catch {
    return fallback;
  }
}

export default function PlayerDashboardClient({
  nombre,
  foto,
  fotoUrl,
  puesto,
  lateralidad,
  puestoReportId,
  posX,
  posY,
  base,
  kpis,
  matchCards,
  groups
}: {
  nombre: string;
  foto?: string;
  fotoUrl?: string;
  puesto?: string;
  lateralidad?: string;
  puestoReportId?: string;
  posX?: number;
  posY?: number;
  base: [string, string][];
  kpis: [string, string][];
  matchCards: MatchCard[];
  groups: Group[];
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [posStatus, setPosStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handlePositionChange(x: number, y: number) {
    if (!puestoReportId) return;
    setPosStatus('saving');
    try {
      const supabase = createClient();
      const report = await getReport(supabase, puestoReportId);
      if (!report) throw new Error('Informe no encontrado');
      await updateReport(supabase, puestoReportId, { ...report.data, pos_x: x, pos_y: y });
      setPosStatus('saved');
    } catch (err) {
      console.error('Error al guardar la posición:', err);
      setPosStatus('error');
    }
  }

  useEffect(() => {
    let alive = true;
    if (foto) {
      const supabase = createClient();
      signedPhotoUrl(supabase, foto).then((u) => alive && setPhoto(u));
    } else if (fotoUrl) {
      setPhoto(fotoUrl);
    }
    return () => {
      alive = false;
    };
  }, [foto, fotoUrl]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 grid gap-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/" className="text-sm font-semibold text-turf">
          ← Jugadores
        </Link>
      </div>

      <section>
        <h2 className="font-display font-bold text-2xl border-b-2 border-gold pb-1 mb-4">Resumen biográfico</h2>
        <div className="bg-surface border border-line rounded-2xl p-5 flex gap-5 flex-wrap items-start">
          {photo ? (
            <img src={photo} alt={`Foto de ${nombre}`} className="w-28 h-36 object-cover rounded-lg flex-none" />
          ) : (
            <span className="w-28 h-36 rounded-lg bg-surface2 border border-line grid place-items-center font-display font-bold text-3xl text-muted flex-none">
              {nombre.split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}
            </span>
          )}
          <div className="flex-1 min-w-[220px]">
            <h3 className="font-display font-bold text-3xl">{nombre}</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              {base.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {kpis.map(([v, l]) => (
                <div key={l} className="bg-surface2 border border-line rounded-lg px-3 py-2">
                  {l === 'Valoración actual' ? <Badge v={v} /> : <b className="font-display text-2xl block">{v}</b>}
                  <span className="text-xs text-muted">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <PositionPitch
              puesto={puesto}
              lateralidad={lateralidad}
              posX={posX}
              posY={posY}
              editable={Boolean(puestoReportId)}
              onPositionChange={handlePositionChange}
            />
            {posStatus === 'saving' && <span className="text-xs text-muted">Guardando…</span>}
            {posStatus === 'saved' && <span className="text-xs text-turf">Posición guardada ✓</span>}
            {posStatus === 'error' && <span className="text-xs text-red-600">Error al guardar</span>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display font-bold text-2xl border-b-2 border-gold pb-1 mb-4">
          Informe deportivo de cada partido observado
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {matchCards.map((c) => (
            <article key={c.id} className="bg-surface border border-line rounded-xl p-4 grid gap-2 content-start">
              <div className="flex justify-between gap-2 items-start">
                <div>
                  <div className="text-xs text-muted">
                    {c.fpartidoLabel}, {c.lv || 'Sin nivel'}
                  </div>
                  <h3 className="font-display font-bold text-xl">{matchTitle(c.partido)}</h3>
                </div>
                <Badge v={c.valoracion} />
              </div>
              <div className="text-sm text-muted">{[c.categoria, c.club, c.observador && 'Observador ' + c.observador].filter(Boolean).join(', ')}</div>
              {c.lv !== 'N5 Institucional' && (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="bg-surface2 rounded-lg px-2 py-1">
                    <small className="block text-muted text-xs">Partido</small>
                    <b>{c.val_partido || 'Sin dato'}</b>
                  </div>
                  <div className="bg-surface2 rounded-lg px-2 py-1">
                    <small className="block text-muted text-xs">Proyección</small>
                    <b>{c.val_proy || 'Sin dato'}</b>
                  </div>
                  <div className="bg-surface2 rounded-lg px-2 py-1">
                    <small className="block text-muted text-xs">Atributos</small>
                    <b>{c.avg != null ? `${c.avg.toFixed(1)} de 5` : 'Sin dato'}</b>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-xs text-muted">Enlaces</span>
                {validExternalUrl(c.link1) && (
                  <a href={validExternalUrl(c.link1)!} target="_blank" rel="noopener noreferrer" className="font-semibold text-turf underline">
                    {externalLinkLabel(c.link1!, 'Enlace 1')}
                  </a>
                )}
                {validExternalUrl(c.link2) && (
                  <a href={validExternalUrl(c.link2)!} target="_blank" rel="noopener noreferrer" className="font-semibold text-turf underline">
                    {externalLinkLabel(c.link2!, 'Enlace 2')}
                  </a>
                )}
                {!validExternalUrl(c.link1) && !validExternalUrl(c.link2) && (
                  <span className="text-xs text-muted">Sin enlaces registrados</span>
                )}
              </div>
              <Link href={`/reports/${c.id}/edit`} className="text-sm font-semibold text-turf mt-1">
                Ver informe
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display font-bold text-2xl border-b-2 border-gold pb-1 mb-4">
          Informe deportivo: gráficos de araña
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => {
            const cur = g.series.find((s) => s.id === pick[g.id]) || g.series[0];
            return (
              <div key={g.id} className="bg-surface border border-line rounded-2xl p-4">
                <h3 className="font-display font-bold text-xl">{g.title}</h3>
                {!cur ? (
                  <p className="text-sm text-muted mt-2">
                    Ningún informe tiene respuestas suficientes de este grupo (mínimo 3 atributos).
                  </p>
                ) : (
                  <>
                    {g.series.length > 1 && (
                      <div className="flex flex-wrap gap-1.5 my-2">
                        {g.series.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => setPick((p) => ({ ...p, [g.id]: s.id }))}
                            className={`text-xs rounded-full px-3 py-1 border ${
                              s.id === cur.id ? 'bg-green text-white border-green' : 'border-line'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-muted mb-2">
                      {cur.nivel}, {cur.label}. Promedio{' '}
                      {(cur.axes.reduce((a, x) => a + x.value, 0) / cur.axes.length).toFixed(1)} de 5 en {cur.axes.length}{' '}
                      atributos.
                    </p>
                    <RadarChart axes={cur.axes} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
