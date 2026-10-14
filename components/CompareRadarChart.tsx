'use client';

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

/** Radar con varias series superpuestas (escala 1 a 5) para comparar tipos de informe o informes. */
export default function CompareRadarChart({ axes, series }: { axes: string[]; series: CompareSeries[] }) {
  const n = axes.length;
  const W = 520,
    H = 400,
    cx = 260,
    cy = 200,
    R = 125,
    MAX = 5;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const fmt = (p: number[]) => p.map((v) => v.toFixed(1)).join(',');

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Comparativo de valoraciones">
        {Array.from({ length: MAX }, (_, k) => (
          <polygon key={k} points={axes.map((_, i) => fmt(pt(i, (R * (k + 1)) / MAX))).join(' ')} fill="none" stroke="#d3dbd0" strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#d3dbd0" strokeWidth={1} />;
        })}
        {series.map((s) => (
          <g key={s.id}>
            <polygon
              points={s.values.map((v, i) => fmt(pt(i, (R * (v ?? 0)) / MAX))).join(' ')}
              fill={s.color}
              fillOpacity={0.14}
              stroke={s.color}
              strokeWidth={2.2}
            />
            {s.values.map((v, i) => {
              if (v == null) return null;
              const [x, y] = pt(i, (R * v) / MAX);
              return (
                <circle key={i} cx={x} cy={y} r={3.6} fill={s.color} stroke="#fff" strokeWidth={1.2}>
                  <title>
                    {s.label} · {axes[i]}: {v.toFixed(1)}
                  </title>
                </circle>
              );
            })}
          </g>
        ))}
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
      <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs mt-1">
        {series.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <i className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
