import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listReportsForPlayer } from '@/lib/reports';
import { LEVELS, NACIONALIDADES, nivel, ageOf, fmtDate, fmtTs, shortVal, radarAxes, visibleSections, excelSerialDate } from '@/lib/formModel';
import Header from '@/components/Header';
import PlayerDashboardClient from '@/components/PlayerDashboardClient';
import { normalizeRole } from '@/lib/auth';

const RADAR_GROUPS = [
  { id: 'tec', title: 'Atributos técnicos', secs: ['p_dep_tec', 'f_tec'] },
  { id: 'tac', title: 'Atributos tácticos', secs: ['p_dep_tac', 'f_tac'] },
  { id: 'pos', title: 'Atributos del puesto específico', secs: ['p_dep_pos'] },
  { id: 'fis', title: 'Atributos físicos y condicionales', secs: ['p_esp_fis', 'f_fis'] },
  { id: 'rend', title: 'Atributos de rendimiento', secs: ['p_esp_rend'] },
  { id: 'mental', title: 'Atributos psicológicos y mentales', secs: ['p_esp_psi', 'f_men'] }
];

export default async function PlayerDashboardPage({ params }: { params: { key: string } }) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const role = normalizeRole(user?.app_metadata?.role);
  const playerKey = decodeURIComponent(params.key);
  const reports = await listReportsForPlayer(supabase, playerKey);
  if (!reports.length) notFound();

  const byTime = [...reports].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  const ordered = [...reports].sort((a, b) => nivel(a.data) - nivel(b.data) || +new Date(a.created_at) - +new Date(b.created_at));
  const prof = byTime.reduce<Record<string, any>>((acc, r) => {
    for (const k of ['nombre', 'foto', 'foto_url', 'fnac', 'nacionalidad', 'altura', 'lateralidad', 'lugar_nac']) {
      if (acc[k] == null && r.data[k] != null) acc[k] = r.data[k];
    }
    if (acc.puesto == null && r.data.puesto != null) {
      acc.puesto = r.data.puesto;
      acc.puestoReportId = r.id;
      if (typeof r.data.pos_x === 'number') acc.posX = r.data.pos_x;
      if (typeof r.data.pos_y === 'number') acc.posY = r.data.pos_y;
    }
    return acc;
  }, {});
  const natl = NACIONALIDADES.find((n) => n.v === prof.nacionalidad);
  const levels = [...new Set(ordered.map((r) => nivel(r.data)).filter(Boolean))].sort();
  const cur = byTime.find((r) => r.data.valoracion);
  const matches = new Set(reports.map((r) => (r.data.partido || '') + '|' + (r.data.fpartido || ''))).size;

  const groups = RADAR_GROUPS.map((g) => {
    const series = [...reports]
      .sort((a, b) => (b.data.fpartido || '').localeCompare(a.data.fpartido || ''))
      .map((r) => {
        const sec = visibleSections(r.data).find((x) => g.secs.includes(x.id));
        const axes = sec ? radarAxes(sec, r.data) : null;
        return axes ? { report: r, axes } : null;
      })
      .filter(Boolean) as { report: (typeof reports)[number]; axes: { label: string; value: number; text: string }[] }[];
    return { ...g, series };
  });

  const matchCards = ordered
    .slice()
    .reverse()
    .map((r) => {
      const d = r.data;
      const lv = LEVELS[nivel(d) - 1];
      let sum = 0,
        n = 0;
      for (const sec of visibleSections(d)) for (const f of sec.fields(d)) if (f.type === 'rate' && !f.values && typeof d[f.id!] === 'number') { sum += d[f.id!]; n++; }
      const serialDate = excelSerialDate(d.partido);
      return { id: r.id, lv: lv?.short, partido: serialDate ? 'Partido registrado' : d.partido, fpartido: d.fpartido || serialDate, categoria: d.categoria, club: d.club, observador: d.observador, link1: d.link1, link2: d.link2, val_partido: d.val_partido, val_proy: d.val_proy, valoracion: d.valoracion, avg: n ? sum / n : null };
    });

  return (
    <div>
      <Header email={user?.email ?? ''} role={role} />
      <PlayerDashboardClient
        nombre={prof.nombre || 'Jugador'}
        foto={prof.foto}
        fotoUrl={prof.foto_url}
        puesto={prof.puesto}
        lateralidad={prof.lateralidad}
        puestoReportId={prof.puestoReportId}
        posX={prof.posX}
        posY={prof.posY}
        base={(
          [
            ['Fecha de nacimiento', prof.fnac ? `${fmtDate(prof.fnac)} (${ageOf(prof.fnac)} años)` : ''],
            ['Nacionalidad', natl ? natl.l : prof.nacionalidad],
            ['Lugar de nacimiento', prof.lugar_nac],
            ['Altura', prof.altura],
            ['Lateralidad', prof.lateralidad]
          ] as [string, string][]
        ).filter(([, v]) => v)}
        kpis={[
          [String(reports.length), reports.length === 1 ? 'Informe' : 'Informes'],
          [String(matches), matches === 1 ? 'Partido observado' : 'Partidos observados'],
          [levels.length ? 'N' + Math.max(...levels) : '', 'Nivel más alto'],
          [cur?.data.valoracion ?? '', 'Valoración actual']
        ]}
        matchCards={matchCards.map((c) => ({
          ...c,
          fpartidoLabel: c.fpartido ? fmtDate(c.fpartido) : 'Sin fecha',
          val_partido: c.val_partido ? shortVal(c.val_partido) : '',
          val_proy: c.val_proy ? shortVal(c.val_proy) : ''
        }))}
        groups={groups.map((g) => ({ id: g.id, title: g.title, series: g.series.map((s) => {
          const serialDate = excelSerialDate(s.report.data.partido);
          const date = s.report.data.fpartido || serialDate;
          const match = serialDate ? 'Partido registrado' : s.report.data.partido || '';
          return { id: s.report.id, label: `${date ? fmtDate(date) : 'Sin fecha'}, ${match}`, axes: s.axes, nivel: LEVELS[nivel(s.report.data) - 1]?.short };
        }) }))}
      />
    </div>
  );
}
