'use client';

import { useState } from 'react';

export interface CompareSeries {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
}

function wrapLabel(t: string, max = 14) {
  const lines: string[] = [];
  let cur = '';
  for (const w of t.split(' ')) {
    if (cur && (cur + ' ' + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function hasCompleteValues(values: (number | null)[], length: number): values is number[] {
  return values.length === length && values.every((value) => value != null);
}

/** Radar con varias series superpuestas (escala 1 a 5) para comparar tipos de informe o informes. */
export default function CompareRadarChart({
  axes,
  series,
  filterBySeries = false
}: {
  axes: string[];
  series: CompareSeries[];
  filterBySeries?: boolean;
}) {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const selectedSeries = series.find((item) => item.id === selectedSeriesId);
  const visibleSeries = selectedSeries ? [selectedSeries] : series;
  const n = axes.length;
  const W = 600,
    H = 440,
    cx = 300,
    cy = 220,
    R = 125,
    MAX = 5;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const fmt = (p: number[]) => p.map((v) => v.toFixed(1)).join(',');

  return (
    <div className="cmp-radar pdf-avoid">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Comparativo de valoraciones">
        {Array.from({ length: MAX }, (_, k) => (
          <polygon key={k} points={axes.map((_, i) => fmt(pt(i, (R * (k + 1)) / MAX))).join(' ')} fill="none" stroke="#d3dbd0" strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#d3dbd0" strokeWidth={1} />;
        })}
        {visibleSeries.map((s) => {
          const values = s.values;
          const complete = hasCompleteValues(values, n);
          return (
            <g key={s.id}>
              {complete ? (
                <polygon
                  points={values.map((value, i) => fmt(pt(i, (R * value) / MAX))).join(' ')}
                  fill={s.color}
                  fillOpacity={0.14}
                  stroke={s.color}
                  strokeWidth={2.2}
                />
              ) : (
                values.map((value, i) => {
                  const nextIndex = (i + 1) % n;
                  const nextValue = s.values[nextIndex];
                  if (value == null || nextValue == null || n < 2) return null;
                  const [x1, y1] = pt(i, (R * value) / MAX);
                  const [x2, y2] = pt(nextIndex, (R * nextValue) / MAX);
                  return <line key={`segment-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={s.color} strokeWidth={2.2} />;
                })
              )}
              {s.values.map((value, i) => {
                if (value == null) return null;
                const [x, y] = pt(i, (R * value) / MAX);
                return (
                  <circle key={i} cx={x} cy={y} r={3.6} fill={s.color} stroke="#fff" strokeWidth={1.2}>
                    <title>
                      {s.label} · {axes[i]}: {value.toFixed(1)}
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
        {axes.map((label, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
          const c = Math.cos(ang),
            sn = Math.sin(ang);
          const [x, y] = pt(i, R + 14);
          const anchor = c > 0.25 ? 'start' : c < -0.25 ? 'end' : 'middle';
          const lines = wrapLabel(label);
          const lh = 14;
          const y0 = sn < -0.5 ? y - (lines.length - 1) * lh : sn > 0.5 ? y + 9 : y - ((lines.length - 1) * lh) / 2 + 4;
          return (
            <text key={i} x={x} textAnchor={anchor as any} fontSize={12} fill="#14211a" fontFamily="Barlow, sans-serif">
              {lines.map((l, j) => (
                <tspan key={j} x={x} y={y0 + j * lh}>
                  {l}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>
      {filterBySeries ? (
        <div className="flex flex-wrap gap-2 justify-center text-xs mt-1" role="group" aria-label="Filtrar radar por scout">
          <button
            type="button"
            aria-pressed={!selectedSeries}
            onClick={() => setSelectedSeriesId(null)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 border ${
              !selectedSeries ? 'border-green bg-green/10 text-green' : 'border-line'
            }`}
          >
            Todos los scouts
          </button>
          {series.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={selectedSeries?.id === s.id}
              onClick={() => setSelectedSeriesId((current) => (current === s.id ? null : s.id))}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 border ${
                selectedSeries?.id === s.id ? 'border-green bg-green/10 text-green' : 'border-line'
              }`}
            >
              <i className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs mt-1">
          {series.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <i className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {filterBySeries && selectedSeries && (
        <div className="mt-3" aria-live="polite">
          <p className="text-sm font-semibold mb-2">{selectedSeries.label} · valoración por atributo</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {axes.map((axis, index) => {
              const value = selectedSeries.values[index];
              return (
                <div key={index} className="flex items-center justify-between gap-2 rounded-lg bg-surface2 border border-line px-3 py-2 text-sm">
                  <span>{axis}</span>
                  <b className="shrink-0">{value == null ? 'Sin dato' : `${value.toFixed(1)} / 5`}</b>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
