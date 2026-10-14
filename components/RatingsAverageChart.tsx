'use client';

import { useState } from 'react';
import CompareRadarChart, { type CompareSeries } from './CompareRadarChart';

interface MatchCard {
  id: string;
  lv?: string;
  fpartido?: string;
  fpartidoLabel: string;
  val_partido: string;
  val_proy: string;
  valoracion?: string;
  avg: number | null;
}

interface Group {
  id: string;
  title: string;
  series: { id: string; axes: { label: string; value: number }[] }[];
}

const scoreOf = (v?: string) => {
  const n = parseInt(String(v ?? '').charAt(0), 10);
  return n >= 1 && n <= 5 ? n : null;
};

function average(values: (number | null)[]) {
  const nums = values.filter((n): n is number => n != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function metricsOf(cards: MatchCard[]) {
  return [
    { label: 'Valoración final', values: cards.map((c) => scoreOf(c.valoracion)) },
    { label: 'Valoración del partido', values: cards.map((c) => scoreOf(c.val_partido)) },
    { label: 'Proyección', values: cards.map((c) => scoreOf(c.val_proy)) },
    { label: 'Atributos', values: cards.map((c) => c.avg) }
  ].map((m) => ({ ...m, avg: average(m.values), count: m.values.filter((n) => n != null).length }));
}

function AverageBars({ cards }: { cards: MatchCard[] }) {
  return (
    <div className="grid gap-2">
      {metricsOf(cards).map((m) => (
        <div key={m.label} className="grid grid-cols-[150px_1fr_44px] items-center gap-2 text-sm">
          <span>{m.label}</span>
          <div className="h-3 rounded-full bg-white border border-line overflow-hidden" title={`${m.count} dato(s)`}>
            <div className="h-full bg-green" style={{ width: `${((m.avg ?? 0) / 5) * 100}%` }} />
          </div>
          <b className="font-display text-right">{m.avg == null ? '—' : m.avg.toFixed(1)}</b>
        </div>
      ))}
    </div>
  );
}

const COLORS = ['#1f7a45', '#b58a1e', '#2563eb', '#b3261e', '#7c3aed', '#0f766e', '#c2410c', '#475569'];

const CATEGORIES: [string, RegExp][] = [
  ['Puesto', /puesto/i],
  ['Técnico', /t[ée]cnic/i],
  ['Táctico', /t[áa]ctic/i],
  ['Físico', /f[íi]sic/i],
  ['Mental', /psicol|mental/i]
];

export default function RatingsAverageChart({ cards: allCards, groups }: { cards: MatchCard[]; groups: Group[] }) {
  const [mode, setMode] = useState<'all' | 'type' | 'report'>('all');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const cards = allCards.filter((c) => !excluded.has(c.id));
  const toggle = (id: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  if (metricsOf(allCards).every((m) => m.avg == null)) return null;

  // Promedio de atributos por categoría para cada informe, tomado de los gráficos de araña.
  const catOf = (cardId: string, re: RegExp) => {
    const vals: number[] = [];
    for (const g of groups) {
      if (!re.test(g.title)) continue;
      for (const sr of g.series) if (sr.id === cardId) vals.push(...sr.axes.map((a) => a.value));
    }
    return average(vals);
  };
  const scores = (list: MatchCard[]): (number | null)[] => [
    average(list.map((c) => scoreOf(c.valoracion))),
    average(list.map((c) => scoreOf(c.val_partido))),
    average(list.map((c) => scoreOf(c.val_proy))),
    ...CATEGORIES.map(([, re]) => average(list.map((c) => catOf(c.id, re))))
  ];
  const allAxes = ['Valoración final', 'Valoración del partido', 'Proyección', ...CATEGORIES.map(([l]) => l)];
  const keep = allAxes.map((_, i) => cards.some((c) => scores([c])[i] != null));
  const axes = allAxes.filter((_, i) => keep[i]);
  const pick = (v: (number | null)[]) => v.filter((_, i) => keep[i]);

  const types = [...new Set(cards.map((c) => c.lv || 'Sin tipo'))].sort();
  const compare: CompareSeries[] =
    mode === 'type'
      ? types.map((t, i) => {
          const group = cards.filter((c) => (c.lv || 'Sin tipo') === t);
          return { id: t, label: `${t} (${group.length})`, color: COLORS[i % COLORS.length], values: pick(scores(group)) };
        })
      : cards
          .slice()
          .sort((a, b) => (a.fpartido || '').localeCompare(b.fpartido || ''))
          .map((c, i) => ({
            id: c.id,
            label: `${c.fpartidoLabel} · ${c.lv || 'Sin tipo'}`,
            color: COLORS[i % COLORS.length],
            values: pick(scores([c]))
          }));

  const timeline = cards
    .map((c) => ({ id: c.id, label: c.fpartidoLabel, date: c.fpartido || '', score: scoreOf(c.valoracion) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="mt-4 bg-surface2 border border-line rounded-xl p-4">
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div>
          <h4 className="font-display font-bold text-lg">Promedio de valoraciones</h4>
          <p className="text-xs text-muted mb-3">Escala 1 a 5 · {cards.length} de {allCards.length} informe(s)</p>
        </div>
        <div className="flex gap-1 text-xs flex-wrap">
          {([['all', 'General'], ['type', 'Comparar tipos'], ['report', 'Comparar informes']] as const).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`rounded-full border px-3 py-1 font-semibold ${mode === k ? 'bg-green border-green text-white' : 'border-line bg-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {allCards.length > 1 && (
        <div className="mb-3">
          <p className="text-xs text-muted mb-1">Informes incluidos (toca para quitar o agregar)</p>
          <div className="flex flex-wrap gap-1.5">
            {allCards
              .slice()
              .sort((a, b) => (a.fpartido || '').localeCompare(b.fpartido || ''))
              .map((c) => {
                const on = !excluded.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                    className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'bg-green border-green text-white' : 'border-line bg-white text-muted line-through'}`}
                  >
                    {c.fpartidoLabel} · {c.lv || 'Sin tipo'}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <p className="text-sm text-muted">Selecciona al menos un informe.</p>
      ) : mode === 'all' ? (
        <AverageBars cards={cards} />
      ) : axes.length < 3 ? (
        <p className="text-sm text-muted">No hay suficientes datos para el comparativo (se necesitan al menos 3 criterios).</p>
      ) : (
        <CompareRadarChart axes={axes} series={compare} />
      )}

      {mode === 'all' && timeline.length > 1 && (
        <div className="mt-4">
          <p className="text-xs text-muted mb-1">Valoración final por informe (del más antiguo al más reciente)</p>
          <div className="flex items-end gap-2 h-24">
            {timeline.map((t) => (
              <div key={t.id} className="flex-1 min-w-[28px] max-w-[64px] flex flex-col items-center justify-end h-full" title={`${t.label}: ${t.score ?? 'sin dato'}`}>
                <span className="text-xs font-semibold">{t.score ?? '—'}</span>
                <div className="w-full rounded-t bg-gold" style={{ height: `${((t.score ?? 0) / 5) * 100}%` }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

