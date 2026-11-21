import { norm } from './formModel';

export interface ScoutRadarReport {
  id: string;
  label: string;
  observador?: string;
  axes: { label: string; value: number }[];
}

export interface ScoutRadarGroup {
  series: ScoutRadarReport[];
}

export interface ScoutRadarSeries {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
}

export interface ScoutRadarSummary {
  axes: string[];
  series: ScoutRadarSeries[];
  reportCount: number;
}

const SCOUT_COLORS = ['#1f7a45', '#2563eb', '#b3261e', '#7c3aed', '#0f766e', '#c2410c', '#b58a1e', '#be185d', '#475569', '#0891b2'];

function scoutName(report: ScoutRadarReport) {
  return String(report.observador ?? '').trim() || 'Scout no identificado';
}

export function scoutRadarColors(groups: ScoutRadarGroup[]) {
  const names = new Map<string, string>();
  for (const group of groups) {
    for (const report of group.series) {
      const name = scoutName(report);
      names.set(norm(name), name);
    }
  }

  return new Map(
    [...names.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es'))
      .map(([key], index) => [key, SCOUT_COLORS[index % SCOUT_COLORS.length]])
  );
}

export function summarizeScoutRatings(reports: ScoutRadarReport[], colors: Map<string, string>): ScoutRadarSummary | null {
  if (reports.length < 2) return null;

  const axisLabels = new Map<string, string>();
  const scouts = new Map<string, { name: string; count: number; values: Map<string, number[]> }>();

  for (const report of reports) {
    const name = scoutName(report);
    const key = norm(name);
    const scout = scouts.get(key) ?? { name, count: 0, values: new Map<string, number[]>() };
    scout.count += 1;
    for (const axis of report.axes) {
      const axisKey = norm(axis.label);
      if (!axisLabels.has(axisKey)) axisLabels.set(axisKey, axis.label);
      const values = scout.values.get(axisKey) ?? [];
      values.push(axis.value);
      scout.values.set(axisKey, values);
    }
    scouts.set(key, scout);
  }

  const axes = [...axisLabels.entries()];
  if (axes.length < 3) return null;

  const series = [...scouts.entries()].map(([key, scout]) => ({
    id: key,
    label: `${scout.name} · ${scout.count} informe${scout.count === 1 ? '' : 's'}`,
    color: colors.get(key) ?? SCOUT_COLORS[0],
    values: axes.map(([axisKey]) => {
      const values = scout.values.get(axisKey);
      return values?.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    })
  }));

  return { axes: axes.map(([, label]) => label), series, reportCount: reports.length };
}
