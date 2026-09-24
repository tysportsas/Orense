'use client';

function wrapLabel(t: string, max = 17) {
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

export default function RadarChart({ axes }: { axes: { label: string; value: number; text: string }[] }) {
  const n = axes.length;
  const W = 480,
    H = 380,
    cx = 240,
    cy = 190,
    R = 118,
    MAX = 5;
  const pt = (i: number, r: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const fmt = (p: number[]) => p.map((v) => v.toFixed(1)).join(',');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Gráfico de araña: ${axes.map((a) => `${a.label} ${a.value}`).join(', ')}`}>
      {Array.from({ length: MAX }, (_, k) => (
        <polygon
          key={k}
          points={axes.map((_, i) => fmt(pt(i, (R * (k + 1)) / MAX))).join(' ')}
          fill="none"
          stroke="#d3dbd0"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#d3dbd0" strokeWidth={1} />;
      })}
      <polygon
        points={axes.map((a, i) => fmt(pt(i, (R * a.value) / MAX))).join(' ')}
        fill="#1f7a45"
        fillOpacity={0.28}
        stroke="#1f7a45"
        strokeWidth={2.5}
      />
      {axes.map((a, i) => {
        const [x, y] = pt(i, (R * a.value) / MAX);
        return (
          <circle key={i} cx={x} cy={y} r={4.2} fill="#b58a1e" stroke="#fff" strokeWidth={1.5}>
            <title>
              {a.label}: {a.text}
            </title>
          </circle>
        );
      })}
      {axes.map((a, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const c = Math.cos(ang),
          sn = Math.sin(ang);
        const [x, y] = pt(i, R + 14);
        const anchor = c > 0.25 ? 'start' : c < -0.25 ? 'end' : 'middle';
        const lines = wrapLabel(a.label);
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
  );
}
